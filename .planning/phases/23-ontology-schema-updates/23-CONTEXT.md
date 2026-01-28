# Phase 23: Ontology Schema Updates - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Define JSON schemas and repo structure for Dashboard and Resource entity types in labki-ontology. Update existing schemas (modules, bundles, properties) to support new relationships. Add entity types to constants.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Pages Structure
- Main page identified by empty name string: `pages[0].name = ""`
- Pages displayed in alphabetical order by name (array order not preserved)
- Minimum 1 page required (single-page dashboards allowed)
- Page names follow category ID pattern: `^[A-Z][a-z]*(_[a-z]+)*$`

### Resource ID Patterns
- Single level hierarchy only: `Category/ResourceName`
- First path segment must match an existing category ID
- Resource has explicit `category` field that must match the ID prefix
- Resource name follows category pattern: `^[A-Z][a-z]*(_[a-z]+)*$`
- Files stored in category subfolders: `resources/SOP/3d_printer.json`

### allowed_values Extension
- New property field: `Allows_value_from_category` (follows property naming convention)
- References a category by ID (e.g., `"Allows_value_from_category": "SOP"`)
- Mutually exclusive with `allowed_values` array - error if both specified
- Existing `allowed_values` array format unchanged for backwards compatibility

### Module/Bundle Dashboards Field
- Array of dashboard IDs: `"dashboards": ["Core_overview", "Core_setup"]`
- No naming convention requirement - any dashboard can be assigned
- Dashboards can be shared across multiple modules/bundles
- Field is optional - modules/bundles work without dashboards

### Claude's Discretion
- Dashboard ID pattern (follow existing entity patterns)
- Resource schema additionalProperties handling for dynamic fields
- Validation error message wording
- Example entity content for testing

</decisions>

<specifics>
## Specific Ideas

- Page names should use the same pattern as Category IDs (`^[A-Z][a-z]*(_[a-z]+)*$`)
- Resource hierarchy mirrors file system: `resources/SOP/Chemical_handling.json` -> ID `SOP/Chemical_handling`
- `Allows_value_from_category` is a new property-level field, not embedded in allowed_values array

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 23-ontology-schema-updates*
*Context gathered: 2026-01-27*
