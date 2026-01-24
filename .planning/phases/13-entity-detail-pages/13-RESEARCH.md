# Phase 13: Entity Detail Pages - Research

**Researched:** 2026-01-24
**Domain:** React form handling, detail pages, view/edit mode UI patterns
**Confidence:** HIGH

## Summary

Entity detail pages with view/edit modes are a well-established pattern in React applications. The standard approach combines React Hook Form for state management, Zod for validation, shadcn/ui components for UI, and custom hooks for auto-save with debouncing. The project already has the necessary foundation installed (React Hook Form v7.71.1, Zod v4.3.5, shadcn/ui components).

**Key architectural decisions:**
- Use React Hook Form's `useWatch` for isolated re-renders, not root-level `watch`
- Implement auto-save with 500-1000ms debounce delay
- Track dirty state at field level using `dirtyFields` for visual indicators
- Use discriminated unions for type-safe entity handling across six entity types
- Leverage shadcn/ui Dialog, Accordion, and Breadcrumb components (need to install missing ones)

**Primary recommendation:** Build composable detail page components using compound component pattern, with shared form logic in custom hooks and entity-specific rendering in separate components. Avoid monolithic components that handle all six entity types in one file.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.71.1 | Form state management | Industry standard, minimal re-renders, excellent TypeScript support |
| zod | 4.3.5 | Schema validation | TypeScript-first, shared client/server validation, generates types from schemas |
| @hookform/resolvers | 5.2.2 | Zod integration | Official bridge between RHF and Zod |
| shadcn/ui | (various) | UI components | Accessible Radix primitives with Tailwind styling |
| @radix-ui/react-dialog | Latest | Modal overlays | WAI-ARIA compliant, keyboard navigation, focus management |
| @radix-ui/react-collapsible | 1.1.12 | Accordion sections | Accessible collapsible sections, already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-accordion | Latest | Alternative to Collapsible | Use if need single-expand mode (only one section open at a time) |
| @uiw/react-textarea-code-editor | Latest | Syntax highlighting for wikitext | Optional for Template entity wikitext display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form | Formik | Formik has larger bundle, more re-renders, less TypeScript support |
| Zod | Yup | Yup lacks TypeScript-first approach, no automatic type inference |
| shadcn/ui | Headless UI | Would need custom Tailwind styling from scratch |

**Installation:**
```bash
# Install missing shadcn/ui components
npx shadcn@latest add dialog
npx shadcn@latest add breadcrumb
npx shadcn@latest add accordion  # alternative to manual Collapsible usage
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add form

# Optional: Syntax highlighting for wikitext
npm install @uiw/react-textarea-code-editor
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── entity/
│   │   ├── EntityDetailPanel.tsx        # Existing, expand to handle all types
│   │   ├── EntityDetailModal.tsx        # New: Full detail view as modal
│   │   ├── detail/
│   │   │   ├── CategoryDetail.tsx       # Entity-specific detail components
│   │   │   ├── PropertyDetail.tsx
│   │   │   ├── SubobjectDetail.tsx
│   │   │   ├── ModuleDetail.tsx
│   │   │   ├── BundleDetail.tsx
│   │   │   └── TemplateDetail.tsx
│   │   ├── sections/
│   │   │   ├── EntityHeader.tsx         # Shared header component
│   │   │   ├── MembershipSection.tsx    # Module/bundle membership display
│   │   │   ├── PropertiesSection.tsx    # Reusable properties display
│   │   │   └── WhereUsedSection.tsx     # Where-used lists
│   │   └── form/
│   │       ├── EditableField.tsx        # Inline edit with revert
│   │       ├── EditableList.tsx         # Add/remove items
│   │       └── VisualChangeMarker.tsx   # Background shading, border accent
│   └── ui/                               # shadcn/ui components
└── hooks/
    ├── useAutoSave.ts                    # Auto-save with debounce
    ├── useEntityDetail.ts                # Fetch entity by type
    └── useDirtyTracking.ts               # Field-level dirty state
```

### Pattern 1: Compound Component for Entity Detail
**What:** Composable detail page with shared header, sections, and entity-specific content
**When to use:** All six entity types need consistent layout with different content

