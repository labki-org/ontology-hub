# Phase 2: GitHub Integration - Research

**Researched:** 2026-01-20
**Domain:** GitHub REST API integration, async HTTP clients, webhook processing, entity indexing
**Confidence:** HIGH

## Summary

Phase 2 integrates with the GitHub REST API to index the SemanticSchemas repository and expose entity data via API. The standard approach uses **httpx AsyncClient** for GitHub API calls (preferred over PyGithub for async compatibility with FastAPI), the **Git Trees API** for efficient recursive repository listing (avoids the 1,000 file limit of Contents API), and **tenacity** for exponential backoff retry logic on rate limits.

Webhook processing should use FastAPI's built-in `BackgroundTasks` for simple fire-and-forget re-indexing, with HMAC-SHA256 signature verification using Python's `hmac` and `hashlib` modules. The push webhook payload includes `commits[].added/modified/removed` arrays for incremental sync, plus `before` and `after` commit SHAs for determining changes.

Entity storage leverages the existing SQLModel models with `commit_sha` versioning field already in place. Use SQLAlchemy's PostgreSQL dialect `insert().on_conflict_do_update()` for atomic upserts. API pagination should use cursor-based pagination (on `entity_id` or `created_at`) for large result sets, with a maximum page size limit.

**Primary recommendation:** Use httpx AsyncClient with lifespan management, Git Trees API with `?recursive=1` for full repository indexing, tenacity for exponential backoff with jitter, and cursor-based pagination for API responses. Process webhooks synchronously for immediate indexing, with transaction-based atomicity per push.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | 0.27+ | Async HTTP client | FastAPI's recommended client, async-native, HTTP/2 support, works seamlessly with AsyncClient lifespan pattern |
| tenacity | 9.0+ | Retry logic | Production-ready exponential backoff with jitter, decorator-based, widely adopted in Python ecosystem |
| fastapi-pagination | 0.12+ | API pagination | Purpose-built for FastAPI, supports cursor and offset pagination, integrates with SQLModel |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PyGithub | 2.3+ | GitHub API client | Only if sync operations are needed; not recommended for async FastAPI |
| pydantic | 2.9+ | Response validation | Parse and validate GitHub API responses into typed models |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| httpx | aiohttp | aiohttp is faster for extreme concurrency but has steeper learning curve and different API; httpx integrates better with FastAPI |
| httpx | PyGithub | PyGithub is sync-only, would block async event loop; httpx allows full async |
| tenacity | Manual retry loops | tenacity handles edge cases (jitter, max attempts, exception filtering) that manual implementations often miss |
| FastAPI BackgroundTasks | Celery/ARQ | Celery requires Redis/RabbitMQ infrastructure; BackgroundTasks sufficient for single webhook processing |

**Installation:**
```bash
pip install httpx tenacity fastapi-pagination
```

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── github.py           # GitHub API client with httpx
│   └── indexer.py          # Repository indexing logic
├── routers/
│   ├── entities.py         # GET /entities endpoints
│   └── webhooks.py         # POST /webhooks/github endpoint
├── models/
│   └── sync_status.py      # Track sync state (optional)
└── schemas/
    └── github.py           # GitHub API response models
```

### Pattern 1: Lifespan-Managed httpx AsyncClient

**What:** Single long-lived httpx client created at app startup, shared across requests
**When to use:** All GitHub API calls to benefit from connection pooling
**Example:**
```python
# Source: https://www.python-httpx.org/async/
from contextlib import asynccontextmanager
import httpx
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Configure timeout and limits for GitHub API
    timeout = httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)
    limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)

    app.state.github_client = httpx.AsyncClient(
        base_url="https://api.github.com",
        timeout=timeout,
        limits=limits,
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
        }
    )
    yield
    await app.state.github_client.aclose()

app = FastAPI(lifespan=lifespan)
```

**Critical:** Never create new AsyncClient per request - kills connection reuse and TLS handshakes.

### Pattern 2: Exponential Backoff with Tenacity for Rate Limits

**What:** Automatic retry with exponential backoff when hitting GitHub rate limits
**When to use:** All GitHub API calls
**Example:**
```python
# Source: https://tenacity.readthedocs.io/
from tenacity import (
    retry,
    retry_if_exception_type,
    wait_exponential_jitter,
    stop_after_attempt,
    before_sleep_log
)
import logging

