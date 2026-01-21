# Phase 1: Foundation - Research

**Researched:** 2026-01-20
**Domain:** FastAPI + PostgreSQL infrastructure with Docker, capability URLs, and rate limiting
**Confidence:** HIGH

## Summary

Phase 1 establishes the technical foundation using Python FastAPI with PostgreSQL, containerized via Docker Compose. The standard stack is well-established with SQLModel (combining SQLAlchemy + Pydantic) as the ORM, async database operations via asyncpg, Alembic for migrations, and SlowAPI for rate limiting. For observability, the LGTM stack (Loki, Grafana, Tempo, Prometheus) with OpenTelemetry provides comprehensive logging, metrics, and tracing.

Capability URLs follow W3C best practices: HTTPS-only, 120+ bits entropy using `secrets.token_urlsafe()`, stored as SHA-256 hashes with pgcrypto, returning 404 for invalid tokens (no information leakage). Rate limiting uses IP-based identification with SlowAPI, configured per-endpoint with automatic 429 responses and Retry-After headers.

Database schema design should use temporal tables pattern for versioning (via triggers storing deltas in history tables), soft deletes with `deleted_at` timestamps and partial unique indexes, and JSONB columns for flexible module/profile relationships.

**Primary recommendation:** Use FastAPI's modern lifespan context manager for database initialization, async SQLModel with asyncpg for all database operations, SlowAPI for IP-based rate limiting, and follow W3C capability URL security patterns with token hashing in PostgreSQL using pgcrypto.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115+ | Web framework | Modern async Python framework, official FastAPI author maintains it, excellent documentation, type-safe with Pydantic |
| SQLModel | 0.0.22+ | ORM | Official FastAPI companion, combines SQLAlchemy + Pydantic, reduces boilerplate, seamless FastAPI integration |
| PostgreSQL | 17 | Database | Production-grade relational database, pgcrypto for secure hashing, temporal tables support, JSONB for flexibility |
| asyncpg | 0.30+ | DB driver | Fastest async PostgreSQL driver for Python, required for async SQLModel operations |
| Alembic | 1.18+ | Migrations | Standard SQLAlchemy migration tool, autogenerate from models, production-ready rollback support |
| Uvicorn | 0.34+ | ASGI server | Official FastAPI recommendation, includes hot reload for development, high performance |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| SlowAPI | 0.1.9+ | Rate limiting | IP-based rate limiting for FastAPI, Flask-limiter port, supports Redis/memory backends |
| pydantic-settings | 2.7+ | Configuration | Environment variable management, type validation for config |
| python-multipart | 0.0.20+ | Form parsing | Required for FastAPI form data handling |
| Grafana | 11+ | Observability UI | Unified dashboard for logs/metrics/traces visualization |
| Loki | 3+ | Log aggregation | Fast log storage and querying, Docker log collection |
| Prometheus | 2.55+ | Metrics | Time-series metrics database, service monitoring |
| Tempo | 2+ | Distributed tracing | OpenTelemetry trace storage and analysis |
| pgAdmin | 8+ | Database UI | PostgreSQL database management and query tools |
| OpenTelemetry | 1.30+ | Instrumentation | Auto-instrumentation for traces, metrics, logs correlation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLModel | Tortoise ORM | Tortoise is fully async-native but smaller ecosystem, less FastAPI integration |
| SlowAPI | fastapi-limiter | fastapi-limiter requires Redis, SlowAPI has in-memory fallback for simple deployments |
| asyncpg | psycopg3 (async) | psycopg3 is newer but asyncpg has better performance benchmarks and wider adoption |
| Alembic | Atlas | Atlas has modern CLI but Alembic is battle-tested with SQLAlchemy integration |

**Installation:**
```bash
# Core dependencies
pip install "fastapi[standard]" sqlmodel asyncpg alembic pydantic-settings

# Rate limiting
pip install slowapi

# Development
pip install uvicorn[standard]

# PostgreSQL driver (sync) - required even with asyncpg for certain SQLAlchemy operations
pip install psycopg2-binary
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── app/
│   ├── main.py              # FastAPI app with lifespan
│   ├── config.py            # Pydantic settings
│   ├── database.py          # DB engine, session, dependencies
│   ├── models/              # SQLModel table models
│   │   ├── entity.py
│   │   ├── draft.py
│   │   ├── capability.py
│   │   └── module.py
│   ├── schemas/             # Pydantic request/response models
│   │   ├── entity.py
│   │   └── draft.py
│   ├── routers/             # Route handlers
│   │   ├── entities.py
│   │   ├── drafts.py
│   │   └── capabilities.py
│   ├── dependencies/        # Reusable dependencies
│   │   ├── auth.py          # Capability URL validation
│   │   └── rate_limit.py    # Rate limit configurations
│   └── migrations/          # Alembic migration files
│       └── versions/
├── tests/
├── Dockerfile
├── docker-compose.yml
├── alembic.ini
└── requirements.txt
```

