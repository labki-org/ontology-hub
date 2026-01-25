# Phase 18: Inline Editing UX - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can edit entities in-place with intuitive hover controls in draft mode. This phase covers the interaction patterns for editing and deleting field values within detail modals and sidebar views. Creating new entities is Phase 20.

</domain>

<decisions>
## Implementation Decisions

### Icon placement & visibility
- Icons appear on hover only (keeps UI clean)
- Both edit and delete icons shown together on hover
- Subtle row highlight + icons appear on hover
- Icon position: Claude's discretion based on layout

### Edit interaction flow
- Clicking edit icon converts field to inline text input
- Explicit save/cancel buttons appear next to input
- Escape key cancels edit and reverts to original value
- Click-away behavior: Claude's discretion

### Field editability rules
- Read-only fields simply don't show edit icons on hover (no special indicator)
- Inherited values are read-only in child entities — edit at source
- Array fields (like parent categories) have add/remove controls inline
- Label/display name is freely editable (ID is the stable reference)

### Delete UX
- No confirmation dialog — deleted items remain visible with "deleted" state
- Deleted items: grayed out styling with "Deleted" badge
- Undo icon appears next to deleted items for easy reversal
- Deleted items stay in same position (not moved to separate section)
- Dependency warning on delete: Claude's discretion (can rely on validation)

### Claude's Discretion
- Icon position relative to field (right side vs inline after value)
- Click-away behavior (discard changes silently vs prompt)
- Whether to show dependency warning on delete or rely on validation
- Exact styling details (colors, spacing, icon sizes)

</decisions>

<specifics>
## Specific Ideas

- Entity has both label (display name) and ID — label is editable, ID is the stable reference used for relationships
- Delete is soft — shows deleted state rather than removing, making undo trivial

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-inline-editing-ux*
*Context gathered: 2026-01-25*
