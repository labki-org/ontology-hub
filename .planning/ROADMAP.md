# Roadmap: Ontology Hub

## Overview

Ontology Hub transforms a wiki admin's local schema changes into a GitHub PR through six progressive phases: foundation infrastructure, GitHub indexing, entity browsing, draft proposal system, validation engine, and PR integration. Each phase builds on the previous, with browsing features depending on indexed data, drafts comparing against indexed schemas, validation analyzing drafts, and PR creation consuming validated changes. The journey prioritizes security architecture early (capability URLs, token handling) since these cannot be retrofitted.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Docker infrastructure, PostgreSQL schema, capability URL security, rate limiting
- [x] **Phase 2: GitHub Integration** - Repository indexing, entity API, webhook handling
- [x] **Phase 3: Entity Browsing** - Entity pages, search, inheritance graphs, used-by references
- [ ] **Phase 4: Modules and Versioning** - Module/profile browsing, version listing, diff views
- [ ] **Phase 5: Draft System** - Draft ingestion, capability URL access, review UI, module editing
- [ ] **Phase 6: Validation Engine** - Consistency checks, breaking change detection, semver classification
- [ ] **Phase 7: PR Integration** - GitHub OAuth, branch/commit/PR creation, structured summaries

## Phase Details

### Phase 1: Foundation
**Goal**: Core infrastructure ready for development: Docker container running, PostgreSQL with entity schema, capability URL system with fragment-based tokens, rate limiting per IP
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-04
**Success Criteria** (what must be TRUE):
  1. Developer can run `docker compose up` and have backend + database running locally
  2. Database schema supports entities (categories, properties, subobjects), modules, profiles, and drafts
  3. Capability tokens are generated securely and stored as hashes only (never plaintext)
  4. API endpoints return proper 429 responses when rate limits exceeded
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Docker Compose, FastAPI scaffold, SQLModel database schema, Alembic migrations
- [x] 01-02-PLAN.md — Capability URL token system, SlowAPI rate limiting, draft API endpoints

### Phase 2: GitHub Integration
**Goal**: Platform indexes SemanticSchemas GitHub repository and exposes entity data via API
**Depends on**: Phase 1
**Requirements**: INFR-02
**Success Criteria** (what must be TRUE):
  1. Platform fetches and parses all entity files from the canonical GitHub repository
  2. Indexed entities are stored in PostgreSQL with commit SHA for versioning
  3. API endpoints return entity data (GET /entities/{type}/{id})
  4. Webhook handler processes push events to re-index changed files
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — GitHub API client with httpx, indexer service with upsert logic, database migration for unique constraint, manual sync endpoint
- [x] 02-02-PLAN.md — Entity API endpoints with cursor-based pagination
- [x] 02-03-PLAN.md — Webhook handler with HMAC verification and background sync

### Phase 3: Entity Browsing
**Goal**: Users can browse, search, and explore entity relationships in the UI
**Depends on**: Phase 2
**Requirements**: BRWS-01, BRWS-02, BRWS-03, BRWS-04, BRWS-05
**Success Criteria** (what must be TRUE):
  1. User can view detail page for any category, property, or subobject showing all fields
  2. User can search entities by name and find matching results instantly
  3. User can see inheritance graph showing parent/child category relationships
  4. User can see which categories use a given property or subobject
  5. Entity pages display ID, label, description, module membership, and full schema definition
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md — React app scaffolding with Vite, sidebar layout, entity detail pages
- [x] 03-02-PLAN.md — Search API endpoint and frontend search with debounce
- [x] 03-03-PLAN.md — Inheritance graph visualization and used-by references
- [x] 03-04-PLAN.md — Module membership display on entity pages (gap closure)

