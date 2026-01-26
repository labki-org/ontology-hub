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
    CategorySubobject,
    Module,
    ModuleDependency,
    ModuleEntity,
    OntologyVersion,
    OntologyVersionPublic,
    Property,
    Subobject,
    SubobjectProperty,
    Template,
)
from app.schemas.entity import (
    BundleDetailResponse,
    CategoryDetailResponse,
    EntityListResponse,
    EntityWithStatus,
    ModuleDetailResponse,
    PropertyDetailResponse,
    PropertyProvenance,
    SubobjectDetailResponse,
    SubobjectPropertyInfo,
    SubobjectProvenance,
    TemplateDetailResponse,
)
from app.services.draft_overlay import DraftContextDep

router = APIRouter(tags=["entities-v2"])


# -----------------------------------------------------------------------------
# Ontology Version endpoint
# -----------------------------------------------------------------------------


@router.get("/ontology-version", response_model=OntologyVersionPublic)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_ontology_version(
    request: Request,
    session: SessionDep,
) -> OntologyVersionPublic:
    """Get current ontology version info.

    Returns the latest canonical ontology version with commit SHA,
    ingest status, and entity counts.

    Rate limited to 200/minute per IP.
    """
    # Get the latest ontology version (only one row)
    query = select(OntologyVersion).order_by(OntologyVersion.created_at.desc()).limit(1)
    result = await session.execute(query)
    version = result.scalar_one_or_none()

    if not version:
        raise HTTPException(
            status_code=404,
            detail="No ontology version found. Run ingest first.",
        )

    return OntologyVersionPublic.model_validate(version)


# -----------------------------------------------------------------------------
# Category endpoints
# -----------------------------------------------------------------------------


