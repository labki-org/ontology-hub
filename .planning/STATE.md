# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** Phase 8 - Database Foundation

## Current Position

Phase: 8 of 14 (Database Foundation)
Plan: 3 of 3 in current phase (completed)
Status: Phase 8 complete
Last activity: 2026-01-24 -- Completed 08-03-PLAN.md (Draft Tables)

Progress: [############............] 53% (v1.0 complete, v2.0 phase 8 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 23 (20 v1.0 + 3 v2.0)
- Average duration: ~30 min (v1.0 estimate)
- Total execution time: ~10h 9m

**By Phase (v2.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08-database-foundation | 3/3 | 9m | 3m |

**Recent Trend:**
- v1.0 completed in 2 days
- v2.0 phase 8 plan 1: 3 minutes
- v2.0 phase 8 plan 2: 2 minutes
- v2.0 phase 8 plan 3: 4 minutes

*Metrics updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [v2.0 start]: Full rebuild approach -- replace v1.0 implementation completely, reuse working code where appropriate
- [v2.0 start]: Hybrid patch format -- JSON Patch for updates, full replacement for creates
- [v2.0 start]: Materialized inheritance tables -- precompute category_property_effective at ingest
- [Phase 8 context]: Latest-only versioning -- Ontology Hub retains only current version; labki-schemas repo is the version archive
- [Phase 8 context]: Webhook-triggered ingest -- repo push triggers ingest, no manual refresh
- [Phase 8 context]: Draft auto-rebase -- when new canonical is ingested, in-progress drafts rebase automatically
- [Phase 8 context]: GitHub Actions version bumping -- auto-generate tarballs and bump semver on PR merge
- [08-01]: Unique constraint on entity_key per table rather than composite key
- [08-01]: OntologyVersion stored as table (not singleton) for flexibility
- [08-01]: Entity model pattern: Base -> Table -> Public for all entity types
- [08-02]: Foreign keys use plural table names (categories.id, not category.id)
- [08-02]: ModuleEntity uses entity_key for polymorphic membership across 6 entity types
- [08-02]: CategoryPropertyEffective is read-only SQLModel for materialized view queries
- [08-03]: Draft uses singular table name (draft) matching model convention
- [08-03]: New enums use _v2 suffix (draftstatus_v2) to avoid collision with v1.0
- [08-03]: Rebase tracking fields stored as strings for flexibility

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-24
Stopped at: Completed 08-03-PLAN.md (Draft Tables) - Phase 8 complete
Resume file: None
