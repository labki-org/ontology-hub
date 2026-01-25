# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** v2.1 Bug Fixes & UX Improvements

## Current Position

Phase: 17 - Graph View Fixes
Plan: 3 of 3 (complete)
Status: Phase complete
Last activity: 2026-01-25 - Completed 17-02-PLAN.md (frontend graph visualization)

Progress: [######                        ] 18% (Phase 17 complete, 3/3 plans)

**Phase 17 Goal:** Graph view displays all entity types with proper relationships.

**Phase 17 Requirements:**
- GRAPH-01: Graph displays property nodes connected to categories [DONE - 17-01]
- GRAPH-02: Graph displays subobject nodes connected to categories [DONE - 17-01]
- GRAPH-03: Graph displays template nodes in module view [DONE - 17-01]
- GRAPH-04: Frontend renders new node types with distinct visual styling [DONE - 17-02]
- GRAPH-05: Smooth module hull boundaries [DONE - 17-03]

**Phase 17 Success Criteria:**
1. Graph API returns nodes with entity_type in ["category", "property", "subobject", "template"] [DONE]
2. Edges correctly represent relationships [DONE]
3. Frontend renders all node types distinctly [DONE]
4. Module hulls render as smooth curves [DONE]
5. Backend tests pass [DONE]

## Performance Metrics

**Velocity:**
- Total plans completed: 66 (20 v1.0 + 41 v2.0 + 5 v2.1)
- v1.0: 2 days
- v2.0: 2 days
- v2.1: In progress

**Summary by Milestone:**

| Milestone | Phases | Plans | Duration |
|-----------|--------|-------|----------|
| v1.0 MVP | 1-7 | 20 | 2 days |
| v2.0 Platform Rebuild | 8-15 | 41 | 2 days |
| v2.1 Bug Fixes & UX | 16-20 | 5+ | In progress |
| **Total** | 20 | 66+ | 4+ days |

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-25
Stopped at: Completed 17-02-PLAN.md (frontend graph visualization)
Resume file: None
Next action: Phase 17 complete - proceed to Phase 18 or final review
