---
phase: 14-validation-workflow-pr
plan: 05
subsystem: api
tags: [fastapi, github-oauth, pr-creation, draft-submission]

# Dependency graph
requires:
  - phase: 14-03
    provides: Validation endpoint for drafts
  - phase: 14-04
    provides: PR builder v2 services for file generation
provides:
  - POST /api/v2/drafts/{token}/submit endpoint for PR creation
  - OAuth flow updated for v2 draft model compatibility
  - DraftSubmitRequest and DraftSubmitResponse schemas
affects: [14-07-frontend-submit-ui, 14-08-mediawiki-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [oauth-session-params, re-validation-before-submit]

key-files:
  created:
    - backend/app/schemas/draft_v2.py (DraftSubmitRequest, DraftSubmitResponse)
  modified:
    - backend/app/routers/drafts_v2.py (submit_draft endpoint)
    - backend/app/routers/oauth.py (v2 model compatibility)

key-decisions:
  - "Re-validate draft before PR creation to ensure canonical hasn't changed"
  - "OAuth flow accepts pr_title and user_comment as query params stored in session"
  - "Submit endpoint uses token from request body (not OAuth session)"
  - "OAuth callback uses v2 services: build_files_from_draft_v2, generate_pr_body_v2"

patterns-established:
  - "Re-validation pattern: always re-check before submission even if previously validated"
  - "OAuth session param storage: store pr_title/user_comment for use in callback"
  - "Dual submission paths: direct token submission (API) and OAuth redirect (frontend)"

# Metrics
duration: 4min
completed: 2026-01-25
---

# Phase 14 Plan 5: PR Submission Endpoint Summary

**POST /api/v2/drafts/{token}/submit endpoint with GitHub OAuth token submission, re-validation before PR creation, and updated OAuth flow for v2 draft model compatibility**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-25T00:14:08Z
- **Completed:** 2026-01-25T00:18:03Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added submit endpoint for creating GitHub PRs from validated drafts
- Re-validation before PR creation ensures canonical changes don't break submission
- OAuth flow updated to accept pr_title and user_comment parameters
- OAuth callback uses v2 models (DraftStatus.VALIDATED) and v2 services (build_files_from_draft_v2, generate_pr_body_v2)
- Dual submission paths: direct API call with token, or OAuth redirect flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create submit request schema** - `c91365f` (feat)
2. **Task 2: Add submit endpoint to drafts_v2.py** - `8d127e9` (feat)
3. **Task 3: Update oauth.py for v2 draft model compatibility** - `df2a735` (feat)

## Files Created/Modified
- `backend/app/schemas/draft_v2.py` - Added DraftSubmitRequest (github_token, pr_title, user_comment) and DraftSubmitResponse (pr_url, draft_status)
- `backend/app/routers/drafts_v2.py` - Added POST /{token}/submit endpoint with re-validation and PR creation
- `backend/app/routers/oauth.py` - Updated github_login to accept pr_title/user_comment, rewrote create_pr_from_draft for v2 models

## Decisions Made

**1. Re-validate before submission**
- Rationale: Canonical may have changed since last validation, ensuring draft is still valid prevents broken PRs
- Implementation: Call validate_draft_v2 before building files, fail with 400 if validation fails

**2. OAuth accepts pr_title and user_comment as query params**
- Rationale: Frontend redirect flow needs to pass these values through OAuth callback
- Implementation: Store in session during github_login, retrieve in github_callback

**3. Submit endpoint uses token from request body**
- Rationale: API-first approach allows both direct submission and OAuth flow to work
- Implementation: DraftSubmitRequest.github_token field, passed to GitHubClient.create_pr_with_token

**4. OAuth callback uses v2 services**
- Rationale: Maintain consistency with v2 architecture, avoid v1/v2 mixing
- Implementation: Import from pr_builder_v2, check DraftStatus.VALIDATED, use transition_to_submitted

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed plan specification without issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for frontend integration:
- Submit endpoint available at POST /api/v2/drafts/{token}/submit
- OAuth flow compatible with v2 draft model
- Frontend can use either direct submission (with OAuth token) or redirect flow
- Validation report provides feedback for user before submission

Blockers:
- None

---
*Phase: 14-validation-workflow-pr*
*Completed: 2026-01-25*
