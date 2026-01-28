# Ontology Hub

## What This Is

A public platform for browsing, validating, and proposing changes to a shared Labki ontology maintained in GitHub. The platform provides a unified interface where the same UI and query logic serves both canonical browsing and draft editing—draft mode overlays deltas on canonical data. Wiki admins can create drafts from the Hub UI or push from MediaWiki, validate changes, and submit GitHub PRs. GitHub OAuth is only required at PR submission time.

## Core Value

Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.

## Current State: v2.1 Shipped

**Shipped:** 2026-01-25
**Codebase:** ~36,360 LOC (17,134 Python + 19,226 TypeScript)

**v2.1 delivered:**
- Entity detail endpoints for all 6 types (fixed subobjects, templates, modules, bundles)
- Graph visualization with distinct SVG shapes per entity type (diamond, hexagon, circle)
- Smooth Catmull-Rom module hull curves with labels
- Inline editing with hover-reveal edit/delete icons
- Change propagation tracking with two-tier sidebar highlighting
- Full entity CRUD: Create via "+ New" buttons, delete with dependency checking
- Cascading create flow for nested entities
- Fixed Validate/Submit PR buttons with proper status normalization
- Auto-generated PR titles based on change type/count
- Graph auto-updates on entity creation/deletion

## v2.0 Summary

**Shipped:** 2026-01-25
**Codebase:** ~30,400 LOC (15,654 Python + 14,779 TypeScript)

**v2.0 delivered:**
- Versioned database schema with normalized relationship tables and materialized inheritance views
- Webhook-triggered ingest pipeline populating canonical tables from GitHub repo
- Draft-as-deltas system with JSON Patch storage, auto-rebase, and MediaWiki import
- Graph query layer with recursive CTEs, draft overlay, and module-scoped endpoints
- Unified browse/draft frontend with force-directed graph visualization and module hull overlays
- Complete entity detail pages (6 entity types) with view/edit modes and auto-save
- Validation engine v2 + PR submission workflow with GitHub OAuth integration

## v1.0 Summary

**Shipped:** 2026-01-23
**Codebase:** 15,392 LOC (8,355 Python + 7,037 TypeScript)
**Stack:** FastAPI 0.115, React 19, Vite 7, PostgreSQL 17, Docker Compose
**Human verified:** https://github.com/labki-org/labki-schemas/pull/1

## Requirements

### Validated

**v1.0 (MVP):**
- ✓ Public browsing of entities (categories, properties, subobjects) with search and inheritance graphs — v1.0
- ✓ Module and profile browsing with dependency/overlap information — v1.0
- ✓ Version browsing with diff views between releases — v1.0
- ✓ Draft ingestion API accepting exports from MediaWiki (no auth required) — v1.0
- ✓ Capability-URL protected drafts with TTL expiration — v1.0
- ✓ Draft review UI with field-level diffs and validation feedback — v1.0
- ✓ Compatibility classification (major/minor/patch) per change — v1.0
- ✓ Module assignment for new entities in draft — v1.0
- ✓ GitHub OAuth triggered only at PR creation time — v1.0
- ✓ PR creation via GitHub API (branch, commit, PR with structured summary) — v1.0
- ✓ Module/profile creation and editing within drafts — v1.0
- ✓ Validation engine: consistency checks, breaking change detection, semver suggestions — v1.0

**v2.0 (Platform Rebuild):**
- ✓ Versioned database schema with normalized relationship tables — v2.0
- ✓ Materialized inheritance views (category_property_effective) — v2.0
- ✓ Webhook-triggered ingest pipeline from labki-schemas — v2.0
- ✓ Draft-as-deltas with JSON Patch storage — v2.0
- ✓ Auto-rebase for drafts when canonical updates — v2.0
- ✓ Graph query layer with recursive CTEs and draft overlay — v2.0
- ✓ Force-directed graph visualization with module hull overlays — v2.0
- ✓ Complete entity detail pages for all 6 types with edit mode — v2.0
- ✓ Template entity support (new entity type) — v2.0
- ✓ Unified browse/draft UI with same query logic — v2.0
- ✓ Validation engine v2 with JSON Schema validation — v2.0
- ✓ PR submission workflow with multi-step wizard — v2.0

