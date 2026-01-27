"""Draft change management API endpoints for v2.0.

Provides CRUD operations for managing changes within a draft:
- GET /api/v2/drafts/{token}/changes - List all changes in a draft
- POST /api/v2/drafts/{token}/changes - Add a change to a draft
- DELETE /api/v2/drafts/{token}/changes/{change_id} - Remove a change from a draft

All endpoints require a valid capability token and rate limiting.
Changes can only be added/removed when draft status is DRAFT or VALIDATED.
Adding/removing changes from VALIDATED drafts auto-reverts status to DRAFT.
"""

from datetime import datetime
from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import SessionDep
from app.dependencies.capability import hash_token
from app.dependencies.rate_limit import RATE_LIMITS, limiter
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
from app.schemas.draft_change import (
    DraftChangeCreate,
    DraftChangeResponse,
    DraftChangesListResponse,
)
from app.services.draft_workflow import auto_revert_if_validated
from app.services.module_derived import compute_module_derived_entities

router = APIRouter(tags=["draft-changes"])


# Entity model mapping for existence checks
ENTITY_MODEL_MAP = {
    "category": Category,
    "property": Property,
    "subobject": Subobject,
    "module": Module,
    "bundle": Bundle,
    "template": Template,
}


async def validate_v2_capability_token(token: str, session: AsyncSession) -> Draft:
    """Validate capability token and return v2 Draft.

    Args:
        token: The capability token from URL
        session: Database session

    Returns:
        The Draft object if valid and not expired

    Raises:
        HTTPException: 404 for invalid or expired tokens
    """
    token_hash = hash_token(token)

    query = select(Draft).where(Draft.capability_hash == token_hash)
    result = await session.execute(query)
    draft = result.scalar_one_or_none()

    # Return 404 for both invalid and expired - no distinction for security
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")

    if draft.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Draft not found")

    return cast(Draft, draft)


async def entity_exists(session: AsyncSession, entity_type: str, entity_key: str) -> bool:
    """Check if entity exists in canonical tables.

    Args:
        session: Database session
        entity_type: Type of entity (category, property, etc.)
        entity_key: Entity key to check

    Returns:
        True if entity exists, False otherwise
    """
    model = ENTITY_MODEL_MAP.get(entity_type)
    if not model:
        return False

    # All entity models have entity_key
    result = await session.execute(
        select(model).where(model.entity_key == entity_key)  # type: ignore[union-attr]
    )
    return result.scalars().first() is not None


async def auto_populate_module_derived(
    session: AsyncSession,
    draft: Draft,
    change: DraftChange,
) -> None:
    """Auto-populate module derived entities after categories change.

    When a module's categories are modified, this function computes and adds
    the derived entities (properties, subobjects, templates) based on what
    those categories require.

    For UPDATE changes: merges derived entity patches into existing patch
    For CREATE changes: updates replacement_json with derived entities

    Args:
        session: Async database session
        draft: The draft being modified
        change: The module change that was just committed
    """
    from copy import deepcopy

    import jsonpatch

    # Get effective categories from the change
    categories: list[str] = []

    if change.change_type == ChangeType.CREATE:
        # New module: get categories from replacement_json
        categories = (change.replacement_json or {}).get("categories", [])
    elif change.change_type == ChangeType.UPDATE:
        # Updated module: apply ONLY /categories patches to get effective categories
        # (Full patch may fail if it includes /properties etc. that don't exist in canonical)
        module_query = select(Module).where(Module.entity_key == change.entity_key)
        result = await session.execute(module_query)
        module = result.scalar_one_or_none()

        if module:
            canonical_json = deepcopy(module.canonical_json)
            # Extract only /categories-related patches
            categories_patches = [
                op for op in (change.patch or []) if op.get("path", "").startswith("/categories")
            ]
            if categories_patches:
                try:
                    patch = jsonpatch.JsonPatch(categories_patches)
                    effective = patch.apply(canonical_json)
                    categories = effective.get("categories", [])
                except jsonpatch.JsonPatchException:
                    categories = canonical_json.get("categories", [])
            else:
                categories = canonical_json.get("categories", [])
        else:
            # Module doesn't exist in canonical (shouldn't happen for UPDATE)
            return

    if not categories:
        # No categories to derive from - set empty derived arrays
        derived: dict[str, list[str]] = {"properties": [], "subobjects": [], "templates": []}
    else:
        # Compute derived entities from categories
        derived = await compute_module_derived_entities(session, categories, draft_id=draft.id)

    # Update the change with derived entities
    if change.change_type == ChangeType.CREATE:
        # Update replacement_json directly
        replacement = change.replacement_json or {}
        replacement["properties"] = derived["properties"]
        replacement["subobjects"] = derived["subobjects"]
        replacement["templates"] = derived["templates"]
        change.replacement_json = replacement
    else:
        # For UPDATE: add/merge patch operations for derived arrays
        existing_patches: list[dict[str, Any]] = list(change.patch) if change.patch else []

        # Remove any existing patches for derived paths
        derived_paths = {"/properties", "/subobjects", "/templates"}
        filtered_patches = [p for p in existing_patches if p.get("path") not in derived_paths]

        # Add new patches for derived entities
        # IMPORTANT: Use "add" not "replace"! The "replace" op fails if the field
        # doesn't exist in canonical_json (e.g., 'templates' may not exist).
        # For object members, "add" creates if missing or replaces if exists.
        # See CLAUDE.md for more details on this gotcha.
        for path, values in [
            ("/properties", derived["properties"]),
            ("/subobjects", derived["subobjects"]),
            ("/templates", derived["templates"]),
        ]:
            filtered_patches.append({"op": "add", "path": path, "value": values})

        change.patch = filtered_patches  # type: ignore[assignment]

    await session.commit()
    await session.refresh(change)


