# Phase 24: Database Schema - Research

**Researched:** 2026-01-27
**Domain:** PostgreSQL schema design, SQLModel ORM, Alembic migrations, entity relationship tables
**Confidence:** HIGH

## Summary

This phase adds database tables for Dashboard and Resource entity types, following established v2.0 patterns from Phase 8. The existing codebase provides clear patterns: each entity type has its own SQLModel table with `canonical_json` column (using SQLAlchemy's JSON type), extracted queryable columns (entity_key, label), and timestamps (created_at, updated_at). Relationship tables use composite primary keys for junction patterns.

The CONTEXT.md decisions constrain the implementation:
- **Dashboard table**: Store pages array in `canonical_json` JSONB; extract `label` for search/display
- **Resource table**: Store entire resource as `canonical_json` JSONB; extract `category_key` as plain string (NOT FK)
- **Relationship tables**: Junction pattern for `module_dashboard` and `bundle_dashboard` with composite primary keys
- **Deletion behavior**: Resources allow orphans; dashboards use RESTRICT on deletion; junction tables use CASCADE

The EntityType enum in `backend/app/models/v2/enums.py` must be extended with DASHBOARD and RESOURCE values.

**Primary recommendation:** Follow the existing entity model pattern exactly (Category/Module/Bundle as templates). Use `sa.JSON()` type matching existing codebase (not PostgreSQL-specific JSONB). Create a single Alembic migration (002) that adds all new tables, relationship tables, and enum values.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already in use - no changes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLModel | ^0.0.22 | ORM layer combining SQLAlchemy + Pydantic | Already in codebase; consistent model pattern |
| SQLAlchemy | ^2.0.x | Underlying ORM engine | Comes with SQLModel; handles JSON columns |
| Alembic | ^1.14.0 | Database migrations | Already in codebase; 001_full_schema.py exists |
| PostgreSQL | 17-alpine | Database server | Already in docker-compose.yml |

### Supporting (No new dependencies needed)

This phase requires no new dependencies. All patterns use existing SQLModel/SQLAlchemy capabilities.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sa.JSON()` | `postgresql.JSONB` | PostgreSQL-specific JSONB offers indexing; existing codebase uses generic JSON and it works |
| Plain string for category_key | Foreign key to categories | FK would block category deletion; decision is plain string to allow orphans |
| Separate migration files | Single combined migration | Combined is cleaner for related changes |

**Installation:**
```bash
# No new dependencies required
```

## Architecture Patterns

### Recommended Table Structure

Following existing patterns in `backend/app/models/v2/`:

```
New Entity Tables:
- dashboards              # Dashboard entities with canonical_json (pages array)
- resources               # Resource entities with canonical_json (dynamic fields)

New Relationship Tables:
- module_dashboard        # Junction: module_id -> dashboard_id
- bundle_dashboard        # Junction: bundle_id -> dashboard_id

Modified:
- EntityType enum         # Add DASHBOARD and RESOURCE values
```

### Pattern 1: Entity Table with Canonical JSON

**What:** Each entity type gets its own table with `canonical_json` storing full definition, plus extracted columns for querying.

**When to use:** Dashboard and Resource tables.

**Example (Dashboard):**
```python
# Source: Existing pattern from backend/app/models/v2/category.py
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON
import uuid
from datetime import datetime

class DashboardBase(SQLModel):
    """Base model for Dashboard with common fields."""

    entity_key: str = Field(index=True)  # e.g., "Core_overview"
    source_path: str  # e.g., "dashboards/Core_overview.json"
    label: str = Field(index=True)
    description: str | None = None
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))

