---
phase: 09-ingest-pipeline
plan: 04
subsystem: api
tags: [webhook, github, ingest, draft-staleness, fastapi, background-task]

# Dependency graph
requires:
  - phase: 09-03
    provides: IngestService class and sync_repository_v2() function
  - phase: 08-03
    provides: Draft model with rebase_status field
provides:
  - Webhook endpoint triggers v2.0 ingest on push events
  - Draft staleness marking when canonical data changes
  - Complete ingest pipeline from GitHub to database
affects: [10-draft-api, 11-pr-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [background-task-with-draft-staleness, webhook-to-ingest-pipeline]

key-files:
  modified:
    - backend/app/routers/webhooks.py
    - backend/app/services/github.py

key-decisions:
  - "Keep v1.0 trigger_sync_background for backward compatibility"
  - "Mark drafts stale only for DRAFT and VALIDATED statuses (not SUBMITTED/MERGED/REJECTED)"

patterns-established:
  - "Draft staleness: update rebase_status='stale' when base_commit_sha changes"
  - "v2.0 ingest via trigger_sync_background_v2 -> sync_repository_v2"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 9 Plan 4: Webhook Wiring Summary

**Webhook endpoint wired to v2.0 ingest with automatic draft staleness marking when canonical data changes**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-24T06:50:58Z
- **Completed:** 2026-01-24T06:53:39Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Updated ENTITY_DIRECTORIES to include all 6 v2.0 entity types (bundles, templates)
- Added trigger_sync_background_v2() to webhook for v2.0 ingest pipeline
- Implemented mark_drafts_stale() to detect and mark stale drafts when canonical changes
- Complete end-to-end ingest chain: webhook -> ingest_v2 -> validators -> parsers -> models

## Task Commits

Each task was committed atomically:

1. **Task 1: Update ENTITY_DIRECTORIES in github.py** - `a01e21b` (chore)
2. **Task 2: Add v2.0 background task and draft staleness** - `e0bf80d` (feat)
3. **Task 3: Verify end-to-end import chain** - verification only, no commit needed

## Files Created/Modified
- `backend/app/services/github.py` - Updated ENTITY_DIRECTORIES to v2.0 types (bundles, templates replacing profiles)
- `backend/app/routers/webhooks.py` - Added trigger_sync_background_v2, mark_drafts_stale, updated endpoint to call v2.0

## Decisions Made
- Kept v1.0 trigger_sync_background() for backward compatibility rather than removing it
- Draft staleness only applies to DRAFT and VALIDATED statuses - SUBMITTED/MERGED/REJECTED are terminal states
- Staleness marking happens after successful ingest, not before, to avoid marking stale if ingest fails

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Python virtual environment not available for direct import testing
- Used AST parsing and grep verification instead of runtime imports
- All verification passed via static analysis

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v2.0 ingest pipeline complete and wired to webhook
- Phase 9 (Ingest Pipeline) now complete with all 4 plans done
- Ready for Phase 10 (Draft API) to build on canonical data and draft staleness
- Blockers: None

---
*Phase: 09-ingest-pipeline*
*Completed: 2026-01-24*
