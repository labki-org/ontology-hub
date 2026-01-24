# Phase 10: Query Layer - Research

**Researched:** 2026-01-24
**Domain:** FastAPI query endpoints, draft overlay computation, graph traversal APIs, effective view merging
**Confidence:** HIGH

## Summary

This phase implements the query layer that provides read access to entities and graph data with support for both canonical and draft contexts. The key challenge is computing "effective views" server-side by merging canonical entities with draft changes (creates, updates via JSON Patch, deletes) without the frontend ever performing the merge. Graph endpoints must support neighborhood queries with depth limiting and module-scoped queries with membership metadata for hull rendering.

The existing v1.0 codebase provides strong foundations with FastAPI routers, cursor-based pagination patterns, and SQLModel queries. The v2.0 models introduce materialized views for inheritance (category_property_effective) and normalized relationship tables that enable efficient graph traversal using PostgreSQL recursive CTEs.

Key decisions from CONTEXT.md:
- **Server-side overlay computation**: API computes effective view; frontend never merges
- **Deleted entities with markers**: Return deleted entities with `deleted: true` flag, not excluded
- **Mixed draft/canonical results**: Draft entities appear inline with canonical, not separate sections
- **Live inheritance recomputation**: Draft changes to parent categories affect inherited properties in results
- **Change status on all entities**: In draft context, all entities include change_status (added/modified/deleted/unchanged)

**Primary recommendation:** Use Python application layer for draft overlay computation (not database SQL) due to JSON Patch complexity. Implement overlay as a service layer that queries canonical data, queries draft changes, applies JSON Patch operations using the `jsonpatch` library, and decorates results with change_status metadata. Use PostgreSQL recursive CTEs for graph traversal with CYCLE detection and depth limiting. Reuse existing cursor-based pagination patterns from v1.0.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in use - no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | ^0.115.0 | API framework | Already used for all v1.0 endpoints |
| SQLModel | ^0.0.22 | ORM with Pydantic integration | Already used for all models and queries |
| asyncpg | ^0.30.0 | Async PostgreSQL driver | Already used for database connections |
| Pydantic | ^2.x | Response models and validation | Comes with FastAPI/SQLModel |

### Supporting (New additions for v2.0)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonpatch | ^1.33 | JSON Patch (RFC 6902) application | Apply draft update patches to canonical JSON |
| python-json-patch | ^1.33 | Same library, PyPI name | Install via `pip install jsonpatch` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Application-layer overlay | Database CTE overlay | CTE would be complex with JSON Patch; Python is clearer |
| jsonpatch library | Manual patch application | jsonpatch handles edge cases per RFC 6902 spec |
| Cursor pagination | Offset/limit | Cursor is more efficient for large datasets, already used in v1.0 |
| Recursive CTE | Application-side graph walk | CTE is much faster for graph queries in PostgreSQL |
| fastapi-pagination library | Custom pagination | Custom is simpler given existing v1.0 patterns work well |

**Installation:**
```bash
pip install jsonpatch
```

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── services/
│   ├── draft_overlay.py      # NEW: Compute effective views with draft changes
│   └── graph_query.py         # NEW: Graph traversal queries with CTEs
├── routers/
│   ├── entities_v2.py         # NEW: v2.0 entity endpoints (or extend existing)
│   └── graph.py               # NEW: Graph endpoints
├── schemas/
│   ├── entity_v2.py           # NEW: v2.0 response models with change_status
│   └── graph.py               # NEW: Graph response models
└── models/v2/                 # EXISTING: v2.0 models (use)
```

### Pattern 1: Draft Overlay Service (Application Layer)

**What:** Service that computes effective entity view by merging canonical data with draft changes server-side.

**When to use:** Every entity query when draft_id parameter is provided.

**Example:**
```python
# Source: Application design pattern + jsonpatch library documentation
from typing import Optional
import jsonpatch
from copy import deepcopy
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.v2 import Category, DraftChange, ChangeType

