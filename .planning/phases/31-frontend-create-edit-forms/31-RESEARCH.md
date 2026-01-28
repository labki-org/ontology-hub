# Phase 31: Frontend Create/Edit Forms - Research

**Researched:** 2026-01-28
**Domain:** React form patterns for entity creation (Dashboard, Resource)
**Confidence:** HIGH

## Summary

This phase implements create/edit forms for Dashboard and Resource entities following the established patterns in the codebase. Research primarily focused on understanding existing form architecture since CONTEXT.md specifies to "follow existing entity create/edit patterns."

The codebase uses a well-established form pattern: React Hook Form + Zod validation + custom FormField wrapper + EntityCombobox for relationships. DashboardForm will add page management with accordion (matching DashboardDetail), and ResourceForm will add category-driven dynamic fields. Both integrate with the existing CreateEntityModal and useCreateEntityChange infrastructure.

**Primary recommendation:** Follow existing XxxForm patterns exactly. DashboardForm adds pages array management; ResourceForm adds category selection that triggers field population from useCategory hook.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | ^7.71.1 | Form state management | Already used by all entity forms in codebase |
| @hookform/resolvers | ^5.2.2 | Zod schema integration | Existing pattern for validation |
| zod | ^4.3.6 | Schema validation | Consistent with existing schemas.ts |
| @radix-ui/react-accordion | ^1.2.12 | Dashboard page management | Already used in DashboardDetail |
| cmdk | ^1.1.1 | Category dropdown combobox | Already used in EntityCombobox |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-select | ^2.2.6 | Simple dropdowns | Alternative to cmdk for simpler selection |
| lucide-react | ^0.563.0 | Icons | Plus, Trash2, ChevronDown icons |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Textarea for wikitext | Monaco/CodeMirror | Overkill per CONTEXT.md discretion - textarea is sufficient |
| Custom accordion | Native details/summary | Radix already used, maintains consistency |

**Installation:**
```bash
# No new packages needed - all dependencies exist
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/components/entity/forms/
|-- DashboardForm.tsx      # New: Dashboard create/edit form
|-- ResourceForm.tsx       # New: Resource create/edit form
|-- schemas.ts             # Add dashboardSchema, resourceSchema
|-- FormField.tsx          # Existing: reusable field wrapper
|-- EntityCombobox.tsx     # Existing: entity selection dropdown
|-- RelationshipChips.tsx  # Existing: selected entity display
```

### Pattern 1: Form Component Structure
**What:** Entity forms follow a consistent structure
**When to use:** All entity create/edit forms
**Example:**
```typescript
// Source: CategoryForm.tsx (existing pattern)
interface XxxFormProps {
  onSubmit: (data: XxxFormData) => void
  onCancel: () => void
  isSubmitting?: boolean
  draftId?: string
  initialData?: Partial<XxxFormData>
}

export function XxxForm({ onSubmit, onCancel, isSubmitting, draftId, initialData }: XxxFormProps) {
  const form = useForm<XxxFormData>({
    resolver: zodResolver(xxxSchema),
    mode: 'onBlur',
    defaultValues: {
      id: initialData?.id ?? '',
      label: initialData?.label ?? '',
      // ... other fields
    },
  })

  const { isValid } = form.formState

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField name="id" label="ID" required control={form.control} ... />
      {/* ... other fields ... */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}
```

### Pattern 2: Zod Schema Definition
**What:** Schema in schemas.ts with typed exports
**When to use:** Each entity type needs schema + type export
**Example:**
```typescript
// Source: schemas.ts (existing pattern)
export const dashboardSchema = z.object({
  id: genericIdValidation,
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  pages: z.array(z.object({
    name: z.string(),
    wikitext: z.string(),
  })).min(1, 'At least one page is required'),
})

export type DashboardFormData = z.infer<typeof dashboardSchema>
```

### Pattern 3: Dynamic Field Population (Resource-specific)
**What:** Fetch category properties to render dynamic form fields
**When to use:** ResourceForm when category is selected
**Example:**
```typescript
// Source: useCategory hook + CategoryDetailV2 type
const { data: categoryDetail } = useCategory(selectedCategory, draftId)

// CategoryDetailV2.properties contains PropertyProvenance[]
// Each has: entity_key, label, is_required
// Render Input for each property based on this metadata
```

### Pattern 4: Accordion Page Management (Dashboard-specific)
**What:** CRUD operations on pages array within form
**When to use:** DashboardForm page management
**Example:**
```typescript
// Source: DashboardDetail.tsx + Accordion component
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'

// Use form.watch('pages') and form.setValue('pages', [...]) for array operations
// Add page: append to array
// Remove page: filter from array
// Edit wikitext: update specific index
```

