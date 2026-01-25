# Requirements: Ontology Hub v2.0

**Defined:** 2026-01-23
**Core Value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.

## v2.0 Requirements

Requirements for the platform rebuild. Each maps to roadmap phases.

### Database Foundation

- [x] **DB-01**: ontology_version table tracks current canonical state (commit_sha, ingest_status, ingested_at) — only latest version retained
- [x] **DB-02**: Entity tables (category, property, subobject, module, bundle, template) store canonical JSON with entity_key and source_path
- [x] **DB-03**: category_parent table stores parent relationships (no version scoping — only latest exists)
- [x] **DB-04**: category_property table stores property membership with required flag and origin (direct/inherited)
- [x] **DB-05**: category_property_effective materialized view precomputes inherited properties with source + depth provenance
- [x] **DB-06**: module_entity table stores module membership for all entity types
- [x] **DB-07**: bundle_module table stores bundle-to-module relationships
- [x] **DB-08**: draft table stores base_commit_sha (for auto-rebase), status, title, source (hub_ui/mediawiki_push)
- [x] **DB-09**: draft_change table stores change_type, entity_type, entity_key, patch (JSON Patch), replacement_json

### Ingest Pipeline

- [x] **ING-01**: Webhook endpoint receives push notification and triggers ingest
- [x] **ING-02**: Pull latest commit from labki-schemas repo
- [x] **ING-03**: Validate all JSON files against _schema.json files from repo
- [x] **ING-04**: Parse and populate canonical entity tables (replacing previous data)
- [x] **ING-05**: Compute and populate relationship tables (category_parent, category_property, module_entity, bundle_module)
- [x] **ING-06**: Refresh category_property_effective materialized view
- [x] **ING-07**: Store ingest warnings/errors in ontology_version record

### Query Layer

- [x] **QRY-01**: Entity queries accept ontology_version_id for canonical reads
- [x] **QRY-02**: Entity queries accept draft_id and return effective view (canonical + draft overlay)
- [x] **QRY-03**: API computes effective view server-side; frontend never merges
- [x] **QRY-04**: Category detail returns parents, direct properties, inherited properties with provenance
- [x] **QRY-05**: Property detail returns categories using it (where-used)
- [x] **QRY-06**: Module detail returns direct entities and computed closure (auto-included dependencies)
- [x] **QRY-07**: Bundle detail returns modules and computed closure

### Graph Endpoints

- [x] **GRP-01**: Neighborhood graph endpoint returns nodes/edges within depth of selected entity
- [x] **GRP-02**: Module-scoped graph endpoint returns nodes/edges for specified module
- [x] **GRP-03**: Graph endpoints return module membership for hull rendering
- [x] **GRP-04**: Graph nodes include change status badges (added/modified/deleted) in draft context

### Draft System

- [x] **DRF-01**: Draft creation binds to base_commit_sha for tracking
- [x] **DRF-02**: Draft changes stored as JSON Patch for updates, full replacement for creates
- [x] **DRF-03**: Effective view computation overlays draft changes on canonical data
- [x] **DRF-04**: Localized re-materialization of inheritance during draft edits
- [x] **DRF-05**: Draft status lifecycle (draft, validated, submitted, merged, rejected)
- [x] **DRF-06**: MediaWiki push import creates draft_change rows from payload
- [x] **DRF-07**: Auto-rebase: when new canonical is ingested, in-progress drafts rebase automatically

### Validation Engine

- [x] **VAL-01**: JSON Schema validation against _schema.json files from canonical repo
- [x] **VAL-02**: Reference resolution checks (all parents, properties, modules exist)
- [x] **VAL-03**: Circular inheritance detection with cycle path reporting
- [x] **VAL-04**: Breaking change detection (deletions affecting other entities)
- [x] **VAL-05**: Module/bundle version increment suggestions (semver)
- [x] **VAL-06**: Validation returns structured messages with entity_key, field_path, severity, code

### Frontend Browsing

