# Phase 20: Entity Management - Research

**Researched:** 2026-01-25
**Domain:** React CRUD forms with validation, autocomplete relationships, and soft deletion
**Confidence:** HIGH

## Summary

Entity management involves creating and deleting entities through modal forms with validation, relationship management via autocomplete, and soft deletion with inline undo. The research covered React form libraries (React Hook Form + Zod), modal patterns with Radix UI, autocomplete/combobox implementations, ID validation for slug-style identifiers, required field indicators, and soft deletion UX patterns.

The standard approach for the ontology-hub tech stack (React 19, Zustand 5, TailwindCSS 4, Radix UI, React Hook Form 7, Zod 4) is to use React Hook Form with zodResolver for type-safe validation, Radix Dialog for modals, cmdk-based Combobox for relationship autocomplete with "create if not exists" flow, kebab-case validation for entity IDs, asterisk indicators for required fields, and inline soft delete badges with undo buttons (established in Phase 18).

The Phase 20 context specifies: modal forms for entity creation, validate on blur with disabled save button until valid, block deletion if dependents exist, type-ahead autocomplete for relationships with cascading create, soft delete with inline "Deleted" badge and undo button, and no confirmation dialogs (undo handles mistakes).

**Primary recommendation:** Use React Hook Form with Zod schemas for all entity creation/editing forms, cmdk Combobox for relationship autocomplete, implement cascading create via nested modal stack, and extend Phase 18 soft delete pattern to all entity types.

## Standard Stack

The established libraries/tools for entity CRUD in this project:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React Hook Form | 7.71.1 | Form state management | Already installed, industry standard for complex forms with minimal re-renders |
| Zod | 4.3.5 | Schema validation | Already installed, provides type-safe validation with TypeScript inference |
| @hookform/resolvers | 5.2.2 | RHF + Zod integration | Already installed, connects Zod schemas to React Hook Form |
| Radix UI Dialog | 1.1.15 | Modal primitives | Already in use, provides accessible modal foundation |
| Radix UI Popover | 1.1.15 | Autocomplete dropdown | Already in use, foundation for combobox pattern |
| cmdk | (to install) | Command palette / combobox | Industry standard for autocomplete with keyboard navigation, used by shadcn |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Radix UI Select | 2.2.6 | Simple dropdowns | Already in use, for fixed option lists (datatype, cardinality) |
| TailwindCSS | 4.1.18 | Styling with validation states | Already in use, provides aria-invalid styling utilities |
| Lucide React | 0.562.0 | Icons (Plus, Trash2, Undo2) | Already in use, consistent icon system |
| Zustand | 5.0.10 | Track deleted entities | Already in use for draft state management |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Hook Form | Formik | Formik has larger bundle size, more re-renders, less TypeScript integration |
| cmdk Combobox | Downshift | cmdk provides better keyboard nav and is shadcn standard |
| Zod | Yup | Yup lacks TypeScript-first design, Zod has better type inference |
| Modal dialogs | Inline forms | Modals provide focus management and don't disrupt graph view |

**Installation:**
```bash
npm install cmdk
```

## Architecture Patterns

### Recommended Component Structure
```
src/components/entity/
├── forms/
│   ├── CategoryForm.tsx          # RHF form for category creation/editing
│   ├── PropertyForm.tsx          # RHF form for property creation/editing
│   ├── SubobjectForm.tsx         # RHF form for subobject creation/editing
│   ├── TemplateForm.tsx          # RHF form for template creation/editing
│   ├── ModuleForm.tsx            # RHF form for module creation/editing
│   ├── BundleForm.tsx            # RHF form for bundle creation/editing
│   ├── EntityCombobox.tsx        # Reusable relationship autocomplete
│   └── FormField.tsx             # Reusable field wrapper with label/error
├── modals/
│   ├── CreateEntityModal.tsx     # Generic create modal wrapper
│   └── NestedModalStack.tsx      # Handles cascading create flow
├── DeletedItemBadge.tsx          # From Phase 18 - soft delete indicator
└── detail/
    └── [entity]Detail.tsx        # From Phase 18 - uses inline editing
```