### Pattern 5: Sidebar Integration
**What:** CreateEntityModal already wired up for dashboard/resource
**When to use:** N/A - Sidebar already has onAddNew handlers
**Example:**
```typescript
// Source: Sidebar.tsx lines 541-566
// Dashboard and Resource already have:
// - EntitySection with onAddNew={() => openCreateModal('dashboard')}
// - onAddNew={() => openCreateModal('resource')}

// Just need to add form components in the modal switch:
{createModalEntityType === 'dashboard' && (
  <DashboardForm onSubmit={handleCreateSubmit} onCancel={closeCreateModal} ... />
)}
```

### Anti-Patterns to Avoid
- **Inline validation logic:** Use Zod schema, not manual if/else in submit handler
- **Uncontrolled inputs:** All inputs must use react-hook-form Controller via FormField
- **Direct state mutation:** Use form.setValue() for all updates
- **Fetching without draft context:** Always pass draftId to entity hooks for draft overlay

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state | Custom useState per field | react-hook-form | Already integrated, handles validation, dirty tracking |
| Validation | Manual error checking | Zod schema + zodResolver | Type-safe, declarative, consistent |
| Category dropdown | Custom select | EntityCombobox | Already has search, create-new support |
| Entity list fetching | Custom fetch | useCategories, useCategory hooks | Draft overlay, caching handled |
| Modal management | Custom modal state | useDraftStore.openCreateModal | Already wired to sidebar |
| Loading states | Custom loading | isSubmitting from mutation | TanStack Query mutation state |

**Key insight:** The codebase has complete form infrastructure. The task is composing existing primitives for new entity types, not building new abstractions.

## Common Pitfalls

### Pitfall 1: Category Change Resets Fields
**What goes wrong:** User changes category, expects fields to remain
**Why it happens:** Dynamic fields derived from category; new category = new fields
**How to avoid:** Per CONTEXT.md decision: show warning that fields will reset if changed
**Warning signs:** User confusion when editing resource category

### Pitfall 2: Empty Pages Array on Dashboard
**What goes wrong:** Creating dashboard with no pages fails silently
**Why it happens:** Pages array validation not enforced
**How to avoid:** Schema requires min 1 page; auto-create root page on form init
**Warning signs:** Empty pages array in submission

### Pitfall 3: Missing draftId in Entity Hooks
**What goes wrong:** Form dropdowns show canonical data, not draft overlay
**Why it happens:** useCategory(key) without draftId ignores draft changes
**How to avoid:** Always pass draftId from props: useCategory(key, draftId)
**Warning signs:** Related entities don't reflect pending draft changes

### Pitfall 4: CreateEntityParams Missing Entity Types
**What goes wrong:** API rejects dashboard/resource creation
**Why it happens:** CreateEntityParams type may not include new entity types
**How to avoid:** Check/update CreateEntityParams in drafts.ts to include 'dashboard' | 'resource'
**Warning signs:** TypeScript error or runtime 400 from API

### Pitfall 5: Dynamic Fields Type Safety
**What goes wrong:** dynamic_fields[key] is unknown type
**Why it happens:** Resource has Record<string, unknown> for dynamic_fields
**How to avoid:** Cast values to string for form inputs; accept string-only input initially
**Warning signs:** Type errors when binding Input value prop

## Code Examples

Verified patterns from codebase:

### Dashboard Schema
```typescript
// Add to schemas.ts following existing patterns
const dashboardPageSchema = z.object({
  name: z.string(), // Empty string for root page
  wikitext: z.string(),
})

export const dashboardSchema = z.object({
  id: genericIdValidation,
  label: z.string().min(1, 'Label is required'),
  description: z.string().min(1, 'Description is required'),
  pages: z.array(dashboardPageSchema).min(1, 'At least one page is required'),
})

export type DashboardFormData = z.infer<typeof dashboardSchema>
```

### Resource Schema
```typescript
// Add to schemas.ts
export const resourceSchema = z.object({
  id: genericIdValidation,
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  category_key: z.string().min(1, 'Category is required'),
  dynamic_fields: z.record(z.unknown()).default({}),
})

export type ResourceFormData = z.infer<typeof resourceSchema>
```