class DraftOverlayService:
    """Compute effective views by applying draft changes to canonical entities."""

    def __init__(self, session: AsyncSession, draft_id: Optional[str] = None):
        self.session = session
        self.draft_id = draft_id
        self._draft_changes: dict[str, DraftChange] | None = None

    async def _load_draft_changes(self) -> dict[str, DraftChange]:
        """Load all changes for this draft keyed by entity_key."""
        if self._draft_changes is not None:
            return self._draft_changes

        if not self.draft_id:
            self._draft_changes = {}
            return self._draft_changes

        query = select(DraftChange).where(DraftChange.draft_id == self.draft_id)
        result = await self.session.execute(query)
        changes = result.scalars().all()

        self._draft_changes = {
            f"{change.entity_type}:{change.entity_key}": change
            for change in changes
        }
        return self._draft_changes

    async def apply_overlay_to_category(
        self, canonical: Category | None, entity_key: str
    ) -> dict | None:
        """Apply draft changes to a category, returning effective JSON.

        Returns:
            - None if entity is deleted in draft
            - Modified entity dict if updated in draft
            - New entity dict if created in draft
            - Canonical JSON if no draft changes
        """
        changes = await self._load_draft_changes()
        change_key = f"category:{entity_key}"
        draft_change = changes.get(change_key)

        # No draft changes: return canonical
        if not draft_change:
            if canonical:
                result = canonical.canonical_json.copy()
                result["_change_status"] = "unchanged"
                return result
            return None

        # Draft creates new entity
        if draft_change.change_type == ChangeType.CREATE:
            result = draft_change.replacement_json.copy()
            result["_change_status"] = "added"
            return result

        # Draft deletes entity
        if draft_change.change_type == ChangeType.DELETE:
            if canonical:
                result = canonical.canonical_json.copy()
                result["_change_status"] = "deleted"
                result["_deleted"] = True
                return result
            return None  # Deleted entity that doesn't exist in canonical

        # Draft updates entity (apply JSON Patch)
        if draft_change.change_type == ChangeType.UPDATE:
            if not canonical:
                # Update to non-existent entity (shouldn't happen, but handle)
                return None

            # Deep copy to avoid mutating cached canonical data
            base = deepcopy(canonical.canonical_json)

            # Apply JSON Patch operations
            patch = jsonpatch.JsonPatch(draft_change.patch)
            try:
                result = patch.apply(base)
                result["_change_status"] = "modified"
                return result
            except jsonpatch.JsonPatchException as e:
                # Log error and return canonical
                # (this indicates draft is stale or invalid)
                result = canonical.canonical_json.copy()
                result["_change_status"] = "unchanged"
                result["_patch_error"] = str(e)
                return result

        return None
```

**Rationale:** Application-layer overlay is clearer than database-level CTE for JSON Patch operations. Python's `jsonpatch` library handles RFC 6902 spec compliance. Deep copying prevents mutation of cached data.

### Pattern 2: Dependency Injection for Draft Context

**What:** FastAPI dependency that extracts optional draft_id from query parameter and provides DraftOverlayService.

**When to use:** All entity and graph query endpoints.

**Example:**
```python
# Source: FastAPI dependency injection patterns
from typing import Annotated, Optional
from fastapi import Depends, Query
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import SessionDep
from app.services.draft_overlay import DraftOverlayService

async def get_draft_context(
    session: SessionDep,
    draft_id: Optional[str] = Query(None, description="Draft UUID for effective view"),
) -> DraftOverlayService:
    """Provide draft overlay service for query context.

    If draft_id is None, service returns canonical data only.
    If draft_id is provided, service merges draft changes.
    """
    return DraftOverlayService(session=session, draft_id=draft_id)

# Type alias for dependency injection
DraftContextDep = Annotated[DraftOverlayService, Depends(get_draft_context)]