logger = logging.getLogger(__name__)

class GitHubRateLimitError(Exception):
    """Raised when GitHub returns 403 with rate limit exceeded."""
    def __init__(self, reset_time: int):
        self.reset_time = reset_time

@retry(
    retry=retry_if_exception_type(GitHubRateLimitError),
    wait=wait_exponential_jitter(initial=1, max=120),  # 1s, 2s, 4s... up to 2 min
    stop=stop_after_attempt(5),
    before_sleep=before_sleep_log(logger, logging.WARNING)
)
async def fetch_with_retry(client: httpx.AsyncClient, url: str) -> dict:
    response = await client.get(url)

    if response.status_code == 403:
        remaining = int(response.headers.get("x-ratelimit-remaining", 0))
        if remaining == 0:
            reset_time = int(response.headers.get("x-ratelimit-reset", 0))
            raise GitHubRateLimitError(reset_time)

    response.raise_for_status()
    return response.json()
```

### Pattern 3: Git Trees API for Recursive Repository Listing

**What:** Single API call to get all files in repository recursively
**When to use:** Initial sync or full re-index operations
**Example:**
```python
# Source: https://docs.github.com/en/rest/git/trees
async def get_repository_tree(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    sha: str = "HEAD"
) -> list[dict]:
    """Fetch complete repository tree recursively.

    Returns list of tree entries with path, type (blob/tree), sha, size.
    Limit: 100,000 entries or 7 MB response.
    """
    url = f"/repos/{owner}/{repo}/git/trees/{sha}?recursive=1"
    data = await fetch_with_retry(client, url)

    if data.get("truncated"):
        # Fall back to non-recursive tree traversal
        logger.warning("Repository tree truncated, using iterative fetch")
        return await get_tree_iteratively(client, owner, repo, sha)

    # Filter for .json files in target directories
    return [
        entry for entry in data["tree"]
        if entry["type"] == "blob"
        and entry["path"].endswith(".json")
        and entry["path"].split("/")[0] in ("categories", "properties", "subobjects", "modules", "profiles")
    ]
```

### Pattern 4: Webhook Signature Verification with HMAC-SHA256

**What:** Verify webhook payloads are from GitHub using HMAC signature
**When to use:** All webhook endpoints
**Example:**
```python
# Source: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
import hmac
import hashlib
from fastapi import Request, HTTPException

async def verify_github_signature(request: Request, secret: str) -> bytes:
    """Verify GitHub webhook signature and return raw body.

    Uses constant-time comparison to prevent timing attacks.
    """
    signature_header = request.headers.get("x-hub-signature-256")
    if not signature_header:
        raise HTTPException(status_code=403, detail="Missing signature header")

    body = await request.body()

    expected_signature = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(status_code=403, detail="Invalid signature")

    return body
```

### Pattern 5: Async Upsert with SQLAlchemy PostgreSQL Dialect

**What:** Atomic insert-or-update using PostgreSQL ON CONFLICT
**When to use:** Syncing entities from GitHub to database
**Example:**
```python
# Source: https://docs.sqlalchemy.org/en/20/dialects/postgresql.html
from sqlalchemy.dialects.postgresql import insert
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.entity import Entity

async def upsert_entity(session: AsyncSession, entity_data: dict) -> None:
    """Upsert entity with atomic insert-or-update semantics."""
    stmt = insert(Entity).values(**entity_data)

    # On conflict, update all fields except id and created_at
    update_dict = {
        col: stmt.excluded[col]
        for col in entity_data.keys()
        if col not in ("id", "created_at")
    }
    update_dict["updated_at"] = datetime.utcnow()

    stmt = stmt.on_conflict_do_update(
        index_elements=["entity_id", "entity_type"],  # Unique constraint
        set_=update_dict
    )

    await session.execute(stmt)
```

### Pattern 6: Cursor-Based Pagination for Entity API

**What:** Efficient pagination using entity_id as cursor
**When to use:** GET /entities endpoints with large result sets
**Example:**
```python
# Source: https://uriyyo-fastapi-pagination.netlify.app/
from typing import Optional
from fastapi import Query
from sqlmodel import select

