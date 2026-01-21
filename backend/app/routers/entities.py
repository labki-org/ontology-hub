"""Entity API endpoints with cursor-based pagination.

Provides read-only access to indexed schema entities:
- GET /entities - Overview of all entity types with counts
- GET /entities/{entity_type} - List entities by type with pagination
- GET /entities/{entity_type}/{entity_id} - Get single entity by type and ID

All endpoints filter out soft-deleted entities (deleted_at is not None).
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import func
from sqlmodel import select

from app.database import SessionDep
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.entity import Entity, EntityPublic, EntityType
from app.schemas.entity import (
    EntityListResponse,
    EntityOverviewResponse,
    EntityTypeSummary,
)

router = APIRouter(prefix="/entities", tags=["entities"])


@router.get("/", response_model=EntityOverviewResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def get_entity_overview(
    request: Request,
    session: SessionDep,
) -> EntityOverviewResponse:
    """Get overview of all entity types with counts.

    Returns count per entity type and total count.
    Useful for dashboard/overview displays.

    Rate limited to 100/minute per IP.
    """
    # Count entities per type (excluding soft-deleted)
    query = (
        select(Entity.entity_type, func.count(Entity.id).label("count"))
        .where(Entity.deleted_at.is_(None))
        .group_by(Entity.entity_type)
    )

    result = await session.execute(query)
    rows = result.all()

    types = [
        EntityTypeSummary(entity_type=row.entity_type.value, count=row.count)
        for row in rows
    ]
    total = sum(t.count for t in types)

    return EntityOverviewResponse(types=types, total=total)


@router.get("/{entity_type}", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_entities_by_type(
    request: Request,
    entity_type: EntityType,
    session: SessionDep,
    cursor: Optional[str] = Query(
        None, description="Last entity_id from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    """List entities by type with cursor-based pagination.

    Returns paginated list of entities for the given type.
    Use next_cursor from response to fetch subsequent pages.

    Rate limited to 100/minute per IP.

    Args:
        entity_type: Type of entities to list (category, property, subobject)
        cursor: entity_id to start after (from previous page's next_cursor)
        limit: Maximum number of items to return (1-100, default 20)

    Returns:
        EntityListResponse with items, next_cursor, and has_next indicator
    """
    # Build query for active (non-deleted) entities of this type
    query = select(Entity).where(
        Entity.entity_type == entity_type,
        Entity.deleted_at.is_(None),
    )

    # Apply cursor for pagination
    if cursor:
        query = query.where(Entity.entity_id > cursor)

    # Order by entity_id for consistent pagination, fetch limit+1 to detect has_next
    query = query.order_by(Entity.entity_id).limit(limit + 1)

    result = await session.execute(query)
    entities = list(result.scalars().all())

    # Check if there are more results
    has_next = len(entities) > limit
    if has_next:
        entities = entities[:limit]

    # Build response
    items = [EntityPublic.model_validate(e) for e in entities]
    next_cursor = entities[-1].entity_id if has_next and entities else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


@router.get("/{entity_type}/{entity_id}", response_model=EntityPublic)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_entity(
    request: Request,
    entity_type: EntityType,
    entity_id: str,
    session: SessionDep,
) -> EntityPublic:
    """Get a single entity by type and ID.

    Rate limited to 200/minute per IP.

    Args:
        entity_type: Type of entity (category, property, subobject)
        entity_id: Schema-defined ID (e.g., "Person", "hasName")

    Returns:
        EntityPublic with entity data

    Raises:
        HTTPException: 404 if entity not found or soft-deleted
    """
    query = select(Entity).where(
        Entity.entity_type == entity_type,
        Entity.entity_id == entity_id,
        Entity.deleted_at.is_(None),
    )

    result = await session.execute(query)
    entity = result.scalar_one_or_none()

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    return EntityPublic.model_validate(entity)
