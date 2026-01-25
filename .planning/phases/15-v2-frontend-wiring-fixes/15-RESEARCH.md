# Phase 15: V2 Frontend Wiring Fixes - Research

**Researched:** 2026-01-24
**Domain:** React state management, URL routing, frontend integration patterns
**Confidence:** HIGH

## Summary

Phase 15 addresses three frontend integration gaps discovered during the v2.0 milestone audit. These are not architectural problems requiring new patterns—they are straightforward wiring fixes in existing React components. The gaps involve:

1. **Draft ID derivation from async query data** - BrowsePage and other components read `draft_id` from URL params, but the v2 workflow uses `draft_token`. The fix is deriving `draftId` from the fetched draft object (`draftV2.data?.id`) rather than only from URL params.

2. **Component version conflicts** - MainLayoutV2 imports v1 draft components (DraftBanner, useDraft) while BrowsePage uses v2 components. This creates potential duplicate banners and API version conflicts.

3. **OAuth URL path error** - ConfirmSubmit.tsx redirects to `/api/oauth/github/login` but the backend registers the route at `/api/v1/oauth/github/login` (verified in `backend/app/main.py:135`).

All three issues are local to specific files and have clear, minimal fixes. No new libraries, patterns, or architectural decisions are needed.

**Primary recommendation:** Apply surgical fixes to the three identified files. Validate with manual E2E testing of draft editing and PR submission flows.

## Standard Stack

No new libraries required. All fixes use existing dependencies:

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Project foundation |
| React Router | 6.x | URL routing and search params | Already used for navigation |
| React Query (TanStack Query) | ~5.x | Async state management | Already used for all API calls |
| TypeScript | 5.x | Type safety | Project standard |

### No Additional Dependencies Required

This phase requires zero new dependencies. All fixes use patterns and APIs already established in the codebase.

## Architecture Patterns

### Pattern 1: Deriving State from Async Query Data

**What:** Compute local state from React Query data when the query completes, with fallback to URL params for backward compatibility.

**When to use:** When a component needs to use a value that can be derived from async data (like `draft.id` from `useDraftV2`), but also needs to support legacy URL param patterns.

**Example:**
```typescript
// BrowsePage.tsx - Current (broken)
const draftId = searchParams.get('draft_id') || undefined
const draftToken = searchParams.get('draft_token') || undefined
const draftV2 = useDraftV2(draftToken)
// Problem: draftId is undefined when using draft_token workflow

// BrowsePage.tsx - Fixed (derive from query)
const draftToken = searchParams.get('draft_token') || undefined
const draftV2 = useDraftV2(draftToken)
const draftId = draftV2.data?.id || searchParams.get('draft_id') || undefined
// Solution: Derive from fetched draft, fallback to URL param for v1 compatibility
```

**Key insight from React Query best practices:**
- Don't sync query data to local state with useEffect (anti-pattern)
- Derive state directly from query result in component body
- React Query data is the source of truth when it exists
- No `useMemo` needed unless calculation is expensive (simple property access is not)

