"""Draft API endpoints with capability URL security.

Implements W3C capability URL pattern:
- POST /drafts - creates draft, returns capability URL (shown ONCE)
- GET /drafts/{token} - retrieves draft using capability token
- Invalid/expired tokens return 404 (no information leakage)

Security requirements:
- Tokens never stored, only SHA-256 hashes
- Rate limited to prevent abuse
- No logging of capability tokens or URLs
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Request

from app.database import SessionDep
from app.dependencies.capability import (
    build_capability_url,
    generate_capability_token,
    hash_token,
    validate_capability_token,
)
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.draft import Draft, DraftCreate, DraftCreateResponse, DraftPublic

# Default expiration: 7 days (from CONTEXT.md)
DEFAULT_EXPIRATION_DAYS = 7

router = APIRouter(prefix="/drafts", tags=["drafts"])


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

    Rate limited to 20/hour per IP to prevent abuse.

    Args:
        request: HTTP request (required for rate limiting)
        draft_in: Draft creation data (payload, source_wiki, base_commit_sha)
        session: Database session

    Returns:
        DraftCreateResponse with capability_url, expires_at, and warning message
    """
    # Generate capability token (NOT logged, NOT stored)
    token = generate_capability_token()

    # Calculate expiration
    expires_at = datetime.utcnow() + timedelta(days=DEFAULT_EXPIRATION_DAYS)

    # Create draft with hashed token
    draft = Draft(
        capability_hash=hash_token(token),
        payload=draft_in.payload,
        source_wiki=draft_in.source_wiki,
        base_commit_sha=draft_in.base_commit_sha,
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