### Pattern 1: React Hook Form with Zod Validation

**What:** Declarative form schemas with type-safe validation and automatic error handling

**When to use:** All entity creation and editing forms

**Example:**
```typescript
// Source: shadcn/ui React Hook Form docs, Wasp blog advanced RHF guide
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Schema with custom validation
const categorySchema = z.object({
  id: z.string()
    .min(1, "ID is required")
    .regex(/^[a-z0-9-]+$/, "ID must be lowercase letters, numbers, and hyphens")
    .refine(async (id) => {
      // Async validation - check if ID exists
      const exists = await checkEntityExists(id)
      return !exists
    }, "This ID already exists"),
  label: z.string().min(1, "Label is required"),
  description: z.string().min(1, "Description is required"),
  parents: z.array(z.string()).optional(),
})

type CategoryFormData = z.infer<typeof categorySchema>

function CategoryForm({ onSubmit }: { onSubmit: (data: CategoryFormData) => void }) {
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    mode: 'onBlur', // Validate on blur per CONTEXT decision
    defaultValues: {
      id: '',
      label: '',
      description: '',
      parents: [],
    },
  })

  // Save button disabled until form is valid
  const isValid = form.formState.isValid

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
      <Button type="submit" disabled={!isValid}>
        Create Category
      </Button>
    </form>
  )
}
```

**Key details:**
- `mode: 'onBlur'` matches CONTEXT decision for validation timing
- `zodResolver` provides TypeScript type inference automatically
- `z.refine()` enables async validation for uniqueness checks
- Form state `isValid` drives save button disabled state

### Pattern 2: Form Field Wrapper with Validation Display

**What:** Reusable field component with label, required indicator, and error display

**When to use:** All form inputs to ensure consistency

**Example:**
```typescript
// Source: shadcn/ui Form docs, accessibility best practices
import { Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  name: string
  label: string
  required?: boolean
  control: Control<any>
  render: (field: any) => React.ReactNode
}

function FormField({ name, label, required, control, render }: FormFieldProps) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div className="space-y-2">
          <Label htmlFor={name}>
            {label}
            {required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
          </Label>
          <div data-invalid={fieldState.invalid}>
            {render(field)}
          </div>
          {fieldState.error && (
            <p className="text-sm text-red-600" role="alert">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  )
}

// Usage
<FormField
  name="id"
  label="ID"
  required
  control={form.control}
  render={(field) => (
    <Input
      {...field}
      placeholder="category-name"
      aria-invalid={!!form.formState.errors.id}
    />
  )}
/>
```

**Key details:**
- Red asterisk with `aria-label="required"` for accessibility
- Error message with `role="alert"` announces to screen readers
- `data-invalid` attribute enables TailwindCSS validation styling
- `aria-invalid` on input for proper ARIA attributes

### Pattern 3: Combobox with "Create if Not Exists"

**What:** Autocomplete relationship selector that opens create modal when user types non-existent ID

**When to use:** All relationship fields (parent categories, properties, subobjects, templates)

