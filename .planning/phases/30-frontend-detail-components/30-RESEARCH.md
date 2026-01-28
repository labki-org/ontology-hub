# Phase 30: Frontend Detail Components - Research

**Researched:** 2026-01-28
**Domain:** React detail page components for Dashboard and Resource entities
**Confidence:** HIGH

## Summary

This phase requires creating two new entity detail components (DashboardDetail and ResourceDetail) and updating the sidebar to add a new "Artifacts" section grouping Dashboards, Resources, and Templates together. The research focused on understanding existing codebase patterns rather than external libraries since this project has well-established conventions.

The codebase already has comprehensive patterns for entity detail pages (ModuleDetail, CategoryDetail, TemplateDetail, etc.), form components (InlineEditField, EditableField), sections (AccordionSection, EntityHeader), and the auto-save system (useAutoSave hook). All necessary UI primitives exist in the ui/ folder including Accordion from Radix UI. The API endpoints for dashboards and resources already exist in the backend.

**Primary recommendation:** Follow existing entity detail patterns exactly - use EntityHeader, AccordionSection, useAutoSave, and the established state management pattern with originalValues tracking.

## Standard Stack

This phase uses the existing project stack - no new libraries needed.

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18 | Component framework | Project standard |
| @tanstack/react-query | ^5 | Data fetching with hooks | Project standard, all entity hooks use this |
| Zustand + Immer | ^5 / ^10 | State management | graphStore/draftStore pattern |
| Tailwind CSS | ^3 | Styling | Project standard |
| @radix-ui/react-accordion | ^1 | Accordion primitive | Already used in ui/accordion.tsx |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.400 | Icons | ChevronRight, etc. for accordions |
| clsx + tailwind-merge (via cn) | - | Class utilities | All conditional styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Accordion | Custom collapsible | Custom exists (ui/collapsible.tsx) but Accordion is more feature-rich for nested content |
| Existing AccordionSection | New component | AccordionSection handles single-collapsible, may need extension for nested dashboard pages |

**Installation:**
No new packages needed - all dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/components/entity/detail/
├── DashboardDetail.tsx     # NEW - Dashboard detail page
├── ResourceDetail.tsx      # NEW - Resource detail page
├── CategoryDetail.tsx      # Existing - pattern to follow
├── ModuleDetail.tsx        # Existing - pattern to follow
├── TemplateDetail.tsx      # Existing - wikitext display pattern
└── ...

src/api/
├── entities.ts             # ADD - useDashboard, useResource hooks
└── types.ts                # EXISTING - DashboardDetailV2, ResourceDetailV2 already defined

src/components/layout/
└── Sidebar.tsx             # MODIFY - add Artifacts section
```

### Pattern 1: Entity Detail Component Structure
**What:** Standard structure for all *Detail.tsx components
**When to use:** Every entity detail page
**Example:**
```typescript
// Source: ModuleDetail.tsx, CategoryDetail.tsx patterns
interface XxxDetailProps {
  entityKey: string
  draftId?: string      // Draft UUID for queries
  draftToken?: string   // Draft token for mutations
  isEditing: boolean    // Auto-derived from !!draftId in EntityDetailPanel
}