@router.get("/categories", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_categories(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: str | None = Query(
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
    # First check if draft overlay has modified parents (effective JSON takes priority)
    if "parents" in effective and effective.get("_change_status") in ("modified", "added"):
        # Draft has modified parents - use effective JSON
        parents = effective.get("parents", [])
    elif category:
        # No draft parent changes - use canonical relationship table
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
        props_result = await session.execute(props_query, {"entity_key": entity_key})

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

    # Get subobjects assigned to this category
    subobjects: list[SubobjectProvenance] = []
    if category:
        subobject_query = (
            select(Subobject.entity_key, Subobject.label, CategorySubobject.is_required)
            .join(CategorySubobject, CategorySubobject.subobject_id == Subobject.id)
            .where(CategorySubobject.category_id == category.id)
            .order_by(Subobject.label)
        )
        subobject_result = await session.execute(subobject_query)
        for row in subobject_result.fetchall():
            subobjects.append(
                SubobjectProvenance(
                    entity_key=row[0],
                    label=row[1],
                    is_required=row[2],
                )
            )
    else:
        # Draft-created category - extract from effective JSON if present
        for sub_key in effective.get("required_subobjects", []):
            subobjects.append(
                SubobjectProvenance(entity_key=sub_key, label=sub_key, is_required=True)
            )
        for sub_key in effective.get("optional_subobjects", []):
            subobjects.append(
                SubobjectProvenance(entity_key=sub_key, label=sub_key, is_required=False)
            )

    return CategoryDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        parents=parents,
        properties=properties,
        subobjects=subobjects,
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
    cursor: str | None = Query(
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
        datatype=effective.get("datatype", "Text"),
        cardinality=effective.get("cardinality", "single"),
        # Validation constraints
        allowed_values=effective.get("allowed_values"),
        allowed_pattern=effective.get("allowed_pattern"),
        allowed_value_list=effective.get("allowed_value_list"),
        # Display configuration
        display_units=effective.get("display_units"),
        display_precision=effective.get("display_precision"),
        # Constraints and relationships
        unique_values=effective.get("unique_values", False),
        has_display_template=effective.get("has_display_template_key"),
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
    cursor: str | None = Query(
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


@router.get("/subobjects/{entity_key}", response_model=SubobjectDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_subobject(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> SubobjectDetailResponse:
    """Get subobject detail.

    Returns subobject with full details and draft change status.

    Rate limited to 200/minute per IP.
    """
    # Get canonical subobject
    query = select(Subobject).where(Subobject.entity_key == entity_key)
    result = await session.execute(query)
    subobj = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(subobj, "subobject", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Subobject not found")

    # Get properties
    required_properties: list[SubobjectPropertyInfo] = []
    optional_properties: list[SubobjectPropertyInfo] = []
    change_status = effective.get("_change_status")

    # Check if effective JSON has draft-modified properties
    has_draft_properties = change_status in ("modified", "added") and (
        "required_properties" in effective or "optional_properties" in effective
    )

    if has_draft_properties:
        # Use properties from effective JSON (draft changes take precedence)
        # Build a property label lookup for better display
        prop_labels: dict[str, str] = {}
        all_prop_keys = list(effective.get("required_properties", [])) + list(
            effective.get("optional_properties", [])
        )
        if all_prop_keys:
            label_query = select(Property.entity_key, Property.label).where(
                Property.entity_key.in_(all_prop_keys)
            )
            label_result = await session.execute(label_query)
            for row in label_result.fetchall():
                prop_labels[row[0]] = row[1]

        for prop_key in effective.get("required_properties", []):
            required_properties.append(
                SubobjectPropertyInfo(
                    entity_key=prop_key,
                    label=prop_labels.get(prop_key, prop_key),
                    is_required=True,
                )
            )
        for prop_key in effective.get("optional_properties", []):
            optional_properties.append(
                SubobjectPropertyInfo(
                    entity_key=prop_key,
                    label=prop_labels.get(prop_key, prop_key),
                    is_required=False,
                )
            )
    elif subobj:
        # No draft changes to properties - query canonical from database
        props_query = (
            select(Property.entity_key, Property.label, SubobjectProperty.is_required)
            .join(SubobjectProperty, SubobjectProperty.property_id == Property.id)
            .where(SubobjectProperty.subobject_id == subobj.id)
            .order_by(Property.label)
        )
        props_result = await session.execute(props_query)
        for row in props_result.fetchall():
            prop_info = SubobjectPropertyInfo(
                entity_key=row[0],
                label=row[1],
                is_required=row[2],
            )
            if row[2]:
                required_properties.append(prop_info)
            else:
                optional_properties.append(prop_info)
    else:
        # Draft-created subobject with no property fields
        for prop_key in effective.get("required_properties", []):
            required_properties.append(
                SubobjectPropertyInfo(entity_key=prop_key, label=prop_key, is_required=True)
            )
        for prop_key in effective.get("optional_properties", []):
            optional_properties.append(
                SubobjectPropertyInfo(entity_key=prop_key, label=prop_key, is_required=False)
            )

    return SubobjectDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        required_properties=required_properties,
        optional_properties=optional_properties,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
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
    cursor: str | None = Query(
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


@router.get("/templates/{entity_key:path}", response_model=TemplateDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_template(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> TemplateDetailResponse:
    """Get template detail.

    Returns template with full details and draft change status.

    Rate limited to 200/minute per IP.
    """
    # Get canonical template
    query = select(Template).where(Template.entity_key == entity_key)
    result = await session.execute(query)
    tmpl = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(tmpl, "template", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Template not found")

    return TemplateDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        wikitext=effective.get("wikitext"),
        property_key=effective.get("property_key"),
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )


# -----------------------------------------------------------------------------
# Module endpoints
# -----------------------------------------------------------------------------


@router.get("/modules", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_modules(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: str | None = Query(
        None, description="Last entity_key from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    """List modules with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Module).order_by(Module.entity_key)

    if cursor:
        query = query.where(Module.entity_key > cursor)

    query = query.limit(limit + 1)

    result = await session.execute(query)
    modules = list(result.scalars().all())

    has_next = len(modules) > limit
    if has_next:
        modules = modules[:limit]

    items: list[EntityWithStatus] = []
    for mod in modules:
        effective = await draft_ctx.apply_overlay(mod, "module", mod.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    draft_creates = await draft_ctx.get_draft_creates("module")
    for create in draft_creates:
        items.append(EntityWithStatus.model_validate(create))

    items.sort(key=lambda x: x.entity_key)
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


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
    change_status = effective.get("_change_status")

    # Check if effective JSON has draft-modified entity arrays
    # canonical_json uses: categories, properties, subobjects, templates
    has_draft_entities = change_status in ("modified", "added") and any(
        key in effective for key in ("categories", "properties", "subobjects", "templates")
    )

    if has_draft_entities:
        # Use entity arrays from effective JSON (draft changes take precedence)
        # Convert from canonical_json format (categories/properties/etc) to API format (entities object)
        if "categories" in effective:
            entities["category"] = effective.get("categories", [])
            direct_category_keys = entities["category"]
        if "properties" in effective:
            entities["property"] = effective.get("properties", [])
        if "subobjects" in effective:
            entities["subobject"] = effective.get("subobjects", [])
        if "templates" in effective:
            entities["template"] = effective.get("templates", [])

        # Compute closure using draft-modified categories
        closure = (
            await compute_module_closure(session, direct_category_keys)
            if direct_category_keys
            else []
        )

        # Get module dependencies (may also be draft-modified)
        if "dependencies" in effective:
            dependencies = effective.get("dependencies", [])
        elif module:
            dep_query = (
                select(Module.entity_key)
                .join(ModuleDependency, ModuleDependency.dependency_id == Module.id)
                .where(ModuleDependency.module_id == module.id)
                .order_by(Module.entity_key)
            )
            dep_result = await session.execute(dep_query)
            dependencies = [row[0] for row in dep_result.fetchall()]
        else:
            dependencies = []
    elif module:
        # No draft changes to entities - query canonical from database
        entity_query = (
            select(ModuleEntity.entity_type, ModuleEntity.entity_key)
            .where(ModuleEntity.module_id == module.id)
            .order_by(ModuleEntity.entity_type, ModuleEntity.entity_key)
        )
        entity_result = await session.execute(entity_query)

        for row in entity_result.fetchall():
            # entity_type is stored as string in DB, may be returned as string or enum
            entity_type = row[0].value if hasattr(row[0], "value") else row[0]
            ent_key = row[1]

            if entity_type not in entities:
                entities[entity_type] = []
            entities[entity_type].append(ent_key)

            # Track categories for closure computation
            if entity_type == "category":
                direct_category_keys.append(ent_key)

        # Compute closure (transitive category dependencies)
        closure = await compute_module_closure(session, direct_category_keys)

        # Get module dependencies
        dep_query = (
            select(Module.entity_key)
            .join(ModuleDependency, ModuleDependency.dependency_id == Module.id)
            .where(ModuleDependency.module_id == module.id)
            .order_by(Module.entity_key)
        )
        dep_result = await session.execute(dep_query)
        dependencies = [row[0] for row in dep_result.fetchall()]
    else:
        # Draft-created module - extract entities from effective JSON if present
        # Try both formats: canonical (categories/properties) and API (entities object)
        if "entities" in effective:
            entities = effective.get("entities", {})
        else:
            if "categories" in effective:
                entities["category"] = effective.get("categories", [])
            if "properties" in effective:
                entities["property"] = effective.get("properties", [])
            if "subobjects" in effective:
                entities["subobject"] = effective.get("subobjects", [])
            if "templates" in effective:
                entities["template"] = effective.get("templates", [])
        dependencies = effective.get("dependencies", [])
        closure = []  # No closure for draft-created modules yet

    return ModuleDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        version=effective.get("version"),
        description=effective.get("description"),
        entities=entities,
        dependencies=dependencies,
        closure=closure,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )


# -----------------------------------------------------------------------------
# Bundle endpoints
# -----------------------------------------------------------------------------


@router.get("/bundles", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_bundles(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: str | None = Query(
        None, description="Last entity_key from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    """List bundles with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Bundle).order_by(Bundle.entity_key)

    if cursor:
        query = query.where(Bundle.entity_key > cursor)

    query = query.limit(limit + 1)

    result = await session.execute(query)
    bundles = list(result.scalars().all())

    has_next = len(bundles) > limit
    if has_next:
        bundles = bundles[:limit]

    items: list[EntityWithStatus] = []
    for bnd in bundles:
        effective = await draft_ctx.apply_overlay(bnd, "bundle", bnd.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    draft_creates = await draft_ctx.get_draft_creates("bundle")
    for create in draft_creates:
        items.append(EntityWithStatus.model_validate(create))

    items.sort(key=lambda x: x.entity_key)
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


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
            JOIN modules_v2 m ON m.id = me.module_id
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
        JOIN modules_v2 m ON m.id = me.module_id
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
    change_status = effective.get("_change_status")

    # Check if effective JSON has draft-modified modules
    # (if "modules" key exists in effective and status is modified or added)
    if change_status in ("modified", "added") and "modules" in effective:
        # Use modules from effective JSON (draft changes take precedence)
        modules = effective.get("modules", [])
        # Compute closure using draft-modified modules list
        closure = await compute_bundle_closure(session, modules) if modules else []
    elif bundle:
        # No draft changes to modules - query canonical from database
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
        # Draft-created bundle with no modules field
        modules = []
        closure = []

    return BundleDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        version=effective.get("version"),
        modules=modules,
        closure=closure,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )
