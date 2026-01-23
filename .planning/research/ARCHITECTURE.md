# Architecture Patterns for Ontology Hub v2.0

**Domain:** Schema/ontology management platform with draft workflow
**Researched:** 2026-01-23 (updated from 2026-01-20 v1.0 research)
**Overall Confidence:** HIGH (based on v1.0 codebase analysis + PostgreSQL patterns)

---

## Executive Summary

The v2.0 architecture requires a fundamental restructuring of the database model to support versioned canonical data, precomputed relationships, and efficient draft overlay computation. The current v1.0 architecture stores relationships embedded in JSON (`schema_definition`) which requires expensive runtime queries. V2.0 moves to normalized relationship tables with materialized inheritance views for fast reads, while keeping the proven async SQLAlchemy + FastAPI stack.

**Core architectural shift:** From "relationships stored in JSON blobs, computed at query time" to "relationships stored in normalized tables, precomputed for fast reads, overlaid for drafts."

---

## Current v1.0 Architecture (Baseline)

### What Exists and Works

| Component | Status | Notes |
|-----------|--------|-------|
| FastAPI async backend | Solid | Rate limiting, error handling, dependency injection |
| SQLModel ORM with SQLAlchemy async | Solid | Session management, migrations working |
| PostgreSQL database | Solid | Async connection pooling |
| React frontend with Zustand | Solid | Immer-based immutable updates |
| Capability URL security | Solid | Hash-based token validation |
| GitHub OAuth flow | Solid | Git Data API for atomic PRs |
| Draft payload validation | Solid | Multi-pass validation engine |
| dagre graph layout | Solid | Inheritance visualization working |

### What Needs Replacement

| Component | Current Approach | Problem |
|-----------|------------------|---------|
| Entity relationships | Embedded in `schema_definition` JSON | Requires JSON path queries, no indexing |
| Module membership | `category_ids` array in Module table | No inverse index, expensive "where used" |
| Inheritance chain | Computed at query time via recursion | No precomputation, slow for large graphs |
| Property inheritance | Not tracked | Frontend can't show effective properties |
| Draft overlay | Full payload replacement | No efficient delta computation |
| Version tracking | Single `commit_sha` on entities | No multi-version support |

### v1.0 Table Structure (Current)

```sql
-- Current simplified structure
entities (id, entity_id, entity_type, label, description, schema_definition JSON, commit_sha)
modules (id, module_id, label, category_ids JSON, dependencies JSON, commit_sha)
profiles (id, profile_id, label, module_ids JSON, commit_sha)
drafts (id, capability_hash, status, payload JSON, diff_preview JSON, validation_results JSON)
```

---

## v2.0 Target Architecture

### Database Schema Overview

The v2.0 database introduces:

1. **ontology_version** - Tracks canonical versions (commit SHAs, tags)
2. **Entity tables** - category, property, subobject, module, bundle, template
3. **Relationship tables** - Normalized foreign keys with version scope
4. **Materialized views** - Precomputed inheritance for fast reads
5. **Draft tables** - Change deltas stored as JSON Patch operations

### Core Tables

#### 1. Version Tracking

```sql
-- Canonical version tracking
CREATE TABLE ontology_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commit_sha VARCHAR(40) NOT NULL UNIQUE,
    tag VARCHAR(100),           -- Nullable, for tagged releases
    ingested_at TIMESTAMP DEFAULT now(),
    entity_count INTEGER,
    is_latest BOOLEAN DEFAULT false,  -- One row should be true
    ingest_warnings JSONB       -- Schema validation warnings
);

-- Draft storage
CREATE TABLE draft (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    capability_hash VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',  -- pending, validated, submitted, expired
    source_wiki VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT now(),
    validation_results JSONB,
    pr_url VARCHAR(255)
);

-- Draft changes as deltas
CREATE TABLE draft_change (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID REFERENCES draft(id) ON DELETE CASCADE NOT NULL,
    change_type VARCHAR(10) NOT NULL,  -- create, update, delete
    entity_type VARCHAR(20) NOT NULL,  -- category, property, subobject, module, bundle, template
    entity_key VARCHAR(255) NOT NULL,  -- Path-derived key: "categories/Person"
    patch JSONB,                -- JSON Patch (RFC 6902) for updates
    replacement_json JSONB,     -- Full entity JSON for creates
    created_at TIMESTAMP DEFAULT now(),
    CONSTRAINT uq_draft_entity UNIQUE (draft_id, entity_type, entity_key)
);
```

