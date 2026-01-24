# Roadmap: Ontology Hub

## Milestones

- [x] **v1.0 MVP** - Phases 1-7 (shipped 2026-01-23)
- [ ] **v2.0 Platform Rebuild** - Phases 8-14 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-7) - SHIPPED 2026-01-23</summary>

See: .planning/MILESTONES.md for v1.0 summary.

Phases 1-7 delivered the complete MVP: Docker infrastructure, GitHub indexing, React frontend with entity browsing, draft system with capability URLs, validation engine, and GitHub OAuth PR creation.

</details>

### v2.0 Platform Rebuild (In Progress)

**Milestone Goal:** Full database/API/frontend rebuild with versioned canonical data, relationship tables, draft-as-deltas, and graph visualization.

**Phase Numbering:**
- Integer phases (8, 9, ...): Planned milestone work
- Decimal phases (8.1, 8.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 8: Database Foundation** - Versioned schema with normalized relationships
- [ ] **Phase 9: Ingest Pipeline** - Populate schema from canonical repo
- [ ] **Phase 10: Query Layer** - Version-scoped reads with graph endpoints
- [ ] **Phase 11: Draft System** - JSON Patch storage with effective view computation
- [ ] **Phase 12: Frontend + Graph Visualization** - Unified browse/draft UI with module hulls
- [ ] **Phase 13: Entity Detail Pages** - All entity types with edit mode
- [ ] **Phase 14: Validation + Workflow + PR** - Final validation and PR submission

## Phase Details

### Phase 8: Database Foundation
**Goal**: Establish v2.0 schema with canonical tables, normalized relationship storage, and materialized inheritance views (only latest version retained)
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05, DB-06, DB-07, DB-08, DB-09
**Success Criteria** (what must be TRUE):
  1. ontology_version table tracks current canonical state (commit SHA, ingest status) — only latest retained
  2. Entity tables (category, property, subobject, module, bundle, template) store canonical JSON with entity_key and source_path
  3. Relationship tables (category_parent, category_property, module_entity, bundle_module) capture normalized relationships
  4. category_property_effective materialized view precomputes inherited properties with source + depth provenance
  5. draft and draft_change tables ready for delta storage with base_commit_sha for auto-rebase
**Plans**: TBD

### Phase 9: Ingest Pipeline
**Goal**: Populate v2.0 schema from labki-schemas repo via webhook, replacing previous data with latest
**Depends on**: Phase 8
**Requirements**: ING-01, ING-02, ING-03, ING-04, ING-05, ING-06, ING-07
**Success Criteria** (what must be TRUE):
  1. Webhook endpoint receives push notification and triggers ingest from latest commit
  2. All entity types parsed and stored in canonical tables (replacing previous data)
  3. Relationship tables populated (category_parent, category_property, module_entity, bundle_module)
  4. category_property_effective materialized view refreshed with correct inheritance
  5. Ingest warnings/errors captured in ontology_version record
**Plans**: TBD

### Phase 10: Query Layer
**Goal**: Provide entity queries and graph endpoints supporting canonical and draft contexts
**Depends on**: Phase 9
**Requirements**: QRY-01, QRY-02, QRY-03, QRY-04, QRY-05, QRY-06, QRY-07, GRP-01, GRP-02, GRP-03, GRP-04
**Success Criteria** (what must be TRUE):
  1. Entity queries return current canonical data (only one version exists)
  2. Entity queries accept draft_id and return effective view (canonical + draft overlay computed server-side)
  3. Category detail returns parents, direct properties, and inherited properties with provenance
  4. Neighborhood graph endpoint returns nodes/edges within specified depth with module membership
  5. Graph nodes include change status badges (added/modified/deleted) when draft context provided
**Plans**: TBD

### Phase 11: Draft System
**Goal**: Store draft changes as JSON Patch deltas with server-side effective view computation and auto-rebase on canonical updates
**Depends on**: Phase 10
**Requirements**: DRF-01, DRF-02, DRF-03, DRF-04, DRF-05, DRF-06, DRF-07
**Success Criteria** (what must be TRUE):
  1. Draft creation binds to base_commit_sha for tracking
  2. Draft changes stored as JSON Patch for updates, full replacement for creates
  3. Effective view computation overlays draft changes on canonical data correctly
  4. Localized re-materialization handles inheritance changes during draft edits
  5. Auto-rebase: when new canonical is ingested, in-progress drafts rebase automatically
  6. MediaWiki push import creates draft_change rows from payload
**Plans**: TBD

### Phase 12: Frontend + Graph Visualization
**Goal**: Build unified browse/draft frontend with graph panel featuring module hull overlays
**Depends on**: Phase 11
**Requirements**: FE-01, FE-02, FE-03, FE-04, FE-05, FE-06, GV-01, GV-02, GV-03, GV-04, GV-05, GV-06, GV-07
**Success Criteria** (what must be TRUE):
  1. Left sidebar shows collapsible sections for all entity types with search filtering
  2. Entity lists show change badges in draft mode (added/modified/deleted)
  3. Version selector allows choosing ontology version; draft selector shows current draft with status
  4. Graph panel displays category-centered view with depth control (1-3 levels) and edge type filtering
  5. Module hull overlays render using d3-polygon with multi-hull display and toggle controls
**Plans**: TBD

### Phase 13: Entity Detail Pages
**Goal**: Implement detail pages for all six entity types with view and edit modes
**Depends on**: Phase 12
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, PRP-01, PRP-02, PRP-03, PRP-04, SUB-01, SUB-02, SUB-03, SUB-04, MOD-01, MOD-02, MOD-03, MOD-04, MOD-05, MOD-06, BND-01, BND-02, BND-03, BND-04, BND-05, TPL-01, TPL-02, TPL-03, TPL-04
**Success Criteria** (what must be TRUE):
  1. Category page shows parents, direct/inherited properties with provenance, module membership, and edit icons in draft mode
  2. Property page shows datatype/cardinality, where-used list, module membership, and edit icons in draft mode
  3. Subobject page shows properties, where-used list, and edit icons in draft mode
  4. Module page shows direct members, computed closure, dependencies, suggested version increment, and edit icons
  5. Bundle page shows modules, computed closure, suggested version increment, and edit icons
  6. Template page shows wikitext content with simple text editor in draft mode
**Plans**: TBD

### Phase 14: Validation + Workflow + PR
**Goal**: Complete validation engine, draft workflow UI, and GitHub PR submission
**Depends on**: Phase 13
**Requirements**: VAL-01, VAL-02, VAL-03, VAL-04, VAL-05, VAL-06, DWF-01, DWF-02, DWF-03, DWF-04, DWF-05, PR-01, PR-02, PR-03, PR-04, PR-05
**Success Criteria** (what must be TRUE):
  1. Validation checks JSON Schema compliance, reference resolution, circular inheritance, and breaking changes
  2. Validation returns structured messages with entity_key, field_path, severity, and code
  3. Draft banner shows title, status, validate button, and submit PR button (disabled until validation passes)
  4. Diff view shows per-entity changes grouped by type with change highlighting
  5. PR creation generates file changes, creates branch/commit, and opens PR with structured summary including semver suggestions
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 8.1 -> 8.2 -> 9 -> ...

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v1.0 | 20/20 | Complete | 2026-01-23 |
| 8. Database Foundation | v2.0 | 0/TBD | Not started | - |
| 9. Ingest Pipeline | v2.0 | 0/TBD | Not started | - |
| 10. Query Layer | v2.0 | 0/TBD | Not started | - |
| 11. Draft System | v2.0 | 0/TBD | Not started | - |
| 12. Frontend + Graph | v2.0 | 0/TBD | Not started | - |
| 13. Entity Detail Pages | v2.0 | 0/TBD | Not started | - |
| 14. Validation + Workflow + PR | v2.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-01-23*
*v2.0 phases: 8-14 (7 phases, 92 requirements)*
*Last updated: 2026-01-23 (simplified versioning model)*
