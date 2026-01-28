# Phase 24: Database Schema - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add database tables for Dashboard and Resource entities. Create relationship tables for module-dashboard and bundle-dashboard associations. Extend EntityType enum to include new entity types.

</domain>

<decisions>
## Implementation Decisions

### Resource Table Structure
- Store entire resource as `canonical_json` JSONB — matches existing entity pattern
- Extract `category_key` as plain string column (NOT a FK — see deletion behavior)
- `entity_key` format: `Category/Name` (e.g., "SOP/Chemical_handling") — matches file path structure
- Unique constraint on `entity_key` alone — simpler since key already includes category

### Dashboard Table Structure
- Store pages array in `canonical_json` JSONB — pages always fetched with dashboard
- `entity_key` format: flat ID (e.g., "Core_overview") — follows category ID pattern
- Extract `label` column for search/display — pages stay in JSONB

### Relationship Tables
- Junction table pattern for module_dashboard and bundle_dashboard
- Composite primary key: (module_id/bundle_id, dashboard_id)
- Foreign keys to both sides

### Deletion Behavior
- **Resources → Category**: No FK constraint — `category_key` is plain string, orphaned resources allowed (they'll be unused since category won't be in any module)
- **Dashboards → Module/Bundle**: RESTRICT — block dashboard deletion if any module/bundle references it
- **Module/Bundle → Dashboards**: CASCADE — junction rows deleted, dashboard continues to exist

### Claude's Discretion
- Column ordering and naming conventions (follow existing models)
- Index strategy for query performance
- Timestamp columns (created_at, updated_at) — follow existing pattern
- Base/Public schema split — follow existing pattern

</decisions>

<specifics>
## Specific Ideas

- Resources store dynamic fields from category properties — full JSONB handles any schema
- Orphaned resources are acceptable — they're simply unused, not a data integrity problem
- Dashboards are "protected" by RESTRICT — explicit cleanup required before deletion

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-database-schema*
*Context gathered: 2026-01-27*
