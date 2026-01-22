"""Draft API endpoints with capability URL security.

Implements W3C capability URL pattern:
- POST /drafts - creates draft, returns capability URL (shown ONCE)
- GET /drafts/{token} - retrieves draft using capability token
- GET /drafts/{token}/diff - retrieves stored diff for draft
- Invalid/expired tokens return 404 (no information leakage)

Security requirements:
- Tokens never stored, only SHA-256 hashes
- Rate limited to prevent abuse
- No logging of capability tokens or URLs
"""

from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, Request

from app.database import SessionDep
from app.dependencies.capability import (
    build_capability_url,
    generate_capability_token,
    hash_token,
    validate_capability_token,
)
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.draft import (
    Draft,
    DraftCreate,
    DraftCreateResponse,
    DraftDiffResponse,
    DraftPatchPayload,
    DraftPayload,
    DraftPublic,
    ValidationError,
)
from app.services.draft_diff import compute_draft_diff
from app.services.validation.validator import validate_draft

# Default expiration: 7 days (from CONTEXT.md)
DEFAULT_EXPIRATION_DAYS = 7

router = APIRouter(prefix="/drafts", tags=["drafts"])


def validate_draft_payload(payload: DraftPayload) -> list[ValidationError]:
    """Validate draft payload and return any warnings.

    Fatal validation errors cause Pydantic to reject the request with 422.
    This function returns non-fatal warnings that don't block creation.

    Args:
        payload: Validated DraftPayload

    Returns:
        List of ValidationError with severity="warning"
    """
    warnings: list[ValidationError] = []

    # Check wiki_url is valid URL format
    try:
        parsed = urlparse(payload.wiki_url)
        if not parsed.scheme or not parsed.netloc:
            warnings.append(
                ValidationError(
                    field="wiki_url",
                    message="wiki_url does not appear to be a valid URL",
                    severity="warning",
                )
            )
    except Exception:
        warnings.append(
            ValidationError(
                field="wiki_url",
                message="wiki_url could not be parsed as URL",
                severity="warning",
            )
        )

    # Check entities has at least one array populated
    has_entities = (
        len(payload.entities.categories) > 0
        or len(payload.entities.properties) > 0
        or len(payload.entities.subobjects) > 0
    )
    has_modules = len(payload.modules) > 0
    has_profiles = len(payload.profiles) > 0

    if not has_entities and not has_modules and not has_profiles:
        warnings.append(
            ValidationError(
                field="entities",
                message="Draft contains no entities, modules, or profiles",
                severity="warning",
            )
        )

    return warnings


@router.post("/", response_model=DraftCreateResponse, status_code=201)
@limiter.limit(RATE_LIMITS["draft_create"])
async def create_draft(
    request: Request,  # Required for SlowAPI rate limiting
    draft_in: DraftCreate,
    session: SessionDep,
) -> DraftCreateResponse:
    """Create a new draft and return capability URL with diff preview.

    The capability URL is shown ONCE and cannot be recovered.
    Save it immediately - losing it means losing access to the draft.

    Rate limited to 20/hour per IP to prevent abuse.

    Args:
        request: HTTP request (required for rate limiting)
        draft_in: Draft creation data with validated DraftPayload
        session: Database session

    Returns:
        DraftCreateResponse with capability_url, expires_at, diff_preview,
        and any validation warnings
    """
    payload = draft_in.payload

    # Validate payload and collect warnings (non-fatal)
    validation_warnings = validate_draft_payload(payload)

    # Compute diff preview
    diff_preview = await compute_draft_diff(payload, session)

    # Run validation engine
    validation_report = await validate_draft(payload, session)

    # Generate capability token (NOT logged, NOT stored)
    token = generate_capability_token()

    # Calculate expiration
    expires_at = datetime.utcnow() + timedelta(days=DEFAULT_EXPIRATION_DAYS)

    # Create draft with hashed token
    draft = Draft(
        capability_hash=hash_token(token),
        payload=payload.model_dump(),
        source_wiki=payload.wiki_url,
        base_commit_sha=payload.base_version,
        diff_preview=diff_preview.model_dump(),
        validation_results=validation_report.model_dump(),
        expires_at=expires_at,
    )

    session.add(draft)
    await session.commit()
    await session.refresh(draft)

    # Build capability URL - token in fragment to reduce referrer leakage
    # Note: Do NOT log this URL or the token
    base_url = str(request.base_url).rstrip("/")
    capability_url = build_capability_url(token, f"{base_url}/api/v1")

    return DraftCreateResponse(
        capability_url=capability_url,
        expires_at=draft.expires_at,
        diff_preview=diff_preview,
        validation_results=validation_report.model_dump(),
        validation_warnings=validation_warnings,
    )


@router.get("/{token}", response_model=DraftPublic)
@limiter.limit(RATE_LIMITS["draft_read"])
async def get_draft(
    request: Request,  # Required for SlowAPI rate limiting
    token: str,
    session: SessionDep,
) -> DraftPublic:
    """Retrieve a draft using capability token.

    Returns 404 for both invalid and expired tokens (no distinction
    to prevent oracle attacks - cannot determine if token exists).

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        session: Database session

    Returns:
        DraftPublic with draft data (excludes capability_hash)

    Raises:
        HTTPException: 404 for invalid or expired tokens
    """
    # validate_capability_token returns 404 for invalid OR expired
    draft = await validate_capability_token(token, session)

    return DraftPublic.model_validate(draft)


