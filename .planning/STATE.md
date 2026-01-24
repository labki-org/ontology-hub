# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-23)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** Phase 8 - Database Foundation

## Current Position

Phase: 8 of 14 (Database Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-01-23 -- v2.0 roadmap created

Progress: [##########..............] 47% (v1.0 complete, v2.0 starting)

## Performance Metrics

**Velocity:**
- Total plans completed: 20 (v1.0)
- Average duration: ~30 min (v1.0 estimate)
- Total execution time: ~10 hours (v1.0)

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1-7 (v1.0) | 20 | ~10h | ~30m |

**Recent Trend:**
- v1.0 completed in 2 days
- v2.0 is a full rebuild with 7 phases

*Metrics reset for v2.0 -- updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-23
Stopped at: v2.0 roadmap created
Resume file: None
