# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-20)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** Phase 3 - Entity Browsing

## Current Position

Phase: 3 of 7 (Entity Browsing)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-22 - Completed 03-02-PLAN.md (Entity Search)

Progress: [#######-----------] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 7 min
- Total execution time: 0.85 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 14 min | 7 min |
| 02-github-integration | 3 | 17 min | 6 min |
| 03-entity-browsing | 2 | 20 min | 10 min |

**Recent Trend:**
- Last 5 plans: 5min, 8min, 4min, 12min, 8min
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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-22
Stopped at: Completed 03-02-PLAN.md (Entity Search)
Resume file: None

03-02 SUMMARY context:
- Backend search endpoint with ILIKE on entity_id, label, description
- Frontend useDebounce hook (300ms delay)
- SearchInput component in sidebar for global access
- SearchPage with type filter dropdown
- 12 new search tests
- API hook: useSearch(query, entityType?, limit?)
