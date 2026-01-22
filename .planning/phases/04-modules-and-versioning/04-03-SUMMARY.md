---
phase: 04-modules-and-versioning
plan: 03
subsystem: api, ui
tags: [versions, diff, jsondiffpatch, github-releases, version-comparison]

# Dependency graph
requires:
  - phase: 02-github-integration
    provides: GitHub API client with auth headers and rate limiting
provides:
  - GET /versions endpoint for listing GitHub releases
  - GET /versions/diff endpoint for field-level diff between versions
  - VersionsPage with release list and diff viewer
  - jsondiffpatch wrapper for field-level change detection
affects: [04-02, future versioning features]

# Tech tracking
tech-stack:
  added: [jsondiffpatch]
  patterns: [field-level diff computation, change grouping by entity type]

key-files:
  created:
    - backend/app/routers/versions.py
    - backend/app/services/versions.py
    - backend/tests/test_versions_api.py
    - frontend/src/api/versions.ts
    - frontend/src/lib/diff.ts
    - frontend/src/pages/VersionsPage.tsx
    - frontend/src/components/version/DiffViewer.tsx
    - frontend/src/components/version/ChangeGroup.tsx
    - frontend/src/components/version/VersionList.tsx
  modified:
    - backend/app/services/github.py
    - backend/app/main.py
    - backend/app/config.py
    - frontend/src/api/types.ts
    - frontend/src/components/layout/Sidebar.tsx
    - frontend/src/App.tsx

key-decisions:
  - "github_repo property on Settings for convenience"
  - "Changes grouped by entity type (categories, properties, subobjects, modules, profiles)"
  - "Default comparison is latest vs previous release"

patterns-established:
  - "Field-level diff using jsondiffpatch with objectHash for entity deduplication"
  - "ChangeGroup component pattern for collapsible added/modified/deleted sections"

# Metrics
duration: 9min
completed: 2026-01-22
---

# Phase 4 Plan 3: Version History and Diff Viewing Summary

**Version comparison with GitHub release listing, field-level diff using jsondiffpatch, and UI with changes grouped by entity type**

## Performance

- **Duration:** 9 min
- **Started:** 2026-01-22T05:31:21Z
- **Completed:** 2026-01-22T05:39:57Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Created version API with GET /versions (release list) and GET /versions/diff (field-level diff)
- Built VersionsPage with version selectors and DiffViewer component
- Implemented jsondiffpatch wrapper for computing field-level changes
- Added Versions link to sidebar navigation
- Default comparison shows latest vs previous release

## Task Commits

Each task was committed atomically:

1. **Task 1: Create version API with GitHub release fetching** - `d3649d7` (feat)
2. **Task 2: Create version frontend with diff viewer** - `05902c1` (feat)

## Files Created/Modified

**Backend:**
- `backend/app/routers/versions.py` - Version API endpoints (list releases, get diff)
- `backend/app/services/versions.py` - Version diff computation service
- `backend/app/services/github.py` - Added get_releases and get_file_at_ref methods
- `backend/app/config.py` - Added github_repo property
- `backend/app/main.py` - Register versions router, store github_client in state
- `backend/tests/test_versions_api.py` - 8 tests for versions API

**Frontend:**
- `frontend/src/api/versions.ts` - useReleases and useVersionDiff hooks
- `frontend/src/api/types.ts` - Added ReleasePublic, EntityChange, VersionDiffResponse types
- `frontend/src/lib/diff.ts` - jsondiffpatch wrapper with computeDiff and flattenDelta
- `frontend/src/pages/VersionsPage.tsx` - Main version history page
- `frontend/src/components/version/DiffViewer.tsx` - Grouped diff display by entity type
- `frontend/src/components/version/ChangeGroup.tsx` - Collapsible change sections
- `frontend/src/components/version/VersionList.tsx` - Release list with selection
- `frontend/src/components/layout/Sidebar.tsx` - Added Versions link
- `frontend/src/App.tsx` - Added /versions route

## Decisions Made
- Added `github_repo` property to Settings for convenience (combines GITHUB_REPO_OWNER and GITHUB_REPO_NAME)
- Store GitHubClient instance on app.state.github_client for convenience in routers
- Initialize github_client to None in test fixture for proper 503 handling tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added github_client to app state**
- **Found during:** Task 1 (Version API endpoints)
- **Issue:** Router expected `app.state.github_client` but only `github_http_client` existed
- **Fix:** Updated lifespan to also store `GitHubClient(http_client)` as `github_client`
- **Files modified:** backend/app/main.py
- **Verification:** Tests pass, router accesses client correctly
- **Committed in:** d3649d7 (Task 1 commit)

**2. [Rule 3 - Blocking] Added github_repo property to Settings**
- **Found during:** Task 1 (Version service implementation)
- **Issue:** Service used `settings.github_repo` but it didn't exist
- **Fix:** Added property combining GITHUB_REPO_OWNER and GITHUB_REPO_NAME
- **Files modified:** backend/app/config.py
- **Verification:** Tests pass, router parses correctly
- **Committed in:** d3649d7 (Task 1 commit)

**3. [Rule 3 - Blocking] Updated test conftest for github_client**
- **Found during:** Task 1 (Test verification)
- **Issue:** Tests failed because github_client wasn't initialized on app.state
- **Fix:** Added github_client initialization in test fixture
- **Files modified:** backend/tests/conftest.py
- **Verification:** All 8 tests pass
- **Committed in:** d3649d7 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary for correct operation. No scope creep.

## Issues Encountered
- Permission denied when building frontend locally (dist directory owned by Docker). Resolved by building inside Docker container.
- jsondiffpatch needed to be installed in Docker container after local npm install.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- VERS-01 satisfied: User can view list of releases with dates and version labels
- VERS-02 satisfied: User can view field-level diff between any two versions
- VERS-03 satisfied: Diffs categorize changes by entity type and change type
- Ready for 04-02 (Module/profile filtering with version awareness)

---
*Phase: 04-modules-and-versioning*
*Completed: 2026-01-22*
