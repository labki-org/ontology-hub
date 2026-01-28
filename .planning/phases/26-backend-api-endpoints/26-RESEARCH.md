# Phase 26: Backend API Endpoints - Research

**Researched:** 2026-01-28
**Domain:** FastAPI endpoint patterns following existing codebase conventions
**Confidence:** HIGH

## Summary

This phase requires adding list and detail endpoints for Dashboard and Resource entities following the **exact patterns** already established in the codebase. The research confirms that all necessary infrastructure (models, relationships, draft overlay service, rate limiting) is already in place.

The directive from CONTEXT.md is clear: "Follow existing codebase conventions exactly" with "no special handling or deviations from established patterns." This means the implementation is straightforward pattern replication from existing entity endpoints.

**Primary recommendation:** Replicate the exact endpoint patterns from categories/properties/templates in `entities.py` for dashboards and resources. Use `{entity_key:path}` for resource detail endpoint to support hierarchical keys.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | Current | API framework | Already in use throughout codebase |
| SQLModel | Current | ORM queries | Already used in all entity queries |
| Pydantic | Current | Response schemas | Used for all EntityDetailResponse classes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SlowAPI | Current | Rate limiting | Already configured with RATE_LIMITS dict |
| jsonpatch | Current | Draft overlay | Already integrated in DraftOverlayService |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Path parameters | Query parameters for filters | Path params match existing patterns |

**Installation:** No new dependencies required - all libraries already in use.

## Architecture Patterns

### Recommended Project Structure

All endpoints go in existing file:
```
backend/app/
├── routers/
│   └── entities.py          # Add dashboard/resource endpoints here
├── schemas/
│   └── entity.py            # Add DashboardDetailResponse, ResourceDetailResponse
└── models/v2/
    ├── dashboard.py         # Already exists
    └── resource.py          # Already exists
```

### Pattern 1: List Endpoint Pattern (HIGH confidence)

**What:** Cursor-based pagination with draft overlay
**When to use:** All list endpoints (GET /dashboards, GET /resources)
**Example:**
```python
# Source: backend/app/routers/entities.py lines 97-154 (list_categories)
@router.get("/dashboards", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_dashboards(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: str | None = Query(None, description="Last entity_key from previous page"),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    # 1. Query canonical with cursor pagination
    query = select(Dashboard).order_by(Dashboard.entity_key)
    if cursor:
        query = query.where(Dashboard.entity_key > cursor)
    query = query.limit(limit + 1)

    result = await session.execute(query)
    dashboards = list(result.scalars().all())

    # 2. Check for more results
    has_next = len(dashboards) > limit
    if has_next:
        dashboards = dashboards[:limit]

    # 3. Apply draft overlay to each
    items: list[EntityWithStatus] = []
    for dash in dashboards:
        effective = await draft_ctx.apply_overlay(dash, "dashboard", dash.entity_key)
        if effective:
            items.append(EntityWithStatus.model_validate(effective))

    # 4. Include draft-created entities
    draft_creates = await draft_ctx.get_draft_creates("dashboard")
    for create in draft_creates:
        items.append(EntityWithStatus.model_validate(create))

    # 5. Re-sort and return
    items.sort(key=lambda x: x.entity_key)
    next_cursor = items[-1].entity_key if has_next and items else None

    return EntityListResponse(items=items, next_cursor=next_cursor, has_next=has_next)
```

### Pattern 2: Detail Endpoint Pattern (HIGH confidence)

**What:** Single entity lookup with draft overlay
**When to use:** All detail endpoints (GET /dashboards/{key}, GET /resources/{key:path})
**Example:**
```python
# Source: backend/app/routers/entities.py lines 654-686 (get_template)
@router.get("/resources/{entity_key:path}", response_model=ResourceDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_resource(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> ResourceDetailResponse:
    # 1. Get canonical
    query = select(Resource).where(Resource.entity_key == entity_key)
    result = await session.execute(query)
    resource = result.scalar_one_or_none()

    # 2. Apply draft overlay
    effective = await draft_ctx.apply_overlay(resource, "resource", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Resource not found")

    # 3. Return detail response
    return ResourceDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        category_key=effective.get("category"),
        # Dynamic fields from canonical_json
        properties=_extract_resource_properties(effective),
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )
```

