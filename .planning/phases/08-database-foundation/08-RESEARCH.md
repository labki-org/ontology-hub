# Phase 8: Database Foundation - Research

**Researched:** 2026-01-23
**Domain:** PostgreSQL schema design, SQLModel/SQLAlchemy ORM, materialized views, JSON Patch storage
**Confidence:** HIGH

## Summary

This phase establishes the v2.0 database schema, replacing the v1.0 generic entity model with normalized tables for each entity type, explicit relationship tables, and materialized views for computed inheritance. The existing stack (SQLModel + Alembic + PostgreSQL 17 + asyncpg) remains unchanged; the changes are purely schema-level.

Key design decisions from CONTEXT.md constrain the approach:
- **Latest-only versioning**: Only the current canonical version is stored; labki-schemas repo is the version archive
- **Hybrid patch format**: JSON Patch for updates, full replacement for creates
- **Materialized inheritance**: `category_property_effective` view precomputed at ingest
- **Draft auto-rebase**: Drafts store `base_commit_sha` for rebase detection

**Primary recommendation:** Use separate SQLModel tables for each entity type (category, property, subobject, module, bundle, template), with explicit relationship tables storing foreign keys. Use PostgreSQL materialized views with `REFRESH CONCURRENTLY` for inheritance computation. Store draft changes in a `draft_change` table with JSON Patch in JSONB column.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in use - no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLModel | ^0.0.22 | ORM layer combining SQLAlchemy + Pydantic | Already in v1.0; sufficient for entity models |
| SQLAlchemy | ^2.0.x | Underlying ORM engine | Comes with SQLModel; handles async, relationships |
| asyncpg | ^0.30.0 | PostgreSQL async driver | Already in v1.0; high performance |
| Alembic | ^1.14.0 | Database migrations | Already in v1.0; autogenerate support |
| PostgreSQL | 17-alpine | Database server | Already in docker-compose.yml |

### Supporting (New additions for v2.0)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonpatch | ^1.33 | RFC 6902 JSON Patch operations | Apply/create patches for draft changes |
| alembic-postgresql-enum | latest | Enum migration helpers | When adding new enum values (optional) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLModel | Pure SQLAlchemy 2.0 | More flexibility but more boilerplate; SQLModel is already working |
| Materialized view | Regular view + caching | Simpler but slower; mat view is right choice for inheritance |
| JSONB for patches | Separate columns | More structured but less flexible for RFC 6902 compliance |

**Installation:**
```bash
pip install jsonpatch  # Only new dependency needed
```

## Architecture Patterns

### Recommended Table Structure

```
Tables (entity storage):
- ontology_version         # Current canonical state tracking
- category                 # Category entities with canonical JSON
- property                 # Property entities with canonical JSON
- subobject               # Subobject entities with canonical JSON
- module                  # Module entities with canonical JSON
- bundle                  # Bundle entities with canonical JSON
- template                # Template entities with canonical JSON

Tables (relationships):
- category_parent         # Category inheritance (child_id -> parent_id)
- category_property       # Direct property assignments (category_id -> property_id)
- module_entity           # Module membership (module_id -> entity_type + entity_key)
- bundle_module           # Bundle composition (bundle_id -> module_id)

Views (computed):
- category_property_effective  # Materialized: inherited properties with provenance

Tables (drafts):
- draft                   # Draft metadata, status, base_commit_sha
- draft_change           # Individual changes (JSON Patch or replacement)
```

### Pattern 1: Entity Table with Canonical JSON

**What:** Each entity type gets its own table with a JSONB `canonical_json` column storing the full entity definition, plus extracted columns for querying.

**When to use:** All six entity types (category, property, subobject, module, bundle, template).

**Example:**
```python
# Source: SQLModel documentation + PostgreSQL JSONB best practices
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON
import uuid

class Category(SQLModel, table=True):
    __tablename__ = "category"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    entity_key: str = Field(unique=True, index=True)  # e.g., "Person", "Equipment"
    source_path: str  # e.g., "categories/Person.json"
    label: str = Field(index=True)
    description: str | None = None
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

**Rationale:** Hybrid approach - extract frequently-queried fields (entity_key, label) as columns for indexing, keep full definition in JSONB for flexibility and source fidelity.

### Pattern 2: Relationship Tables with Foreign Keys

**What:** Explicit join tables for many-to-many relationships with additional metadata.

**When to use:** All relationship types (category_parent, category_property, module_entity, bundle_module).

**Example:**
```python
# Source: SQLModel many-to-many with extra fields pattern
class CategoryParent(SQLModel, table=True):
    __tablename__ = "category_parent"

    category_id: uuid.UUID = Field(foreign_key="category.id", primary_key=True)
    parent_id: uuid.UUID = Field(foreign_key="category.id", primary_key=True)