### Pattern 1: Lifespan Context Manager for Database Initialization

**What:** Modern FastAPI approach for startup/shutdown logic using async context manager
**When to use:** Database connection pooling, ML model loading, any shared resources
**Example:**
```python
# Source: https://fastapi.tiangolo.com/advanced/events/
from contextlib import asynccontextmanager
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncEngine
from app.database import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create database tables (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield
    # Shutdown: Dispose of connection pool
    await engine.dispose()

app = FastAPI(lifespan=lifespan)
```

**Critical:** Do NOT use deprecated `@app.on_event("startup")` - lifespan is the official approach as of FastAPI 0.95+.

### Pattern 2: Async Database Session Dependency

**What:** Provide async database session per request with automatic cleanup
**When to use:** All database operations in route handlers
**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/sql-databases/
from sqlmodel.ext.asyncio.session import AsyncSession, create_async_engine, async_sessionmaker
from typing import Annotated

# Database URL must use postgresql+asyncpg:// for async
DATABASE_URL = "postgresql+asyncpg://user:pass@db:5432/dbname"
engine = create_async_engine(DATABASE_URL, echo=True)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

SessionDep = Annotated[AsyncSession, Depends(get_session)]

# Usage in routes
@app.post("/entities/", response_model=EntityPublic)
async def create_entity(entity: EntityCreate, session: SessionDep):
    db_entity = Entity.model_validate(entity)
    session.add(db_entity)
    await session.commit()
    await session.refresh(db_entity)
    return db_entity
```

### Pattern 3: Multiple Model Inheritance for API Clarity

**What:** Separate models for table definition, API requests, and responses
**When to use:** All database tables to enforce clean API boundaries
**Example:**
```python
# Source: https://fastapi.tiangolo.com/tutorial/sql-databases/
from sqlmodel import SQLModel, Field
from typing import Optional

class EntityBase(SQLModel):
    name: str = Field(index=True)
    description: str | None = None

class Entity(EntityBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    deleted_at: datetime | None = None  # Soft delete

class EntityCreate(EntityBase):
    pass  # No ID, no timestamps

class EntityUpdate(EntityBase):
    name: str | None = None  # All fields optional for PATCH
    description: str | None = None

class EntityPublic(EntityBase):
    id: int
    created_at: datetime
```

### Pattern 4: IP-Based Rate Limiting with SlowAPI

**What:** Decorator-based rate limiting using client IP address
**When to use:** All public endpoints, with stricter limits on write operations
**Example:**
```python
# Source: https://slowapi.readthedocs.io/
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter

# Exception handler for 429 responses with Retry-After
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": str(exc.retry_after)},
        content={"detail": "Rate limit exceeded"}
    )

# Apply limits per endpoint
@app.post("/drafts/")
@limiter.limit("20/hour")  # User decision: 20 per IP per hour
async def create_draft(request: Request, draft: DraftCreate, session: SessionDep):
    # Must include 'request' parameter for SlowAPI to work
    pass

@app.get("/entities/")
@limiter.limit("100/minute")  # More lenient for reads
async def list_entities(request: Request, session: SessionDep):
    pass
```

**Critical:** Request parameter must be explicitly passed to endpoint, or SlowAPI can't intercept.

### Pattern 5: Capability URL Security Pattern

**What:** W3C-recommended secure token generation, storage, and validation
**When to use:** Draft access links, password resets, any URL-based authorization
**Example:**
```python
# Source: https://w3ctag.github.io/capability-urls/
import secrets
import hashlib
from sqlmodel import Field

# Generation: 32 bytes = 256 bits (W3C recommends 120+ bits entropy)
def generate_capability_token() -> str:
    return secrets.token_urlsafe(32)  # Returns ~43 char base64url string

# Storage: Hash with SHA-256, NEVER store plaintext
class Draft(SQLModel, table=True):
    id: int = Field(primary_key=True)
    capability_hash: str = Field(unique=True, index=True)  # SHA-256 hex
    expires_at: datetime

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

