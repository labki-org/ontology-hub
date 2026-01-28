# Roadmap: Ontology Hub

## Milestones

- ✅ **v1.0 MVP** — Phases 1-7 (shipped 2026-01-23)
- ✅ **v2.0 Platform Rebuild** — Phases 8-15 (shipped 2026-01-25)
- ✅ **v2.1 Bug Fixes & UX Improvements** — Phases 16-22 (shipped 2026-01-25)
- 🚧 **v1.1.0 Dashboard & Resource Entities** — Phases 23-32 (in progress)

## v1.1.0 Phases

### Phase 23: Ontology Schema Updates ✓
**Goal**: Define JSON schemas and repo structure for Dashboard and Resource entities in labki-ontology
**Requirements**: DASH-01, DASH-08, DASH-09, RSRC-01
**Plans:** 1 plan
Plans:
- [x] 23-01-PLAN.md — Fix entity-index, update dashboard/properties schemas, verify validation
**Status**: Complete (2026-01-27)
**Success Criteria**:
1. `dashboards/_schema.json` validates dashboard structure with pages array
2. `resources/_schema.json` validates resources with additionalProperties:true
3. Modules and bundles schema accepts `dashboards` array field
4. Example entities pass schema validation

### Phase 24: Database Schema ✓
**Goal**: Add tables for Dashboard and Resource entities
**Requirements**: DASH-02, RSRC-02
**Plans:** 2 plans
Plans:
- [x] 24-01-PLAN.md — Create Dashboard/Resource models, junction tables, enum updates
- [x] 24-02-PLAN.md — Alembic migration and database verification
**Status**: Complete (2026-01-28)
**Success Criteria**:
1. Dashboard table exists with pages JSONB column
2. Resource table exists with category_key foreign key
3. module_dashboard and bundle_dashboard relationship tables created
4. EntityType enum includes DASHBOARD and RESOURCE
5. Database reset and ingest succeeds

### Phase 25: Backend Ingest Pipeline
**Goal**: Parse and ingest Dashboard and Resource entities from repo
**Requirements**: DASH-03, RSRC-03
**Success Criteria**:
1. EntityParser handles dashboards/*.json files
2. EntityParser handles resources/**/*.json with hierarchical paths
3. Webhook triggers populate dashboard and resource tables
4. Relationship tables populated for module_dashboard, bundle_dashboard

### Phase 26: Backend API Endpoints
**Goal**: List and detail endpoints for new entities
**Requirements**: DASH-04, RSRC-04, RSRC-05
**Success Criteria**:
1. GET /dashboards returns list of dashboards
2. GET /dashboards/{key} returns dashboard with pages
3. GET /resources returns list with category filter support
4. GET /resources/{key:path} returns resource with dynamic fields
5. GET /categories/{key}/resources returns resources for category
6. Draft overlay applies to new entity endpoints

### Phase 27: Module Auto-Derivation Extension
**Goal**: Extend derivation to include categories from allowed_values and resources from categories
**Requirements**: DERV-01, DERV-02, DERV-03, DERV-04
**Success Criteria**:
1. Property with `allowed_values: {"from_category": "X"}` derives category X into module
2. Categories in module derive their resources into module
3. Derivation handles cycles without infinite loops
4. Draft patches use "add" op per CLAUDE.md

### Phase 28: Draft CRUD Support
**Goal**: Create/update/delete dashboards and resources in drafts
**Requirements**: INTG-01, INTG-02
**Success Criteria**:
1. POST /drafts/{id}/changes creates dashboard/resource
2. PATCH /drafts/{id}/changes/{key} updates with validation
3. DELETE /drafts/{id}/changes/{key} removes from draft
4. Resource fields validated against category properties

### Phase 29: Frontend Graph Visualization
**Goal**: Render Dashboard and Resource nodes in graph view
**Requirements**: DASH-05, RSRC-06
**Success Criteria**:
1. Dashboard nodes render as document shape (page with fold)
2. Resource nodes render as form shape (small rect)
3. Graph neighborhood queries include new entity types
4. Hover highlighting works for new entities

### Phase 30: Frontend Detail Components
**Goal**: Entity detail pages for viewing/editing dashboards and resources
**Requirements**: DASH-06, RSRC-07
**Success Criteria**:
1. DashboardDetail shows pages in accordion/tabs
2. ResourceDetail shows dynamic fields from category
3. Edit mode enables inline editing
4. Navigation from graph/sidebar works

### Phase 31: Frontend Create/Edit Forms
**Goal**: Forms for creating new dashboards and resources
**Requirements**: DASH-07, RSRC-08
**Success Criteria**:
1. DashboardForm supports page management and wikitext editing
2. ResourceForm renders category-driven fields dynamically
3. "+ New Dashboard" and "+ New Resource" buttons in sidebar
4. Form submission creates draft changes

### Phase 32: Integration Testing
**Goal**: Verify end-to-end functionality
**Requirements**: INTG-03, INTG-04
**Success Criteria**:
1. Dashboard/resource ingest works from real repo
2. Full derivation chain (allowed_values → category → resources) works
3. Draft CRUD verified for both entity types
4. PR submission includes correct file structure
5. All existing tests still pass

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> ... -> 32

| Milestone | Phases | Plans | Status | Completed |
|-----------|--------|-------|--------|-----------|
| v1.0 MVP | 1-7 | 20 | ✅ Complete | 2026-01-23 |
| v2.0 Platform Rebuild | 8-15 | 41 | ✅ Complete | 2026-01-25 |
| v2.1 Bug Fixes & UX | 16-22 | 24 | ✅ Complete | 2026-01-25 |
| v1.1.0 Dashboard & Resource | 23-32 | 4+ | 🚧 In Progress | — |

**Total:** 88 plans completed across 24 phases + 8 remaining phases

---
*Roadmap created: 2026-01-23*
*v1.0 shipped: 2026-01-23*
*v2.0 shipped: 2026-01-25*
*v2.1 shipped: 2026-01-25*
*v1.1.0 started: 2026-01-27*
