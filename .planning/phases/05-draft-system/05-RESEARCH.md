# Phase 5: Draft System - Research

**Researched:** 2026-01-22
**Domain:** Draft submission API, capability URL access, diff-based review UI, inline editing, module assignment with dependency feedback
**Confidence:** HIGH

## Summary

Phase 5 implements the draft system allowing wiki admins to submit schema proposals via API, access them via secure capability URLs, and review/edit changes before PR creation. The foundation is already in place: draft model with capability URL security, rate limiting, and jsondiffpatch for field-level diffs have been implemented in prior phases.

The main work involves: (1) extending the draft payload format to include wiki metadata and full schema data, (2) building a draft review UI that displays diffs with inline editing capabilities, (3) implementing module assignment with dependency feedback (auto-included categories, missing deps, redundancy warnings), and (4) supporting profile editing as part of draft review.

The existing DiffViewer and ChangeGroup components from Phase 4 provide the foundation for draft review, but need extension for editable fields. Use Zustand for draft editing state management as it handles complex nested state with immutable updates cleanly. The shadcn-multi-select-component pattern enables bulk module assignment.

**Primary recommendation:** Extend existing diff components with edit mode toggle. Use Zustand store for draft editing state. Build module assignment UI with auto-dependency visualization using existing React Flow patterns. Keep draft payload as full schema (not delta) for simplicity and full diff preview on creation.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsondiffpatch | 0.7.3 | JSON diff computation | Already in use for version diffs |
| @tanstack/react-query | 5.90+ | Server state management | Established pattern for API data |
| @xyflow/react | 12.10+ | Graph visualization | Proven for dependency graphs |
| shadcn/ui | latest | UI components | Card, Badge, Collapsible already in use |
| slowapi | 0.1.9+ | Rate limiting | Already configured for drafts |

### New for Phase 5
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.0 | Draft editing state | Handles complex nested state with immutable updates, minimal boilerplate |
| react-hook-form | ^7.54.0 | Inline form editing | Field-level validation, minimal re-renders |
| zod | ^3.24.0 | Schema validation | Shared validation between frontend/backend feasible |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.562+ | Icons | Edit, Save, X, Check, Alert icons |
| @radix-ui/react-collapsible | 1.1+ | Collapsible sections | Already in use for ChangeGroup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | React Context | Context causes re-renders on any state change; Zustand has fine-grained subscriptions |
| react-hook-form | Controlled inputs | Controlled causes re-render on every keystroke; RHF is uncontrolled-first |
| Full payload | Delta-only | Delta requires complex merge logic; full payload enables instant diff preview |
| shadcn-multi-select | Custom select | Custom requires accessibility work; shadcn pattern is proven |

**Installation:**
```bash
# Frontend - new dependencies
npm install zustand react-hook-form @hookform/resolvers zod

# Backend - no new dependencies needed
# slowapi already handles rate limiting
```

## Architecture Patterns

### Recommended Project Structure Additions
```
frontend/src/
├── api/
│   └── drafts.ts              # Draft API hooks (new)
├── components/
│   └── draft/                  # Draft-specific components (new)
│       ├── DraftReviewPage.tsx # Main review page
│       ├── DraftHeader.tsx     # Wiki info, expiration, actions
│       ├── DraftDiffViewer.tsx # Extended DiffViewer with edit mode
│       ├── EditableField.tsx   # Inline editable field component
│       ├── ModuleAssignment.tsx # Module dropdown with bulk actions
│       ├── DependencyFeedback.tsx # Missing deps, redundancy warnings
│       └── ProfileEditor.tsx   # Profile module list editing
├── stores/
│   └── draftStore.ts          # Zustand store for draft editing state (new)
└── pages/
    └── DraftPage.tsx          # Draft review page (new)

backend/app/
├── routers/
│   └── drafts.py              # Extend existing: add diff preview on create
├── services/
│   └── draft_diff.py          # Compute diff vs canonical (new)
└── schemas/
    └── draft.py               # Extend: DraftPayload, ValidationError schemas
```

### Pattern 1: Draft Payload Format (Full Schema)

