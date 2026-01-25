# Phase 18: Inline Editing UX - Research

**Researched:** 2026-01-25
**Domain:** React inline editing patterns with hover-based controls
**Confidence:** HIGH

## Summary

Inline editing UX involves converting read-only field displays into editable inputs within the same context, using hover states for discoverability and explicit save/cancel controls for user clarity. The research covered React best practices for controlled inputs, keyboard navigation, accessibility, hover state management with TailwindCSS, and Zustand state patterns.

The standard approach for the ontology-hub tech stack (React 19, Zustand 5, TailwindCSS 4, Lucide React) is to use controlled input components with local state, explicit save/cancel buttons, TailwindCSS `group-hover` for icon visibility, and keyboard handlers for Escape/Enter shortcuts. For array fields like parent categories, use dedicated list components with add/remove controls.

**Primary recommendation:** Use controlled inputs with explicit save/cancel buttons, avoid contentEditable, implement "reward early, punish late" validation, and use TailwindCSS group-hover for clean hover-to-reveal icon patterns.

## Standard Stack

The established libraries/tools for inline editing in this project:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component framework | Already in use, provides controlled input patterns |
| Zustand | 5.0.10 | State management | Already in use with immer middleware for draft state |
| TailwindCSS | 4.1.18 | Styling with hover states | Already in use, provides group-hover utilities |
| Lucide React | 0.562.0 | Icon library | Already in use, has pencil/trash/undo icons |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Immer | 11.1.3 | Immutable state updates | Already integrated with Zustand for draft mutations |
| @tanstack/react-query | 5.90.19 | Server state management | Already in use for entity data fetching and mutations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Controlled inputs | contentEditable | contentEditable has React sync issues, XSS risks, and inconsistent behavior - only use for rich text editors |
| Explicit save/cancel | Auto-save on blur | Auto-save creates confusion about when changes persist - explicit controls provide clarity |
| Local component state | Zustand for edit state | Local state is simpler for transient edit values - only use Zustand for global concerns |

**Installation:**
No new packages required - all libraries already installed.

## Architecture Patterns

### Recommended Component Structure
```
src/components/entity/
├── form/
│   ├── InlineEditField.tsx    # Single field editor with hover icons
│   ├── InlineTextField.tsx     # Text input variant
│   ├── EditableList.tsx        # Array field editor (already exists)
│   └── DeletedItemBadge.tsx    # Soft delete visual indicator
├── detail/
│   ├── CategoryDetail.tsx      # Uses inline edit components
│   └── [other entity types]
└── sections/
    └── EntityHeader.tsx         # Common header with label/description
```

### Pattern 1: Hover-Controlled Edit Icons

**What:** Icons appear on hover using TailwindCSS group-hover, clicking triggers edit mode

**When to use:** For all editable fields in detail modals and sidebar views when in draft mode

**Example:**
```typescript
// Based on TailwindCSS group-hover documentation
<div className="group relative rounded p-2 hover:bg-gray-50">
  <span className="block">{value}</span>
  <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
    <button onClick={handleEdit}>
      <Pencil className="h-4 w-4 text-gray-500 hover:text-gray-700" />
    </button>
    <button onClick={handleDelete}>
      <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-600" />
    </button>
  </div>
</div>
```

**Key details:**
- Use `group` class on parent container
- Use `group-hover:flex` or `group-hover:opacity-100` on icon container
- Position icons absolutely for clean layout
- Add subtle background highlight on row hover

### Pattern 2: Inline Edit with Explicit Controls

**What:** Convert field to input on edit click, show save/cancel buttons next to input

**When to use:** Primary pattern for all single-value fields (text, numbers, etc.)

**Example:**
```typescript
// Based on LogRocket and React.dev best practices
function InlineEditField({ value, onSave, onCancel }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(value) // Revert
      setIsEditing(false)
      onCancel?.()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  const handleSave = () => {
    onSave(editValue)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 border rounded px-2 py-1"
        />
        <button onClick={handleSave} className="p-1">
          <Check className="h-4 w-4 text-green-600" />
        </button>
        <button onClick={() => { setEditValue(value); setIsEditing(false); onCancel?.() }} className="p-1">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
    )
  }

  return (
    <div className="group relative">
      <span>{value}</span>
      <button
        onClick={() => setIsEditing(true)}
        className="absolute right-0 top-0 hidden group-hover:block"
      >
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  )
}
```

