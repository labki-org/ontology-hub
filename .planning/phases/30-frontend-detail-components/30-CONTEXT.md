# Phase 30: Frontend Detail Components - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Entity detail pages for viewing and editing Dashboard and Resource entities. Users can view entity content, edit inline when a draft is active, and navigate to/from detail pages via graph and sidebar. Create/edit forms (Phase 31) and list views are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Dashboard page layout
- Accordion layout for pages — collapsible sections, one page open at a time
- Raw wikitext display — show wikitext content as-is with code-style formatting
- Indented accordions for nested pages — child pages render as nested accordions inside parent
- Page header shows name only — minimal, no content preview or type indicators

### Resource field display
- Flat list layout — all fields in a single column, simple key-value display
- Constrained values follow existing patterns — consistent with how other entities display allowed_values
- Category shown as header link — category name in header, clickable to navigate to category detail

### Edit mode behavior
- Always editable in draft — fields auto-editable when viewing with active draft, read-only otherwise
- Validation follows existing patterns — match how other entity forms show validation errors

### Navigation & context
- Navigation consistent with existing — breadcrumbs and graph click behavior match other entity detail pages
- Minimal detail page — no related entities sidebar/section; user navigates via graph/sidebar for relations
- New sidebar section for artifacts — Dashboards, Resources, AND Templates grouped together in a new section

### Claude's Discretion
- Empty field display (show all vs hide empty)
- Save timing (auto-save on blur vs explicit save button)
- Dirty state indicator (depends on save pattern chosen)
- Exact styling and spacing

</decisions>

<specifics>
## Specific Ideas

- Templates should move into the new sidebar section with Dashboards and Resources — grouping "artifact" types together makes logical sense

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-frontend-detail-components*
*Context gathered: 2026-01-28*