- [x] **FE-01**: Left sidebar with collapsible sections for each entity type
- [x] **FE-02**: Search box filters entities across all types
- [x] **FE-03**: Entity lists show change badges in draft mode (added/modified/deleted)
- [x] **FE-04**: Current ontology version display (commit SHA, module/bundle versions)
- [x] **FE-05**: Draft selector shows current draft with status
- [x] **FE-06**: Same UI components serve both browse and draft modes

### Graph Visualization

- [x] **GV-01**: Graph panel on category page centered on selected category
- [x] **GV-02**: Depth control (1-3 levels)
- [x] **GV-03**: Edge type filter (inheritance, properties, subobjects)
- [x] **GV-04**: Module hull overlays using d3-polygon convex hulls
- [x] **GV-05**: Multi-hull display (multiple modules visible simultaneously)
- [x] **GV-06**: Module selection panel to toggle hull visibility
- [x] **GV-07**: Click-to-focus and pan/zoom navigation

### Category Detail

- [x] **CAT-01**: Header with name, label, description
- [x] **CAT-02**: Parents list with add/remove in edit mode
- [x] **CAT-03**: Direct properties section
- [x] **CAT-04**: Inherited properties section grouped by parent with provenance
- [x] **CAT-05**: Module/bundle membership display
- [x] **CAT-06**: Edit icons appear in draft mode for adding/removing properties

### Property Detail

- [x] **PRP-01**: Header with name, label, description, datatype, cardinality
- [x] **PRP-02**: Where-used list showing categories using this property
- [x] **PRP-03**: Module/bundle membership display
- [x] **PRP-04**: Edit icons for modifying property attributes in draft mode

### Subobject Detail

- [x] **SUB-01**: Header with name, label, description
- [x] **SUB-02**: Required/optional properties lists
- [x] **SUB-03**: Where-used list showing categories/properties using this subobject
- [x] **SUB-04**: Edit icons in draft mode

### Module Detail

- [x] **MOD-01**: Header with name, label, description
- [x] **MOD-02**: Direct members list (categories, properties, subobjects, templates)
- [x] **MOD-03**: Computed closure view showing auto-included dependencies
- [x] **MOD-04**: Dependencies list (other modules this one depends on)
- [x] **MOD-05**: Edit icons for adding/removing members in draft mode
- [x] **MOD-06**: Suggested version increment display

### Bundle Detail

- [x] **BND-01**: Header with name, label, description
- [x] **BND-02**: Modules list
- [x] **BND-03**: Computed closure view (all entities via modules)
- [x] **BND-04**: Edit icons for adding/removing modules in draft mode
- [x] **BND-05**: Suggested version increment display

### Template Detail

- [x] **TPL-01**: Header with name, label, description
- [x] **TPL-02**: Wikitext content display (read-only view)
- [x] **TPL-03**: Wikitext editor in draft mode (simple text area)
- [x] **TPL-04**: Module membership display

### Draft Workflow UI

- [x] **DWF-01**: Draft banner shows title, status, validate button, submit PR button
- [x] **DWF-02**: Validate button triggers validation and shows inline results
- [x] **DWF-03**: Change highlighting with green/amber/red badges
- [x] **DWF-04**: Diff view showing per-entity changes grouped by type
- [x] **DWF-05**: Submit PR disabled until validation passes (no errors)

### PR Submission