async def list_entities(
    session: AsyncSession,
    entity_type: Optional[str] = None,
    cursor: Optional[str] = Query(None, description="Last entity_id from previous page"),
    limit: int = Query(20, le=100, description="Max items per page")
) -> dict:
    """List entities with cursor-based pagination."""
    query = select(Entity).where(Entity.deleted_at.is_(None))

    if entity_type:
        query = query.where(Entity.entity_type == entity_type)

    if cursor:
        query = query.where(Entity.entity_id > cursor)

    query = query.order_by(Entity.entity_id).limit(limit + 1)

    result = await session.exec(query)
    entities = result.all()

    has_next = len(entities) > limit
    if has_next:
        entities = entities[:limit]

    return {
        "items": entities,
        "next_cursor": entities[-1].entity_id if has_next else None,
        "has_next": has_next
    }
```

### Anti-Patterns to Avoid

- **Creating httpx client per request:** Kills connection pooling, causes TLS handshake overhead on every call. Use lifespan-managed shared client.
- **Using PyGithub in async FastAPI:** PyGithub is synchronous and will block the event loop. Use httpx AsyncClient instead.
- **Polling GitHub API instead of webhooks:** Wastes rate limit quota and delays updates. Use webhooks for push events.
- **Using Contents API for large directories:** Has 1,000 file limit. Use Git Trees API with `?recursive=1`.
- **Plain `==` for HMAC comparison:** Vulnerable to timing attacks. Always use `hmac.compare_digest()`.
- **Ignoring truncated tree responses:** If `truncated: true`, you're missing files. Implement iterative fallback.
- **Offset pagination for large datasets:** Performance degrades with high offsets. Use cursor-based pagination.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with backoff | Manual sleep loops with counters | tenacity | Handles jitter, exception filtering, logging, max attempts; manual implementations miss edge cases |
| Repository file listing | Recursive Contents API calls | Git Trees API single call | Trees API returns up to 100k files in one call vs N+1 API calls |
| Webhook signature | Custom hash comparison | `hmac.compare_digest()` | Built-in constant-time comparison prevents timing attacks |
| API pagination | Manual offset tracking | fastapi-pagination | Handles cursor encoding, response schema, integrates with SQLModel |
| Upsert logic | SELECT then INSERT/UPDATE | `insert().on_conflict_do_update()` | Atomic, no race conditions, single query |
| HTTP client | requests with run_in_executor | httpx AsyncClient | Native async, connection pooling, same API as requests |

**Key insight:** GitHub integration has well-established patterns. The Git Trees API exists specifically to avoid the Contents API's limitations. Tenacity exists because retry logic is surprisingly tricky. Use them.

## Common Pitfalls

### Pitfall 1: Rate Limit Exhaustion During Initial Sync

**What goes wrong:** Full repository index on first run hits 5,000/hour rate limit, sync fails partway through.

**Why it happens:** Contents API requires one call per directory. Large repos with many directories exhaust limits quickly.

**How to avoid:**
- Use Git Trees API (`?recursive=1`) - single call for entire tree
- Use conditional requests with ETag headers - 304 responses don't count against limits
- Implement exponential backoff with tenacity, respecting `x-ratelimit-reset`
- Consider using a GitHub App (15k/hour) instead of personal token (5k/hour)

**Warning signs:**
- `x-ratelimit-remaining: 0` in response headers
- HTTP 403 responses with rate limit message
- Sync jobs taking hours instead of minutes

### Pitfall 2: Blocking Event Loop with Sync GitHub Client

**What goes wrong:** Using PyGithub or sync httpx in async FastAPI routes freezes the entire application during GitHub API calls.

**Why it happens:** PyGithub uses `requests` internally, which blocks. FastAPI's async routes expect non-blocking I/O.

**How to avoid:**
- Use `httpx.AsyncClient` exclusively
- Never use PyGithub in async routes
- If you must use sync code, use `run_in_executor`, but prefer native async

**Warning signs:**
- API response times spike during GitHub operations
- Uvicorn warnings about sync operations
- Application unresponsive during sync

### Pitfall 3: Missing Files in Truncated Tree Response

**What goes wrong:** Large repository sync misses files silently because tree response was truncated.

**Why it happens:** Git Trees API truncates at 100,000 entries or 7 MB. If `truncated: true`, you got partial data.

**How to avoid:**
```python
if data.get("truncated"):
    logger.warning(f"Tree truncated at {len(data['tree'])} entries")
    # Fallback: fetch each subdirectory tree separately
    return await fetch_tree_iteratively(client, owner, repo, sha)
