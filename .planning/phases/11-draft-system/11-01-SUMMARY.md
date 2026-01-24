---
phase: 11-draft-system
plan: 01
subsystem: api
tags: [fastapi, capability-url, draft, rate-limiting, pydantic]

# Dependency graph
requires:
  - phase: 08-database-foundation
    provides: Draft and DraftChange models, DraftStatus/DraftSource enums
  - phase: 09-ingest-pipeline
    provides: OntologyVersion with commit_sha for base binding
provides:
  - v2.0 draft CRUD API endpoints (POST, GET, PATCH)
  - Pydantic schemas for draft request/response contracts
  - Status transition validation (DRAFT->VALIDATED->SUBMITTED->MERGED/REJECTED)
affects: [11-02, 12-pr-generation, 13-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "capability URL with token in fragment (#) for referrer leakage protection"
    - "draft_to_response helper for model-to-schema conversion with computed fields"
    - "VALID_TRANSITIONS dict for status machine validation"

key-files:
  created:
    - backend/app/schemas/draft_v2.py
    - backend/app/routers/drafts_v2.py
  modified:
    - backend/app/routers/__init__.py
    - backend/app/main.py

key-decisions:
  - "Separate Pydantic schemas from SQLModel models for API contract decoupling"
  - "503 error when no OntologyVersion exists (graceful handling of empty database)"
  - "VALIDATED->DRAFT transition allowed for rework scenarios"

patterns-established:
  - "draft_to_response: Convert model to response with computed change_count field"
  - "get_draft_by_token: Reusable token validation returning Draft or 404"
  - "VALID_TRANSITIONS dict: Status machine transitions in one place"

# Metrics
duration: 4min
completed: 2026-01-24
---

# Phase 11 Plan 01: v2.0 Draft CRUD Endpoints Summary

**Capability URL draft API with status lifecycle, base_commit_sha binding, and rate limiting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-24T17:10:00Z
- **Completed:** 2026-01-24T17:14:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- DraftCreate/DraftResponse/DraftCreateResponse/DraftStatusUpdate schemas for API contracts
- POST /api/v2/drafts creates draft with capability_url shown once, bound to current OntologyVersion
- GET /api/v2/drafts/{token} retrieves draft with change_count computed field
- PATCH /api/v2/drafts/{token} updates status with valid transition enforcement
- Rate limiting applied (20/hour create, 100/minute read/update)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create v2 draft schemas** - `c4419c4` (feat)
2. **Task 2: Create v2 draft router with CRUD endpoints** - `10a4a40` (feat)

## Files Created/Modified
- `backend/app/schemas/draft_v2.py` - Pydantic schemas for draft API request/response
- `backend/app/routers/drafts_v2.py` - v2.0 draft CRUD endpoints with capability URL security
- `backend/app/routers/__init__.py` - Export drafts_v2_router
- `backend/app/main.py` - Register drafts_v2_router under /api/v2 prefix

## Decisions Made
- Separated Pydantic schemas from SQLModel models to decouple API contracts from database schema
- Return 503 when no OntologyVersion exists (happens before first ingest) rather than creating orphan drafts
- Allow VALIDATED->DRAFT transition to support rework scenarios after validation

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Docker environment not running, verification commands used syntax checking instead of runtime import verification

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Draft creation endpoint ready for use
- Plan 11-02 can add draft change management endpoints (add/remove changes from draft)
- Need OntologyVersion to exist before drafts can be created

---
*Phase: 11-draft-system*
*Completed: 2026-01-24*
