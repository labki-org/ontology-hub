# Phase 12: Frontend + Graph Visualization - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build unified browse/draft frontend with graph panel featuring module hull overlays. Users can browse all entity types, enter draft mode to see pending changes, and visualize category relationships with module groupings. Entity detail pages and edit functionality are Phase 13.

</domain>

<decisions>
## Implementation Decisions

### Sidebar Organization
- Grouped hierarchy: Schema (category/property/subobject) + Modules (module/bundle) + Templates
- All sections expanded by default
- Single search input at top of sidebar — live filtering as user types, showing matches across all sections
- Clicking an entity navigates to its detail page (shown in bottom panel)

### Draft Mode UX
- Both URL-based and selector-based entry — URLs for direct links, dropdown in header for switching
- Persistent top banner when in draft mode showing draft name, status, and action buttons (validate/submit)
- Change indicators: Claude's discretion on styling (background highlight, colored text, or badges all acceptable)
- Clean separation: canonical view shows only canonical data, no draft indicators

### Main Layout
- Split-panel layout: graph panel on top, detail panel on bottom
- This layout persists across navigation — selecting entities updates both panels

### Graph Interaction
- Force-directed layout algorithm
- Categories as primary nodes with inheritance edges
- Click node to expand/collapse its neighborhood (progressive exploration)
- Click node also selects it, showing details in bottom panel
- Other entity types (property/subobject/template) available as toggleable node types, off by default
- When toggled on, these entities appear connected to their parent categories
- Useful for understanding inheritance and as navigation shortcut to open details

### Module Hull Display
- Semi-transparent colored fill with subtle border
- Layered transparency for overlapping modules (blended colors)
- Toggle list in sidebar: checkboxes to show/hide each module's hull
- Colors auto-assigned by system (distinct palette)

### Claude's Discretion
- Exact change indicator styling (background, text color, or badges)
- Graph panel sizing and resizing behavior
- Color palette for module hulls
- Empty state designs
- Loading states and skeleton patterns
- Keyboard shortcuts

</decisions>

<specifics>
## Specific Ideas

- Search should be dynamic/active — filters as you type without needing to press enter
- Graph should make property/subobject/template inheritance clear when those entity types are toggled on
- The split-panel layout (graph top, detail bottom) should feel like a consistent workspace

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-frontend-graph-visualization*
*Context gathered: 2026-01-24*