**Example:**
```typescript
// Source: React component composition patterns (patterns.dev)
// EntityDetailModal.tsx
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { EntityHeader } from './sections/EntityHeader'

export function EntityDetailModal({ entityKey, entityType, draftId, isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <EntityHeader entityKey={entityKey} entityType={entityType} draftId={draftId} />
        <EntityDetailContent entityKey={entityKey} entityType={entityType} draftId={draftId} />
      </DialogContent>
    </Dialog>
  )
}

function EntityDetailContent({ entityKey, entityType, draftId }) {
  switch (entityType) {
    case 'category':
      return <CategoryDetail entityKey={entityKey} draftId={draftId} />
    case 'property':
      return <PropertyDetail entityKey={entityKey} draftId={draftId} />
    // ... other types
  }
}
```

### Pattern 2: Auto-Save with Debounce
**What:** Save form changes automatically after user stops typing
**When to use:** All edit mode fields that modify entity data

**Example:**
```typescript
// Source: Medium - Smarter Forms in React (Darius Marlowe)
// hooks/useAutoSave.ts
import { useEffect } from 'react'
import { useDebounce } from '@/hooks/useDebounce'
import { useMutation } from '@tanstack/react-query'

export function useAutoSave(data: any, onSave: (data: any) => Promise<void>, delay = 500) {
  const debouncedData = useDebounce(data, delay)

  const saveMutation = useMutation({
    mutationFn: onSave,
  })

  useEffect(() => {
    if (debouncedData) {
      saveMutation.mutate(debouncedData)
    }
  }, [debouncedData])

  return { isSaving: saveMutation.isPending, error: saveMutation.error }
}

// Usage in form component
function EditableEntityField({ entityKey, fieldName, initialValue }) {
  const { register, watch } = useForm({ defaultValues: { [fieldName]: initialValue } })
  const currentValue = watch(fieldName)

  const { isSaving } = useAutoSave(
    { entityKey, [fieldName]: currentValue },
    async (data) => await updateEntity(data),
    500
  )

  return <input {...register(fieldName)} />
}
```

### Pattern 3: Field-Level Dirty Tracking with Visual Indicators
**What:** Track which fields changed and show visual markers (background shading, border accent)
**When to use:** All editable fields to provide feedback without toast notifications

**Example:**
```typescript
// Source: React Hook Form useFormState documentation
import { useFormState, useForm } from 'react-hook-form'

function EditableField({ name, defaultValue, originalValue }) {
  const { register, control } = useForm({ defaultValues: { [name]: defaultValue } })
  const { dirtyFields } = useFormState({ control })

  const isDirty = dirtyFields[name]

  return (
    <div className="relative">
      <input
        {...register(name)}
        className={cn(
          "w-full px-3 py-2 rounded-md",
          isDirty && "bg-yellow-50 border-l-4 border-l-yellow-500 text-yellow-900"
        )}
      />
      {isDirty && (
        <Tooltip>
          <TooltipTrigger className="absolute right-2 top-2">
            <span className="text-xs text-muted-foreground">Original: {originalValue}</span>
          </TooltipTrigger>
        </Tooltip>
      )}
    </div>
  )
}
```

### Pattern 4: Discriminated Union for Entity Types
**What:** Type-safe handling of different entity types using TypeScript discriminated unions
**When to use:** Any code that needs to handle all six entity types with type safety

**Example:**
```typescript
// Source: TypeScript Handbook - Discriminated Unions
// api/types.ts
export type EntityDetailUnion =
  | { entity_type: 'category'; data: CategoryDetailV2 }
  | { entity_type: 'property'; data: PropertyDetailV2 }
  | { entity_type: 'subobject'; data: SubobjectDetailV2 }
  | { entity_type: 'module'; data: ModuleDetailV2 }
  | { entity_type: 'bundle'; data: BundleDetailV2 }
  | { entity_type: 'template'; data: TemplateDetailV2 }

// Usage with type narrowing
function renderEntityDetail(entity: EntityDetailUnion) {
  switch (entity.entity_type) {
    case 'category':
      // TypeScript knows entity.data is CategoryDetailV2
      return <CategoryDetail data={entity.data} />
    case 'property':
      // TypeScript knows entity.data is PropertyDetailV2
      return <PropertyDetail data={entity.data} />
    // ... other cases
  }
}
```

