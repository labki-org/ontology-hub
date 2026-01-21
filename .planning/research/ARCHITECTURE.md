# Architecture Research

**Project:** Ontology Hub
**Researched:** 2026-01-20
**Confidence:** HIGH (verified against official documentation and established patterns)

## Component Overview

The platform follows a modular architecture with clear separation between concerns. Six major components handle distinct responsibilities.

### 1. FastAPI Backend (API Server)

**Responsibility:** HTTP request handling, business logic orchestration, authentication flows

**Boundaries:**
- Exposes REST API for frontend consumption
- Coordinates between storage (Postgres), cache (Redis), and external services (GitHub)
- Handles webhook ingestion from GitHub
- Manages OAuth flow at PR-time only

**Key Modules:**
| Module | Purpose |
|--------|---------|
| `api/` | Route handlers grouped by domain (entities, drafts, validation, auth) |
| `core/` | Settings, configuration, shared dependencies |
| `models/` | SQLModel definitions (database schema) |
| `schemas/` | Pydantic models for API input/output |
| `services/` | Business logic (validation engine, GitHub integration, indexing) |
| `tasks/` | Background job definitions (Celery or BackgroundTasks) |

### 2. React Frontend (SPA)

**Responsibility:** User interface for browsing, draft review, and PR creation

**Boundaries:**
- Consumes API exclusively (no direct database/GitHub access)
- Manages local UI state (React Query for server state)
- Renders diff views, entity graphs, validation feedback

**Key Features:**
| Feature | Library/Approach |
|---------|------------------|
| Routing | React Router (client-side) |
| State | React Query (server) + Zustand/Context (local) |
| Diff Viewer | react-diff-view or react-diff-viewer |
| Forms | React Hook Form |
| Styling | Tailwind CSS or CSS Modules |

### 3. PostgreSQL Database

**Responsibility:** Persistent storage for platform data (not schema source of truth)

**Stores:**
- Indexed schema entities (cached from GitHub)
- Draft proposals with capability tokens
- Validation results
- Webhook event log

**Does NOT store:**
- Canonical schema definitions (GitHub is source of truth)
- User accounts (no platform accounts)
- Long-term history (GitHub provides this)

### 4. GitHub Integration Layer

**Responsibility:** Sync with source of truth, PR creation, webhook processing

**Sub-components:**
| Component | Purpose |
|-----------|---------|
| Indexer | Fetches and parses schema files from GitHub repo |
| Webhook Handler | Processes push events to trigger re-indexing |
| PR Creator | Creates branches, commits, and PRs via GitHub App |
| OAuth Handler | Handles user auth flow at PR-time |

### 5. Validation Engine

**Responsibility:** Schema consistency checks, breaking change detection, semver suggestions

**Capabilities:**
- Syntax validation (JSON schema conformance)
- Consistency checks (references exist, types match)
- Breaking change detection (MODEL/REVISION/ADDITION per SchemaVer)
- Semver suggestion based on change classification

**Architecture:** Pure Python module, no external dependencies beyond schema definitions. Testable in isolation.

### 6. Background Task System

**Responsibility:** Async processing for non-blocking operations

**Tasks:**
- GitHub indexing after webhook
- Validation of large drafts
- Draft expiration cleanup
- Release artifact generation

**Recommendation:** Start with FastAPI BackgroundTasks for simplicity. Graduate to Celery + Redis when:
- Tasks exceed 30 seconds
- Need task status tracking
- Need retry with exponential backoff
- Need distributed workers

---

## Data Flow

### Flow 1: GitHub to Platform (Indexing)

```
GitHub Repository
    |
    | (webhook: push event)
    v
FastAPI Webhook Handler
    |
    | (queue job)
    v
Background Task: Indexer
    |
    | (fetch via GitHub API)
    v
GitHub API (categories/*.json, properties/*.json, etc.)
    |
    | (parse and validate)
    v
Validation Engine (syntax check)
    |
    | (store indexed data)
    v
PostgreSQL (entities, modules, profiles tables)
```

**Trigger:** GitHub push to main branch
**Latency:** Near real-time (< 30 seconds)
**Failure handling:** Log error, keep previous index, alert maintainers

### Flow 2: Wiki to Platform (Draft Ingestion)

```
MediaWiki (SemanticSchemas export)
    |
    | POST /api/drafts (JSON payload)
    v
FastAPI: Draft Ingestion Endpoint
    |
    | (generate capability token)
    | (hash token, store draft)
    v
PostgreSQL (drafts table)
    |
    | (async validation)
    v
Validation Engine
    |
    | (compare against indexed entities)
    | (detect breaking changes)
    | (classify changes)
    v
PostgreSQL (validation_results table)
    |
    | (return capability URL)
    v
Wiki Admin (receives URL to share/review)
```

