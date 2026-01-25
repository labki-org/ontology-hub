---
phase: 15-v2-frontend-wiring-fixes
verified: 2026-01-24T23:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 15: V2 Frontend Wiring Fixes Verification Report

**Phase Goal:** Fix 3 integration gaps from milestone audit: draft overlay propagation, v1/v2 component conflicts, and OAuth redirect URL

**Verified:** 2026-01-24T23:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Entity queries and graph queries receive correct draft_id when only draft_token is in URL | ✓ VERIFIED | BrowsePage.tsx:61 derives draftId from `draftV2.data?.id?.toString()`, passed to all entity hooks (lines 68-73) and GraphCanvas (line 174) |
| 2 | Sidebar entity lists show change badges when only draft_token is in URL | ✓ VERIFIED | SidebarV2.tsx:117 derives draftId from `draftV2.data?.id?.toString()`, passed to all entity list hooks (lines 123-151), change badges render (lines 72-95) |
| 3 | No duplicate or conflicting v1 draft banner appears in v2 flow | ✓ VERIFIED | MainLayoutV2.tsx contains zero imports of DraftBanner or useDraft, only renders DraftSelector and Outlet |
| 4 | OAuth redirect during PR submission hits /api/v1/oauth/github/login (not 404) | ✓ VERIFIED | ConfirmSubmit.tsx:28 redirects to `/api/v1/oauth/github/login`, matches backend registration (main.py:135 + oauth.py:59) |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/pages/BrowsePage.tsx` | Draft ID derivation from draftV2.data?.id | ✓ VERIFIED | Line 61: `const draftId = draftV2.data?.id?.toString() \|\| searchParams.get('draft_id') \|\| undefined` |
| `frontend/src/components/layout/SidebarV2.tsx` | Draft ID derivation from draftV2.data?.id | ✓ VERIFIED | Lines 113-117: imports useDraftV2, derives draftId from fetched draft |
| `frontend/src/components/layout/MainLayoutV2.tsx` | Clean v2-only layout without v1 draft components | ✓ VERIFIED | No DraftBanner/useDraft imports or usage, only SidebarV2, DraftSelector, and Outlet |
| `frontend/src/components/draft/PRWizardSteps/ConfirmSubmit.tsx` | Correct OAuth redirect URL | ✓ VERIFIED | Line 28: `window.location.href = \`/api/v1/oauth/github/login?${params.toString()}\`` |

**All 4 artifacts verified at all 3 levels:**

### Level 1: Existence
- BrowsePage.tsx: EXISTS (235 lines)
- SidebarV2.tsx: EXISTS (253 lines)
- MainLayoutV2.tsx: EXISTS (35 lines)
- ConfirmSubmit.tsx: EXISTS (69 lines)

### Level 2: Substantive
- BrowsePage.tsx: SUBSTANTIVE (235 lines, no stub patterns, has export)
- SidebarV2.tsx: SUBSTANTIVE (253 lines, no stub patterns, has export)
- MainLayoutV2.tsx: SUBSTANTIVE (35 lines, no stub patterns, has export)
- ConfirmSubmit.tsx: SUBSTANTIVE (69 lines, no stub patterns, has export)

### Level 3: Wired
- BrowsePage.tsx: WIRED (imported by App.tsx, used in route config)
- SidebarV2.tsx: WIRED (imported by MainLayoutV2.tsx)
- MainLayoutV2.tsx: WIRED (imported by App.tsx, used in route config)
- ConfirmSubmit.tsx: WIRED (imported by PRWizard.tsx, rendered in wizard step)

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| BrowsePage.tsx | useCategory/useProperty/etc hooks | draftId derived from draftV2.data?.id | ✓ WIRED | Line 61 derives draftId, lines 68-73 pass to all entity hooks |
| BrowsePage.tsx | GraphCanvas | draftId prop | ✓ WIRED | Line 174: `<GraphCanvas draftId={draftId} ...>` |
| BrowsePage.tsx | EntityDetailPanel | draftId prop | ✓ WIRED | Line 201: `<EntityDetailPanel draftId={draftId} ...>` |
| BrowsePage.tsx | EntityDetailModal | draftId prop | ✓ WIRED | Line 209: `<EntityDetailModal draftId={draftId} />` |
| SidebarV2.tsx | useCategories/useProperties/etc hooks | draftId derived from draftV2.data?.id | ✓ WIRED | Line 117 derives draftId, lines 123-151 pass to all entity list hooks |
| SidebarV2.tsx | EntitySection rendering | change_status badges | ✓ WIRED | Lines 72-95 render badges based on entity.change_status |
| ConfirmSubmit.tsx | backend OAuth endpoint | window.location.href | ✓ WIRED | Line 28 redirects to `/api/v1/oauth/github/login`, confirmed backend route exists |