# Creation endpoint
@app.post("/drafts/", response_model=DraftResponse)
async def create_draft(draft: DraftCreate, session: SessionDep):
    token = generate_capability_token()
    db_draft = Draft(
        capability_hash=Draft.hash_token(token),
        expires_at=datetime.utcnow() + timedelta(days=7),  # User decision: 7 days
        **draft.dict()
    )
    session.add(db_draft)
    await session.commit()

    # Return token ONCE in response, URL fragment recommended
    capability_url = f"https://ontology-hub.org/drafts#{token}"
    return {"capability_url": capability_url, "expires_at": db_draft.expires_at}

# Validation dependency
async def validate_capability(token: str, session: SessionDep) -> Draft:
    token_hash = Draft.hash_token(token)
    draft = await session.get(Draft, {"capability_hash": token_hash})

    # Return 404 for invalid/expired (user decision: no information leakage)
    if not draft or draft.expires_at < datetime.utcnow():
        raise HTTPException(status_code=404, detail="Not found")

    return draft
```

**Security notes:**
- Use HTTPS only (enforced via middleware)
- Token in URL fragment (`#token`) reduces referrer leakage
- Never log capability URLs
- Set `Referrer-Policy: origin` header

### Anti-Patterns to Avoid

- **Using sync database drivers with async endpoints:** Always use `postgresql+asyncpg://` and `AsyncSession`, not sync `postgresql://`. Mixing causes blocking operations.
- **Storing capability tokens in plaintext:** Security requirement INFR-04 mandates hash-only storage. Use pgcrypto or Python hashlib.
- **Using `localhost` in Docker Compose DATABASE_URL:** Use service name `db` not `localhost` (Docker networking).
- **Forgetting Request parameter in rate-limited routes:** SlowAPI requires explicit `request: Request` parameter.
- **Using deprecated `@app.on_event("startup")`:** Use lifespan context manager (FastAPI 0.95+).
- **Hand-rolling unique token generation:** Use `secrets.token_urlsafe()`, not `uuid4()` or `random`.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom IP tracking with dict/timestamps | SlowAPI | Production-ready with Redis support, automatic 429 responses, Retry-After headers, memory leaks handled |
| Database migrations | Manual SQL scripts with version tracking | Alembic | Autogeneration from models, rollback support, team collaboration, schema comparison |
| Secure random tokens | `uuid.uuid4()` or `random` module | `secrets.token_urlsafe()` | UUIDs guarantee uniqueness not secrecy, `random` not cryptographically secure, `secrets` designed for security tokens |
| Password/token hashing | Custom hash implementation | pgcrypto (PostgreSQL) or Python hashlib | Industry-standard algorithms (SHA-256, bcrypt), salting handled, timing attack protection |
| Entity versioning | Copying full rows on every change | Temporal tables with triggers | Stores only deltas as JSONB, automatic versioning, PostgreSQL-native performance, audit trail |
| Log aggregation | File-based logging with grep | Loki + Promtail | Structured log querying, correlation with traces/metrics, Docker container log collection, Grafana integration |
| API observability | Print statements and manual metrics | OpenTelemetry + LGTM stack | Auto-instrumentation, distributed tracing, metrics correlation, production-grade dashboards |

**Key insight:** Infrastructure concerns (auth, rate limiting, migrations, observability) are solved problems in the FastAPI/PostgreSQL ecosystem. Use battle-tested libraries to avoid security vulnerabilities, performance issues, and edge cases.

## Common Pitfalls

### Pitfall 1: Async/Sync Mixing in Database Operations

**What goes wrong:** Using synchronous database drivers or blocking operations in async endpoints causes the entire application to freeze during database queries.

**Why it happens:**
- Using `postgresql://` instead of `postgresql+asyncpg://` in DATABASE_URL
- Installing only `psycopg2` without `asyncpg`
- Calling sync SQLAlchemy methods in async route handlers

**How to avoid:**
- Always use `create_async_engine()` with `postgresql+asyncpg://`
- Install both `asyncpg` (async operations) and `psycopg2-binary` (SQLAlchemy internals)
- Use `await session.exec()`, `await session.commit()`, `await session.refresh()`
- Use `AsyncSession` not `Session`

**Warning signs:**
- Application becomes unresponsive during database queries
- Uvicorn warnings about sync operations in async context
- Significantly slower response times than expected

### Pitfall 2: Capability URL Leakage Through Referrer Headers

**What goes wrong:** Capability tokens leak to external sites via Referer header when users click external links from pages accessed via capability URL.