@router.get("/drafts/{token}/changes", response_model=DraftChangesListResponse)
@limiter.limit(RATE_LIMITS["draft_read"])
async def list_draft_changes(
    request: Request,
    token: str,
    session: SessionDep,
) -> DraftChangesListResponse:
    """List all changes in a draft.

    Returns all changes associated with the draft identified by the
    capability token.

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        session: Database session

    Returns:
        DraftChangesListResponse with changes and total count

    Raises:
        HTTPException: 404 for invalid or expired tokens
    """
    draft = await validate_v2_capability_token(token, session)

    # Query all changes for this draft
    query = (
        select(DraftChange).where(DraftChange.draft_id == draft.id).order_by(col(DraftChange.created_at))
    )
    result = await session.execute(query)
    changes = list(result.scalars().all())

    return DraftChangesListResponse(
        changes=[DraftChangeResponse.model_validate(c) for c in changes],
        total=len(changes),
    )


@router.post(
    "/drafts/{token}/changes",
    response_model=DraftChangeResponse,
    status_code=201,
)
@limiter.limit(RATE_LIMITS["draft_read"])
async def add_draft_change(
    request: Request,
    token: str,
    change_in: DraftChangeCreate,
    session: SessionDep,
) -> DraftChangeResponse:
    """Add a change to a draft.

    Validates that:
    - Draft is in DRAFT or VALIDATED status (auto-reverts VALIDATED to DRAFT)
    - For UPDATE/DELETE: entity exists in canonical
    - For CREATE: entity does NOT exist in canonical

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        change_in: Change creation data
        session: Database session

    Returns:
        DraftChangeResponse with the created change

    Raises:
        HTTPException: 404 for invalid/expired tokens
        HTTPException: 400 if draft is not in DRAFT status
        HTTPException: 400 if entity existence check fails
        HTTPException: 422 for invalid change data
    """
    draft = await validate_v2_capability_token(token, session)

    # Check draft status - can only add changes to DRAFT or VALIDATED status
    # If VALIDATED, auto-revert to DRAFT (per CONTEXT.md workflow)
    if draft.status == DraftStatus.VALIDATED:
        await auto_revert_if_validated(draft, session)
    elif draft.status != DraftStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add changes to draft in '{draft.status.value}' status. "
            "Changes can only be added when status is 'draft' or 'validated'.",
        )

    # Check if there's already a change for this entity in this draft
    existing_query = (
        select(DraftChange)
        .where(DraftChange.draft_id == draft.id)
        .where(DraftChange.entity_type == change_in.entity_type)
        .where(DraftChange.entity_key == change_in.entity_key)
    )
    existing_result = await session.execute(existing_query)
    existing_change = existing_result.scalar_one_or_none()

    # Verify entity existence based on change type
    # For UPDATE/DELETE: entity must exist in canonical OR as a CREATE in this draft
    # For CREATE: entity must NOT exist in canonical (draft CREATEs are allowed to be overwritten)
    exists_in_canonical = await entity_exists(session, change_in.entity_type, change_in.entity_key)
    exists_in_draft = existing_change and existing_change.change_type == ChangeType.CREATE

    if change_in.change_type in (ChangeType.UPDATE, ChangeType.DELETE):
        if not exists_in_canonical and not exists_in_draft:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot {change_in.change_type.value} {change_in.entity_type} "
                f"'{change_in.entity_key}': entity does not exist in canonical or draft.",
            )

    elif change_in.change_type == ChangeType.CREATE:
        if exists_in_canonical:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot create {change_in.entity_type} "
                f"'{change_in.entity_key}': entity already exists in canonical.",
            )

    if existing_change and change_in.change_type == ChangeType.UPDATE:
        if existing_change.change_type == ChangeType.CREATE:
            # Updating a draft-created entity: apply patch to replacement_json
            # Keep it as a CREATE change with the updated JSON
            import jsonpatch

            base_json = existing_change.replacement_json or {}
            try:
                patch = jsonpatch.JsonPatch(change_in.patch or [])
                updated_json = patch.apply(base_json)
                existing_change.replacement_json = updated_json
            except jsonpatch.JsonPatchException as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to apply patch to draft-created entity: {e}",
                ) from e
            change = existing_change
        else:
            # Updating a canonical entity: merge patches
            # New patches for the same path will effectively override old ones when applied
            existing_patches = existing_change.patch or []
            new_patches = change_in.patch or []

            # Merge patches - remove old patches for paths that have new values
            new_paths = {p.get("path") for p in new_patches}
            merged_patches = [p for p in existing_patches if p.get("path") not in new_paths]
            merged_patches.extend(new_patches)

            existing_change.patch = merged_patches
            change = existing_change
    elif existing_change:
        # Special case: DELETE of a draft-created entity
        # Instead of replacing CREATE with DELETE, remove the CREATE entirely
        # (the entity never existed in canonical, so there's nothing to delete)
        if (
            change_in.change_type == ChangeType.DELETE
            and existing_change.change_type == ChangeType.CREATE
        ):
            await session.delete(existing_change)
            # Update draft modified_at
            draft.modified_at = datetime.utcnow()
            session.add(draft)
            await session.commit()
            # Return a special response indicating the change was removed
            # Use the existing change data for the response (it no longer exists but we need something to return)
            return DraftChangeResponse(
                id=existing_change.id,
                change_type=ChangeType.DELETE,
                entity_type=existing_change.entity_type,
                entity_key=existing_change.entity_key,
                patch=None,
                replacement_json=None,
                created_at=existing_change.created_at,
            )

        # For other cases (CREATE->CREATE, DELETE->DELETE), replace the existing change entirely
        existing_change.change_type = change_in.change_type
        existing_change.patch = change_in.patch
        existing_change.replacement_json = change_in.replacement_json
        change = existing_change
    else:
        # Create new change
        change = DraftChange(
            draft_id=draft.id,
            change_type=change_in.change_type,
            entity_type=change_in.entity_type,
            entity_key=change_in.entity_key,
            patch=change_in.patch,
            replacement_json=change_in.replacement_json,
        )
        session.add(change)

    # Update draft modified_at
    draft.modified_at = datetime.utcnow()
    session.add(draft)

    await session.commit()
    await session.refresh(change)

    # Auto-populate derived entities for module changes
    if change_in.entity_type == "module" and change_in.change_type in (
        ChangeType.CREATE,
        ChangeType.UPDATE,
    ):
        # For CREATE: always compute derived entities
        # For UPDATE: check if categories were modified (add, remove, or replace)
        should_populate = change_in.change_type == ChangeType.CREATE
        if change_in.change_type == ChangeType.UPDATE:
            # Check for any patch operation affecting /categories or /categories/*
            should_populate = any(
                op.get("path", "").startswith("/categories") for op in (change_in.patch or [])
            )

        if should_populate:
            await auto_populate_module_derived(session, draft, change)

    return DraftChangeResponse.model_validate(change)


