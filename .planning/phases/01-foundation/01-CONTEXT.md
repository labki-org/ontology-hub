# Phase 1: Foundation - Context

**Gathered:** 2025-01-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Core infrastructure setup: Docker container running Python/FastAPI backend, PostgreSQL database with schema for entities/modules/profiles/drafts, capability URL security system, and IP-based rate limiting. This phase establishes the technical foundation that all other phases build on.

</domain>

<decisions>
## Implementation Decisions

### Database schema design
- Claude's discretion on entity versioning approach (single row vs history table)
- Claude's discretion on draft storage model (references vs snapshots)
- Claude's discretion on module/profile relationship tables (junction vs arrays)
- Claude's discretion on PostgreSQL extensions usage

### Capability URL behavior
- Claude's discretion on URL structure (fragment-based, path-based, or query param)
- Invalid or expired capability URLs return 404 Not Found (no information leakage)
- URL-only access control — no additional IP restrictions or passwords
- Default draft expiration: 7 days

### Rate limiting policy
- Primary concern: abuse prevention
- Draft submissions: 20 per IP per hour (moderate)
- Include Retry-After header in 429 responses
- Read endpoints (GET) more lenient than write endpoints (POST/PUT/DELETE)

### Local development setup
- Backend: Python + FastAPI
- Docker compose includes full observability stack (pgAdmin, Grafana, logging/tracing)
- No seed data — start with empty database, rely on GitHub indexer
- Hot reload enabled for backend code during development

### Claude's Discretion
- Entity versioning approach (single row vs history table)
- Draft storage model (references vs self-contained snapshots)
- Module/profile relationship table design
- PostgreSQL extensions usage
- Capability URL structure (fragment vs path vs query)
- Specific rate limit numbers for read endpoints
- Exact observability tooling choices

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for infrastructure components.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2025-01-20*
