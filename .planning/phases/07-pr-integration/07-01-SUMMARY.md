---
phase: 07-pr-integration
plan: 01
subsystem: auth
tags: [oauth, github, authlib, session, authentication]

# Dependency graph
requires:
  - phase: 05-draft-system
    provides: Draft capability URLs for OAuth redirect context
provides:
  - GitHub OAuth flow for PR creation
  - Session-based OAuth state management
  - OAuth configuration settings
affects: [07-02, 07-03]

# Tech tracking
tech-stack:
  added: [authlib>=1.6.0, itsdangerous>=2.0.0]
  patterns: [SessionMiddleware for OAuth state, OAuth registration in lifespan]

key-files:
  created: [backend/app/routers/oauth.py]
  modified: [backend/app/config.py, backend/app/main.py, backend/requirements.txt, backend/app/routers/__init__.py]

key-decisions:
  - "SessionMiddleware with 30min max_age for OAuth flow"
  - "OAuth registration in lifespan conditional on GITHUB_CLIENT_ID/SECRET"
  - "503 response when OAuth not configured for better DX"
  - "Store draft_token in session during OAuth for redirect recovery"
  - "public_repo scope for GitHub OAuth"

patterns-established:
  - "OAuth client registration happens in lifespan after settings loaded"
  - "Session state for OAuth redirect round-trip"
  - "Graceful 503 when OAuth credentials not configured"

# Metrics
duration: 5min
completed: 2026-01-22
---

# Phase 07 Plan 01: OAuth Foundation Summary

**GitHub OAuth flow with Authlib, session-based state management, and draft token preservation across OAuth redirect**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-23T00:23:27Z
- **Completed:** 2026-01-23T00:28:11Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- OAuth router with /oauth/github/login and /oauth/github/callback endpoints
- SessionMiddleware configured for OAuth state preservation
- OAuth client registration conditional on credentials being configured
- Draft token survives OAuth redirect round-trip via session storage

## Task Commits

Each task was committed atomically:

1. **Task 1: Add OAuth configuration and Authlib dependency** - `5ab9981` (feat)
2. **Task 2: Create OAuth router with login and callback endpoints** - `04f8f82` (feat)
3. **Task 3: Wire OAuth into FastAPI app with SessionMiddleware** - `8ef2ce0` (feat)

## Files Created/Modified
- `backend/app/config.py` - Added GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, FRONTEND_URL settings
- `backend/app/routers/oauth.py` - OAuth router with GitHub login/callback endpoints using Authlib
- `backend/app/routers/__init__.py` - Export oauth_router and register_oauth_client
- `backend/app/main.py` - SessionMiddleware wired, OAuth client registered in lifespan, oauth_router included
- `backend/requirements.txt` - Added authlib>=1.6.0 and itsdangerous>=2.0.0

## Decisions Made
- **SessionMiddleware before other middleware**: OAuth requires session to be available early in request processing
- **30-minute session max_age**: Long enough for OAuth flow completion, short enough for security
- **same_site="lax"**: Required for OAuth callback redirects to work across domains
- **Conditional OAuth registration**: Only register OAuth client if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are configured
- **503 when OAuth not configured**: Better developer experience than silent failure
- **Store draft_token in session**: Enables OAuth redirect to return to correct draft page
- **public_repo scope**: Minimum scope needed for PR creation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added itsdangerous dependency**
- **Found during:** Task 3 (SessionMiddleware integration)
- **Issue:** SessionMiddleware requires itsdangerous for session cookie signing, missing from requirements
- **Fix:** Added itsdangerous>=2.0.0 to requirements.txt
- **Files modified:** backend/requirements.txt
- **Verification:** Backend started successfully with SessionMiddleware
- **Committed in:** 8ef2ce0 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential dependency for SessionMiddleware to function. No scope creep.

## Issues Encountered
None

## User Setup Required

**OAuth requires GitHub App configuration.** Environment variables needed:
- `GITHUB_CLIENT_ID`: OAuth App Client ID from GitHub
- `GITHUB_CLIENT_SECRET`: OAuth App Client Secret from GitHub
- `SESSION_SECRET`: Random 32-byte hex for production (default dev key provided)

**OAuth App Setup:**
1. Create GitHub OAuth App at https://github.com/settings/developers
2. Set callback URL: `http://localhost:8080/api/v1/oauth/github/callback` (update for production)
3. Copy Client ID and Client Secret to .env file
4. Restart backend

**Verification:**
```bash
# Should return 503 before configuration
curl http://localhost:8080/api/v1/oauth/github/login?draft_token=test

# Should redirect to GitHub after configuration
```

## Next Phase Readiness
- OAuth flow established, ready for PR creation logic
- Session stores access_token temporarily after OAuth callback
- Next plan (07-02) will consume access_token to create GitHub PR
- Draft token successfully preserved across OAuth redirect

---
*Phase: 07-pr-integration*
*Completed: 2026-01-22*
