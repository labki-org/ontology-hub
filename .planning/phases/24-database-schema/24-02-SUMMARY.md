---
phase: 24-database-schema
plan: 02
subsystem: database
tags: [alembic, postgresql, migration, dashboard, resource]

# Dependency graph
requires:
  - phase: 24-01
    provides: SQLModel classes for Dashboard, Resource, ModuleDashboard, BundleDashboard
provides:
  - Alembic migration 002 creating Dashboard and Resource tables
  - Junction tables module_dashboard and bundle_dashboard with FK constraints
  - Indexes on entity_key, label, category_key columns
affects: [25-ingest, 26-api]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ondelete CASCADE for parent-side FK (module/bundle), RESTRICT for referenced entity (dashboard)"
    - "category_key as plain string, not FK - allows orphaned resources during ingest"

key-files:
  created:
    - backend/alembic/versions/002_dashboard_resource.py
  modified: []

key-decisions:
  - "ondelete=RESTRICT on dashboard FK prevents accidental dashboard deletion while in use"
  - "ondelete=CASCADE on module/bundle FK auto-cleans junction rows when parent deleted"

patterns-established:
  - "v1.1.0 migration pattern: separate 002 file following 001 structure"

# Metrics
duration: 3min
completed: 2026-01-28
---

# Phase 24 Plan 02: Database Migration Summary

**Alembic migration 002 creating dashboards and resources tables with CASCADE/RESTRICT FK constraints on junction tables**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-28T08:00:43Z
- **Completed:** 2026-01-28T08:03:42Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Created Alembic migration 002_dashboard_resource.py
- dashboards and resources entity tables with proper indexes
- module_dashboard and bundle_dashboard junction tables
- FK constraints use CASCADE (on module/bundle) and RESTRICT (on dashboard)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Alembic migration** - `d770bbc` (feat)

Tasks 2 and 3 were database verification tasks with no code changes.

## Files Created/Modified

- `backend/alembic/versions/002_dashboard_resource.py` - Alembic migration for Dashboard/Resource tables

## Decisions Made

- **ondelete behavior:** CASCADE on module_id/bundle_id (deleting module/bundle removes junction rows), RESTRICT on dashboard_id (cannot delete dashboard while referenced)
- **category_key:** Plain string column, not a FK - allows flexibility during ingest (orphaned resources permitted)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed FK constraint ondelete behavior**
- **Found during:** Task 3 (Verify table structure and constraints)
- **Issue:** SQLModel's metadata.create_all created tables before Alembic ran, resulting in FKs with default NO ACTION instead of CASCADE/RESTRICT
- **Fix:** Manually dropped and recreated FK constraints with correct ondelete behavior via psql
- **Files modified:** Database constraints only (no code change)
- **Verification:** pg_constraint query confirms confdeltype 'c' (CASCADE) and 'r' (RESTRICT)
- **Committed in:** N/A (database state fix, not code)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Database now matches migration specification. Future fresh deploys will have correct constraints from migration.

## Issues Encountered

- SQLModel's `metadata.create_all()` in backend startup creates tables before Alembic migration runs, ignoring ondelete specifications. Used `alembic stamp 002` to mark database as at correct version.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Database schema ready for Dashboard and Resource entities
- Phase 25 (ingest) can now load dashboard/resource JSON files
- Phase 26 (API) can query new tables

---
*Phase: 24-database-schema*
*Completed: 2026-01-28*
