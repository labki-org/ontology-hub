# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** v2.1 Bug Fixes & UX Improvements

## Current Position

Phase: 19 - Change Propagation
Plan: 1 of 4
Status: In progress
Last activity: 2026-01-25 - Completed 19-01-PLAN.md (change tracking foundation)

Progress: [#######                       ] 20% (Phase 19 in progress, 1/4 plans)

**Phase 19 Goal:** Users can see the impact of their draft changes across the dependency graph.

**Phase 19 Requirements:**
- PROP-01: Track directly edited entities [DONE - 19-01]
- PROP-02: Compute transitive dependencies [DONE - 19-01]
- PROP-03: Wire change tracking into auto-save [DONE - 19-01]
- PROP-04: Sidebar highlighting [PENDING - 19-02]
- PROP-05: Graph node highlighting [PENDING - 19-03]
- PROP-06: Inheritance chain display [PENDING - 19-04]

**Phase 19 Success Criteria:**
1. Change tracking state in draftStoreV2 [DONE]
2. BFS-based transitive dependency computation [DONE]
3. Auto-tracking on save [DONE]
4. Sidebar visual indicators [PENDING]
5. Graph node visual indicators [PENDING]
6. Inheritance chain in detail modal [PENDING]

## Performance Metrics

**Velocity:**
- Total plans completed: 67 (20 v1.0 + 41 v2.0 + 6 v2.1)
- v1.0: 2 days
- v2.0: 2 days
- v2.1: In progress

**Summary by Milestone:**

| Milestone | Phases | Plans | Duration |
|-----------|--------|-------|----------|
| v1.0 MVP | 1-7 | 20 | 2 days |
| v2.0 Platform Rebuild | 8-15 | 41 | 2 days |
| v2.1 Bug Fixes & UX | 16-20 | 6+ | In progress |
| **Total** | 20 | 67+ | 4+ days |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Key v2.0 decisions:
- Full rebuild approach - replace v1.0 implementation completely
- Hybrid patch format - JSON Patch for updates, full replacement for creates
- Materialized inheritance tables - precompute at ingest, localized re-materialization in drafts
- Latest-only versioning - Ontology Hub retains only current version
- Draft auto-rebase - in-progress drafts rebase when canonical updates

Key v2.1 decisions:
- Follow existing endpoint patterns - PropertyDetailResponse pattern for SubobjectDetailResponse and TemplateDetailResponse
- Use getState() for Zustand store access in mutation callbacks (not hook)
- Properties linked via category_property table (normalized relationships)
- Subobjects extracted from canonical_json arrays (denormalized in source)
- Templates included only in module graphs (no direct category relationship)
- Catmull-Rom alpha=0.5 for smooth hull curves
- Discriminated union type for hull shape rendering (circle/ellipse/path)
- SVG path generators for node shapes (roundedRect, diamond, hexagon, circle)
- Store-based hover state for node highlighting
- Store graph nodes/edges in graphStore for cross-component access
- Recompute all transitive effects on each edit (union of all direct edits)
- Direct edits excluded from transitive set (direct wins)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-25
Stopped at: Completed 19-01-PLAN.md (change tracking foundation)
Resume file: None
Next action: `/gsd:execute-plan 19-02` or continue phase 19 execution
