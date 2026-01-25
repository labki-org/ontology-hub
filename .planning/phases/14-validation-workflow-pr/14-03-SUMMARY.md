---
phase: 14-validation-workflow-pr
plan: 03
subsystem: api
tags: [fastapi, validation, draft-workflow, http-api]

# Dependency graph
requires:
  - phase: 14-01
    provides: validate_draft_v2 service and DraftValidationReportV2 schema
  - phase: 14-02
    provides: transition_to_validated workflow function
provides:
  - POST /api/v2/drafts/{token}/validate endpoint with structured validation feedback
  - Auto-transition to VALIDATED status on successful validation
  - Rebase conflict warning injection in validation reports
affects: [14-04, 14-05, 14-06, frontend-validation-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [validation-endpoint-pattern, status-transition-on-validation]

key-files:
  created: []
  modified: [backend/app/routers/drafts_v2.py]

key-decisions:
  - "Validation endpoint returns full report even when validation fails (transparency)"
  - "Terminal status drafts (SUBMITTED/MERGED/REJECTED) cannot be re-validated (400 error)"
  - "Rebase conflicts add warning to report without blocking validation"
  - "Rate limit matches draft_read (100/minute) for consistency"

patterns-established:
  - "Validation pattern: validate, check errors, transition if valid, return report"
  - "Rebase conflict handling: inject warning into report.warnings for user awareness"

# Metrics
duration: 1min
completed: 2026-01-24
---

# Phase 14 Plan 3: Validation Endpoint Summary

**POST /api/v2/drafts/{token}/validate endpoint enables users to trigger validation and get structured feedback with auto-transition to VALIDATED on success**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-25T00:09:46Z
- **Completed:** 2026-01-25T00:11:22Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- POST /api/v2/drafts/{token}/validate endpoint added to drafts_v2 router
- Validation runs all checks: references, circular inheritance, breaking changes, JSON Schema, semver
- Auto-transitions draft to VALIDATED status when validation passes (no errors)
- Adds warning to report when draft has rebase_status="conflict"

## Task Commits

Each task was committed atomically:

1. **Task 1: Add validate endpoint to drafts_v2.py** - `c2074fb` (feat)

## Files Created/Modified
- `backend/app/routers/drafts_v2.py` - Added validate_draft endpoint with full validation pipeline and status transition

## Decisions Made
- Validation endpoint returns full report even when validation fails (transparency for users)
- Terminal status drafts (SUBMITTED/MERGED/REJECTED) cannot be re-validated (returns 400 error)
- Rebase conflicts add warning to report without blocking validation (user informed but can proceed)
- Rate limit matches draft_read (100/minute) for consistency across draft operations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Validation endpoint ready for frontend integration
- Frontend can display DraftValidationReportV2 with entity_key references for navigation
- Ready for PR creation workflow (14-04) which will use validation as prerequisite
- Rebase conflict handling provides user awareness before submission

---
*Phase: 14-validation-workflow-pr*
*Completed: 2026-01-24*