**Example:**
```typescript
// Source: shadcn/ui Combobox docs (newer Base UI version), React Spectrum autocomplete
import { useState } from 'react'
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem } from '@/components/ui/combobox'
import { Plus } from 'lucide-react'

interface EntityComboboxProps {
  entityType: 'category' | 'property' | 'subobject' | 'template'
  availableEntities: Array<{ key: string; label: string }>
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  onCreateNew: (id: string) => void
}

function EntityCombobox({
  entityType,
  availableEntities,
  selectedKeys,
  onChange,
  onCreateNew,
}: EntityComboboxProps) {
  const [inputValue, setInputValue] = useState('')

  const filteredEntities = availableEntities.filter(entity =>
    entity.key.toLowerCase().includes(inputValue.toLowerCase()) ||
    entity.label.toLowerCase().includes(inputValue.toLowerCase())
  )

  const exactMatch = availableEntities.find(e => e.key === inputValue)

  return (
    <Combobox>
      <ComboboxInput
        placeholder={`Search ${entityType}...`}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <ComboboxContent>
        <ComboboxList>
          {filteredEntities.map(entity => (
            <ComboboxItem
              key={entity.key}
              value={entity.key}
              onSelect={() => {
                onChange([...selectedKeys, entity.key])
                setInputValue('')
              }}
            >
              {entity.label} <span className="text-muted-foreground">({entity.key})</span>
            </ComboboxItem>
          ))}

          {/* Show "Create" option if typed ID doesn't exist */}
          {inputValue && !exactMatch && (
            <ComboboxItem
              value={inputValue}
              onSelect={() => {
                onCreateNew(inputValue)
                setInputValue('')
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create "{inputValue}"
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
```

**Key details:**
- Filters on both `key` (ID) and `label` for flexibility
- Shows "Create" option only when input doesn't match existing entity
- Calls `onCreateNew` callback to open nested create modal
- Clears input after selection to allow adding more

### Pattern 4: Cascading Create via Modal Stack

**What:** When user creates non-existent entity from relationship field, open nested modal, then return to original

**When to use:** Relationship autocomplete "create if not exists" flow

**Example:**
```typescript
// Source: React modal promise pattern, Phase 20 CONTEXT decisions
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface NestedModalStackProps {
  isOpen: boolean
  onClose: () => void
  primaryEntity: {
    type: 'category' | 'property' | 'subobject' | 'template' | 'module' | 'bundle'
    initialData?: Partial<any>
  }
}

function NestedModalStack({ isOpen, onClose, primaryEntity }: NestedModalStackProps) {
  const [nestedEntity, setNestedEntity] = useState<{
    type: string
    prefilledId: string
  } | null>(null)

  const handleCreateNested = async (data: any) => {
    // Create the nested entity
    await createEntity(nestedEntity!.type, data)

    // Close nested modal and add to primary form
    setNestedEntity(null)
    // Trigger refresh of relationship options
  }

  return (
    <>
      {/* Primary create modal */}
      <Dialog open={isOpen && !nestedEntity} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {primaryEntity.type}</DialogTitle>
          </DialogHeader>
          <EntityForm
            entityType={primaryEntity.type}
            onCreateRelatedEntity={(type, id) => {
              setNestedEntity({ type, prefilledId: id })
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Nested create modal (appears on top) */}
      {nestedEntity && (
        <Dialog open={true} onOpenChange={() => setNestedEntity(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create {nestedEntity.type}</DialogTitle>
            </DialogHeader>
            <EntityForm
              entityType={nestedEntity.type}
              initialData={{ id: nestedEntity.prefilledId }}
              onSubmit={handleCreateNested}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
```

**Key details:**
- Two modals: primary (create Category) and nested (create parent Category)
- Nested modal pre-fills ID from autocomplete input
- After nested creation, return to primary modal with new entity available
- State-driven modal stack, not portal-based (simpler to reason about)

### Pattern 5: Soft Delete with Inline Undo (Phase 18 Pattern)

**What:** Mark entities as deleted with badge, show undo button inline, block if dependents exist

**When to use:** Delete operations in draft mode