class CategoryProperty(SQLModel, table=True):
    __tablename__ = "category_property"

    category_id: uuid.UUID = Field(foreign_key="category.id", primary_key=True)
    property_id: uuid.UUID = Field(foreign_key="property.id", primary_key=True)
    is_required: bool = False
    origin: str = "direct"  # "direct" or "inherited"
```

### Pattern 3: Materialized View for Inheritance

**What:** PostgreSQL materialized view that precomputes all effective properties for each category, including inherited ones with provenance (source category + depth).

**When to use:** For `category_property_effective` view, refreshed on ingest.

**Example SQL:**
```sql
-- Source: PostgreSQL documentation for materialized views + recursive CTEs
CREATE MATERIALIZED VIEW category_property_effective AS
WITH RECURSIVE inheritance_chain AS (
    -- Base case: direct parents
    SELECT
        cp.category_id,
        cp.parent_id,
        1 as depth,
        ARRAY[cp.parent_id] as path
    FROM category_parent cp

    UNION ALL

    -- Recursive case: grandparents and beyond
    SELECT
        ic.category_id,
        cp.parent_id,
        ic.depth + 1,
        ic.path || cp.parent_id
    FROM inheritance_chain ic
    JOIN category_parent cp ON cp.category_id = ic.parent_id
    WHERE NOT cp.parent_id = ANY(ic.path)  -- Prevent cycles
),
all_properties AS (
    -- Direct properties (depth = 0)
    SELECT
        cp.category_id,
        cp.property_id,
        cp.category_id as source_category_id,
        0 as depth,
        cp.is_required
    FROM category_property cp

    UNION ALL

    -- Inherited properties
    SELECT
        ic.category_id,
        cp.property_id,
        cp.category_id as source_category_id,
        ic.depth,
        cp.is_required
    FROM inheritance_chain ic
    JOIN category_property cp ON cp.category_id = ic.parent_id
)
SELECT DISTINCT ON (category_id, property_id)
    category_id,
    property_id,
    source_category_id,
    depth,
    is_required
FROM all_properties
ORDER BY category_id, property_id, depth;

-- Required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_cpe_category_property
ON category_property_effective (category_id, property_id);
```

### Pattern 4: Draft Change Storage

**What:** Store draft changes as individual rows with change type, JSON Patch for updates, full replacement for creates.

**When to use:** All draft modifications before they're submitted as PRs.

**Example:**
```python
# Source: JSON Patch RFC 6902 + project CONTEXT.md decisions
from enum import Enum

class ChangeType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"

class DraftChange(SQLModel, table=True):
    __tablename__ = "draft_change"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    draft_id: uuid.UUID = Field(foreign_key="draft.id", index=True)
    change_type: ChangeType
    entity_type: str  # "category", "property", etc.
    entity_key: str   # The entity being changed
    patch: dict | None = Field(default=None, sa_column=Column(JSON))  # JSON Patch for updates
    replacement_json: dict | None = Field(default=None, sa_column=Column(JSON))  # Full JSON for creates
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### Anti-Patterns to Avoid

- **Generic entity table with type column:** v1.0 used this; leads to complex queries and weak typing. Use separate tables per entity type.
- **Storing inheritance in JSONB arrays:** Hard to query efficiently. Use explicit relationship tables.
- **Computing inheritance at query time:** Expensive recursive CTEs on every request. Use materialized view.
- **Storing patches as strings:** Harder to query/validate. Use JSONB for structured access.
- **Single draft payload blob:** v1.0 pattern; loses granular change tracking. Use draft_change rows.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Patch operations | Custom patch applier | `jsonpatch` library | RFC 6902 compliance, edge cases handled |
| Inheritance computation | Application-level recursion | PostgreSQL recursive CTE + mat view | Database handles cycles, performance |
| Enum migrations | Manual ALTER TYPE | `alembic-postgresql-enum` or explicit migration | Enum value additions are tricky in PG |
| UUID generation | Custom logic | `uuid.uuid4()` in Python, `gen_random_uuid()` in PG | Standard, collision-proof |
| Timestamp handling | Manual UTC conversion | `datetime.utcnow()`, `timezone.utc` | Consistent timezone handling |

