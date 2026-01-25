# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** v2.1 Bug Fixes & UX Improvements

## Current Position

Phase: 20 - Entity Management
Plan: 1 of N in progress
Status: Plan 01 complete
Last activity: 2026-01-25 - Completed 20-01-PLAN.md (Form Foundation)

Progress: [######------------------------] 22% (20-01 complete)

**Phase 20 Goal:** Create and delete entities within drafts with modal forms and validation.

**Phase 20 Plan 01 Completed:**
- cmdk library installed for future combobox functionality
- FormField component with label, required indicator, error display
- Zod schemas documented for all 6 entity types
- useCreateEntityChange mutation hook added

## Performance Metrics

**Velocity:**
- Total plans completed: 74 (20 v1.0 + 41 v2.0 + 13 v2.1)
- v1.0: 2 days
- v2.0: 2 days
- v2.1: In progress

**Summary by Milestone:**

| Milestone | Phases | Plans | Duration |
|-----------|--------|-------|----------|
| v1.0 MVP | 1-7 | 20 | 2 days |
| v2.0 Platform Rebuild | 8-15 | 41 | 2 days |
| v2.1 Bug Fixes & UX | 16-20 | 13 | In progress |
| **Total** | 20 | 74 | 4+ days |

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
- Keep Parent Categories (editable) and Inheritance Chain (read-only) sections separate for MVP
- Blue highlighting consistent across sidebar, graph, and detail modal
- Click-away discards changes silently (explicit save required) for inline editing
- Set up vitest with jsdom for React component testing
- Only label/description editable in panel view (full editing requires modal)
- usePanelEditState pattern for local edit state with auto-save in entity views
- Keep EditableField for multiline description, use InlineEditField for single-line label
- Soft-deleted parents stay in position with DeletedItemBadge until save
- Use Ref<any> in FormField for broad element type compatibility (20-01)
- Zod superRefine for module at-least-one validation (20-01)
- Invalidate all entity type caches on entity creation (20-01)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-25
Stopped at: Completed 20-01-PLAN.md (Form Foundation)
Resume file: None
Next action: Continue with Phase 20 plan 02