**Example:**
```typescript
// Source: Phase 18 RESEARCH.md, react-admin SoftDeleteButton
import { Badge } from '@/components/ui/badge'
import { Undo2, AlertCircle } from 'lucide-react'
import { useDraftStoreV2 } from '@/stores/draftStoreV2'

interface DeletedEntityItemProps {
  entityKey: string
  entityLabel: string
  dependents?: string[]
  onUndo: () => void
}

function DeletedEntityItem({ entityKey, entityLabel, dependents, onUndo }: DeletedEntityItemProps) {
  const [showDependents, setShowDependents] = useState(false)

  // Block deletion if dependents exist
  if (dependents && dependents.length > 0) {
    return (
      <div className="flex items-center gap-2 p-2 border border-red-200 rounded bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-900">{entityLabel}</p>
          <p className="text-xs text-red-700">
            Cannot delete: {dependents.length} dependent {dependents.length === 1 ? 'entity' : 'entities'}
          </p>
          <button
            onClick={() => setShowDependents(!showDependents)}
            className="text-xs text-red-600 underline"
          >
            {showDependents ? 'Hide' : 'Show'} dependents
          </button>
          {showDependents && (
            <ul className="mt-1 text-xs text-red-700 list-disc list-inside">
              {dependents.map(dep => <li key={dep}>{dep}</li>)}
            </ul>
          )}
        </div>
      </div>
    )
  }

  // Soft deleted state with undo
  return (
    <div className="flex items-center gap-2 opacity-50">
      <span className="line-through text-gray-500">{entityLabel}</span>
      <Badge variant="secondary" className="text-xs">Deleted</Badge>
      <button onClick={onUndo} className="ml-auto">
        <Undo2 className="h-4 w-4 text-blue-600 hover:text-blue-800" />
      </button>
    </div>
  )
}
```

**Key details:**
- Check for dependents before allowing delete
- Show inline error with expandable dependent list if blocked
- Use Phase 18 soft delete pattern: line-through, "Deleted" badge, undo button
- Undo button persists inline throughout draft session (not a toast)

### Pattern 6: Required Field Indicators with Accessibility

**What:** Asterisk for required fields with ARIA attributes and form-level legend

**When to use:** All entity creation/editing forms

**Example:**
```typescript
// Source: Deque accessibility blog, NN/g required fields research
function EntityForm() {
  return (
    <form>
      <div className="mb-4 p-3 bg-gray-50 rounded border">
        <p className="text-sm text-gray-700">
          Fields marked with <span className="text-red-600">*</span> are required
        </p>
      </div>

      <FormField
        name="id"
        label="ID"
        required
        control={form.control}
        render={(field) => (
          <Input
            {...field}
            aria-required="true"
            aria-invalid={!!form.formState.errors.id}
            aria-describedby={form.formState.errors.id ? "id-error" : undefined}
          />
        )}
      />
      {form.formState.errors.id && (
        <p id="id-error" className="text-sm text-red-600" role="alert">
          {form.formState.errors.id.message}
        </p>
      )}
    </form>
  )
}
```

**Key details:**
- Form-level legend explains asterisk convention
- Red asterisk with `aria-label="required"` (in FormField component)
- Input has `aria-required="true"` for screen readers
- Error linked with `aria-describedby` for context
- Error message has `role="alert"` for immediate announcement

### Anti-Patterns to Avoid

- **Auto-save without indicator:** Users get confused about when changes persist. Use explicit save/cancel buttons (CONTEXT decision).
- **Validation on every keystroke:** Frustrates users mid-typing. Use `mode: 'onBlur'` as specified in CONTEXT.
- **Generic error messages:** "Invalid input" doesn't help. Be specific: "ID must be lowercase letters, numbers, and hyphens".
- **Disabling fields after error:** Keep fields enabled so users can correct mistakes. Show error message instead.
- **Nested useForm hooks:** React Hook Form doesn't support nested forms. Use a single form with nested field names.
- **Ignoring async validation timing:** Async checks (ID uniqueness) can cause save delay. Show loading state on submit button.
- **Hard delete without undo:** Per CONTEXT, never show confirmation dialog. Use soft delete with inline undo instead.
- **Modal overload:** More than 2 nested modals is confusing. Limit cascading create to one level deep.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state management | Custom useState per field | React Hook Form | Handles touched state, validation, submission, errors, and re-render optimization |
| Schema validation | Manual if/else checks | Zod with z.refine() | Type-safe, async validation, clear error messages, TypeScript inference |
| Autocomplete filtering | Custom filter logic | cmdk library | Handles keyboard navigation, fuzzy matching, empty states, accessibility |
| ID slugification | Custom regex replace | Zod regex validation | Validates but doesn't auto-transform (user controls their ID) |
| Modal focus trap | Manual focus management | Radix Dialog primitives | Handles focus lock, Escape key, click outside, scroll lock, ARIA attributes |
| Array field management | Custom add/remove handlers | useFieldArray from RHF | Manages array state, validation, keys, and avoids index-based bugs |
| Relationship count limit | Custom validation logic | Zod .max() with custom message | Built-in array length validation with clear error messages |