**What:** Draft payload contains complete schema data, not deltas
**When to use:** POST /drafts for submission
**Why:** Enables immediate diff preview on creation, simpler validation
**Example:**
```typescript
// Source: CONTEXT.md decision: success response returns capability URL plus full diff preview
interface DraftPayload {
  // Required wiki metadata
  wiki_url: string              // "https://wiki.example.org"
  base_version: string          // Git tag or commit SHA

  // Full schema data (not deltas)
  entities: {
    categories: CategoryDefinition[]
    properties: PropertyDefinition[]
    subobjects: SubobjectDefinition[]
  }

  // Optional module/profile changes
  modules?: ModuleDefinition[]
  profiles?: ProfileDefinition[]
}

interface CategoryDefinition {
  entity_id: string
  label: string
  description?: string
  parent_category?: string      // For inheritance
  properties: string[]          // Property IDs
  subobjects: string[]          // Subobject IDs
  schema_definition: Record<string, unknown>
}

// Response includes diff preview (computed server-side)
interface DraftCreateResponse {
  capability_url: string
  expires_at: string
  diff_preview: VersionDiffResponse  // Full diff vs canonical
  validation_errors?: ValidationError[]  // Empty if valid, 400 if fatal
}
```

### Pattern 2: Zustand Draft Store

**What:** Centralized store for draft editing state with optimistic updates
**When to use:** Draft review page with inline editing
**Example:**
```typescript
// stores/draftStore.ts
// Source: Zustand patterns + CONTEXT decisions
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface DraftState {
  // Draft data
  draft: DraftPublic | null
  originalDiff: VersionDiffResponse | null

  // Editing state
  editedEntities: Map<string, Partial<EntityDefinition>>
  moduleAssignments: Map<string, string[]>  // entity_id -> module_ids
  profileEdits: Map<string, string[]>       // profile_id -> module_ids

  // UI state
  editingFields: Set<string>  // "category:Person:label"
  hasUnsavedChanges: boolean

  // Actions
  setDraft: (draft: DraftPublic, diff: VersionDiffResponse) => void
  startEditingField: (fieldKey: string) => void
  stopEditingField: (fieldKey: string) => void
  updateEntityField: (entityId: string, field: string, value: unknown) => void
  assignToModule: (entityId: string, moduleId: string) => void
  removeFromModule: (entityId: string, moduleId: string) => void
  bulkAssignToModule: (entityIds: string[], moduleId: string) => void
  updateProfileModules: (profileId: string, moduleIds: string[]) => void
  discardChanges: () => void

  // Computed
  computeCurrentDiff: () => VersionDiffResponse
}

export const useDraftStore = create<DraftState>()(
  immer((set, get) => ({
    draft: null,
    originalDiff: null,
    editedEntities: new Map(),
    moduleAssignments: new Map(),
    profileEdits: new Map(),
    editingFields: new Set(),
    hasUnsavedChanges: false,

    setDraft: (draft, diff) => set({
      draft,
      originalDiff: diff,
      hasUnsavedChanges: false
    }),

    startEditingField: (fieldKey) => set((state) => {
      state.editingFields.add(fieldKey)
    }),

    stopEditingField: (fieldKey) => set((state) => {
      state.editingFields.delete(fieldKey)
    }),

    updateEntityField: (entityId, field, value) => set((state) => {
      const current = state.editedEntities.get(entityId) || {}
      state.editedEntities.set(entityId, { ...current, [field]: value })
      state.hasUnsavedChanges = true
    }),

    assignToModule: (entityId, moduleId) => set((state) => {
      const current = state.moduleAssignments.get(entityId) || []
      if (!current.includes(moduleId)) {
        state.moduleAssignments.set(entityId, [...current, moduleId])
        state.hasUnsavedChanges = true
      }
    }),

    bulkAssignToModule: (entityIds, moduleId) => set((state) => {
      entityIds.forEach(entityId => {
        const current = state.moduleAssignments.get(entityId) || []
        if (!current.includes(moduleId)) {
          state.moduleAssignments.set(entityId, [...current, moduleId])
        }
      })
      state.hasUnsavedChanges = true
    }),

    discardChanges: () => set((state) => {
      state.editedEntities.clear()
      state.moduleAssignments.clear()
      state.profileEdits.clear()
      state.editingFields.clear()
      state.hasUnsavedChanges = false
    }),

    computeCurrentDiff: () => {
      // Recompute diff based on original + edits
      // Implementation uses jsondiffpatch
      const state = get()
      // ... diff computation
      return state.originalDiff!
    },
  }))
)
```