#### 2. Entity Tables (Version-Scoped)

```sql
-- Category (entity type with inheritance)
CREATE TABLE category (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    entity_key VARCHAR(255) NOT NULL,  -- "categories/Person"
    label VARCHAR(255) NOT NULL,
    description TEXT,
    schema_json JSONB NOT NULL,        -- Full original JSON for reference
    CONSTRAINT uq_category_version UNIQUE (ontology_version_id, entity_key)
);

-- Property (attribute definition)
CREATE TABLE property (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    entity_key VARCHAR(255) NOT NULL,  -- "properties/Has_email"
    label VARCHAR(255) NOT NULL,
    description TEXT,
    datatype VARCHAR(50),
    cardinality VARCHAR(20),
    schema_json JSONB NOT NULL,
    CONSTRAINT uq_property_version UNIQUE (ontology_version_id, entity_key)
);

-- Subobject (nested structure)
CREATE TABLE subobject (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    entity_key VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    schema_json JSONB NOT NULL,
    CONSTRAINT uq_subobject_version UNIQUE (ontology_version_id, entity_key)
);

-- Module (logical grouping)
CREATE TABLE module (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    entity_key VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    schema_json JSONB NOT NULL,
    CONSTRAINT uq_module_version UNIQUE (ontology_version_id, entity_key)
);

-- Bundle (was Profile - module collections)
CREATE TABLE bundle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    entity_key VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    schema_json JSONB NOT NULL,
    CONSTRAINT uq_bundle_version UNIQUE (ontology_version_id, entity_key)
);

-- Template (new entity type for v2.0)
CREATE TABLE template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    entity_key VARCHAR(255) NOT NULL,  -- "templates/property/Text"
    label VARCHAR(255) NOT NULL,
    description TEXT,
    wikitext TEXT,
    schema_json JSONB NOT NULL,
    CONSTRAINT uq_template_version UNIQUE (ontology_version_id, entity_key)
);
```

### Relationship Tables

These tables normalize the relationships that v1.0 stores in JSON arrays.

#### 3. Category Relationships

```sql
-- Category parent-child relationships (inheritance hierarchy)
CREATE TABLE category_parent (
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    child_category_id UUID REFERENCES category(id) NOT NULL,
    parent_category_id UUID REFERENCES category(id) NOT NULL,
    PRIMARY KEY (ontology_version_id, child_category_id, parent_category_id)
);
CREATE INDEX ix_category_parent_child ON category_parent(child_category_id);
CREATE INDEX ix_category_parent_parent ON category_parent(parent_category_id);

-- Category to property assignment (declared properties)
CREATE TABLE category_property (
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    category_id UUID REFERENCES category(id) NOT NULL,
    property_id UUID REFERENCES property(id) NOT NULL,
    required BOOLEAN DEFAULT false,
    origin VARCHAR(20) NOT NULL,  -- 'declared' or 'inherited'
    source_category_id UUID REFERENCES category(id),  -- For inherited: which ancestor
    PRIMARY KEY (ontology_version_id, category_id, property_id)
);
CREATE INDEX ix_category_property_category ON category_property(category_id);
CREATE INDEX ix_category_property_property ON category_property(property_id);

-- Category to subobject assignment
CREATE TABLE category_subobject (
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    category_id UUID REFERENCES category(id) NOT NULL,
    subobject_id UUID REFERENCES subobject(id) NOT NULL,
    required BOOLEAN DEFAULT false,
    origin VARCHAR(20) NOT NULL,
    source_category_id UUID REFERENCES category(id),
    PRIMARY KEY (ontology_version_id, category_id, subobject_id)
);
CREATE INDEX ix_category_subobject_category ON category_subobject(category_id);
CREATE INDEX ix_category_subobject_subobject ON category_subobject(subobject_id);
```

#### 4. Materialized Inheritance View

```sql
-- Materialized view for effective (inherited) properties per category
CREATE MATERIALIZED VIEW category_property_effective AS
WITH RECURSIVE inheritance AS (
    -- Base case: categories with their declared properties
    SELECT
        cp.ontology_version_id,
        cp.category_id,
        cp.property_id,
        cp.required,
        cp.category_id as source_category_id,
        0 as depth
    FROM category_property cp
    WHERE cp.origin = 'declared'

    UNION ALL

    -- Recursive case: inherit from parents
    SELECT
        cpar.ontology_version_id,
        cpar.child_category_id as category_id,
        inh.property_id,
        inh.required,
        inh.source_category_id,
        inh.depth + 1
    FROM inheritance inh
    JOIN category_parent cpar ON cpar.parent_category_id = inh.category_id
        AND cpar.ontology_version_id = inh.ontology_version_id
)
SELECT DISTINCT ON (ontology_version_id, category_id, property_id)
    ontology_version_id,
    category_id,
    property_id,
    required,
    source_category_id,
    depth
FROM inheritance
ORDER BY ontology_version_id, category_id, property_id, depth ASC;

CREATE UNIQUE INDEX ON category_property_effective(ontology_version_id, category_id, property_id);
CREATE INDEX ON category_property_effective(property_id);  -- For "where used" queries
```

