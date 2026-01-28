# Phase 27: Module Auto-Derivation Extension - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the module auto-derivation system to include additional entity types:
1. Categories referenced via `allowed_values.from_category` in properties
2. Resources belonging to derived categories

This builds on existing derivation (categories → properties, subobjects, templates) and adds two new relationship paths.

</domain>

<decisions>
## Implementation Decisions

### Derivation Depth
- Full transitive derivation: follow all chains until exhausted
- Category X → X's properties → more categories via allowed_values → their resources → continue
- Maximum depth cap (e.g., 10 levels) as safety measure against pathological cases
- When a category is derived, include its full set: properties + subobjects + templates + resources
- Track provenance: record why each entity was derived (e.g., "Category X derived because Property P references it")

### Resource Inclusion Rules
- Include ALL resources belonging to a derived category, no filtering by usage
- Include nested resources: resources/Category/**/*.json recursively
- Resources are always derived, never manually added to modules
- Resources computed on-demand (not stored in module JSON) — consistent with properties/subobjects/templates

### Draft Behavior
- Recompute derivation on every change (immediate, not deferred to save)
- Silent auto-derive: no user notification when entities are added
- Show derived entities in draft's change list so user sees full impact
- Broken references shouldn't occur: schema validation ensures referenced categories exist

### Claude's Discretion
- Exact cycle detection algorithm implementation
- Provenance data structure format
- Performance optimization strategies for large derivation graphs

</decisions>

<specifics>
## Specific Ideas

- Module JSON stores only manual fields (categories, dependencies, dashboards) — derived entities computed at query time
- Derivation is consistent: same algorithm handles all derived entity types

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-module-auto-derivation-extension*
*Context gathered: 2026-01-28*