### Pattern 3: Editable Field Component (Inline Edit)

**What:** Field that toggles between view and edit mode with click-to-edit
**When to use:** Draft review diff view for modified entities
**Example:**
```typescript
// components/draft/EditableField.tsx
// Source: Hybrid pattern from react inline editing research
import { useState, useRef, useEffect } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDraftStore } from '@/stores/draftStore'

interface EditableFieldProps {
  entityId: string
  fieldName: string
  value: unknown
  oldValue?: unknown  // For showing diff
  onChange: (value: unknown) => void
  fieldType?: 'text' | 'textarea' | 'number'
}

export function EditableField({
  entityId,
  fieldName,
  value,
  oldValue,
  onChange,
  fieldType = 'text',
}: EditableFieldProps) {
  const fieldKey = `${entityId}:${fieldName}`
  const { editingFields, startEditingField, stopEditingField } = useDraftStore()
  const isEditing = editingFields.has(fieldKey)
  const [localValue, setLocalValue] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = () => {
    onChange(localValue)
    stopEditingField(fieldKey)
  }

  const handleCancel = () => {
    setLocalValue(value)
    stopEditingField(fieldKey)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && fieldType !== 'textarea') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        {fieldType === 'textarea' ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={String(localValue ?? '')}
            onChange={(e) => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 border rounded text-sm min-h-[60px]"
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={fieldType}
            value={String(localValue ?? '')}
            onChange={(e) => setLocalValue(
              fieldType === 'number' ? Number(e.target.value) : e.target.value
            )}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 border rounded text-sm"
          />
        )}
        <Button size="icon" variant="ghost" onClick={handleSave}>
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleCancel}>
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    )
  }

  const hasChanged = oldValue !== undefined && oldValue !== value

  return (
    <div
      className="group flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1"
      onClick={() => startEditingField(fieldKey)}
    >
      <span className={hasChanged ? 'text-yellow-600 dark:text-yellow-400' : ''}>
        {String(value ?? '(empty)')}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
    </div>
  )
}
```

### Pattern 4: Module Assignment with Auto-Dependencies

**What:** Module dropdown showing explicit vs auto-included categories with visual distinction
**When to use:** Draft review for new categories that need module assignment
**Example:**
```typescript
// components/draft/ModuleAssignment.tsx
// Source: CONTEXT.md decisions + shadcn-multi-select pattern
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, Link2 } from 'lucide-react'
import { useModules } from '@/api/modules'
import { useDraftStore } from '@/stores/draftStore'

interface ModuleAssignmentProps {
  entityId: string
  entityType: 'category' | 'property' | 'subobject'
  parentCategories?: string[]  // For properties/subobjects - which categories use this
}

export function ModuleAssignment({
  entityId,
  entityType,
  parentCategories = [],
}: ModuleAssignmentProps) {
  const { data: modules } = useModules()
  const { moduleAssignments, assignToModule, removeFromModule } = useDraftStore()

  const assignedModules = moduleAssignments.get(entityId) || []

  // Compute auto-included modules (via parent categories for props/subobjects)
  const autoIncludedModules = useMemo(() => {
    if (entityType === 'category') return []
    // Properties/subobjects inherit module membership from categories
    const auto = new Set<string>()
    parentCategories.forEach(catId => {
      const catModules = moduleAssignments.get(catId) || []
      catModules.forEach(m => auto.add(m))
    })
    return Array.from(auto)
  }, [entityType, parentCategories, moduleAssignments])

  // Only categories can be directly assigned
  if (entityType !== 'category') {
    return (
      <div className="flex flex-wrap gap-1">
        {autoIncludedModules.map(moduleId => (
          <Badge
            key={moduleId}
            variant="outline"
            className="text-xs italic text-muted-foreground"
          >
            <Link2 className="h-3 w-3 mr-1" />
            {modules?.find(m => m.module_id === moduleId)?.label || moduleId}
            <span className="ml-1 text-xs">(via category)</span>
          </Badge>
        ))}
        {autoIncludedModules.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            Assign parent category to module first
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {/* Explicitly assigned modules */}
      {assignedModules.map(moduleId => (
        <Badge
          key={moduleId}
          variant="secondary"
          className="cursor-pointer hover:bg-destructive/20"
          onClick={() => removeFromModule(entityId, moduleId)}
        >
          {modules?.find(m => m.module_id === moduleId)?.label || moduleId}
          <span className="ml-1">&times;</span>
        </Badge>
      ))}

      {/* Auto-included modules (different visual) */}
      {autoIncludedModules
        .filter(m => !assignedModules.includes(m))
        .map(moduleId => (
          <Badge
            key={moduleId}
            variant="outline"
            className="text-xs italic text-muted-foreground"
          >
            <Link2 className="h-3 w-3 mr-1" />
            {modules?.find(m => m.module_id === moduleId)?.label || moduleId}
          </Badge>
        ))}

      {/* Add module button */}
      <Popover>
        <PopoverTrigger asChild>
          <Badge variant="outline" className="cursor-pointer hover:bg-accent">
            + Add module
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[200px]">
          <Command>
            <CommandInput placeholder="Search modules..." />
            <CommandList>
              {modules?.filter(m => !assignedModules.includes(m.module_id)).map(module => (
                <CommandItem
                  key={module.module_id}
                  onSelect={() => assignToModule(entityId, module.module_id)}
                >
                  {assignedModules.includes(module.module_id) && (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {module.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
```

