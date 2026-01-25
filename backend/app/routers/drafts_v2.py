"""v2.0 Draft API endpoints with capability URL security.

Implements W3C capability URL pattern for v2.0 draft system:
- POST /drafts - creates draft, returns capability URL (shown ONCE)
- GET /drafts/{token} - retrieves draft using capability token
- PATCH /drafts/{token} - updates draft status and user_comment

Security requirements:
- Tokens never stored, only SHA-256 hashes
- Rate limited to prevent abuse
- No logging of capability tokens or URLs
- Invalid/expired tokens return 404 (no information leakage)
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request
from sqlmodel import func, select

from app.database import SessionDep
from app.dependencies.capability import (
    build_capability_url,
    generate_capability_token,
    hash_token,
)
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.v2 import Draft, DraftChange, DraftStatus, OntologyVersion
from app.schemas.draft_v2 import (
    DraftCreate,
    DraftCreateResponse,
    DraftResponse,
    DraftStatusUpdate,
)
from app.schemas.validation_v2 import DraftValidationReportV2, ValidationResultV2
from app.services.draft_workflow import transition_to_validated
from app.services.validation.validator_v2 import validate_draft_v2

# Default expiration: 7 days (from v1.0 pattern)
DEFAULT_EXPIRATION_DAYS = 7

router = APIRouter(prefix="/drafts", tags=["drafts-v2"])


# Valid status transitions
VALID_TRANSITIONS: dict[DraftStatus, set[DraftStatus]] = {
    DraftStatus.DRAFT: {DraftStatus.VALIDATED},
    DraftStatus.VALIDATED: {DraftStatus.SUBMITTED, DraftStatus.DRAFT},
    DraftStatus.SUBMITTED: {DraftStatus.MERGED, DraftStatus.REJECTED},
    DraftStatus.MERGED: set(),  # Terminal state
    DraftStatus.REJECTED: set(),  # Terminal state
}


async def get_draft_by_token(token: str, session: SessionDep) -> Draft:
    """Retrieve draft by capability token.

    Returns 404 for both invalid and expired tokens (no distinction
    to prevent oracle attacks - cannot determine if token exists).

    Args:
        token: Capability token from URL
        session: Database session

    Returns:
        Draft object if valid and not expired

    Raises:
        HTTPException: 404 for invalid or expired tokens
    """
    token_hash = hash_token(token)

    statement = select(Draft).where(Draft.capability_hash == token_hash)
    result = await session.execute(statement)
    draft = result.scalar_one_or_none()

    # Return 404 for both invalid and expired - no distinction for security
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft not found")

    # Check expiration - same 404 response
    if draft.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Draft not found")

    return draft


async def get_change_count(draft_id, session: SessionDep) -> int:
    """Get the number of changes in a draft."""
    statement = (
        select(func.count())
        .select_from(DraftChange)
        .where(DraftChange.draft_id == draft_id)
    )
    result = await session.execute(statement)
    return result.scalar_one()


def draft_to_response(draft: Draft, change_count: int) -> DraftResponse:
    """Convert Draft model to DraftResponse with change_count."""
    return DraftResponse(
        id=draft.id,
        status=draft.status,
        source=draft.source,
        title=draft.title,
        description=draft.description,
        user_comment=draft.user_comment,
        base_commit_sha=draft.base_commit_sha,
        rebase_status=draft.rebase_status,
        rebase_commit_sha=draft.rebase_commit_sha,
        created_at=draft.created_at,
        modified_at=draft.modified_at,
        expires_at=draft.expires_at,
        change_count=change_count,
    )


@router.post("/", response_model=DraftCreateResponse, status_code=201)
@limiter.limit(RATE_LIMITS["draft_create"])
async def create_draft(
    request: Request,  # Required for SlowAPI rate limiting
    draft_in: DraftCreate,
    session: SessionDep,
) -> DraftCreateResponse:
    """Create a new draft and return capability URL.

    The capability URL is shown ONCE and cannot be recovered.
    Save it immediately - losing it means losing access to the draft.

    The draft is automatically bound to the current OntologyVersion's
    commit_sha for rebase tracking when canonical changes.

    Rate limited to 20/hour per IP to prevent abuse.

    Args:
        request: HTTP request (required for rate limiting)
        draft_in: Draft creation data
        session: Database session

    Returns:
        DraftCreateResponse with capability_url (shown ONCE), draft, expires_at

    Raises:
        HTTPException: 503 if no ontology version exists
    """
    # Get current OntologyVersion for base_commit_sha
    version_stmt = (
        select(OntologyVersion)
        .order_by(OntologyVersion.created_at.desc())
        .limit(1)
    )
    version_result = await session.execute(version_stmt)
    current_version = version_result.scalar_one_or_none()

    if current_version is None:
        raise HTTPException(
            status_code=503,
            detail="No ontology version available. Run ingest first.",
        )

    # Generate capability token (NOT logged, NOT stored)
    token = generate_capability_token()

    # Calculate expiration
    expires_at = datetime.utcnow() + timedelta(days=DEFAULT_EXPIRATION_DAYS)

    # Create draft with hashed token
    draft = Draft(
        capability_hash=hash_token(token),
        base_commit_sha=current_version.commit_sha,
        source=draft_in.source,
        title=draft_in.title,
        description=draft_in.description,
        expires_at=expires_at,
    )

    session.add(draft)
    await session.commit()
    await session.refresh(draft)

    # Build capability URL - token in fragment to reduce referrer leakage
    # Note: Do NOT log this URL or the token
    base_url = str(request.base_url).rstrip("/")
    capability_url = build_capability_url(token, f"{base_url}/api/v2")

    # New draft has 0 changes
    draft_response = draft_to_response(draft, change_count=0)

    return DraftCreateResponse(
        capability_url=capability_url,
        draft=draft_response,
        expires_at=draft.expires_at,
    )


@router.get("/{token}", response_model=DraftResponse)
@limiter.limit(RATE_LIMITS["draft_read"])
async def get_draft(
    request: Request,  # Required for SlowAPI rate limiting
    token: str,
    session: SessionDep,
) -> DraftResponse:
    """Retrieve a draft using capability token.

    Returns 404 for both invalid and expired tokens (no distinction
    to prevent oracle attacks - cannot determine if token exists).

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        session: Database session

    Returns:
        DraftResponse with draft data and change_count

    Raises:
        HTTPException: 404 for invalid or expired tokens
    """
    draft = await get_draft_by_token(token, session)
    change_count = await get_change_count(draft.id, session)

    return draft_to_response(draft, change_count)


@router.patch("/{token}", response_model=DraftResponse)
@limiter.limit(RATE_LIMITS["draft_read"])
async def update_draft_status(
    request: Request,  # Required for SlowAPI rate limiting
    token: str,
    update: DraftStatusUpdate,
    session: SessionDep,
) -> DraftResponse:
    """Update draft status and/or user_comment.

    Only allows valid status transitions:
    - DRAFT -> VALIDATED
    - VALIDATED -> SUBMITTED or DRAFT
    - SUBMITTED -> MERGED or REJECTED

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        update: Status update payload
        session: Database session

    Returns:
        Updated DraftResponse

    Raises:
        HTTPException: 404 for invalid or expired tokens
        HTTPException: 400 for invalid status transitions
    """
    draft = await get_draft_by_token(token, session)

    # Validate status transition
    allowed_transitions = VALID_TRANSITIONS.get(draft.status, set())
    if update.status not in allowed_transitions and update.status != draft.status:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition: {draft.status.value} -> {update.status.value}. "
            f"Allowed: {[s.value for s in allowed_transitions]}",
        )

    # Update status if changed
    if update.status != draft.status:
        draft.status = update.status

        # Set timestamp for specific transitions
        if update.status == DraftStatus.VALIDATED:
            draft.validated_at = datetime.utcnow()
        elif update.status == DraftStatus.SUBMITTED:
            draft.submitted_at = datetime.utcnow()

    # Update user_comment if provided
    if update.user_comment is not None:
        draft.user_comment = update.user_comment

    # Always update modified_at
    draft.modified_at = datetime.utcnow()

    session.add(draft)
    await session.commit()
    await session.refresh(draft)

    change_count = await get_change_count(draft.id, session)
    return draft_to_response(draft, change_count)


@router.post("/{token}/validate", response_model=DraftValidationReportV2)
@limiter.limit(RATE_LIMITS["draft_read"])
async def validate_draft(
    request: Request,
    token: str,
    session: SessionDep,
) -> DraftValidationReportV2:
    """Validate draft and transition to VALIDATED status if no errors.

    Runs all validation checks:
    - Reference existence (parents, properties, modules exist)
    - Circular inheritance detection
    - Breaking change detection
    - JSON Schema validation against _schema.json definitions
    - Semver classification

    If validation passes (no errors), transitions draft status to VALIDATED.
    Warnings and info messages do NOT prevent validation from passing.

    If draft has rebase_status="conflict", validation will include a warning
    about potential conflicts that should be reviewed.

    Rate limited to 100/minute per IP.

    Args:
        request: HTTP request (required for rate limiting)
        token: Capability token from URL
        session: Database session

    Returns:
        DraftValidationReportV2 with validation results and semver suggestions

    Raises:
        HTTPException: 404 for invalid or expired tokens
        HTTPException: 400 if draft is in terminal status (SUBMITTED/MERGED/REJECTED)
    """
    draft = await get_draft_by_token(token, session)

    # Check draft is in validatable status
    if draft.status in (DraftStatus.SUBMITTED, DraftStatus.MERGED, DraftStatus.REJECTED):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot validate draft in '{draft.status.value}' status. "
            "Draft has already been submitted.",
        )

    # Run validation
    report = await validate_draft_v2(draft.id, session)

    # Add warning if rebase status indicates potential conflicts
    if draft.rebase_status == "conflict":
        report.warnings.append(
            ValidationResultV2(
                entity_type="category",  # Generic
                entity_key="*",
                field_path=None,
                code="REBASE_CONFLICT",
                message="Draft may have conflicts with recent canonical changes. Review before submitting.",
                severity="warning",
            )
        )

    # If no errors, transition to VALIDATED
    if report.is_valid:
        await transition_to_validated(draft.id, session)
        await session.commit()

    return report
