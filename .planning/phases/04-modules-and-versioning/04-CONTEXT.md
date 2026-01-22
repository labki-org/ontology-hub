# Phase 4: Modules and Versioning - Context

**Gathered:** 2026-01-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can browse modules, profiles, and version history with diff views. Module pages show included entities and dependencies. Profile pages show module composition. Version pages show field-level diffs between releases. Editing modules/profiles is a separate phase (Draft System).

</domain>

<decisions>
## Implementation Decisions

### Module Browsing
- Cards with preview on module list page (name, entity count, 3-5 entities shown)
- Search + filter: text search by name, plus filter to "modules containing entity X"
- Module detail page groups entities by type (Categories, Properties, Subobjects sections)
- Dependencies displayed as inline badges (clickable chips, not a dedicated section)

### Overlap Detection
- Neutral info style (blue/gray indicator) — not a warning, just information
- Overlap info appears only on module detail page (not on list cards)
- Inline with entity: each entity row shows "also in: Module X, Y" if applicable

### Version Diff Views
- Version list layout: Claude's discretion based on existing UI patterns
- Diff display format: Claude's discretion based on field content types
- Diffs grouped by entity type (Categories, Properties, Subobjects sections)
- Version comparison: default to comparing with previous version, with option to pick any two versions

### Profile Browsing
- Profile list uses same layout as module list (cards with preview) for consistency
- Profile detail shows module cards (small cards with name and entity count)
- Entity summary: total count plus breakdown by type (X categories, Y properties, Z subobjects)
- Inline dependency graph on profile page showing module dependencies

### Claude's Discretion
- Version list layout style (timeline vs table)
- Diff display format (side-by-side vs unified)
- Exact styling and spacing details
- Loading states and error handling

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches that match existing UI patterns established in Phase 3.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-modules-and-versioning*
*Context gathered: 2026-01-21*
