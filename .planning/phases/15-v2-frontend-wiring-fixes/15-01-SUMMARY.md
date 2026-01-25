---
phase: 15-v2-frontend-wiring-fixes
plan: 01
subsystem: ui
tags: [react, typescript, draft-workflow, oauth, url-params]

# Dependency graph
requires:
  - phase: 14-validation-workflow-pr
    provides: v2 draft workflow (draft_token param, DraftBannerV2, FloatingActionBar, PRWizard)
  - phase: 12-frontend-graph-visualization
    provides: BrowsePage, SidebarV2, MainLayoutV2, entity query hooks
provides:
  - Draft ID derivation from async draft fetch (draftV2.data?.id) in BrowsePage and SidebarV2
  - Clean v2-only layout (MainLayoutV2 without conflicting v1 components)
  - Correct OAuth redirect URL for PR submission (/api/v1/oauth/github/login)
affects: [all future draft workflow features, pr-submission flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Draft ID derivation: draftV2.data?.id?.toString() with fallback to URL param"
    - "Layout responsibility: pages handle their own draft UI, not layout wrapper"

key-files:
  created: []
  modified:
    - frontend/src/pages/BrowsePage.tsx
    - frontend/src/components/layout/SidebarV2.tsx
    - frontend/src/components/layout/MainLayoutV2.tsx
    - frontend/src/components/draft/PRWizardSteps/ConfirmSubmit.tsx

key-decisions:
  - "Derive draftId from async fetch instead of URL to support draft_token workflow"
  - "Remove all v1 draft components from MainLayoutV2 to eliminate conflicts"
  - "Maintain backward compatibility with v1 draft_id URL parameter"

patterns-established:
  - "Pattern: Derive draftId from fetched draft data with fallback: `draftV2.data?.id?.toString() || searchParams.get('draft_id') || undefined`"
  - "Pattern: Pages (not layouts) render draft UI to avoid duplicate banners"

# Metrics
duration: 3min
completed: 2026-01-24
---

# Phase 15 Plan 01: V2 Frontend Wiring Fixes Summary

**Draft ID derived from async fetch, v1/v2 component conflicts resolved, OAuth redirect fixed for PR submission**

## Performance

- **Duration:** 3 min 9 sec
- **Started:** 2026-01-25T01:25:07Z
- **Completed:** 2026-01-25T01:28:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Fixed draft_id derivation to use fetched draft data (draftV2.data?.id) instead of only URL params
- Entity queries, graph queries, and sidebar change badges now work correctly in v2 draft_token workflow
- Eliminated duplicate/conflicting v1 DraftBanner in MainLayoutV2 (BrowsePage now exclusively handles draft UI)
- Fixed OAuth redirect URL from /api/oauth/github/login to /api/v1/oauth/github/login for PR submission

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive draftId from fetched draft in BrowsePage and SidebarV2** - `7d20263` (feat)
2. **Task 2: Remove v1 draft components from MainLayoutV2 and fix OAuth URL** - `7e5ad32` (fix)

## Files Created/Modified
- `frontend/src/pages/BrowsePage.tsx` - Derive draftId from draftV2.data?.id with fallback to draft_id URL param
- `frontend/src/components/layout/SidebarV2.tsx` - Add useDraftV2 hook and derive draftId from fetched draft
- `frontend/src/components/layout/MainLayoutV2.tsx` - Remove v1 DraftBanner, useDraft, useSearchParams (clean v2-only layout)
- `frontend/src/components/draft/PRWizardSteps/ConfirmSubmit.tsx` - Fix OAuth redirect URL to /api/v1/oauth/github/login

## Decisions Made
- **Draft ID derivation strategy:** Use `draftV2.data?.id?.toString()` as primary source with `searchParams.get('draft_id')` as fallback to maintain backward compatibility with v1 workflow
- **Layout responsibility:** Pages handle their own draft UI (DraftBannerV2) rather than layout wrapper, preventing duplicate banners and ensuring proper conditional rendering
- **Number to string conversion:** Draft.id is database integer UUID, converted to string via .toString() for consistency with string-typed draftId parameter

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Unblocked E2E flows:**
1. Draft Editing flow: Entity/graph queries now receive correct draft_id when using draft_token URL param
2. PR Submission flow: OAuth redirect now hits correct backend endpoint (/api/v1/oauth/github/login)

**Ready for:**
- Additional v2 frontend gap closure (if audit reveals more issues)
- v2.0 milestone completion testing
- Production deployment preparation

**No blockers or concerns.**

---
*Phase: 15-v2-frontend-wiring-fixes*
*Completed: 2026-01-24*