export function XxxDetail({ entityKey, draftId, draftToken, isEditing }: XxxDetailProps) {
  // 1. Data fetching with draft overlay
  const { data, isLoading, error } = useXxx(entityKey, draftId)

  // 2. Type assertion to detailed type
  const entity = data as XxxDetailV2 | undefined

  // 3. Original values tracking for change detection
  const [originalValues, setOriginalValues] = useState<{...}>({})

  // 4. Local editable state (separate from original)
  const [editedField1, setEditedField1] = useState('')

  // 5. Ref to track initialized entity (prevent reset on refetch)
  const initializedEntityRef = useRef<string | null>(null)

  // 6. Auto-save hook
  const { saveChange, isSaving } = useAutoSave({
    draftToken: draftToken || '',
    entityType: 'xxx',
    entityKey,
    debounceMs: 500,
  })

  // 7. Effect to initialize state when entity changes
  useEffect(() => {
    if (entity && initializedEntityRef.current !== entityKey) {
      setEditedField1(entity.field1)
      setOriginalValues({ field1: entity.field1 })
      initializedEntityRef.current = entityKey
    }
  }, [entity, entityKey])

  // 8. Change handlers that call saveChange with JSON Patch
  const handleField1Change = useCallback((value: string) => {
    setEditedField1(value)
    if (draftToken) {
      saveChange([{ op: 'add', path: '/field1', value }])  // Use 'add' not 'replace'
    }
  }, [draftToken, saveChange])

  // 9. Loading/error states
  if (isLoading) return <Skeleton />
  if (error || !entity) return <ErrorDisplay />

  // 10. Render with EntityHeader + AccordionSections
  return (
    <div className="p-6 space-y-6">
      {isSaving && <SavingIndicator />}
      <EntityHeader {...} />
      <AccordionSection id="section1" title="Section 1">
        {/* Content */}
      </AccordionSection>
    </div>
  )
}
```

### Pattern 2: Nested Accordion for Dashboard Pages
**What:** Dashboard pages use accordion with potential nesting for child pages
**When to use:** DashboardDetail page display
**Example:**
```typescript
// Based on: CONTEXT.md decisions - nested accordions for child pages
// Dashboard pages structure: pages: DashboardPage[] where each has name, wikitext
// Decision: one page open at a time, nested child pages as indented accordions

<Accordion type="single" collapsible>
  {pages.map((page) => (
    <AccordionItem key={page.name} value={page.name}>
      <AccordionTrigger>{page.name}</AccordionTrigger>
      <AccordionContent>
        {/* Wikitext display - per decision: raw with code-style formatting */}
        <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/30 rounded-md p-4">
          {page.wikitext}
        </pre>
        {/* Nested child pages would go here as indented accordions */}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

### Pattern 3: Dynamic Field Display for Resources
**What:** Resources have category_key and dynamic_fields (properties from category schema)
**When to use:** ResourceDetail displaying property values
**Example:**
```typescript
// Per CONTEXT.md: flat list layout, key-value display
// Category shown as header link (clickable navigation)

<div className="space-y-6">
  {/* Category as clickable header link */}
  <div className="flex items-center gap-2">
    <span className="text-muted-foreground">Category:</span>
    <button
      onClick={() => setSelectedEntity(resource.category_key, 'category')}
      className="text-primary hover:underline font-medium"
    >
      {categoryLabel}
    </button>
  </div>

  {/* Dynamic fields as flat key-value list */}
  <div className="space-y-3">
    {Object.entries(dynamicFields).map(([key, value]) => (
      <div key={key} className="flex flex-col">
        <span className="text-sm font-medium text-muted-foreground">{key}</span>
        <span className="text-sm">{formatValue(value)}</span>
      </div>
    ))}
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Using 'replace' instead of 'add' in patches:** Per CLAUDE.md, 'replace' fails if field doesn't exist. Always use 'add' for setting values.
- **Resetting state on every refetch:** Use initializedEntityRef pattern to only reset on entity change, not on auto-save refetch.
- **Direct mutation of original values:** Keep originalValues separate from edited state for change detection.
- **Forgetting to add case in EntityDetailPanel:** New detail components must be registered in the switch statement.

## Don't Hand-Roll

Problems that look simple but have existing solutions in this codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accordion UI | Custom collapsible | `AccordionSection` from sections/ | Handles count badge, styling, default open state |
| Entity header display | Custom header | `EntityHeader` from sections/ | Handles label edit, change status badge, description |
| Inline field editing | Custom input toggle | `InlineEditField` or `EditableField` | Keyboard handling, revert, save/cancel |
| Auto-save with debounce | Custom debounce | `useAutoSave` hook | Query invalidation, race condition handling |
| Change status badges | Custom badges | `Badge` with established color patterns | Consistent styling across app |
| Loading skeletons | Custom spinners | `Skeleton` from ui/ | Consistent loading states |

**Key insight:** This codebase has mature patterns for entity detail pages. Following existing patterns ensures consistency and avoids reimplementing solved problems.

## Common Pitfalls

### Pitfall 1: JSON Patch "replace" on Missing Fields
**What goes wrong:** `{ op: 'replace', path: '/field', value }` throws `JsonPatchConflict` if field doesn't exist in canonical_json
**Why it happens:** canonical_json may not have all fields, especially for optional fields or new entity types
**How to avoid:** Always use `{ op: 'add', path: '/field', value }` - 'add' creates or replaces
**Warning signs:** `JsonPatchConflict` errors when saving draft changes

### Pitfall 2: State Reset on Auto-Save Refetch
**What goes wrong:** User types, auto-save triggers, query refetch resets their typing position
**Why it happens:** useEffect watching entity data resets local state on every data change
**How to avoid:** Track initialized entity key in ref, only reset when entityKey changes
**Warning signs:** Cursor jumps, typed text disappears after brief pause

### Pitfall 3: Missing EntityDetailPanel Registration
**What goes wrong:** New detail component exists but never renders - shows "Unknown entity type"
**Why it happens:** Forgot to add case in EntityDetailPanel switch statement
**How to avoid:** Checklist: 1) Create component, 2) Add to EntityDetailPanel switch, 3) Add to Sidebar EntitySection
**Warning signs:** Clicking entity shows "Unknown entity type: dashboard"

### Pitfall 4: Sidebar Entity Type Mismatch
**What goes wrong:** Click on sidebar item selects entity but detail panel shows wrong component
**Why it happens:** entityType string passed to setSelectedEntity doesn't match EntityDetailPanel switch cases
**How to avoid:** Use consistent type strings: 'dashboard', 'resource' (lowercase, singular)
**Warning signs:** Wrong detail component renders, or "Unknown entity type" appears

### Pitfall 5: Missing API Hooks
**What goes wrong:** Detail component can't fetch data - "useDashboard is not exported"
**Why it happens:** API hook for new entity type not added to entities.ts
**How to avoid:** Add `useDashboard` and `useResource` hooks following existing patterns
**Warning signs:** Build error about missing export

## Code Examples

Verified patterns from existing codebase:

### API Hook Pattern (entities.ts)
```typescript
// Source: frontend/src/api/entities.ts - existing patterns
export function useDashboard(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'dashboard', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('dashboards', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function useResource(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'resource', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('resources', entityKey, draftId),
    enabled: !!entityKey,
  })
}

export function useDashboards(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'dashboards', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('dashboards', cursor, limit, draftId),
  })
}

export function useResources(cursor?: string, limit?: number, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'resources', { cursor, limit, draftId }],
    queryFn: () => fetchEntitiesV2('resources', cursor, limit, draftId),
  })
}
```

### EntityDetailPanel Registration
```typescript
// Source: frontend/src/components/entity/EntityDetailPanel.tsx
// Add to imports:
import { DashboardDetail } from './detail/DashboardDetail'
import { ResourceDetail } from './detail/ResourceDetail'

