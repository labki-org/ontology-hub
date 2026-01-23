# Phase 8: Database Foundation - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish v2.0 schema with versioned canonical tables, normalized relationship storage, and materialized inheritance views. This phase creates the database foundation — entity tables, relationship tables, version tracking, and draft structure.

</domain>

<decisions>
## Implementation Decisions

### Ontology Versioning Model
- **Top-level ontology versions** using major.minor.patch semver
- An `ontology_version` represents a fully consistent snapshot with exact module/bundle versions included
- Modules and bundles are versioned entities that live WITHIN an ontology version (not independent)
- Drafts within a major version can only bump minor or patch
- Breaking changes require bumping the ontology major version

### Version Retention Policy
- Keep the latest of every major version for ontology, bundle, and module
- Example: If ontology is at v3.2.1, retain v1.latest, v2.latest, v3.2.1
- Same pattern applies to bundles and modules within their respective ontology versions

### Inheritance Materialization
- `category_property_effective` view stores **source category + depth** for provenance
- Include direct properties at depth=0 for a unified view of all effective properties
- Diamond inheritance: Show all sources with depth (no conflict resolution needed — same property entity regardless of path)
- Refresh timing: On ingest for canonical; compute for draft edits (dynamically if feasible, on save as fallback)

### Draft Table Structure
- **Status workflow:** draft → validated → submitted → merged/rejected
- **Authorship:** Capability URL only (no accounts, same as v1.0)
- **Timestamps:** Track created, modified, and status transition timestamps (validated_at, submitted_at, etc.)
- **Metadata:** Auto-generated title and description from changes, plus user-editable comment field

### Claude's Discretion
- Purge timing for old minor/patch versions within a major (immediate vs grace period)
- Whether draft inheritance is computed dynamically per-edit or on save
- Exact table naming and indexing strategy
- How to handle entities with no EXIF-equivalent metadata

</decisions>

<specifics>
## Specific Ideas

- "Users must sync to the latest of their major version before submitting edits"
- Sidebar should show all current entities in the ontology, with entity detail pages showing which module/bundle versions contain that entity
- Graph view scopes to a specific ontology version for consistency

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-database-foundation*
*Context gathered: 2026-01-23*