@router.delete(
    "/drafts/{token}/changes/{change_id}",
    status_code=204,
)
@limiter.limit(RATE_LIMITS["draft_read"])
async def remove_draft_change(
    request: Request,
    token: str,
    change_id: UUID,
    session: SessionDep,
) -> None:
    """Remove a change from a draft.

    Validates that:
    - Draft is in DRAFT or VALIDATED status (auto-reverts VALIDATED to DRAFT)
    - Change belongs to this draft

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        change_id: UUID of the change to remove
        session: Database session

    Raises:
        HTTPException: 404 for invalid/expired tokens
        HTTPException: 400 if draft is not in DRAFT status
        HTTPException: 404 if change not found or doesn't belong to draft
    """
    draft = await validate_v2_capability_token(token, session)

    # Check draft status - can only remove changes from DRAFT or VALIDATED status
    # If VALIDATED, auto-revert to DRAFT (per CONTEXT.md workflow)
    if draft.status == DraftStatus.VALIDATED:
        await auto_revert_if_validated(draft, session)
    elif draft.status != DraftStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot remove changes from draft in '{draft.status.value}' status. "
            "Changes can only be removed when status is 'draft' or 'validated'.",
        )

    # Find the change
    query = select(DraftChange).where(DraftChange.id == change_id)
    result = await session.execute(query)
    change = result.scalar_one_or_none()

    if not change:
        raise HTTPException(status_code=404, detail="Change not found")

    # Verify change belongs to this draft
    if change.draft_id != draft.id:
        raise HTTPException(status_code=404, detail="Change not found")

    # Delete the change
    await session.delete(change)

    # Update draft modified_at
    draft.modified_at = datetime.utcnow()
    session.add(draft)

    await session.commit()
