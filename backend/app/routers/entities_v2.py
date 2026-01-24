"""v2.0 Entity API endpoints with draft overlay support.

Provides read access to v2.0 schema entities with optional draft context:
- GET /categories - List categories with pagination and draft overlay
- GET /categories/{entity_key} - Category detail with parents and properties
- GET /properties - List properties with pagination and draft overlay
- GET /properties/{entity_key} - Property detail
- GET /properties/{entity_key}/used-by - Categories using this property
- GET /subobjects - List subobjects with pagination
- GET /templates - List templates with pagination
- GET /modules/{entity_key} - Module detail with entities and closure
- GET /bundles/{entity_key} - Bundle detail with modules and closure

All endpoints accept optional draft_id query parameter for effective view
computation. When draft_id is provided, entities include change_status
metadata (added/modified/deleted/unchanged).
"""

import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import text
from sqlmodel import select

from app.database import SessionDep
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.v2 import (
    Bundle,
    BundleModule,
    Category,
    CategoryParent,
    CategoryProperty,
    Module,
    ModuleEntity,
    Property,
    Subobject,
    Template,
)
from app.schemas.entity_v2 import (
    BundleDetailResponse,
    CategoryDetailResponse,
    EntityListResponse,
    EntityWithStatus,
    ModuleDetailResponse,
    PropertyDetailResponse,
    PropertyProvenance,
)
from app.services.draft_overlay import DraftContextDep

router = APIRouter(tags=["entities-v2"])


# -----------------------------------------------------------------------------
# Category endpoints
# -----------------------------------------------------------------------------