### Pattern 3: Category Filter Pattern (HIGH confidence)

**What:** Filter resources by category_key
**When to use:** GET /resources?category={key} and GET /categories/{key}/resources
**Example:**
```python
# Filter on list endpoint
@router.get("/resources", response_model=EntityListResponse)
async def list_resources(
    ...
    category: str | None = Query(None, description="Filter by category key"),
) -> EntityListResponse:
    query = select(Resource).order_by(Resource.entity_key)
    if category:
        query = query.where(Resource.category_key == category)
    ...

# Alternative: nested route
@router.get("/categories/{entity_key}/resources", response_model=list[EntityWithStatus])
async def get_category_resources(
    entity_key: str,  # category key
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> list[EntityWithStatus]:
    # Query resources where category_key matches
    query = select(Resource).where(Resource.category_key == entity_key)
    ...
```

### Pattern 4: Path Parameter for Hierarchical Keys (HIGH confidence)

**What:** Use `{entity_key:path}` for keys containing slashes
**When to use:** Resources (e.g., "Person/John_doe") and Templates (e.g., "Property/Page")
**Example:**
```python
# Source: backend/app/routers/entities.py line 654
@router.get("/templates/{entity_key:path}", response_model=TemplateDetailResponse)
# This allows entity_key to contain "/" characters
# GET /templates/Property/Page -> entity_key = "Property/Page"
```

### Pattern 5: Response Schema Pattern (HIGH confidence)

**What:** Pydantic models with change_status metadata
**When to use:** All detail responses
**Example:**
```python
# Source: backend/app/schemas/entity.py
class DashboardDetailResponse(BaseModel):
    entity_key: str
    label: str
    description: str | None = None
    pages: list[DashboardPage] = Field(default_factory=list)
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
    )
    deleted: bool = Field(default=False, validation_alias="_deleted")

    model_config = ConfigDict(populate_by_name=True)
```

### Anti-Patterns to Avoid

- **Creating separate router files:** All entity endpoints go in `entities.py`
- **Different pagination style:** Must use cursor-based, not offset-based
- **Skipping draft overlay:** ALL entity endpoints must support draft_id query param
- **Non-standard rate limits:** Use existing RATE_LIMITS dict values
- **Manual JSON merging:** Use DraftOverlayService.apply_overlay()

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Draft changes | Manual JSON Patch | DraftOverlayService | Already handles all edge cases (CREATE/UPDATE/DELETE) |
| Pagination | Custom offset logic | cursor-based with limit+1 | Established pattern, efficient |
| Rate limiting | Custom decorators | @limiter.limit(RATE_LIMITS[x]) | SlowAPI already configured |
| Response schemas | Dynamic dict | Pydantic models | Type safety, validation |

**Key insight:** The entire draft overlay system is already built and tested. Endpoints just call `apply_overlay()` and `get_draft_creates()`.

## Common Pitfalls

### Pitfall 1: Missing Draft Creates in List Endpoints
**What goes wrong:** List endpoints only show canonical entities, missing draft-created ones
**Why it happens:** Forgetting to call `get_draft_creates()` after querying canonical
**How to avoid:** Always include this after the main query loop:
```python
draft_creates = await draft_ctx.get_draft_creates("dashboard")
for create in draft_creates:
    items.append(EntityWithStatus.model_validate(create))
```
**Warning signs:** Draft-created entities don't appear in list views

### Pitfall 2: Forgetting to Re-sort After Merge
**What goes wrong:** List items appear in wrong order
**Why it happens:** Draft creates appended at end without sorting
**How to avoid:** Always re-sort: `items.sort(key=lambda x: x.entity_key)`
**Warning signs:** Pagination behaves incorrectly

