"""Pydantic schemas for API request/response validation.

v2.0 schemas are organized by domain:
- draft.py - Draft management schemas
- draft_change.py - Draft change operations
- entity.py - Entity response schemas
- validation.py - Validation result schemas
- graph.py - Graph visualization schemas
"""

# Re-export commonly used schemas
from app.schemas.draft import (
    DraftCreate,
    DraftCreateResponse,
    DraftResponse,
    DraftStatusUpdate,
    DraftSubmitRequest,
    DraftSubmitResponse,
)
from app.schemas.entity import (
    EntityListResponse,
    EntityWithStatus,
)

__all__ = [
    "DraftCreate",
    "DraftCreateResponse",
    "DraftResponse",
    "DraftStatusUpdate",
    "DraftSubmitRequest",
    "DraftSubmitResponse",
    "EntityListResponse",
    "EntityWithStatus",
]