#### 5. Module Membership

```sql
-- Module to entity assignments (normalized)
CREATE TABLE module_entity (
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    module_id UUID REFERENCES module(id) NOT NULL,
    entity_type VARCHAR(20) NOT NULL,  -- 'category', 'property', 'subobject', 'template'
    entity_id UUID NOT NULL,           -- References appropriate entity table
    PRIMARY KEY (ontology_version_id, module_id, entity_type, entity_id)
);
CREATE INDEX ix_module_entity_entity ON module_entity(entity_type, entity_id);
CREATE INDEX ix_module_entity_module ON module_entity(module_id);

-- Module dependencies
CREATE TABLE module_dependency (
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    module_id UUID REFERENCES module(id) NOT NULL,
    depends_on_module_id UUID REFERENCES module(id) NOT NULL,
    PRIMARY KEY (ontology_version_id, module_id, depends_on_module_id)
);

-- Bundle to module assignments
CREATE TABLE bundle_module (
    ontology_version_id UUID REFERENCES ontology_version(id) NOT NULL,
    bundle_id UUID REFERENCES bundle(id) NOT NULL,
    module_id UUID REFERENCES module(id) NOT NULL,
    PRIMARY KEY (ontology_version_id, bundle_id, module_id)
);
```

---

## Component Architecture

### Backend Components

```
backend/
  app/
    models/
      __init__.py
      version.py          # ontology_version, draft, draft_change
      category.py         # category table
      property.py         # property table
      subobject.py        # subobject table
      module.py           # module table (new)
      bundle.py           # bundle table (renamed from profile)
      template.py         # NEW: template entity
      relationships.py    # All relationship tables

    services/
      ingest/
        __init__.py
        pipeline.py     # Orchestrates full ingest
        parser.py       # JSON Schema validation
        relationship_builder.py  # Populates relationship tables
        materializer.py # Refreshes materialized views

      query/
        __init__.py
        entity_reader.py    # Version-scoped entity reads
        relationship_reader.py  # Relationship queries
        graph_builder.py    # Constructs graph responses
        draft_overlay.py    # Applies draft deltas to queries

      draft/
        __init__.py
        change_tracker.py   # Records draft_change entries
        effective_view.py   # Computes canonical + overlay
        localized_rematerializer.py  # Re-computes inheritance for draft
        patch_applicator.py # Applies JSON Patch to entities

      validation/           # REUSE from v1.0 (with modifications)

    routers/
      entities.py         # REFACTOR: Add version_id/draft_id params
      graph.py            # NEW: Graph-specific endpoints
      drafts.py           # REFACTOR: Delta-based updates
      versions.py         # REFACTOR: Multi-version support
      ingest.py           # NEW: Ingest trigger endpoints

    schemas/
      graph.py            # NEW: Graph response schemas
      ...                 # Updated response schemas
```

### New vs Modified Components

| Component | Status | Integration Points |
|-----------|--------|-------------------|
| `models/version.py` | NEW | All entity queries, draft creation |
| `models/template.py` | NEW | Same patterns as other entities |
| `models/relationships.py` | NEW | Ingest pipeline, query services |
| `services/ingest/pipeline.py` | NEW | GitHub webhook, manual trigger |
| `services/ingest/relationship_builder.py` | NEW | Called after entity parsing |
| `services/ingest/materializer.py` | NEW | After relationships populated |
| `services/query/draft_overlay.py` | NEW | All read endpoints |
| `services/draft/localized_rematerializer.py` | NEW | Draft validation |
| `routers/entities.py` | MODIFY | Add version_id/draft_id params |
| `routers/graph.py` | NEW | Graph visualization endpoints |

### Frontend Components (Changes)