**Why it happens:** Browsers automatically send the full URL (including query/path parameters) in Referer header to linked sites. W3C documentation explicitly warns: "URLs are not generally required to be kept secret, and there are various routes through which capability URLs can leak."

**How to avoid:**
- Use URL fragments (`#token`) instead of query params (`?token=`) - fragments not sent in Referer
- Set `Referrer-Policy: origin` header on capability-protected pages
- Add `rel="noreferrer"` to all external links
- Use HTTPS exclusively (capability URLs must be HTTPS per W3C)
- Implement token expiration (user decision: 7 days for drafts)

**Warning signs:**
- Capability tokens appearing in server logs of external sites
- Users reporting unauthorized access after sharing links
- Capability URLs indexed by search engines

### Pitfall 3: Missing Health Checks in Docker Compose Dependencies

**What goes wrong:** Backend container starts before PostgreSQL is ready to accept connections, causing connection failures and application crashes.

**Why it happens:** `depends_on` only waits for container to start, not for PostgreSQL to be ready. Database initialization takes several seconds.

**How to avoid:**
```yaml
db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ontology"]
    interval: 5s
    timeout: 5s
    retries: 5

backend:
  depends_on:
    db:
      condition: service_healthy  # Wait for health check, not just start
```

**Warning signs:**
- "Connection refused" errors on first startup
- Need to restart backend container manually after `docker compose up`
- Intermittent startup failures

### Pitfall 4: Rate Limiting Without Request Parameter

**What goes wrong:** SlowAPI decorator applied to route but rate limiting never triggers, allowing unlimited requests.

**Why it happens:** SlowAPI documentation states: "The request argument must be explicitly passed to your endpoint, or slowapi won't be able to hook into it."

**How to avoid:**
```python
# WRONG - missing request parameter
@app.post("/drafts/")
@limiter.limit("20/hour")
async def create_draft(draft: DraftCreate, session: SessionDep):
    pass

# CORRECT - explicit request parameter
@app.post("/drafts/")
@limiter.limit("20/hour")
async def create_draft(request: Request, draft: DraftCreate, session: SessionDep):
    pass
```

**Warning signs:**
- Rate limits never trigger during testing
- No 429 responses even with excessive requests
- Rate limit headers missing from responses

## Sources

### Primary (HIGH confidence)
- [FastAPI SQL Databases Tutorial](https://fastapi.tiangolo.com/tutorial/sql-databases/) - Official SQLModel integration
- [FastAPI Lifespan Events](https://fastapi.tiangolo.com/advanced/events/) - Official lifespan documentation
- [W3C Capability URLs Best Practices](https://w3ctag.github.io/capability-urls/) - Security specification
- [SlowAPI Documentation](https://slowapi.readthedocs.io/) - Official rate limiting library docs
- [PostgreSQL pgcrypto Documentation](https://www.postgresql.org/docs/current/pgcrypto.html) - Official cryptographic functions
- [Alembic Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html) - Official migration tool docs
- [Python secrets Module](https://docs.python.org/3/library/secrets.html) - Official Python documentation

### Secondary (MEDIUM confidence)
- [FastAPI Best Practices Repository](https://github.com/zhanymkanov/fastapi-best-practices) - Community-vetted patterns (verified with official docs)
- [TestDriven.io FastAPI SQLModel Tutorial](https://testdriven.io/blog/fastapi-sqlmodel/) - Comprehensive async setup (Jan 2025)
- [FastAPI Observability GitHub](https://github.com/blueswen/fastapi-observability) - LGTM stack integration (verified with Grafana docs)

### Tertiary (LOW confidence - marked for validation)
- WebSearch results for "FastAPI PostgreSQL best practices 2026" - Community discussions, needs verification
- WebSearch results for "PostgreSQL temporal tables" - Multiple implementations, no single standard
- Medium articles on FastAPI async patterns - Useful examples but not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official FastAPI docs, established ecosystem, PyPI download stats confirm adoption
- Architecture patterns: HIGH - Verified with official documentation, lifespan/async/SQLModel all documented
- Capability URLs: MEDIUM - W3C spec is authoritative but implementation details from community examples
- Rate limiting: HIGH - SlowAPI official docs, clear API and examples
- Observability: MEDIUM - LGTM stack well-documented but specific FastAPI integration from community repos
- Pitfalls: MEDIUM - Derived from GitHub issues, Stack Overflow, and official warnings, not all explicitly documented

**Research date:** 2026-01-20
**Valid until:** ~30 days for stable components (PostgreSQL, FastAPI core), ~7 days for fast-moving (observability tooling versions)
