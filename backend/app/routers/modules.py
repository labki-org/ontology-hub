"""Module and Profile API endpoints.

Provides read-only access to modules and profiles:
- GET /modules - List all modules with optional search
- GET /modules/{module_id} - Get single module
- GET /modules/{module_id}/entities - Get entities grouped by type
- GET /profiles - List all profiles with optional search
- GET /profiles/{profile_id} - Get single profile
- GET /profiles/{profile_id}/modules - Get modules in a profile

All endpoints filter out soft-deleted records (deleted_at is not None).
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import cast, String
from sqlmodel import select

from app.database import SessionDep
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.entity import Entity, EntityPublic, EntityType
from app.models.module import Module, ModulePublic, Profile, ProfilePublic


router = APIRouter(tags=["modules"])


class ModuleEntitiesResponse(BaseModel):
    """Response schema for module entities grouped by type."""

    categories: list[EntityPublic]
    properties: list[EntityPublic]
    subobjects: list[EntityPublic]


# Module endpoints


@router.get("/modules", response_model=list[ModulePublic])
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_modules(
    request: Request,
    session: SessionDep,
    search: Optional[str] = Query(
        None, min_length=2, max_length=100, description="Search by label"
    ),
) -> list[ModulePublic]:
    """List all modules with optional search.

    Returns list of modules ordered by label.
    Optionally filter by label using ILIKE search.

    Rate limited to 100/minute per IP.

    Args:
        search: Optional search term (2-100 characters) for ILIKE on label

    Returns:
        List of ModulePublic
    """
    query = select(Module).where(Module.deleted_at.is_(None))

    if search:
        pattern = f"%{search}%"
        query = query.where(Module.label.ilike(pattern))

    query = query.order_by(Module.label)

    result = await session.execute(query)
    modules = result.scalars().all()

    return [ModulePublic.model_validate(m) for m in modules]


@router.get("/modules/{module_id}", response_model=ModulePublic)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_module(
    request: Request,
    module_id: str,
    session: SessionDep,
) -> ModulePublic:
    """Get a single module by module_id.

    Rate limited to 200/minute per IP.

    Args:
        module_id: The module's unique identifier

    Returns:
        ModulePublic with module data

    Raises:
        HTTPException: 404 if module not found or soft-deleted
    """
    query = select(Module).where(
        Module.module_id == module_id,
        Module.deleted_at.is_(None),
    )

    result = await session.execute(query)
    module = result.scalar_one_or_none()

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    return ModulePublic.model_validate(module)


@router.get("/modules/{module_id}/entities", response_model=ModuleEntitiesResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_module_entities(
    request: Request,
    module_id: str,
    session: SessionDep,
) -> ModuleEntitiesResponse:
    """Get all entities in a module grouped by type.

    Categories are directly included via module.category_ids.
    Properties and subobjects are transitively included via the categories.

    Rate limited to 200/minute per IP.

    Args:
        module_id: The module's unique identifier

    Returns:
        ModuleEntitiesResponse with categories, properties, and subobjects

    Raises:
        HTTPException: 404 if module not found
    """
    # Get the module
    module_query = select(Module).where(
        Module.module_id == module_id,
        Module.deleted_at.is_(None),
    )
    result = await session.execute(module_query)
    module = result.scalar_one_or_none()

    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    category_ids = module.category_ids or []

    # Get categories directly in module
    categories: list[EntityPublic] = []
    if category_ids:
        cat_query = select(Entity).where(
            Entity.entity_type == EntityType.CATEGORY,
            Entity.entity_id.in_(category_ids),
            Entity.deleted_at.is_(None),
        ).order_by(Entity.label)
        result = await session.execute(cat_query)
        categories = [EntityPublic.model_validate(e) for e in result.scalars().all()]

    # Collect all property and subobject IDs from categories
    property_ids: set[str] = set()
    subobject_ids: set[str] = set()

    for cat in categories:
        schema = cat.schema_definition or {}
        if isinstance(schema, dict):
            props = schema.get("properties", [])
            if isinstance(props, list):
                property_ids.update(props)
            subs = schema.get("subobjects", [])
            if isinstance(subs, list):
                subobject_ids.update(subs)

    # Get properties
    properties: list[EntityPublic] = []
    if property_ids:
        prop_query = select(Entity).where(
            Entity.entity_type == EntityType.PROPERTY,
            Entity.entity_id.in_(list(property_ids)),
            Entity.deleted_at.is_(None),
        ).order_by(Entity.label)
        result = await session.execute(prop_query)
        properties = [EntityPublic.model_validate(e) for e in result.scalars().all()]

    # Get subobjects
    subobjects: list[EntityPublic] = []
    if subobject_ids:
        sub_query = select(Entity).where(
            Entity.entity_type == EntityType.SUBOBJECT,
            Entity.entity_id.in_(list(subobject_ids)),
            Entity.deleted_at.is_(None),
        ).order_by(Entity.label)
        result = await session.execute(sub_query)
        subobjects = [EntityPublic.model_validate(e) for e in result.scalars().all()]

    return ModuleEntitiesResponse(
        categories=categories,
        properties=properties,
        subobjects=subobjects,
    )


# Profile endpoints


@router.get("/profiles", response_model=list[ProfilePublic])
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_profiles(
    request: Request,
    session: SessionDep,
    search: Optional[str] = Query(
        None, min_length=2, max_length=100, description="Search by label"
    ),
) -> list[ProfilePublic]:
    """List all profiles with optional search.

    Returns list of profiles ordered by label.
    Optionally filter by label using ILIKE search.

    Rate limited to 100/minute per IP.

    Args:
        search: Optional search term (2-100 characters) for ILIKE on label

    Returns:
        List of ProfilePublic
    """
    query = select(Profile).where(Profile.deleted_at.is_(None))

    if search:
        pattern = f"%{search}%"
        query = query.where(Profile.label.ilike(pattern))

    query = query.order_by(Profile.label)

    result = await session.execute(query)
    profiles = result.scalars().all()

    return [ProfilePublic.model_validate(p) for p in profiles]


@router.get("/profiles/{profile_id}", response_model=ProfilePublic)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_profile(
    request: Request,
    profile_id: str,
    session: SessionDep,
) -> ProfilePublic:
    """Get a single profile by profile_id.

    Rate limited to 200/minute per IP.

    Args:
        profile_id: The profile's unique identifier

    Returns:
        ProfilePublic with profile data

    Raises:
        HTTPException: 404 if profile not found or soft-deleted
    """
    query = select(Profile).where(
        Profile.profile_id == profile_id,
        Profile.deleted_at.is_(None),
    )

    result = await session.execute(query)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return ProfilePublic.model_validate(profile)


@router.get("/profiles/{profile_id}/modules", response_model=list[ModulePublic])
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_profile_modules(
    request: Request,
    profile_id: str,
    session: SessionDep,
) -> list[ModulePublic]:
    """Get all modules in a profile.

    Resolves module_ids to full module objects.

    Rate limited to 200/minute per IP.

    Args:
        profile_id: The profile's unique identifier

    Returns:
        List of ModulePublic for modules in the profile

    Raises:
        HTTPException: 404 if profile not found
    """
    # Get the profile
    profile_query = select(Profile).where(
        Profile.profile_id == profile_id,
        Profile.deleted_at.is_(None),
    )
    result = await session.execute(profile_query)
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    module_ids = profile.module_ids or []

    if not module_ids:
        return []

    # Get modules
    modules_query = select(Module).where(
        Module.module_id.in_(module_ids),
        Module.deleted_at.is_(None),
    ).order_by(Module.label)

    result = await session.execute(modules_query)
    modules = result.scalars().all()

    return [ModulePublic.model_validate(m) for m in modules]