# Usage in endpoint
@router.get("/categories/{entity_key}")
async def get_category(
    entity_key: str,
    draft_ctx: DraftContextDep,
) -> CategoryWithStatus:
    """Get category with optional draft overlay."""
    # Query canonical
    canonical = await draft_ctx.session.execute(
        select(Category).where(Category.entity_key == entity_key)
    )
    canonical_cat = canonical.scalar_one_or_none()

    # Apply overlay
    effective = await draft_ctx.apply_overlay_to_category(canonical_cat, entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Category not found")

    return CategoryWithStatus(**effective)
```

### Pattern 3: Category Detail with Inherited Properties

**What:** Query category detail including parents, direct properties, and inherited properties with provenance from materialized view.

**When to use:** Category detail endpoint (QRY-04 requirement).

**Example:**
```python
# Source: v2.0 CategoryPropertyEffective materialized view + SQLAlchemy joins
from sqlmodel import select, col
from app.models.v2 import Category, Property, CategoryPropertyEffective, CategoryParent

async def get_category_detail(
    session: AsyncSession,
    entity_key: str,
    draft_ctx: DraftOverlayService,
) -> dict:
    """Get category detail with parents and properties (direct + inherited)."""

    # Get canonical category
    cat_result = await session.execute(
        select(Category).where(Category.entity_key == entity_key)
    )
    canonical_cat = cat_result.scalar_one_or_none()

    if not canonical_cat:
        # Check if it's a draft-created category
        raise HTTPException(status_code=404, detail="Category not found")

    # Apply draft overlay to category itself
    effective_cat = await draft_ctx.apply_overlay_to_category(
        canonical_cat, entity_key
    )

    # Get parents
    parent_query = (
        select(Category)
        .join(CategoryParent, CategoryParent.parent_id == Category.id)
        .where(CategoryParent.category_id == canonical_cat.id)
    )
    parent_result = await session.execute(parent_query)
    parents = [p.entity_key for p in parent_result.scalars().all()]

    # Get effective properties (direct + inherited) from materialized view
    prop_query = (
        select(
            Property.entity_key,
            Property.label,
            CategoryPropertyEffective.depth,
            CategoryPropertyEffective.is_required,
            Category.entity_key.label("source_category"),
        )
        .join(Property, Property.id == CategoryPropertyEffective.property_id)
        .join(
            Category,
            Category.id == CategoryPropertyEffective.source_category_id,
        )
        .where(CategoryPropertyEffective.category_id == canonical_cat.id)
        .order_by(CategoryPropertyEffective.depth, Property.label)
    )
    prop_result = await session.execute(prop_query)
    properties = [
        {
            "entity_key": row.entity_key,
            "label": row.label,
            "is_direct": row.depth == 0,
            "is_inherited": row.depth > 0,
            "is_required": row.is_required,
            "source_category": row.source_category,
            "inheritance_depth": row.depth,
        }
        for row in prop_result.all()
    ]

    return {
        **effective_cat,
        "parents": parents,
        "properties": properties,
    }
```

### Pattern 4: Neighborhood Graph Query with Recursive CTE

**What:** Query graph nodes and edges within N depth of a selected entity using PostgreSQL recursive CTE.

**When to use:** Neighborhood graph endpoint (GRP-01 requirement).

**Example:**
```python
# Source: PostgreSQL recursive CTE documentation + graph traversal patterns
from sqlalchemy import text

async def get_neighborhood_graph(
    session: AsyncSession,
    entity_key: str,
    entity_type: str,
    depth: int = 2,
    draft_ctx: DraftOverlayService = None,
) -> dict:
    """Get neighborhood graph for entity within specified depth.

    Returns nodes and edges with module membership for hull rendering.
    """

    # For categories, use parent relationships for graph
    if entity_type == "category":
        # Get starting category ID
        cat_result = await session.execute(
            select(Category.id, Category.entity_key, Category.label)
            .where(Category.entity_key == entity_key)
        )
        start_cat = cat_result.one_or_none()
        if not start_cat:
            return {"nodes": [], "edges": []}

        # Recursive CTE for neighborhood (ancestors + descendants)
        cte_query = text("""
            WITH RECURSIVE neighborhood AS (
                -- Base: starting category
                SELECT
                    c.id,
                    c.entity_key,
                    c.label,
                    0 as depth,
                    'start' as direction,
                    ARRAY[c.id] as path
                FROM categories c
                WHERE c.entity_key = :entity_key

                UNION ALL

                -- Recursive: parents (ancestors)
                SELECT
                    c.id,
                    c.entity_key,
                    c.label,
                    n.depth + 1,
                    'ancestor',
                    n.path || c.id
                FROM categories c
                JOIN category_parent cp ON cp.parent_id = c.id
                JOIN neighborhood n ON n.id = cp.category_id
                WHERE n.depth < :max_depth
                  AND NOT c.id = ANY(n.path)  -- Cycle detection

                UNION ALL

                -- Recursive: children (descendants)
                SELECT
                    c.id,
                    c.entity_key,
                    c.label,
                    n.depth + 1,
                    'descendant',
                    n.path || c.id
                FROM categories c
                JOIN category_parent cp ON cp.category_id = c.id
                JOIN neighborhood n ON n.id = cp.parent_id
                WHERE n.depth < :max_depth
                  AND NOT c.id = ANY(n.path)  -- Cycle detection
            )
            SELECT DISTINCT ON (id)
                id, entity_key, label, depth, direction
            FROM neighborhood
            ORDER BY id, depth;
        """)

        result = await session.execute(
            cte_query, {"entity_key": entity_key, "max_depth": depth}
        )
        node_rows = result.all()

        # Build nodes with module membership
        nodes = []
        for row in node_rows:
            # Get module membership
            module_query = (
                select(Module.entity_key)
                .join(ModuleEntity, ModuleEntity.module_id == Module.id)
                .where(ModuleEntity.entity_type == EntityType.CATEGORY)
                .where(ModuleEntity.entity_key == row.entity_key)
            )
            module_result = await session.execute(module_query)
            modules = [m[0] for m in module_result.all()]

            nodes.append({
                "id": row.entity_key,
                "label": row.label,
                "entity_type": "category",
                "depth": row.depth,
                "modules": modules,  # For hull rendering
            })

        # Get edges from category_parent
        node_ids = [row.id for row in node_rows]
        edge_query = text("""
            SELECT
                c_child.entity_key as source,
                c_parent.entity_key as target
            FROM category_parent cp
            JOIN categories c_child ON c_child.id = cp.category_id
            JOIN categories c_parent ON c_parent.id = cp.parent_id
            WHERE cp.category_id = ANY(:node_ids)
              AND cp.parent_id = ANY(:node_ids)
        """)
        edge_result = await session.execute(
            edge_query, {"node_ids": node_ids}
        )
        edges = [
            {"source": row.source, "target": row.target}
            for row in edge_result.all()
        ]

        return {"nodes": nodes, "edges": edges}

    # For other entity types, implement similar patterns
    return {"nodes": [], "edges": []}
```

**Rationale:** PostgreSQL recursive CTEs are highly optimized for graph traversal. Cycle detection with path arrays prevents infinite loops. Separate ancestor/descendant branches allow bidirectional graph exploration.

### Pattern 5: Module-Scoped Graph Query

**What:** Return all nodes and edges for entities in a specified module.

**When to use:** Module-scoped graph endpoint (GRP-02 requirement).

**Example:**
```python
# Source: v2.0 ModuleEntity relationship table
async def get_module_graph(
    session: AsyncSession,
    module_key: str,
) -> dict:
    """Get graph of all entities in a module."""

    # Get module
    module_result = await session.execute(
        select(Module).where(Module.entity_key == module_key)
    )
    module = module_result.scalar_one_or_none()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Get all entities in this module
    entity_query = (
        select(ModuleEntity.entity_type, ModuleEntity.entity_key)
        .where(ModuleEntity.module_id == module.id)
    )
    entity_result = await session.execute(entity_query)
    module_entities = entity_result.all()

    # Get categories in this module
    category_keys = [
        row.entity_key
        for row in module_entities
        if row.entity_type == EntityType.CATEGORY
    ]

    # Build nodes for categories
    nodes = []
    if category_keys:
        cat_query = select(Category).where(
            Category.entity_key.in_(category_keys)
        )
        cat_result = await session.execute(cat_query)
        for cat in cat_result.scalars().all():
            nodes.append({
                "id": cat.entity_key,
                "label": cat.label,
                "entity_type": "category",
                "modules": [module_key],  # This node is in current module
            })

    # Get edges (category parent relationships) within this module
    if category_keys:
        edge_query = text("""
            SELECT
                c_child.entity_key as source,
                c_parent.entity_key as target
            FROM category_parent cp
            JOIN categories c_child ON c_child.id = cp.category_id
            JOIN categories c_parent ON c_parent.id = cp.parent_id
            WHERE c_child.entity_key = ANY(:category_keys)
              AND c_parent.entity_key = ANY(:category_keys)
        """)
        edge_result = await session.execute(
            edge_query, {"category_keys": category_keys}
        )
        edges = [
            {"source": row.source, "target": row.target}
            for row in edge_result.all()
        ]
    else:
        edges = []

    return {"nodes": nodes, "edges": edges, "module": module_key}
```

### Pattern 6: Cursor-Based Pagination for Entity Lists

**What:** Reuse v1.0 cursor pagination pattern for entity list queries with draft overlay.

**When to use:** List entities by type with optional draft context.

**Example:**
```python
# Source: Existing v1.0 entities.py router + draft overlay pattern
from app.schemas.entity_v2 import EntityListWithStatusResponse

@router.get("/categories", response_model=EntityListWithStatusResponse)
async def list_categories(
    draft_ctx: DraftContextDep,
    cursor: Optional[str] = Query(None, description="Last entity_key from previous page"),
    limit: int = Query(20, ge=1, le=100, description="Max items per page"),
) -> EntityListWithStatusResponse:
    """List categories with cursor pagination and optional draft overlay."""

    # Query canonical categories
    query = select(Category).where(Category.entity_key > cursor) if cursor else select(Category)
    query = query.order_by(Category.entity_key).limit(limit + 1)

    result = await draft_ctx.session.execute(query)
    canonical_cats = list(result.scalars().all())

    # Check for more results
    has_next = len(canonical_cats) > limit
    if has_next:
        canonical_cats = canonical_cats[:limit]

    # Apply draft overlay to each category
    items = []
    for cat in canonical_cats:
        effective = await draft_ctx.apply_overlay_to_category(cat, cat.entity_key)
        if effective:  # Could be None if deleted and not showing deleted
            items.append(effective)

    # Add draft-created categories if in draft context
    if draft_ctx.draft_id:
        # Query draft changes for creates
        draft_creates = await draft_ctx.session.execute(
            select(DraftChange)
            .where(DraftChange.draft_id == draft_ctx.draft_id)
            .where(DraftChange.change_type == ChangeType.CREATE)
            .where(DraftChange.entity_type == "category")
        )
        for change in draft_creates.scalars().all():
            # Insert in sorted order by entity_key
            new_entity = change.replacement_json.copy()
            new_entity["_change_status"] = "added"
            items.append(new_entity)

        # Re-sort to maintain entity_key order
        items.sort(key=lambda x: x.get("id", ""))

    next_cursor = canonical_cats[-1].entity_key if has_next else None

    return EntityListWithStatusResponse(
        items=items,
        next_cursor=next_cursor,
        has_next=has_next,
    )
```

### Anti-Patterns to Avoid

- **Merging overlay in database with CTEs:** JSON Patch operations are complex; do in application layer
- **Excluding deleted entities from results:** Per CONTEXT.md, return with `deleted: true` marker
- **Separate draft/canonical sections:** Per CONTEXT.md, mix them inline with change_status
- **Mutating cached canonical data:** Always deep copy before applying JSON Patch
- **Graph queries without cycle detection:** Use path arrays and `NOT = ANY(path)` checks
- **Ignoring module membership in graph results:** Frontend needs it for hull rendering

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Patch application | Manual patch logic | `jsonpatch` library | RFC 6902 compliance, handles edge cases (test op, array indices, escaping) |
| Graph traversal | Application-side BFS/DFS | PostgreSQL recursive CTE | Much faster, handles cycles, depth limiting built-in |
| Deep dict copying | Manual recursive copy | `copy.deepcopy()` | Handles circular refs, custom objects, proven correctness |
| Cursor pagination | Manual implementation | Reuse v1.0 pattern | Already tested, handles edge cases |
| Optional query params | Manual request parsing | FastAPI Query with Optional | Auto validation, OpenAPI docs, type safety |

**Key insight:** The hard parts are (1) correctly applying JSON Patch per RFC 6902, and (2) efficient graph traversal. Don't reinvent either - use `jsonpatch` library and PostgreSQL CTEs.

## Common Pitfalls

### Pitfall 1: Mutating Canonical Data When Applying Patches

**What goes wrong:** Applying JSON Patch directly to canonical entity dict mutates cached/shared data.
**Why it happens:** `jsonpatch.apply_patch()` modifies in-place by default.
**How to avoid:**
- Always `deepcopy()` canonical data before applying patch
- Or use `jsonpatch.apply_patch(doc, patch, in_place=False)` explicitly
**Warning signs:** Changes persist across requests, canonical data corrupted

### Pitfall 2: Missing Cycle Detection in Graph Queries

**What goes wrong:** Circular category inheritance causes infinite recursion in CTE.
**Why it happens:** CategoryParent allows cycles (shouldn't happen but could via bad data).
**How to avoid:**
- Always include `path` array in recursive CTE
- Add `NOT id = ANY(path)` condition before recursion
- Consider using PostgreSQL's `CYCLE` clause
**Warning signs:** Query hangs, database connection timeout

### Pitfall 3: Forgetting to Include Draft-Created Entities in Lists

**What goes wrong:** Draft creates new entities but they don't appear in list queries.
**Why it happens:** List queries only select from canonical tables.
**How to avoid:**
- After querying canonical, also query draft changes for CREATE operations
- Merge draft creates into result list
- Re-sort by entity_key to maintain order
**Warning signs:** New entities missing from UI lists in draft context

### Pitfall 4: Not Deep Copying Before JSON Patch

**What goes wrong:** Patch application fails or produces incorrect results.
**Why it happens:** JSON Patch operations reference paths that may be shared objects.
**How to avoid:**
- Always use `copy.deepcopy()` before applying patch
- Document this requirement in overlay service
**Warning signs:** Patch errors like "path does not exist", unexpected null values

### Pitfall 5: N+1 Queries for Module Membership in Graph Results

**What goes wrong:** Graph with 100 nodes makes 100 separate queries for module membership.
**Why it happens:** Querying module membership per-node in loop.
**How to avoid:**
- Collect all entity_keys from graph result
- Query module membership for all in single query
- Build lookup dict and decorate nodes
**Warning signs:** Slow graph endpoint response (hundreds of ms), many small queries in logs

### Pitfall 6: Forgetting Change Status on Canonical Entities

**What goes wrong:** In draft context, canonical entities missing `_change_status` field.
**Why it happens:** Only adding change_status when draft changes exist.
**How to avoid:**
- When draft_id provided, ALWAYS add `_change_status` to results
- Canonical entities get "unchanged" status
- Document this in response schema
**Warning signs:** Frontend errors about missing field, inconsistent UI rendering

### Pitfall 7: Inheritance Not Recomputed for Draft Changes

**What goes wrong:** Draft adds property to parent, but child categories don't show inherited property.
**Why it happens:** CategoryPropertyEffective materialized view is based on canonical only.
**How to avoid:**
- For draft context, query CategoryProperty changes from draft
- Manually compute inheritance chain in application layer
- Or: Refresh temporary mat view with draft data (complex)
**Warning signs:** Inherited properties don't update in draft preview

**Recommended approach for Pitfall 7:** Accept that inheritance in draft context may require manual computation. Phase 10 can compute simple inheritance; defer complex cases to future optimization.

## Code Examples

Verified patterns from official sources:

### JSON Patch Application (Error Handling)

```python
# Source: jsonpatch library documentation
import jsonpatch
from copy import deepcopy

def apply_draft_patch_safely(canonical_json: dict, patch_ops: list) -> dict:
    """Apply JSON Patch with error handling."""
    # Deep copy to avoid mutating original
    doc = deepcopy(canonical_json)

    try:
        patch = jsonpatch.JsonPatch(patch_ops)
        result = patch.apply(doc)
        return result
    except jsonpatch.JsonPatchException as e:
        # Patch invalid or stale - log and return canonical
        logger.error(f"JSON Patch failed: {e}")
        return canonical_json
    except jsonpatch.JsonPatchConflict as e:
        # Test operation failed - indicates conflict
        logger.warning(f"JSON Patch conflict: {e}")
        return canonical_json
```

### Response Model with Change Status

```python
# Source: Pydantic BaseModel patterns + CONTEXT.md requirements
from pydantic import BaseModel, Field
from typing import Literal, Optional

class CategoryWithStatus(BaseModel):
    """Category entity with draft change status."""

    id: str  # entity_key
    label: str
    description: Optional[str] = None
    parents: list[str] = Field(default_factory=list)
    required_properties: list[str] = Field(default_factory=list)
    optional_properties: list[str] = Field(default_factory=list)

    # Draft overlay metadata
    change_status: Literal["added", "modified", "deleted", "unchanged"] = Field(
        alias="_change_status"
    )
    deleted: bool = Field(default=False, alias="_deleted")
    patch_error: Optional[str] = Field(default=None, alias="_patch_error")

    class Config:
        populate_by_name = True  # Allow both field name and alias
```

### Graph Response Model

```python
# Source: Existing InheritanceResponse + GRP requirements
from pydantic import BaseModel

class GraphNode(BaseModel):
    """Node in entity graph."""

    id: str  # entity_key for React Flow
    label: str
    entity_type: str  # "category", "property", etc.
    depth: Optional[int] = None  # Distance from starting node
    modules: list[str] = Field(default_factory=list)  # For hull rendering

    # In draft context
    change_status: Optional[Literal["added", "modified", "deleted", "unchanged"]] = None

class GraphEdge(BaseModel):
    """Edge in entity graph."""

    source: str  # source entity_key
    target: str  # target entity_key
    edge_type: str = "parent"  # "parent", "property", etc.

class GraphResponse(BaseModel):
    """Graph query response for visualization."""

    nodes: list[GraphNode]
    edges: list[GraphEdge]
    has_cycles: bool = False
```

### Recursive CTE with Depth and Cycle Detection

```python
# Source: PostgreSQL documentation + graph traversal patterns
from sqlalchemy import text

NEIGHBORHOOD_GRAPH_QUERY = text("""
WITH RECURSIVE neighborhood AS (
    -- Base case: starting entity
    SELECT
        c.id,
        c.entity_key,
        c.label,
        0 as depth,
        ARRAY[c.id] as path,
        false as is_cycle
    FROM categories c
    WHERE c.entity_key = :start_entity

    UNION ALL

    -- Recursive case: follow parent edges
    SELECT
        c.id,
        c.entity_key,
        c.label,
        n.depth + 1,
        n.path || c.id,
        c.id = ANY(n.path)  -- Detect cycle
    FROM categories c
    JOIN category_parent cp ON cp.parent_id = c.id
    JOIN neighborhood n ON n.id = cp.category_id
    WHERE n.depth < :max_depth
      AND NOT (c.id = ANY(n.path))  -- Stop at cycles
)
SELECT DISTINCT ON (id)
    id, entity_key, label, depth, is_cycle
FROM neighborhood
ORDER BY id, depth;
""")

# Usage
result = await session.execute(
    NEIGHBORHOOD_GRAPH_QUERY,
    {"start_entity": "Person", "max_depth": 3}
)
```

## State of the Art

| Old Approach (v1.0) | Current Approach (v2.0) | When Changed | Impact |
|---------------------|-------------------------|--------------|--------|
| No draft overlay | Server-side overlay computation | v2.0 start | Frontend never merges, simpler UI |
| Filter deleted entities | Return with `deleted: true` marker | Phase 10 decision | Consistent UX, no missing gaps |
| Generic Entity table | Typed entity tables with relationships | v2.0 start | Enables graph queries, inheritance |
| No inheritance queries | Materialized view for effective properties | Phase 8 | Fast inheritance lookups |
| Offset/limit pagination | Cursor-based pagination | v1.0 | More efficient for large datasets |
| No graph endpoints | Recursive CTE graph queries | Phase 10 | Visualizations possible |

**Deprecated/outdated:**
- v1.0 entity queries without draft support: All v2.0 queries accept optional `draft_id`
- Frontend-side draft merging: Never implemented, server does all overlay
- Excluding deleted from results: v2.0 includes with markers

## Open Questions

Things that couldn't be fully resolved:

1. **Inheritance recomputation in draft context**
   - What we know: CONTEXT.md requires "draft changes to parent categories affect inherited properties"
   - What's unclear: Should we refresh mat view per-request, or compute in application layer?
   - Recommendation: Phase 10 computes simple direct inheritance in application layer; defer mat view refresh to performance optimization phase

2. **Change status for inherited properties**
   - What we know: Properties can be inherited from parent categories
   - What's unclear: If draft modifies parent, do child's inherited properties show "modified" status?
   - Recommendation: Mark inherited properties as "modified" if source category is modified in draft

3. **Graph query performance with large modules**
   - What we know: Module-scoped graph could return hundreds of nodes
   - What's unclear: Should we paginate graph results or limit depth?
   - Recommendation: Start without limits; add depth limit parameter if performance issues arise

4. **Draft overlay caching strategy**
   - What we know: Draft changes are loaded once per request
   - What's unclear: Should we cache DraftOverlayService across requests?
   - Recommendation: No caching in Phase 10; draft changes are infrequent enough that per-request load is acceptable

## Sources

### Primary (HIGH confidence)
- [PostgreSQL Recursive CTEs](https://www.postgresql.org/docs/current/queries-with.html) - Official documentation on WITH queries
- [python-json-patch documentation](https://python-json-patch.readthedocs.io/en/latest/tutorial.html) - JSON Patch library tutorial
- [FastAPI Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/) - Dependency injection patterns
- [SQLModel with FastAPI](https://sqlmodel.tiangolo.com/tutorial/fastapi/limit-and-offset/) - Pagination patterns
- Existing v1.0 code: `backend/app/routers/entities.py`, `backend/app/schemas/entity.py`
- v2.0 models: `backend/app/models/v2/category_property_effective.py`, `backend/app/models/v2/relationships.py`

### Secondary (MEDIUM confidence)
- [FastAPI Pagination](https://uriyyo-fastapi-pagination.netlify.app/) - Third-party pagination library (not using, but validates patterns)
- [PostgreSQL Graph Traversal](https://medium.com/@rizqimulkisrc/postgresql-as-a-graph-database-recursive-queries-for-hierarchical-data-706dda4e788e) - Graph query patterns
- [Python Dictionary Merge Strategies](https://copyprogramming.com/howto/python-how-to-recursively-merge-2-dictionaries-duplicate) - Deep merge patterns
- [Dynamic Materialized Views in SQLAlchemy](https://bakkenbaeck.com/tech/dynamic-materialized-views-in-sqlalchemy) - Refresh patterns

### Tertiary (LOW confidence)
- [FastAPI Response Models](https://fastapi.tiangolo.com/tutorial/response-model/) - General response patterns (not draft-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using proven FastAPI/SQLModel patterns from v1.0, adding only jsonpatch
- Draft overlay pattern: MEDIUM - Application-layer approach is sound, but implementation complexity unknown
- Graph queries: HIGH - PostgreSQL recursive CTEs are well-documented and proven
- Inheritance in draft: LOW - Live recomputation requirement needs validation against performance
- Change status metadata: HIGH - Clear requirement from CONTEXT.md, straightforward implementation

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days - stable domain)

---

## Appendix: Query Endpoint Inventory

### Entity Query Endpoints (QRY-01 to QRY-07)

| Endpoint | Method | Draft Support | Description |
|----------|--------|---------------|-------------|
| `/api/v2/categories` | GET | Yes (draft_id param) | List categories with pagination |
| `/api/v2/categories/{key}` | GET | Yes | Get category detail with properties |
| `/api/v2/categories/{key}/properties` | GET | Yes | Get category properties (direct + inherited) |
| `/api/v2/properties` | GET | Yes | List properties with pagination |
| `/api/v2/properties/{key}` | GET | Yes | Get property detail |
| `/api/v2/properties/{key}/used-by` | GET | Yes | Get categories using this property (QRY-05) |
| `/api/v2/modules/{key}` | GET | Yes | Get module with entities and closure (QRY-06) |
| `/api/v2/bundles/{key}` | GET | Yes | Get bundle with modules and closure (QRY-07) |

### Graph Endpoints (GRP-01 to GRP-04)

| Endpoint | Method | Draft Support | Description |
|----------|--------|---------------|-------------|
| `/api/v2/graph/neighborhood` | GET | Yes | Neighborhood graph within depth (GRP-01) |
| `/api/v2/graph/module/{key}` | GET | Yes | Module-scoped graph (GRP-02) |

**Common Query Parameters:**
- `draft_id` (optional UUID): Draft context for effective view
- `depth` (int, default 2): Max traversal depth for graph queries
- `cursor` (optional string): Pagination cursor
- `limit` (int, default 20): Page size

**Common Response Fields (in draft context):**
- `_change_status`: "added" | "modified" | "deleted" | "unchanged"
- `_deleted`: boolean (true for deleted entities)
- `_patch_error`: string (if JSON Patch failed to apply)
