---
phase: 31-frontend-create-edit-forms
plan: 02
subsystem: ui
tags: [react, forms, zod, react-hook-form, resource, dashboard]

# Dependency graph
requires:
  - phase: 31-01
    provides: DashboardForm component and dashboard schema
provides:
  - ResourceForm component with category-driven dynamic fields
  - resourceSchema and ResourceFormData type
  - Sidebar integration for Dashboard and Resource creation
affects: [31-03, frontend-edit-forms]

# Tech tracking
tech-stack:
  added: []
  patterns: [category-driven-dynamic-fields]

key-files:
  created:
    - frontend/src/components/entity/forms/ResourceForm.tsx
  modified:
    - frontend/src/components/entity/forms/schemas.ts
    - frontend/src/components/layout/Sidebar.tsx

key-decisions:
  - "Dynamic fields fetched from category's properties array via useCategory hook"
  - "Category change resets dynamic_fields to empty object"
  - "Single-select category using EntityCombobox with array of one element"

patterns-established:
  - "Category-driven dynamic fields: useCategory hook fetches properties, form renders inputs dynamically"

# Metrics
duration: 2min
completed: 2026-01-28
---

# Phase 31 Plan 02: Resource Form with Category-Driven Dynamic Fields

**ResourceForm with category selection at top driving dynamic field population, integrated into Sidebar modal alongside DashboardForm**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-28T18:59:44Z
- **Completed:** 2026-01-28T19:01:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- resourceSchema validates id, label, description (optional), category_key (required), dynamic_fields
- ResourceForm shows category dropdown at top using EntityCombobox
- Dynamic fields populated from selected category's properties via useCategory hook
- Category change resets dynamic fields to empty object
- Sidebar renders DashboardForm for dashboard creation, ResourceForm for resource creation
- Form submission flows through existing handleCreateSubmit to create draft change

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Resource schema and create ResourceForm** - `a943b3c` (feat)
2. **Task 2: Integrate forms into Sidebar modal** - `26b7eb1` (feat)

## Files Created/Modified
- `frontend/src/components/entity/forms/schemas.ts` - Added resourceSchema and ResourceFormData type
- `frontend/src/components/entity/forms/ResourceForm.tsx` - New ResourceForm component with category-driven dynamic fields (225 lines)
- `frontend/src/components/layout/Sidebar.tsx` - Added DashboardForm and ResourceForm imports and modal cases

## Decisions Made
- Dynamic fields rendered from CategoryDetailV2.properties array, each property gets an Input
- Required indicator shown via is_required flag from property provenance
- Single category selection implemented with EntityCombobox passing single-element array
- Empty category message: "Select a category to see available fields"
- No properties message: "No properties defined for this category"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ResourceForm ready for testing in draft mode
- DashboardForm and ResourceForm both accessible via "+ New" buttons in Sidebar
- Ready for plan 31-03: Edit form integration and navigation

---
*Phase: 31-frontend-create-edit-forms*
*Completed: 2026-01-28*
