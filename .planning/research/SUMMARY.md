# Project Research Summary

**Project:** Ontology Hub - Ontology Management Platform
**Domain:** Schema Registry / Ontology Browsing / GitHub-Integrated Proposal Workflow
**Researched:** 2026-01-20
**Confidence:** HIGH

## Executive Summary

Ontology Hub sits at the intersection of schema registries (Confluent, AWS Glue), ontology editors (Protege, WebVOWL), and documentation platforms (Swagger, ReadMe). The recommended approach is a FastAPI + React stack with PostgreSQL for caching indexed data, while GitHub remains the single source of truth for schema definitions. The project's unique value proposition is the anonymous draft-to-PR workflow using capability URLs, which no surveyed competitor offers.

The architecture follows a clear separation: GitHub stores canonical schemas, the platform indexes them for fast browsing and search, wiki admins submit draft proposals via API, and reviewers use capability URLs to inspect changes before creating PRs. This eliminates the need for user accounts while maintaining a secure contribution pathway. The validation engine should be custom-built for JSON-based SemanticSchemas rather than using heavyweight RDF/OWL libraries.

Key risks center on capability URL security (token leakage through logs, Referer headers, browser history), GitHub webhook reliability (silent event loss), and validation engine trust (false positives eroding user confidence). All three require architectural decisions in early phases that cannot be easily retrofitted. Use fragment-based tokens for capability URLs, implement idempotent webhook handlers with polling reconciliation, and design tiered validation severity from the start.

## Key Findings

### Recommended Stack

The stack prioritizes mature, async-first technologies. FastAPI 0.128+ with SQLAlchemy 2.0 async provides excellent performance and type safety. React 19 with Vite 6 and TanStack Query v5 delivers a modern frontend with efficient data fetching. GitHub OAuth App (not GitHub App) is sufficient for the PR-at-submit-time model, though the PITFALLS research suggests evaluating GitHub Apps for finer-grained permissions.

**Core technologies:**
- **FastAPI + Pydantic v2**: API framework with native async, automatic OpenAPI docs
- **SQLAlchemy 2.0 async + asyncpg**: Production-ready async ORM for PostgreSQL
- **React 19 + Vite 6 + TanStack Query v5**: Modern frontend with server state management
- **Tailwind CSS + shadcn/ui**: Utility-first styling with accessible, customizable components
- **Custom validation (NOT rdflib/owlready2)**: SemanticSchemas is JSON-based, not OWL/RDF

**Critical anti-recommendations:**
- Do NOT use heavyweight OWL/RDF libraries for JSON-based schemas
- Do NOT use Create React App (deprecated) or Redux (overkill)
- Do NOT use Celery initially; FastAPI BackgroundTasks is sufficient for MVP

### Expected Features

**Must have (table stakes):**
- Full-text search across entity names, descriptions, field names
- Entity detail pages with inheritance visualization
- Module/profile browsing with entity counts
- Version/release listing
- Diff between versions
- JSON/export download
- Breadcrumb navigation

**Should have (competitive differentiators):**
- Capability-URL drafts (zero-account contribution)
- Inline validation feedback during draft review
- Breaking change detection and compatibility classification
- PR creation with structured summary
- API-first draft ingestion

**Defer (v2+):**
- Interactive WebVOWL-style graph visualization
- Advanced validation (semver suggestions)
- Faceted search
- Profile coverage matrix
- Module dependency visualization

### Architecture Approach

Six-component architecture with clear boundaries: FastAPI backend handles API and business logic orchestration; React frontend consumes API exclusively; PostgreSQL stores indexed cache and draft data (not source of truth); GitHub Integration Layer syncs with source repo and creates PRs; Validation Engine provides schema consistency checks (pure Python, no external dependencies); Background Task System handles async operations.

**Major components:**
1. **FastAPI Backend** — HTTP handling, OAuth flows, webhook processing
2. **React Frontend** — Browsing, draft review, diff visualization
3. **PostgreSQL** — Indexed entity cache, draft storage with capability tokens
4. **GitHub Integration** — Indexer, webhook handler, PR creator
5. **Validation Engine** — Syntax checks, breaking change detection, semver classification
6. **Background Tasks** — Indexing after webhooks, validation, cleanup

### Critical Pitfalls

1. **Capability URL Token Leakage** — Use fragment-based tokens (`#token=xyz`), implement read/write scope separation, short TTLs (24-48h), and strip tokens from all logging. Must be addressed in Phase 1.

2. **GitHub Webhook Event Loss** — GitHub does NOT auto-retry failed deliveries. Implement idempotent handlers (store `X-GitHub-Delivery`), periodic polling reconciliation, and delivery monitoring. Design from Phase 2 start.

3. **Validation Engine False Positives** — Overly strict validation erodes trust. Implement tiered severity ("definitely breaking" vs "potentially breaking" vs "safe"), acknowledgment workflow for reviewed warnings, and expand-contract deprecation pattern support.

4. **GitHub API Rate Limit Exhaustion** — Always use authenticated requests, cache GitHub responses aggressively, batch with GraphQL, monitor `X-RateLimit-Remaining`, and spread bulk operations over time.

5. **Schema Drift Between Environments** — GitHub is authoritative source of truth. Include commit SHA + timestamps on all indexed records. Show users "last synced" status. Design version vectors from day one.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation and Core Infrastructure
**Rationale:** Database schema, capability URL system, and rate limiting architecture affect all subsequent phases. Cannot be retrofitted.
**Delivers:** PostgreSQL schema with version vectors, FastAPI skeleton, capability token system with fragment-based URLs, rate limiting infrastructure
**Addresses:** Entity storage model, draft lifecycle foundation
**Avoids:** Token leakage pitfall, schema drift pitfall, rate limiting pitfall
**Stack:** FastAPI, SQLAlchemy 2.0, PostgreSQL, Alembic

