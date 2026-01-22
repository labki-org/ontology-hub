# Phase 5: Draft System - Context

**Gathered:** 2026-01-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Wiki admins submit drafts via API, access them via capability URLs, and review changes with inline editing and module editing capabilities. Drafts expire after TTL. Module editing focuses on category assignment (properties/subobjects are auto-included via dependencies).

</domain>

<decisions>
## Implementation Decisions

### Draft submission flow
- Payload format: Claude's discretion (choose based on technical constraints)
- Success response returns capability URL plus full diff preview (so caller can display without fetching)
- Wiki metadata (URL and base version) is required — drafts are not anonymous
- Submissions with validation errors are rejected (400 with error list) — no draft created

### Draft review UI
- Diff view organized by entity type (Categories, Properties, Subobjects) — consistent with version diff viewer
- Entity changes collapsed by default — show entity ID + change type, click to expand field-level diff
- Users can edit entity fields inline directly in the diff view
- Header information: Claude's discretion on what's useful to show

### Module editing in drafts
- Module assignment is primarily for new categories (properties/subobjects auto-included via category dependencies)
- Both individual dropdown and bulk assignment options for efficiency
- Auto-added dependencies shown with visual distinction (grayed, italic, or badge) in a single list — not separate sections
- When removing an explicitly-included category that has children:
  - Category converts to "auto-included" dependency (visual distinction changes)
  - Shows which children still depend on it
  - Brief warning displayed
  - Auto-removed when those children are removed
- Profile editing can create new modules as part of the draft

### Claude's Discretion
- Draft payload format (full schema vs delta)
- Draft review header content
- Exact visual styling for auto-included dependencies
- Capability URL format details

</decisions>

<specifics>
## Specific Ideas

- Properties and subobjects get pulled in automatically based on category dependencies — users only need to assign categories to modules
- Parent categories auto-added as dependencies when child is included
- "Auto-include" concept works bidirectionally: auto-add on include, auto-remove when no longer needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-draft-system*
*Context gathered: 2026-01-22*
