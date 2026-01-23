# Requirements: Ontology Hub v2.0

**Defined:** 2026-01-23
**Core Value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.

## v2.0 Requirements

Requirements for the platform rebuild. Each maps to roadmap phases.

### Database Foundation

- [ ] **DB-01**: ontology_version table tracks source_repo, ref_type, ref_name, commit_sha, ingest_status
- [ ] **DB-02**: Entity tables (category, property, subobject, module, bundle, template) store canonical JSON with entity_key and source_path
- [ ] **DB-03**: category_parent table stores parent relationships with ontology_version_id scoping
- [ ] **DB-04**: category_property table stores property membership with required flag and origin (direct/inherited)
- [ ] **DB-05**: category_property_effective materialized view precomputes inherited properties with provenance
- [ ] **DB-06**: module_entity table stores module membership for all entity types
- [ ] **DB-07**: bundle_module table stores bundle-to-module relationships
- [ ] **DB-08**: draft table stores base_ontology_version_id, status, title, source (hub_ui/mediawiki_push)
- [ ] **DB-09**: draft_change table stores change_type, entity_type, entity_key, patch (JSON Patch), replacement_json

### Ingest Pipeline

- [ ] **ING-01**: Pull repo at specified ref (commit SHA, tag, or branch)
- [ ] **ING-02**: Validate all JSON files against _schema.json files from repo
- [ ] **ING-03**: Parse and populate canonical entity tables
- [ ] **ING-04**: Compute and populate relationship tables (category_parent, category_property, module_entity, bundle_module)
- [ ] **ING-05**: Refresh category_property_effective materialized view
- [ ] **ING-06**: Store ingest warnings/errors in ontology_version record

### Query Layer

- [ ] **QRY-01**: Entity queries accept ontology_version_id for canonical reads
- [ ] **QRY-02**: Entity queries accept draft_id and return effective view (canonical + draft overlay)
- [ ] **QRY-03**: API computes effective view server-side; frontend never merges
- [ ] **QRY-04**: Category detail returns parents, direct properties, inherited properties with provenance
- [ ] **QRY-05**: Property detail returns categories using it (where-used)
- [ ] **QRY-06**: Module detail returns direct entities and computed closure (auto-included dependencies)
- [ ] **QRY-07**: Bundle detail returns modules and computed closure

### Graph Endpoints

- [ ] **GRP-01**: Neighborhood graph endpoint returns nodes/edges within depth of selected entity
- [ ] **GRP-02**: Module-scoped graph endpoint returns nodes/edges for specified module
- [ ] **GRP-03**: Graph endpoints return module membership for hull rendering
- [ ] **GRP-04**: Graph nodes include change status badges (added/modified/deleted) in draft context

### Draft System

- [ ] **DRF-01**: Draft creation with base_ontology_version_id binding
- [ ] **DRF-02**: Draft changes stored as JSON Patch for updates, full replacement for creates
- [ ] **DRF-03**: Effective view computation overlays draft changes on canonical data
- [ ] **DRF-04**: Localized re-materialization of inheritance during draft edits
- [ ] **DRF-05**: Draft status lifecycle (active, submitted, merged, abandoned)
- [ ] **DRF-06**: MediaWiki push import creates draft_change rows from payload

### Validation Engine

- [ ] **VAL-01**: JSON Schema validation against _schema.json files from canonical repo
- [ ] **VAL-02**: Reference resolution checks (all parents, properties, modules exist)
- [ ] **VAL-03**: Circular inheritance detection with cycle path reporting
- [ ] **VAL-04**: Breaking change detection (deletions affecting other entities)
- [ ] **VAL-05**: Module/bundle version increment suggestions (semver)
- [ ] **VAL-06**: Validation returns structured messages with entity_key, field_path, severity, code

### Frontend Browsing

- [ ] **FE-01**: Left sidebar with collapsible sections for each entity type
- [ ] **FE-02**: Search box filters entities across all types
- [ ] **FE-03**: Entity lists show change badges in draft mode (added/modified/deleted)
- [ ] **FE-04**: Version selector for canonical mode (choose ontology version)
- [ ] **FE-05**: Draft selector shows current draft with status
- [ ] **FE-06**: Same UI components serve both browse and draft modes

### Graph Visualization

- [ ] **GV-01**: Graph panel on category page centered on selected category
- [ ] **GV-02**: Depth control (1-3 levels)
- [ ] **GV-03**: Edge type filter (inheritance, properties, subobjects)
- [ ] **GV-04**: Module hull overlays using d3-polygon convex hulls
- [ ] **GV-05**: Multi-hull display (multiple modules visible simultaneously)
- [ ] **GV-06**: Module selection panel to toggle hull visibility
- [ ] **GV-07**: Click-to-focus and pan/zoom navigation

### Category Detail