**All 7 key links verified as WIRED**

### Requirements Coverage

Phase 15 is gap closure, fixing implementation of:
- **FE-03**: Entity lists show change badges in draft mode — NOW WORKS (SidebarV2 gets correct draftId)
- **FE-06**: Same UI components serve both browse and draft modes — NOW WORKS (no duplicate banners)
- **GV-04**: Module hull overlays using d3-polygon — UNBLOCKED (graph gets correct draftId)
- **PR-01**: GitHub OAuth flow at PR submission time — NOW WORKS (correct URL)

**All 4 affected requirements now fully satisfied**

### Anti-Patterns Found

None. Scan of all 4 modified files found:
- Zero TODO/FIXME comments
- Zero placeholder patterns
- Zero stub implementations (return null, console.log only, etc.)
- Zero empty handlers

**Anti-pattern score: 0 blockers, 0 warnings**

### TypeScript Compilation

```
$ cd frontend && npx tsc --noEmit
(no output — clean compilation)
```

**TypeScript passes with zero errors**

### Backend Integration Verification

Verified OAuth route registration:
- Backend main.py line 135: `app.include_router(oauth_router, prefix="/api/v1")`
- OAuth router line 59: `router = APIRouter(prefix="/oauth", tags=["oauth"])`
- Combined path: `/api/v1/oauth/github/login`
- Frontend ConfirmSubmit.tsx line 28: Matches exactly

**Backend/frontend OAuth wiring: VERIFIED**

### Milestone Audit Gap Closure

All 3 gaps from v2.0-MILESTONE-AUDIT.md are closed:

| Gap | Status | Evidence |
|-----|--------|----------|
| Gap 1: BrowsePage draft_id not derived from draft_token | ✓ CLOSED | BrowsePage.tsx:61 now derives from draftV2.data?.id |
| Gap 2: MainLayoutV2 uses v1 draft components | ✓ CLOSED | MainLayoutV2.tsx no longer imports DraftBanner or useDraft |
| Gap 3: OAuth redirect URL missing v1 prefix | ✓ CLOSED | ConfirmSubmit.tsx:28 now uses `/api/v1/oauth/github/login` |

**All 3 milestone gaps closed**

### E2E Flow Status

| Flow | Pre-Phase Status | Post-Phase Status | Change |
|------|------------------|-------------------|--------|
| Anonymous Browsing | COMPLETE | COMPLETE | No change |
| Draft Editing | BROKEN | COMPLETE | ✓ FIXED — draftId now derived correctly |
| Validation | COMPLETE | COMPLETE | No change |
| PR Submission | BROKEN | COMPLETE | ✓ FIXED — OAuth URL corrected |
| Webhook Ingest | COMPLETE | COMPLETE | No change |
| MediaWiki Import | COMPLETE | COMPLETE | No change |

**All 6 E2E flows now COMPLETE**

## Detailed Verification Evidence

### Truth 1: Entity queries receive correct draft_id

**File:** `frontend/src/pages/BrowsePage.tsx`