@router.get("/{token}/diff", response_model=DraftDiffResponse)
@limiter.limit(RATE_LIMITS["draft_read"])
async def get_draft_diff(
    request: Request,  # Required for SlowAPI rate limiting
    token: str,
    session: SessionDep,
) -> DraftDiffResponse:
    """Retrieve the computed diff for a draft.

    Returns the diff preview computed during draft creation,
    showing changes vs canonical database state.

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        session: Database session

    Returns:
        DraftDiffResponse with changes grouped by entity type

    Raises:
        HTTPException: 404 for invalid or expired tokens
    """
    # validate_capability_token returns 404 for invalid OR expired
    draft = await validate_capability_token(token, session)

    if draft.diff_preview is None:
        # Should not happen for new drafts, but handle gracefully
        return DraftDiffResponse()

    return DraftDiffResponse.model_validate(draft.diff_preview)


@router.patch("/{token}", response_model=DraftPublic)
@limiter.limit(RATE_LIMITS["draft_read"])
async def update_draft(
    request: Request,  # Required for SlowAPI rate limiting
    token: str,
    patch: DraftPatchPayload,
    session: SessionDep,
) -> DraftPublic:
    """Update a draft with partial changes.

    Accepts partial updates for entities, modules, and profiles.
    Merges updates with existing payload and recomputes diff preview.

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        patch: Partial update payload
        session: Database session

    Returns:
        Updated DraftPublic

    Raises:
        HTTPException: 404 for invalid or expired tokens
        HTTPException: 400 if draft is not in pending status
    """
    # Validate token and get draft
    draft = await validate_capability_token(token, session)

    # Only allow updates on pending drafts
    if draft.status.value != "pending":
        raise HTTPException(
            status_code=400,
            detail="Can only update drafts in pending status",
        )

    # Get existing payload
    existing_payload = dict(draft.payload)

    # Apply entity updates
    if patch.entities:
        existing_entities = existing_payload.get("entities", {})

        # Helper to apply updates to entity list
        def apply_entity_updates(
            existing_list: list, updates: list, id_field: str = "entity_id"
        ) -> list:
            # Build lookup by ID
            existing_map = {e.get(id_field): e for e in existing_list}

            for update in updates:
                entity_id = getattr(update, id_field, None) or update.get(id_field)
                if entity_id in existing_map:
                    # Merge update into existing
                    update_dict = (
                        update.model_dump(exclude_unset=True)
                        if hasattr(update, "model_dump")
                        else update
                    )
                    for key, value in update_dict.items():
                        if value is not None:
                            existing_map[entity_id][key] = value
                else:
                    # Add new entity
                    new_entity = (
                        update.model_dump() if hasattr(update, "model_dump") else update
                    )
                    existing_list.append(new_entity)
                    existing_map[entity_id] = new_entity

            return existing_list

        # Apply category updates
        if patch.entities.categories:
            existing_entities["categories"] = apply_entity_updates(
                existing_entities.get("categories", []),
                patch.entities.categories,
            )

        # Apply property updates
        if patch.entities.properties:
            existing_entities["properties"] = apply_entity_updates(
                existing_entities.get("properties", []),
                patch.entities.properties,
            )

        # Apply subobject updates
        if patch.entities.subobjects:
            existing_entities["subobjects"] = apply_entity_updates(
                existing_entities.get("subobjects", []),
                patch.entities.subobjects,
            )

        existing_payload["entities"] = existing_entities

    # Apply module updates
    if patch.modules:
        existing_modules = existing_payload.get("modules", [])
        module_map = {m.get("module_id"): m for m in existing_modules}

        for update in patch.modules:
            update_dict = (
                update.model_dump() if hasattr(update, "model_dump") else update
            )
            module_id = update_dict.get("module_id")
            if module_id:
                if module_id in module_map:
                    module_map[module_id].update(update_dict)
                else:
                    existing_modules.append(update_dict)
                    module_map[module_id] = update_dict

        existing_payload["modules"] = existing_modules

    # Apply profile updates
    if patch.profiles:
        existing_profiles = existing_payload.get("profiles", [])
        profile_map = {p.get("profile_id"): p for p in existing_profiles}

        for update in patch.profiles:
            update_dict = (
                update.model_dump() if hasattr(update, "model_dump") else update
            )
            profile_id = update_dict.get("profile_id")
            if profile_id:
                if profile_id in profile_map:
                    profile_map[profile_id].update(update_dict)
                else:
                    existing_profiles.append(update_dict)
                    profile_map[profile_id] = update_dict

        existing_payload["profiles"] = existing_profiles

    # Update draft payload
    draft.payload = existing_payload

    # Recompute diff preview and validation
    validated_payload = DraftPayload.model_validate(existing_payload)
    new_diff = await compute_draft_diff(validated_payload, session)
    draft.diff_preview = new_diff.model_dump()

    # Recompute validation after update
    validation_report = await validate_draft(validated_payload, session)
    draft.validation_results = validation_report.model_dump()

    # Save changes
    session.add(draft)
    await session.commit()
    await session.refresh(draft)

    return DraftPublic.model_validate(draft)