### Pattern 5: Accordion Sections with Reset on Navigation
**What:** Collapsible sections that reset to default state when navigating between entities
**When to use:** Organize detail page content into logical, collapsible sections

**Example:**
```typescript
// Source: shadcn/ui Accordion documentation
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

function CategoryDetail({ entityKey }) {
  // Reset accordion state on entity change using key prop
  return (
    <Accordion key={entityKey} type="multiple" defaultValue={['parents', 'properties']}>
      <AccordionItem value="parents">
        <AccordionTrigger>Parent Categories</AccordionTrigger>
        <AccordionContent>
          {/* Parent list */}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="properties">
        <AccordionTrigger>Properties</AccordionTrigger>
        <AccordionContent>
          {/* Properties list */}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
```

### Pattern 6: Inline Edit with Revert
**What:** Edit field inline with ESC key to revert, Enter to save
**When to use:** Simple text fields that need quick editing

**Example:**
```typescript
// Source: DEV Community - Build Inline Edit with React Hooks
function InlineEditField({ value, onSave }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [originalValue] = useState(value)

  const handleSave = () => {
    if (editValue.trim()) {
      onSave(editValue)
      setIsEditing(false)
    } else {
      // Revert if empty
      setEditValue(originalValue)
      setIsEditing(false)
    }
  }

  const handleRevert = () => {
    setEditValue(originalValue)
    setIsEditing(false)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleRevert()
    } else if (e.key === 'Enter') {
      handleSave()
    }
  }

  if (!isEditing) {
    return <span onClick={() => setIsEditing(true)}>{value}</span>
  }

  return (
    <div className="flex gap-2">
      <input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <button onClick={handleRevert}>Revert</button>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Monolithic Entity Component:** Don't create one massive component that handles all six entity types with conditional rendering. Use discriminated unions and separate components.
- **Root-Level watch():** Avoid using `watch()` at form root level, which triggers re-renders across the entire form. Use `useWatch` for isolated field subscriptions.
- **Array Index as Keys:** Never use array indexes as keys for list items (parents, properties, modules). Use stable entity IDs.
- **Direct State Mutation:** Don't mutate form state directly. Always use React Hook Form's setValue or reset methods.
- **Premature Optimization:** Don't optimize form re-renders until you measure actual performance issues. React Hook Form is already optimized.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounced auto-save | Custom setTimeout/clearTimeout logic | useDebounce hook + useEffect | Handles edge cases (unmount cleanup, rapid changes, race conditions) |
| Form validation | Manual field validation functions | Zod schemas + @hookform/resolvers | Type safety, reusable schemas, automatic TypeScript types |
| Modal dialogs | Custom overlay with portal | shadcn/ui Dialog (Radix Dialog) | Accessibility (focus trap, ESC key, screen reader), keyboard navigation |
| Dirty field tracking | Manual comparison of current vs original | React Hook Form's dirtyFields | Handles nested objects, arrays, edge cases |
| Breadcrumb navigation | Custom link chain component | shadcn/ui Breadcrumb | Accessibility (aria-label, semantic ol), responsive patterns |
| Accordion sections | Custom collapsible divs | shadcn/ui Accordion or Collapsible | Keyboard navigation, ARIA attributes, animation |

**Key insight:** Form handling has many subtle edge cases (stale closures, race conditions, memory leaks on unmount). Using established libraries prevents bugs that only appear in production under specific user behaviors.

## Common Pitfalls

### Pitfall 1: Auto-Save Race Conditions
**What goes wrong:** Multiple auto-save requests fire in sequence, but responses arrive out of order, causing newer data to be overwritten by older data.

**Why it happens:** User types rapidly, triggering multiple debounced saves. Backend processes them in parallel, but responses don't arrive in order sent.

**How to avoid:**
- Track a version number or timestamp with each save
- Cancel in-flight requests when new save triggers
- Use optimistic updates with rollback on conflict

**Warning signs:**
- Data "flickering" back to old values after typing
- Intermittent save failures with no error message
- Users report "my changes disappeared"

**Example prevention:**
```typescript
// Track request ID to ignore out-of-order responses
let latestRequestId = 0

