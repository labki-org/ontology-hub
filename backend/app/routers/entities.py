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

import json

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import text
from sqlmodel import col, select

from app.database import SessionDep
from app.dependencies.rate_limit import RATE_LIMITS, limiter
from app.models.v2 import (
    Bundle,
    BundleModule,
    Category,
    CategoryParent,
    CategoryProperty,
    CategorySubobject,
    Dashboard,
    Module,
    ModuleEntity,
    OntologyVersion,
    OntologyVersionPublic,
    Property,
    Resource,
    Subobject,
    SubobjectProperty,
    Template,
)
from app.schemas.entity import (
    BundleDetailResponse,
    CategoryDetailResponse,
    DashboardDetailResponse,
    DashboardPage,
    EntityListResponse,
    EntityWithStatus,
    ModuleDetailResponse,
    PropertyDetailResponse,
    PropertyProvenance,
    ResourceDetailResponse,
    SubobjectDetailResponse,
    SubobjectPropertyInfo,
    SubobjectProvenance,
    TemplateDetailResponse,
)
from app.services.draft_overlay import DraftContextDep
from app.services.resource_validation import (
    RESERVED_KEYS_WITH_INTERNAL,
    get_entity_categories,
)

router = APIRouter(tags=["entities-v2"])


# -----------------------------------------------------------------------------
# Membership helper
# -----------------------------------------------------------------------------