### Pattern 3: Soft Delete with Undo

**What:** Mark items as deleted with grayed styling and "Deleted" badge, show undo icon

**When to use:** For deletable items where immediate recovery should be easy

**Example:**
```typescript
// Based on "Mark for Deletion" pattern research
function DeletedItem({ item, onUndo }) {
  return (
    <div className="flex items-center gap-2 opacity-50">
      <span className="line-through text-gray-500">{item.label}</span>
      <Badge variant="secondary" className="text-xs">Deleted</Badge>
      <button onClick={onUndo} className="ml-auto">
        <Undo2 className="h-4 w-4 text-blue-600 hover:text-blue-800" />
      </button>
    </div>
  )
}
```

### Pattern 4: Array Field Management

**What:** Inline add/remove controls for array fields like parent categories

**When to use:** For relationship arrays and list-based fields

**Example:**
```typescript
// Based on React Final Form Arrays and project's EditableList.tsx
function EditableParentsList({ parents, availableParents, onChange }) {
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = (parentKey: string) => {
    onChange([...parents, parentKey])
    setIsAdding(false)
  }

  const handleRemove = (index: number) => {
    onChange(parents.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {parents.map((parentKey, index) => (
        <div key={parentKey} className="group flex items-center gap-2">
          <span className="flex-1">{parentKey}</span>
          <button
            onClick={() => handleRemove(index)}
            className="hidden group-hover:block"
          >
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
      ))}
      {isAdding ? (
        <Select onValueChange={handleAdd} />
      ) : (
        <button onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4" /> Add Parent
        </button>
      )}
    </div>
  )
}
```

### Pattern 5: State Management with Zustand

**What:** Use local state for transient edit values, Zustand for tracking which entities were edited

**When to use:** Draft mode needs to track edited entities for validation and highlighting

**Example:**
```typescript
// Based on existing draftStoreV2.ts pattern
// Local component state for edit values
const [editValue, setEditValue] = useState(initialValue)

// Zustand for tracking that entity was edited
const markEntityEdited = useDraftStoreV2(s => s.markEntityEdited)

const handleSave = (newValue: string) => {
  // Save to server
  await saveChange('label', newValue)

  // Mark entity as edited for highlighting
  markEntityEdited(entityKey, allNodes, allEdges)
}
```

### Anti-Patterns to Avoid

- **Using contentEditable:** React and contentEditable don't play nicely together due to virtual DOM sync issues. Use controlled inputs instead.
- **Auto-save on blur without indicator:** Users lose work when they don't realize clicking away discards changes. Use explicit save/cancel.
- **Premature validation:** Don't show errors before users finish typing. Wait for blur or save attempt ("punish late").
- **Disabling save button:** Keep save button enabled even if invalid - show error on click attempt instead.
- **Nested component definitions:** Never define components inside render functions - causes state reset on every parent re-render.
- **Hover states on touch devices:** CSS :hover is unreliable on touch - use JavaScript hover detection or accept degraded mobile experience.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounced inputs | Custom setTimeout logic | useEffect with cleanup | Handles component unmount, dependency tracking, and prevents memory leaks |
| Keyboard shortcuts | Manual addEventListener | onKeyDown handlers with key checks | Integrates with React lifecycle, prevents event listener leaks |
| Focus management | Manual focus() calls | useRef + useEffect with isEditing dep | Ensures focus happens after DOM update, handles edge cases |
| Input sanitization | Manual regex/string manipulation | Library validation (Zod already in use) | Handles XSS, encoding issues, international characters |
| Change detection | Manual object comparison | JSON.stringify or deep equality library | Handles nested objects, arrays, edge cases |

**Key insight:** Inline editing has many subtle edge cases (focus timing, keyboard events, state synchronization, mobile devices). Use React's built-in patterns and existing project patterns rather than rolling custom solutions.

## Common Pitfalls

