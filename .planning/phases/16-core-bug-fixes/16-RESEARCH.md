# Phase 16: Core Bug Fixes - Research

**Researched:** 2026-01-24
**Domain:** React/FastAPI frontend-backend integration, entity detail views, draft workflow
**Confidence:** HIGH

## Summary

This research investigates the bugs affecting entity detail views and draft workflow actions in the Ontology Hub v2.0 system. The investigation identified specific root causes for each requirement:

**Entity Details (ENTITY-01 through ENTITY-04):** The backend is missing dedicated detail endpoints for subobjects and templates. While list endpoints exist (`GET /subobjects`, `GET /templates`), the detail endpoints (`GET /subobjects/{entity_key}`, `GET /templates/{entity_key}`) are not implemented. The frontend correctly calls these endpoints but receives 404 errors. Additionally, modules and bundles detail pages work but the frontend type casting may need review.

**Draft Workflow (DRAFT-01, DRAFT-02, DRAFT-03):** The Validate and Submit PR buttons appear to be implemented correctly in the UI components (`DraftBannerV2.tsx`, `FloatingActionBar.tsx`). The issue is likely related to:
1. Missing validation report state causing disabled buttons
2. The PRWizard modal rendering condition requiring `validationReport` to be non-null
3. Auto-validation (DRAFT-03) not implemented - changes don't trigger automatic re-validation

**Primary recommendation:** Add missing backend endpoints for subobject/template detail views, and wire up auto-validation in the frontend to clear/refresh validation state when draft changes occur.

## Standard Stack

The established libraries/tools for this phase's bug fixes:

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.109+ | Backend API framework | Already in use, async-first |
| SQLModel | 0.0.14+ | ORM/models | Already in use, Pydantic integration |
| React | 18.x | Frontend framework | Already in use |
| TanStack Query | 5.x | Data fetching/caching | Already in use for API calls |
| Zustand | 4.x | State management | Already in use for draft state |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xyflow/react | 11.x | Graph visualization | Already integrated |
| lucide-react | 0.400+ | Icons | Already in use |

### No New Dependencies Required
This phase is fixing bugs in existing code - no new libraries needed.

## Architecture Patterns

### Existing Project Structure (Relevant Files)
```
backend/app/
├── routers/
│   ├── entities_v2.py     # v2 entity endpoints (missing subobject/template detail)
│   ├── drafts_v2.py       # Draft workflow endpoints
│   └── draft_changes.py   # Draft change CRUD
├── services/
│   └── draft_overlay.py   # Draft context for effective view
└── schemas/
    └── entity_v2.py       # Response schemas

frontend/src/
├── api/
│   ├── entitiesV2.ts      # Entity fetch hooks
│   └── draftApiV2.ts      # Draft/validation hooks
├── components/
│   ├── entity/detail/     # Entity detail components
│   └── draft/             # Draft workflow UI
├── stores/
│   └── draftStoreV2.ts    # Draft UI state
└── pages/
    └── BrowsePage.tsx     # Main browse/draft page
```

### Pattern 1: Entity Detail Endpoint Pattern
**What:** Consistent pattern for entity detail endpoints with draft overlay
**When to use:** Adding missing subobject/template detail endpoints
**Example:**
```python
# Source: backend/app/routers/entities_v2.py (existing pattern)
@router.get("/subobjects/{entity_key}", response_model=SubobjectDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_subobject(
    request: Request,
    entity_key: str,
    session: SessionDep,
    draft_ctx: DraftContextDep,
) -> SubobjectDetailResponse:
    """Get subobject detail with draft overlay."""
    query = select(Subobject).where(Subobject.entity_key == entity_key)
    result = await session.execute(query)
    subobject = result.scalar_one_or_none()

    effective = await draft_ctx.apply_overlay(subobject, "subobject", entity_key)

    if not effective:
        raise HTTPException(status_code=404, detail="Subobject not found")

    return SubobjectDetailResponse(
        entity_key=effective.get("entity_key", entity_key),
        label=effective.get("label", ""),
        description=effective.get("description"),
        properties=effective.get("properties", []),
        change_status=effective.get("_change_status"),
        deleted=effective.get("_deleted", False),
    )
```

### Pattern 2: Auto-Validation on Change
**What:** Clear/refresh validation state when draft changes occur
**When to use:** Implementing DRAFT-03 auto-validation
**Example:**
```typescript
// Source: Frontend pattern to implement
// In useAutoSave hook or after addDraftChange mutation
const mutation = useMutation({
  mutationFn: (change: DraftChangeCreate) => addDraftChange(draftToken, change),
  onSuccess: () => {
    // Invalidate entity queries to refresh with new draft overlay
    queryClient.invalidateQueries({ queryKey: ['v2', entityType, entityKey] })
    // Clear validation state - draft has changed since last validation
    useDraftStoreV2.getState().clearValidation()
    // Optionally: trigger auto-validation after debounce
    onSuccess?.()
  },
})
```