### Phase 2: GitHub Integration
**Rationale:** Frontend needs real data to display. GitHub sync provides the foundation for all browsing features.
**Delivers:** GitHub indexer, webhook handler with idempotency, entity API endpoints
**Uses:** httpx for async GitHub API calls, Authlib for OAuth
**Implements:** GitHub Integration Layer, Indexer component
**Avoids:** Webhook event loss pitfall, API rate limit exhaustion pitfall

### Phase 3: Schema Browsing
**Rationale:** Core table-stakes features that users expect. Building on indexed data from Phase 2.
**Delivers:** Entity browser, search, inheritance visualization, module/profile browsing, version listing, diff views
**Addresses:** All table-stakes features from FEATURES.md
**Stack:** React 19, Vite 6, TanStack Query, shadcn/ui, react-diff-view

### Phase 4: Draft System
**Rationale:** Core differentiator. Depends on browsing (to compare drafts against indexed data) and validation.
**Delivers:** Draft ingestion API, capability URL access, draft review UI with diffs, change selection toggles
**Implements:** Draft storage, capability token verification, draft-to-indexed comparison
**Avoids:** Draft expiration UX pitfall (visible countdown, grace period)

### Phase 5: Validation Engine
**Rationale:** Validation accuracy is critical; build incrementally. Start conservative, tune with real-world feedback.
**Delivers:** Syntax validation, consistency checks, breaking change detection, inline feedback in draft UI
**Avoids:** False positive pitfall (tiered severity, acknowledgment workflow)
**Risk:** Highest complexity area; may need iteration based on real-world usage

### Phase 6: PR Integration
**Rationale:** Final step in the workflow. Requires stable draft system and validation.
**Delivers:** GitHub OAuth flow at PR-time, branch/commit/PR creation, structured PR summary
**Implements:** PR Creator component from architecture
**Avoids:** OAuth scope creep pitfall (minimal scopes, consider GitHub Apps)

### Phase Ordering Rationale

- **Foundation first:** Capability URL security and data model versioning cannot be retrofitted. These architectural decisions must be made before building features on top.
- **GitHub before UI:** The frontend needs real indexed data to develop against. Building the indexer early provides realistic test data.
- **Browse before draft:** Draft review UI reuses entity detail components and diff views from the browser.
- **Draft before validation:** Validation runs on drafts; the draft system must exist first.
- **Validation before PR:** Users need to see validation results before submitting; ensures PRs include quality signals.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (GitHub Integration):** GitHub Apps vs OAuth Apps trade-offs need deeper investigation. PITFALLS suggests GitHub Apps for finer-grained permissions.
- **Phase 5 (Validation Engine):** Breaking change detection rules are domain-specific. May need research on SemanticSchemas-specific validation patterns.
- **Phase 6 (PR Integration):** OAuth security best practices evolving (PKCE support added July 2025). Verify current best practices.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented FastAPI + SQLAlchemy patterns.
- **Phase 3 (Browsing):** Standard React patterns with established component libraries.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified with PyPI/npm, official docs, recent release notes |
| Features | MEDIUM-HIGH | Good coverage of schema registries and ontology tools; SemanticSchemas-specific features less documented |
| Architecture | HIGH | Patterns verified against FastAPI templates, GitHub docs, W3C capability URLs spec |
| Pitfalls | HIGH | Security pitfalls well-documented (Neil Madden, GitHub security advisories); UX pitfalls from domain research |

**Overall confidence:** HIGH

### Gaps to Address

- **SemanticSchemas format specifics:** Research assumes JSON-based format; actual schema structure may require validation rule adjustments
- **GitHub Apps vs OAuth Apps final decision:** STACK recommends OAuth App for simplicity, PITFALLS suggests GitHub Apps for security. Needs final decision in Phase 2 planning.
- **Ontology visualization library selection:** Deferred to v2+, but if pulled forward, needs hands-on evaluation (D3.js, Cytoscape.js, etc.)
- **Anonymous rate limiting best practices:** Cloudflare Privacy Pass is emerging; monitor for production-ready solutions

## Sources

### Primary (HIGH confidence)
- [FastAPI Official Documentation](https://fastapi.tiangolo.com/) — framework patterns, async setup
- [GitHub OAuth vs GitHub Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps) — authentication approach
- [W3C TAG Capability URLs](https://w3ctag.github.io/capability-urls/) — security best practices
- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks/) — reliability patterns
- [Confluent Schema Registry](https://docs.confluent.io/platform/current/schema-registry/) — feature expectations

### Secondary (MEDIUM confidence)
- [Neil Madden: Bearer Token URLs](https://neilmadden.blog/2021/03/20/towards-a-standard-for-bearer-token-urls/) — capability URL security
- [WebVOWL](https://github.com/VisualDataWeb/WebVOWL) — ontology visualization patterns
- [TanStack Query](https://tanstack.com/query/latest) — frontend data fetching
- [shadcn/ui](https://ui.shadcn.com/) — component library approach

### Tertiary (LOW confidence)
- [Comparing Python Ontology Libraries](https://incenp.org/notes/2025/comparing-python-ontology-libraries.html) — confirms NOT using RDF libraries
- [MediaWiki Export Format](https://www.mediawiki.org/wiki/API:Data_formats) — import format brittleness

---
*Research completed: 2026-01-20*
*Ready for roadmap: yes*