**Key insight:** PostgreSQL's recursive CTEs are specifically designed for hierarchical data traversal. Implementing inheritance computation in application code means pulling all data and computing in Python, which is slower and more error-prone.

## Common Pitfalls

### Pitfall 1: Materialized View Refresh Blocking

**What goes wrong:** `REFRESH MATERIALIZED VIEW` acquires exclusive lock, blocking all reads during refresh.
**Why it happens:** Default refresh behavior in PostgreSQL.
**How to avoid:**
- Always use `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- Requires a unique index on the view (already in pattern above)
- Concurrent refresh is slightly slower but non-blocking
**Warning signs:** Users report "page hangs" during ontology updates.

### Pitfall 2: Enum Value Addition Failures

**What goes wrong:** Adding new enum values in Alembic fails or produces empty migrations.
**Why it happens:** PostgreSQL enums are types, not just constraints; Alembic's autogenerate doesn't handle them well.
**How to avoid:**
- Install `alembic-postgresql-enum` and import in `env.py`
- Or write explicit migration: `ALTER TYPE changetype ADD VALUE 'new_value'`
- Note: New enum values can't be used in same transaction in PG < 12
**Warning signs:** Migration runs but enum column rejects new values.

### Pitfall 3: Draft Rebase Conflicts

**What goes wrong:** After canonical update, draft auto-rebase silently corrupts data or fails unexpectedly.
**Why it happens:** Base entity changed in incompatible way (deleted, restructured).
**How to avoid:**
- Store `base_commit_sha` in draft table
- On ingest, detect which drafts need rebase
- For each draft_change, check if base entity still exists and is compatible
- Mark conflicting drafts with `rebase_status = "conflict"` for manual resolution
**Warning signs:** Users see corrupted preview after ontology update.

### Pitfall 4: Circular Inheritance

**What goes wrong:** Recursive CTE enters infinite loop or produces wrong results.
**Why it happens:** Category A inherits from B, B inherits from A (or longer cycles).
**How to avoid:**
- CTE pattern includes cycle detection: `WHERE NOT cp.parent_id = ANY(ic.path)`
- Validation layer (Phase 14) should detect and reject circular inheritance before storage
- Log a warning if cycle is detected during mat view refresh
**Warning signs:** Mat view refresh hangs or runs extremely long.

### Pitfall 5: JSONB Key Name Storage Bloat

**What goes wrong:** Database grows unexpectedly large.
**Why it happens:** JSONB doesn't deduplicate key names; storing millions of `{"entity_key": "..."}` repeats the key name every time.
**How to avoid:**
- Use hybrid approach: extract frequently-accessed fields as columns
- Keep JSONB for the full canonical definition
- Consider compact key names in stored JSON if size becomes issue
**Warning signs:** Database backup sizes grow faster than expected.

## Code Examples

Verified patterns from official sources:

### SQLModel Enum Definition for PostgreSQL

```python
# Source: https://shekhargulati.com/2025/01/12/postgresql-enum-types-with-sqlmodel-and-alembic/
import enum
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Enum

