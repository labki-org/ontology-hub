# Phase 31: Frontend Create/Edit Forms - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Forms for creating new dashboards and resources in the draft system. DashboardForm supports page management and wikitext editing. ResourceForm renders category-driven fields dynamically. Sidebar buttons initiate creation. Form submission creates draft changes.

</domain>

<decisions>
## Implementation Decisions

### Form patterns
- Follow existing entity create/edit patterns (Category, Module, Bundle, etc.)
- Dashboard and Resource forms are consistent with current approach
- No special treatment needed beyond entity-specific fields

### Resource category selection
- Category is an inline dropdown at top of ResourceForm
- Fields populate dynamically below when category is selected
- On create: category required before other fields appear
- On edit: category editable with warning that fields will reset if changed

### Dashboard page management
- Use accordion pattern matching DashboardDetail view
- Each page expands to edit wikitext inline
- Add/remove/reorder pages within accordion interface

### Claude's Discretion
- Specific wikitext editor component choice (textarea vs richer editor)
- Field ordering within forms
- Validation error display placement
- Loading states during category field population

</decisions>

<specifics>
## Specific Ideas

No specific requirements — follow existing patterns in the codebase for entity forms.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-frontend-create-edit-forms*
*Context gathered: 2026-01-28*
