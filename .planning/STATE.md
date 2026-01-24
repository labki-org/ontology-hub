# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** Phase 10 - Query Layer (COMPLETE)

## Current Position

Phase: 10 of 14 (Query Layer)
Plan: 3 of 3 in current phase
Status: Phase complete
Last activity: 2026-01-24 -- Completed 10-02-PLAN.md (v2.0 Entity Query Endpoints)

Progress: [##################......] 70% (v1.0 complete, v2.0 phase 10 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 31 (20 v1.0 + 11 v2.0)
- Average duration: ~30 min (v1.0 estimate)
- Total execution time: ~10h 28m

**By Phase (v2.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 08-database-foundation | 3/3 | 9m | 3m |
| 09-ingest-pipeline | 4/4 | 9m | 2m |
| 10-query-layer | 3/3 | 9m | 3m |

**Recent Trend:**
- v1.0 completed in 2 days
- v2.0 phase 8 plan 1: 3 minutes
- v2.0 phase 8 plan 2: 2 minutes
- v2.0 phase 8 plan 3: 4 minutes
- v2.0 phase 9 plan 1: 2 minutes
- v2.0 phase 9 plan 2: 2 minutes
- v2.0 phase 9 plan 3: 2 minutes
- v2.0 phase 9 plan 4: 3 minutes
- v2.0 phase 10 plan 1: 3 minutes
- v2.0 phase 10 plan 2: 4 minutes
- v2.0 phase 10 plan 3: 2 minutes

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
- [09-01]: Used requirements.txt instead of pyproject.toml for dependencies (project convention)
- [09-02]: PendingRelationship uses extra dict for type-specific fields (is_required, entity_type)
- [09-02]: Parse methods return tuple of (entity, relationships) for types with relationships
- [09-03]: FK deletion order: relationships first, then entities, then OntologyVersion
- [09-03]: Entities flushed for UUID generation before relationship resolution
- [09-03]: Mat view refresh in separate transaction after main commit
- [09-04]: Keep v1.0 trigger_sync_background for backward compatibility
- [09-04]: Mark drafts stale only for DRAFT and VALIDATED statuses
- [10-01]: Application-layer overlay computation using Python jsonpatch library
- [10-01]: deepcopy before applying JSON Patch to avoid mutating cached data
- [10-01]: validation_alias for underscore-prefixed fields (_change_status -> change_status)
- [10-02]: Closure computed via recursive CTEs rather than application-layer graph traversal
- [10-02]: Module closure returns ancestor categories; bundle closure returns dependent modules
- [10-02]: Draft-created entities have empty closure (no canonical relationships yet)
- [10-03]: Path array in recursive CTE prevents infinite loops from circular inheritance
- [10-03]: Cycle detection uses separate CTE query with has_cycle flag propagation

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-24
Stopped at: Completed Phase 10 (Query Layer) - verified and complete
Resume file: None