**Authentication:** None required (public endpoint with rate limiting)
**Token:** Generated server-side, returned once, stored as hash
**TTL:** 7 days default, configurable per draft

### Flow 3: Platform to User (Draft Review)

```
User (has capability URL)
    |
    | GET /drafts/{token}
    v
FastAPI: Draft Retrieval
    |
    | (verify token hash)
    | (check TTL)
    v
PostgreSQL (draft + validation results)
    |
    | (enrich with current canonical data)
    v
FastAPI: Response Assembly
    |
    v
React Frontend
    |
    | (render diff view)
    | (show validation feedback)
    | (enable change toggles)
    v
User Reviews Draft
```

**No auth required:** Capability URL grants access
**Capabilities:** Read draft, see diffs, toggle changes, trigger re-validation

### Flow 4: Platform to GitHub (PR Creation)

```
User (reviewing draft)
    |
    | Click "Create PR"
    v
React Frontend
    |
    | Redirect to GitHub OAuth
    v
GitHub OAuth Flow
    |
    | (user authorizes, returns code)
    v
FastAPI: OAuth Callback
    |
    | (exchange code for token)
    | (verify user can push to repo)
    v
FastAPI: PR Creation Service
    |
    | (using GitHub App installation token)
    | (create branch, commit changes, open PR)
    v
GitHub API
    |
    v
PR Created (with structured summary)
```

**Auth model:** User's OAuth token verifies permission; GitHub App token creates PR
**Why both:** User proves identity, App has elevated permissions for branch/PR creation

---

## API Boundaries

### External APIs (Public)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/entities` | GET | None | List/search indexed entities |
| `/api/entities/{id}` | GET | None | Entity details with inheritance |
| `/api/modules` | GET | None | List modules with dependencies |
| `/api/profiles` | GET | None | List profiles with module refs |
| `/api/versions` | GET | None | List indexed versions/releases |
| `/api/versions/{tag}/diff` | GET | None | Diff between versions |
| `/api/drafts` | POST | None* | Create draft (rate limited) |
| `/api/drafts/{token}` | GET | Capability | Retrieve draft with validation |
| `/api/drafts/{token}` | PATCH | Capability | Update draft selections |
| `/api/drafts/{token}/validate` | POST | Capability | Trigger re-validation |
| `/api/drafts/{token}/pr` | POST | OAuth | Create GitHub PR |
| `/api/auth/github` | GET | None | Initiate OAuth flow |
| `/api/auth/github/callback` | GET | None | OAuth callback handler |

*Rate limited by IP, payload size capped at 1-5MB

### Internal APIs (Backend Only)

| Service | Purpose |
|---------|---------|
| Validation Engine | Called by draft service, not exposed via HTTP |
| GitHub Indexer | Called by webhook handler and scheduler |
| Token Generator | Called by draft creation, never exposed |

### Webhook Endpoints

| Endpoint | Source | Events |
|----------|--------|--------|
| `/webhooks/github` | GitHub | push, release |

---

## Storage Strategy

### What Lives in GitHub (Source of Truth)

| Content | Location | Format |
|---------|----------|--------|
| Category definitions | `categories/*.json` | JSON per entity |
| Property definitions | `properties/*.json` | JSON per entity |
| Subobject definitions | `subobjects/*.json` | JSON per entity |
| Module manifests | `modules/*.json` | JSON referencing entity IDs |
| Profile manifests | `profiles/*.json` | JSON referencing module IDs |
| Version history | Git tags/releases | Semantic versions |

**Why GitHub:**
- Version control built-in
- PR workflow for review
- Release artifacts for deployment
- Single source of truth

### What Lives in PostgreSQL (Platform Data)

| Table | Purpose | Retention |
|-------|---------|-----------|
| `indexed_entities` | Cached entity data for fast queries | Until re-indexed |
| `indexed_modules` | Cached module data | Until re-indexed |
| `indexed_profiles` | Cached profile data | Until re-indexed |
| `drafts` | User-submitted draft proposals | TTL (7 days default) |
| `draft_changes` | Individual changes within a draft | With parent draft |
| `validation_results` | Validation output per draft | With parent draft |
| `capability_tokens` | Hashed tokens for draft access | With parent draft |
| `webhook_events` | Audit log of GitHub webhooks | 30 days |

**Schema sketch:**

```sql
-- Indexed from GitHub
CREATE TABLE indexed_entities (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,  -- category, property, subobject
    data JSONB NOT NULL,
    indexed_at TIMESTAMPTZ NOT NULL,
    version_tag TEXT
);

-- Draft proposals
CREATE TABLE drafts (
    id UUID PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, validated, pr_created, expired
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    pr_url TEXT
);

-- Validation results
CREATE TABLE validation_results (
    id UUID PRIMARY KEY,
    draft_id UUID REFERENCES drafts(id),
    result JSONB NOT NULL,
    change_classification TEXT,  -- major, minor, patch
    created_at TIMESTAMPTZ NOT NULL
);
```