### Pattern 5: Dependency Feedback Component

**What:** Shows missing dependencies and redundancy warnings for module assignments
**When to use:** Module assignment area in draft review
**Example:**
```typescript
// components/draft/DependencyFeedback.tsx
// Source: CONTEXT.md decisions - DRFT-08
import { useMemo } from 'react'
import { AlertTriangle, Info, Link2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useModules } from '@/api/modules'
import { useDraftStore } from '@/stores/draftStore'

interface DependencyFeedbackProps {
  entityId: string
  moduleId: string
}

export function DependencyFeedback({ entityId, moduleId }: DependencyFeedbackProps) {
  const { data: modules } = useModules()
  const { moduleAssignments } = useDraftStore()

  const feedback = useMemo(() => {
    const module = modules?.find(m => m.module_id === moduleId)
    if (!module) return { missing: [], redundant: [] }

    const assignedModules = moduleAssignments.get(entityId) || []

    // Check for missing dependencies
    const missing = module.dependencies.filter(
      dep => !assignedModules.includes(dep)
    )

    // Check for redundancy (module A depends on B, both are assigned)
    const redundant: string[] = []
    assignedModules.forEach(assigned => {
      const assignedModule = modules?.find(m => m.module_id === assigned)
      if (assignedModule?.dependencies.some(d => assignedModules.includes(d))) {
        redundant.push(assigned)
      }
    })

    return { missing, redundant }
  }, [modules, moduleId, entityId, moduleAssignments])

  if (feedback.missing.length === 0 && feedback.redundant.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      {feedback.missing.length > 0 && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">Missing Dependencies</AlertTitle>
          <AlertDescription className="text-xs">
            Module requires: {feedback.missing.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {feedback.redundant.length > 0 && (
        <Alert className="py-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-sm text-yellow-700 dark:text-yellow-300">
            Redundant Assignment
          </AlertTitle>
          <AlertDescription className="text-xs text-yellow-600 dark:text-yellow-400">
            {feedback.redundant.join(', ')} already included via dependencies
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
```

### Pattern 6: Draft Review Page Route

