"""Draft change management API endpoints for v2.0.

Provides CRUD operations for managing changes within a draft:
- GET /api/v2/drafts/{token}/changes - List all changes in a draft
- POST /api/v2/drafts/{token}/changes - Add a change to a draft
- DELETE /api/v2/drafts/{token}/changes/{change_id} - Remove a change from a draft

All endpoints require a valid capability token and rate limiting.
Changes can only be added/removed when draft status is DRAFT.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import select
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


async def validate_v2_capability_token(
    token: str, session: AsyncSession
) -> Draft:
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

    return draft


async def entity_exists(
    session: AsyncSession, entity_type: str, entity_key: str
) -> bool:
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

    result = await session.execute(
        select(model).where(model.entity_key == entity_key)
    )
    return result.scalars().first() is not None


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
        select(DraftChange)
        .where(DraftChange.draft_id == draft.id)
        .order_by(DraftChange.created_at)
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
    - Draft is in DRAFT status (not yet validated/submitted)
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

    # Check draft status - can only add changes to DRAFT status
    if draft.status != DraftStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add changes to draft in '{draft.status.value}' status. "
            "Changes can only be added when status is 'draft'.",
        )

    # Verify entity existence based on change type
    exists = await entity_exists(session, change_in.entity_type, change_in.entity_key)

    if change_in.change_type in (ChangeType.UPDATE, ChangeType.DELETE):
        if not exists:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot {change_in.change_type.value} {change_in.entity_type} "
                f"'{change_in.entity_key}': entity does not exist in canonical.",
            )

    elif change_in.change_type == ChangeType.CREATE:
        if exists:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot create {change_in.entity_type} "
                f"'{change_in.entity_key}': entity already exists in canonical.",
            )

    # Create the change
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
    - Draft is in DRAFT status
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

    # Check draft status
    if draft.status != DraftStatus.DRAFT:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot remove changes from draft in '{draft.status.value}' status. "
            "Changes can only be removed when status is 'draft'.",
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