### Pitfall 3: Using Wrong Entity Type String
**What goes wrong:** Draft overlay returns None for valid entities
**Why it happens:** Entity type string doesn't match DraftChange.entity_type
**How to avoid:** Use exact strings: "dashboard", "resource" (lowercase, singular)
**Warning signs:** Draft changes not reflected in API responses

### Pitfall 4: Not Using Path Converter for Hierarchical Keys
**What goes wrong:** Routes like `/resources/Person/John_doe` fail with 404
**Why it happens:** Default path parameter doesn't capture slashes
**How to avoid:** Use `{entity_key:path}` for resource detail endpoint
**Warning signs:** Resources with "/" in key return 404

### Pitfall 5: Incorrect Response Model Fields
**What goes wrong:** Response missing expected fields
**Why it happens:** Schema doesn't match effective JSON keys
**How to avoid:** Check canonical_json structure from parser output
**Warning signs:** Pydantic validation errors or empty fields

## Code Examples

### Complete Dashboard List Endpoint
```python
# Source: Pattern from backend/app/routers/entities.py list_categories
@router.get("/dashboards", response_model=EntityListResponse)
@limiter.limit(RATE_LIMITS["entity_list"])
async def list_dashboards(
    request: Request,
    session: SessionDep,
    draft_ctx: DraftContextDep,
    cursor: str | None = Query(None, description="Last entity_key from previous page"),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListResponse:
    """List dashboards with cursor-based pagination and draft overlay.

    Rate limited to 100/minute per IP.
    """
    query = select(Dashboard).order_by(Dashboard.entity_key)

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

    return EntityListResponse(items=items, next_cursor=next_cursor, has_next=has_next)
```

### Complete Resource Detail Endpoint with Dynamic Properties
```python
# Source: Pattern from backend/app/routers/entities.py get_template
@router.get("/resources/{entity_key:path}", response_model=ResourceDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_resource(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> ResourceDetailResponse:
    """Get resource detail with dynamic property fields.

    Rate limited to 200/minute per IP.
    """
    query = select(Resource).where(Resource.entity_key == entity_key)
    result = await session.execute(query)
    resource = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(resource, "resource", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Extract dynamic property fields (everything except reserved keys)
    reserved_keys = {"id", "entity_key", "label", "description", "category",
                     "_change_status", "_deleted", "_patch_error"}
    properties = {k: v for k, v in effective.items() if k not in reserved_keys}

    return ResourceDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        category_key=effective.get("category"),
        properties=properties,
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )
```

### Response Schema for Dashboard
```python
# Add to backend/app/schemas/entity.py
class DashboardPage(BaseModel):
    """Dashboard page with wikitext content."""
    name: str = Field(description="Page name (empty string for root)")
    wikitext: str = Field(description="MediaWiki wikitext content")

class DashboardDetailResponse(BaseModel):
    """Detailed dashboard response with pages."""

    entity_key: str
    label: str
    description: str | None = None
    pages: list[DashboardPage] = Field(
        default_factory=list,
        description="Dashboard pages with wikitext content",
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False,
        validation_alias="_deleted",
        description="Deleted in draft",
    )

    model_config = ConfigDict(populate_by_name=True)
```

