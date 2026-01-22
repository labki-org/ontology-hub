# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-20)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** Phase 6 - Validation Engine (In Progress)

## Current Position

Phase: 6 of 7 (Validation Engine)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-22 - Completed 06-02-PLAN.md (Breaking Change Detection)

Progress: [#################-] 89%

## Performance Metrics

**Velocity:**
- Total plans completed: 17
- Average duration: 7 min
- Total execution time: 2.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 14 min | 7 min |
| 02-github-integration | 3 | 17 min | 6 min |
| 03-entity-browsing | 4 | 34 min | 9 min |
| 04-modules-and-versioning | 3 | 24 min | 8 min |
| 05-draft-system | 3 | 21 min | 7 min |
| 06-validation-engine | 2 | 10 min | 5 min |

**Recent Trend:**
- Last 5 plans: 9min, 4min, 6min, 11min, 4min
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Port 8080 for backend | 01-01 | Host port 8000 in use |
| UUID primary keys | 01-01 | Security - non-sequential |
| JSONB for flexible fields | 01-01 | Flexible schema storage |
| Soft deletes | 01-01 | Audit trail and recovery |
| Fragment-based capability URLs | 01-02 | Reduce referrer leakage |
| SHA-256 token hashing | 01-02 | Never store plaintext tokens |
| Unified 404 for invalid/expired | 01-02 | Prevent oracle attacks |
| GITHUB_TOKEN optional at startup | 02-01 | Better DX - sync returns 503 with guidance |
| Store full schema_definition | 02-01 | Preserves all data, flexible for future |
| Dev mode webhook bypass | 02-03 | Skip signature verification when secret not set |
| Graceful skip on missing token | 02-03 | Return skipped status instead of error |
| Fresh session in background | 02-03 | Background tasks create own AsyncSession |
| Cursor pagination on entity_id | 02-02 | Consistent ordering for pagination |
| Default limit 20, max 100 | 02-02 | Balance response size with usability |
| TanStack Query 5min stale, 30min gc | 03-01 | Balance freshness with caching for browsing |
| Nested routes with MainLayout | 03-01 | Consistent sidebar across all pages |
| SchemaTable per entity type | 03-01 | Different fields shown based on type |
| Docker volume for node_modules | 03-01 | Faster container restarts |
| ILIKE search on 3 fields | 03-02 | Case-insensitive matching on entity_id, label, description |
| 300ms debounce for search | 03-02 | Balance responsiveness with API call reduction |
| URL-based search state | 03-02 | Enable bookmarking/sharing searches |
| nodeTypes outside component | 03-03 | Prevent React Flow re-render issues |
| Cast JSONB to String for contains | 03-03 | Cross-database compatibility (SQLite/PostgreSQL) |
| TB layout direction | 03-03 | Parents above children in hierarchy |
| Indirect module lookup | 03-04 | Properties/subobjects find modules via categories |
| Collapsible entity sections | 04-01 | Better UX for modules with many entities |
| Compact module card prop | 04-01 | Reuse component with different density levels |
| Edge direction dependency->dependent | 04-02 | Arrow shows "depends on" relationship |
| Neutral overlap styling | 04-02 | Blue/gray info style per CONTEXT.md decision |
| moduleNodeTypes outside component | 04-02 | Prevent React Flow re-render issues |
| github_repo property on Settings | 04-03 | Convenience combining GITHUB_REPO_OWNER and GITHUB_REPO_NAME |
| Default comparison latest vs previous | 04-03 | Most useful comparison per CONTEXT.md |
| 422 for validation errors | 05-01 | FastAPI standard for Pydantic validation |
| Store diff_preview in database | 05-01 | Avoid recomputation on retrieval |
| Pydantic field validators | 05-01 | Ensure non-empty wiki_url/base_version |
| Zustand with immer middleware | 05-02 | Immutable draft state with readable mutable-style syntax |
| Fragment-based capability redirect | 05-02 | /drafts#{token} -> /draft/{token} reduces referrer leakage |
| Only new values editable | 05-02 | Old values read-only as diff reference |
| Categories only for module assignment | 05-03 | Properties/subobjects inherit via parent categories |
| Explicit vs auto-included module display | 05-03 | Visual distinction with badges and icons |
| PATCH merges updates, recomputes diff | 05-03 | Partial update support for draft editing |
| Breaking changes are warnings not errors | 06-02 | Valid changes, just impactful |
| Cardinality relaxation is backward compatible | 06-02 | Single->multiple is MINOR |
| Semver max severity aggregation | 06-02 | major > minor > patch |

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-22
Stopped at: Completed 06-02-PLAN.md (Breaking Change Detection)
Resume file: None

06-02 SUMMARY context:
- Breaking change detection comparing draft to canonical
- Semver classification with MAJOR/MINOR/PATCH code sets
- Aggregate semver suggestion using max severity
- Validator now runs all 5 checks: refs, inheritance, datatypes, breaking, semver
- ValidationResult includes old_value/new_value for context

## Phase 6 Progress

Phase 6 (Validation Engine) In Progress:
- 06-01: Core Validation (COMPLETE)
- 06-02: Breaking Change Detection (COMPLETE)
- 06-03: Validation UI Integration (pending)

VALD-01 satisfied: Reference existence checks
VALD-02 satisfied: Circular inheritance detection
VALD-03 satisfied: Datatype validation
VALD-04 satisfied: Breaking change detection
VALD-05 satisfied: Semver classification with aggregate suggestion

## Phase 5 Progress

Phase 5 (Draft System) COMPLETE:
- 05-01: Draft Payload and Diff Preview (COMPLETE)
- 05-02: Draft Review UI (COMPLETE)
- 05-03: Draft Submission Flow (COMPLETE)

DRFT-01 satisfied: Draft API accepts wiki_url, base_version, entities payload
DRFT-02 satisfied: Draft creation returns capability_url and diff_preview
DRFT-03 satisfied: Draft review page accessible via capability URL
DRFT-04 satisfied: Inline editing with unsaved changes tracking
DRFT-05 satisfied: Module assignment with dependency feedback
DRFT-06 satisfied: Profile editing with module list management
DRFT-07 satisfied: Save functionality via PATCH endpoint