**v2.1 (Bug Fixes & UX):**
- ✓ Entity detail pages work for all 6 types (subobjects, templates, modules, bundles) — v2.1
- ✓ Validate and Submit PR buttons clickable in draft mode — v2.1
- ✓ Auto-validation triggers on draft changes — v2.1
- ✓ Graph view renders properties, subobjects, templates as distinct node types — v2.1
- ✓ Smooth module hull rendering with Catmull-Rom curves — v2.1
- ✓ Inline editing with on-hover edit/delete icons in draft mode — v2.1
- ✓ Change propagation highlighting in sidebar (two-tier: direct vs transitive) — v2.1
- ✓ Create entities via "+ New [Type]" buttons in sidebar — v2.1
- ✓ Delete entities in draft mode with dependency checking — v2.1
- ✓ Add dependencies to existing entities via EntityCombobox — v2.1
- ✓ Graph auto-updates on entity creation/deletion — v2.1
- ✓ Auto-generated PR titles based on change content — v2.1

### Active

**v1.1.0 Dashboard & Resource Entities:**
- [ ] Dashboard entity type: documentation pages with SMW queries for modules/bundles
- [ ] Resource entity type: pre-written category content (like pre-filled forms)
- [ ] Auto-derivation chain: allowed_values.from_category → category → resources
- [ ] Full CRUD and graph visualization for new entity types

### Out of Scope

- Platform-native user accounts or saved workspaces — GitHub is the only identity provider, used only at PR time
- Social features (comments, likes, reputation) — not a community platform
- Hosting non-schema wiki content (dashboards, query pages) — separate future registry
- Runtime source-of-truth for schema deployment — GitHub remains authoritative
- Mobile-optimized UI — desktop-first for v1
- "Canonical vs local overlay" toggle — deferred to v2 based on user feedback
- Release artifact indexing for SemanticSchemas consumption — deferred to v2

## Context

**Domain**: SemanticSchemas is a MediaWiki extension that auto-generates Forms and Templates from schema definitions. The extension exists at `/dev/SemanticSchemas` but currently lacks import/export. This platform becomes the canonical schema hub; the extension will be updated to export drafts here.

**Entity types (6 total)**:
- **Category**: Entity types with inheritance (parents), required/optional properties and subobjects
- **Property**: Attributes with datatypes, cardinality, validation rules, parent hierarchy
- **Subobject**: Reusable nested structures with their own properties
- **Module**: Logical groupings of categories/properties/subobjects/templates with dependencies
- **Bundle**: Curated collections of modules for deployment scenarios (renamed from Profile)
- **Template**: Wikitext rendering templates for properties

**Canonical repo format** (labki-schemas):
- `categories/*.json` — entity types with JSON Schema validation
- `properties/*.json` — attributes with `Has_*`/`Is_*` naming convention
- `subobjects/*.json` — nested structures
- `modules/{name}/module.json` — entity list + current version number
- `modules/{name}/versions/*.tar.gz` — versioned entity snapshots (generated by GitHub Actions)
- `bundles/{name}/bundle.json` — module list + current version number
- `bundles/{name}/versions/*.tar.gz` — versioned module snapshots (generated by GitHub Actions)
- `templates/**/*.json` — wikitext rendering definitions
- `*/_schema.json` — JSON Schema Draft 2020-12 validation per directory

**Entity key format**: Path-derived from directory + filename (e.g., `categories/Person`, `properties/Has_email`)