### Pitfall 1: Lost Changes on Click-Away

**What goes wrong:** User clicks outside edit field without saving, loses work without realizing it

**Why it happens:** Auto-save on blur seems convenient but users don't understand when changes persist

**How to avoid:** Use explicit save/cancel buttons. If implementing click-away, show warning for unsaved changes

**Warning signs:** User reports "my changes disappeared" or confusion about when edits are saved

### Pitfall 2: Validation Timing Frustrates Users

**What goes wrong:** Error appears immediately as user types, before they finish entering valid value

**Why it happens:** Eager onChange validation triggers too early

**How to avoid:** Implement "reward early, punish late" - remove errors immediately on fix, but wait for blur before showing new errors

**Warning signs:** Users complain about "nagging" or "annoying" validation messages

### Pitfall 3: Escape Key Doesn't Cancel

**What goes wrong:** User presses Escape expecting to cancel edit, but nothing happens

**Why it happens:** Forgot to implement keyboard handlers or handlers only on button clicks

**How to avoid:** Always implement onKeyDown handler checking for Escape and Enter keys

**Warning signs:** Users ask "how do I cancel editing?" or repeatedly click cancel button

### Pitfall 4: Focus Jumps or Disappears

**What goes wrong:** When entering edit mode, focus isn't on input, or focus jumps unexpectedly

**Why it happens:** useEffect dependency on isEditing doesn't trigger focus, or refs not set up correctly

**How to avoid:** Use useRef + useEffect pattern with isEditing dependency, call focus() after state updates

**Warning signs:** Users have to click twice to start editing, or cursor appears in wrong location

### Pitfall 5: Edit Mode State Persists Incorrectly

**What goes wrong:** When switching between entities, edit mode stays active or values from previous entity appear

**Why it happens:** React preserves state for components at same position in tree

**How to avoid:** Use `key` prop on detail components based on entityKey to force remount on entity change

**Warning signs:** "Ghost" values from previous entity, edit controls appear when viewing different entity

### Pitfall 6: Hover Icons Don't Show on Mobile

**What goes wrong:** Touch users can't access edit/delete icons that only appear on hover

**Why it happens:** CSS :hover is unreliable on touch devices, sometimes never activates

**How to avoid:** Accept that hover is mouse-only, or detect touch devices and show icons persistently

**Warning signs:** Mobile users report they can't edit fields

### Pitfall 7: Deleted Items Are Confusing

**What goes wrong:** Users don't understand that deleted items can be undone, or can't find undo button

**Why it happens:** Insufficient visual feedback about soft delete state

