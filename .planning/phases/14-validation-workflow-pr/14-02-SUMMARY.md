---
phase: 14-validation-workflow-pr
plan: 02
subsystem: api
tags: [draft-workflow, state-machine, validation, sqlmodel, async]

# Dependency graph
requires:
  - phase: 11-draft-system
    provides: Draft and DraftChange models with status field
provides:
  - Draft workflow service with auto-revert and status transition validation
  - Row-level locking for concurrent draft modifications
affects: [14-03, 14-04, 14-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [state-machine-validation, row-level-locking, auto-revert-workflow]

key-files:
  created:
    - backend/app/services/draft_workflow.py
  modified:
    - backend/app/routers/draft_changes.py

key-decisions:
  - "Auto-revert VALIDATED → DRAFT when changes are added/removed"
  - "Use SELECT FOR UPDATE for row-level locking to prevent race conditions"
  - "Centralize status transition validation in draft_workflow service"

patterns-established:
  - "Workflow state machine: VALID_TRANSITIONS dict controls allowed status changes"
  - "Auto-revert pattern: Editing after validation invalidates validation automatically"
  - "Row-level locking: get_draft_for_update prevents concurrent status modification races"

# Metrics
duration: 2min
completed: 2026-01-24
---

# Phase 14 Plan 02: Auto-Revert Workflow Summary

**Draft workflow state machine with auto-revert behavior: editing VALIDATED drafts reverts status to DRAFT and clears validated_at timestamp**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-25T00:02:45Z
- **Completed:** 2026-01-25T00:04:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created draft_workflow.py service with workflow state machine logic
- Implemented auto-revert behavior: adding/removing changes to VALIDATED drafts auto-reverts to DRAFT
- Added row-level locking (SELECT FOR UPDATE) to prevent race conditions
- Centralized status transition validation with VALID_TRANSITIONS map

## Task Commits

Each task was committed atomically:

1. **Task 1: Create draft_workflow.py service** - `b87022f` (feat)
2. **Task 2: Update draft_changes.py with auto-revert** - `1aed74e` (feat)

## Files Created/Modified
- `backend/app/services/draft_workflow.py` - Draft workflow state machine with auto_revert_if_validated, validate_status_transition, and transition helpers
- `backend/app/routers/draft_changes.py` - Updated add/remove change endpoints to call auto_revert_if_validated for VALIDATED drafts

## Decisions Made

**1. Auto-revert VALIDATED → DRAFT on any change**
- Rationale: Per CONTEXT.md workflow, validation results must stay current. If user edits after validation, status must revert to ensure validation is re-run before submission.

**2. Row-level locking via SELECT FOR UPDATE**
- Rationale: Prevents race conditions when multiple requests try to modify draft status concurrently (e.g., simultaneous validation and change addition).

**3. Centralized status transition validation**
- Rationale: VALID_TRANSITIONS state machine in one place prevents inconsistent status changes across different endpoints.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Draft workflow service ready for validation endpoint (14-03) to use transition_to_validated
- PR builder endpoint (14-04) can use transition_to_submitted
- Auto-revert ensures validation state is always accurate
- Row-level locking prevents status transition races

---
*Phase: 14-validation-workflow-pr*
*Completed: 2026-01-24*