```
frontend/src/
  api/
    types.ts            # UPDATE: Add version_id to requests
    client.ts           # UPDATE: Version context in headers

  stores/
    draftStore.ts       # SIMPLIFY: Remove merge logic
                        # Frontend receives effective data

  components/
    graph/
      OntologyGraph.tsx    # NEW: Full ontology graph view
      ModuleHull.tsx       # NEW: Module boundary visualization
      ...
```

**Key Frontend Simplification:** The frontend no longer merges draft changes with canonical data. The API always returns effective data (canonical + draft overlay computed server-side). This eliminates client-side merge complexity and ensures consistency.

---

## Data Flow Patterns

### Pattern 1: Canonical Read (No Draft)

```
Request: GET /entities/category/Person?version_id=<uuid>

1. Router receives version_id (or defaults to latest)
2. Query service fetches from category table WHERE ontology_version_id = ?
3. Query service fetches from category_property_effective for effective properties
4. Response built with entity + effective properties + inheritance info
```

### Pattern 2: Draft Read (With Overlay)

```
Request: GET /entities/category/Person?draft_id=<uuid>

1. Router receives draft_id
2. Fetch draft to get base_ontology_version_id
3. Fetch canonical entity at base version
4. Fetch draft_change WHERE draft_id = ? AND entity_key = 'categories/Person'
5. If change exists:
   - If change_type = 'delete': Return 404
   - If change_type = 'create': Return replacement_json
   - If change_type = 'update': Apply JSON Patch to canonical
6. Compute effective properties with localized re-materialization
7. Return effective view
```

### Pattern 3: Draft Update

```
Request: PATCH /drafts/{token}/changes

1. Validate capability token
2. Parse incoming change (entity_type, entity_key, operation)
3. For UPDATES:
   - Compute JSON Patch (RFC 6902) from old -> new
   - Upsert draft_change with patch
4. For CREATES:
   - Store full replacement_json
5. For DELETES:
   - Store change_type = 'delete', no patch needed
6. Trigger localized re-materialization for affected inheritance paths
7. Re-run validation
8. Return updated effective view
```

### Pattern 4: Graph Query

```
Request: GET /graph?version_id=<uuid>&modules=<id1>,<id2>

1. Fetch all categories for version (or with draft overlay)
2. Build nodes from categories
3. Build edges from category_parent table
4. Fetch module_entity for specified modules
5. Compute group membership for multi-hull rendering
6. Return { nodes, edges, groups }
```

### Pattern 5: "Where Used" Query

```
Request: GET /entities/property/{key}/used-by?version_id=<uuid>

1. Query category_property_effective WHERE property_id = ?
2. Return list of categories with origin info (declared vs inherited)
3. If draft_id provided, apply overlay to results
```

---

## Draft Overlay Computation

### Hybrid Patch Format

Per project decisions, v2.0 uses:
- **JSON Patch (RFC 6902)** for updates - granular field changes
- **Full replacement** for creates - simpler handling

```python
# draft_change example for UPDATE
{
    "draft_id": "...",
    "change_type": "update",
    "entity_type": "category",
    "entity_key": "categories/Person",
    "patch": [
        {"op": "replace", "path": "/label", "value": "Individual"},
        {"op": "add", "path": "/description", "value": "A human being"}
    ],
    "replacement_json": null
}

# draft_change example for CREATE
{
    "draft_id": "...",
    "change_type": "create",
    "entity_type": "category",
    "entity_key": "categories/NewEntity",
    "patch": null,
    "replacement_json": {
        "id": "NewEntity",
        "label": "New Entity",
        "parent": "Thing",
        "properties": ["Has_name"]
    }
}
```

### Localized Re-Materialization

When a draft modifies inheritance (category parent changes), the effective properties view needs partial recomputation.

**Algorithm:**

1. Identify affected categories (modified category + all descendants)
2. Fetch canonical inheritance from `category_parent`
3. Apply draft patches to get effective inheritance
4. Recompute effective properties for affected subtree only
5. Cache in-memory for duration of draft query (not persisted)

**Implementation approach:** Use recursive CTE on patched relationship data, scoped to affected nodes.

```python
async def recompute_effective_properties_for_draft(
    session: AsyncSession,
    draft: Draft,
    affected_category_keys: set[str]
) -> dict[str, list[EffectiveProperty]]:
    """
    Recompute effective properties only for categories affected by draft changes.
    Returns in-memory overlay, not persisted.
    """
    # 1. Get canonical category_parent for base version
    canonical_parents = await get_category_parents(session, draft.base_ontology_version_id)

    # 2. Apply draft changes to parent relationships
    draft_parent_changes = await get_draft_changes(
        session, draft.id, entity_type='category_parent'
    )
    effective_parents = apply_parent_changes(canonical_parents, draft_parent_changes)

    # 3. Find all descendants of modified categories
    affected = find_affected_subtree(affected_category_keys, effective_parents)

    # 4. Recompute inheritance for affected only
    return compute_inheritance_for_subset(effective_parents, affected)
```

