# Phase 29: Frontend Graph Visualization - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Render Dashboard and Resource entity nodes in the existing graph view. Includes node shapes, colors, layout positioning, hover/selection interactions, and edge styling. Detail pages and edit forms are separate phases (30, 31).

</domain>

<decisions>
## Implementation Decisions

### Node visual design
- Dashboard nodes: Basic shape consistent with current graph node design (not a special document shape)
- Resource nodes: Small rectangle — compact form suggesting data instances
- No icons inside nodes — shape and color alone distinguish types
- Colors: Claude's discretion to pick colors fitting existing palette with clear distinction

### Graph layout behavior
- Dashboard nodes cluster near their parent module nodes
- Resource nodes cluster near their parent category nodes
- When many resources under one category: Claude decides based on existing patterns for categories with many properties
- Auto-fit graph view to include new nodes when they appear in the neighborhood

### Hover & selection states
- Tooltip content: Claude decides based on consistency with other entity tooltips
- Hover highlighting: Match existing entity hover behavior (dim unrelated, highlight connected)
- Selection action: Match existing behavior (presumably opens detail panel)

### Edge connections
- Dashboard edges: Claude decides styling based on graph readability
- Resource edges: Claude decides styling based on existing patterns
- No edge labels — keep edges clean
- Edge hover tooltip: Match existing edge behavior

### Claude's Discretion
- Exact node shapes (as long as consistent with current design)
- Color palette choices for Dashboard and Resource nodes
- Tooltip content for both entity types
- Edge styling decisions
- Handling of many-resources-under-one-category layout
- Loading skeleton and error states

</decisions>

<specifics>
## Specific Ideas

- "Just some basic shape that feels in line with our current graph node design" for Dashboard nodes
- Resources should feel smaller/more compact than structural entities like Categories

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-frontend-graph-visualization*
*Context gathered: 2026-01-28*