@router.get("/categories", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_categories(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: Optional[str] = Query(
        None, description="Last entity_key from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    """List categories with cursor-based pagination and draft overlay.

    Returns paginated list of categories. When draft_id is provided,
    includes draft-created categories and change_status on each item.

    Rate limited to 100/minute per IP.
    """
    # Query canonical categories
    query = select(Category).order_by(Category.entity_key)

    if cursor:
        query = query.where(Category.entity_key > cursor)

    # Fetch limit+1 to detect has_next
    query = query.limit(limit + 1)

    result = await session.execute(query)
    categories = list(result.scalars().all())

    # Check if there are more results
    has_next = len(categories) > limit
    if has_next:
        categories = categories[:limit]

    # Apply draft overlay to each category
    items: list[EntityWithStatus] = []
    for cat in categories:
        effective = await draft_ctx.apply_overlay(cat, "category", cat.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    # Include draft-created categories
    draft_creates = await draft_ctx.get_draft_creates("category")
    for create in draft_creates:
        items.append(EntityWithStatus.model_validate(create))

    # Re-sort by entity_key after merging draft creates
    items.sort(key=lambda x: x.entity_key)

    # Recalculate cursor after sorting
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


@router.get("/categories/{entity_key}", response_model=CategoryDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_category(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> CategoryDetailResponse:
    """Get category detail with parents and properties.

    Returns category with parent category keys and full property provenance
    including inherited properties with source category and depth.

    Rate limited to 200/minute per IP.
    """
    # Get canonical category
    query = select(Category).where(Category.entity_key == entity_key)
    result = await session.execute(query)
    category = result.scalar_one_or_none()

    # Check for draft-created category if not in canonical
    effective = await draft_ctx.apply_overlay(category, "category", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Category not found")

    # Get parent category keys
    if category:
        parent_query = (
            select(Category.entity_key)
            .join(CategoryParent, CategoryParent.parent_id == Category.id)
            .where(CategoryParent.category_id == category.id)
        )
        parent_result = await session.execute(parent_query)
        parents = [row[0] for row in parent_result.all()]
    else:
        # Draft-created category - extract parents from effective JSON if present
        parents = effective.get("parents", [])

    # Get properties with provenance
    # Check for draft-aware inheritance first (when draft modifies parents)
    properties: list[PropertyProvenance] = []
    draft_properties = await draft_ctx.get_draft_aware_inherited_properties(
        session, entity_key, category.id if category else None
    )

    if draft_properties:
        # Draft modifies parents - use computed inheritance
        for prop in draft_properties:
            properties.append(PropertyProvenance(**prop))
    elif category:
        # No draft parent changes or no draft context - use canonical materialized view
        # Query the category_property_effective materialized view
        # joined with properties table to get property labels
        props_query = text("""
            SELECT
                p.entity_key,
                p.label,
                cpe.depth,
                cpe.is_required,
                src.entity_key as source_category
            FROM category_property_effective cpe
            JOIN properties p ON p.id = cpe.property_id
            JOIN categories c ON c.id = cpe.category_id
            JOIN categories src ON src.id = cpe.source_category_id
            WHERE c.entity_key = :entity_key
            ORDER BY cpe.depth, p.label
        """)
        props_result = await session.execute(
            props_query, {"entity_key": entity_key}
        )

        for row in props_result.fetchall():
            properties.append(
                PropertyProvenance(
                    entity_key=row[0],
                    label=row[1],
                    is_direct=(row[2] == 0),
                    is_inherited=(row[2] > 0),
                    is_required=row[3],
                    source_category=row[4],
                    inheritance_depth=row[2],
                )
            )

    return CategoryDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        parents=parents,
        properties=properties,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
        patch_error=effective.get("_patch_error"),
    )


# -----------------------------------------------------------------------------
# Property endpoints
# -----------------------------------------------------------------------------


@router.get("/properties", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_properties(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: Optional[str] = Query(
        None, description="Last entity_key from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    """List properties with cursor-based pagination and draft overlay.

    Returns paginated list of properties. When draft_id is provided,
    includes draft-created properties and change_status on each item.

    Rate limited to 100/minute per IP.
    """
    # Query canonical properties
    query = select(Property).order_by(Property.entity_key)

    if cursor:
        query = query.where(Property.entity_key > cursor)

    query = query.limit(limit + 1)

    result = await session.execute(query)
    properties = list(result.scalars().all())

    has_next = len(properties) > limit
    if has_next:
        properties = properties[:limit]

    # Apply draft overlay to each property
    items: list[EntityWithStatus] = []
    for prop in properties:
        effective = await draft_ctx.apply_overlay(prop, "property", prop.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    # Include draft-created properties
    draft_creates = await draft_ctx.get_draft_creates("property")
    for create in draft_creates:
        items.append(EntityWithStatus.model_validate(create))

    items.sort(key=lambda x: x.entity_key)
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


@router.get("/properties/{entity_key}", response_model=PropertyDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_property(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> PropertyDetailResponse:
    """Get property detail.

    Returns property with full details and draft change status.

    Rate limited to 200/minute per IP.
    """
    # Get canonical property
    query = select(Property).where(Property.entity_key == entity_key)
    result = await session.execute(query)
    prop = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(prop, "property", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Property not found")

    return PropertyDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        datatype=effective.get("datatype", "text"),
        cardinality=effective.get("cardinality", "single"),
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )


@router.get("/properties/{entity_key}/used-by", response_model=list[EntityWithStatus])
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_property_used_by(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> list[EntityWithStatus]:
    """Get categories that use this property (QRY-05).

    Returns list of categories that have this property assigned
    (directly or inherited), with draft change status.

    Rate limited to 200/minute per IP.
    """
    # Verify property exists
    prop_query = select(Property).where(Property.entity_key == entity_key)
    prop_result = await session.execute(prop_query)
    prop = prop_result.scalar_one_or_none()

    if not prop:
        # Check if draft-created
        effective = await draft_ctx.apply_overlay(None, "property", entity_key)
        if not effective:
            raise HTTPException(status_code=404, detail="Property not found")
        # Draft-created property - no canonical categories use it yet
        return []

    # Query categories that use this property via category_property join
    query = (
        select(Category)
        .join(CategoryProperty, CategoryProperty.category_id == Category.id)
        .where(CategoryProperty.property_id == prop.id)
        .order_by(Category.entity_key)
    )
    result = await session.execute(query)
    categories = result.scalars().all()

    # Apply draft overlay to each category
    items: list[EntityWithStatus] = []
    for cat in categories:
        effective = await draft_ctx.apply_overlay(cat, "category", cat.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    return items


# -----------------------------------------------------------------------------
# Subobject endpoints
# -----------------------------------------------------------------------------


@router.get("/subobjects", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_subobjects(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: Optional[str] = Query(
        None, description="Last entity_key from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    """List subobjects with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Subobject).order_by(Subobject.entity_key)

    if cursor:
        query = query.where(Subobject.entity_key > cursor)

    query = query.limit(limit + 1)

    result = await session.execute(query)
    subobjects = list(result.scalars().all())

    has_next = len(subobjects) > limit
    if has_next:
        subobjects = subobjects[:limit]

    items: list[EntityWithStatus] = []
    for sub in subobjects:
        effective = await draft_ctx.apply_overlay(sub, "subobject", sub.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    draft_creates = await draft_ctx.get_draft_creates("subobject")
    for create in draft_creates:
        items.append(EntityWithStatus.model_validate(create))

    items.sort(key=lambda x: x.entity_key)
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


# -----------------------------------------------------------------------------
# Template endpoints
# -----------------------------------------------------------------------------


@router.get("/templates", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_templates(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: Optional[str] = Query(
        None, description="Last entity_key from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    """List templates with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Template).order_by(Template.entity_key)

    if cursor:
        query = query.where(Template.entity_key > cursor)

    query = query.limit(limit + 1)

    result = await session.execute(query)
    templates = list(result.scalars().all())

    has_next = len(templates) > limit
    if has_next:
        templates = templates[:limit]

    items: list[EntityWithStatus] = []
    for tmpl in templates:
        effective = await draft_ctx.apply_overlay(tmpl, "template", tmpl.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    draft_creates = await draft_ctx.get_draft_creates("template")
    for create in draft_creates:
        items.append(EntityWithStatus.model_validate(create))

    items.sort(key=lambda x: x.entity_key)
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


# -----------------------------------------------------------------------------
# Module endpoints
# -----------------------------------------------------------------------------


async def compute_module_closure(
    session: SessionDep,
    direct_category_keys: list[str],
) -> list[str]:
    """Compute transitive category dependencies for a module.

    For each category in module, find categories it depends on (inherits from).
    Closure = all ancestor categories not already in direct list.
    Uses recursive CTE on category_parent table.

    Args:
        session: Async database session
        direct_category_keys: List of category entity_keys directly in the module

    Returns:
        List of ancestor category entity_keys (transitive dependencies)
    """
    if not direct_category_keys:
        return []

    # Recursive CTE to find all ancestor categories
    query = text("""
        WITH RECURSIVE ancestors AS (
            -- Base: direct module categories' parents
            SELECT cp.parent_id as category_id
            FROM category_parent cp
            JOIN categories c ON c.id = cp.category_id
            WHERE c.entity_key = ANY(:category_keys)

            UNION

            -- Recursive: parents of parents
            SELECT cp.parent_id
            FROM category_parent cp
            JOIN ancestors a ON a.category_id = cp.category_id
        )
        SELECT DISTINCT c.entity_key
        FROM ancestors a
        JOIN categories c ON c.id = a.category_id
        WHERE c.entity_key != ALL(:category_keys)
    """)
    result = await session.execute(query, {"category_keys": direct_category_keys})
    return [row[0] for row in result.fetchall()]


@router.get("/modules/{entity_key}", response_model=ModuleDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_module(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> ModuleDetailResponse:
    """Get module detail with entities and closure (QRY-06).

    Returns module with entities grouped by type and computed transitive
    category dependencies (closure).

    Rate limited to 200/minute per IP.
    """
    # Get canonical module
    query = select(Module).where(Module.entity_key == entity_key)
    result = await session.execute(query)
    module = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(module, "module", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Module not found")

    # Get entities grouped by type
    entities: dict[str, list[str]] = {}
    direct_category_keys: list[str] = []

    if module:
        # Query module_entity to get all entities in this module
        entity_query = (
            select(ModuleEntity.entity_type, ModuleEntity.entity_key)
            .where(ModuleEntity.module_id == module.id)
            .order_by(ModuleEntity.entity_type, ModuleEntity.entity_key)
        )
        entity_result = await session.execute(entity_query)

        for row in entity_result.fetchall():
            entity_type = row[0].value  # Convert enum to string
            ent_key = row[1]

            if entity_type not in entities:
                entities[entity_type] = []
            entities[entity_type].append(ent_key)

            # Track categories for closure computation
            if entity_type == "category":
                direct_category_keys.append(ent_key)

        # Compute closure (transitive category dependencies)
        closure = await compute_module_closure(session, direct_category_keys)
    else:
        # Draft-created module - extract entities from effective JSON if present
        entities = effective.get("entities", {})
        closure = []  # No closure for draft-created modules yet

    return ModuleDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        version=effective.get("version"),
        entities=entities,
        closure=closure,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )


# -----------------------------------------------------------------------------
# Bundle endpoints
# -----------------------------------------------------------------------------


async def compute_bundle_closure(
    session: SessionDep,
    direct_module_keys: list[str],
) -> list[str]:
    """Compute transitive module dependencies for a bundle.

    Module A depends on Module B if A has a category that inherits from
    a category in B. Uses category_parent and module_entity tables.

    Args:
        session: Async database session
        direct_module_keys: List of module entity_keys directly in the bundle

    Returns:
        List of dependent module entity_keys (transitive dependencies)
    """
    if not direct_module_keys:
        return []

    # Find modules containing ancestor categories of direct modules' categories
    query = text("""
        WITH RECURSIVE category_ancestors AS (
            -- Base: categories in direct modules
            SELECT me.entity_key as category_key, m.entity_key as source_module_key
            FROM module_entity me
            JOIN modules m ON m.id = me.module_id
            WHERE m.entity_key = ANY(:module_keys)
              AND me.entity_type = 'category'
        ),
        parent_categories AS (
            -- Get parent categories of all module categories
            SELECT
                parent_cat.entity_key as category_key,
                ca.source_module_key
            FROM category_ancestors ca
            JOIN categories c ON c.entity_key = ca.category_key
            JOIN category_parent cp ON cp.category_id = c.id
            JOIN categories parent_cat ON parent_cat.id = cp.parent_id
        ),
        all_ancestors AS (
            -- Recursive: find all ancestor categories
            SELECT category_key, source_module_key FROM parent_categories

            UNION

            SELECT
                parent_cat.entity_key,
                aa.source_module_key
            FROM all_ancestors aa
            JOIN categories c ON c.entity_key = aa.category_key
            JOIN category_parent cp ON cp.category_id = c.id
            JOIN categories parent_cat ON parent_cat.id = cp.parent_id
        )
        -- Find modules containing these ancestor categories
        SELECT DISTINCT m.entity_key
        FROM all_ancestors aa
        JOIN categories c ON c.entity_key = aa.category_key
        JOIN module_entity me ON me.entity_key = aa.category_key AND me.entity_type = 'category'
        JOIN modules m ON m.id = me.module_id
        WHERE m.entity_key != ALL(:module_keys)
    """)
    result = await session.execute(query, {"module_keys": direct_module_keys})
    return [row[0] for row in result.fetchall()]


@router.get("/bundles/{entity_key}", response_model=BundleDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_bundle(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> BundleDetailResponse:
    """Get bundle detail with modules and closure (QRY-07).

    Returns bundle with direct modules and computed transitive module
    dependencies (closure).

    Rate limited to 200/minute per IP.
    """
    # Get canonical bundle
    query = select(Bundle).where(Bundle.entity_key == entity_key)
    result = await session.execute(query)
    bundle = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(bundle, "bundle", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Bundle not found")

    # Get direct modules
    modules: list[str] = []

    if bundle:
        # Query bundle_module to get all modules in this bundle
        module_query = (
            select(Module.entity_key)
            .join(BundleModule, BundleModule.module_id == Module.id)
            .where(BundleModule.bundle_id == bundle.id)
            .order_by(Module.entity_key)
        )
        module_result = await session.execute(module_query)
        modules = [row[0] for row in module_result.fetchall()]

        # Compute closure (transitive module dependencies)
        closure = await compute_bundle_closure(session, modules)
    else:
        # Draft-created bundle - extract modules from effective JSON if present
        modules = effective.get("modules", [])
        closure = []  # No closure for draft-created bundles yet

    return BundleDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        version=effective.get("version"),
        modules=modules,
        closure=closure,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )
