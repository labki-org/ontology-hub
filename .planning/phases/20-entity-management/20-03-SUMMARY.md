---
phase: 20-entity-management
plan: 03
subsystem: ui
tags: [react, react-hook-form, zod, forms, template, module, bundle]

# Dependency graph
requires:
  - phase: 20-01
    provides: FormField component, Zod schemas for simple entities
  - phase: 20-02
    provides: Simple entity forms pattern (CategoryForm, PropertyForm)
provides:
  - TemplateForm with wikitext textarea (monospace font)
  - ModuleForm with version field and entity relationship fields
  - BundleForm with version field and modules relationship
  - Relaxed create schemas (moduleCreateSchema, bundleCreateSchema)
  - Full validation schemas (moduleSchema with superRefine, bundleSchema with min(1))
affects: [20-04, 20-05, 20-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Relaxed vs full validation schemas for create vs edit
    - Monospace textarea for code-like content (wikitext)

key-files:
  created:
    - frontend/src/components/entity/forms/TemplateForm.tsx
    - frontend/src/components/entity/forms/ModuleForm.tsx
    - frontend/src/components/entity/forms/BundleForm.tsx
  modified:
    - frontend/src/components/entity/forms/schemas.ts

key-decisions:
  - "Use moduleCreateSchema (relaxed) for creation, moduleSchema (with superRefine) for editing"
  - "Use bundleCreateSchema (relaxed) for creation, bundleSchema (with min(1)) for editing"
  - "Wikitext field uses font-mono and min-h-[150px] for visibility"

patterns-established:
  - "Relaxed schema pattern: create without required relationships, enforce on edit"
  - "Monospace styling for code-like text areas: className='font-mono min-h-[150px]'"

# Metrics
duration: 8min
completed: 2026-01-25
---

# Phase 20 Plan 03: Complex Entity Forms Summary

**TemplateForm, ModuleForm, and BundleForm with version fields and relaxed/full validation schema pattern**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-25T18:25:01Z
- **Completed:** 2026-01-25T18:32:37Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- TemplateForm with wikitext textarea using monospace font for MediaWiki syntax
- ModuleForm with version field and entity relationship support
- BundleForm with version field and modules relationship
- Dual-schema pattern: relaxed for creation, full validation for editing
- All forms follow established onBlur validation and disabled-until-valid patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TemplateForm component** - `fb38127` (feat)
2. **Task 2: Create ModuleForm with version field** - `46f2402` (feat)
3. **Task 3: Create BundleForm with modules requirement** - `bc4d285` (feat, via Plan 20-05)

**Note:** Task 3 (BundleForm) was committed as part of Plan 20-05 which integrated EntityCombobox into all forms. The Plan 20-03 placeholder version was superseded by the full EntityCombobox implementation.

## Files Created/Modified
- `frontend/src/components/entity/forms/TemplateForm.tsx` - Template form with wikitext field (137 lines)
- `frontend/src/components/entity/forms/ModuleForm.tsx` - Module form with version and entity relationships (294 lines)
- `frontend/src/components/entity/forms/BundleForm.tsx` - Bundle form with version and modules (190 lines)
- `frontend/src/components/entity/forms/schemas.ts` - Added moduleCreateSchema, bundleCreateSchema, enhanced moduleSchema/bundleSchema

## Decisions Made
- **Relaxed schemas for creation:** moduleCreateSchema and bundleCreateSchema allow creation without relationships, enabling "create shell then add entities" workflow
- **Full validation for editing:** moduleSchema uses superRefine for at-least-one entity requirement, bundleSchema uses modules.min(1)
- **Wikitext styling:** Uses font-mono class and min-h-[150px] for template syntax visibility
- **superRefine for complex validation:** Module's "at least one of categories/properties/subobjects/templates" uses Zod superRefine

## Deviations from Plan

### Execution Order Deviation

Plan 20-03 Tasks 2 and 3 specified placeholder sections for entity relationships ("will be replaced with EntityCombobox in Plan 05"). However, Plan 20-05 was executed immediately after Task 2, integrating EntityCombobox directly into ModuleForm and BundleForm. As a result:

- The placeholder versions were never committed separately for BundleForm
- The final implementations exceed Plan 20-03 requirements (EntityCombobox instead of placeholders)
- All must_haves are satisfied, with enhanced functionality

**Impact:** Positive - forms have full EntityCombobox functionality instead of placeholders

## Issues Encountered
- Working directory had uncommitted changes from parallel development that caused TypeScript errors
- External file sync was overwriting form changes during execution
- Resolved by working with committed state and documenting actual artifact state

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All entity forms complete with EntityCombobox integration
- Ready for Plan 20-04 (CreateEntityModal integration) and Plan 20-06 (delete functionality)
- Schemas support both creation (relaxed) and editing (full validation) workflows

---
*Phase: 20-entity-management*
*Completed: 2026-01-25*
