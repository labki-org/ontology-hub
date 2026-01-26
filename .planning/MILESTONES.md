# Project Milestones: Ontology Hub

## v2.1 Bug Fixes & UX Improvements (Shipped: 2026-01-25)

**Delivered:** Fixed all entity detail loading, restored draft workflow (validate/submit PR), added inline editing with hover controls, change propagation visualization, and full entity CRUD within drafts.

**Phases completed:** 16-22 (24 plans total)

**Key accomplishments:**
- Fixed entity detail loading for all 6 entity types (subobjects, templates, modules, bundles)
- Graph visualization renders properties, subobjects, templates as distinct SVG shapes with hover highlighting
- Inline editing with hover-reveal edit/delete icons in draft mode
- Change propagation tracking with two-tier sidebar highlighting (direct vs transitive)
- Full entity CRUD: Create via "+ New" buttons, delete with dependency checking, cascading create flow
- Restored draft workflow: Validate/Submit PR buttons, OAuth redirect, auto-generated PR titles
- Entity lifecycle fixes: Graph auto-updates on creation, delete works for newly created entities

**Stats:**
- 115 files created/modified
- ~36,360 lines of code (17,134 Python + 19,226 TypeScript)
- 7 phases, 24 plans
- 5 days from v2.0 ship to v2.1 ship

**Git range:** `feat(16-02)` → `fix(22-02)`

**Bugs fixed:** BUG-001 (graph update), BUG-002 (delete new entities), BUG-003 (buttons disabled)

**What's next:** Production deployment, performance optimization, user feedback integration

---

## v2.0 Platform Rebuild (Shipped: 2026-01-25)

**Delivered:** Full database/API/frontend rebuild with versioned canonical data, relationship tables, draft-as-deltas with auto-rebase, and graph visualization with module hull overlays.

**Phases completed:** 8-15 (41 plans total)

**Key accomplishments:**
- Versioned database schema with normalized relationship tables and materialized inheritance views
- Webhook-triggered ingest pipeline populating canonical tables from GitHub repo
- Draft-as-deltas system with JSON Patch storage, auto-rebase, and MediaWiki import
- Graph query layer with recursive CTEs, draft overlay, and module-scoped endpoints
- Unified browse/draft frontend with force-directed graph visualization and module hull overlays
- Complete entity detail pages (6 entity types) with view/edit modes and auto-save
- Validation engine v2 + PR submission workflow with GitHub OAuth integration

**Stats:**
- 223 files created/modified
- ~30,400 lines of code (15,654 Python + 14,779 TypeScript)
- 8 phases, 41 plans, 92 requirements
- 2 days from start to ship

**Git range:** `docs(08): research phase domain` → `fix: resolve 404 and 500 errors on v2 draft creation endpoint`

**What's next:** Production testing, user feedback integration, performance optimization

---

## v1.0 MVP (Shipped: 2026-01-23)

**Delivered:** Complete platform for wiki admins to browse SemanticSchemas ontology and submit schema changes as GitHub PRs with validation feedback.

**Phases completed:** 1-7 (20 plans total)

**Key accomplishments:**
- Docker infrastructure with PostgreSQL, capability URL security, and IP-based rate limiting
- GitHub repository indexing with entity API and webhook-triggered auto-sync
- React frontend with entity browsing, inheritance graphs, search, and used-by references
- Module/profile browsing with dependency visualization and version diff viewer
- Draft system with capability URLs, inline field editing, and module/profile management
- Validation engine with reference checks, circular inheritance detection, breaking change detection, and semver classification
- GitHub OAuth integration with atomic PR creation via Git Data API

**Stats:**
- 202 files created/modified
- 15,392 lines of code (8,355 Python + 7,037 TypeScript)
- 7 phases, 20 plans
- 2 days from start to ship

**Git range:** `docs: initialize project` → `fix(07): make drafts additive`

**What's next:** Production deployment with VPS, Caddy reverse proxy, and domain configuration

---
