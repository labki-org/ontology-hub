# Ontology Hub

## What This Is

A public platform for browsing, validating, and proposing changes to a shared SemanticSchemas ontology maintained in GitHub. Wiki admins can export local schema changes, review diffs with validation feedback, and open GitHub PRs—all without needing platform accounts. GitHub OAuth is only required at PR submission time.

## Core Value

Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.

## Current State (v1.0)

**Shipped:** 2026-01-23
**Codebase:** 15,392 LOC (8,355 Python + 7,037 TypeScript)
**Stack:** FastAPI 0.115, React 19, Vite 7, PostgreSQL 17, Docker Compose

**Human verified:** https://github.com/labki-org/labki-schemas/pull/1

## Requirements

### Validated

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

### Active

(v1.0 complete — next milestone requirements TBD)

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

**Existing schema structure**: Categories, properties, and subobjects with inheritance, required/optional fields, datatypes, and display metadata. The JSON structure shared during planning defines the entity model.

**Canonical repo format**: Schema files organized by entity type:
- `categories/*.json`
- `properties/*.json`
- `subobjects/*.json`
- `modules/*.json` (manifest files referencing entity IDs)
- `profiles/*.json` (manifest files referencing module IDs)

**Users**:
- **U1 (Anonymous browser)**: Explore ontology, view diffs between versions, download artifacts
- **U2 (Wiki admin)**: Export local changes, review in platform, open PR without platform login
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

---
*Last updated: 2026-01-23 after v1.0 milestone*