**What:** Special route handling for capability URL with fragment token
**When to use:** Accessing draft via capability URL
**Example:**
```typescript
// App.tsx addition - special handling for fragment-based capability URLs
// Source: CONTEXT.md + W3C capability URL pattern
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// Special component to extract token from fragment and redirect
function DraftCapabilityHandler() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Extract token from fragment (e.g., /drafts#abc123)
    const hash = location.hash
    if (hash && hash.startsWith('#')) {
      const token = hash.slice(1)
      // Redirect to draft review page with token as route param
      // (Fragment is not sent to server, but we can use it client-side)
      navigate(`/draft/${token}`, { replace: true })
    }
  }, [location.hash, navigate])

  return <div>Loading draft...</div>
}

// Route configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // ... existing routes
      {
        path: 'drafts',
        element: <DraftCapabilityHandler />,  // Handles fragment redirect
      },
      {
        path: 'draft/:token',
        element: <DraftPage />,  // Actual review page
      },
    ],
  },
])
```

### Anti-Patterns to Avoid

- **Storing token in localStorage:** Capability tokens should stay in URL only. Storing enables session hijacking.
- **Showing different errors for invalid vs expired:** Must return identical 404 for both (already implemented).
- **Computing diff on every render:** Memoize with useMemo, cache in store.
- **Re-rendering entire form on field change:** Use Zustand's fine-grained subscriptions or react-hook-form.
- **Mutating draft state directly:** Always use immutable updates (immer middleware handles this).
- **Separate API calls for each auto-dependency:** Compute dependencies client-side using existing module data.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Draft editing state | React useState per field | Zustand store | Complex nested state with undo/discard |
| Inline edit toggle | Custom state management | react-easy-edit or pattern above | Keyboard support, blur handling, accessibility |
| Multi-select dropdown | Custom select | shadcn-multi-select pattern | Accessibility, keyboard nav, badges |
| Field-level diff | Manual comparison | jsondiffpatch (already in use) | Handles arrays, moves, nested objects |
| Module dependency resolution | Manual graph traversal | Backend computes, frontend displays | Single source of truth, avoids sync issues |
| Token hashing | Custom hash | hashlib.sha256 (already in use) | Cryptographically secure, standard |

**Key insight:** Phase 5 extends existing Phase 4 diff infrastructure with editing capabilities. The main new work is state management (Zustand), edit UI components, and module assignment. Don't rebuild the diff computation or capability URL security - they're already done.

## Common Pitfalls

### Pitfall 1: Fragment Token Lost on Page Navigation