**Sources:**
- [React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager)
- [Best practice for derived local states updates - TanStack Query Discussion](https://github.com/TanStack/query/discussions/6220)

### Pattern 2: Component Version Consistency

**What:** When a layout wraps multiple child components, all components should use the same API version and data source.

**When to use:** In migration scenarios where v1 and v2 components coexist during transition.

**Anti-pattern to avoid:**
```typescript
// MainLayoutV2.tsx - WRONG (mixes v1 and v2)
import { DraftBanner } from '@/components/draft/DraftBanner'  // v1
import { useDraft } from '@/api/drafts'  // v1
const draftId = searchParams.get('draft_id')  // v1 URL param
const { data: draft } = useDraft(draftId)  // v1 API
// Meanwhile, BrowsePage uses DraftBannerV2 and useDraftV2
```

**Correct pattern:**
```typescript
// Option A: Remove duplicate banner (BrowsePage already handles it)
// MainLayoutV2 should NOT render any draft banner - let child page handle it

// Option B: If layout must show banner, use v2 components consistently
import { DraftBannerV2 } from '@/components/draft/DraftBannerV2'
import { useDraftV2 } from '@/api/draftApiV2'
const draftToken = searchParams.get('draft_token') || undefined
const draftV2 = useDraftV2(draftToken)
```

**Recommendation:** Option A (remove from layout) is cleaner because:
- BrowsePage already renders DraftBannerV2
- Not all child routes need draft banners
- Avoids duplicate rendering
- Follows single responsibility principle

### Pattern 3: API URL Path Construction

**What:** When redirecting to backend API endpoints, use full path including version prefix.

**When to use:** All API endpoint references, especially OAuth redirects.

**Example:**
```typescript
// ConfirmSubmit.tsx - Current (broken)
window.location.href = `/api/oauth/github/login?${params}`
// Returns 404 - route doesn't exist

// ConfirmSubmit.tsx - Fixed
window.location.href = `/api/v1/oauth/github/login?${params}`
// Works - matches backend registration at main.py:135
```

**Why it matters:**
- Backend registers OAuth router with prefix: `app.include_router(oauth_router, prefix="/api/v1")`
- Router itself defines: `router = APIRouter(prefix="/oauth", ...)`
- Combined path: `/api/v1/oauth/github/login`
- Missing `/v1` segment causes 404

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Derived state from async data | useEffect sync pattern | Direct derivation in component body | React Query is already the source of truth; useEffect sync is anti-pattern |
| Conditional component rendering | Complex state machines | Simple conditional: `{draftV2.data && <Component />}` | React handles conditional rendering natively |
| URL parameter reading | Custom query parser | `useSearchParams()` from React Router | Standard hook with built-in updates |

**Key insight:** These fixes don't require abstraction or new utilities. React and React Query patterns handle all scenarios.

## Common Pitfalls

### Pitfall 1: Syncing Query Data to Local State

**What goes wrong:** Using useEffect to copy React Query data into useState creates stale state and unnecessary re-renders.

**Why it happens:** Developers think they need local state to derive values, but React allows direct derivation in render.

**How to avoid:**
```typescript
// WRONG - useEffect anti-pattern
const [draftId, setDraftId] = useState<string | undefined>()
useEffect(() => {
  if (draftV2.data?.id) {
    setDraftId(draftV2.data.id)
  }
}, [draftV2.data])

// RIGHT - direct derivation
const draftId = draftV2.data?.id || searchParams.get('draft_id') || undefined
```

**Warning signs:**
- useEffect with query data in dependencies
- setState inside useEffect triggered by query changes
- "State not updating" bugs when query data changes

### Pitfall 2: Duplicate Component Rendering

**What goes wrong:** Two components in the hierarchy both render the same UI element (like DraftBanner), causing duplicate banners or conflicting state.

**Why it happens:** During migrations, both parent layout and child page try to handle the same responsibility.

**How to avoid:**
- Single responsibility: only ONE component should render a given UI element
- If unsure, push UI rendering DOWN to child components (not up to layouts)
- Layouts should provide structure, children provide content

**Warning signs:**
- Two banners appearing on screen
- Flickering or state conflicts
- Different components reading from different API versions (v1 vs v2)

### Pitfall 3: Missing API Version Prefix

**What goes wrong:** Hardcoded API paths missing version prefix (e.g., `/api/oauth/...` instead of `/api/v1/oauth/...`) return 404.

**Why it happens:** FastAPI router prefixes are additive (`app.include_router` prefix + `APIRouter` prefix), easy to forget full path.

**How to avoid:**
- Always check backend route registration in main.py
- Test redirect URLs in browser network tab before committing
- Use constants for API base paths if many references exist

**Warning signs:**
- 404 errors on POST/GET to API
- OAuth redirect fails
- "Route not found" in backend logs

### Pitfall 4: Optional Chaining Without Fallback

**What goes wrong:** Using `data?.id` without a fallback when `data` is undefined leaves variables as `undefined`, breaking downstream code.

**Why it happens:** Developers forget that React Query data is undefined until the query completes.

**How to avoid:**
```typescript
// WRONG - draftId will be undefined initially
const draftId = draftV2.data?.id

// RIGHT - provide fallback for backward compatibility
const draftId = draftV2.data?.id || searchParams.get('draft_id') || undefined
```

**Warning signs:**
- "Cannot read property of undefined" errors
- Components receiving undefined props unexpectedly
- Features work after refresh but not on initial load

## Code Examples

Verified patterns from existing codebase and official documentation:

### Deriving Draft ID from Token Query

**File:** `frontend/src/pages/BrowsePage.tsx` (fixed version)
```typescript
// Source: Existing pattern + React Query best practices
const draftToken = searchParams.get('draft_token') || undefined
const draftV2 = useDraftV2(draftToken)

// Derive draftId from fetched draft, fallback to URL for v1 compatibility
const draftId = draftV2.data?.id || searchParams.get('draft_id') || undefined

// Now all entity queries receive correct draft context
const categoryQuery = useCategory(
  selectedEntityType === 'category' ? entityKey : '',
  draftId  // ✓ Will have value when using draft_token
)
```

**Same fix applies to:**
- `frontend/src/components/layout/SidebarV2.tsx:112`
- `frontend/src/components/layout/MainLayoutV2.tsx:19`

### Removing Duplicate Draft Banner from Layout

**File:** `frontend/src/components/layout/MainLayoutV2.tsx` (fixed version)
```typescript
// Source: Component composition best practices
import { Outlet, Link } from 'react-router-dom'
import { SidebarV2 } from './SidebarV2'
import { DraftSelector } from '@/components/draft/DraftSelector'
// REMOVED: import { DraftBanner } from '@/components/draft/DraftBanner'
// REMOVED: import { useDraft } from '@/api/drafts'

export function MainLayoutV2() {
  // REMOVED: draft ID fetching - child components handle their own draft state

  return (
    <div className="flex min-h-screen">
      <SidebarV2 />

      <div className="flex-1 flex flex-col">
        <header className="border-b px-6 py-4 flex items-center justify-between bg-background">
          <Link to="/browse" className="font-semibold text-lg hover:opacity-80">
            Browse
          </Link>
          <DraftSelector />
        </header>

        {/* REMOVED: Draft banner - BrowsePage renders DraftBannerV2 */}

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

**Rationale:** BrowsePage already renders `DraftBannerV2` conditionally when `draftV2.data` exists. The layout should not duplicate this.

### Fixing OAuth Redirect URL

**File:** `frontend/src/components/draft/PRWizardSteps/ConfirmSubmit.tsx` (fixed version)
```typescript
// Source: Backend route registration at backend/app/main.py:135
const handleSubmit = () => {
  const params = new URLSearchParams({
    draft_token: draftToken,
    pr_title: prTitle,
    user_comment: userComment,
  })

  // FIX: Add /v1 prefix to match backend route registration
  window.location.href = `/api/v1/oauth/github/login?${params.toString()}`
  //                           ^^^ Added this
}
```

**Backend verification:**
```python
# backend/app/main.py:135
app.include_router(oauth_router, prefix="/api/v1")

# backend/app/routers/oauth.py:58
router = APIRouter(prefix="/oauth", tags=["oauth"])

# Combined path: /api/v1/oauth/github/login
```

### URL Parameter Handling Pattern

**Source:** React Router v6 documentation
```typescript
import { useSearchParams } from 'react-router-dom'

function MyComponent() {
  const [searchParams] = useSearchParams()

  // Read multiple parameters
  const draftToken = searchParams.get('draft_token') || undefined
  const draftId = searchParams.get('draft_id') || undefined
  const entityKey = searchParams.get('entity')

  // The || undefined pattern ensures type consistency
  // searchParams.get() returns string | null
  // || undefined converts null to undefined for optional params
}
```

**Source:** [React Router useSearchParams documentation](https://reactrouter.com/api/hooks/useSearchParams)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync query data with useEffect | Direct derivation in component body | React Query v3+ (2021) | Eliminates stale state bugs and unnecessary re-renders |
| Manual state management for async data | React Query as source of truth | React Query adoption | Server state stays in React Query, no sync needed |
| Hardcoded API paths | Version-prefixed paths | FastAPI v0.100+ router composition | Clearer versioning, avoids 404s |
| Layout components handling all UI | Child components own their content | Component composition patterns | Single responsibility, easier to maintain |

**Deprecated/outdated:**
- useEffect for syncing React Query data to useState (anti-pattern since React Query v3)
- Rendering global UI elements (like banners) in layout components when child pages have conditional rendering logic

## Open Questions

None. All three gaps have clear solutions:

1. **Draft ID derivation:** Derive from `draftV2.data?.id` with URL fallback
2. **Component conflicts:** Remove DraftBanner from MainLayoutV2 (already in BrowsePage)
3. **OAuth URL:** Add `/v1` prefix to match backend route

## Sources

### Primary (HIGH confidence)
- Backend route registration: `backend/app/main.py:135` - OAuth router registered at `/api/v1`
- Backend OAuth router: `backend/app/routers/oauth.py:58` - Router prefix is `/oauth`
- Frontend components: BrowsePage.tsx, MainLayoutV2.tsx, ConfirmSubmit.tsx - All files read and verified
- Phase 14 verification: `.planning/phases/14-validation-workflow-pr/14-VERIFICATION.md` - Documents current wiring
- Milestone audit: `.planning/v2.0-MILESTONE-AUDIT.md` - Source of all three gaps

### Secondary (MEDIUM confidence)
- [React Query as a State Manager - TkDodo's blog](https://tkdodo.eu/blog/react-query-as-a-state-manager) - Avoid syncing server state to local state
- [Best practice for derived local states updates - TanStack Query Discussion](https://github.com/TanStack/query/discussions/6220) - Direct derivation pattern
- [React Router useSearchParams API](https://reactrouter.com/api/hooks/useSearchParams) - URL parameter handling
- [Component Composition is great btw - TkDodo's blog](https://tkdodo.eu/blog/component-composition-is-great-btw) - Single responsibility in component hierarchy

### Tertiary (LOW confidence)
- None required - all findings verified with codebase inspection

## Metadata

**Confidence breakdown:**
- Draft ID derivation: HIGH - Pattern exists in codebase (DraftSelector uses same pattern), React Query best practices confirm approach
- Component conflicts: HIGH - Direct inspection shows duplicate banner rendering, removal is straightforward
- OAuth URL fix: HIGH - Backend route registration verified in main.py:135, path construction is deterministic

**Research date:** 2026-01-24
**Valid until:** 90 days (stable patterns - React, React Router, React Query APIs unlikely to change)

**Risk assessment:**
- Complexity: LOW - All fixes are 1-3 line changes
- Scope: MINIMAL - Only 3 files affected, no new dependencies
- Testing: MANUAL - E2E flows (draft editing, PR submission) must be tested manually
- Backward compatibility: SAFE - Draft ID fallback preserves v1 URL param support
