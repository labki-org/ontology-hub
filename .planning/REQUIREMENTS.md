# Requirements: Ontology Hub

**Defined:** 2026-01-27
**Core Value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.

## v1.1.0 Requirements

Requirements for Dashboard and Resource entity types milestone.

### Dashboard Entity

- [ ] **DASH-01**: Dashboard JSON schema defined in labki-ontology
- [ ] **DASH-02**: Dashboard database table with pages JSONB column
- [ ] **DASH-03**: Dashboard ingest from repo webhooks
- [ ] **DASH-04**: Dashboard list/detail API endpoints
- [ ] **DASH-05**: Dashboard graph visualization with document-shaped node
- [ ] **DASH-06**: Dashboard detail page with pages accordion view
- [ ] **DASH-07**: Dashboard create/edit form with wikitext editor
- [ ] **DASH-08**: Modules can reference dashboards array
- [ ] **DASH-09**: Bundles can reference dashboards array

### Resource Entity

- [ ] **RSRC-01**: Resource JSON schema with additionalProperties:true
- [ ] **RSRC-02**: Resource database table with category_key reference
- [ ] **RSRC-03**: Resource ingest with hierarchical paths (like templates)
- [ ] **RSRC-04**: Resource list/detail API endpoints with path support
- [ ] **RSRC-05**: Resources queryable by category
- [ ] **RSRC-06**: Resource graph visualization with form-shaped node
- [ ] **RSRC-07**: Resource detail page with dynamic category fields
- [ ] **RSRC-08**: Resource create/edit form with category-driven fields

### Auto-Derivation Chain

- [ ] **DERV-01**: Properties with allowed_values.from_category auto-include referenced category
- [ ] **DERV-02**: Categories in module auto-include their resources
- [ ] **DERV-03**: Derivation chain handles cycles with visited sets
- [ ] **DERV-04**: Draft patches use "add" op for derived arrays

### Integration

- [ ] **INTG-01**: Draft CRUD for dashboards and resources
- [ ] **INTG-02**: Resource field validation against category properties
- [ ] **INTG-03**: PR submission includes dashboard/resource files
- [ ] **INTG-04**: End-to-end derivation chain verified

## Out of Scope

| Feature | Reason |
|---------|--------|
| MediaWiki live sync | SemanticSchemas extension update separate project |
| Wikitext preview rendering | Would require MediaWiki parser; show raw for now |
| Resource versioning | Use repo version history |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DASH-01 | Phase 23 | Complete |
| DASH-02 | Phase 24 | Pending |
| DASH-03 | Phase 25 | Pending |
| DASH-04 | Phase 26 | Pending |
| DASH-05 | Phase 29 | Pending |
| DASH-06 | Phase 30 | Pending |
| DASH-07 | Phase 31 | Pending |
| DASH-08 | Phase 23 | Complete |
| DASH-09 | Phase 23 | Complete |
| RSRC-01 | Phase 23 | Complete |
| RSRC-02 | Phase 24 | Pending |
| RSRC-03 | Phase 25 | Pending |
| RSRC-04 | Phase 26 | Pending |
| RSRC-05 | Phase 26 | Pending |
| RSRC-06 | Phase 29 | Pending |
| RSRC-07 | Phase 30 | Pending |
| RSRC-08 | Phase 31 | Pending |
| DERV-01 | Phase 27 | Pending |
| DERV-02 | Phase 27 | Pending |
| DERV-03 | Phase 27 | Pending |
| DERV-04 | Phase 27 | Pending |
| INTG-01 | Phase 28 | Pending |
| INTG-02 | Phase 28 | Pending |
| INTG-03 | Phase 32 | Pending |
| INTG-04 | Phase 32 | Pending |

**Coverage:**
- v1.1.0 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-27 after milestone definition*
