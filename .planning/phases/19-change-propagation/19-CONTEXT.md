# Phase 19: Change Propagation - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can see the impact of their draft changes across the dependency graph. Visual feedback shows which entities were directly edited and which are transitively affected through inheritance/dependencies. This is about displaying change impact — not implementing propagation logic or taking actions on affected entities.

</domain>

<decisions>
## Implementation Decisions

### Visual Indicators (Sidebar)
- Direct edits: Background highlight (colored background fill behind item)
- Transitive effects: Light background tint (same color family, much lighter/desaturated)
- Color family: Blue/cyan (matching typical edit/selection states)
- Summary count: Show in draft header (e.g., "3 entities affected")

### Hierarchy Display
- Discovery: Detail modal shows inheritance chain (not tooltip, not inline expansion)
- Modal format: New section in content showing inheritance chain with edited ancestor highlighted
- Navigation: Chain is clickable — each ancestor links to that entity's detail
- Change detail: Shows "Parent Category (edited)" — no field-level detail needed

### Graph Highlighting
- Direct edits: Fill color change on node
- Transitive effects: Match sidebar style (light tint, consistent with sidebar treatment)
- Edges: Not highlighted for content changes (just nodes)
- Graph click: Existing behavior unchanged — use sidebar for chain info

### Edge Change Indicators
- New edges (inheritance added): Colored differently (distinct color, e.g., green)
- Deleted edges (inheritance removed): Still visible but faded/struck-through
- Edge labels for +/-: Claude's discretion on whether icons help clarity

### Affected Scope
- What triggers "affected": All dependencies (inheritance, property refs, any entity that references or depends on edited entity)
- Depth visualization: Claude's discretion on gradient vs binary
- No sidebar filter needed — highlighting is sufficient
- Overlap rule: Direct edit wins (shows direct edit style only, not combined)

### Claude's Discretion
- Exact blue/cyan shade based on theme
- Whether new/deleted edges need +/- icons
- Whether depth of propagation shows as gradient or binary
- Loading skeleton design
- Error state handling

</decisions>

<specifics>
## Specific Ideas

- User noted: structural changes (adding/removing inheritance relationships) need visual treatment distinct from content changes
- Deleted edges should remain visible (faded) so user can see what they're removing, not just disappear

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-change-propagation*
*Context gathered: 2026-01-25*