---

## Ingest Pipeline

### Pipeline Stages

```
1. TRIGGER
   - GitHub webhook (push to main)
   - Manual API call

2. FETCH
   - Clone/pull repo at target ref
   - Record commit SHA

3. VALIDATE
   - JSON Schema validation per directory
   - Collect warnings (don't fail on non-critical)

4. PARSE
   - Extract entities from JSON files
   - Build entity_key from path

5. POPULATE ENTITIES
   - Insert into versioned entity tables
   - Single transaction per version

6. POPULATE RELATIONSHIPS
   - Parse references from schema_json
   - Insert into relationship tables

7. MATERIALIZE
   - REFRESH MATERIALIZED VIEW CONCURRENTLY
   - For category_property_effective

8. FINALIZE
   - Set is_latest = true on new version
   - Set is_latest = false on old
   - Store any warnings in ontology_version.ingest_warnings
```

### Error Handling

| Error Type | Handling |
|------------|----------|
| JSON syntax error | Skip file, log warning |
| Schema validation fail | Skip file, log warning |
| Missing reference | Log warning, allow (broken link) |
| Circular inheritance | Log error, skip category |
| DB constraint violation | Rollback entire version |

---

## API Design Patterns

### Version Context in All Reads

Every read endpoint accepts optional `version_id` or `draft_id`:

```python
@router.get("/entities/{entity_type}/{entity_key}")
async def get_entity(
    entity_type: EntityType,
    entity_key: str,
    version_id: UUID | None = Query(None, description="Canonical version ID"),
    draft_id: UUID | None = Query(None, description="Draft ID for overlay view"),
    session: SessionDep,
) -> EntityResponse:
    """
    Get entity with version/draft context.

    Priority:
    1. If draft_id provided: Return effective (canonical + overlay)
    2. If version_id provided: Return canonical at that version
    3. If neither: Return canonical at latest version
    """
```

### Graph Endpoints

```python
@router.get("/graph/ontology")
async def get_ontology_graph(
    version_id: UUID | None = Query(None),
    draft_id: UUID | None = Query(None),
    modules: list[str] | None = Query(None, description="Module IDs for hull rendering"),
    entity_types: list[str] | None = Query(None, description="Filter by entity type"),
) -> OntologyGraphResponse:
    """
    Get full ontology graph for visualization.

    Returns:
    - nodes: All entities with position hints
    - edges: Inheritance + property relationships
    - groups: Module membership for hull rendering
    """

@router.get("/graph/inheritance/{category_key}")
async def get_inheritance_graph(
    category_key: str,
    version_id: UUID | None = Query(None),
    draft_id: UUID | None = Query(None),
    depth: int = Query(3, description="Max depth to traverse"),
) -> InheritanceGraphResponse:
    """
    Get inheritance subgraph for a specific category.
    """
```

### Validation Endpoints

```python
@router.post("/drafts/{token}/validate")
async def validate_draft(token: str) -> DraftValidationReport:
    """
    Run full validation on draft.

    Returns structured validation with:
    - errors: Blocking issues
    - warnings: Non-blocking concerns
    - info: Informational notes
    - suggested_semver: Based on change analysis
    """
```

---

## Build Order Recommendation

Based on dependencies between components:

### Phase 1: Database Foundation
1. Create new migration for v2.0 schema (alongside v1.0 tables)
2. Implement ontology_version table
3. Implement entity tables (category, property, subobject, module, bundle)
4. Add template entity table
5. Implement relationship tables (category_parent, category_property, etc.)

### Phase 2: Ingest Pipeline
6. Git fetch service (reuse GitHubClient)
7. JSON Schema validation
8. Entity parsing and insertion
9. Relationship builder
10. Materialized view refresh

### Phase 3: Query Layer
11. Version-scoped entity reader
12. Relationship queries (effective properties, where-used)
13. Graph response builder

### Phase 4: Draft System
14. Draft and draft_change tables
15. JSON Patch library integration
16. Draft overlay computation
17. Localized re-materialization

### Phase 5: API Layer
18. Update entity endpoints with version_id/draft_id
19. New graph endpoints
20. Updated draft endpoints

