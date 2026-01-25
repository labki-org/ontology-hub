# Roadmap: Ontology Hub

## Milestones

- [x] **v1.0 MVP** - Phases 1-7 (shipped 2026-01-23)
- [x] **v2.0 Platform Rebuild** - Phases 8-15 (shipped 2026-01-25)
- [ ] **v2.1 Bug Fixes & UX Improvements** - Phases 16-20 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-7) - SHIPPED 2026-01-23</summary>

See: .planning/milestones/v1.0-ROADMAP.md for full details.

Phases 1-7 delivered the complete MVP: Docker infrastructure, GitHub indexing, React frontend with entity browsing, draft system with capability URLs, validation engine, and GitHub OAuth PR creation.

</details>

<details>
<summary>v2.0 Platform Rebuild (Phases 8-15) - SHIPPED 2026-01-25</summary>

See: .planning/milestones/v2.0-ROADMAP.md for full details.

Phases 8-15 delivered the full platform rebuild: Versioned database schema with normalized relationship tables, webhook-triggered ingest pipeline, draft-as-deltas system with auto-rebase, graph query layer with recursive CTEs, unified browse/draft frontend with graph visualization and module hull overlays, complete entity detail pages for all 6 types, and validation + PR submission workflow.

</details>

### v2.1 Bug Fixes & UX Improvements (Phases 16-20)

---

### Phase 16: Core Bug Fixes

**Goal:** Users can reliably view all entity types and use draft workflow actions.

**Dependencies:** None (first phase of milestone)

**Requirements:** ENTITY-01, ENTITY-02, ENTITY-03, ENTITY-04, DRAFT-01, DRAFT-02, DRAFT-03

**Success Criteria:**
1. User can click on subobject in sidebar and see its details without error
2. User can click on template in sidebar and see its details without error
3. User can click on module in sidebar and see its details without error
4. User can click on bundle in sidebar and see its details without error
5. User can click Validate button in draft mode and see validation results
6. User can click Submit PR button in draft mode and navigate to PR workflow
7. User sees validation results update automatically after making draft changes

---

### Phase 17: Graph View Fixes

**Goal:** Graph visualization renders all entity types with smooth visual boundaries.

**Dependencies:** Phase 16 (entity details must load for graph context)

**Requirements:** GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04

**Success Criteria:**
1. User sees properties as distinct colored nodes in graph view (not just categories)
2. User sees subobjects as distinct colored nodes in graph view
3. User sees templates as distinct colored nodes in graph view
4. User sees module hull boundaries with smooth curves (not jagged polygon edges)

---

### Phase 18: Inline Editing UX

**Goal:** Users can edit entities in-place with intuitive hover controls.

**Dependencies:** Phase 16 (entity details must load for editing)

**Requirements:** EDIT-01, EDIT-02, EDIT-03, EDIT-04

**Success Criteria:**
1. User sees pencil icon appear when hovering over editable field in detail modal (draft mode)
2. User sees trash icon appear when hovering over deletable field in detail modal (draft mode)
3. User sees edit/delete icons when viewing entity in expanded sidebar view (draft mode)
4. User can click edit icon and modify field value inline without opening separate form

---

### Phase 19: Change Propagation

**Goal:** Users can see the impact of their changes across the dependency graph.

**Dependencies:** Phase 18 (edits must work for propagation to display)

**Requirements:** PROP-01, PROP-02, PROP-03

**Success Criteria:**
1. User sees directly edited entity highlighted with strong visual indicator (e.g., bold border, colored background) in sidebar
2. User sees transitively affected entities highlighted with subtle visual indicator (e.g., light background, dotted border) in sidebar
3. User can understand which entities inherit or depend on edited entity via visual cues

---

### Phase 20: Entity Management

**Goal:** Users can create and delete entities within drafts.

**Dependencies:** Phase 16 (draft workflow must work), Phase 18 (editing UX patterns established)

**Requirements:** MGMT-01, MGMT-02, MGMT-03, MGMT-04, MGMT-05, MGMT-06, MGMT-07, MGMT-08

**Success Criteria:**
1. User sees "+ New Category" button in sidebar Categories section (draft mode only)
2. User can create new property/subobject/template/module/bundle via respective "+ New" buttons
3. User can delete an entity from draft and see it removed from sidebar
4. User can add a dependency relationship to an existing entity

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> ... -> 20

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v1.0 | 20/20 | Complete | 2026-01-23 |
| 8-15 | v2.0 | 41/41 | Complete | 2026-01-25 |
| 16 | v2.1 | 0/? | Pending | — |
| 17 | v2.1 | 0/? | Pending | — |
| 18 | v2.1 | 0/? | Pending | — |
| 19 | v2.1 | 0/? | Pending | — |
| 20 | v2.1 | 0/? | Pending | — |

**Total:** 61 plans completed across 15 phases (v1.0 + v2.0)
**v2.1:** 5 phases, 26 requirements, 0 plans (roadmap just created)

---
*Roadmap created: 2026-01-23*
*v2.0 shipped: 2026-01-25 (archived to milestones/v2.0-ROADMAP.md)*
*v2.1 roadmap added: 2026-01-24*
