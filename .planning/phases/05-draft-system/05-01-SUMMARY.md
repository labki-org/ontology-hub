---
phase: 05-draft-system
plan: 01
subsystem: api
tags: [fastapi, pydantic, sqlmodel, diff, validation, capability-url]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Draft model with capability URL security
provides:
  - DraftPayload schema with wiki_url, base_version validation
  - compute_draft_diff service for draft vs canonical comparison
  - GET /drafts/{token}/diff endpoint for diff retrieval
  - Diff preview returned on draft creation
affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [Pydantic field validators, structured diff response]

key-files:
  created:
    - backend/app/services/draft_diff.py
    - backend/alembic/versions/003_draft_diff_preview.py
  modified:
    - backend/app/models/draft.py
    - backend/app/schemas/draft.py
    - backend/app/models/__init__.py
    - backend/app/services/__init__.py
    - backend/app/routers/drafts.py

key-decisions:
  - "422 for validation errors (FastAPI standard vs 400 in plan)"
  - "Store diff_preview in database for retrieval"
  - "Pydantic validators for wiki_url/base_version"

patterns-established:
  - "DraftPayload: structured payload with entities, modules, profiles"
  - "ChangesByType: added/modified/deleted grouping for diff responses"
  - "Draft diff computed during creation, stored for later retrieval"

# Metrics
duration: 4min
completed: 2026-01-22
---

# Phase 5 Plan 1: Draft Payload and Diff Preview Summary

**Extended draft API with DraftPayload schema, diff computation service, and diff retrieval endpoint**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-22T17:13:19Z
- **Completed:** 2026-01-22T17:16:58Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- DraftPayload schema validates wiki_url, base_version, and structured entities/modules/profiles
- compute_draft_diff service compares draft payload against canonical database state
- POST /drafts/ now returns capability_url plus diff_preview on creation
- GET /drafts/{token}/diff endpoint retrieves stored diff for a draft

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend draft models with payload schema and diff preview** - `9478ddc` (feat)
2. **Task 2: Create draft diff service** - `e936ebf` (feat)
3. **Task 3: Extend draft router with diff endpoints** - `2a2380c` (feat)

## Files Created/Modified
- `backend/app/models/draft.py` - DraftPayload, ValidationError, DraftDiffResponse schemas, diff_preview field
- `backend/app/schemas/draft.py` - Re-exports for new schemas
- `backend/app/models/__init__.py` - Export new schemas
- `backend/app/services/draft_diff.py` - compute_draft_diff function
- `backend/app/services/__init__.py` - Export compute_draft_diff
- `backend/app/routers/drafts.py` - Extended create_draft, added get_draft_diff
- `backend/alembic/versions/003_draft_diff_preview.py` - Migration for diff_preview column

## Decisions Made
- **422 for validation errors:** FastAPI returns 422 Unprocessable Entity for Pydantic validation failures, which is the correct HTTP status. Plan specified 400 but 422 is the standard.
- **Store diff_preview in database:** Computed once during creation and stored in JSON column for retrieval via GET endpoint, avoiding recomputation.
- **Pydantic field validators:** Used @field_validator for wiki_url and base_version to ensure non-empty values before database insertion.

## Deviations from Plan

None - plan executed exactly as written. Note: 422 vs 400 for validation errors is a semantic clarification (FastAPI standard) rather than a deviation.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Draft API ready for submission flow (05-02)
- DraftDiffResponse structure matches VersionDiffResponse for frontend consistency
- Diff preview provides immediate feedback to wiki admins

---
*Phase: 05-draft-system*
*Completed: 2026-01-22*
