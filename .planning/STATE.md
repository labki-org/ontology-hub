# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-01-20)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** Phase 3 - Entity Browsing (COMPLETE with gap closure)

## Current Position

Phase: 3 of 7 (Entity Browsing)
Plan: 4 of 4 in current phase (gap closure plan)
Status: Phase complete (including gap closure)
Last activity: 2026-01-22 - Completed 03-04-PLAN.md (Module Membership)

Progress: [#########---------] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 7 min
- Total execution time: 1.09 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 14 min | 7 min |
| 02-github-integration | 3 | 17 min | 6 min |
| 03-entity-browsing | 4 | 34 min | 9 min |

**Recent Trend:**
- Last 5 plans: 4min, 12min, 8min, 10min, 4min
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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-22
Stopped at: Completed 03-04-PLAN.md (Module Membership)
Resume file: None

03-04 SUMMARY context:
- GET /entities/{type}/{id}/modules returns modules containing entity
- Categories: direct lookup in module.category_ids
- Properties/subobjects: indirect via used-by categories
- useEntityModules hook in entities.ts
- EntityDetail displays module badges
- EntityDetail receives entityType prop
- Query key: ['entity-modules', entityType, entityId]

## Phase 3 Complete

Phase 3 (Entity Browsing) is now complete with all 4 plans executed:
- 03-01: Frontend scaffolding, entity pages, sidebar navigation
- 03-02: Search functionality with debounce and type filtering
- 03-03: Inheritance graphs and used-by references
- 03-04: Module membership badges (gap closure)

BRWS-05 fully satisfied: Entity pages show ID, label, description, module membership, and schema definition.

Ready for next phase (04-schema-validation or 05-draft-system).
