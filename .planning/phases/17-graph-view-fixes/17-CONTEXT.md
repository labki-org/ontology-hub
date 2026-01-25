# Phase 17: Graph View Fixes - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Render all entity types (properties, subobjects, templates) as distinct colored nodes in the graph view, and make module hull boundaries smooth (not jagged polygons). This phase fixes visual rendering issues — it does not add new graph features or interactions.

</domain>

<decisions>
## Implementation Decisions

### Node visual identity
- Color + shape: Each entity type gets both a distinct color AND a distinct shape
- Muted/pastel color palette — soft, low-saturation colors for less visual noise
- Always show node labels (entity names) at all times
- Shape selection: Claude's discretion — pick shapes that are visually distinct and semantically sensible

### Module hull rendering
- Semi-transparent fills — overlapping modules show blended colors, both hulls visible
- Fill + subtle border — thin border in darker shade to delineate boundary
- Module name/label displays on the hull
- Padding around nodes: Claude's discretion — balance clarity and space efficiency

### Node sizing/density
- Spacious layout — generous spacing between nodes, cleaner view even if requires panning
- Static sizing — node size fixed by type, doesn't change based on connections
- Keep current zoom behavior — don't change existing pan/zoom implementation
- Type-based sizing: Claude's discretion — pick sizing that creates good visual hierarchy

### Visual hierarchy
- Categories anchor the graph — visually prominent as primary reference points
- Edge styling by relationship type — different line styles for inheritance vs dependency
- Edges show directional arrows indicating relationship direction
- Hover highlights connections — hovering dims unrelated nodes, emphasizes connected ones

### Claude's Discretion
- Exact shape assignments per entity type
- Hull padding amount
- Node size values per type
- Specific edge styles (dashed, colored, thickness) for inheritance vs dependency

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard graph visualization approaches that follow the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-graph-view-fixes*
*Context gathered: 2026-01-24*
