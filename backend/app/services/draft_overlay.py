"""Draft overlay service for computing effective entity views.

This service loads draft changes and applies them to canonical data
to produce effective views for query endpoints. Server-side overlay
computation ensures frontend never performs draft merging.
"""

import uuid
from copy import deepcopy
from typing import Annotated, Optional

import jsonpatch
from fastapi import Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import SessionDep
from app.models.v2 import ChangeType, DraftChange


class DraftOverlayService:
    """Compute effective views by applying draft changes to canonical entities.

    When a draft_id is provided, this service:
    1. Loads all draft changes for the draft (cached per-request)
    2. For each entity query, applies the appropriate overlay:
       - CREATE: Return replacement_json with _change_status="added"
       - DELETE: Return canonical with _change_status="deleted", _deleted=True
       - UPDATE: Apply JSON Patch to canonical, return with _change_status="modified"
       - No change: Return canonical with _change_status="unchanged"

    Usage:
        draft_ctx = DraftOverlayService(session, draft_id=uuid)
        effective = await draft_ctx.apply_overlay(canonical, "category", "Person")
    """

    def __init__(
        self, session: AsyncSession, draft_id: Optional[uuid.UUID] = None
    ) -> None:
        """Initialize draft overlay service.

        Args:
            session: Async database session
            draft_id: Optional draft UUID for effective view computation.
                      If None, all queries return canonical data only.
        """
        self.session = session
        self.draft_id = draft_id
        self._draft_changes: Optional[dict[str, DraftChange]] = None

    async def _load_draft_changes(self) -> dict[str, DraftChange]:
        """Load all changes for this draft, keyed by '{entity_type}:{entity_key}'.

        Changes are cached for the lifetime of this service instance
        (typically one request).

        Returns:
            Dict mapping "entity_type:entity_key" to DraftChange objects
        """
        if self._draft_changes is not None:
            return self._draft_changes

        if not self.draft_id:
            self._draft_changes = {}
            return self._draft_changes

        query = select(DraftChange).where(DraftChange.draft_id == self.draft_id)
        result = await self.session.execute(query)
        changes = result.scalars().all()

        self._draft_changes = {
            f"{change.entity_type}:{change.entity_key}": change for change in changes
        }
        return self._draft_changes

    async def apply_overlay(
        self,
        canonical: Optional[object],
        entity_type: str,
        entity_key: str,
    ) -> Optional[dict]:
        """Apply draft changes to canonical entity, return effective JSON with change_status.

        This is the main method for computing effective views. It handles all
        draft change types:
        - CREATE: Return replacement_json with _change_status="added"
        - DELETE: Return canonical with _change_status="deleted", _deleted=True
        - UPDATE: Deep copy canonical, apply JSON Patch, return with _change_status="modified"
        - No change: Return canonical JSON with _change_status="unchanged"

        Args:
            canonical: SQLModel instance with canonical_json attribute, or None
            entity_type: Entity type string (e.g., "category", "property")
            entity_key: Entity key to look up in draft changes

        Returns:
            Effective entity dict with _change_status metadata, or None if:
            - Entity doesn't exist in canonical AND no draft creates it
            - DELETE of non-existent entity

        Note:
            Always deep copies before applying JSON Patch to avoid mutating
            cached/shared data.
        """
        changes = await self._load_draft_changes()
        change_key = f"{entity_type}:{entity_key}"
        draft_change = changes.get(change_key)

        # No draft context or no changes for this entity
        if not draft_change:
            if canonical is not None:
                # Return canonical with "unchanged" status
                canonical_json = getattr(canonical, "canonical_json", None)
                if canonical_json:
                    result = deepcopy(canonical_json)
                    result["_change_status"] = "unchanged"
                    return result
            return None

        # Draft creates new entity
        if draft_change.change_type == ChangeType.CREATE:
            if draft_change.replacement_json:
                result = deepcopy(draft_change.replacement_json)
                result["_change_status"] = "added"
                return result
            return None

        # Draft deletes entity
        if draft_change.change_type == ChangeType.DELETE:
            if canonical is not None:
                canonical_json = getattr(canonical, "canonical_json", None)
                if canonical_json:
                    result = deepcopy(canonical_json)
                    result["_change_status"] = "deleted"
                    result["_deleted"] = True
                    return result
            # Deleted entity that doesn't exist in canonical (shouldn't happen)
            return None

        # Draft updates entity (apply JSON Patch)
        if draft_change.change_type == ChangeType.UPDATE:
            if canonical is None:
                # Update to non-existent entity (shouldn't happen)
                return None

            canonical_json = getattr(canonical, "canonical_json", None)
            if not canonical_json:
                return None

            # Deep copy to avoid mutating cached canonical data
            base = deepcopy(canonical_json)

            # Apply JSON Patch operations
            try:
                patch_ops = draft_change.patch
                if patch_ops:
                    patch = jsonpatch.JsonPatch(patch_ops)
                    result = patch.apply(base)
                else:
                    result = base
                result["_change_status"] = "modified"
                return result
            except jsonpatch.JsonPatchException as e:
                # Patch failed - return canonical with error marker
                # This indicates draft is stale or invalid
                result = deepcopy(canonical_json)
                result["_change_status"] = "unchanged"
                result["_patch_error"] = str(e)
                return result

        return None

    async def get_draft_creates(self, entity_type: str) -> list[dict]:
        """Get all CREATE changes for an entity type.

        Used for list queries to include draft-created entities
        alongside canonical entities.

        Args:
            entity_type: Entity type to filter (e.g., "category", "property")

        Returns:
            List of replacement_json dicts with _change_status="added"
        """
        if not self.draft_id:
            return []

        # Query draft changes for this entity type with CREATE change type
        query = (
            select(DraftChange)
            .where(DraftChange.draft_id == self.draft_id)
            .where(DraftChange.change_type == ChangeType.CREATE)
            .where(DraftChange.entity_type == entity_type)
        )
        result = await self.session.execute(query)
        changes = result.scalars().all()

        creates = []
        for change in changes:
            if change.replacement_json:
                entity = deepcopy(change.replacement_json)
                entity["_change_status"] = "added"
                creates.append(entity)

        return creates

    async def is_deleted(self, entity_type: str, entity_key: str) -> bool:
        """Check if an entity is deleted in the draft.

        Useful for filtering list queries where deleted entities
        should be marked but shown.

        Args:
            entity_type: Entity type string
            entity_key: Entity key to check

        Returns:
            True if entity has DELETE change in draft
        """
        changes = await self._load_draft_changes()
        change_key = f"{entity_type}:{entity_key}"
        draft_change = changes.get(change_key)

        if draft_change and draft_change.change_type == ChangeType.DELETE:
            return True
        return False


async def get_draft_context(
    session: SessionDep,
    draft_id: Optional[uuid.UUID] = Query(
        None, description="Draft UUID for effective view"
    ),
) -> DraftOverlayService:
    """FastAPI dependency for draft overlay context.

    Provides a DraftOverlayService instance for query endpoints.
    If draft_id is None, the service returns canonical data only.
    If draft_id is provided, the service merges draft changes.

    Usage in endpoint:
        @router.get("/categories/{entity_key}")
        async def get_category(
            entity_key: str,
            draft_ctx: DraftContextDep,
        ):
            ...
    """
    return DraftOverlayService(session=session, draft_id=draft_id)


# Type alias for dependency injection
DraftContextDep = Annotated[DraftOverlayService, Depends(get_draft_context)]
