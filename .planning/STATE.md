# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-27)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** v1.1.0 Dashboard & Resource Entities

## Current Position

Phase: 26 of 32 ✓
Plan: 01 of 01 complete
Status: Phase 26 verified (6/6 must-haves)
Last activity: 2026-01-28 — Phase 26 complete and verified

Progress: [██████████                    ] 40% (4/10 phases in v1.1.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 91 (20 v1.0 + 41 v2.0 + 24 v2.1 + 6 v1.1.0)

**Summary by Milestone:**

| Milestone | Phases | Plans | Duration |
|-----------|--------|-------|----------|
| v1.0 MVP | 1-7 | 20 | 2 days |
| v2.0 Platform Rebuild | 8-15 | 41 | 2 days |
| v2.1 Bug Fixes & UX | 16-22 | 24 | 5 days |
| v1.1.0 Dashboard & Resource | 23-32 | 6 | In Progress |
| **Total** | 32 | 91+ | - |

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-28
Stopped at: Phase 26 complete (API endpoints verified)
Resume file: None
Next action: Begin Phase 27 (Module auto-derivation extension)