**Users**:
- **U1 (Anonymous browser)**: Explore ontology via graph or list, view diffs between versions
- **U2 (Wiki admin)**: Create/edit drafts in Hub UI or push from MediaWiki, validate, submit PR
- **U3 (Maintainer)**: Review PRs with structured summaries and validation output

## Constraints

- **Tech stack**: FastAPI (Python) backend, Vite + React frontend — matches existing expertise
- **Infrastructure**: Docker image for local dev/testing; VPS deployment with Caddy reverse proxy for HTTPS
- **Database**: Postgres for drafts and indexing
- **Domain**: ontology.labki.org
- **Auth model**: No platform accounts; GitHub OAuth only at PR-time
- **Draft security**: Capability URLs only; tokens never logged, stored as hashes; 7-day TTL default
- **Rate limiting**: Per-IP limits on draft creation; payload caps (1-5MB)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Split schema by entity type in repo | Cleaner diffs, easier partial updates, natural module boundaries | ✓ Good |
| FastAPI + Vite React | Team familiarity, good async support, fast frontend builds | ✓ Good |
| Capability URLs for drafts | No accounts needed, simple sharing, secure with proper token handling | ✓ Good |
| GitHub OAuth at PR-time only | Minimize friction; most users just browse or review | ✓ Good |
| Postgres over SQLite | Better for concurrent access, easier to scale, proper indexing | ✓ Good |
| Fragment-based capability URLs | Fragments not sent in HTTP Referrer, reduces token leakage | ✓ Good |
| SHA-256 token hashing | Never store plaintext tokens, 64-char hex in database | ✓ Good |
| Zustand with immer | Immutable state updates with readable mutable-style syntax | ✓ Good |
| graphlib.TopologicalSorter | Stdlib cycle detection with CycleError providing cycle path | ✓ Good |
| Git Data API for PR creation | Atomic multi-file commits with user's OAuth token | ✓ Good |
| Breaking changes as warnings | Valid changes that are impactful, not errors to block on | ✓ Good |
| SessionMiddleware for OAuth | Required for session-based state during OAuth flow | ✓ Good |
| Path-derived entity keys | Maps cleanly to repo file paths, survives refactors | ✓ Good |
| Hybrid patch format | JSON Patch for updates (granular), full replacement for creates (simpler) | ✓ Good |
| Materialized inheritance tables | Precompute category_property_effective at ingest for fast reads; localized re-materialization during drafts | ✓ Good |
| Multi-hull module overlays | Show multiple module boundaries simultaneously in graph view | ✓ Good |
| Full template support | Templates as first-class entities: browse, edit, draft like others | ✓ Good |
| Full rebuild approach | Replace v1.0 implementation completely, reuse working code where appropriate | ✓ Good |
| Latest-only in Ontology Hub | Only retain current version in database; repo is the version archive | ✓ Good |
| Webhook-triggered ingest | Repo push triggers ingest via webhook; no manual refresh needed | ✓ Good |
| Draft auto-rebase | When new canonical is ingested, in-progress drafts rebase automatically | ✓ Good |
| GitHub Actions version bumping | Actions auto-generate tarballs and bump semver (major/minor/patch) on PR merge | — Pending |
| SVG path generators for graph nodes | d3-shape for diamond/hexagon shapes, consistent rendering across browsers | ✓ Good |
| Store-based hover state | Simple dimming implementation, future-proofable for connected highlighting | ✓ Good |
| Catmull-Rom alpha=0.5 for hulls | Smooth curves without sharp corners at module boundaries | ✓ Good |
| BFS for change propagation | Efficient reverse dependency traversal, handles DAG structure | ✓ Good |
| cmdk Command primitive | Type-ahead entity search with Radix Popover integration | ✓ Good |
| CREATE→DELETE removes CREATE | Deleting draft-created entity removes creation record entirely | ✓ Good |
| Direct backend URL for OAuth | Matches GitHub app callback config, avoids Vite proxy redirect issues | ✓ Good |

---
*Last updated: 2026-01-25 after v2.1 milestone*