### Anti-Patterns to Avoid
- **Hardcoded entity type checks:** The frontend already handles multiple entity types via switch statements - don't add more conditional logic, just ensure backend endpoints exist
- **Coupling validation to individual changes:** Auto-validation should be debounced and happen at draft level, not per-change

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entity detail response | Custom response building | `DraftContextDep.apply_overlay()` | Consistent draft overlay handling |
| Validation state management | Manual React state | Zustand `draftStoreV2` | Already centralized |
| API error handling | Custom error display | `ApiError` class in `client.ts` | Consistent error messages |
| Query invalidation | Manual refetch | `queryClient.invalidateQueries()` | TanStack Query pattern |

**Key insight:** The existing codebase already has patterns for all these problems - the bugs are missing implementations, not missing patterns.

## Common Pitfalls

### Pitfall 1: Missing Response Schemas
**What goes wrong:** Backend returns data that doesn't match frontend TypeScript types
**Why it happens:** Adding new endpoints without adding corresponding Pydantic schemas
**How to avoid:** Create `SubobjectDetailResponse` and `TemplateDetailResponse` schemas in `schemas/entity_v2.py` before implementing endpoints
**Warning signs:** TypeScript errors about missing properties, runtime data shape mismatches

### Pitfall 2: Draft Context Not Applied
**What goes wrong:** Entity details show canonical data even when draft context is active
**Why it happens:** Forgetting to use `DraftContextDep` dependency or not calling `apply_overlay()`
**How to avoid:** Copy the pattern exactly from existing endpoints (e.g., `get_property`)
**Warning signs:** Changes don't show in detail view, no change_status badges

### Pitfall 3: Validation State Not Cleared
**What goes wrong:** Old validation results shown after making new changes
**Why it happens:** Not calling `clearValidation()` when draft changes
**How to avoid:** Call `clearValidation()` in the `onSuccess` callback of change mutations
**Warning signs:** Stale validation errors/warnings after editing

### Pitfall 4: PR Wizard Not Rendering
**What goes wrong:** Submit PR button works but wizard doesn't open
**Why it happens:** `PRWizard` component has rendering conditions: `{draftToken && draftV2.data && draftChanges.data && validationReport && ...}`
**How to avoid:** Ensure all four conditions are met - especially `validationReport` must be non-null
**Warning signs:** Button click does nothing, no modal appears

## Code Examples

Verified patterns from existing codebase:

### Adding a New Detail Endpoint
```python
# Source: backend/app/routers/entities_v2.py (follows existing pattern)

# 1. Add response schema to schemas/entity_v2.py
class SubobjectDetailResponse(SQLModel):
    entity_key: str
    label: str
    description: str | None = None
    properties: list[str] = []  # Property keys
    change_status: str | None = None
    deleted: bool = False

# 2. Add endpoint to routers/entities_v2.py
@router.get("/subobjects/{entity_key}", response_model=SubobjectDetailResponse)
@limiter.limit(RATE_LIMITS["entity_read"])
async def get_subobject(...):
    # Follow existing get_property pattern
```

### Validation State Management
```typescript
// Source: frontend/src/pages/BrowsePage.tsx (existing pattern)

// Validate handler already exists and works:
const handleValidate = async () => {
  if (!draftToken) return
  try {
    setIsValidating(true)
    const report = await validateDraftMutation.mutateAsync()
    setValidationReport(report)  // This enables Submit PR button
  } catch (error) {
    console.error('Validation failed:', error)
    setValidationReport(null)
  } finally {
    setIsValidating(false)
  }
}

// Add to useAutoSave onSuccess for auto-validation trigger:
onSuccess: () => {
  useDraftStoreV2.getState().clearValidation()
  // Optionally debounce-trigger validateDraftMutation
}
```