### Phase 6: Frontend Updates
21. Version context in API client
22. Remove client-side merge logic
23. Graph visualization updates

### Phase 7: Migration
24. Data migration from v1.0 tables
25. Integration testing
26. v1.0 table deprecation

---

## Anti-Patterns to Avoid

### 1. Lazy Loading in Async Context
**Problem:** SQLAlchemy lazy loading triggers implicit I/O
**Solution:** Use `selectinload()` or `joinedload()` explicitly for all relationships

### 2. N+1 Queries in Relationship Fetches
**Problem:** Fetching related entities one at a time
**Solution:** Batch queries with IN clauses, use materialized views

### 3. Full Graph Re-Materialization on Draft Changes
**Problem:** Refreshing entire materialized view for each draft edit
**Solution:** Localized re-materialization computes only affected subtree in-memory

### 4. Client-Side Draft Merging
**Problem:** Frontend tries to merge canonical + draft, gets out of sync
**Solution:** API always returns effective view, frontend just renders

### 5. Unbounded Recursive Queries
**Problem:** Circular inheritance causes infinite loops
**Solution:** Depth limits, cycle detection in CTE with visited tracking

### 6. Storing Computed Data in draft_change
**Problem:** Storing effective properties in draft leads to stale data
**Solution:** Always compute effective view at query time

---

## Scalability Considerations

| Concern | At 100 entities | At 10K entities | At 100K entities |
|---------|-----------------|-----------------|------------------|
| Full graph load | Direct query | Paginated, lazy nodes | Virtualized, LOD |
| Inheritance compute | Real-time CTE | Materialized view | Partitioned by version |
| Draft overlay | In-memory | In-memory | Consider caching layer |
| Version storage | Keep all | Keep all | Archive old versions |

---

## Sources

### Official Documentation (HIGH confidence)
- [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html)
- [PostgreSQL Recursive CTEs](https://www.postgresql.org/docs/current/queries-with.html)
- [SQLAlchemy 2.0 Async Documentation](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [JSON Patch RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902)

### Research Articles (MEDIUM confidence)
- [PostgreSQL as a Graph Database: Recursive Queries](https://medium.com/@rizqimulkisrc/postgresql-as-a-graph-database-recursive-queries-for-hierarchical-data-706dda4e788e)
- [SQL/PGQ in PostgreSQL](https://www.enterprisedb.com/blog/representing-graphs-postgresql-sqlpgq)
- [SQLAlchemy Relationship Loading Techniques](https://docs.sqlalchemy.org/en/20/orm/queryguide/relationships.html)
- [Materialized Views vs Summary Tables](https://support.boldbi.com/kb/article/15430/summary-tables-vs-materialized-views-a-comparison)

### v1.0 Codebase Analysis (HIGH confidence)
- `/home/daharoni/dev/ontology-hub/backend/app/models/` - Current model structure
- `/home/daharoni/dev/ontology-hub/backend/app/services/inheritance.py` - Runtime inheritance computation
- `/home/daharoni/dev/ontology-hub/backend/app/services/draft_diff.py` - Current diff computation
- `/home/daharoni/dev/ontology-hub/backend/app/services/indexer.py` - Current ingest approach

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Database schema design | HIGH | Based on established PostgreSQL patterns |
| Relationship table structure | HIGH | Standard normalization approach |
| Materialized view approach | HIGH | Well-documented PostgreSQL feature |
| Draft overlay pattern | MEDIUM | Custom design, needs validation in practice |
| Localized re-materialization | MEDIUM | Algorithm clear, performance needs testing |
| API design | HIGH | Evolution of working v1.0 patterns |
| Frontend simplification | HIGH | Removes complexity, clearer separation |

---

## Quality Gate Checklist

- [x] Integration points clearly identified (v1.0 components, GitHub, PostgreSQL)
- [x] New vs modified components explicit (status column in component tables)
- [x] Build order considers existing dependencies (7-phase plan)
- [x] Data flow patterns documented (5 core patterns)
- [x] Anti-patterns identified with mitigations

---

## Open Questions for Phase-Specific Research

1. **JSON Patch library choice** - Need to evaluate Python libraries (jsonpatch, python-json-patch) for RFC 6902 compliance and performance

2. **Materialized view refresh strategy** - CONCURRENTLY vs full refresh trade-offs with expected data sizes

3. **Graph visualization library** - Current dagre may not support multi-hull module overlays; research alternatives

4. **Template entity structure** - Need to analyze labki-schemas template format before designing table schema
