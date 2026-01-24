# Phase 13: Entity Detail Pages - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement detail pages for all six entity types (Category, Property, Subobject, Module, Bundle, Template) with view and edit modes. Users can view entity details, see inheritance/membership info, and edit entities in draft mode.

</domain>

<decisions>
## Implementation Decisions

### Layout & navigation
- Accordion sections for content organization (collapsible sections that expand/collapse independently)
- Sections reset to default state on navigation (no persistence of open/closed state)
- Breadcrumb trail for navigation (shows path like 'Categories > Person > Address' with clickable links)
- Detail view appears as modal overlay (full detail view as modal, graph hidden behind)

### Edit mode interaction
- Global edit toggle at top of page switches entire page to edit mode
- Auto-save with debounce (changes save automatically after short delay)
- No toast or status text for save feedback; instead use visual markers:
  - Background shading behind modified text
  - Text color change for modified values
  - Change badge appears on any edited entity
- Revert button per field to restore original value

### Entity-specific displays
- **Category inherited properties:** Grouped collapsible list where properties are grouped together, showing which parent category(s) they were inherited from
- **Category inheritance hierarchy:** Use the graph display for hierarchy visualization (supports multiple parents)
- **Module members:** Grouped by entity type (sections like 'Categories (5)', 'Properties (12)', 'Templates (2)')
- **Template wikitext:** Claude's discretion on display approach

### Change indicators
- Modified fields: Both background shading AND left border accent for emphasis
- Original value: Hover tooltip shows original value when hovering over modified field
- New entities: Green badge + full green border styling indicating 'new'
- Deleted entities: Viewable with red overlay/styling and 'DELETED' badge

### Claude's Discretion
- Template wikitext display (syntax highlighting vs plain text)
- Exact spacing and typography within sections
- Accordion default open/closed state per entity type
- Auto-save debounce timing

</decisions>

<specifics>
## Specific Ideas

- Visual markers should clearly convey to users that changes have been recorded without intrusive notifications
- Inherited properties grouped by source category for clarity on where each property comes from

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-entity-detail-pages*
*Context gathered: 2026-01-24*