### Category Selection Dropdown
```typescript
// ResourceForm category selection (single-select variant)
// Source: EntityCombobox pattern adapted for single selection
<EntityCombobox
  entityType="category"
  availableEntities={availableCategories}
  selectedKeys={form.watch('category_key') ? [form.watch('category_key')] : []}
  onChange={(keys) => {
    const newCategory = keys[0] || ''
    if (newCategory !== form.getValues('category_key')) {
      // Reset dynamic fields when category changes
      form.setValue('category_key', newCategory)
      form.setValue('dynamic_fields', {})
    }
  }}
  placeholder="Select category..."
/>
```

### Dynamic Fields Rendering
```typescript
// ResourceForm dynamic fields section
const { data: categoryDetail } = useCategory(selectedCategory, draftId) as { data: CategoryDetailV2 | undefined }

// Render fields based on category properties
{categoryDetail?.properties.map((prop) => (
  <div key={prop.entity_key} className="space-y-2">
    <Label className="flex items-center gap-1">
      {prop.label}
      {prop.is_required && <span className="text-red-600">*</span>}
    </Label>
    <Input
      value={String(form.watch(`dynamic_fields.${prop.entity_key}`) ?? '')}
      onChange={(e) => {
        const current = form.getValues('dynamic_fields') || {}
        form.setValue('dynamic_fields', { ...current, [prop.entity_key]: e.target.value })
      }}
      placeholder={`Enter ${prop.label}...`}
    />
  </div>
))}
```

### Page Management Accordion
```typescript
// DashboardForm page management
// Source: DashboardDetail.tsx pattern
<Accordion type="single" collapsible>
  {form.watch('pages').map((page, index) => (
    <AccordionItem key={page.name || `page-${index}`} value={page.name || `page-${index}`}>
      <AccordionTrigger className="flex justify-between">
        <span>{page.name || '(Root Page)'}</span>
        {index > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              const pages = form.getValues('pages')
              form.setValue('pages', pages.filter((_, i) => i !== index))
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </AccordionTrigger>
      <AccordionContent>
        <Textarea
          value={page.wikitext}
          onChange={(e) => {
            const pages = [...form.getValues('pages')]
            pages[index] = { ...pages[index], wikitext: e.target.value }
            form.setValue('pages', pages)
          }}
          className="min-h-[200px] font-mono"
          placeholder="Enter wikitext..."
        />
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>

{/* Add page button */}
<Button type="button" variant="outline" onClick={() => {
  const pages = form.getValues('pages')
  form.setValue('pages', [...pages, { name: `page-${pages.length}`, wikitext: '' }])
}}>
  <Plus className="h-4 w-4 mr-2" /> Add Page
</Button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Controlled inputs | react-hook-form | Established | Less boilerplate, better perf |
| PropTypes | Zod schemas | Established | Type-safe validation at runtime |
| fetch + useState | TanStack Query | Established | Caching, draft overlay support |

**Deprecated/outdated:**
- None identified - codebase uses current patterns

## Open Questions

Things that couldn't be fully resolved:

1. **Resource ID validation pattern**
   - What we know: Other entities use genericIdValidation (e.g., Person, Contact_info)
   - What's unclear: Should resources have same pattern or different?
   - Recommendation: Use genericIdValidation for consistency unless backend differs

2. **Page name validation/uniqueness**
   - What we know: Root page has empty string name
   - What's unclear: Should page names be unique? What characters allowed?
   - Recommendation: Allow any string for flexibility; uniqueness enforced by array index

3. **Required dynamic fields validation**
   - What we know: PropertyProvenance has is_required flag
   - What's unclear: How to enforce at form level with dynamic schema?
   - Recommendation: Soft validation (visual indicator) initially; hard validation if backend rejects

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `frontend/src/components/entity/forms/*.tsx`
- Codebase analysis: `frontend/src/components/entity/detail/DashboardDetail.tsx`
- Codebase analysis: `frontend/src/components/entity/detail/ResourceDetail.tsx`
- Codebase analysis: `frontend/src/api/types.ts` (DashboardDetailV2, ResourceDetailV2)
- Codebase analysis: `frontend/src/stores/draftStore.ts` (CreateModalEntityType)
- Codebase analysis: `frontend/src/components/layout/Sidebar.tsx` (entity section pattern)

### Secondary (MEDIUM confidence)
- React Hook Form docs - verified via package.json version
- Zod docs - verified via package.json version

### Tertiary (LOW confidence)
- None - all findings verified with codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified from package.json and existing code
- Architecture: HIGH - patterns extracted from 6+ existing form components
- Pitfalls: HIGH - derived from code analysis and type definitions

**Research date:** 2026-01-28
**Valid until:** 60 days (stable internal patterns)