### Phase 4: Modules and Versioning
**Goal**: Users can browse modules, profiles, and version history with diff views
**Depends on**: Phase 3
**Requirements**: MODL-01, MODL-02, MODL-03, MODL-04, VERS-01, VERS-02, VERS-03
**Success Criteria** (what must be TRUE):
  1. User can browse list of modules seeing included entities and dependencies
  2. User can browse list of profiles seeing which modules compose each profile
  3. User can view module dependency visualization showing which modules depend on which
  4. Module pages show warnings when entities appear in multiple modules (overlap detection)
  5. User can view list of releases with dates and version labels
  6. User can view field-level diff between any two versions categorized by change type
**Plans**: TBD

Plans:
- [ ] 04-01: Module and profile browsing pages
- [ ] 04-02: Module dependency visualization and overlap warnings
- [ ] 04-03: Version listing and diff views

### Phase 5: Draft System
**Goal**: Wiki admins can submit drafts via API, access them via capability URLs, and review changes with module editing
**Depends on**: Phase 4
**Requirements**: DRFT-01, DRFT-02, DRFT-03, DRFT-04, DRFT-05, DRFT-06, DRFT-07, DRFT-08, INFR-03
**Success Criteria** (what must be TRUE):
  1. API accepts POST with draft payload and returns capability URL (no auth required)
  2. Drafts are only accessible via capability URL; direct ID access returns 404
  3. Drafts expire and become inaccessible after TTL (default 7 days)
  4. Draft review UI shows field-level diffs grouped by entity type
  5. User can assign new entities to modules and edit module membership (categories only)
  6. User can create/edit profile module lists as part of draft
  7. Module/profile editing shows dependency feedback (missing deps, redundancy warnings)
**Plans**: TBD

Plans:
- [ ] 05-01: Draft ingestion API and capability URL access
- [ ] 05-02: Draft review UI with diffs
- [ ] 05-03: Module and profile editing in drafts

### Phase 6: Validation Engine
**Goal**: Drafts are validated for consistency and breaking changes with inline feedback
**Depends on**: Phase 5
**Requirements**: VALD-01, VALD-02, VALD-03, VALD-04, VALD-05, VALD-06
**Success Criteria** (what must be TRUE):
  1. Validation checks that all referenced IDs exist (parents, properties, module members)
  2. Validation detects and reports circular category inheritance
  3. Validation checks datatypes are in the allowed set
  4. Validation checks for breaking changes: datatype changes, multiplicity changes, removals
  5. Validation suggests semver classification (major/minor/patch) per change
  6. Validation feedback displays inline in draft review UI with clear severity indicators
**Plans**: TBD

Plans:
- [ ] 06-01: Reference and consistency validation
- [ ] 06-02: Breaking change detection and semver classification
- [ ] 06-03: Inline validation display in draft UI

### Phase 7: PR Integration
**Goal**: Users can create GitHub PRs from validated drafts with structured summaries
**Depends on**: Phase 6
**Requirements**: GHUB-01, GHUB-02, GHUB-03, GHUB-04, GHUB-05
**Success Criteria** (what must be TRUE):
  1. GitHub OAuth login is triggered only when user clicks "Open PR" button
  2. Platform creates branch, commits changes, and opens PR via GitHub API
  3. PR body includes structured summary of changes categorized by type
  4. PR body includes validation report and suggested semver bump
  5. PR body references originating wiki and base schema version if provided in draft
**Plans**: TBD

Plans:
- [ ] 07-01: GitHub OAuth flow
- [ ] 07-02: PR creation with structured summary

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-01-21 |
| 2. GitHub Integration | 3/3 | Complete | 2026-01-21 |
| 3. Entity Browsing | 4/4 | Complete | 2026-01-21 |
| 4. Modules and Versioning | 0/3 | Not started | - |
| 5. Draft System | 0/3 | Not started | - |
| 6. Validation Engine | 0/3 | Not started | - |
| 7. PR Integration | 0/2 | Not started | - |

---
*Roadmap created: 2025-01-20*
*Total phases: 7 | Total plans: 20 (estimated)*
*Coverage: 25/25 v1 requirements mapped*
