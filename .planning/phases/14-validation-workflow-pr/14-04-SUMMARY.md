---
phase: 14-validation-workflow-pr
plan: 04
subsystem: pr-generation
tags: [github, pr, jsonpatch, draft, v2]

# Dependency graph
requires:
  - phase: 11-draft-system
    provides: DraftChange model with JSON Patch format
  - phase: 08-database-foundation
    provides: V2 entity models with canonical_json field
provides:
  - PR file generation from DraftChange records
  - GitHub PR body formatting with validation results
  - Branch and commit message generation utilities
affects: [14-05-github-integration, pr-workflow, draft-submission]

# Tech tracking
tech-stack:
  added: []
  patterns: [protocol-fallback-for-unimplemented-dependencies, repo-format-serialization]

key-files:
  created:
    - backend/app/services/pr_builder_v2.py
  modified: []

key-decisions:
  - "Protocol fallback for DraftValidationReportV2 until validation schemas implemented"
  - "Repo format uses 'id' field (not 'entity_key') for compatibility with labki-schemas"
  - "Extract filename from entity_key path format (categories/Person -> Person.json)"
  - "Graceful patch failure handling: skip file if patch can't apply (validation should catch first)"

patterns-established:
  - "serialize_for_repo: Convert effective entity JSON to repository format (remove internal fields, entity_key -> id)"
  - "File list generation pattern: CREATE uses replacement_json, UPDATE applies patch to canonical, DELETE marks for deletion"
  - "PR body structure: Summary + Changes (grouped by type) + Validation + Semver suggestions + Module/Bundle version bumps"

# Metrics
duration: 2min
completed: 2026-01-24
---

# Phase 14 Plan 04: PR Builder v2 Summary

**PR builder service generating GitHub files and body from DraftChange records with JSON Patch application and semver suggestions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-25T00:02:27Z
- **Completed:** 2026-01-25T00:04:47Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created pr_builder_v2.py with file generation from DraftChange records
- Implemented effective JSON computation for UPDATE changes (canonical + JSON Patch)
- Implemented PR body generation with categorized changes and semver info
- Added branch name and commit message generation utilities

## Task Commits

Each task was committed atomically:

1. **Task 1: Create pr_builder_v2.py with file generation** - `10b90c5` (feat)

## Files Created/Modified
- `backend/app/services/pr_builder_v2.py` - PR builder service for v2 draft model with file generation and PR body formatting

## Decisions Made
- **Protocol fallback for DraftValidationReportV2:** Used typing.Protocol to define expected validation report structure until validation_v2.py schemas are implemented (plan 14-01). This allows pr_builder_v2.py to be developed independently while maintaining type safety.
- **Repo format transformation:** Converts entity_key to "id" field and removes internal fields (_change_status, _deleted, _patch_error) to match labki-schemas repository format.
- **Filename extraction from entity_key:** Handles entity_key format "categories/Person" by extracting just "Person" for filename "Person.json".
- **Graceful patch failure handling:** If JSON Patch application fails, skip the file rather than crashing (validation should catch patch errors before PR creation).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PR builder v2 ready for integration with GitHub API (plan 14-05)
- File generation tested for all three change types (CREATE, UPDATE, DELETE)
- PR body formatting includes all required sections (changes, validation, semver suggestions)

**Blockers:**
- None

**Concerns:**
- Validation schema (DraftValidationReportV2) not yet implemented - using Protocol fallback. Plan 14-05 (GitHub integration) will need validation schemas to exist before PR submission can work end-to-end.

---
*Phase: 14-validation-workflow-pr*
*Completed: 2026-01-24*
