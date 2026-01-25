# Requirements: Ontology Hub

**Defined:** 2026-01-24
**Core Value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.

## v2.1 Requirements

Requirements for bug fixes and UX improvements. Each maps to roadmap phases.

### Entity Details

- [ ] **ENTITY-01**: User can view subobject details without "Failed to load" error
- [ ] **ENTITY-02**: User can view template details without "Failed to load" error
- [ ] **ENTITY-03**: User can view module details without "Failed to load" error
- [ ] **ENTITY-04**: User can view bundle details without "Failed to load" error

### Draft Workflow

- [ ] **DRAFT-01**: User can click Validate button in draft mode
- [ ] **DRAFT-02**: User can click Submit PR button in draft mode
- [ ] **DRAFT-03**: Auto-validation triggers when user makes changes to draft

### Graph View

- [ ] **GRAPH-01**: Properties render as distinct node type in graph view
- [ ] **GRAPH-02**: Subobjects render as distinct node type in graph view
- [ ] **GRAPH-03**: Templates render as distinct node type in graph view
- [ ] **GRAPH-04**: Module hull boundaries render smoothly (not jagged)

### Inline Editing

- [ ] **EDIT-01**: Edit icon appears on hover for editable fields in draft mode (detail modal)
- [ ] **EDIT-02**: Delete icon appears on hover for deletable fields in draft mode (detail modal)
- [ ] **EDIT-03**: Edit/delete icons appear in expanded entity view in draft mode
- [ ] **EDIT-04**: User can edit field inline by clicking edit icon

### Change Propagation

- [ ] **PROP-01**: Sidebar highlights directly edited entities with strong visual indicator
- [ ] **PROP-02**: Sidebar highlights transitively affected entities with subtle visual indicator
- [ ] **PROP-03**: System calculates full dependency chain for edited entities

### Entity Management

- [ ] **MGMT-01**: User can create new category via "+ New Category" button in sidebar
- [ ] **MGMT-02**: User can create new property via "+ New Property" button in sidebar
- [ ] **MGMT-03**: User can create new subobject via "+ New Subobject" button in sidebar
- [ ] **MGMT-04**: User can create new template via "+ New Template" button in sidebar
- [ ] **MGMT-05**: User can create new module via "+ New Module" button in sidebar
- [ ] **MGMT-06**: User can create new bundle via "+ New Bundle" button in sidebar
- [ ] **MGMT-07**: User can delete entity in draft mode
- [ ] **MGMT-08**: User can add dependencies to existing entity

## Future Requirements

Deferred to later milestones:

### Performance
- **PERF-01**: Query optimization for large ontologies
- **PERF-02**: Caching layer for frequently accessed data

### Production
- **PROD-01**: VPS deployment with Caddy reverse proxy
- **PROD-02**: Monitoring and alerting setup
- **PROD-03**: Backup and recovery procedures

## Out of Scope

Explicitly excluded from v2.1:

| Feature | Reason |
|---------|--------|
| Major UI redesign | Focus is on fixing existing issues, not new UX paradigms |
| Performance optimization | Deferred to v2.2 or v3.0 |
| Production deployment | Deferred until bugs are fixed |
| New entity types | Current 6 types sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENTITY-01 | TBD | Pending |
| ENTITY-02 | TBD | Pending |
| ENTITY-03 | TBD | Pending |
| ENTITY-04 | TBD | Pending |
| DRAFT-01 | TBD | Pending |
| DRAFT-02 | TBD | Pending |
| DRAFT-03 | TBD | Pending |
| GRAPH-01 | TBD | Pending |
| GRAPH-02 | TBD | Pending |
| GRAPH-03 | TBD | Pending |
| GRAPH-04 | TBD | Pending |
| EDIT-01 | TBD | Pending |
| EDIT-02 | TBD | Pending |
| EDIT-03 | TBD | Pending |
| EDIT-04 | TBD | Pending |
| PROP-01 | TBD | Pending |
| PROP-02 | TBD | Pending |
| PROP-03 | TBD | Pending |
| MGMT-01 | TBD | Pending |
| MGMT-02 | TBD | Pending |
| MGMT-03 | TBD | Pending |
| MGMT-04 | TBD | Pending |
| MGMT-05 | TBD | Pending |
| MGMT-06 | TBD | Pending |
| MGMT-07 | TBD | Pending |
| MGMT-08 | TBD | Pending |

**Coverage:**
- v2.1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22 ⚠️

---
*Requirements defined: 2026-01-24*
*Last updated: 2026-01-24 after initial definition*