- [ ] **CAT-01**: Header with name, label, description
- [ ] **CAT-02**: Parents list with add/remove in edit mode
- [ ] **CAT-03**: Direct properties section
- [ ] **CAT-04**: Inherited properties section grouped by parent with provenance
- [ ] **CAT-05**: Module/bundle membership display
- [ ] **CAT-06**: Edit icons appear in draft mode for adding/removing properties

### Property Detail

- [ ] **PRP-01**: Header with name, label, description, datatype, cardinality
- [ ] **PRP-02**: Where-used list showing categories using this property
- [ ] **PRP-03**: Module/bundle membership display
- [ ] **PRP-04**: Edit icons for modifying property attributes in draft mode

### Subobject Detail

- [ ] **SUB-01**: Header with name, label, description
- [ ] **SUB-02**: Required/optional properties lists
- [ ] **SUB-03**: Where-used list showing categories/properties using this subobject
- [ ] **SUB-04**: Edit icons in draft mode

### Module Detail

- [ ] **MOD-01**: Header with name, label, description
- [ ] **MOD-02**: Direct members list (categories, properties, subobjects, templates)
- [ ] **MOD-03**: Computed closure view showing auto-included dependencies
- [ ] **MOD-04**: Dependencies list (other modules this one depends on)
- [ ] **MOD-05**: Edit icons for adding/removing members in draft mode
- [ ] **MOD-06**: Suggested version increment display

### Bundle Detail

- [ ] **BND-01**: Header with name, label, description
- [ ] **BND-02**: Modules list
- [ ] **BND-03**: Computed closure view (all entities via modules)
- [ ] **BND-04**: Edit icons for adding/removing modules in draft mode
- [ ] **BND-05**: Suggested version increment display

### Template Detail

- [ ] **TPL-01**: Header with name, label, description
- [ ] **TPL-02**: Wikitext content display (read-only view)
- [ ] **TPL-03**: Wikitext editor in draft mode (simple text area)
- [ ] **TPL-04**: Module membership display

### Draft Workflow UI

- [ ] **DWF-01**: Draft banner shows title, status, validate button, submit PR button
- [ ] **DWF-02**: Validate button triggers validation and shows inline results
- [ ] **DWF-03**: Change highlighting with green/amber/red badges
- [ ] **DWF-04**: Diff view showing per-entity changes grouped by type
- [ ] **DWF-05**: Submit PR disabled until validation passes (no errors)

### PR Submission

- [ ] **PR-01**: GitHub OAuth flow at PR submission time (existing v1.0 pattern)
- [ ] **PR-02**: Generate file changes from effective JSON
- [ ] **PR-03**: Create branch and commit with all draft changes
- [ ] **PR-04**: Open PR with structured summary (categorized changes, validation results)
- [ ] **PR-05**: Include suggested semver increments for modules/bundles in PR body

## Future Requirements

Deferred to later milestones.

### Performance Optimization

- **PERF-01**: Graph virtualization for large ontologies (500+ nodes)
- **PERF-02**: pg_ivm extension for incremental materialized view refresh
- **PERF-03**: WebGL rendering fallback for large graphs

### Advanced Features

- **ADV-01**: Faceted search with filters by type, module, validation status
- **ADV-02**: Profile coverage matrix
- **ADV-03**: Interactive WebVOWL-style visualization
- **ADV-04**: Concave hull option for module overlays

## Out of Scope

Explicitly excluded with reasoning.

| Feature | Reason |
|---------|--------|
| Platform-native user accounts | GitHub is the only identity provider, used only at PR time |
| Saved workspaces | No platform accounts to bind to |
| Social features (comments, likes) | Not a community platform |
| Real-time collaboration | Single-user draft model sufficient for v2.0 |
| Mobile-optimized UI | Desktop-first for maintainer workflow |
| Runtime source-of-truth | GitHub remains authoritative |
| Module hull concave shapes | Convex hulls sufficient for v2.0; concave adds complexity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 to DB-09 | TBD | Pending |
| ING-01 to ING-06 | TBD | Pending |
| QRY-01 to QRY-07 | TBD | Pending |
| GRP-01 to GRP-04 | TBD | Pending |
| DRF-01 to DRF-06 | TBD | Pending |
| VAL-01 to VAL-06 | TBD | Pending |
| FE-01 to FE-06 | TBD | Pending |
| GV-01 to GV-07 | TBD | Pending |
| CAT-01 to CAT-06 | TBD | Pending |
| PRP-01 to PRP-04 | TBD | Pending |
| SUB-01 to SUB-04 | TBD | Pending |
| MOD-01 to MOD-06 | TBD | Pending |
| BND-01 to BND-05 | TBD | Pending |
| TPL-01 to TPL-04 | TBD | Pending |
| DWF-01 to DWF-05 | TBD | Pending |
| PR-01 to PR-05 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 69 total
- Mapped to phases: 0
- Unmapped: 69

---
*Requirements defined: 2026-01-23*
*Last updated: 2026-01-23 after initial definition*
