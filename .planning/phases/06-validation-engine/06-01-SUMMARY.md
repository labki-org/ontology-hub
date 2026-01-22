---
phase: 06-validation-engine
plan: 01
subsystem: api
tags: [validation, references, inheritance, datatypes, python, pydantic, graphlib]

# Dependency graph
requires:
  - phase: 05-draft-system
    provides: Draft models, payload structure, diff computation
provides:
  - ValidationResult schema with entity context and severity
  - DraftValidationReport for aggregated validation results
  - Reference existence checks for parents, properties, subobjects, modules
  - Circular inheritance detection using graphlib.TopologicalSorter
  - Datatype validation against 18 SemanticMediaWiki types
  - validation_results JSONB field on drafts table
  - Validation integrated into POST and PATCH /drafts/ endpoints
affects: [06-02-breaking-changes, 06-03-ui-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [graphlib TopologicalSorter for cycle detection, validation orchestrator pattern]

key-files:
  created:
    - backend/app/schemas/validation.py
    - backend/app/services/validation/__init__.py
    - backend/app/services/validation/datatype.py
    - backend/app/services/validation/reference.py
    - backend/app/services/validation/inheritance.py
    - backend/app/services/validation/validator.py
    - backend/alembic/versions/004_draft_validation_results.py
  modified:
    - backend/app/models/draft.py
    - backend/app/routers/drafts.py
    - backend/tests/test_drafts_api.py

key-decisions:
  - "Reference checks combine canonical + draft IDs before validation (draft can reference its own new entities)"
  - "Circular inheritance checks include canonical parent relationships (draft category can create cycle with canonical)"
  - "18 SemanticMediaWiki datatypes as the allowed set"
  - "validation_results stored as JSONB for flexible schema evolution"
  - "Validation runs on both create and update (PATCH) endpoints"

patterns-established:
  - "Validation orchestrator pattern - central validator runs multiple check functions"
  - "graphlib.TopologicalSorter for cycle detection - stdlib, CycleError gives cycle path"
  - "Combined canonical + draft sets for reference validation"

# Metrics
duration: 7min
completed: 2026-01-22
---

# Phase 6 Plan 1: Validation Engine Core Summary

**Reference existence checks, circular inheritance detection, and datatype validation with validation_results stored in draft table**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-22T21:49:00Z
- **Completed:** 2026-01-22T21:56:00Z
- **Tasks:** 3
- **Files created:** 7
- **Files modified:** 3

## Accomplishments

- ValidationResult schema captures entity_type, entity_id, field, code, message, severity
- DraftValidationReport aggregates errors/warnings/info with is_valid flag and semver suggestion
- Reference check validates: parent categories, properties, subobjects, module members, module dependencies, profile modules
- Circular inheritance detection using Python's graphlib.TopologicalSorter (stdlib)
- Datatype validation checks against 18 SemanticMediaWiki types
- validation_results JSONB column added to drafts table via migration 004
- Validation runs automatically on draft creation and update

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validation schemas and datatype module** - `7cead8a` (feat)
   - ValidationResult, DraftValidationReport schemas
   - ALLOWED_DATATYPES constant with 18 SMW types
   - check_datatypes function

2. **Task 2: Create reference and inheritance validation** - `67f3358` (feat)
   - check_references validates all entity references
   - check_circular_inheritance uses TopologicalSorter
   - validate_draft orchestrator

3. **Task 3: Integrate validation into draft API** - `4cf569b` (feat)
   - validation_results field on DraftBase
   - Migration 004 adds column
   - POST /drafts/ runs validation
   - PATCH /drafts/{token} recomputes validation

## Files Created

| File | Purpose |
|------|---------|
| `backend/app/schemas/validation.py` | ValidationResult and DraftValidationReport Pydantic schemas |
| `backend/app/services/validation/__init__.py` | Module exports |
| `backend/app/services/validation/datatype.py` | ALLOWED_DATATYPES set and check_datatypes function |
| `backend/app/services/validation/reference.py` | Reference existence checks for all entity types |
| `backend/app/services/validation/inheritance.py` | Circular inheritance detection with graphlib |
| `backend/app/services/validation/validator.py` | Main validation orchestrator |
| `backend/alembic/versions/004_draft_validation_results.py` | Add validation_results column |

## Validation Codes Implemented

| Code | Entity Type | Description |
|------|-------------|-------------|
| MISSING_PARENT | category | Referenced parent category doesn't exist |
| MISSING_PROPERTY | category | Referenced property doesn't exist |
| MISSING_SUBOBJECT | category | Referenced subobject doesn't exist |
| MISSING_CATEGORY | module | Module member category doesn't exist |
| MISSING_MODULE | module, profile | Module dependency or profile module doesn't exist |
| CIRCULAR_INHERITANCE | category | Category inheritance creates a cycle |
| INVALID_DATATYPE | property | Datatype not in SemanticMediaWiki allowed set |

## Decisions Made

1. **Combined canonical + draft sets for reference validation** - A draft can define a new category and reference it as a parent in another new category. Reference checks include both canonical database entities and entities defined in the draft itself.

2. **Full inheritance graph for cycle detection** - Circular inheritance checks consider the complete graph (canonical + draft) because a draft change can create a cycle with existing canonical categories.

3. **18 SemanticMediaWiki datatypes** - The ALLOWED_DATATYPES set contains only officially documented SMW datatypes. Custom/extension types would fail validation.

4. **validation_results as JSONB** - Stored as JSONB rather than separate columns for flexibility. Schema can evolve without migrations.

5. **Validation on both create and update** - Both POST /drafts/ and PATCH /drafts/{token} run the validation engine to ensure results are always current.

## Deviations from Plan

None - plan executed exactly as written. Tests were updated to use valid DraftPayload structure and trailing slash on POST endpoint.

## Issues Encountered

- **Test trailing slash issue**: Tests using `/api/v1/drafts` (without trailing slash) returned 404 with ASGITransport. Fixed by updating tests to use `/api/v1/drafts/` (with trailing slash).

## User Setup Required

None - validation runs automatically. Migration 004 adds the required column.

## Next Phase Readiness

- Validation engine core complete (VALD-01, VALD-02, VALD-03)
- Plan 06-02 adds breaking change detection (VALD-04, VALD-05)
- Plan 06-03 will add UI integration for inline validation display

---
*Phase: 06-validation-engine*
*Completed: 2026-01-22*