**Key insight:** CRUD forms have decades of UX patterns and accessibility requirements. React Hook Form + Zod + Radix UI provide battle-tested solutions that handle edge cases (async validation, nested errors, focus management, screen readers) that custom code typically misses.

## Common Pitfalls

### Pitfall 1: Validation Runs Too Early

**What goes wrong:** User sees "ID is required" error before they've finished typing or even focused the field

**Why it happens:** Form mode set to `onChange` instead of `onBlur`, or manual validation triggered too eagerly

**How to avoid:** Use `mode: 'onBlur'` as specified in CONTEXT. Follow "reward early, punish late" - clear errors immediately when fixed, but don't show new errors until blur.

**Warning signs:** Users complain about "nagging" error messages, or support requests about "form says invalid before I'm done"

### Pitfall 2: Save Button Disabled State Confusion

**What goes wrong:** User fills all fields but save button stays disabled, no indication why

**Why it happens:** Validation runs async (ID uniqueness check) but no loading state shown, or `isValid` doesn't account for `isValidating`

**How to avoid:** Check both `form.formState.isValid && !form.formState.isValidating`, show spinner on button during async validation

**Warning signs:** Users click disabled save button repeatedly, confusion about "why can't I save?"

### Pitfall 3: ID Field Auto-Slugification

**What goes wrong:** User types "My Category" in label, ID auto-fills with "my-category", user confused when they see different ID

**Why it happens:** Trying to be "helpful" by auto-generating IDs from labels

**How to avoid:** Per CONTEXT, ID is a required field users must fill. Validate format but don't auto-transform. User controls their IDs.

**Warning signs:** Users report "my ID changed" or "where did this ID come from?"

### Pitfall 4: Relationship Count Soft Limit Not Soft

**What goes wrong:** User can't add a 51st parent category, hard blocked at limit

**Why it happens:** Confused "soft limit with warning" with "hard limit"

**How to avoid:** Soft limit shows warning but allows continuation. Example: "This category has 25 parents, which is unusually high. Are you sure this is correct?" with option to proceed.

**Warning signs:** Support requests "why can't I add more?" when legitimate use case exists

### Pitfall 5: Cascading Create Lost Context

**What goes wrong:** User creates nested entity, modal closes, can't remember what they were doing in parent modal

**Why it happens:** No visual connection between nested modal and parent form context

**How to avoid:** Show breadcrumb or context in nested modal: "Creating parent category for: {original category label}". After nested create, highlight newly added relationship in parent form.

**Warning signs:** Users ask "what was I doing?" or abandon nested create workflow

### Pitfall 6: Dependent Entity Block Unclear

**What goes wrong:** User tries to delete category, gets error "Cannot delete", doesn't know why or what to do

**Why it happens:** Error message doesn't show which entities depend on the one being deleted

**How to avoid:** Per CONTEXT, show error listing dependent entities: "Cannot delete: 3 properties use this category (Property1, Property2, Property3)"

**Warning signs:** Support requests "why can't I delete X?" with confusion about dependencies

### Pitfall 7: Undo State Not Persisted

**What goes wrong:** User deletes entity, navigates to different entity, comes back - deleted item shows as permanently deleted

**Why it happens:** Soft delete state stored in component local state instead of Zustand draft store

**How to avoid:** Store deleted entity keys in Zustand draft store, persist throughout session. Undo button always available until draft saved.

**Warning signs:** Users report "I can't undo my delete" or "where did the undo button go?"

### Pitfall 8: Form Doesn't Reset After Submit

