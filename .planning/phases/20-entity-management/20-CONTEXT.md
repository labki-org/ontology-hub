# Phase 20: Entity Management - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create and delete entities within drafts. Users can add new categories, properties, subobjects, templates, modules, and bundles. Users can delete existing entities from drafts. Does not include bulk operations, import/export, or entity duplication.

</domain>

<decisions>
## Implementation Decisions

### Creation flow
- "+ New" button lives in sidebar section header (next to "Categories", "Properties", etc.)
- Clicking opens a modal form for the new entity
- Required fields per entity type (from schema):
  - **Category:** id, label, description
  - **Property:** id, label, description, datatype, cardinality
  - **Subobject:** id, label, description
  - **Template:** id, label, description, wikitext
  - **Module:** id, version, label, description + at least one of (categories, properties, subobjects, templates)
  - **Bundle:** id, version, label, description, modules (at least one)
- After creation: modal closes, new entity is selected in sidebar, detail panel shows it

### Deletion behavior
- No confirmation dialog — undo is available inline
- Deleted entities stay visible in sidebar with "Deleted" badge (Phase 18 pattern)
- Undo button sits inline with deleted entity, persists throughout draft session
- Block deletion if entity has dependents — show error listing dependent entities

### Validation feedback
- Validate on blur (when user leaves field)
- Save/Create button disabled until all required fields pass validation
- Error messages appear below the invalid field
- Required field indicators: Claude's discretion based on existing form patterns

### Relationship editing
- Type-ahead search with autocomplete for adding relationships (parent categories, properties, subobjects, templates)
- Same pattern across all entity types
- If user types an ID that doesn't exist: pop up that entity's create modal pre-populated with the typed ID
- User must fill all required fields for the cascading entity, then returns to original entity
- Soft limit with warning on number of relationships (Claude determines threshold)
- Removing relationships: X button on chip/tag (not hover trash icon)

### Claude's Discretion
- Required field indicator style (asterisk vs text vs other)
- Specific threshold for relationship count soft limit
- Modal layout and field ordering
- Autocomplete dropdown styling and behavior
- ID field validation feedback (pattern matching)

</decisions>

<specifics>
## Specific Ideas

- Cascading create: user can create an entity that doesn't exist yet directly from the relationship autocomplete, then return to the original entity being edited
- Deletion undo stays inline with the deleted item throughout the draft session (not a toast)
- Block deletion with clear message showing which entities depend on the one being deleted

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-entity-management*
*Context gathered: 2026-01-25*
