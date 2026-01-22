# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-20)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** Phase 4 - Modules and Versioning

## Current Position

Phase: 4 of 7 (Modules and Versioning)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-22 - Completed 04-02-PLAN.md (Dependency Visualization and Overlap Detection)

Progress: [###########-------] 61%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 7 min
- Total execution time: 1.33 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 14 min | 7 min |
| 02-github-integration | 3 | 17 min | 6 min |
| 03-entity-browsing | 4 | 34 min | 9 min |
| 04-modules-and-versioning | 2 | 15 min | 8 min |

**Recent Trend:**
- Last 5 plans: 8min, 10min, 4min, 8min, 7min
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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-22
Stopped at: Completed 04-02-PLAN.md (Dependency Visualization and Overlap Detection)
Resume file: None

04-02 SUMMARY context:
- GET /modules/{id}/overlaps endpoint for entity overlap detection
- DependencyGraph component with React Flow for module dependencies
- ModuleNode with Package icon, entity count, clickable navigation
- OverlapIndicator shows "also in: X, Y" with neutral blue/gray styling
- ModuleEntityList accepts overlaps prop
- ProfilePage shows Module Dependencies graph when hasDependencies
- Circular dependency detection and warning badge

## Phase 4 Progress

Phase 4 (Modules and Versioning) in progress:
- 04-01: Module and Profile browsing (COMPLETE)
- 04-02: Dependency visualization and overlap detection (COMPLETE)
- 04-03: Module/profile filtering (pending)

MODL-01 satisfied: User can browse modules with included entities and dependencies
MODL-02 satisfied: User can browse profiles with module composition
MODL-03 satisfied: User can view module dependency visualization
MODL-04 satisfied: Module pages show overlap info when entities appear in multiple modules
