---
phase: 23-ontology-schema-updates
plan: 01
subsystem: schema
tags: [json-schema, validation, dashboard, resource, ontology]

# Dependency graph
requires:
  - phase: none (first milestone of v1.1.0)
    provides: existing labki-ontology validation infrastructure
provides:
  - Dashboard and resource entity indexing in validation pipeline
  - Dashboard page name pattern validation
  - Property Allows_value_from_category field for category-based allowed values
affects: [24-backend-schema-integration, 25-frontend-entity-support, ontology-hub-backend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern validation using regex alternation for optional patterns"
    - "Mutual exclusivity via JSON Schema 'not' constraint"

key-files:
  created: []
  modified:
    - scripts/lib/entity-index.js
    - dashboards/_schema.json
    - dashboards/Core_overview.json
    - properties/_schema.json

key-decisions:
  - "Page name pattern uses alternation ^$|^[A-Z][a-z]*(_[a-z]+)*$ to allow empty OR category ID"
  - "Allows_value_from_category uses 'not' constraint rather than conditional schema for mutual exclusivity"

patterns-established:
  - "Alternation pattern for optional validation: ^$|^pattern$ allows empty or matching values"
  - "Mutual exclusivity via not:{required:[fieldA,fieldB]} prevents both fields from being present"

# Metrics
duration: 8min
completed: 2026-01-27
---

# Phase 23 Plan 01: Ontology Schema Updates Summary

**Dashboard/resource entity validation with page name patterns and Allows_value_from_category property field**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-27T22:45:00Z
- **Completed:** 2026-01-27T22:53:00Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- Fixed validation crash when processing dashboard/resource entities
- Added page name pattern validation to dashboard schema (empty string or Capital_word format)
- Added Allows_value_from_category field to properties schema with mutual exclusivity constraint
- All 17 entities now validate successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix entity-index.js** - `cd62440` (fix)
2. **Task 2: Dashboard page name pattern** - `3726ef0` (feat)
3. **Task 3: Allows_value_from_category** - `98c56b4` (feat)
4. **Task 4: Full validation** - No changes needed (verification only)

## Files Created/Modified
- `scripts/lib/entity-index.js` - Added dashboards and resources Maps to entity index
- `dashboards/_schema.json` - Added page name pattern validation
- `dashboards/Core_overview.json` - Fixed page name "setup" to "Setup"
- `properties/_schema.json` - Added Allows_value_from_category with mutual exclusivity

## Decisions Made
- Page name pattern uses alternation `^$|^[A-Z][a-z]*(_[a-z]+)*$` to allow empty string (root page) OR category ID format
- Mutual exclusivity for Allows_value_from_category/allowed_values uses JSON Schema `not` constraint rather than conditional schema - simpler and more explicit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Ontology validation pipeline now supports all 8 entity types
- Dashboard and resource schemas ready for backend integration in Phase 24
- Properties schema ready to support category-based allowed values

---
*Phase: 23-ontology-schema-updates*
*Completed: 2026-01-27*
