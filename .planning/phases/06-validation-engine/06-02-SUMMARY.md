---
phase: 06-validation-engine
plan: 02
subsystem: api
tags: [validation, semver, breaking-changes, python, pydantic]

# Dependency graph
requires:
  - phase: 06-validation-engine
    plan: 01
    provides: Validation schemas, reference and inheritance checks
  - phase: 05-draft-system
    provides: Draft models, payload structure
provides:
  - Breaking change detection comparing draft to canonical
  - Semver classification (major/minor/patch)
  - Aggregate semver suggestion with reasons
  - Full validation pipeline with 5 checks
affects: [06-03-ui-integration, 07-pr-submission]

# Tech tracking
tech-stack:
  added: []
  patterns: [change detection by comparing old/new, semver aggregation max-severity]

key-files:
  created:
    - backend/app/services/validation/breaking.py
    - backend/app/services/validation/semver.py
  modified:
    - backend/app/services/validation/validator.py
    - backend/app/services/validation/__init__.py

key-decisions:
  - "Breaking changes are warnings not errors - valid changes, just impactful"
  - "Cardinality relaxation single->multiple is backward compatible (MINOR)"
  - "Only analyze entities in draft - partial drafts don't trigger false removal warnings"
  - "Semver uses max severity aggregation (major > minor > patch)"
  - "Property removal from category is breaking (existing instances may have property)"

patterns-established:
  - "Change detection: fetch canonical, build draft map, compare field-by-field"
  - "Semver aggregation: collect reasons by severity, return highest"
  - "ValidationResult with suggested_semver and old_value/new_value for context"

# Metrics
duration: 4min
completed: 2026-01-22
---

# Phase 6 Plan 2: Breaking Change Detection Summary

**Semver-aware breaking change detection with datatype changes, cardinality restrictions, and property additions/removals classified as MAJOR/MINOR/PATCH**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-22T21:48:50Z
- **Completed:** 2026-01-22T21:52:22Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Breaking change detection identifies datatype changes, cardinality changes, property additions/removals
- Semver classification with MAJOR/MINOR/PATCH code sets and max-severity aggregation
- Full validation pipeline now runs 5 checks: references, inheritance, datatypes, breaking changes, semver
- ValidationResult includes old_value/new_value context for clear user feedback

## Task Commits

Each task was committed atomically:

1. **Task 1: Create breaking change detection module** - `6b6192d` (feat)
2. **Task 2: Create semver classification module** - `2b541fb` (feat)
3. **Task 3: Integrate breaking changes into validator** - `4e60065` (feat)

## Files Created/Modified
- `backend/app/services/validation/breaking.py` - Breaking change detection comparing draft to canonical
- `backend/app/services/validation/semver.py` - Semver classification and aggregation logic
- `backend/app/services/validation/validator.py` - Updated to run all 5 validation checks
- `backend/app/services/validation/__init__.py` - Export new functions

## Decisions Made
- Breaking changes are warnings (not errors) because they're valid changes, just impactful
- Only analyze entities actually present in the draft (partial drafts don't trigger false "removed" warnings)
- Cardinality relaxation (single -> multiple) is considered backward compatible (MINOR)
- Property removal from category is breaking because existing instances may have that property
- Semver suggestion returns "patch" with reason when validation errors exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - Plan 06-01 had already created the validation directory, schemas, and reference/inheritance modules. This plan extended the existing structure as designed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Validation engine complete with all 5 checks
- Ready for UI integration (Plan 06-03) to display validation results inline
- Breaking change warnings include semver suggestions for PR description

---
*Phase: 06-validation-engine*
*Completed: 2026-01-22*
