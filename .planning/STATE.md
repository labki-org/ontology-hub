# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-27)

**Core value:** Enable wiki admins to go from local schema edit to GitHub PR in under 5 minutes, with zero platform accounts and strong validation feedback.
**Current focus:** v1.1.0 Dashboard & Resource Entities

## Current Position

Phase: 29 of 32 (Frontend Graph Visualization)
Plan: 02 of 03 complete
Status: In progress
Last activity: 2026-01-28 — Completed 29-02-PLAN.md

Progress: [███████████████░░             ] 62% (6.2/10 phases in v1.1.0)

## Performance Metrics

**Velocity:**
- Total plans completed: 97 (20 v1.0 + 41 v2.0 + 24 v2.1 + 12 v1.1.0)

**Summary by Milestone:**

| Milestone | Phases | Plans | Duration |
|-----------|--------|-------|----------|
| v1.0 MVP | 1-7 | 20 | 2 days |
| v2.0 Platform Rebuild | 8-15 | 41 | 2 days |
| v2.1 Bug Fixes & UX | 16-22 | 24 | 5 days |
| v1.1.0 Dashboard & Resource | 23-32 | 12 | In Progress |
| **Total** | 32 | 96+ | - |

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
- Use .get("resources", []) for backwards compatibility with pre-Phase-27 derivation

**Phase 28 decisions:**
- Dashboard CREATE validation rejects empty pages array
- Dashboard CREATE validation requires root page (name: '')
- Resource RESERVED_KEYS: id, label, description, category, entity_key, source_path
- Draft-created categories bypass materialized view for property lookup
- SQLite tests use draft-created categories to bypass materialized view

**Phase 29 decisions:**
- Dashboard node: 70px size, red-300 fill, rounded rect (r=12)
- Resource node: 45px size (compact), cyan-300 fill, small rect (r=4)
- module_dashboard edge: red-600, long dash (8,4)
- category_resource edge: cyan-600, short dash (3,3)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-01-28
Stopped at: Completed 29-02-PLAN.md (frontend node types)
Resume file: None
Next action: Continue Phase 29 with 29-03-PLAN.md (backend graph queries)