### What Lives in Redis (Optional Cache)

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `entity:{id}` | Hot entity cache | 1 hour |
| `search:{query_hash}` | Search result cache | 15 min |
| `validation:{draft_id}` | In-progress validation lock | 5 min |

**Note:** Redis is optional for MVP. Start without caching, add when performance requires.

---

## Build Order

Based on component dependencies, recommended build sequence:

### Phase 1: Foundation

**Build first (no dependencies):**

1. **Database schema + migrations** - Alembic setup, core tables
2. **FastAPI skeleton** - Project structure, configuration, health endpoints
3. **Validation engine core** - Pure Python, testable in isolation

**Why first:** Everything else depends on these. Validation engine can be developed in parallel since it's pure logic.

### Phase 2: GitHub Integration

**Build second (depends on Phase 1):**

1. **GitHub indexer** - Fetch and parse schema files
2. **Webhook handler** - Receive push events, trigger indexing
3. **Entity API endpoints** - Serve indexed data

**Why second:** Provides real data for all subsequent features. Frontend needs something to display.

### Phase 3: Draft System

**Build third (depends on Phases 1-2):**

1. **Draft ingestion endpoint** - Accept exports, generate tokens
2. **Capability URL system** - Token generation, hashing, verification
3. **Draft retrieval endpoint** - Serve draft with validation
4. **Validation integration** - Connect engine to draft flow

**Why third:** Core value proposition. Can be tested via API before frontend exists.

### Phase 4: Frontend Core

**Build fourth (depends on Phases 1-3):**

1. **React project setup** - Vite, routing, basic layout
2. **Entity browser** - List, search, detail views
3. **Draft review UI** - Diff viewer, validation display

**Why fourth:** API must be stable before frontend development accelerates.

### Phase 5: PR Creation

**Build fifth (depends on Phases 1-4):**

1. **GitHub App setup** - Permissions, installation flow
2. **OAuth flow** - User authorization at PR-time
3. **PR creation service** - Branch, commit, PR via API
4. **Frontend PR flow** - Button, OAuth redirect, success state

**Why fifth:** Complex integration, needs stable draft system first.

### Phase 6: Polish and Scale

**Build last:**

1. **Background task infrastructure** - Celery if needed
2. **Caching layer** - Redis for performance
3. **Release artifact generation** - Downloadable packages
4. **Module/profile editing** - Advanced draft features

**Why last:** Optimizations and advanced features after core works.

### Dependency Graph

```
[Database Schema] ─────────────────────────────────────┐
        │                                              │
        v                                              v
[FastAPI Skeleton] ──────────────────────> [Validation Engine]
        │                                              │
        v                                              │
[GitHub Indexer] ──────> [Entity API] ─────────────────┤
        │                      │                       │
        v                      v                       v
[Webhook Handler]        [Frontend Browser] <── [Draft System]
                               │                       │
                               v                       v
                         [Draft Review UI] ────> [PR Creation]
```

---

## Integration Points

### GitHub API

**Authentication methods:**

| Method | Use Case | Token Type |
|--------|----------|------------|
| Installation token | Indexing, webhooks, PR creation | Generated from GitHub App private key |
| User OAuth token | Verify user permission at PR-time | Exchanged from OAuth code |

**Key endpoints used:**

| Endpoint | Purpose |
|----------|---------|
| `GET /repos/{owner}/{repo}/contents/{path}` | Fetch schema files |
| `GET /repos/{owner}/{repo}/releases` | List versions |
| `POST /repos/{owner}/{repo}/git/refs` | Create branch |
| `PUT /repos/{owner}/{repo}/contents/{path}` | Commit file changes |
| `POST /repos/{owner}/{repo}/pulls` | Create PR |

**Rate limits:** 5000 requests/hour for authenticated requests. Index operations should batch requests and cache results.

### MediaWiki Export Format

**Expected input format (draft ingestion):**

```json
{
  "wiki_id": "example-wiki",
  "timestamp": "2026-01-20T12:00:00Z",
  "entities": {
    "categories": [
      {
        "id": "Person",
        "label": "Person",
        "properties": ["name", "birthDate"],
        "inherits": ["Thing"]
      }
    ],
    "properties": [
      {
        "id": "name",
        "label": "Name",
        "datatype": "string"
      }
    ]
  },
  "modules": [],
  "profiles": []
}
```

**Validation on ingestion:**
- JSON schema validation
- Entity ID format validation
- Reference existence checks (against indexed canonical data)

