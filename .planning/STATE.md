# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-24)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** v2.1 Bug Fixes & UX Improvements

## Current Position

Phase: 20 - Entity Management
Plan: 8 of N complete (01, 02, 03, 04, 05, 08 complete)
Status: Plan 08 complete
Last activity: 2026-01-25 - Completed 20-08-PLAN.md (Detail View Relationship Editing)

Progress: [############------------------] 40% (20-08 complete)

**Phase 20 Goal:** Create and delete entities within drafts with modal forms and validation.

**Phase 20 Plan 08 Completed:**
- CategoryDetail with EntityCombobox for parent editing
- ModuleDetail with relationship editing for all 4 entity types
- BundleDetail with module editing via combobox
- Relationship changes auto-save in draft mode
- Create-if-not-exists opens create modal for cascading creation

## Performance Metrics

**Velocity:**
- Total plans completed: 76 (20 v1.0 + 41 v2.0 + 15 v2.1)
- v1.0: 2 days
- v2.0: 2 days
- v2.1: In progress

**Summary by Milestone:**

| Milestone | Phases | Plans | Duration |
|-----------|--------|-------|----------|
| v1.0 MVP | 1-7 | 20 | 2 days |
| v2.0 Platform Rebuild | 8-15 | 41 | 2 days |
| v2.1 Bug Fixes & UX | 16-20 | 15 | In progress |
| **Total** | 20 | 76 | 4+ days |

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
- Validate on blur (mode: 'onBlur') for entity forms (20-02)
- Controller wrapper for Select components with RHF (20-02)
- Parents/properties relationship fields deferred to Plan 05 (20-02)
- cmdk Command primitive with Radix Popover for autocomplete UI (20-05)
- onCreateNew callback for cascading create flow (20-05)
- getLabel prop on RelationshipChips for custom label resolution (20-05)
- Relaxed schemas for creation (moduleCreateSchema, bundleCreateSchema) vs full validation for editing (20-03)
- Wikitext field uses font-mono and min-h-[150px] for template syntax visibility (20-03)
- + New button placed outside CollapsibleTrigger to avoid toggle on click (20-04)
- Modal title generated dynamically from entity type (20-04)
- New entity selected in graph after successful creation (20-04)
- Replace Input/EditableList with EntityCombobox for type-ahead search in detail views (20-08)
- Use RelationshipChips for consistent display across all detail views (20-08)
- Connect onCreateNew to openCreateModal for cascading entity creation (20-08)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-25
Stopped at: Completed 20-08-PLAN.md (Detail View Relationship Editing)
Resume file: None
Next action: Continue with Phase 20 remaining plans (06 Delete, 07 Validation, 09 Integration)