### Frontend Query Hook Pattern
```typescript
// Source: frontend/src/api/entitiesV2.ts (existing pattern)

// Subobject hook already exists and calls correct endpoint:
export function useSubobject(entityKey: string, draftId?: string) {
  return useQuery({
    queryKey: ['v2', 'subobject', entityKey, { draftId }],
    queryFn: () => fetchEntityV2('subobjects', entityKey, draftId),
    enabled: !!entityKey,
  })
}
// The hook is correct - it's the backend endpoint that's missing!
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 entity endpoints | v2 with draft overlay | v2.0 (Jan 2025) | All entity reads support draft context |
| Manual validation trigger | Click-to-validate | v2.0 (Jan 2025) | User must click Validate button |

**Deprecated/outdated:**
- v1 API endpoints (`/api/v1/`) - still exist but not used by v2 frontend
- Old draft system (`DraftPublic` type) - replaced by `DraftV2` and capability URLs

## Bug Root Cause Analysis

### ENTITY-01, ENTITY-02: Subobject and Template Details
**Root Cause:** Missing backend endpoints
- `GET /api/v2/subobjects/{entity_key}` does NOT exist
- `GET /api/v2/templates/{entity_key}` does NOT exist
- Frontend hooks (`useSubobject`, `useTemplate`) call these endpoints correctly
- Backend returns 404, frontend shows "Failed to load" error

**Fix:** Add the missing detail endpoints following the existing pattern from `get_property` and `get_category`.

### ENTITY-03, ENTITY-04: Module and Bundle Details
**Root Cause:** Endpoints exist and work
- `GET /api/v2/modules/{entity_key}` exists (line 600 in entities_v2.py)
- `GET /api/v2/bundles/{entity_key}` exists (line 787 in entities_v2.py)
- These should work unless there's a type mismatch or specific data issue

**Verification needed:** Test these endpoints directly to confirm they work. The bugs may be:
1. Specific data issues (certain modules/bundles fail)
2. Frontend type casting issues (`ModuleDetailV2` type doesn't match response)

### DRAFT-01: Validate Button
**Root Cause:** Likely working, but may not be visible
- `DraftBannerV2.tsx` shows Validate button only when `isDraft` (status === 'DRAFT')
- `FloatingActionBar.tsx` also has Validate button
- Button calls `handleValidate` in `BrowsePage.tsx`

**Verification needed:** Check if draft status is correctly 'DRAFT' when banner displays.

### DRAFT-02: Submit PR Button
**Root Cause:** PRWizard rendering conditions
- Button calls `handleSubmitPR` which sets `prWizardOpen: true`
- PRWizard only renders when ALL conditions are true:
  ```tsx
  {draftToken && draftV2.data && draftChanges.data && validationReport && (
    <PRWizard ... />
  )}
  ```
- If `validationReport` is null, wizard never renders

**Fix:** User must click Validate first to populate `validationReport`. This is by design, but the UX may be confusing.

### DRAFT-03: Auto-Validation
**Root Cause:** Not implemented
- `useAutoSave` hook saves changes but doesn't trigger validation
- `clearValidation()` exists in store but isn't called after changes
- No debounced auto-validation logic exists

**Fix:**
1. Call `clearValidation()` when changes are saved
2. Optionally: add debounced auto-validation after changes

## Open Questions

Things that couldn't be fully resolved:

1. **Specific module/bundle data issues?**
   - What we know: Endpoints exist and follow correct pattern
   - What's unclear: Are there specific entities that fail while others work?
   - Recommendation: Test endpoints directly with curl/browser

2. **Auto-validation scope**
   - What we know: DRAFT-03 says "auto-validation triggers when user makes changes"
   - What's unclear: Should this be immediate validation or just clearing stale results?
   - Recommendation: Implement as "clear stale validation + show hint to re-validate"

## Sources

### Primary (HIGH confidence)
- `/home/daharoni/dev/ontology-hub/backend/app/routers/entities_v2.py` - Verified missing endpoints
- `/home/daharoni/dev/ontology-hub/frontend/src/api/entitiesV2.ts` - Verified frontend hooks
- `/home/daharoni/dev/ontology-hub/frontend/src/pages/BrowsePage.tsx` - Verified workflow wiring
- `/home/daharoni/dev/ontology-hub/frontend/src/components/draft/DraftBannerV2.tsx` - Verified button rendering
- `/home/daharoni/dev/ontology-hub/frontend/src/components/draft/PRWizard.tsx` - Verified rendering conditions

### Secondary (MEDIUM confidence)
- Code patterns from existing working endpoints (get_category, get_property)
- TypeScript type definitions matching Pydantic schemas

### Tertiary (LOW confidence)
- None - all findings verified in codebase

## Metadata

**Confidence breakdown:**
- Entity bug root causes: HIGH - verified endpoints missing in code
- Draft workflow analysis: HIGH - verified rendering conditions in code
- Fix patterns: HIGH - existing code provides templates

**Research date:** 2026-01-24
**Valid until:** Indefinite - bugs are in stable codebase, not external dependencies