**Line 52-61 (draft_id derivation):**
```typescript
const draftToken = searchParams.get('draft_token') || undefined
const entityFromUrl = searchParams.get('entity')

// V2 draft data and validation
const draftV2 = useDraftV2(draftToken)
const draftChanges = useDraftChanges(draftToken)
const validateDraftMutation = useValidateDraft(draftToken)

// Derive draftId from fetched draft (v2 workflow) or fall back to URL param (v1 workflow)
const draftId = draftV2.data?.id?.toString() || searchParams.get('draft_id') || undefined
```

**Lines 68-73 (entity hooks receive draftId):**
```typescript
const categoryQuery = useCategory(selectedEntityType === 'category' ? entityKey : '', draftId)
const propertyQuery = useProperty(selectedEntityType === 'property' ? entityKey : '', draftId)
const subobjectQuery = useSubobject(selectedEntityType === 'subobject' ? entityKey : '', draftId)
const moduleQuery = useModule(selectedEntityType === 'module' ? entityKey : '', draftId)
const bundleQuery = useBundle(selectedEntityType === 'bundle' ? entityKey : '', draftId)
const templateQuery = useTemplate(selectedEntityType === 'template' ? entityKey : '', draftId)
```

**Line 174 (GraphCanvas receives draftId):**
```typescript
<GraphCanvas
  entityKey={selectedEntityKey ?? undefined}
  draftId={draftId}
  detailPanelOpen={isDetailOpen}
/>
```

**Verification:** When URL is `/browse?draft_token=abc123`:
1. useDraftV2 fetches draft → draftV2.data contains { id: 5, ... }
2. Line 61 derives draftId = "5" (toString converts number to string)
3. All entity hooks receive draftId="5" → backend returns draft overlay
4. GraphCanvas receives draftId="5" → graph nodes show change status badges

**Result:** ✓ VERIFIED

### Truth 2: Sidebar change badges render

**File:** `frontend/src/components/layout/SidebarV2.tsx`

**Lines 112-117 (draft_id derivation):**
```typescript
const [searchParams] = useSearchParams()
const draftToken = searchParams.get('draft_token') || undefined
const draftV2 = useDraftV2(draftToken)

// Derive draftId from fetched draft (v2 workflow) or fall back to URL param (v1 workflow)
const draftId = draftV2.data?.id?.toString() || searchParams.get('draft_id') || undefined
```

**Lines 123-151 (entity list hooks receive draftId):**
```typescript
const { data: categoriesData, isLoading: categoriesLoading } = useCategories(
  undefined,
  undefined,
  draftId
)
const { data: propertiesData, isLoading: propertiesLoading } = useProperties(
  undefined,
  undefined,
  draftId
)
// ... same pattern for subobjects, modules, bundles, templates
```

**Lines 72-95 (change badges render):**
```typescript
{entity.change_status && entity.change_status !== 'unchanged' && (
  <Badge
    variant={
      entity.change_status === 'added'
        ? 'default'
        : entity.change_status === 'modified'
        ? 'secondary'
        : 'destructive'
    }
    className={`ml-auto ${
      entity.change_status === 'added'
        ? 'bg-green-500 hover:bg-green-600'
        : entity.change_status === 'modified'
        ? 'bg-yellow-500 hover:bg-yellow-600'
        : ''
    }`}
  >
    {entity.change_status === 'added'
      ? '+'
      : entity.change_status === 'modified'
      ? '~'
      : '-'}
  </Badge>
)}
```

**Verification:** When URL is `/browse?draft_token=abc123`:
1. Line 113 extracts draft_token
2. Line 114 calls useDraftV2(draftToken) → fetches draft
3. Line 117 derives draftId from draft.id
4. Lines 123+ pass draftId to all entity list hooks
5. Backend returns entities with change_status field populated
6. Lines 72-95 render badges when change_status exists

**Result:** ✓ VERIFIED

### Truth 3: No duplicate v1 draft banner

**File:** `frontend/src/components/layout/MainLayoutV2.tsx`