```

**Warning signs:**
- `truncated: true` in API response (check logs)
- Entity count mismatch between GitHub and database
- Missing entities reported by users

### Pitfall 4: Webhook Payload Encoding Issues

**What goes wrong:** HMAC signature validation fails intermittently due to encoding mismatch.

**Why it happens:** GitHub sends UTF-8 encoded payload. If body is read multiple times or re-encoded, signature won't match.

**How to avoid:**
```python
# Read raw bytes ONCE, use for both signature and parsing
body = await request.body()  # bytes
# Verify signature with raw bytes
verify_signature(body, secret)
# Parse JSON from same bytes
payload = json.loads(body.decode("utf-8"))
```

**Warning signs:**
- Signature validation fails on payloads with Unicode
- Works in testing but fails in production
- Intermittent 403 errors on webhook endpoint

### Pitfall 5: Non-Atomic Sync Updates

**What goes wrong:** Partial sync leaves database in inconsistent state - some entities updated, others not.

**Why it happens:** Not using database transactions, or committing after each entity instead of batch.

**How to avoid:**
```python
async with session.begin():  # Transaction context
    for entity in entities:
        await upsert_entity(session, entity)
    # All or nothing - if any fails, all roll back
```

**Warning signs:**
- Entity versions don't match commit SHA
- Some entities missing after failed sync
- Duplicate entities with different commit SHAs

### Pitfall 6: Force Push Doesn't Show All Changed Files

**What goes wrong:** After force push, webhook shows only files in rebased commits, missing changes from commits that were replaced.

**Why it happens:** GitHub's webhook `commits[].added/modified/removed` only includes files in the pushed commits, not the full diff.

**How to avoid:**
- For force pushes (`payload["forced"] == True`), do full re-index instead of incremental
- Compare tree SHAs between `before` and `after` to detect force push
- Log force push events separately for debugging

**Warning signs:**
- `forced: true` in webhook payload
- Entities out of sync after force push
- Missing deletions after branch rebase

## Code Examples

Verified patterns from official sources:

### Fetching File Content from GitHub

```python
# Source: https://docs.github.com/en/rest/repos/contents
import base64

async def get_file_content(
    client: httpx.AsyncClient,
    owner: str,
    repo: str,
    path: str,
    ref: str = "main"
) -> dict:
    """Fetch and decode a single JSON file from GitHub."""
    url = f"/repos/{owner}/{repo}/contents/{path}"
    response = await client.get(url, params={"ref": ref})
    response.raise_for_status()

    data = response.json()

    # Content is base64 encoded
    content_bytes = base64.b64decode(data["content"])
    content_str = content_bytes.decode("utf-8")

    return json.loads(content_str)
```

### Processing Push Webhook Payload

```python
# Source: https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
from fastapi import APIRouter, Request, BackgroundTasks, HTTPException
from app.services.indexer import sync_changed_files

router = APIRouter()

@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    """Handle GitHub push webhook."""
    body = await verify_github_signature(request, settings.GITHUB_WEBHOOK_SECRET)
    payload = json.loads(body.decode("utf-8"))

    event = request.headers.get("x-github-event")
    if event != "push":
        return {"status": "ignored", "event": event}

    # Extract changed files from all commits
    changed_files = set()
    for commit in payload.get("commits", []):
        changed_files.update(commit.get("added", []))
        changed_files.update(commit.get("modified", []))
        changed_files.update(commit.get("removed", []))

    # Check for force push - requires full re-index
    if payload.get("forced"):
        background_tasks.add_task(full_reindex, payload["after"])
    else:
        background_tasks.add_task(
            sync_changed_files,
            changed_files=list(changed_files),
            commit_sha=payload["after"],
            deleted_files=get_deleted_files(payload)
        )

    return {"status": "accepted", "files_changed": len(changed_files)}
```

### Entity API Endpoint

```python
# Source: FastAPI best practices
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.models.entity import Entity, EntityType, EntityPublic
from app.database import SessionDep

router = APIRouter(prefix="/api/v1/entities", tags=["entities"])

