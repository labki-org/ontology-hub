# Phase 10: Query Layer - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide API endpoints for reading entities and graph data, supporting both canonical and draft contexts. Server computes effective views (canonical + draft overlay); frontend never merges. Graph endpoints support neighborhood and module-scoped queries with module membership for hull rendering.

</domain>

<decisions>
## Implementation Decisions

### Draft overlay behavior
- Deleted entities return with `deleted: true` marker (not excluded from results)
- New draft entities appear mixed with canonical in list queries (not separate section)
- Inheritance recomputed live: draft changes to parent categories affect inherited properties in query results
- All entities in draft context include change status (added/modified/deleted/unchanged)

### Claude's Discretion
- Overlay computation layer (database SQL vs application Python) — choose based on complexity and performance
- Response envelope structure
- Pagination implementation details
- Error response format

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-query-layer*
*Context gathered: 2026-01-24*