**Entire file (35 lines):**
```typescript
import { Outlet, Link } from 'react-router-dom'
import { SidebarV2 } from './SidebarV2'
import { DraftSelector } from '@/components/draft/DraftSelector'

/**
 * Main layout wrapper for v2 pages with updated component structure.
 *
 * Layout:
 * - SidebarV2 on left
 * - Content area on right with:
 *   - Header with DraftSelector
 *   - Outlet for page content (pages handle their own draft UI)
 */
export function MainLayoutV2() {
  return (
    <div className="flex min-h-screen">
      <SidebarV2 />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b px-6 py-4 flex items-center justify-between bg-background">
          <Link to="/browse" className="font-semibold text-lg hover:opacity-80">
            Browse
          </Link>
          <DraftSelector />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

**Grep results:**
- `grep "DraftBanner[^V]" MainLayoutV2.tsx` → No matches
- `grep "useDraft[^V]" MainLayoutV2.tsx` → No matches
- `grep "useSearchParams" MainLayoutV2.tsx` → No matches (removed)

**Verification:**
1. No imports of v1 DraftBanner or useDraft
2. No conditional rendering of DraftBanner
3. Only BrowsePage.tsx renders DraftBannerV2 (line 159-168)
4. Layout is clean shell: sidebar + header + outlet

**Result:** ✓ VERIFIED

### Truth 4: OAuth redirect works

**File:** `frontend/src/components/draft/PRWizardSteps/ConfirmSubmit.tsx`

**Line 28 (OAuth redirect):**
```typescript
window.location.href = `/api/v1/oauth/github/login?${params.toString()}`
```

**Backend verification:**

**File:** `backend/app/main.py` line 135:
```python
app.include_router(oauth_router, prefix="/api/v1")
```

**File:** `backend/app/routers/oauth.py` line 59:
```python
router = APIRouter(prefix="/oauth", tags=["oauth"])
```

**Combined path:** `/api/v1` + `/oauth` + `/github/login` = `/api/v1/oauth/github/login`

**Grep verification:**
- `grep "/api/oauth/github/login" frontend/src` → No matches (broken URL removed)
- `grep "/api/v1/oauth/github/login" frontend/src` → 2 matches (ConfirmSubmit.tsx:28 and OpenPRButton.tsx:37)

**Result:** ✓ VERIFIED

## Backward Compatibility

**v1 draft_id URL parameter still supported:**

Both BrowsePage.tsx and SidebarV2.tsx use fallback pattern:
```typescript
const draftId = draftV2.data?.id?.toString() || searchParams.get('draft_id') || undefined
```

This means:
- `/browse?draft_token=abc` → derives draftId from fetched draft (v2 flow)
- `/browse?draft_id=5` → uses URL param directly (v1 flow)
- Both flows work correctly

**Result:** ✓ BACKWARD COMPATIBLE

## Success Criteria Verification

From plan must_haves, all verified:

1. ✓ When navigating to `/browse?draft_token=abc123`, entity queries receive a valid draftId (from fetched draft.id), showing draft overlay data
2. ✓ When navigating to `/browse?draft_token=abc123`, sidebar entity lists receive draftId, showing change badges
3. ✓ When navigating to `/browse?draft_token=abc123`, graph queries receive draftId, showing change status colors on nodes
4. ✓ MainLayoutV2 renders zero DraftBanner components (only BrowsePage renders DraftBannerV2)
5. ✓ Clicking "Submit Pull Request" in the PR wizard redirects to `/api/v1/oauth/github/login` (not 404)
6. ✓ Legacy `/browse?draft_id=123` still works (fallback path preserved)

**All 6 success criteria met**

## Phase Goal Achievement

**Goal:** Fix 3 integration gaps from milestone audit: draft overlay propagation, v1/v2 component conflicts, and OAuth redirect URL

**Result:**
- ✓ Draft overlay propagation: Fixed in BrowsePage and SidebarV2 by deriving draftId from fetched draft
- ✓ V1/v2 component conflicts: Fixed by removing all v1 draft components from MainLayoutV2
- ✓ OAuth redirect URL: Fixed by adding /v1 prefix in ConfirmSubmit.tsx

**Goal achieved: YES**

---

_Verified: 2026-01-24T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