class DraftStatus(str, enum.Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    SUBMITTED = "submitted"
    MERGED = "merged"
    REJECTED = "rejected"

class IngestStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class Draft(SQLModel, table=True):
    __tablename__ = "draft"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    status: DraftStatus = Field(
        default=DraftStatus.DRAFT,
        sa_column=Column(Enum(DraftStatus))
    )
    # ... other fields
```

### Applying JSON Patch in Python

```python
# Source: https://python-json-patch.readthedocs.io/en/latest/tutorial.html
import jsonpatch

# Create patch from two objects
old_entity = {"label": "Person", "description": "A human being"}
new_entity = {"label": "Person", "description": "A human being (updated)"}
patch = jsonpatch.make_patch(old_entity, new_entity)
# Result: [{"op": "replace", "path": "/description", "value": "A human being (updated)"}]

# Apply patch to recreate
result = jsonpatch.apply_patch(old_entity, patch.patch)
assert result == new_entity

# Store patch as dict for JSONB
patch_dict = patch.patch  # List of operations, JSON-serializable
```

### Refreshing Materialized View Concurrently

```python
# Source: PostgreSQL documentation + SQLAlchemy async pattern
from sqlalchemy import text

async def refresh_inheritance_view(session: AsyncSession):
    """Refresh the category_property_effective materialized view."""
    await session.execute(
        text("REFRESH MATERIALIZED VIEW CONCURRENTLY category_property_effective")
    )
    await session.commit()
```

### Draft Table with Auto-Rebase Support

```python
# Source: Project CONTEXT.md decisions
class Draft(SQLModel, table=True):
    __tablename__ = "draft"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    capability_hash: str = Field(unique=True, index=True)
    base_commit_sha: str  # For auto-rebase detection
    status: DraftStatus = Field(sa_column=Column(Enum(DraftStatus)))
    source: str  # "hub_ui" or "mediawiki_push"
    title: str | None = None
    description: str | None = None
    user_comment: str | None = None

    # Timestamps for workflow tracking
    created_at: datetime = Field(default_factory=datetime.utcnow)
    modified_at: datetime = Field(default_factory=datetime.utcnow)
    validated_at: datetime | None = None
    submitted_at: datetime | None = None

    # Rebase tracking
    rebase_status: str | None = None  # "clean", "conflict", "pending"
    rebase_commit_sha: str | None = None  # New canonical after rebase
```

## State of the Art

| Old Approach (v1.0) | Current Approach (v2.0) | When Changed | Impact |
|---------------------|-------------------------|--------------|--------|
| Generic `entities` table with type column | Separate tables per entity type | v2.0 start | Better typing, simpler queries |
| Draft payload as single JSON blob | `draft_change` rows with individual changes | v2.0 start | Granular tracking, auto-rebase |
| Relationships in JSONB arrays | Explicit relationship tables | v2.0 start | Queryable, referential integrity |
| Compute inheritance at query time | Materialized view refreshed on ingest | v2.0 start | Faster reads, precomputed provenance |
| Version history in database | Only latest version stored | v2.0 start | Simpler, smaller; repo is archive |

**Deprecated/outdated:**
- v1.0 `entities` table pattern: Replaced by per-type tables
- v1.0 `DraftPayload` blob: Replaced by `draft_change` table
- Soft-delete with `deleted_at`: Not needed since only latest is kept

## Open Questions

Things that couldn't be fully resolved:

1. **Draft inheritance computation timing**
   - What we know: Canonical uses materialized view refreshed on ingest
   - What's unclear: Should draft edits compute inheritance dynamically (per-edit) or on save?
   - Recommendation: Start with on-save computation for simplicity; optimize to dynamic if UX feedback requires

2. **Exact auto-rebase conflict resolution strategy**
   - What we know: Drafts need to track base_commit_sha and detect when canonical changes
   - What's unclear: When conflict detected, should it auto-merge simple changes or always flag for manual review?
   - Recommendation: Conservative approach - flag all conflicts for manual review initially; add auto-merge for trivial cases (e.g., unrelated entity changed) based on usage patterns

3. **Module/Bundle version storage**
   - What we know: Modules and bundles have semver versions
   - What's unclear: Where does version number come from during ingest? Is it in the JSON file or derived?
   - Recommendation: Assume version is in the module/bundle JSON from labki-schemas; store in `version` column

## Sources

### Primary (HIGH confidence)
- [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html) - REFRESH CONCURRENTLY requirements
- [SQLModel Many-to-Many](https://sqlmodel.tiangolo.com/tutorial/many-to-many/link-with-extra-fields/) - Relationship patterns with extra fields
- [JSON Patch RFC 6902](https://datatracker.ietf.org/doc/html/rfc6902) - Patch operation specification
- [python-json-patch](https://python-json-patch.readthedocs.io/) - Library documentation

### Secondary (MEDIUM confidence)
- [PostgreSQL Enum with SQLModel](https://shekhargulati.com/2025/01/12/postgresql-enum-types-with-sqlmodel-and-alembic/) - Enum column pattern
- [PostgreSQL JSONB Best Practices](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/) - Hybrid column + JSONB approach
- [PostgreSQL Recursive CTEs](https://leonardqmarcq.com/posts/modeling-hierarchical-tree-data) - Hierarchy modeling patterns

### Tertiary (LOW confidence)
- [pg_ivm Extension](https://wiki.postgresql.org/wiki/Incremental_View_Maintenance) - Future optimization for incremental refresh (not production-ready)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing v1.0 stack, only adding jsonpatch
- Architecture: HIGH - Patterns verified with official docs
- Pitfalls: HIGH - Well-documented PostgreSQL behaviors
- Auto-rebase: MEDIUM - Domain-specific, needs iteration based on usage

**Research date:** 2026-01-23
**Valid until:** 2026-02-23 (30 days - stable domain)
