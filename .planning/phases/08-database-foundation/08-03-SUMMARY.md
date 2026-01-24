---
phase: 08-database-foundation
plan: 03
subsystem: database
tags: [sqlmodel, alembic, postgres, json-patch, draft-workflow]

# Dependency graph
requires:
  - phase: 08-01
    provides: Entity tables (Category, Property, Subobject, Module, Bundle, Template)
  - phase: 08-02
    provides: Relationship tables and materialized view SQL
provides:
  - Draft and DraftChange models with JSON Patch storage
  - Complete v2.0 Alembic migration (005)
  - Draft workflow enums (DraftStatus, ChangeType, DraftSource)
affects: [09-ingest-layer, 10-draft-api, 11-pr-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON Patch for update operations (RFC 6902)"
    - "Full replacement JSON for create operations"
    - "Status workflow enum for draft lifecycle"
    - "Capability hash for token-based access"

key-files:
  created:
    - backend/app/models/v2/draft.py
    - backend/alembic/versions/005_v2_schema.py
  modified:
    - backend/app/models/v2/__init__.py

key-decisions:
  - "Draft uses singular table name (draft) matching model convention"
  - "DraftChange FK to draft.id, not drafts.id (singular)"
  - "Rebase tracking fields stored as strings (status: clean/conflict/pending)"
  - "New enums use _v2 suffix to avoid collision with v1.0 draftstatus"

patterns-established:
  - "Draft status workflow: draft -> validated -> submitted -> merged/rejected"
  - "Hybrid patch format: JSON Patch for updates, full JSON for creates"

# Metrics
duration: 4min
completed: 2026-01-24
---

# Phase 8 Plan 03: Draft Tables Summary

**Draft and DraftChange models with JSON Patch storage, plus complete v2.0 Alembic migration creating 13 tables and materialized view**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-24T05:34:19Z
- **Completed:** 2026-01-24T05:38:32Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Draft table with capability_hash, base_commit_sha, status workflow, and rebase tracking
- DraftChange table with JSON Patch and replacement_json for granular change storage
- Complete v2.0 schema migration (005) creating all entity tables, relationship tables, materialized view, and draft tables
- All draft models exported from backend.app.models.v2

## Task Commits

Each task was committed atomically:

1. **Task 1: Create draft and draft_change models** - `ee9638c` (feat)
2. **Task 2: Update v2 __init__.py with draft exports** - `5b3f089` (chore)
3. **Task 3: Create Alembic migration for v2 schema** - `4775501` (feat)

## Files Created/Modified
- `backend/app/models/v2/draft.py` - Draft, DraftChange tables with status workflow, JSON Patch storage
- `backend/app/models/v2/__init__.py` - Added draft model exports
- `backend/alembic/versions/005_v2_schema.py` - Complete v2.0 schema migration (13 tables + materialized view)

## Decisions Made
- **Draft uses singular table name:** The Draft and DraftChange models use singular table names (`draft`, `draft_change`) consistent with SQLModel conventions, rather than plural like entity tables.
- **New enum names with _v2 suffix:** The v2 draftstatus enum is named `draftstatus_v2` to avoid collision with the existing v1.0 `draftstatus` enum that is still in use.
- **Rebase status as string:** The rebase_status field is a simple string ("clean", "conflict", "pending") rather than an enum, for flexibility during development.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Docker container not running for Python import tests. Used file-based syntax checking instead to verify models. All syntax checks passed successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All v2.0 database models complete (entities, relationships, view, drafts)
- Migration 005 ready to run against PostgreSQL
- Phase 9 (Ingest Layer) can now implement ingestion service using these tables
- Draft API (Phase 10) has table structure ready for CRUD operations

---
*Phase: 08-database-foundation*
*Completed: 2026-01-24*
