---
phase: 01-foundation
plan: 02
subsystem: security
tags: [capability-url, rate-limiting, security-headers, slowapi, w3c-pattern]

# Dependency graph
requires: [01-01]
provides:
  - Capability URL token system (W3C pattern)
  - SHA-256 token hashing (never store plaintext)
  - IP-based rate limiting (20/hour for draft create)
  - Security headers (Referrer-Policy, X-Content-Type-Options, X-Frame-Options)
  - Draft CRUD endpoints (POST /drafts, GET /drafts/{token})
affects: [01-foundation-03, 02-api]

# Tech tracking
tech-stack:
  added: [slowapi]
  patterns: [capability-url, token-hashing, rate-limiting, security-headers-middleware]

key-files:
  created:
    - backend/app/dependencies/__init__.py
    - backend/app/dependencies/capability.py
    - backend/app/dependencies/rate_limit.py
    - backend/app/routers/__init__.py
    - backend/app/routers/drafts.py
    - backend/app/schemas/__init__.py
    - backend/app/schemas/draft.py
  modified:
    - backend/app/main.py
    - backend/app/models/draft.py
    - backend/app/models/__init__.py
    - backend/requirements.txt

key-decisions:
  - "Fragment-based capability URLs (#token) to reduce referrer leakage"
  - "SHA-256 hashing for capability tokens (64-char hex in database)"
  - "Same 404 response for invalid and expired tokens (no oracle attack)"
  - "3600 second Retry-After for hourly rate limits"

patterns-established:
  - "secrets.token_urlsafe(32) for 256-bit entropy tokens"
  - "Hash tokens before storage, validate by hashing and comparing"
  - "SlowAPI @limiter.limit decorator with Request parameter"
  - "SecurityHeadersMiddleware for all responses"

# Metrics
duration: 6min
completed: 2026-01-21
---

# Phase 1 Plan 2: Capability URL Security and Rate Limiting Summary

**W3C capability URL pattern with SHA-256 token hashing, SlowAPI rate limiting (20/hour for drafts), and security headers middleware**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-21T06:14:00Z
- **Completed:** 2026-01-21T06:22:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Capability URL token system with secrets.token_urlsafe(32) for 256-bit entropy
- SHA-256 token hashing - plaintext tokens NEVER stored in database
- Validation returns 404 for both invalid and expired (no oracle attack)
- IP-based rate limiting via SlowAPI: 20/hour for draft creation, 100/min for reads
- 429 responses include Retry-After header (RFC 6585 compliant)
- Security headers middleware: Referrer-Policy, X-Content-Type-Options, X-Frame-Options
- POST /api/v1/drafts returns capability URL (shown ONCE, cannot be recovered)
- GET /api/v1/drafts/{token} retrieves draft with valid capability token

## Task Commits

Each task was committed atomically:

1. **Task 1: Capability URL Token System** - `628244c` (feat)
2. **Task 2: Rate Limiting Configuration** - `941cfa4` (feat)
3. **Task 3: Draft API Endpoints** - `1e90612` (feat)

## Files Created/Modified

- `backend/app/dependencies/capability.py` - Token generation, hashing, validation
- `backend/app/dependencies/rate_limit.py` - SlowAPI limiter with rate constants
- `backend/app/dependencies/__init__.py` - Exports capability and rate limit functions
- `backend/app/routers/drafts.py` - POST/GET draft endpoints with rate limiting
- `backend/app/routers/__init__.py` - Router exports
- `backend/app/schemas/draft.py` - Re-exports draft schemas
- `backend/app/schemas/__init__.py` - Schema exports
- `backend/app/main.py` - SecurityHeadersMiddleware, rate limiter, router inclusion
- `backend/app/models/draft.py` - DraftCreateResponse schema
- `backend/app/models/__init__.py` - Export DraftCreateResponse
- `backend/requirements.txt` - Added slowapi>=0.1.9

## Decisions Made

1. **Fragment-based URLs** - Capability URLs use `#token` format to reduce referrer leakage (fragments not sent in HTTP Referrer header)
2. **SHA-256 hashing** - Tokens stored as 64-character hex hashes; plaintext never persists
3. **Unified 404 response** - Same error for invalid and expired tokens prevents oracle attacks (cannot determine if token exists)
4. **Retry-After calculation** - Parses rate limit period from detail string for accurate Retry-After header

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SlowAPI RateLimitExceeded attribute error**
- **Found during:** Task 3 verification (rate limiting test)
- **Issue:** `exc.retry_after` attribute doesn't exist in SlowAPI RateLimitExceeded
- **Fix:** Added `_parse_retry_after()` helper to calculate retry seconds from `exc.detail` string
- **Files modified:** backend/app/dependencies/rate_limit.py
- **Verification:** 429 responses now include proper Retry-After header
- **Committed in:** 1e90612 (Task 3 commit)

**2. [Rule 1 - Bug] Missing slash in capability URL**
- **Found during:** Task 3 verification
- **Issue:** URL generated as `http://localhost:8080api/v1/drafts#token` (missing slash)
- **Fix:** Changed `f"{base_url}api/v1"` to `f"{base_url}/api/v1"` in drafts.py
- **Files modified:** backend/app/routers/drafts.py
- **Committed in:** 1e90612 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed bugs
**Impact on plan:** Both were minor bugs caught during verification. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations.

## User Setup Required

None - rate limiting uses in-memory storage by default. For production, configure Redis backend.

## Next Phase Readiness

- Capability URL security infrastructure complete
- Rate limiting active and tested
- Security headers protecting all responses
- Ready for additional API endpoints in future plans
- API base documented at http://localhost:8080/docs (FastAPI auto-docs)

---
*Phase: 01-foundation*
*Completed: 2026-01-21*
