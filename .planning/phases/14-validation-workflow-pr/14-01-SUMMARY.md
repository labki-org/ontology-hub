---
phase: 14-validation-workflow-pr
plan: 01
subsystem: validation
tags: [validation, json-schema, jsonschema, graphlib, json-patch, semver, draft-v2]

# Dependency graph
requires:
  - phase: 11-draft-system
    provides: DraftChange model for granular change tracking
  - phase: 11-draft-system
    provides: DraftOverlayService for effective entity reconstruction
provides:
  - ValidationResultV2 and DraftValidationReportV2 schemas with entity_key field
  - validate_draft_v2 orchestrator for v2 draft validation
  - Reference, inheritance, breaking change, datatype, and JSON Schema validation
  - Effective entity reconstruction from DraftChange records
affects: [14-02-auto-revert-workflow, 14-03-pr-workflow-ui, 14-04-pr-builder-v2]

# Tech tracking
tech-stack:
  added: [jsonschema]
  patterns: [effective-entity-reconstruction, schema-validation-from-github]

key-files:
  created:
    - backend/app/schemas/validation_v2.py
    - backend/app/services/validation/validator_v2.py
    - backend/app/services/validation/reference_v2.py
    - backend/app/services/validation/inheritance_v2.py
    - backend/app/services/validation/breaking_v2.py
    - backend/app/services/validation/schema_v2.py
  modified: []

key-decisions:
  - "ValidationResultV2 uses entity_key field (not entity_id) to match v2 model"
  - "JSON Schema validation loads _schema.json from GitHub canonical repo"
  - "Effective entities reconstructed from DraftChange records with JSON Patch application"
  - "Validation pipeline includes JSON Schema validation against _schema.json definitions"
  - "Datatype validation reuses ALLOWED_DATATYPES from v1 validation"

patterns-established:
  - "build_effective_entities: Apply CREATE/UPDATE/DELETE changes to canonical entities"
  - "check_schema_v2: Load schemas from GitHub and validate with jsonschema library"
  - "Validation modules use effective_entities dict structure for consistent API"

# Metrics
duration: 4min
completed: 2026-01-24
---

# Phase 14 Plan 01: V2 Validation Service Summary

**Draft validation with JSON Schema checking, effective entity reconstruction, and granular change tracking using entity_key**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-25T00:02:57Z
- **Completed:** 2026-01-25T00:06:20Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- ValidationResultV2 and DraftValidationReportV2 schemas adapted for v2 draft model with entity_key field
- Effective entity reconstruction from DraftChange records using JSON Patch
- Complete validation pipeline: references, inheritance, datatypes, JSON Schema, breaking changes
- JSON Schema validation loads _schema.json definitions from GitHub canonical repo
- Semver suggestions computed from validation results

## Task Commits

Each task was committed atomically:

1. **Task 1: Create v2 validation schemas and supporting validation modules** - `c0c62fa` (feat)
2. **Task 2: Create JSON Schema validation module** - `6e4c190` (feat)
3. **Task 3: Create main validator_v2.py orchestrator** - `58dcdcd` (feat)

## Files Created/Modified
- `backend/app/schemas/validation_v2.py` - ValidationResultV2 with entity_key and field_path for v2 drafts
- `backend/app/services/validation/validator_v2.py` - Main orchestrator that reconstructs effective entities and runs all checks
- `backend/app/services/validation/reference_v2.py` - Reference existence checks for category parents, properties, module entities
- `backend/app/services/validation/inheritance_v2.py` - Circular inheritance detection using graphlib TopologicalSorter
- `backend/app/services/validation/breaking_v2.py` - Breaking change detection comparing effective vs canonical
- `backend/app/services/validation/schema_v2.py` - JSON Schema validation loading _schema.json from GitHub

## Decisions Made
- **ValidationResultV2 uses entity_key field** - V2 model uses entity_key instead of entity_id for consistency with DraftChange model
- **JSON Schema validation loads from GitHub** - _schema.json files loaded from canonical repo via GitHubClient for latest schema definitions
- **Effective entity reconstruction pattern** - Load canonical entities, apply CREATE/UPDATE/DELETE changes via JSON Patch to build effective state
- **Validation pipeline includes JSON Schema** - check_schema_v2 validates entity JSON against _schema.json definitions as part of standard validation flow
- **Reuse v1 datatype validation** - ALLOWED_DATATYPES from v1 validation reused to maintain SemanticMediaWiki compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

Validation service ready for integration:
- validate_draft_v2 can be called by API endpoints to validate drafts before submission
- DraftValidationReportV2 provides structured results for UI display
- JSON Schema validation ensures entity JSON conforms to canonical schema definitions
- Semver suggestions guide version bumping
- Ready for Phase 14 Plan 02 (Auto-revert Workflow) and Plan 03 (PR Workflow UI)

---
*Phase: 14-validation-workflow-pr*
*Completed: 2026-01-24*