@router.get("/{entity_type}/{entity_id}", response_model=EntityPublic)
async def get_entity(
    entity_type: EntityType,
    entity_id: str,
    session: SessionDep
) -> Entity:
    """Get a single entity by type and ID."""
    query = select(Entity).where(
        Entity.entity_type == entity_type,
        Entity.entity_id == entity_id,
        Entity.deleted_at.is_(None)
    )
    result = await session.exec(query)
    entity = result.first()

    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    return entity

@router.get("/{entity_type}", response_model=dict)
async def list_entities_by_type(
    entity_type: EntityType,
    session: SessionDep,
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, le=100)
) -> dict:
    """List entities by type with cursor pagination."""
    return await list_entities(session, entity_type.value, cursor, limit)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Contents API recursive calls | Git Trees API `?recursive=1` | Always available | 100x fewer API calls for large repos |
| PyGithub for Python apps | httpx AsyncClient | 2020+ async adoption | Non-blocking, connection pooling |
| Manual retry loops | tenacity library | Standard since 2018 | Reliable backoff, jitter, logging |
| X-Hub-Signature (SHA-1) | X-Hub-Signature-256 (SHA-256) | 2020 | More secure, SHA-1 deprecated |
| Offset pagination | Cursor pagination | Industry shift ~2020 | Better performance at scale |
| Poll for changes | Webhooks | GitHub has always recommended | Real-time updates, lower rate limit usage |

**Deprecated/outdated:**
- `X-Hub-Signature` (SHA-1): Use `X-Hub-Signature-256` instead
- PyGithub for async apps: Blocks event loop, use httpx
- requests library in async context: Use httpx for unified sync/async API

## Open Questions

Things that couldn't be fully resolved:

1. **GitHub App vs Personal Access Token**
   - What we know: GitHub Apps have higher rate limits (15k/hour with Enterprise Cloud), better scaling
   - What's unclear: Whether the SemanticSchemas repo is on Enterprise Cloud
   - Recommendation: Start with personal access token, migrate to GitHub App if rate limits become an issue

2. **Resilience When GitHub Unavailable**
   - What we know: Context says "Claude's discretion on resilience strategy"
   - Options: (a) Serve stale data with staleness indicator, (b) Return 503 with retry guidance
   - Recommendation: Serve stale data - entities don't change often, availability more important than freshness

3. **Admin Visibility for Skipped Files**
   - What we know: Parse errors should skip files and log them
   - What's unclear: How admins see which files were skipped
   - Recommendation: Add `sync_errors` table or log aggregation query; admin endpoint can wait for later phase

## Sources

### Primary (HIGH confidence)
- [GitHub REST API Best Practices](https://docs.github.com/rest/guides/best-practices-for-using-the-rest-api) - Official rate limit handling
- [GitHub Git Trees API](https://docs.github.com/en/rest/git/trees) - Recursive repository listing
- [GitHub Webhook Validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) - HMAC signature verification
- [GitHub Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) - Rate limit tiers
- [httpx Async Support](https://www.python-httpx.org/async/) - AsyncClient patterns
- [httpx Timeouts](https://www.python-httpx.org/advanced/timeouts/) - Timeout configuration
- [Tenacity Documentation](https://tenacity.readthedocs.io/) - Retry patterns
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/) - Webhook processing

### Secondary (MEDIUM confidence)
- [8 httpx + asyncio Patterns](https://medium.com/@sparknp1/8-httpx-asyncio-patterns-for-safer-faster-clients-f27bc82e93e6) - Production patterns (Dec 2025)
- [FastAPI Pagination Library](https://uriyyo-fastapi-pagination.netlify.app/) - Cursor pagination techniques
- [SQLAlchemy PostgreSQL Dialect](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html) - Upsert syntax

### Tertiary (LOW confidence)
- WebSearch results for "PyGithub vs httpx" - Community opinions, verified with official docs
- WebSearch results for "GitHub webhook changed files" - Confirmed with GitHub docs

## Metadata

**Confidence breakdown:**
- Standard stack (httpx, tenacity): HIGH - Official docs, FastAPI recommendations, widespread adoption
- Git Trees API: HIGH - Official GitHub docs, verified limits and behavior
- Webhook verification: HIGH - Official GitHub docs with Python examples
- Pagination patterns: MEDIUM - Best practices from community, no single official FastAPI pattern
- Upsert syntax: HIGH - SQLAlchemy official documentation

**Research date:** 2026-01-20
**Valid until:** ~30 days (GitHub API is stable, httpx mature)