**What goes wrong:** User creates entity, modal closes, reopens create modal - previous values still filled in

**Why it happens:** Forgot to call `form.reset()` after successful submission

**How to avoid:** Always reset form after successful submission: `onSuccess: () => { form.reset(); closeModal() }`

**Warning signs:** Users confused by "ghost" values from previous creation, or accidentally create duplicates

### Pitfall 9: Combobox Allows Duplicates

**What goes wrong:** User adds same parent category twice via autocomplete

**Why it happens:** No validation that relationship already exists in selected list

**How to avoid:** Filter `availableEntities` to exclude `selectedKeys`, or show "Already added" message if user tries to select duplicate

**Warning signs:** Backend returns duplicate relationship errors, or users confused seeing same entity listed twice

### Pitfall 10: Required Field Asterisk Only Visual

**What goes wrong:** Screen reader users don't know which fields are required

**Why it happens:** Asterisk is purely decorative CSS, no ARIA attributes

**How to avoid:** Add `aria-required="true"` to input, `aria-label="required"` to asterisk span, and form-level legend explaining asterisk convention

**Warning signs:** Accessibility audit failures, screen reader users submit incomplete forms

## Code Examples

Verified patterns from official sources and project codebase:

### React Hook Form with Zod (Official Docs)

```typescript
// Source: shadcn/ui Forms documentation, @hookform/resolvers
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
})

type FormData = z.infer<typeof schema>

function MyForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
  })

  return (
    <form onSubmit={form.handleSubmit((data) => console.log(data))}>
      <input {...form.register('username')} />
      {form.formState.errors.username && (
        <span>{form.formState.errors.username.message}</span>
      )}
    </form>
  )
}
```

### useFieldArray for Dynamic Relationships (React Hook Form Docs)

```typescript
// Source: React Hook Form useFieldArray documentation
import { useForm, useFieldArray } from 'react-hook-form'

function CategoryForm() {
  const form = useForm({
    defaultValues: {
      id: '',
      label: '',
      parents: [],
    }
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'parents',
  })

  return (
    <form>
      {fields.map((field, index) => (
        <div key={field.id}> {/* CRITICAL: use field.id, not index */}
          <span>{field.value}</span>
          <button type="button" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({ value: 'new-parent' })}
      >
        Add Parent
      </button>
    </form>
  )
}
```

### Zod Async Validation for Uniqueness (Zod Docs)

```typescript
// Source: Zod documentation - refine method
const categorySchema = z.object({
  id: z.string()
    .min(1, "ID is required")
    .regex(/^[a-z0-9-]+$/, "ID must be lowercase, numbers, and hyphens")
    .refine(
      async (id) => {
        const response = await fetch(`/api/entities/check?id=${id}`)
        const { exists } = await response.json()
        return !exists
      },
      { message: "This ID already exists" }
    ),
})

// Zod also supports superRefine for multiple field validation
const formSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Passwords don't match",
      path: ['confirmPassword'],
    })
  }
})
```

### cmdk Combobox Pattern (shadcn/ui Combobox)

```typescript
// Source: shadcn/ui Combobox component (Base UI version)
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox'

function EntitySelector() {
  const [selectedValue, setSelectedValue] = useState('')
  const items = ['item-1', 'item-2', 'item-3']

  return (
    <Combobox value={selectedValue} onValueChange={setSelectedValue}>
      <ComboboxInput placeholder="Search items..." />
      <ComboboxContent>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {items.map(item => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
```

### Radix Dialog Stack for Nested Modals (Radix UI Docs)

```typescript
// Source: Radix UI Dialog documentation
import { Dialog, DialogTrigger, DialogContent } from '@radix-ui/react-dialog'

function NestedDialogs() {
  return (
    <Dialog>
      <DialogTrigger>Open outer dialog</DialogTrigger>
      <DialogContent>
        <Dialog>
          <DialogTrigger>Open nested dialog</DialogTrigger>
          <DialogContent>
            Nested dialog content
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
```

### Soft Delete Pattern (react-admin)

