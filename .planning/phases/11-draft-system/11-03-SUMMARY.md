---
phase: 11-draft-system
plan: 03
subsystem: api
tags: [jsonpatch, rebase, conflict-detection, webhook]

# Dependency graph
requires:
  - phase: 11-01
    provides: Draft model with rebase_status and rebase_commit_sha fields
  - phase: 11-02
    provides: DraftChange model with patch operations
  - phase: 09-04
    provides: Webhook ingest flow in trigger_sync_background_v2
provides:
  - Auto-rebase service with conflict detection
  - Webhook integration for post-ingest rebase
affects: [12-validation-export, draft-management-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [try-apply conflict detection via jsonpatch]

key-files:
  created:
    - backend/app/services/draft_rebase.py
  modified:
    - backend/app/routers/webhooks.py

key-decisions:
  - "Original draft_change rows never modified during rebase - preserves user patches for manual resolution"
  - "Deprecate mark_drafts_stale but keep for backward compatibility"

patterns-established:
  - "Try-apply pattern: deepcopy canonical, apply patch, catch JsonPatchConflict"
  - "ENTITY_MODELS map for entity_type string to model class lookup"

# Metrics
duration: 2min
completed: 2026-01-24
---

# Phase 11 Plan 03: Auto-Rebase Service Summary

**Auto-rebase service that tests JSON Patch applicability against new canonical and marks drafts as clean/conflict**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-24T17:14:39Z
- **Completed:** 2026-01-24T17:16:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created draft_rebase.py service with auto_rebase_drafts() for post-ingest conflict detection
- Implemented check_patch_applies() using jsonpatch try-apply pattern with JsonPatchConflict handling
- Integrated auto-rebase into webhook flow, replacing mark_drafts_stale

## Task Commits

Each task was committed atomically:

1. **Task 1: Create draft rebase service** - `985e219` (feat)
2. **Task 2: Integrate rebase into webhook flow** - `741f3b0` (feat)

## Files Created/Modified
- `backend/app/services/draft_rebase.py` - Auto-rebase service with conflict detection
- `backend/app/routers/webhooks.py` - Updated to call auto_rebase_drafts after ingest

## Decisions Made
- Original draft_change.patch rows are never modified during rebase - preserves user patches for manual conflict resolution
- Deprecated mark_drafts_stale() but kept for backward compatibility (may be needed for v1.0 flows)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - Docker environment unavailable for import verification, used Python AST parser for syntax validation instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Draft rebase service complete and integrated with webhook flow
- Ready for phase 12 (validation/export) which will validate draft changes before submission
- Conflict resolution UI can query rebase_status to show conflicts to users

---
*Phase: 11-draft-system*
*Completed: 2026-01-24*