class Dashboard(DashboardBase, table=True):
    """Dashboard entity database table."""

    __tablename__ = "dashboards"
    __table_args__ = (
        sa.UniqueConstraint("entity_key", name="uq_dashboards_entity_key"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DashboardPublic(DashboardBase):
    """Public schema for Dashboard responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
```

### Pattern 2: Resource Table with Category Reference

**What:** Resource table with `category_key` as plain string column (not FK).

**When to use:** Resource table specifically.

**Example (Resource):**
```python
# Source: CONTEXT.md decision + existing entity pattern
class ResourceBase(SQLModel):
    """Base model for Resource with common fields."""

    entity_key: str = Field(index=True)  # e.g., "Person/John_doe"
    source_path: str  # e.g., "resources/Person/John_doe.json"
    label: str = Field(index=True)
    description: str | None = None
    category_key: str = Field(index=True)  # e.g., "Person" - NOT a FK
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))

class Resource(ResourceBase, table=True):
    """Resource entity database table."""

    __tablename__ = "resources"
    __table_args__ = (
        sa.UniqueConstraint("entity_key", name="uq_resources_entity_key"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

### Pattern 3: Junction Tables with Composite Keys and On-Delete

**What:** Junction tables linking modules/bundles to dashboards with proper deletion behavior.

**When to use:** module_dashboard and bundle_dashboard relationships.

**Example:**
```python
# Source: Existing pattern from backend/app/models/v2/relationships.py (BundleModule)
class ModuleDashboard(SQLModel, table=True):
    """Module-to-dashboard relationship.

    CASCADE: Deleting module removes junction rows (dashboard survives).
    RESTRICT: Cannot delete dashboard if any module references it.
    """

    __tablename__ = "module_dashboard"

    module_id: uuid.UUID = Field(
        foreign_key="modules_v2.id",
        primary_key=True,
        sa_column_kwargs={"ondelete": "CASCADE"}
    )
    dashboard_id: uuid.UUID = Field(
        foreign_key="dashboards.id",
        primary_key=True,
        sa_column_kwargs={"ondelete": "RESTRICT"}
    )

class BundleDashboard(SQLModel, table=True):
    """Bundle-to-dashboard relationship."""

    __tablename__ = "bundle_dashboard"

    bundle_id: uuid.UUID = Field(
        foreign_key="bundles.id",
        primary_key=True,
        sa_column_kwargs={"ondelete": "CASCADE"}
    )
    dashboard_id: uuid.UUID = Field(
        foreign_key="dashboards.id",
        primary_key=True,
        sa_column_kwargs={"ondelete": "RESTRICT"}
    )
```

### Pattern 4: EntityType Enum Extension

**What:** Add new enum values to existing EntityType.

**When to use:** When adding new entity types.

**Example:**
```python
# Source: backend/app/models/v2/enums.py
class EntityType(str, Enum):
    """Types of schema entities in v2.0."""

    CATEGORY = "category"
    PROPERTY = "property"
    SUBOBJECT = "subobject"
    MODULE = "module"
    BUNDLE = "bundle"
    TEMPLATE = "template"
    DASHBOARD = "dashboard"   # NEW
    RESOURCE = "resource"     # NEW
```

### Anti-Patterns to Avoid

- **Using FK for category_key on resources:** Would block category deletion. Decision is plain string to allow orphaned resources.
- **Separate pages table for dashboard pages:** Pages always fetched with dashboard; JSONB in canonical_json is correct.
- **Forgetting ondelete behavior:** Junction tables need explicit CASCADE/RESTRICT per CONTEXT.md decisions.
- **Using PostgreSQL-specific JSONB:** Existing codebase uses `sa.JSON()` for consistency.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom logic | `uuid.uuid4()` | Standard Python; matches existing pattern |
| Timestamps | Manual datetime handling | `datetime.utcnow` in Field default | Matches existing entity tables |
| JSON column type | PostgreSQL-specific JSONB | `sa.JSON()` via `Column(JSON)` | Cross-DB compatibility; matches codebase |
| Enum migrations | Manual ALTER TYPE | Explicit migration with create_type | Alembic pattern in 001_full_schema.py |

**Key insight:** Follow existing patterns exactly. The codebase has established conventions in 001_full_schema.py and models/v2/*.py that should be replicated for consistency.

## Common Pitfalls

### Pitfall 1: PostgreSQL Enum Value Addition

**What goes wrong:** Adding new enum values to existing EntityType fails or requires special handling.
**Why it happens:** PostgreSQL enums are types; adding values requires `ALTER TYPE ... ADD VALUE`.
**How to avoid:**
- In migration, check if enum exists before creating
- Use `op.execute("ALTER TYPE entitytype ADD VALUE 'dashboard'")` for v1.0 entitytype
- Note: The v2.0 models store entity_type as string, not enum (see draft_change.entity_type)
**Warning signs:** Migration fails with "type already exists" or new values rejected.

### Pitfall 2: Forgetting to Update Model Imports

**What goes wrong:** New models not picked up by SQLModel metadata.
**Why it happens:** SQLModel requires models to be imported before `create_all()` runs.
**How to avoid:**
- Add imports to `backend/app/models/v2/__init__.py`
- Add re-exports to `backend/app/models/__init__.py`
- Update `__all__` lists in both files
**Warning signs:** Tables not created; migration doesn't see new models.

### Pitfall 3: Unique Constraint Naming

**What goes wrong:** Constraint names conflict or are auto-generated poorly.
**Why it happens:** SQLModel/Alembic generates names; explicit names are clearer.
**How to avoid:**
- Use explicit constraint names: `uq_dashboards_entity_key`, `uq_resources_entity_key`
- Follow existing pattern: `uq_{tablename}_{column}`
**Warning signs:** Cryptic constraint names in error messages.

### Pitfall 4: Missing Index on Foreign Keys

**What goes wrong:** Slow queries when joining junction tables.
**Why it happens:** PostgreSQL doesn't auto-create indexes on FK columns (unlike MySQL).
**How to avoid:**
- For junction tables with composite PK, the PK index covers both columns
- If needed, add explicit index on dashboard_id for reverse lookups
- Check existing pattern: module_entity has explicit indexes on both module_id and entity_key
**Warning signs:** Slow "find modules for dashboard" queries.

### Pitfall 5: Forgetting RESTRICT vs CASCADE Semantics

**What goes wrong:** Dashboard deletion succeeds when it shouldn't (RESTRICT ignored).
**Why it happens:** ondelete must be specified in migration, not just model.
**How to avoid:**
- In Alembic migration, use `sa.ForeignKeyConstraint(..., ondelete="RESTRICT")`
- Verify with test: try deleting dashboard that has module references
**Warning signs:** Data integrity violations; orphaned junction rows.

## Code Examples

Verified patterns from existing codebase:

### Complete Dashboard Model File

```python
# Source: Pattern from backend/app/models/v2/category.py
"""Dashboard entity model for v2.0."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class DashboardBase(SQLModel):
    """Base model for Dashboard with common fields."""

    entity_key: str = Field(index=True)  # Path-derived key, e.g., "Core_overview"
    source_path: str  # Original file path, e.g., "dashboards/Core_overview.json"
    label: str = Field(index=True)
    description: str | None = None
    canonical_json: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Dashboard(DashboardBase, table=True):
    """Dashboard entity database table.

    Dashboards are documentation pages with SMW queries for modules/bundles.
    Pages are stored in canonical_json.pages array.
    """

    __tablename__ = "dashboards"
    __table_args__ = (sa.UniqueConstraint("entity_key", name="uq_dashboards_entity_key"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DashboardPublic(DashboardBase):
    """Public schema for Dashboard responses."""

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
```

### Alembic Migration for New Tables

```python
# Source: Pattern from backend/alembic/versions/001_full_schema.py
"""Add Dashboard and Resource tables with relationship tables.

Revision ID: 002
Revises: 001
Create Date: 2026-01-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: str = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # === Entity Tables ===

    # dashboards table
    op.create_table(
        "dashboards",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_dashboards_entity_key"),
    )
    op.create_index(op.f("ix_dashboards_entity_key"), "dashboards", ["entity_key"])
    op.create_index(op.f("ix_dashboards_label"), "dashboards", ["label"])

    # resources table
    op.create_table(
        "resources",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("entity_key", sa.String(), nullable=False),
        sa.Column("source_path", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("category_key", sa.String(), nullable=False),
        sa.Column("canonical_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("entity_key", name="uq_resources_entity_key"),
    )
    op.create_index(op.f("ix_resources_entity_key"), "resources", ["entity_key"])
    op.create_index(op.f("ix_resources_label"), "resources", ["label"])
    op.create_index(op.f("ix_resources_category_key"), "resources", ["category_key"])

    # === Relationship Tables ===

    # module_dashboard
    op.create_table(
        "module_dashboard",
        sa.Column("module_id", sa.UUID(), nullable=False),
        sa.Column("dashboard_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("module_id", "dashboard_id"),
        sa.ForeignKeyConstraint(["module_id"], ["modules_v2.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"], ondelete="RESTRICT"),
    )

    # bundle_dashboard
    op.create_table(
        "bundle_dashboard",
        sa.Column("bundle_id", sa.UUID(), nullable=False),
        sa.Column("dashboard_id", sa.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("bundle_id", "dashboard_id"),
        sa.ForeignKeyConstraint(["bundle_id"], ["bundles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"], ondelete="RESTRICT"),
    )


def downgrade() -> None:
    # Drop relationship tables first (FK dependencies)
    op.drop_table("bundle_dashboard")
    op.drop_table("module_dashboard")

    # Drop entity tables
    op.drop_index(op.f("ix_resources_category_key"), table_name="resources")
    op.drop_index(op.f("ix_resources_label"), table_name="resources")
    op.drop_index(op.f("ix_resources_entity_key"), table_name="resources")
    op.drop_table("resources")

    op.drop_index(op.f("ix_dashboards_label"), table_name="dashboards")
    op.drop_index(op.f("ix_dashboards_entity_key"), table_name="dashboards")
    op.drop_table("dashboards")
```

### Updated EntityType Enum

```python
# Source: backend/app/models/v2/enums.py - add new values
class EntityType(str, Enum):
    """Types of schema entities in v2.0 (extended from v1.0)."""

    CATEGORY = "category"
    PROPERTY = "property"
    SUBOBJECT = "subobject"
    MODULE = "module"
    BUNDLE = "bundle"
    TEMPLATE = "template"
    DASHBOARD = "dashboard"  # NEW
    RESOURCE = "resource"    # NEW
```

### Junction Table SQLModel Pattern

```python
# Source: Pattern from backend/app/models/v2/relationships.py (BundleModule)
"""Relationship tables for Dashboard associations."""

import uuid
from sqlmodel import Field, SQLModel


class ModuleDashboard(SQLModel, table=True):
    """Module-to-dashboard relationship.

    Represents: "module X includes dashboard Y"
    """

    __tablename__ = "module_dashboard"

    module_id: uuid.UUID = Field(foreign_key="modules_v2.id", primary_key=True)
    dashboard_id: uuid.UUID = Field(foreign_key="dashboards.id", primary_key=True)


class BundleDashboard(SQLModel, table=True):
    """Bundle-to-dashboard relationship.

    Represents: "bundle X includes dashboard Y"
    """

    __tablename__ = "bundle_dashboard"

    bundle_id: uuid.UUID = Field(foreign_key="bundles.id", primary_key=True)
    dashboard_id: uuid.UUID = Field(foreign_key="dashboards.id", primary_key=True)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No Dashboard/Resource tables | Dedicated tables with canonical_json | v1.1.0 | Enables dashboard/resource management |
| (n/a - new entity types) | Junction tables for module/bundle relationships | v1.1.0 | Tracks which dashboards belong to which modules/bundles |

**Deprecated/outdated:**
- Nothing deprecated for this phase; these are new additions following established patterns.

## Open Questions

Things that couldn't be fully resolved:

1. **EntityType enum in v1.0 vs v2.0**
   - What we know: v1.0 has `entitytype` PostgreSQL enum (category, property, subobject). v2.0 EntityType is Python enum but draft_change stores entity_type as String, not enum FK.
   - What's unclear: Should we add dashboard/resource to v1.0 entitytype or only v2.0 EntityType Python enum?
   - Recommendation: Only update Python EntityType enum (used by draft_change). The v1.0 entitytype PostgreSQL enum is for legacy tables; no need to modify.

2. **Resource entity_key format validation**
   - What we know: CONTEXT.md says format is `Category/Name` (e.g., "Person/John_doe")
   - What's unclear: Should database enforce this format via CHECK constraint or leave to application?
   - Recommendation: No database constraint; application-level validation during ingest. Keeps migration simple.

3. **Dashboard pages JSONB indexing**
   - What we know: Pages stored in canonical_json.pages as array
   - What's unclear: Will there be queries filtering by page name within a dashboard?
   - Recommendation: No special JSONB indexing initially. If performance issues arise, add GIN index later.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/app/models/v2/*.py` - Entity model patterns
- Existing codebase: `backend/alembic/versions/001_full_schema.py` - Migration patterns
- Existing codebase: `backend/app/models/v2/relationships.py` - Junction table patterns
- Phase 24 CONTEXT.md - User decisions constraining implementation

### Secondary (MEDIUM confidence)
- [SQLModel Many-to-Many with Link Tables](https://sqlmodel.tiangolo.com/tutorial/many-to-many/link-with-extra-fields/) - Junction table patterns
- [SQLAlchemy Foreign Key ondelete](https://docs.sqlalchemy.org/en/20/core/constraints.html#on-update-and-on-delete) - CASCADE/RESTRICT behavior
- labki-ontology repo: `dashboards/` and `resources/` directories - Source data structure

### Tertiary (LOW confidence)
- [PostgreSQL JSON vs JSONB](https://www.postgresql.org/docs/current/datatype-json.html) - Type comparison (existing codebase uses JSON, not JSONB)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No changes; using existing libraries
- Architecture: HIGH - Following established codebase patterns exactly
- Pitfalls: HIGH - Common SQLModel/Alembic issues well documented
- EntityType handling: MEDIUM - v1.0 vs v2.0 enum handling needs verification

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (30 days - stable domain, follows existing patterns)
