# Phase 26: Backend API Endpoints - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

List and detail endpoints for Dashboard and Resource entities. Includes category-based resource filtering. Draft overlay applies to new endpoints identical to existing entity types.

</domain>

<decisions>
## Implementation Decisions

### Consistency Directive
- Follow existing codebase conventions exactly
- Dashboard and Resource endpoints should be identical in pattern to existing entities (Category, Property, Template, Module, Bundle)
- No special handling or deviations from established patterns

### Claude's Discretion
- Specific endpoint implementation details following existing patterns
- Response structure matching existing entity endpoints
- Draft overlay integration using established overlay service
- URL path conventions for hierarchical resource keys (category/key)
- Filter implementation for /resources endpoint

</decisions>

<specifics>
## Specific Ideas

"How we handle dashboard and resource entities should be identical to other entities."

This is a strong directive to study existing endpoints and replicate their patterns exactly.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-backend-api-endpoints*
*Context gathered: 2026-01-28*
