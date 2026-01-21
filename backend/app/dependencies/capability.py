"""Capability URL token management for secure draft access.

Implements W3C capability URL pattern:
- Tokens generated with cryptographic randomness (secrets.token_urlsafe)
- Tokens are NEVER stored, only their SHA-256 hash
- Invalid and expired tokens return identical 404 (no oracle attacks)
- URLs use fragment (#) to reduce referrer leakage
"""

import hashlib
import secrets
from datetime import datetime

from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession


def generate_capability_token() -> str:
    """Generate a cryptographically secure capability token.

    Uses secrets.token_urlsafe(32) which produces:
    - 32 bytes of random data (256 bits of entropy)
    - Base64url encoded to ~43 characters
    - W3C recommends minimum 120 bits; we use 256 bits

    Returns:
        A secure random token string (~43 chars, base64url)
    """
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Hash a capability token using SHA-256.

    The hash is what gets stored in the database - NEVER the token itself.

    Args:
        token: The capability token to hash

    Returns:
        64-character hexadecimal SHA-256 hash
    """
    return hashlib.sha256(token.encode()).hexdigest()


def build_capability_url(token: str, base_url: str) -> str:
    """Build a capability URL with token in fragment.

    Using fragment (#) instead of path or query param reduces
    the risk of token leakage via Referrer headers - fragments
    are not included in HTTP Referrer.

    Args:
        token: The capability token (NOT the hash)
        base_url: The base URL (e.g., "http://localhost:8080/api/v1")

    Returns:
        Full capability URL with token in fragment
    """
    return f"{base_url}/drafts#{token}"


async def validate_capability_token(
    token: str,
    session: AsyncSession,
) -> "Draft":
    """Validate a capability token and return the associated draft.

    Security requirements:
    - Returns 404 for BOTH invalid tokens AND expired drafts (no distinction)
    - This prevents oracle attacks (cannot determine if token exists)
    - Uses hash lookup, never stores or compares plaintext tokens

    Args:
        token: The capability token from the URL fragment
        session: Database session

    Returns:
        The Draft object if valid and not expired

    Raises:
        HTTPException: 404 for invalid or expired tokens (same error)
    """
    # Import here to avoid circular imports
    from app.models.draft import Draft

    # Hash the provided token to look up in database
    token_hash = hash_token(token)

    # Query by hash
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
