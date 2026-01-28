---
phase: 25-backend-ingest-pipeline
plan: 02
subsystem: api
tags: [ingest, dashboard, resource, relationships, github-webhook]

# Dependency graph
requires:
  - phase: 24-database-schema
    provides: Dashboard, Resource, ModuleDashboard, BundleDashboard tables
  - phase: 25-backend-ingest-pipeline/01
    provides: EntityParser with parse_dashboard, parse_resource methods
provides:
  - github.py ENTITY_DIRECTORIES includes dashboards and resources
  - ingest.py ENTITY_DIRECTORIES with schema paths for validation
  - Nested path handling for resources (like templates)
  - delete_all_canonical removes dashboard/resource tables
  - insert_entities adds dashboards and resources
  - resolve_and_insert_relationships handles module_dashboard and bundle_dashboard
affects: [26-backend-crud-endpoints, webhook-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dashboard lookup table for relationship resolution
    - Nested directory support for resource entity files

key-files:
  created: []
  modified:
    - backend/app/services/github.py
    - backend/app/services/ingest.py

key-decisions:
  - "Resources use nested paths like templates (resources/Category/key.json)"
  - "Dashboard relationships resolved via lookup table pattern matching existing entities"

patterns-established:
  - "Nested path handling: templates and resources allow nested directory structure"
  - "Entity lookup for relationships: build entity_key -> UUID dict before resolving relationships"

# Metrics
duration: 3min
completed: 2026-01-28
---

# Phase 25 Plan 02: Ingest Service Summary

**Updated github.py and ingest.py to load, delete, insert, and wire Dashboard/Resource entities with module/bundle relationships**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-28T08:33:34Z
- **Completed:** 2026-01-28T08:36:13Z
- **Tasks:** 7
- **Files modified:** 2

## Accomplishments

- GitHub tree filtering now includes dashboards and resources directories
- Ingest service loads nested resource files (like templates)
- Delete/insert operations handle Dashboard and Resource entities
- Module and bundle dashboard relationships resolved and inserted

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ENTITY_DIRECTORIES in github.py** - `7c52175` (feat)
2. **Task 2: Update ENTITY_DIRECTORIES in ingest.py** - `03e2f09` (feat)
3. **Task 3: Update load_entity_files nested paths** - `3a399f0` (feat)
4. **Task 4: Add Dashboard, Resource, junction imports** - `92c3a2b` (feat)
5. **Task 5: Update delete_all_canonical** - `210f4c4` (feat)
6. **Task 6: Update insert_entities** - `1fa7ece` (feat)
7. **Task 7: Update resolve_and_insert_relationships** - `fc91c49` (feat)

## Files Created/Modified

- `backend/app/services/github.py` - ENTITY_DIRECTORIES frozenset updated with dashboards, resources
- `backend/app/services/ingest.py` - ENTITY_DIRECTORIES dict, imports, delete/insert/resolve methods updated

## Decisions Made

None - followed plan as specified

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ingest pipeline complete for Dashboard and Resource entities
- Ready for Phase 26 CRUD endpoints when parsers fully tested
- module_dashboard and bundle_dashboard relationships will be wired on next webhook sync

---
*Phase: 25-backend-ingest-pipeline*
*Completed: 2026-01-28*