const saveMutation = useMutation({
  mutationFn: async (data) => {
    const requestId = ++latestRequestId
    const result = await updateEntity(data)

    // Ignore response if newer request already sent
    if (requestId !== latestRequestId) {
      throw new Error('Stale save request')
    }
    return result
  }
})
```

### Pitfall 2: Stale Closures in useEffect with Form Watch
**What goes wrong:** useEffect callback has stale reference to form values, causing auto-save to use old data.

**Why it happens:** useEffect captures values at render time. If dependencies array is incomplete, callback uses stale values.

**How to avoid:**
- Use `useWatch` instead of `watch()` to get current values
- Always include all dependencies in useEffect array
- Use ESLint react-hooks/exhaustive-deps rule

**Warning signs:**
- Auto-save sends previous value instead of current
- Form appears to "lag" behind user input
- Changes only save after second keystroke

**Example:**
```typescript
// BAD: Stale closure
const value = watch('fieldName')
useEffect(() => {
  save(value) // Uses value from when effect was created
}, []) // Missing 'value' in dependencies

// GOOD: Current value
const value = useWatch({ control, name: 'fieldName' })
useEffect(() => {
  save(value) // Always uses current value
}, [value])
```

### Pitfall 3: Accordion State Persisting Across Navigation
**What goes wrong:** User expands sections on Entity A, navigates to Entity B, and sections are still expanded from Entity A state.

**Why it happens:** React re-uses component instances when entity type stays the same, preserving internal state.

**How to avoid:**
- Use `key` prop with entity ID to force new component instance
- Reset accordion state in useEffect when entity changes
- Use controlled accordion with state derived from entity ID

**Warning signs:**
- Sections open/closed state "carries over" between entities
- User expects sections to reset but they don't
- Inconsistent UI state on navigation

**Example:**
```typescript
// BAD: State persists
<Accordion type="multiple">
  <AccordionItem value="properties">...</AccordionItem>
</Accordion>

// GOOD: Resets on entity change
<Accordion key={entityKey} type="multiple" defaultValue={['properties']}>
  <AccordionItem value="properties">...</AccordionItem>
</Accordion>
```

### Pitfall 4: Modal Not Blocking Interaction Behind It
**What goes wrong:** User can still click elements behind the modal, causing unexpected navigation or actions.

**Why it happens:** Modal overlay doesn't capture pointer events, or z-index is incorrect.

**How to avoid:**
- Use Radix Dialog (shadcn/ui Dialog) which handles this automatically
- Ensure overlay has `pointer-events: auto` and appropriate z-index
- Test keyboard navigation (Tab should stay within modal)

**Warning signs:**
- Users can click "through" the modal
- Tab key moves focus to elements behind modal
- ESC key doesn't close modal

**Example:**
```typescript
// GOOD: Radix Dialog handles all of this
import { Dialog, DialogContent } from '@/components/ui/dialog'

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    {/* Focus trap, overlay click, ESC key all handled */}
  </DialogContent>
</Dialog>
```

### Pitfall 5: Missing TypeScript Discrimination for Entity Types
**What goes wrong:** Code tries to access `entity.parents` on a Property entity, causing runtime errors.

**Why it happens:** TypeScript doesn't know which entity type is being used, allowing invalid field access.

**How to avoid:**
- Use discriminated unions with `entity_type` as discriminator
- Always switch/match on entity type before accessing fields
- Define separate detail interfaces for each entity type

**Warning signs:**
- TypeScript errors like "Property 'parents' does not exist on type..."
- Runtime errors when rendering entity details
- Need for excessive type assertions (`as CategoryDetailV2`)

**Example:**
```typescript
// BAD: No discrimination
function renderDetail(entity: any) {
  return <div>{entity.parents}</div> // Runtime error if not Category
}

