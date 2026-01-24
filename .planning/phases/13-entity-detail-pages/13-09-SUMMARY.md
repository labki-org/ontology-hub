---
phase: 13-entity-detail-pages
plan: 09
type: gap-closure
completed: 2026-01-24
duration: 3m
subsystem: frontend-entity-detail
tags: [react, edit-mode, auto-save, gap-closure]

requires: [13-06, 13-04, 13-01]
provides:
  - ModuleDetail edit mode with useAutoSave
  - BundleDetail edit mode with useAutoSave
  - EditableList integration for member/module management
affects: [13-VERIFICATION]

tech-stack:
  added: []
  patterns:
    - Edit mode with auto-save pattern for composite entities

key-files:
  created: []
  modified:
    - frontend/src/components/entity/detail/ModuleDetail.tsx
    - frontend/src/components/entity/detail/BundleDetail.tsx

decisions:
  - context: ModuleDetail and BundleDetail edit mode
    decision: Migrate from inline EditableField to EntityHeader component pattern
    rationale: Provides consistent styling and edit mode behavior across all detail pages
    alternatives: Keep inline EditableField
    impact: Consistent UX across all entity detail pages
---

# Phase 13 Plan 09: ModuleDetail + BundleDetail Edit Mode Summary

**One-liner:** Added full edit mode to ModuleDetail and BundleDetail with useAutoSave hook, EditableList components, and EntityHeader migration

## What was built

This gap closure plan added the edit mode functionality that was specified in 13-06 but not fully implemented during execution. The original 13-06 plan created view-only stubs for ModuleDetail and BundleDetail. This plan upgraded them to full edit mode following the established patterns from CategoryDetail and SubobjectDetail.

### ModuleDetail Edit Mode

- **useAutoSave hook integration** with 500ms debounce
- **EditableList components** for each entity type (category, property, subobject, template)
- **Add/remove entity handlers** with immediate state updates and auto-save
- **Saving indicator** displays during draft API calls
- **EntityHeader migration** from inline EditableField to shared component
- **Clickable closure badges** for navigation to category details

### BundleDetail Edit Mode

- **useAutoSave hook integration** with 500ms debounce
- **EditableList component** for modules list
- **Add/remove module handlers** with immediate state updates and auto-save
- **Saving indicator** displays during draft API calls
- **EntityHeader migration** from inline EditableField to shared component
- **Clickable closure badges** for navigation to module details

## How it works

**Edit mode activation:**
1. When `isEditing` prop is true (set by parent EntityDetailModal)
2. EditableList shows + icon and X icons for add/remove
3. Changes trigger handleAdd/handleRemove callbacks
4. Callbacks update local state and call saveChange

**Auto-save flow:**
1. User adds/removes entity or module
2. Local state updates immediately (editedEntities/editedModules)
3. useAutoSave debounces API call (500ms)
4. JSON Patch sent to /api/v2/drafts/{token}/changes
5. isSaving indicator shows during API call
6. Query invalidation refreshes entity data with draft overlay

**State management:**
- `originalValues` tracks canonical values for change detection
- `editedLabel` tracks current label (with auto-save on change)
- `editedEntities` (Module) or `editedModules` (Bundle) tracks current members
- State initialized from API response on component mount
- Edits reflected immediately in UI before API confirms

## Technical implementation

**Pattern followed from CategoryDetail:**

```typescript
// 1. Auto-save hook
const { saveChange, isSaving } = useAutoSave({
  draftToken: draftId || '',
  entityType: 'module',
  entityKey,
  debounceMs: 500,
})

// 2. State initialization
useEffect(() => {
  if (moduleDetail) {
    setEditedLabel(moduleDetail.label)
    setEditedEntities(moduleDetail.entities || {})
    setOriginalValues({ label: moduleDetail.label })
    pushBreadcrumb(entityKey, 'module', moduleDetail.label)
  }
}, [moduleDetail, entityKey, pushBreadcrumb])

// 3. Add/remove handlers
const handleAddEntity = useCallback(
  (entityType: string, entKey: string) => {
    const newEntities = { ...editedEntities }
    if (!newEntities[entityType]) newEntities[entityType] = []
    newEntities[entityType] = [...newEntities[entityType], entKey]
    setEditedEntities(newEntities)
    if (draftId) {
      saveChange([{ op: 'replace', path: '/entities', value: newEntities }])
    }
  },
  [editedEntities, draftId, saveChange]
)

// 4. EditableList integration
<EditableList
  items={editedEntities[entityType] || []}
  onAdd={(key) => handleAddEntity(entityType, key)}
  onRemove={(key) => handleRemoveEntity(entityType, key)}
  isEditing={isEditing}
  placeholder={`Add ${entityType}...`}
  emptyMessage={`No ${entityType}s in module`}
  renderItem={(key) => (
    <Badge
      variant="secondary"
      className="cursor-pointer hover:bg-secondary/80"
      onClick={() => openDetail(key, entityType as EntityType)}
    >
      {key}
    </Badge>
  )}
/>
```