// Add to switch statement:
case 'dashboard':
  return <DashboardDetail {...props} />
case 'resource':
  return <ResourceDetail {...props} />
```

### Sidebar Artifacts Section
```typescript
// Source: frontend/src/components/layout/Sidebar.tsx
// Move Templates into new Artifacts section with Dashboards and Resources

{/* Artifacts group - NEW SECTION */}
<div className="mb-2">
  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
    Artifacts
  </div>
  <EntitySection
    title="Dashboards"
    icon={LayoutDashboard}  // from lucide-react
    entities={dashboards}
    isLoading={dashboardsLoading}
    searchTerm={debouncedSearchTerm}
    entityType="dashboard"
    isDraftMode={isDraftMode}
    onAddNew={() => openCreateModal('dashboard')}
    onDelete={(key, label) => handleDelete('dashboard', key, label)}
    onUndoDelete={handleUndoDelete}
    deletedEntityChanges={deletedEntityChanges}
  />
  <EntitySection
    title="Resources"
    icon={FileText}  // from lucide-react
    entities={resources}
    isLoading={resourcesLoading}
    searchTerm={debouncedSearchTerm}
    entityType="resource"
    isDraftMode={isDraftMode}
    onAddNew={() => openCreateModal('resource')}
    onDelete={(key, label) => handleDelete('resource', key, label)}
    onUndoDelete={handleUndoDelete}
    deletedEntityChanges={deletedEntityChanges}
  />
  <EntitySection
    title="Templates"
    icon={FileCode}
    entities={templates}
    isLoading={templatesLoading}
    searchTerm={debouncedSearchTerm}
    entityType="template"
    isDraftMode={isDraftMode}
    onAddNew={() => openCreateModal('template')}
    onDelete={(key, label) => handleDelete('template', key, label)}
    onUndoDelete={handleUndoDelete}
    deletedEntityChanges={deletedEntityChanges}
  />