- [x] **PR-01**: GitHub OAuth flow at PR submission time (existing v1.0 pattern)
- [x] **PR-02**: Generate file changes from effective JSON
- [x] **PR-03**: Create branch and commit with all draft changes
- [x] **PR-04**: Open PR with structured summary (categorized changes, validation results)
- [x] **PR-05**: Include suggested semver increments for modules/bundles in PR body

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
| DB-01 | Phase 8 | Complete |
| DB-02 | Phase 8 | Complete |
| DB-03 | Phase 8 | Complete |
| DB-04 | Phase 8 | Complete |
| DB-05 | Phase 8 | Complete |
| DB-06 | Phase 8 | Complete |
| DB-07 | Phase 8 | Complete |
| DB-08 | Phase 8 | Complete |
| DB-09 | Phase 8 | Complete |
| ING-01 | Phase 9 | Complete |
| ING-02 | Phase 9 | Complete |
| ING-03 | Phase 9 | Complete |
| ING-04 | Phase 9 | Complete |
| ING-05 | Phase 9 | Complete |
| ING-06 | Phase 9 | Complete |
| ING-07 | Phase 9 | Complete |
| QRY-01 | Phase 10 | Complete |
| QRY-02 | Phase 10 | Complete |
| QRY-03 | Phase 10 | Complete |
| QRY-04 | Phase 10 | Complete |
| QRY-05 | Phase 10 | Complete |
| QRY-06 | Phase 10 | Complete |
| QRY-07 | Phase 10 | Complete |
| GRP-01 | Phase 10 | Complete |
| GRP-02 | Phase 10 | Complete |
| GRP-03 | Phase 10 | Complete |
| GRP-04 | Phase 10 | Complete |
| DRF-01 | Phase 11 | Complete |
| DRF-02 | Phase 11 | Complete |
| DRF-03 | Phase 11 | Complete |
| DRF-04 | Phase 11 | Complete |
| DRF-05 | Phase 11 | Complete |
| DRF-06 | Phase 11 | Complete |
| DRF-07 | Phase 11 | Complete |
| FE-01 | Phase 12 | Complete |
| FE-02 | Phase 12 | Complete |
| FE-03 | Phase 12 | Complete |
| FE-04 | Phase 12 | Complete |
| FE-05 | Phase 12 | Complete |
| FE-06 | Phase 12 | Complete |
| GV-01 | Phase 12 | Complete |
| GV-02 | Phase 12 | Complete |
| GV-03 | Phase 12 | Complete |
| GV-04 | Phase 12 | Complete |
| GV-05 | Phase 12 | Complete |
| GV-06 | Phase 12 | Complete |
| GV-07 | Phase 12 | Complete |
| CAT-01 | Phase 13 | Complete |
| CAT-02 | Phase 13 | Complete |
| CAT-03 | Phase 13 | Complete |
| CAT-04 | Phase 13 | Complete |
| CAT-05 | Phase 13 | Complete |
| CAT-06 | Phase 13 | Complete |
| PRP-01 | Phase 13 | Complete |
| PRP-02 | Phase 13 | Complete |
| PRP-03 | Phase 13 | Complete |
| PRP-04 | Phase 13 | Complete |
| SUB-01 | Phase 13 | Complete |
| SUB-02 | Phase 13 | Complete |
| SUB-03 | Phase 13 | Complete |
| SUB-04 | Phase 13 | Complete |
| MOD-01 | Phase 13 | Complete |
| MOD-02 | Phase 13 | Complete |
| MOD-03 | Phase 13 | Complete |
| MOD-04 | Phase 13 | Complete |
| MOD-05 | Phase 13 | Complete |
| MOD-06 | Phase 13 | Complete |
| BND-01 | Phase 13 | Complete |
| BND-02 | Phase 13 | Complete |
| BND-03 | Phase 13 | Complete |
| BND-04 | Phase 13 | Complete |
| BND-05 | Phase 13 | Complete |
| TPL-01 | Phase 13 | Complete |
| TPL-02 | Phase 13 | Complete |
| TPL-03 | Phase 13 | Complete |
| TPL-04 | Phase 13 | Complete |
| VAL-01 | Phase 14 | Complete |
| VAL-02 | Phase 14 | Complete |
| VAL-03 | Phase 14 | Complete |
| VAL-04 | Phase 14 | Complete |
| VAL-05 | Phase 14 | Complete |
| VAL-06 | Phase 14 | Complete |
| DWF-01 | Phase 14 | Complete |
| DWF-02 | Phase 14 | Complete |
| DWF-03 | Phase 14 | Complete |
| DWF-04 | Phase 14 | Complete |
| DWF-05 | Phase 14 | Complete |
| PR-01 | Phase 14 | Complete |
| PR-02 | Phase 14 | Complete |
| PR-03 | Phase 14 | Complete |
| PR-04 | Phase 14 | Complete |
| PR-05 | Phase 14 | Complete |

**Coverage:**
- v2.0 requirements: 92 total
- Mapped to phases: 92
- Unmapped: 0

---
*Requirements defined: 2026-01-23*
*Last updated: 2026-01-25 (All v2.0 requirements complete — 92/92)*