**Data structures:**
- Module: `entities: Record<string, string[]>` (entity type -> keys)
- Bundle: `modules: string[]` (simpler flat array)

**EntityHeader migration:**
- Before: Used inline EditableField for label editing
- After: Uses EntityHeader component for consistent header layout
- Benefit: Same UX as CategoryDetail, PropertyDetail, SubobjectDetail

## Verification

All verification checks passed:

```bash
# ModuleDetail patterns
grep "useAutoSave" frontend/src/components/entity/detail/ModuleDetail.tsx
# Line 4: import { useAutoSave } from '@/hooks/useAutoSave'
# Line 38: const { saveChange, isSaving } = useAutoSave({

grep "EditableList" frontend/src/components/entity/detail/ModuleDetail.tsx
# Line 8: import { EditableList } from '../form/EditableList'
# Line 190: <EditableList

grep "handleAddEntity\|handleRemoveEntity" frontend/src/components/entity/detail/ModuleDetail.tsx
# Line 69: const handleAddEntity = useCallback(
# Line 192: onAdd={(key) => handleAddEntity(entityType, key)}
# Line 193: onRemove={(key) => handleRemoveEntity(entityType, key)}

# BundleDetail patterns
grep "useAutoSave" frontend/src/components/entity/detail/BundleDetail.tsx
# Line 4: import { useAutoSave } from '@/hooks/useAutoSave'
# Line 38: const { saveChange, isSaving } = useAutoSave({

grep "EditableList" frontend/src/components/entity/detail/BundleDetail.tsx
# Line 8: import { EditableList } from '../form/EditableList'
# Line 177: <EditableList

grep "handleAddModule\|handleRemoveModule" frontend/src/components/entity/detail/BundleDetail.tsx
# Line 69: const handleAddModule = useCallback(
# Line 179: onAdd={handleAddModule}
# Line 180: onRemove={handleRemoveModule}

# TypeScript compilation
npx tsc --noEmit
# No errors
```

## Testing approach

**Manual testing required:**

1. **Module edit mode:**
   - Open module in draft context with edit mode enabled
   - Click + icon to add category/property/subobject/template
   - Verify "Saving..." indicator appears
   - Verify entity appears in list immediately
   - Click X icon to remove entity
   - Verify entity removed from list immediately
   - Click closure badge to navigate to category detail

2. **Bundle edit mode:**
   - Open bundle in draft context with edit mode enabled
   - Click + icon to add module
   - Verify "Saving..." indicator appears
   - Verify module appears in list immediately
   - Click X icon to remove module
   - Verify module removed from list immediately
   - Click closure badge to navigate to module detail

3. **Label editing:**
   - Edit module/bundle label in draft mode
   - Verify "Saving..." indicator appears
   - Verify label updates in breadcrumb navigation

## Known limitations

1. **No validation on add operations:**
   - User can type any string for entity/module key
   - Backend should validate entity exists
   - Frontend should show error if entity not found

2. **No duplicate prevention:**
   - User can add same entity/module multiple times
   - Frontend should check for duplicates before adding

3. **No autocomplete:**
   - User must know exact entity key to add
   - Future: EntitySearch component for autocomplete

4. **Closure not updated immediately:**
   - Closure computed server-side on next refresh
   - Adding category to module doesn't immediately update closure visualization

## Next phase readiness

**Blockers:** None

**Concerns:** None

**Ready for:** Phase 13 verification and Phase 14 (GitHub integration)

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Hash    | Message                                        |
|---------|------------------------------------------------|
| a3d1b6a | feat(13-09): add edit mode to BundleDetail     |
| b871fe4 | feat(13-09): add edit mode to ModuleDetail     |

## Duration

**Start:** 2026-01-24T23:05:57Z
**End:** 2026-01-24T23:09:16Z
**Duration:** 3 minutes

## Related Plans

- **13-01:** Entity detail infrastructure (useAutoSave hook created)
- **13-02:** Entity form components (EditableList, VisualChangeMarker)
- **13-03:** Entity detail modal (EntityHeader component)
- **13-04:** CategoryDetail implementation (pattern to follow)
- **13-06:** ModuleDetail and BundleDetail stubs (upgraded in this plan)
