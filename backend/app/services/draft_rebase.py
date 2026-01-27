"""Draft rebase service for auto-rebase after canonical updates."""

import logging
from copy import deepcopy
from typing import Any

import jsonpatch
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import (
    Bundle,
    Category,
    ChangeType,
    Draft,
    DraftChange,
    DraftStatus,
    Module,
    Property,
    Subobject,
    Template,
)

logger = logging.getLogger(__name__)

# Map entity_type string to model class
ENTITY_MODELS = {
    "category": Category,
    "property": Property,
    "subobject": Subobject,
    "module": Module,
    "bundle": Bundle,
    "template": Template,
}


async def load_canonical_entity(
    session: AsyncSession,
    entity_type: str,
    entity_key: str,
) -> dict | None:
    """Load canonical entity JSON by type and key."""
    model = ENTITY_MODELS.get(entity_type)
    if not model:
        return None

    # Use getattr to access entity_key column dynamically (models all have it)
    entity_key_col = getattr(model, "entity_key")
    result = await session.execute(select(model).where(entity_key_col == entity_key))
    entity = result.scalars().first()
    if entity and hasattr(entity, "canonical_json"):
        canonical: dict = entity.canonical_json  # type: ignore[assignment]
        return canonical
    return None


async def check_patch_applies(
    patch_ops: list[dict],
    canonical_json: dict,
) -> tuple[bool, str | None]:
    """Test if patch applies cleanly to canonical.

    Returns:
        (success, error_message)
    """
    try:
        test_base = deepcopy(canonical_json)
        patch = jsonpatch.JsonPatch(patch_ops)
        patch.apply(test_base)
        return (True, None)
    except jsonpatch.JsonPatchConflict as e:
        return (False, f"Patch conflict: {e}")
    except jsonpatch.JsonPatchException as e:
        return (False, f"Patch error: {e}")


async def auto_rebase_drafts(
    session: AsyncSession,
    old_commit_sha: str,
    new_commit_sha: str,
) -> dict[str, Any]:
    """Rebase all in-progress drafts after canonical update.

    For each draft with base_commit_sha == old_commit_sha:
    1. Load all draft_change rows
    2. For UPDATE changes: try to apply patch to new canonical
    3. For DELETE changes: verify entity still exists
    4. Mark draft as "clean" or "conflict" based on results

    IMPORTANT: Never modify draft_change rows - keep original patches
    for manual conflict resolution.

    Args:
        session: Database session
        old_commit_sha: Previous canonical commit
        new_commit_sha: New canonical commit after ingest

    Returns:
        Stats dict with counts of rebased/conflicted drafts
    """
    stats = {"rebased": 0, "conflicted": 0, "skipped": 0}

    # Find drafts that need rebase
    # Use getattr for status column to access .in_() method
    status_col = getattr(Draft, "status")
    drafts_query = select(Draft).where(
        Draft.base_commit_sha == old_commit_sha,
        status_col.in_([DraftStatus.DRAFT, DraftStatus.VALIDATED]),
    )
    result = await session.execute(drafts_query)
    drafts = result.scalars().all()

    for draft in drafts:
        conflict_detected = False
        conflict_reason = None

        # Load all changes for this draft
        changes_query = select(DraftChange).where(DraftChange.draft_id == draft.id)
        changes_result = await session.execute(changes_query)
        changes = changes_result.scalars().all()

        for change in changes:
            if change.change_type == ChangeType.UPDATE:
                # Load new canonical entity
                canonical = await load_canonical_entity(
                    session,
                    change.entity_type,
                    change.entity_key,
                )

                if canonical is None:
                    # Entity was deleted in new canonical
                    conflict_detected = True
                    conflict_reason = f"Entity {change.entity_key} deleted in canonical"
                    break

                # Try to apply patch
                if change.patch:
                    success, error = await check_patch_applies(
                        change.patch,
                        canonical,
                    )
                    if not success:
                        conflict_detected = True
                        conflict_reason = error
                        break

            elif change.change_type == ChangeType.DELETE:
                # Verify entity still exists (can't delete what's gone)
                canonical = await load_canonical_entity(
                    session,
                    change.entity_type,
                    change.entity_key,
                )
                if canonical is None:
                    # Entity already deleted
                    conflict_detected = True
                    conflict_reason = f"Entity {change.entity_key} already deleted"
                    break

            # CREATE changes don't need rebase check - they're new entities

        # Update draft rebase status
        draft.rebase_commit_sha = new_commit_sha
        if conflict_detected:
            draft.rebase_status = "conflict"
            logger.warning(
                "Draft %s has conflict: %s",
                draft.id,
                conflict_reason,
            )
            stats["conflicted"] += 1
        else:
            draft.rebase_status = "clean"
            stats["rebased"] += 1

        session.add(draft)

    await session.commit()

    logger.info(
        "Auto-rebase complete: %d rebased, %d conflicted",
        stats["rebased"],
        stats["conflicted"],
    )

    return stats