**What goes wrong:** User navigates away then back, token is lost, 404 error.
**Why it happens:** Fragment (#) is not sent to server, stored only in browser URL bar.
**How to avoid:** On first load, extract token from fragment and store in React state. Use token for all subsequent API calls. Consider storing draft ID (not token) in sessionStorage for "back" navigation.
```typescript
// DraftPage.tsx
const { token } = useParams()
const [draftToken] = useState(token)  // Capture on mount
// Use draftToken for all API calls, not token from URL
```
**Warning signs:** "Draft not found" errors after navigation.

### Pitfall 2: Stale Diff After Edits

**What goes wrong:** User edits field but diff display shows old values.
**Why it happens:** Diff was computed on load, not recomputed after edits.
**How to avoid:** Store original diff plus edits separately. Recompute display diff on demand using useMemo with edit state as dependency.
```typescript
const displayDiff = useMemo(() => {
  if (!originalDiff || editedEntities.size === 0) return originalDiff
  // Apply edits to compute current diff
  return computeUpdatedDiff(originalDiff, editedEntities)
}, [originalDiff, editedEntities])
```
**Warning signs:** Edited fields not reflecting in diff view, "discard" not working.

### Pitfall 3: Module Assignment Circular Dependencies

**What goes wrong:** User assigns category to module that creates circular dependency chain.
**Why it happens:** Module A depends on B, B depends on A; both end up required.
**How to avoid:** Detect cycles before allowing assignment. Show warning if assignment would create cycle.
```typescript
function detectCycle(moduleId: string, assignments: Map<string, string[]>): boolean {
  // Tarjan's algorithm or simple DFS cycle detection
}
```
**Warning signs:** Infinite loading in dependency graph, stack overflow errors.

### Pitfall 4: Auto-Include Logic Mismatch

**What goes wrong:** Frontend shows category as auto-included, backend doesn't include it.
**Why it happens:** Auto-include logic duplicated in frontend and backend with subtle differences.
**How to avoid:** Backend is source of truth for what's included. Frontend only displays. Fetch computed inclusions from API.
```python
# Backend computes all inclusions
@router.get("/drafts/{token}/computed-modules")
def get_computed_module_assignments(token: str):
    # Returns both explicit and auto-included entities per module
```
**Warning signs:** Module content differs between preview and final PR.

### Pitfall 5: Large Draft Payload Timeout

**What goes wrong:** Creating draft with many entities times out on POST.
**Why it happens:** Server-side diff computation against canonical takes too long.
**How to avoid:**
1. Set reasonable timeout (30s)
2. For large payloads, return 202 Accepted with polling endpoint
3. Consider background task for diff computation
**Warning signs:** Timeout errors on draft creation, 504 gateway errors.

## Code Examples

Verified patterns from official sources and existing codebase:

### Backend: Extended Draft Creation with Diff Preview

```python
# backend/app/routers/drafts.py
# Source: Existing draft router + CONTEXT.md decisions
from app.services.draft_diff import compute_draft_diff
from app.schemas.draft import DraftPayload, DraftCreateResponse, ValidationError

@router.post("/", response_model=DraftCreateResponse, status_code=201)
@limiter.limit(RATE_LIMITS["draft_create"])
async def create_draft(
    request: Request,
    payload: DraftPayload,
    session: SessionDep,
) -> DraftCreateResponse:
    """Create a new draft with validation and diff preview.

    Validates payload, computes diff against canonical, returns capability URL.
    If validation fails fatally, returns 400 with error list (no draft created).
    """
    # Validate required wiki metadata
    if not payload.wiki_url or not payload.base_version:
        raise HTTPException(
            status_code=400,
            detail=[{"field": "wiki_url", "message": "Wiki metadata required"}]
        )

    # Validate payload against schema
    validation_errors = await validate_draft_payload(payload)
    if any(e.severity == "error" for e in validation_errors):
        raise HTTPException(status_code=400, detail=[e.dict() for e in validation_errors])

    # Compute diff against canonical (current indexed data)
    diff_preview = await compute_draft_diff(payload, session)

    # Generate capability token
    token = generate_capability_token()
    expires_at = datetime.utcnow() + timedelta(days=DEFAULT_EXPIRATION_DAYS)

    # Create draft
    draft = Draft(
        capability_hash=hash_token(token),
        payload=payload.dict(),
        diff_preview=diff_preview.dict(),
        source_wiki=payload.wiki_url,
        base_commit_sha=payload.base_version,
        expires_at=expires_at,
    )

    session.add(draft)
    await session.commit()

    # Build capability URL with fragment
    base_url = str(request.base_url).rstrip("/")
    capability_url = f"{base_url}/drafts#{token}"

    return DraftCreateResponse(
        capability_url=capability_url,
        expires_at=draft.expires_at,
        diff_preview=diff_preview,
        validation_warnings=[e for e in validation_errors if e.severity == "warning"],
    )
```

### Backend: Draft Diff Service

```python
# backend/app/services/draft_diff.py
# Source: Existing version diff pattern
from sqlmodel import select
from app.models.entity import Entity
from app.models.module import Module, Profile

async def compute_draft_diff(
    payload: DraftPayload,
    session: AsyncSession,
) -> VersionDiffResponse:
    """Compute field-level diff between draft payload and canonical data.

    Returns structured diff grouped by entity type and change type.
    """
    # Fetch current canonical entities
    canonical_entities = await fetch_canonical_entities(session)
    canonical_modules = await fetch_canonical_modules(session)
    canonical_profiles = await fetch_canonical_profiles(session)

    # Build lookup maps
    canonical_by_id = {e.entity_id: e for e in canonical_entities}

    # Compute diffs per entity type
    category_changes = compute_entity_changes(
        payload.entities.categories,
        [e for e in canonical_entities if e.entity_type == 'category'],
    )
    property_changes = compute_entity_changes(
        payload.entities.properties,
        [e for e in canonical_entities if e.entity_type == 'property'],
    )
    subobject_changes = compute_entity_changes(
        payload.entities.subobjects,
        [e for e in canonical_entities if e.entity_type == 'subobject'],
    )
    module_changes = compute_module_changes(payload.modules or [], canonical_modules)
    profile_changes = compute_profile_changes(payload.profiles or [], canonical_profiles)

    return VersionDiffResponse(
        old_version="canonical",
        new_version="draft",
        categories=category_changes,
        properties=property_changes,
        subobjects=subobject_changes,
        modules=module_changes,
        profiles=profile_changes,
    )


def compute_entity_changes(
    draft_entities: list[dict],
    canonical_entities: list[Entity],
) -> ChangesByType:
    """Compare draft entities against canonical, return grouped changes."""
    canonical_by_id = {e.entity_id: e for e in canonical_entities}
    draft_by_id = {e['entity_id']: e for e in draft_entities}

    all_ids = set(canonical_by_id.keys()) | set(draft_by_id.keys())

    added = []
    modified = []
    deleted = []

    for entity_id in all_ids:
        canonical = canonical_by_id.get(entity_id)
        draft = draft_by_id.get(entity_id)

        if not canonical and draft:
            # New entity
            added.append(EntityChange(
                key=entity_id,
                entity_type=draft.get('entity_type', 'unknown'),
                entity_id=entity_id,
                new=draft,
            ))
        elif canonical and not draft:
            # Deleted entity
            deleted.append(EntityChange(
                key=entity_id,
                entity_type=canonical.entity_type,
                entity_id=entity_id,
                old=canonical.schema_definition,
            ))
        elif canonical and draft:
            # Check for modifications
            if canonical.schema_definition != draft.get('schema_definition'):
                modified.append(EntityChange(
                    key=entity_id,
                    entity_type=canonical.entity_type,
                    entity_id=entity_id,
                    old=canonical.schema_definition,
                    new=draft.get('schema_definition'),
                ))

    return ChangesByType(added=added, modified=modified, deleted=deleted)
```

### Frontend: Draft API Hooks

```typescript
// frontend/src/api/drafts.ts
// Source: Existing API patterns + TanStack Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './client'
import type { DraftPublic, DraftCreateResponse, VersionDiffResponse } from './types'

interface DraftPayload {
  wiki_url: string
  base_version: string
  entities: {
    categories: unknown[]
    properties: unknown[]
    subobjects: unknown[]
  }
  modules?: unknown[]
  profiles?: unknown[]
}

export function useDraft(token: string | undefined) {
  return useQuery({
    queryKey: ['draft', token],
    queryFn: async () => {
      const response = await apiClient.get<DraftPublic>(`/drafts/${token}`)
      return response.data
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,  // 5 minutes
  })
}

export function useDraftDiff(token: string | undefined) {
  return useQuery({
    queryKey: ['draft', token, 'diff'],
    queryFn: async () => {
      const response = await apiClient.get<VersionDiffResponse>(`/drafts/${token}/diff`)
      return response.data
    },
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: DraftPayload): Promise<DraftCreateResponse> => {
      const response = await apiClient.post('/drafts/', payload)
      return response.data
    },
    onSuccess: () => {
      // Invalidate draft queries if needed
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
    },
  })
}

export function useUpdateDraft(token: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates: Partial<DraftPayload>) => {
      const response = await apiClient.patch(`/drafts/${token}`, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draft', token] })
    },
  })
}
```

### Frontend: Draft Review Page

```typescript
// frontend/src/pages/DraftPage.tsx
// Source: Existing page patterns + CONTEXT.md decisions
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useDraft, useDraftDiff } from '@/api/drafts'
import { useDraftStore } from '@/stores/draftStore'
import { DraftHeader } from '@/components/draft/DraftHeader'
import { DraftDiffViewer } from '@/components/draft/DraftDiffViewer'
import { BulkModuleAssignment } from '@/components/draft/BulkModuleAssignment'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

export function DraftPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { data: draft, isLoading: draftLoading, error } = useDraft(token)
  const { data: diff, isLoading: diffLoading } = useDraftDiff(token)
  const { setDraft, hasUnsavedChanges, discardChanges } = useDraftStore()

  // Initialize store with draft data
  useEffect(() => {
    if (draft && diff) {
      setDraft(draft, diff)
    }
  }, [draft, diff, setDraft])

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto mt-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Draft not found or has expired. Please request a new draft link.
        </AlertDescription>
      </Alert>
    )
  }

  if (draftLoading || diffLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!draft || !diff) {
    return null
  }

  return (
    <div className="space-y-6 p-4">
      <DraftHeader draft={draft} />

      {/* Bulk module assignment for new entities */}
      <BulkModuleAssignment diff={diff} />

      {/* Editable diff viewer */}
      <DraftDiffViewer diff={diff} editable />

      {/* Unsaved changes indicator */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg shadow-lg">
          <p className="text-sm mb-2">You have unsaved changes</p>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 bg-primary text-primary-foreground rounded"
              onClick={() => { /* Save logic */ }}
            >
              Save Changes
            </button>
            <button
              className="px-3 py-1 bg-secondary text-secondary-foreground rounded"
              onClick={discardChanges}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Query param for capability token | Fragment (#) for token | W3C recommendation | Reduces referrer leakage |
| Redux for form state | Zustand with immer | 2024-2025 | Less boilerplate, better perf |
| Controlled inputs everywhere | Uncontrolled-first (RHF) | React Hook Form standard | Fewer re-renders |
| Delta-only payloads | Full schema payloads | Context decision | Simpler validation, instant preview |
| Server-rendered edit forms | Client-side inline editing | Modern SPA pattern | Better UX, no page reload |

**Deprecated/outdated:**
- react-diff-viewer for JSON: Still only for text/code, jsondiffpatch + custom UI is better
- Token in query param: Fragment is more secure per W3C guidance
- Redux for local UI state: Zustand is simpler and more performant

## Open Questions

Things that couldn't be fully resolved:

1. **Draft Update vs Replace Strategy**
   - What we know: User can edit entities inline in draft review
   - What's unclear: Should PATCH update individual fields or replace entire payload?
   - Recommendation: Use PATCH with JSON Merge Patch semantics for field-level updates

2. **Handling Very Large Diffs**
   - What we know: Wikis can have hundreds of entities
   - What's unclear: Performance impact of rendering 500+ changed entities
   - Recommendation: Implement virtual scrolling if performance issues arise; start without

3. **Module Assignment Conflicts**
   - What we know: Multiple drafts could assign same entity to different modules
   - What's unclear: How to handle merge conflicts at PR time
   - Recommendation: This is Phase 7 concern (PR creation); document potential conflicts in PR body

4. **Draft Payload Size Limits**
   - What we know: SemanticSchemas can be large
   - What's unclear: What's the maximum payload size we should accept?
   - Recommendation: Start with 5MB limit, adjust based on real usage

## Sources

### Primary (HIGH confidence)
- Phase 4 codebase: existing diff components, jsondiffpatch integration
- Existing draft model and capability URL implementation
- [W3C Good Practices for Capability URLs](https://www.w3.org/2001/tag/doc/capability-urls/)
- [React Hook Form Advanced Usage](https://react-hook-form.com/advanced-usage)
- [shadcn-multi-select-component](https://github.com/sersavan/shadcn-multi-select-component)

### Secondary (MEDIUM confidence)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [LogRocket - Build Inline Editable UI](https://blog.logrocket.com/build-inline-editable-ui-react/)
- [Simple Table - Editable React Data Grids](https://www.simple-table.com/blog/editable-react-data-grids-in-cell-vs-form-editing)
- [Build with Matija - Multi-Step Forms with Zustand](https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps)

### Tertiary (LOW confidence)
- Web search for React inline editing patterns - community patterns
- Various multi-select component comparisons

## Metadata

**Confidence breakdown:**
- Draft payload format: HIGH - Based on CONTEXT.md decisions and existing patterns
- Capability URL security: HIGH - Already implemented, W3C compliant
- Zustand state management: HIGH - Well-documented, recommended for complex state
- Inline editing patterns: MEDIUM - Multiple approaches, chosen based on research
- Module assignment UI: MEDIUM - Combination of existing patterns and new components
- Dependency feedback: MEDIUM - Logic is straightforward, UI patterns need validation

**Research date:** 2026-01-22
**Valid until:** ~30 days for stable components, ~14 days for UI patterns