### Response Schema for Resource
```python
# Add to backend/app/schemas/entity.py
class ResourceDetailResponse(BaseModel):
    """Detailed resource response with dynamic properties."""

    entity_key: str
    label: str
    description: str | None = None
    category_key: str = Field(description="Category this resource belongs to")
    properties: dict[str, Any] = Field(
        default_factory=dict,
        description="Dynamic property values from the resource",
    )
    change_status: ChangeStatus | None = Field(
        default=None,
        validation_alias="_change_status",
        description="Draft change status",
    )
    deleted: bool = Field(
        default=False,
        validation_alias="_deleted",
        description="Deleted in draft",
    )

    model_config = ConfigDict(populate_by_name=True)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | N/A | N/A | No changes - following established patterns |

**Deprecated/outdated:** None - this is greenfield implementation following existing patterns.

## Open Questions

### 1. Dashboard Pages Extraction
- **What we know:** Dashboard canonical_json contains `pages` array with `name` and `wikitext`
- **What's unclear:** Should pages be returned as-is from canonical_json or mapped to Pydantic models?
- **Recommendation:** Use Pydantic models (DashboardPage) for type safety. Extract from effective JSON.

### 2. Resource Dynamic Properties
- **What we know:** Resources have dynamic properties beyond base fields (Has_name, Has_email, etc.)
- **What's unclear:** Best way to expose these - typed dict vs Any dict?
- **Recommendation:** Use `dict[str, Any]` for properties field since property types vary.

### 3. Category Resources Endpoint Path
- **What we know:** Need endpoint for resources by category
- **What's unclear:** `/categories/{key}/resources` vs `/resources?category={key}`
- **Recommendation:** Implement BOTH - filter on list endpoint AND nested route. Both match RESTful patterns and serve different use cases.

## Sources

### Primary (HIGH confidence)
- `/home/daharoni/dev/ontology-hub/backend/app/routers/entities.py` - Existing endpoint patterns (lines 97-1104)
- `/home/daharoni/dev/ontology-hub/backend/app/services/draft_overlay.py` - Draft overlay service API
- `/home/daharoni/dev/ontology-hub/backend/app/schemas/entity.py` - Response schema patterns
- `/home/daharoni/dev/ontology-hub/backend/app/models/v2/dashboard.py` - Dashboard model
- `/home/daharoni/dev/ontology-hub/backend/app/models/v2/resource.py` - Resource model

### Secondary (MEDIUM confidence)
- `/home/daharoni/dev/labki-ontology/dashboards/_schema.json` - Dashboard JSON schema
- `/home/daharoni/dev/labki-ontology/resources/_schema.json` - Resource JSON schema
- `/home/daharoni/dev/labki-ontology/dashboards/Core_overview.json` - Sample dashboard data
- `/home/daharoni/dev/labki-ontology/resources/Person/John_doe.json` - Sample resource data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing libraries, no new dependencies
- Architecture: HIGH - Exact replication of existing patterns
- Pitfalls: HIGH - Based on direct code analysis, not speculation

**Research date:** 2026-01-28
**Valid until:** Indefinite (patterns are internal, not external dependencies)

## Requirements Mapping

| Requirement | Endpoint | Pattern Reference |
|-------------|----------|-------------------|
| DASH-04: Dashboard list | GET /dashboards | list_categories pattern |
| DASH-04: Dashboard detail | GET /dashboards/{key} | get_template pattern |
| RSRC-04: Resource list | GET /resources | list_categories pattern |
| RSRC-04: Resource detail | GET /resources/{key:path} | get_template pattern |
| RSRC-05: Resources by category | GET /categories/{key}/resources | get_property_used_by pattern |
| RSRC-05: Resources by category | GET /resources?category={key} | Query param filter |

## Implementation Notes

### File Changes Required

1. **backend/app/schemas/entity.py**
   - Add `DashboardPage` model
   - Add `DashboardDetailResponse` model
   - Add `ResourceDetailResponse` model

2. **backend/app/routers/entities.py**
   - Add imports: `Dashboard`, `Resource` from models
   - Add imports: `DashboardDetailResponse`, `ResourceDetailResponse` from schemas
   - Add `list_dashboards()` endpoint
   - Add `get_dashboard()` endpoint
   - Add `list_resources()` endpoint with optional category filter
   - Add `get_resource()` endpoint
   - Add `get_category_resources()` endpoint

### No Changes Required To

- `backend/app/models/v2/` - Models already exist
- `backend/app/services/draft_overlay.py` - Works with any entity type string
- `backend/app/main.py` - entities_router already registered
- `backend/app/dependencies/rate_limit.py` - Existing rate limits apply
