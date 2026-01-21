"""Entity response schemas with pagination support.

Provides schemas for entity listing with cursor-based pagination.
"""

from typing import Optional

from pydantic import BaseModel

from app.models.entity import EntityPublic


class EntityListResponse(BaseModel):
    """Paginated list of entities.

    Uses cursor-based pagination on entity_id for efficient
    traversal of large result sets.

    Attributes:
        items: List of entities for current page
        next_cursor: entity_id to use for fetching next page (None if no more)
        has_next: Whether more results exist after this page
    """

    items: list[EntityPublic]
    next_cursor: Optional[str] = None
    has_next: bool


class EntityTypeSummary(BaseModel):
    """Summary count for a single entity type."""

    entity_type: str
    count: int


class EntityOverviewResponse(BaseModel):
    """Overview of all entity types with counts.

    Useful for dashboard/overview displays.
    """

    types: list[EntityTypeSummary]
    total: int
