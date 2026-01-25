---
phase: 20
plan: 07
subsystem: entity-management
tags: [nested-modals, cascading-create, zustand, react-hook-form]

dependency-graph:
  requires: [20-04, 20-05, 20-06]
  provides: [cascading-create-flow, nested-modal-stack]
  affects: []

tech-stack:
  added: []
  patterns: [nested-modal-pattern, callback-injection, form-state-callback]

key-files:
  created:
    - frontend/src/components/entity/modals/NestedModalStack.tsx
  modified:
    - frontend/src/stores/draftStoreV2.ts
    - frontend/src/components/layout/SidebarV2.tsx
    - frontend/src/components/entity/forms/CategoryForm.tsx
    - frontend/src/components/entity/forms/ModuleForm.tsx
    - frontend/src/components/entity/forms/BundleForm.tsx
    - frontend/src/components/entity/forms/PropertyForm.tsx
    - frontend/src/components/entity/forms/SubobjectForm.tsx
    - frontend/src/components/entity/forms/TemplateForm.tsx

decisions:
  - id: nested-callback-pattern
    choice: "Form sets callback via setOnNestedEntityCreated before opening nested modal"
    rationale: "Form owns its state - only form knows how to add new entity to its selection"
  - id: single-level-nesting
    choice: "Nested forms don't receive onCreateRelatedEntity prop"
    rationale: "Prevents infinite nesting, keeps UX simple per RESEARCH anti-pattern guidance"
  - id: initialData-prop
    choice: "All forms accept initialData prop for prefilling"
    rationale: "Enables nested modal to prefill ID from autocomplete input"

metrics:
  duration: ~6 minutes
  completed: 2026-01-25
---

# Phase 20 Plan 07: Cascading Create Flow Summary

Nested modal stack for creating dependent entities inline from relationship comboboxes.

## One-liner

NestedModalStack with Zustand state for cascading create - forms set callback before opening nested modal, new entity auto-added to parent selection.

## What Was Built

### 1. Nested Modal State in draftStoreV2

Extended Zustand store with nested create modal state:
- `nestedCreateModal` object with `isOpen`, `entityType`, `prefilledId`, `parentContext`
- `onNestedEntityCreated` callback for notifying parent form
- `openNestedCreateModal` / `closeNestedCreateModal` actions
- `setOnNestedEntityCreated` action for callback management
- Updated `reset()` to clear nested state

### 2. NestedModalStack Component (147 lines)

New component at `frontend/src/components/entity/modals/NestedModalStack.tsx`:
- Renders nested CreateEntityModal on top of primary modal
- Shows context hint: "Creating [type] for [parent]'s [field]"
- Prefills ID from autocomplete input
- Calls `onNestedEntityCreated` callback after successful creation
- Limits to 1 level of nesting by not passing onCreateRelatedEntity to nested forms

### 3. Form Updates

All forms now accept `initialData` prop for prefilling:
- CategoryForm, PropertyForm, SubobjectForm, TemplateForm, ModuleForm, BundleForm
- Uses initialData values as defaultValues in useForm

Forms with relationships also accept `setOnNestedEntityCreated`:
- CategoryForm (for parent categories)
- ModuleForm (for categories, properties, subobjects, templates)
- BundleForm (for modules)

### 4. SidebarV2 Integration

- Added NestedModalStack to render tree
- Created `handleCreateRelatedEntity` handler
- Wired CategoryForm, ModuleForm, BundleForm with cascade support
- Forms set callback before triggering nested modal

## Callback Flow

```
1. User types "new-entity" in EntityCombobox
2. User clicks "Create new-entity"
3. Form's onCreateNew handler:
   a. Sets callback: setOnNestedEntityCreated((newKey) => addToSelection(newKey))
   b. Calls onCreateRelatedEntity('type', 'new-entity', 'Field Name')
4. SidebarV2's handleCreateRelatedEntity:
   a. Opens nested modal with prefilled ID and parent context
5. User fills nested form and submits
6. NestedModalStack:
   a. Creates entity via API
   b. Calls onNestedEntityCreated('new-entity')
7. Parent form's callback adds 'new-entity' to its selection
8. Nested modal closes, parent form shows new entity in chips
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added initialData prop to all forms**
- **Found during:** Task 2
- **Issue:** Forms didn't accept initialData for prefilling ID
- **Fix:** Added initialData prop to all 6 entity forms
- **Files modified:** All form files in frontend/src/components/entity/forms/
- **Commit:** 67911bf

## Key Commits

| Hash | Description |
|------|-------------|
| 0c11fbc | Add nested modal state to draftStoreV2 |
| 67911bf | Create NestedModalStack component with initialData support |
| 216ba53 | Wire nested create into forms and SidebarV2 |

## Technical Notes

### Callback Injection Pattern

The key insight is that the parent form owns its state, so it must set up the callback that knows how to add entities to its selection. The flow is:

```typescript
// In CategoryForm
onCreateNew={
  onCreateRelatedEntity && setOnNestedEntityCreated
    ? (id) => {
        // Form sets its own callback
        setOnNestedEntityCreated((newKey) => {
          const current = form.getValues('parents') || []
          form.setValue('parents', [...current, newKey])
        })
        // Then triggers nested modal
        onCreateRelatedEntity('category', id)
      }
    : undefined
}
```

### Single Level Nesting

Nested forms don't receive `onCreateRelatedEntity` or `setOnNestedEntityCreated`, which means their EntityCombobox components don't show "Create" option. This enforces single-level nesting.

## Verification Checklist

- [x] Build passes (TypeScript check)
- [x] NestedModalStack uses nestedCreateModal state from store
- [x] Context hint shows parent entity/field
- [x] ID prefilled from autocomplete input
- [x] Callback mechanism notifies parent form
- [x] NestedModalStack >= 80 lines (147 lines)
- [x] draftStoreV2 contains nestedCreateModal
- [x] NestedModalStack imports CreateEntityModal

## Next Phase Readiness

Ready for Plan 09 (Integration) - all entity creation flows now support cascading create.