// GOOD: Discriminated union
type EntityDetail =
  | { entity_type: 'category'; parents: string[] }
  | { entity_type: 'property'; datatype: string }

function renderDetail(entity: EntityDetail) {
  if (entity.entity_type === 'category') {
    return <div>{entity.parents}</div> // TypeScript knows .parents exists
  }
  // ...
}
```

### Pitfall 6: Breadcrumb Navigation Breaking on Direct URL Access
**What goes wrong:** User bookmarks deep link like `/browse?entity=Person&type=category`, breadcrumb shows only "Person" without parent path.

**Why it happens:** Breadcrumb assumes navigation happened through clicking links, doesn't derive path from data.

**How to avoid:**
- Build breadcrumb trail from entity data (parents), not navigation history
- For categories, query parent hierarchy on load
- Store minimal state in URL (entity ID), derive display state from API

**Warning signs:**
- Breadcrumbs empty on page refresh
- Direct links show incomplete navigation path
- Breadcrumbs don't match actual hierarchy

**Example:**
```typescript
// BAD: Based on navigation history
const [breadcrumbs, setBreadcrumbs] = useState([])
// Clicking entity adds to breadcrumbs, but refresh clears it

// GOOD: Derived from entity data
function useBreadcrumbs(entity: CategoryDetailV2) {
  // Query parent hierarchy from API
  const { data: parentChain } = useQuery(['parents', entity.entity_key], () =>
    fetchParentChain(entity.entity_key)
  )
  return parentChain || []
}
```

## Code Examples

Verified patterns from official sources:

### React Hook Form with Zod Schema
```typescript
// Source: React Hook Form official docs + shadcn/ui Form examples
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const categorySchema = z.object({
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  parents: z.array(z.string()),
})

type CategoryFormData = z.infer<typeof categorySchema>

function CategoryEditForm({ category, onSave }) {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      label: category.label,
      description: category.description || '',
      parents: category.parents,
    },
  })

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Label</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  )
}
```

### useWatch for Performance
```typescript
// Source: React Hook Form official docs - useWatch
import { useWatch } from 'react-hook-form'

function AutoSaveFormField({ control, name, onSave }) {
  // Only this component re-renders when field changes
  const value = useWatch({
    control,
    name,
  })

  const debouncedValue = useDebounce(value, 500)

  useEffect(() => {
    if (debouncedValue !== undefined) {
      onSave({ [name]: debouncedValue })
    }
  }, [debouncedValue, name, onSave])

  return null // Render nothing, just watches and saves
}
```

### Breadcrumb with shadcn/ui
```typescript
// Source: shadcn/ui Breadcrumb documentation
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'

