# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-27)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** v1.1.0 Dashboard & Resource Entities

## Current Position

Phase: 27 of 32
Plan: 01 of 02 complete
Status: Phase 27 in progress (derivation algorithm complete)
Last activity: 2026-01-28 - Completed 27-01-PLAN.md (transitive derivation algorithm)

Progress: [██████████░                   ] 45% (5/10 phases started in v1.1.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 92 (20 v1.0 + 41 v2.0 + 24 v2.1 + 7 v1.1.0)

**Summary by Milestone:**

| Milestone | Phases | Plans | Duration |
|-----------|--------|-------|----------|
| v1.0 MVP | 1-7 | 20 | 2 days |
| v2.0 Platform Rebuild | 8-15 | 41 | 2 days |
| v2.1 Bug Fixes & UX | 16-22 | 24 | 5 days |
| v1.1.0 Dashboard & Resource | 23-32 | 7 | In Progress |
| **Total** | 32 | 92+ | - |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

**Phase 23 decisions:**
- Page name pattern uses alternation `^$|^[A-Z][a-z]*(_[a-z]+)*$` to allow empty OR category ID
- Mutual exclusivity for Allows_value_from_category uses JSON Schema `not` constraint

**Phase 24 decisions:**
- Resource.category_key stored as plain string (not FK) for ingest flexibility
- Junction tables use composite primary keys matching BundleModule pattern
- ondelete=RESTRICT on dashboard FK prevents accidental dashboard deletion while in use
- ondelete=CASCADE on module/bundle FK auto-cleans junction rows when parent deleted

**Phase 25 decisions:**
- Resources use nested paths like templates (resources/Category/key.json)
- Dashboard relationships resolved via lookup table pattern matching existing entities

**Phase 26 decisions:**
- Dynamic properties extraction uses reserved_keys blacklist instead of explicit allowlist

**Phase 27 decisions:**
- Derivation follows transitive chains until no new categories discovered or max_depth (10) reached
- Check both Allows_value_from_category and allowed_values.from_category property formats
- Include draft-created resources via category field check

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-28
Stopped at: Completed 27-01-PLAN.md (transitive derivation algorithm)
Resume file: None
Next action: Execute 27-02-PLAN.md (integration and testing)
