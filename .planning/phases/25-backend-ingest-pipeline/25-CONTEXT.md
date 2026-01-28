# Phase 25: Backend Ingest Pipeline - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Parse and ingest Dashboard and Resource entities from labki-ontology repo into the database tables created in Phase 24. Extends existing EntityParser with new entity types. Dashboard/Resource CRUD and derivation logic are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Dashboard relationship wiring
- Modules/bundles reference dashboards via `dashboards` array in their JSON (same pattern as `categories`)
- Dashboard JSON does NOT declare module membership — relationship is one-directional from module/bundle
- Explicit only — no auto-derivation of dashboards into modules
- Parser validates that referenced dashboard keys exist in the parsed dashboard set before creating relationships

### Resource key derivation
- Resources live in nested folders: `resources/{Category}/{key}.json`
- Entity key should include category prefix: `resources/Person/John_doe.json` → entity_key `Person/John_doe`
- This matches the `category_key` column pattern and enables unique keys across categories

### Claude's Discretion
- Implementation details of extending EntityParser
- PendingRelationship type naming for dashboard relationships
- Error handling for malformed JSON files (follow existing patterns)

</decisions>

<specifics>
## Specific Ideas

- Follow existing EntityParser patterns — `parse_dashboard()`, `parse_resource()` methods
- Dashboard files are flat: `dashboards/{key}.json`
- Resource files are nested: `resources/{category}/{key}.json`
- Relationship types needed: `module_dashboard`, `bundle_dashboard`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-backend-ingest-pipeline*
*Context gathered: 2026-01-28*