### Webhook Security

**GitHub webhook verification:**

```python
import hmac
import hashlib

def verify_github_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

**Best practices:**
- Verify signature before processing
- Queue webhook payload, return 200 immediately
- Process asynchronously to avoid timeout
- Idempotency: handle duplicate deliveries gracefully

---

## Anti-Patterns to Avoid

### 1. Tight Coupling to GitHub API

**Problem:** Calling GitHub API directly from route handlers makes testing hard and couples business logic to external service.

**Solution:** Abstract GitHub operations behind a service interface:

```python
# Bad
@app.get("/entities")
async def get_entities():
    response = await github_client.get(...)
    return response.json()

# Good
@app.get("/entities")
async def get_entities(entity_service: EntityService = Depends()):
    return await entity_service.list_entities()
```

### 2. Synchronous Validation in Request Cycle

**Problem:** Large drafts cause request timeouts.

**Solution:** Return draft ID immediately, validate asynchronously, poll for results:

```python
# Return immediately
@app.post("/drafts")
async def create_draft(payload: DraftPayload):
    draft = await draft_service.create(payload)
    background_tasks.add_task(validation_service.validate, draft.id)
    return {"id": draft.id, "token": draft.token, "status": "validating"}

# Poll for results
@app.get("/drafts/{token}")
async def get_draft(token: str):
    draft = await draft_service.get_by_token(token)
    return {"draft": draft, "validation": draft.validation_result}
```

### 3. Storing Capability Tokens in Plain Text

**Problem:** Token leakage from database breach.

**Solution:** Store only hashed tokens:

```python
import secrets
import hashlib

def generate_capability_token() -> tuple[str, str]:
    """Returns (plaintext_token, hashed_token)"""
    token = secrets.token_urlsafe(32)  # 256 bits of entropy
    hashed = hashlib.sha256(token.encode()).hexdigest()
    return token, hashed
```

### 4. Monolithic Validation Engine

**Problem:** Hard to test, hard to extend, hard to parallelize.

**Solution:** Compose validators:

```python
class ValidationPipeline:
    def __init__(self):
        self.validators = [
            SyntaxValidator(),
            ReferenceValidator(),
            BreakingChangeValidator(),
            SemverClassifier(),
        ]

    async def validate(self, draft: Draft) -> ValidationResult:
        results = []
        for validator in self.validators:
            result = await validator.validate(draft)
            results.append(result)
            if result.is_fatal:
                break
        return ValidationResult.merge(results)
```

---

## Scalability Considerations

| Concern | MVP (< 100 users) | Growth (< 10K users) | Scale (< 100K users) |
|---------|-------------------|----------------------|----------------------|
| Database | Single Postgres | Single Postgres + read replica | Postgres + connection pooling (PgBouncer) |
| Caching | None | Redis for hot data | Redis cluster |
| Background tasks | FastAPI BackgroundTasks | Celery + Redis | Celery + Redis + multiple workers |
| GitHub API | Direct calls | Direct calls + caching | Aggressive caching, batch operations |
| Static assets | FastAPI serves | CDN | CDN |
| Search | Postgres full-text | Postgres full-text | Consider Elasticsearch if needed |

**MVP recommendation:** Start simple. Postgres handles most loads well. Add complexity only when metrics show bottlenecks.

---

## Sources

### Official Documentation (HIGH confidence)
- [FastAPI SQL Databases Tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/)
- [GitHub Apps Documentation](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
- [W3C TAG Capability URLs Best Practices](https://w3ctag.github.io/capability-urls/)
- [GitHub Webhooks Documentation](https://developer.github.com/webhooks/)
- [GitHub OAuth PKCE Support (July 2025)](https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/)

### Architecture Patterns (MEDIUM confidence)
- [FastAPI Full-Stack Template](https://github.com/fastapi/full-stack-fastapi-template)
- [TestDriven.io FastAPI + Celery](https://testdriven.io/blog/fastapi-and-celery/)
- [FastAPI + SQLModel + Alembic](https://testdriven.io/blog/fastapi-sqlmodel/)
- [Snowplow SchemaVer](https://docs.snowplow.io/docs/pipeline-components-and-applications/iglu/common-architecture/schemaver/)
- [react-diff-view](https://github.com/otakustay/react-diff-view)

### Community Patterns (verified with official sources)
- [GitHub App vs OAuth](https://nango.dev/blog/github-app-vs-github-oauth)
- [Celery + Redis + FastAPI 2025 Guide](https://medium.com/@dewasheesh.rana/celery-redis-fastapi-the-ultimate-2025-production-guide-broker-vs-backend-explained-5b84ef508fa7)
- [Webhook Architecture Patterns](https://beeceptor.com/docs/webhook-feature-design/)
