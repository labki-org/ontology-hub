"""Draft schemas for API request/response validation.

These schemas are defined in app.models.draft and re-exported here
for convenience. Keeping schemas with models ensures consistency.

Usage:
    from app.schemas.draft import DraftCreate, DraftPublic, DraftPayload
"""

from app.models.draft import (
    ChangeDetail,
    ChangesByType,
    DraftCreate,
    DraftCreateResponse,
    DraftDiffResponse,
    DraftPayload,
    DraftPublic,
    DraftStatus,
    DraftUpdate,
    DraftWithCapability,
    EntitiesPayload,
    EntityDefinition,
    ModuleDefinition,
    ProfileDefinition,
    ValidationError,
)

__all__ = [
    "ChangeDetail",
    "ChangesByType",
    "DraftCreate",
    "DraftCreateResponse",
    "DraftDiffResponse",
    "DraftPayload",
    "DraftPublic",
    "DraftStatus",
    "DraftUpdate",
    "DraftWithCapability",
    "EntitiesPayload",
    "EntityDefinition",
    "ModuleDefinition",
    "ProfileDefinition",
    "ValidationError",
]