</div>
```

### Wikitext Display (from TemplateDetail)
```typescript
// Source: frontend/src/components/entity/detail/TemplateDetail.tsx
// Pattern for displaying raw wikitext content

{isEditing ? (
  <Textarea
    value={editedWikitext}
    onChange={handleWikitextChange}
    className="min-h-[300px] font-mono text-sm"
    placeholder="Enter wikitext content..."
  />
) : (
  <div className="bg-muted/30 rounded-md p-4">
    {wikitext ? (
      <pre className="whitespace-pre-wrap font-mono text-sm overflow-x-auto">
        {wikitext}
      </pre>
    ) : (
      <p className="text-sm text-muted-foreground italic">
        No wikitext content
      </p>
    )}
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Individual accordion sections | AccordionSection component | Phase 24 | Consistent styling, counts |
| Manual debounce | useAutoSave hook | Phase 23 | Query invalidation handled |
| Replace in patches | Add in patches | Per CLAUDE.md | Prevents JsonPatchConflict |

**Deprecated/outdated:**
- Direct use of `<Accordion>` - use `<AccordionSection>` wrapper instead
- `op: 'replace'` in patches - always use `op: 'add'` per CLAUDE.md

## Open Questions

Things that couldn't be fully resolved:

1. **Dashboard nested pages structure**
   - What we know: DashboardPage has `name` and `wikitext` fields
   - What's unclear: How are child/nested pages represented? Is there a `parent` field or `children` array?
   - Recommendation: Check actual dashboard data in DB; if no nesting structure, implement flat list first, add nesting later

2. **Resource field validation in edit mode**
   - What we know: Resources have dynamic_fields keyed by property names
   - What's unclear: Should edit mode validate against category's property constraints (allowed_values, pattern)?
   - Recommendation: Per CONTEXT.md "validation follows existing patterns" - defer to Phase 31 create/edit forms

3. **Empty field display decision**
   - What we know: CONTEXT.md marks this as Claude's discretion
   - Recommendation: Show all fields including empty ones (consistency, user can see what fields exist)

4. **Save timing decision**
   - What we know: CONTEXT.md marks this as Claude's discretion
   - Recommendation: Use auto-save on blur/change (consistent with existing detail pages)

## Sources

### Primary (HIGH confidence)
- `/home/daharoni/dev/ontology-hub/frontend/src/components/entity/detail/ModuleDetail.tsx` - Entity detail pattern
- `/home/daharoni/dev/ontology-hub/frontend/src/components/entity/detail/CategoryDetail.tsx` - Edit mode pattern
- `/home/daharoni/dev/ontology-hub/frontend/src/components/entity/detail/TemplateDetail.tsx` - Wikitext display
- `/home/daharoni/dev/ontology-hub/frontend/src/api/entities.ts` - API hook patterns
- `/home/daharoni/dev/ontology-hub/frontend/src/api/types.ts` - Type definitions (DashboardDetailV2, ResourceDetailV2)
- `/home/daharoni/dev/ontology-hub/frontend/src/components/layout/Sidebar.tsx` - Sidebar structure
- `/home/daharoni/dev/ontology-hub/frontend/src/components/entity/EntityDetailPanel.tsx` - Detail routing
- `/home/daharoni/dev/ontology-hub/frontend/src/hooks/useAutoSave.ts` - Auto-save hook
- `/home/daharoni/dev/ontology-hub/frontend/src/components/entity/sections/AccordionSection.tsx` - Accordion wrapper
- `/home/daharoni/dev/ontology-hub/CLAUDE.md` - JSON Patch guidance

### Secondary (MEDIUM confidence)
- `/home/daharoni/dev/ontology-hub/backend/app/routers/entities.py` - Backend API endpoints exist for dashboards/resources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing project dependencies
- Architecture: HIGH - Following established codebase patterns
- Pitfalls: HIGH - Documented from codebase analysis and CLAUDE.md

**Research date:** 2026-01-28
**Valid until:** 60 days (stable internal patterns)
