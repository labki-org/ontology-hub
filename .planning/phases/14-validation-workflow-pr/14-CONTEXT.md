# Phase 14: Validation + Workflow + PR - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete validation engine, draft workflow UI, and GitHub PR submission. Validation checks JSON Schema compliance, reference resolution, circular inheritance, and breaking changes. Draft banner and diff view enable users to review changes. PR creation generates file changes, creates branch/commit, and opens PR with structured summary.

</domain>

<decisions>
## Implementation Decisions

### PR Submission Flow
- Wizard flow: multi-step process (review changes → edit PR details → confirm → submit)
- PR title and description auto-generated from changes
- User can add comments section with custom text (but not edit auto-generated content)
- After successful submit: show success message with PR link, stay on current page
- One PR per draft — once submitted, draft is locked; subsequent changes require new draft or direct GitHub edits

### Draft Workflow States
- Full workflow with four states: Draft → Validated → Submitted → Merged
- Auto-revert on edit: if user edits anything after validation, status auto-reverts to Draft
- Merged status tracked via GitHub webhook (receive PR merge events)

### Button Placement
- Both locations: draft banner shows info + actions, floating action bar provides sticky access to validate/submit buttons regardless of scroll position

### Claude's Discretion
- Validation feedback display (inline vs summary, grouping, severity styling)
- Diff view design (side-by-side vs unified, collapse/expand behavior)
- Exact wizard step UI and transitions
- PR branch naming convention
- Success/error message styling

</decisions>

<specifics>
## Specific Ideas

- User emphasized that all subsequent commits to a PR should happen directly in GitHub, not through Ontology Hub
- Wizard flow similar to typical "checkout" experiences: progressive disclosure of what will happen

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-validation-workflow-pr*
*Context gathered: 2026-01-24*
