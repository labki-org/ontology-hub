---
phase: 08-database-foundation
plan: 02
subsystem: database
tags: [sqlmodel, postgresql, materialized-view, recursive-cte, foreign-keys]

# Dependency graph
requires:
  - phase: 08-01
    provides: Entity models (Category, Property, Module, Bundle tables)
provides:
  - Relationship tables for normalized entity connections
  - CategoryParent for category inheritance
  - CategoryProperty for direct property assignments
  - ModuleEntity for module membership
  - BundleModule for bundle composition
  - Materialized view SQL for inherited property computation
affects: [08-03-migration, ingest-service, api-endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite primary keys for many-to-many relationships"
    - "Recursive CTE with cycle prevention for inheritance traversal"
    - "DISTINCT ON for closest-wins property resolution"
    - "Read-only SQLModel for materialized view queries"

key-files:
  created:
    - backend/app/models/v2/relationships.py
    - backend/app/models/v2/category_property_effective.py
  modified:
    - backend/app/models/v2/__init__.py

key-decisions:
  - "Foreign keys reference plural table names (categories.id, not category.id)"
  - "ModuleEntity uses entity_key string instead of FK for polymorphic membership"
  - "CategoryPropertyEffective is read-only model (not table=True) for view queries"

patterns-established:
  - "Relationship tables use composite primary keys for natural uniqueness"
  - "Materialized view SQL stored as constants for migration use"
  - "Async refresh helper for concurrent view updates"

# Metrics
duration: 2min
completed: 2026-01-24
---

# Phase 8 Plan 02: Relationship Tables Summary

**Normalized relationship tables (category_parent, category_property, module_entity, bundle_module) plus recursive CTE materialized view for inherited property computation with source/depth provenance**

## Performance

- **Duration:** 2 min 20s
- **Started:** 2026-01-24T05:28:53Z
- **Completed:** 2026-01-24T05:31:13Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- CategoryParent and CategoryProperty tables for category inheritance and property assignments
- ModuleEntity table tracks entity membership across all 6 entity types via entity_key
- BundleModule table for bundle-to-module composition
- Recursive CTE SQL computes inherited properties with source_category_id and depth
- All 33 exports available from app.models.v2 single import point

## Task Commits

Each task was committed atomically:

1. **Task 1: Create relationship tables** - `a078d29` (feat)
2. **Task 2: Create materialized view definition** - `898a12b` (feat)
3. **Task 3: Update v2 __init__.py with relationship exports** - `8f45699` (feat)

## Files Created/Modified

- `backend/app/models/v2/relationships.py` - CategoryParent, CategoryProperty, ModuleEntity, BundleModule tables
- `backend/app/models/v2/category_property_effective.py` - Materialized view SQL and CategoryPropertyEffective read-only model
- `backend/app/models/v2/__init__.py` - Re-exports all relationship tables and view components

## Decisions Made

- **Foreign keys use plural table names:** The entity models use plural table names (categories, properties, modules, bundles), so FK references must match (categories.id not category.id).
- **ModuleEntity uses entity_key for polymorphism:** Since module membership spans 6 entity types, using a FK would require 6 nullable columns. Using entity_key string with entity_type enum is cleaner.
- **Read-only model for view:** CategoryPropertyEffective is a plain SQLModel (not table=True) since it maps to a view, not a table. This prevents accidental writes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Docker not available for runtime testing:** Used AST parsing to verify model structure instead of runtime imports. Models will be verified during Alembic migration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Relationship tables ready for Alembic migration (08-03)
- Materialized view SQL ready for migration to execute
- Ready for: CREATE TABLE statements and CREATE MATERIALIZED VIEW
- No blockers identified

---
*Phase: 08-database-foundation*
*Completed: 2026-01-24*
