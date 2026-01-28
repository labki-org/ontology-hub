# Phase 28: Draft CRUD Support - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Create/update/delete operations for dashboards and resources within draft sessions. Users can add new entities to drafts, modify existing draft changes, and remove changes. Resource field validation against category properties.

</domain>

<decisions>
## Implementation Decisions

### Create flow
- Dashboard creation requires at least one page — cannot create empty dashboard
- Resource creation requires category_key upfront — determines which fields are valid
- Validate resource fields against category properties immediately on create (reject invalid)
- Resource key is the `id` field, consistent with all other entities

### Claude's Discretion
- Update semantics (partial vs full, conflict handling)
- Delete behavior (soft vs hard within draft context)
- Error message format and structure
- API endpoint design details

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches matching existing draft change patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 28-draft-crud-support*
*Context gathered: 2026-01-28*
