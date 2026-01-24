# Phase 8: Database Foundation - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish v2.0 schema with canonical tables, normalized relationship storage, and materialized inheritance views. This phase creates the database foundation — entity tables, relationship tables, version tracking, and draft structure.

</domain>

<decisions>
## Implementation Decisions

### Versioning Model (Simplified)
- **Ontology Hub only maintains the latest version** — no historical versions in the database
- Modules and Bundles have semver versions, but only the latest of each is stored in Ontology Hub
- **labki-schemas repo is the version archive** — all past versions preserved there
- `ontology_version` table tracks current canonical state with commit SHA

### Repo Structure for Versioning (labki-schemas)
- `/modules/{module-name}/` subdirectory for each module containing:
  - JSON file with entity list + current version number
  - `/versions/` subdirectory with tarballs of entity JSON for each version
- `/bundles/{bundle-name}/` follows the same pattern
- **GitHub Actions** auto-generates and commits tarballs on PR merge
- **GitHub Actions** intelligently bumps version numbers: major (breaking), minor (non-breaking), patch (text changes)

### Ingest Trigger
- Webhook notifies Ontology Hub when new version is available
- Ontology Hub ingests from latest commit

### Draft Handling
- Drafts are always against the current latest canonical
- **Auto-rebase:** If new version is ingested while draft is in progress, draft auto-rebases onto new canonical
- Draft changes stored as JSON Patch for updates, full replacement for creates

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
- Whether draft inheritance is computed dynamically per-edit or on save
- Exact table naming and indexing strategy
- Auto-rebase conflict resolution strategy

</decisions>

<specifics>
## Specific Ideas

- Sidebar shows all current entities in the ontology (latest version only)
- Entity detail pages show module/bundle membership with version info
- Graph view displays the single canonical ontology state

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-database-foundation*
*Context gathered: 2026-01-23 (revised)*