async def _get_entity_membership(
    session: SessionDep,
    entity_key: str,
    entity_type: str,
) -> tuple[list[str], list[str]]:
    """Get module and bundle membership for an entity.

    Returns (module_keys, bundle_keys) where bundle membership is derived
    transitively: entity → ModuleEntity → Module → BundleModule → Bundle.
    """
    # Module membership: which modules contain this entity
    module_query = (
        select(col(Module.entity_key).label("module_key"))  # type: ignore[var-annotated]
        .join(ModuleEntity, col(ModuleEntity.module_id) == col(Module.id))
        .where(
            ModuleEntity.entity_key == entity_key,
            ModuleEntity.entity_type == entity_type,
        )
    )
    module_result = await session.execute(module_query)
    module_keys = [row.module_key for row in module_result.all()]

    # Bundle membership: which bundles contain those modules
    bundle_keys: list[str] = []
    if module_keys:
        bundle_query = (
            select(col(Bundle.entity_key).label("bundle_key"))  # type: ignore[var-annotated]
            .join(BundleModule, col(BundleModule.bundle_id) == col(Bundle.id))
            .join(Module, col(Module.id) == col(BundleModule.module_id))
            .where(col(Module.entity_key).in_(module_keys))
            .distinct()
        )
        bundle_result = await session.execute(bundle_query)
        bundle_keys = [row.bundle_key for row in bundle_result.all()]

    return module_keys, bundle_keys


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
    query = select(OntologyVersion).order_by(col(OntologyVersion.created_at).desc()).limit(1)
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
    limit: int = Query(20, ge=1, le=500, description="Max items per page"),
    search: str | None = Query(None, description="Filter by entity_key or label (case-insensitive)"),
) -> EntityListResponse:
    """List categories with cursor-based pagination and draft overlay.

    Returns paginated list of categories. When draft_id is provided,
    includes draft-created categories and change_status on each item.

    Rate limited to 100/minute per IP.
    """
    # Query canonical categories
    query = select(Category).order_by(Category.entity_key)

    if search:
        query = query.where(
            col(Category.entity_key).ilike(f"%{search}%")
            | col(Category.label).ilike(f"%{search}%")
        )

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
            .join(CategoryParent, col(CategoryParent.parent_id) == col(Category.id))
            .where(CategoryParent.category_id == category.id)
        )
        parent_result = await session.execute(parent_query)
        parents = [row[0] for row in parent_result.all()]
    else:
        # Draft-created category - extract parents from effective JSON if present
        parents = effective.get("parents", [])

    # Get properties with provenance
    properties: list[PropertyProvenance] = []
    change_status = effective.get("_change_status")

    # If draft has modified or created this category, use the effective JSON for
    # direct properties (the materialized view only has canonical state)
    has_draft_property_changes = change_status in ("modified", "added") and (
        "required_properties" in effective or "optional_properties" in effective
    )

    if has_draft_property_changes:
        # Build direct properties from effective JSON
        for prop_key in effective.get("required_properties", []):
            properties.append(
                PropertyProvenance(
                    entity_key=prop_key, label=prop_key, is_direct=True,
                    is_inherited=False, is_required=True,
                    source_category=entity_key, inheritance_depth=0,
                )
            )
        for prop_key in effective.get("optional_properties", []):
            properties.append(
                PropertyProvenance(
                    entity_key=prop_key, label=prop_key, is_direct=True,
                    is_inherited=False, is_required=False,
                    source_category=entity_key, inheritance_depth=0,
                )
            )
        # Also add inherited properties from canonical (depth > 0)
        if category:
            inherited_query = text("""
                SELECT p.entity_key, p.label, cpe.depth, cpe.is_required,
                       src.entity_key as source_category
                FROM category_property_effective cpe
                JOIN properties p ON p.id = cpe.property_id
                JOIN categories c ON c.id = cpe.category_id
                JOIN categories src ON src.id = cpe.source_category_id
                WHERE c.entity_key = :entity_key AND cpe.depth > 0
                ORDER BY cpe.depth, p.label
            """)
            inherited_result = await session.execute(inherited_query, {"entity_key": entity_key})
            for row in inherited_result.fetchall():
                properties.append(
                    PropertyProvenance(
                        entity_key=row[0], label=row[1],
                        is_direct=False, is_inherited=True, is_required=row[3],
                        source_category=row[4], inheritance_depth=row[2],
                    )
                )
    elif category:
        # No draft property changes - use canonical materialized view
        props_query = text("""
            SELECT
                p.entity_key, p.label, cpe.depth, cpe.is_required,
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
                    entity_key=row[0], label=row[1],
                    is_direct=(row[2] == 0), is_inherited=(row[2] > 0),
                    is_required=row[3], source_category=row[4], inheritance_depth=row[2],
                )
            )

    # Get subobjects assigned to this category
    subobjects: list[SubobjectProvenance] = []

    # Same pattern: use effective JSON if draft modified subobjects
    has_draft_subobject_changes = change_status in ("modified", "added") and (
        "required_subobjects" in effective or "optional_subobjects" in effective
    )

    if has_draft_subobject_changes:
        for sub_key in effective.get("required_subobjects", []):
            subobjects.append(
                SubobjectProvenance(entity_key=sub_key, label=sub_key, is_required=True)
            )
        for sub_key in effective.get("optional_subobjects", []):
            subobjects.append(
                SubobjectProvenance(entity_key=sub_key, label=sub_key, is_required=False)
            )
    elif category:
        subobject_query = (
            select(Subobject.entity_key, Subobject.label, CategorySubobject.is_required)
            .join(CategorySubobject, col(CategorySubobject.subobject_id) == col(Subobject.id))
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

    # Module and bundle membership
    module_keys, bundle_keys = await _get_entity_membership(session, entity_key, "category")

    return CategoryDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        parents=parents,
        properties=properties,
        subobjects=subobjects,
        modules=module_keys,
        bundles=bundle_keys,
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
    limit: int = Query(20, ge=1, le=500, description="Max items per page"),
    search: str | None = Query(None, description="Filter by entity_key or label (case-insensitive)"),
) -> EntityListResponse:
    """List properties with cursor-based pagination and draft overlay.

    Returns paginated list of properties. When draft_id is provided,
    includes draft-created properties and change_status on each item.

    Rate limited to 100/minute per IP.
    """
    # Query canonical properties
    query = select(Property).order_by(Property.entity_key)

    if search:
        query = query.where(
            col(Property.entity_key).ilike(f"%{search}%")
            | col(Property.label).ilike(f"%{search}%")
        )

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

    # Module and bundle membership
    module_keys, bundle_keys = await _get_entity_membership(session, entity_key, "property")

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
        allowed_value_from_category=effective.get("Allows_value_from_category"),
        # Display configuration
        display_units=effective.get("display_units"),
        display_precision=effective.get("display_precision"),
        # Constraints and relationships
        unique_values=effective.get("unique_values", False),
        has_display_template=effective.get("has_display_template_key"),
        modules=module_keys,
        bundles=bundle_keys,
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
        .join(CategoryProperty, col(CategoryProperty.category_id) == col(Category.id))
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
    limit: int = Query(20, ge=1, le=500, description="Max items per page"),
    search: str | None = Query(None, description="Filter by entity_key or label (case-insensitive)"),
) -> EntityListResponse:
    """List subobjects with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Subobject).order_by(Subobject.entity_key)

    if search:
        query = query.where(
            col(Subobject.entity_key).ilike(f"%{search}%")
            | col(Subobject.label).ilike(f"%{search}%")
        )

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
                col(Property.entity_key).in_(all_prop_keys)
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
            .join(SubobjectProperty, col(SubobjectProperty.property_id) == col(Property.id))
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

    # Module and bundle membership
    module_keys, bundle_keys = await _get_entity_membership(session, entity_key, "subobject")

    return SubobjectDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        required_properties=required_properties,
        optional_properties=optional_properties,
        modules=module_keys,
        bundles=bundle_keys,
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
    limit: int = Query(20, ge=1, le=500, description="Max items per page"),
    search: str | None = Query(None, description="Filter by entity_key or label (case-insensitive)"),
) -> EntityListResponse:
    """List templates with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Template).order_by(Template.entity_key)

    if search:
        query = query.where(
            col(Template.entity_key).ilike(f"%{search}%")
            | col(Template.label).ilike(f"%{search}%")
        )

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

    # Module and bundle membership
    module_keys, bundle_keys = await _get_entity_membership(session, entity_key, "template")

    return TemplateDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        wikitext=effective.get("wikitext"),
        property_key=effective.get("property_key"),
        modules=module_keys,
        bundles=bundle_keys,
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
    limit: int = Query(20, ge=1, le=500, description="Max items per page"),
    search: str | None = Query(None, description="Filter by entity_key or label (case-insensitive)"),
) -> EntityListResponse:
    """List modules with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Module).order_by(Module.entity_key)

    if search:
        query = query.where(
            col(Module.entity_key).ilike(f"%{search}%")
            | col(Module.label).ilike(f"%{search}%")
        )

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
    change_status = effective.get("_change_status")

    # Check if effective JSON has draft-modified entity arrays
    has_draft_entities = change_status in ("modified", "added") and any(
        key in effective
        for key in (
            "categories",
            "properties",
            "subobjects",
            "templates",
            "dashboards",
            "resources",
        )
    )

    if has_draft_entities:
        # Use entity arrays from effective JSON (draft changes take precedence)
        if "categories" in effective:
            entities["category"] = effective.get("categories", [])
        if "properties" in effective:
            entities["property"] = effective.get("properties", [])
        if "subobjects" in effective:
            entities["subobject"] = effective.get("subobjects", [])
        if "templates" in effective:
            entities["template"] = effective.get("templates", [])
        if "dashboards" in effective:
            entities["dashboard"] = effective.get("dashboards", [])
        if "resources" in effective:
            entities["resource"] = effective.get("resources", [])
    elif module:
        # No draft changes to entities - query canonical from database
        entity_query = (
            select(ModuleEntity.entity_type, ModuleEntity.entity_key)
            .where(ModuleEntity.module_id == module.id)
            .order_by(ModuleEntity.entity_type, ModuleEntity.entity_key)
        )
        entity_result = await session.execute(entity_query)

        for row in entity_result.fetchall():
            entity_type = row[0].value if hasattr(row[0], "value") else row[0]
            ent_key = row[1]

            if entity_type not in entities:
                entities[entity_type] = []
            entities[entity_type].append(ent_key)
    else:
        # Draft-created module - extract entities from effective JSON if present
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

    return ModuleDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        entities=entities,
        manual_categories=effective.get("manual_categories"),
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
    limit: int = Query(20, ge=1, le=500, description="Max items per page"),
    search: str | None = Query(None, description="Filter by entity_key or label (case-insensitive)"),
) -> EntityListResponse:
    """List bundles with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Bundle).order_by(Bundle.entity_key)

    if search:
        query = query.where(
            col(Bundle.entity_key).ilike(f"%{search}%")
            | col(Bundle.label).ilike(f"%{search}%")
        )

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
    elif bundle:
        # No draft changes to modules - query canonical from database
        module_query = (
            select(Module.entity_key)
            .join(BundleModule, col(BundleModule.module_id) == col(Module.id))
            .where(BundleModule.bundle_id == bundle.id)
            .order_by(Module.entity_key)
        )
        module_result = await session.execute(module_query)
        modules = [row[0] for row in module_result.fetchall()]
    else:
        modules = []

    return BundleDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        modules=modules,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )


# -----------------------------------------------------------------------------
# Dashboard endpoints
# -----------------------------------------------------------------------------


@router.get("/dashboards", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_dashboards(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: str | None = Query(
        None, description="Last entity_key from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=500, description="Max items per page"),
    search: str | None = Query(None, description="Filter by entity_key or label (case-insensitive)"),
) -> EntityListResponse:
    """List dashboards with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Dashboard).order_by(Dashboard.entity_key)

    if search:
        query = query.where(
            col(Dashboard.entity_key).ilike(f"%{search}%")
            | col(Dashboard.label).ilike(f"%{search}%")
        )

    if cursor:
        query = query.where(Dashboard.entity_key > cursor)

    query = query.limit(limit + 1)

    result = await session.execute(query)
    dashboards = list(result.scalars().all())

    has_next = len(dashboards) > limit
    if has_next:
        dashboards = dashboards[:limit]

    items: list[EntityWithStatus] = []
    for dash in dashboards:
        effective = await draft_ctx.apply_overlay(dash, "dashboard", dash.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    draft_creates = await draft_ctx.get_draft_creates("dashboard")
    for create in draft_creates:
        items.append(EntityWithStatus.model_validate(create))

    items.sort(key=lambda x: x.entity_key)
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


@router.get("/dashboards/{entity_key}", response_model=DashboardDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_dashboard(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> DashboardDetailResponse:
    """Get dashboard detail with pages.

    Rate limited to 200/minute per IP.
    """
    query = select(Dashboard).where(Dashboard.entity_key == entity_key)
    result = await session.execute(query)
    dashboard = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(dashboard, "dashboard", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Extract pages from canonical_json (stored in effective after overlay)
    pages_data = effective.get("pages", [])
    pages = [
        DashboardPage(name=p.get("name", ""), wikitext=p.get("wikitext", "")) for p in pages_data
    ]

    # Module and bundle membership
    module_keys, bundle_keys = await _get_entity_membership(session, entity_key, "dashboard")

    return DashboardDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        pages=pages,
        modules=module_keys,
        bundles=bundle_keys,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )


# -----------------------------------------------------------------------------
# Resource endpoints
# -----------------------------------------------------------------------------


@router.get("/resources", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_resources(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: str | None = Query(
        None, description="Last entity_key from previous page for pagination"
    ),
    limit: int = Query(20, ge=1, le=500, description="Max items per page"),
    category: str | None = Query(None, description="Filter by category key"),
    search: str | None = Query(None, description="Filter by entity_key or label (case-insensitive)"),
) -> EntityListResponse:
    """List resources with cursor-based pagination, optional category filter, and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Resource).order_by(Resource.entity_key)

    if search:
        query = query.where(
            col(Resource.entity_key).ilike(f"%{search}%")
            | col(Resource.label).ilike(f"%{search}%")
        )

    if category:
        query = query.where(text("CAST(category_keys AS jsonb) @> CAST(:cats AS jsonb)")).params(
            cats=json.dumps([category])
        )
    if cursor:
        query = query.where(Resource.entity_key > cursor)

    query = query.limit(limit + 1)

    result = await session.execute(query)
    resources = list(result.scalars().all())

    has_next = len(resources) > limit
    if has_next:
        resources = resources[:limit]

    items: list[EntityWithStatus] = []
    for res in resources:
        effective = await draft_ctx.apply_overlay(res, "resource", res.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    # Include draft-created resources (filter by category if specified)
    draft_creates = await draft_ctx.get_draft_creates("resource")
    for create in draft_creates:
        if category is None or category in get_entity_categories(create):
            items.append(EntityWithStatus.model_validate(create))

    items.sort(key=lambda x: x.entity_key)
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )


@router.get("/resources/{entity_key:path}", response_model=ResourceDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_resource(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> ResourceDetailResponse:
    """Get resource detail with dynamic property fields.

    Uses path converter for entity_key to support hierarchical keys like "Person/John_doe".

    Rate limited to 200/minute per IP.
    """
    query = select(Resource).where(Resource.entity_key == entity_key)
    result = await session.execute(query)
    resource = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(resource, "resource", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Extract dynamic fields (everything except reserved keys)
    dynamic_fields = {k: v for k, v in effective.items() if k not in RESERVED_KEYS_WITH_INTERNAL}

    categories = get_entity_categories(effective)

    # Module and bundle membership
    module_keys, bundle_keys = await _get_entity_membership(session, entity_key, "resource")

    return ResourceDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        category_keys=categories,
        dynamic_fields=dynamic_fields,
        wikitext=effective.get("wikitext", ""),
        modules=module_keys,
        bundles=bundle_keys,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )


@router.get("/categories/{entity_key}/resources", response_model=list[EntityWithStatus])
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_category_resources(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> list[EntityWithStatus]:
    """Get resources belonging to a category.

    Returns list of resources that have this category_key, with draft change status.

    Rate limited to 200/minute per IP.
    """
    # Verify category exists
    cat_query = select(Category).where(Category.entity_key == entity_key)
    cat_result = await session.execute(cat_query)
    category = cat_result.scalar_one_or_none()

    if not category:
        # Check if draft-created category
        effective = await draft_ctx.apply_overlay(None, "category", entity_key)
        if not effective:
            raise HTTPException(status_code=404, detail="Category not found")

    # Query resources that include this category (ARRAY contains)
    query = (
        select(Resource)
        .where(text("CAST(category_keys AS jsonb) @> CAST(:cats AS jsonb)"))
        .params(cats=json.dumps([entity_key]))
        .order_by(Resource.entity_key)
    )
    result = await session.execute(query)
    resources = result.scalars().all()

    # Apply draft overlay to each resource
    items: list[EntityWithStatus] = []
    for res in resources:
        effective = await draft_ctx.apply_overlay(res, "resource", res.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    # Include draft-created resources for this category
    draft_creates = await draft_ctx.get_draft_creates("resource")
    for create in draft_creates:
        if entity_key in get_entity_categories(create):
            items.append(EntityWithStatus.model_validate(create))

    items.sort(key=lambda x: x.entity_key)

    return items