function EntityBreadcrumb({ parentChain, currentEntity }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/browse">Categories</BreadcrumbLink>
        </BreadcrumbItem>

        {parentChain.map((parent) => (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem key={parent.entity_key}>
              <BreadcrumbLink href={`/browse?entity=${parent.entity_key}&type=category`}>
                {parent.label}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </>
        ))}

        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentEntity.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
```

### Modal Dialog with shadcn/ui
```typescript
// Source: shadcn/ui Dialog documentation
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

function EntityDetailModal({ entity, isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entity.label}</DialogTitle>
          {entity.description && (
            <DialogDescription>{entity.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Entity-specific content */}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Dirty Field Visual Indicator
```typescript
// Source: React Hook Form formState documentation
import { useFormContext, useFormState } from 'react-hook-form'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function DirtyField({ name, originalValue, children }) {
  const { control } = useFormContext()
  const { dirtyFields } = useFormState({ control })

  const isDirty = dirtyFields[name]

  return (
    <div className={cn(
      "relative",
      isDirty && "bg-yellow-50 border-l-4 border-l-yellow-500 pl-2"
    )}>
      {children}
      {isDirty && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute top-0 right-0 p-1">
              <span className="text-xs text-yellow-700">Modified</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Original: {originalValue}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Formik for forms | React Hook Form | ~2020-2021 | 3x fewer re-renders, better TypeScript, smaller bundle |
| PropTypes for validation | Zod schemas | ~2021-2022 | Runtime validation + TypeScript types from same schema |
| Custom useDebounce | Library hooks | ~2023 | Standardized, tested implementations available |
| Manual modal overlays | Radix Dialog primitives | ~2022-2023 | Full accessibility out of the box |
| react-router v5 | react-router v6/v7 | 2021/2025 | New hooks (useSearchParams), nested routes |
| Class components for forms | Function components + hooks | ~2019 | Simpler code, better composition |

**Deprecated/outdated:**
- **Uncontrolled forms with refs:** React Hook Form uses uncontrolled internally but exposes controlled API. Don't manage refs manually.
- **Redux for form state:** Overkill for local form state. Use React Hook Form's internal state management.
- **react-modal library:** Replaced by Radix Dialog (shadcn/ui Dialog) with better accessibility.
- **Manually implementing accordion with useState:** Use Radix Accordion/Collapsible for accessibility.

## Open Questions

Things that couldn't be fully resolved:

1. **Module/Bundle closure computation**
   - What we know: Backend computes closure (auto-included dependencies), frontend displays it
   - What's unclear: Should frontend compute closure client-side or always fetch from backend?
   - Recommendation: Fetch from backend to match version increment suggestions (backend has full graph)

2. **Wikitext syntax highlighting**
   - What we know: @uiw/react-textarea-code-editor supports syntax highlighting, but MediaWiki syntax isn't a standard language
   - What's unclear: Is custom wikitext highlighting worth the complexity?
   - Recommendation: Start with plain textarea (shadcn/ui Textarea). Add highlighting in future phase if users request it. Decision is Claude's discretion per CONTEXT.md.

3. **Suggested version increment algorithm**
   - What we know: Backend suggests major/minor/patch based on breaking changes
   - What's unclear: Is this already implemented in backend validation service?
   - Recommendation: Check backend/app/services/validation.py. If not implemented, this is backend work outside Phase 13 scope.

## Sources

### Primary (HIGH confidence)
- [React Hook Form Documentation](https://react-hook-form.com/) - Official API docs for useForm, useWatch, formState
- [Zod Documentation](https://zod.dev/) - Official schema validation library docs
- [shadcn/ui Components](https://ui.shadcn.com/docs/components) - Dialog, Breadcrumb, Accordion, Form components
- [Radix UI Primitives](https://www.radix-ui.com/primitives) - Accessibility foundation for shadcn/ui

### Secondary (MEDIUM confidence)
- [Smarter Forms in React: Building a useAutoSave Hook](https://darius-marlowe.medium.com/smarter-forms-in-react-building-a-useautosave-hook-with-debounce-and-react-query-d4d7f9bb052e) - Auto-save pattern with React Query
- [React Hook Form Performance Discussion #8535](https://github.com/orgs/react-hook-form/discussions/8535) - useWatch vs watch performance
- [Advanced React Component Composition](https://frontendmastery.com/posts/advanced-react-component-composition-guide/) - Compound component pattern
- [TypeScript Discriminated Unions Handbook](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html) - Official TypeScript docs
- [React State Management with URL Parameters - LogRocket](https://blog.logrocket.com/advanced-react-state-management-using-url-parameters/) - URL sync patterns

### Tertiary (LOW confidence)
- [21 React Design Patterns](https://www.perssondennis.com/articles/21-fantastic-react-design-patterns-and-when-to-use-them) - General patterns overview
- [React Anti-Patterns Collection](https://reactantipatterns.com/) - Community-curated anti-patterns
- [@uiw/react-textarea-code-editor](https://github.com/uiwjs/react-textarea-code-editor) - Optional syntax highlighting library

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified in package.json, official documentation consulted
- Architecture: HIGH - Patterns verified from React Hook Form official docs, shadcn/ui examples
- Pitfalls: MEDIUM - Based on community discussions and common issues, not exhaustive production testing
- Code examples: HIGH - All examples adapted from official documentation or verified community sources

**Research date:** 2026-01-24
**Valid until:** ~30 days (2026-02-24) - React Hook Form and shadcn/ui are stable, but check for minor version updates