**How to avoid:** Clear "Deleted" badge, prominent undo icon, keep item in same position (don't move to separate section)

**Warning signs:** Users ask "how do I get it back?" or think deletes are permanent

### Pitfall 8: Inherited Fields Are Editable

**What goes wrong:** User tries to edit inherited value in child entity, sees confusing behavior

**Why it happens:** Didn't check if field is inherited before showing edit icons

**How to avoid:** Don't show edit icons on inherited values - show provenance instead with link to source entity

**Warning signs:** Users confused why edits don't "stick" or why inherited values change when parent changes

## Code Examples

Verified patterns from official sources and project codebase:

### TailwindCSS Group Hover (Official Docs)

```typescript
// Source: https://tailwindcss.com/docs/hover-focus-and-other-states
<a href="#" className="group block rounded-lg p-6">
  <h3 className="font-semibold">New project</h3>
  <p className="group-hover:text-white">Create a new project...</p>
</a>

// Named groups for nested scenarios
<div className="group/outer">
  <div className="group/inner">
    <p className="group-hover/inner:text-blue-500 group-hover/outer:text-red-500">
      Responds to specific parent hover
    </p>
  </div>
</div>
```

### Keyboard Event Handling in React (LogRocket, AG Grid)

```typescript
// Source: LogRocket inline editing article, AG Grid documentation
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Escape') {
    // Discard changes and exit edit mode
    setEditValue(originalValue)
    setIsEditing(false)
  } else if (e.key === 'Enter') {
    e.preventDefault() // Prevent form submission
    handleSave()
  }
}

<input
  value={editValue}
  onChange={(e) => setEditValue(e.target.value)}
  onKeyDown={handleKeyDown}
/>
```

### Lucide React Icons (Official Lucide)

```typescript
// Source: https://lucide.dev
import { Pencil, Trash2, Undo2, Check, X, Plus } from 'lucide-react'

// Edit icon
<Pencil className="h-4 w-4" />

// Delete icon
<Trash2 className="h-4 w-4" />

// Undo icon
<Undo2 className="h-4 w-4" />

// Save/confirm icon
<Check className="h-4 w-4" />

// Cancel/close icon
<X className="h-4 w-4" />

// Add icon (for array fields)
<Plus className="h-4 w-4" />
```

### Zustand with Immer (Project draftStoreV2.ts)

```typescript
// Source: frontend/src/stores/draftStoreV2.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { enableMapSet } from 'immer'

enableMapSet()

export const useDraftStoreV2 = create<DraftStoreV2State>()(
  immer((set) => ({
    directlyEditedEntities: new Set<string>(),

    markEntityEdited: (entityKey, allNodes, allEdges) => {
      set((state) => {
        // Immer allows direct mutation syntax
        state.directlyEditedEntities.add(entityKey)

        // Compute transitive effects
        const allAffected = new Set<string>()
        for (const editedKey of state.directlyEditedEntities) {
          const affected = computeAffectedEntities(editedKey, allNodes, allEdges)
          for (const key of affected) {
            allAffected.add(key)
          }
        }

        state.transitivelyAffectedEntities = allAffected
      })
    },
  }))
)
```

### Auto-Save with Debounce (Project CategoryDetail.tsx pattern)

```typescript
// Source: frontend/src/components/entity/detail/CategoryDetail.tsx
const [editedLabel, setEditedLabel] = useState('')
const [originalValues, setOriginalValues] = useState({ label: '' })

// Auto-save hook (project-specific)
const { saveChange, isSaving } = useAutoSave({
  draftToken: draftId || '',
  entityType: 'category',
  entityKey,
  debounceMs: 500,
})

// Detect changes
useEffect(() => {
  if (editedLabel !== originalValues.label) {
    saveChange('label', editedLabel)
  }
}, [editedLabel, originalValues.label, saveChange])

// Initialize on load
useEffect(() => {
  if (category) {
    setEditedLabel(category.label)
    setOriginalValues({ label: category.label })
  }
}, [category])
```

### Focus Management Pattern (React.dev + LogRocket)

```typescript
// Source: React documentation + LogRocket best practices
function InlineEditField({ value, onSave }) {
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      // Optional: select all text
      inputRef.current.select()
    }
  }, [isEditing])

  return isEditing ? (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      onBlur={(e) => onSave(e.target.value)}
    />
  ) : (
    <span onClick={() => setIsEditing(true)}>{value}</span>
  )
}
```

### Validation Timing Pattern (Smashing Magazine, LogRocket)

```typescript
// Source: Smashing Magazine "Complete Guide to Live Validation UX"
// "Reward early, punish late" pattern

const [value, setValue] = useState('')
const [error, setError] = useState<string | null>(null)
const [touched, setTouched] = useState(false)

const validate = (val: string) => {
  // Validation logic
  if (val.length < 3) return 'Must be at least 3 characters'
  return null
}

const handleChange = (newValue: string) => {
  setValue(newValue)

  // "Reward early" - clear error immediately when fixed
  if (error && !validate(newValue)) {
    setError(null)
  }
}

const handleBlur = () => {
  setTouched(true)

  // "Punish late" - only show error after blur
  if (!error) {
    setError(validate(value))
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-save on blur | Explicit save/cancel buttons | 2020-2022 UX research | Clearer user intent, less data loss confusion |
| contentEditable for inline editing | Controlled input components | React 16+ | Better React integration, predictable state management |
| Global edit mode only | Field-level edit mode with hover | 2023-2024 | Reduced friction, better discoverability |
| CSS :hover only | Detect pointer type or accept mobile limitation | 2024-2025 | Better mobile UX or clear expectations |
| Redux for all state | Zustand for UI state, React Query for server state | 2023-2026 | Less boilerplate, better performance |

**Deprecated/outdated:**
- **react-contenteditable**: Has issues with React 18+, better to use controlled inputs
- **Premature validation (onChange only)**: Current best practice is "reward early, punish late" with blur detection
- **Global inline edit libraries**: Most don't integrate well with modern React patterns - better to build with primitives

## Open Questions

Things that couldn't be fully resolved:

1. **Click-away behavior decision**
   - What we know: User has discretion on whether to discard changes silently or prompt
   - What's unclear: User preference for this project
   - Recommendation: Start with "no auto-save on click-away" (require explicit save) - simpler and less data loss risk

2. **Dependency warning on delete**
   - What we know: User has discretion whether to show warning modal or rely on validation
   - What's unclear: How often deletions will have dependencies
   - Recommendation: Rely on validation initially - add warning modal if user feedback indicates confusion

3. **Icon position preference**
   - What we know: User has discretion on right side vs inline after value
   - What's unclear: Layout constraints of existing detail views
   - Recommendation: Right-aligned absolute positioning (cleaner, doesn't shift layout)

4. **Mobile hover behavior**
   - What we know: CSS :hover is unreliable on touch devices
   - What's unclear: Expected mobile usage patterns
   - Recommendation: Accept mouse-only hover or show icons persistently on touch devices (detect with `@media (hover: none)`)

## Sources

### Primary (HIGH confidence)
- TailwindCSS Official Documentation - Group hover patterns: https://tailwindcss.com/docs/hover-focus-and-other-states
- React Official Documentation - State preservation: https://react.dev/learn/preserving-and-resetting-state
- Lucide Icon Library: https://lucide.dev
- Project source code (draftStoreV2.ts, CategoryDetail.tsx, EntityDetailModal.tsx) - Existing patterns

### Secondary (MEDIUM confidence)
- LogRocket "How to build an inline editable UI in React" (June 2024): https://blog.logrocket.com/build-inline-editable-ui-react/
- Smashing Magazine "A Complete Guide to Live Validation UX" (September 2022): https://www.smashingmagazine.com/2022/09/inline-validation-web-forms-ux/
- AG Grid React Cell Editing Documentation: https://www.ag-grid.com/react-data-grid/cell-editing-start-stop/
- PatternFly Inline Edit Design Guidelines: https://www.patternfly.org/components/inline-edit/design-guidelines/
- DHiWise "Enhancing User Experience with React Inline Edit" (June 2024): https://www.dhiwise.com/post/a-beginners-guide-to-implementing-react-inline-edi
- React Spectrum Blog "Building a Button Part 2: Hover Interactions": https://react-spectrum.adobe.com/blog/building-a-button-part-2.html
- DeveloperWay "React State Management 2025: What You Actually Need": https://www.developerway.com/posts/react-state-management-2025

### Secondary (MEDIUM confidence) - UX Patterns
- UI Patterns "Inplace Editor design pattern": https://ui-patterns.com/patterns/InplaceEditor
- UX Design World "Best Practices for Inline Editing in Table Design": https://uxdworld.com/inline-editing-in-tables-design/
- Andrew Coyle Medium "The Inline Edit Design Pattern": https://coyleandrew.medium.com/the-inline-edit-design-pattern-e6d46c933804
- Flow|State "Basic UI patterns for preventing accidental deletion": https://miksovsky.blogs.com/flowstate/2006/02/some_basic_ui_p.html

### Tertiary (LOW confidence)
- Nucamp "State Management in 2026: Redux, Context API, and Modern Patterns": https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns
- React-Admin ArrayInput documentation: https://marmelab.com/react-admin/ArrayInput.html

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, verified versions from package.json
- Architecture: HIGH - Patterns based on official docs (TailwindCSS, React) and existing project code
- Pitfalls: HIGH - Multiple sources agree on common mistakes (validation timing, focus management, click-away confusion)
- UX patterns: MEDIUM - Based on established design system documentation but not verified with user testing

**Research date:** 2026-01-25
**Valid until:** 2026-02-25 (30 days - relatively stable patterns, but React ecosystem evolves quickly)