```typescript
// Source: react-admin SoftDeleteButton component
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'

function useSoftDelete(entityKey: string) {
  const [isDeleted, setIsDeleted] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/drafts/${draftId}/entities/${entityKey}`, {
      method: 'DELETE',
    }),
    onSuccess: () => setIsDeleted(true),
  })

  const undoMutation = useMutation({
    mutationFn: () => fetch(`/api/drafts/${draftId}/entities/${entityKey}/undo`, {
      method: 'POST',
    }),
    onSuccess: () => setIsDeleted(false),
  })

  return {
    isDeleted,
    softDelete: deleteMutation.mutate,
    undo: undoMutation.mutate,
  }
}
```

### Relationship Count Soft Limit (Zod)

```typescript
// Source: Zod array validation documentation
const categorySchema = z.object({
  parents: z.array(z.string())
    .max(50, "Categories typically have fewer than 50 parents. Please review.") // Soft limit via message tone
    .optional(),
})

// Alternative: use superRefine for warning instead of error
const categorySchemaWithWarning = z.object({
  parents: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  if (data.parents && data.parents.length > 25) {
    // Don't add issue (error), just log warning
    console.warn(`Category has ${data.parents.length} parents, which is unusually high`)
    // Could store warning in separate state for UI display
  }
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Formik + Yup | React Hook Form + Zod | 2022-2024 | Better TypeScript integration, fewer re-renders, smaller bundle |
| Class-based forms | Hook-based forms | React 16.8+ (2019) | Simpler state management, less boilerplate |
| Downshift autocomplete | cmdk combobox | 2023-2024 | Better keyboard nav, command palette patterns, shadcn standard |
| Confirmation dialogs | Inline undo | 2020-2023 | Less friction, users prefer undo over prevention |
| Auto-save on blur | Explicit save/cancel | 2020-2022 | Clearer user intent, less data loss confusion |
| Generic "Required" text | Red asterisk * | Web convention | Familiar, compact, internationally understood |

**Deprecated/outdated:**
- **Formik**: Still maintained but React Hook Form has better TypeScript support and performance
- **Yup validation**: Works but Zod provides better type inference and error messages
- **react-select for autocomplete**: Heavy bundle, cmdk is lighter and more flexible
- **Uncontrolled forms with refs**: React Hook Form uses controlled patterns, easier to test and validate
- **Alert/confirm dialogs for delete**: Modern UX favors undo over prevention (Gmail pattern)

## Open Questions

Things that couldn't be fully resolved:

1. **Relationship count soft limit threshold**
   - What we know: CONTEXT says "Claude determines threshold", common practice is warnings around 20-50 items
   - What's unclear: Specific threshold for each relationship type (parents, properties, subobjects, etc.)
   - Recommendation: Start with 25 as soft limit (warning but not blocking) for all relationship arrays. Adjust based on user feedback if legitimate use cases emerge.

2. **ID field helper text or placeholder**
   - What we know: ID must be kebab-case (lowercase, numbers, hyphens), user controls format
   - What's unclear: Should placeholder show example like "category-name" or helper text explain rules?
   - Recommendation: Use both - placeholder with example format AND helper text with validation rules for clarity.

3. **Nested modal z-index stacking**
   - What we know: Radix Dialog supports nesting, but Tailwind z-index classes may conflict
   - What's unclear: Whether Radix handles stacking automatically or manual z-index needed
   - Recommendation: Test Radix default stacking first. If issues arise, use CSS custom properties for z-index layering.

4. **Combobox implementation: shadcn Base UI vs custom**
   - What we know: shadcn recently moved Combobox to Base UI (not Radix), uses cmdk under the hood
   - What's unclear: Whether to use shadcn's newer Base UI Combobox or stick with Radix + cmdk pattern
   - Recommendation: Since project uses Radix throughout, build custom Combobox with Radix Popover + cmdk for consistency. Avoid mixing UI primitive libraries.

5. **Form reset after cascading create**
   - What we know: After nested entity creation, return to parent form with new entity available
   - What's unclear: How to trigger relationship autocomplete options refresh without full form reset
   - Recommendation: Use React Query cache invalidation for entity list, or optimistic update to autocomplete options. Don't reset entire parent form.

## Sources

### Primary (HIGH confidence)
- React Hook Form Official Documentation: https://react-hook-form.com/advanced-usage - Form patterns and useFieldArray
- Zod Official Documentation (GitHub): https://github.com/colinhacks/zod - Schema validation and refine method
- shadcn/ui React Hook Form Integration: https://ui.shadcn.com/docs/forms/react-hook-form - RHF + Zod + shadcn pattern
- shadcn/ui Combobox Component: https://ui.shadcn.com/docs/components/combobox - Base UI combobox implementation
- Radix UI Dialog Primitives: https://www.radix-ui.com/primitives/docs/components/dialog - Modal foundation
- Radix UI Popover Primitives: https://www.radix-ui.com/primitives/docs/components/popover - Autocomplete dropdown
- Project Phase 18 RESEARCH.md: Inline editing patterns, soft delete with undo, TailwindCSS group-hover

### Secondary (MEDIUM confidence)
- Wasp Blog "Advanced React Hook Form + Zod" (Jan 2025): https://wasp.sh/blog/2025/01/22/advanced-react-hook-form-zod-shadcn - Complex form patterns
- FreeCodeCamp "React Form Validation with Zod and RHF": https://www.freecodecamp.org/news/react-form-validation-zod-react-hook-form/ - Validation best practices
- Contentful "Zod Validation with React Hook Form": https://www.contentful.com/blog/react-hook-form-validation-zod/ - Type-safe patterns
- shadcn/ui Command Component: https://ui.shadcn.com/docs/components/command - cmdk foundation for combobox
- Material UI Autocomplete Docs: https://mui.com/material-ui/react-autocomplete/ - allowsCustomValue pattern
- react-admin SoftDeleteButton: https://marmelab.com/react-admin/SoftDeleteButton.html - Soft delete pattern reference
- Deque "Anatomy of Accessible Forms - Required Fields": https://www.deque.com/blog/anatomy-of-accessible-forms-required-form-fields/ - Accessibility standards
- Nielsen Norman Group "Marking Required Fields": https://www.nngroup.com/articles/required-fields/ - UX research on required indicators
- Sanity "Best Practice Validation for Slugs": https://www.sanity.io/answers/best-practice-validation-for-different-types-of-fields-slugs-titles-etc - ID/slug validation patterns
- Simple Table Blog "React Data Grids: In-Cell vs Form Editing" (2026): https://www.simple-table.com/blog/editable-react-data-grids-in-cell-vs-form-editing - Form-based CRUD patterns

### Tertiary (LOW confidence - patterns require verification)
- DEV Community "React Hook Form + Zod Guide": https://dev.to/md_marufrahman_3552855e/react-hook-form-zod-complete-guide-to-type-safe-form-validation-in-react-4do6 - Community tutorial
- Jason Watmore "React CRUD with React Hook Form": https://jasonwatmore.com/post/2020/10/09/react-crud-example-with-react-hook-form - Older but foundational pattern
- LogRocket "React Form Validation Roundup": https://blog.logrocket.com/react-form-validation-sollutions-ultimate-roundup/ - Library comparison
- The Best React Modal Libraries 2026 (Croct Blog): https://blog.croct.com/post/best-react-modal-dialog-libraries - Modal library landscape

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React Hook Form, Zod, Radix UI are industry standards with official documentation verified
- Architecture: HIGH - Patterns based on official docs (RHF, Zod, Radix) and established shadcn conventions
- Pitfalls: HIGH - Multiple authoritative sources agree (accessibility standards, UX research, library best practices)
- Combobox implementation: MEDIUM - shadcn recently moved to Base UI, mixing Radix + Base UI may need testing

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - React ecosystem stable, but Radix/shadcn patterns evolving)
