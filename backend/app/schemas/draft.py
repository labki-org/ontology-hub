"""Draft schemas for API request/response validation.

These schemas are defined in app.models.draft and re-exported here
for convenience. Keeping schemas with models ensures consistency.

Usage:
    from app.schemas.draft import DraftCreate, DraftPublic
"""

from app.models.draft import (
    DraftCreate,
    DraftCreateResponse,
    DraftPublic,
    DraftStatus,
    DraftUpdate,
    DraftWithCapability,
)

__all__ = [
    "DraftCreate",
    "DraftCreateResponse",
    "DraftPublic",
    "DraftStatus",
    "DraftUpdate",
    "DraftWithCapability",
]
