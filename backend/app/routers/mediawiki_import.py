"""MediaWiki push import endpoint.

Receives schema change proposals from MediaWiki instances and creates
drafts with change rows. Each push creates a NEW draft.
"""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import SessionDep
from app.dependencies.capability import (
    build_capability_url,
    generate_capability_token,
    hash_token,
)
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.v2 import (
    Bundle,
    Category,
    ChangeType,
    Draft,
    DraftChange,
    DraftSource,
    DraftStatus,
    Module,
    OntologyVersion,
    Property,
    Subobject,
    Template,
)
from app.schemas.mediawiki_import import (
    MediaWikiImportPayload,
    MediaWikiImportResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mediawiki", tags=["mediawiki"])

DEFAULT_EXPIRATION_DAYS = 7

# Map entity_type to model class
ENTITY_MODELS = {
    "category": Category,
    "property": Property,
    "subobject": Subobject,
    "module": Module,
    "bundle": Bundle,
    "template": Template,
}


async def entity_exists(
    session: AsyncSession,
    entity_type: str,
    entity_key: str,
) -> bool:
    """Check if entity exists in canonical tables."""
    model = ENTITY_MODELS.get(entity_type)
    if not model:
        return False
    # All entity models have entity_key
    result = await session.execute(select(model).where(model.entity_key == entity_key))  # type: ignore[attr-defined]
    return result.scalars().first() is not None


@router.post("/import", response_model=MediaWikiImportResponse, status_code=201)
@limiter.limit(RATE_LIMITS["draft_create"])
async def import_from_mediawiki(
    request: Request,
    payload: MediaWikiImportPayload,
    session: SessionDep,
) -> MediaWikiImportResponse:
    """Import schema changes from MediaWiki push.

    Creates a new draft with draft_change rows for each change.
    Each push creates a NEW draft (not appended to existing).

    Validation rules:
    - action="modify" or "delete": entity_key MUST exist in canonical
    - action="create": entity_key must NOT exist in canonical

    Args:
        request: HTTP request (for rate limiting and base URL)
        payload: MediaWiki import payload with changes
        session: Database session

    Returns:
        MediaWikiImportResponse with draft_id and capability_url

    Raises:
        HTTPException 400: If entity existence check fails
        HTTPException 422: If payload validation fails
    """
    # Validate entity existence for each change
    errors = []
    for i, change in enumerate(payload.changes):
        exists = await entity_exists(session, change.entity_type, change.entity_key)

        if change.action in ("modify", "delete") and not exists:
            errors.append(
                f"Change {i}: Unknown entity_key '{change.entity_key}' "
                f"with action '{change.action}'. "
                f"Use action='create' for new entities or fix the entity_key."
            )
        elif change.action == "create" and exists:
            errors.append(
                f"Change {i}: Entity '{change.entity_key}' already exists. "
                f"Use action='modify' to update existing entities."
            )

    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    # Get current ontology version for base_commit_sha
    version_result = await session.execute(
        select(OntologyVersion).order_by(col(OntologyVersion.created_at).desc())
    )
    current_version = version_result.scalars().first()
    if not current_version:
        raise HTTPException(status_code=500, detail="No ontology version found. Run ingest first.")

    # Generate capability token
    token = generate_capability_token()

    # Create draft
    draft = Draft(
        capability_hash=hash_token(token),
        base_commit_sha=current_version.commit_sha,
        status=DraftStatus.DRAFT,
        source=DraftSource.MEDIAWIKI_PUSH,
        title=f"MediaWiki import: {payload.comment[:100]}",
        description=f"From {payload.wiki_url} by {payload.user}",
        expires_at=datetime.utcnow() + timedelta(days=DEFAULT_EXPIRATION_DAYS),
    )
    session.add(draft)
    await session.flush()  # Get draft.id

    # Create draft_change rows
    for change in payload.changes:
        # Map action to ChangeType
        change_type = {
            "create": ChangeType.CREATE,
            "modify": ChangeType.UPDATE,
            "delete": ChangeType.DELETE,
        }[change.action]

        draft_change = DraftChange(
            draft_id=draft.id,
            change_type=change_type,
            entity_type=change.entity_type,
            entity_key=change.entity_key,
            patch=change.patch if change.action == "modify" else None,
            replacement_json=change.entity if change.action == "create" else None,
        )
        session.add(draft_change)

    await session.commit()

    # Build capability URL
    base_url = str(request.base_url).rstrip("/")
    capability_url = build_capability_url(token, f"{base_url}/api/v2")

    logger.info(
        "MediaWiki import: created draft %s with %d changes from %s",
        draft.id,
        len(payload.changes),
        payload.wiki_url,
    )

    return MediaWikiImportResponse(
        draft_id=str(draft.id),
        capability_url=capability_url,
        change_count=len(payload.changes),
        expires_at=draft.expires_at.isoformat(),
    )
