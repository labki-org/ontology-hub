from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from sqlmodel import SQLModel, text
from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.database import engine, async_session_maker, get_session
from app.dependencies.rate_limit import limiter, rate_limit_exceeded_handler
# Import all models to register them with SQLModel.metadata before create_all
from app.models import Entity, Module, Profile, Draft  # noqa: F401
from app.routers import (
    drafts_router,
    entities_router,
    graph_router,
    modules_router,
    oauth_router,
    register_oauth_client,
    versions_router,
    webhooks_router,
)
from app.routers.entities_v2 import router as entities_v2_router
from app.services.github import GitHubClient
from app.services.indexer import sync_repository


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses.

    Headers added:
    - Referrer-Policy: origin - prevents capability URL leakage in referrer
    - X-Content-Type-Options: nosniff - prevents MIME sniffing
    - X-Frame-Options: DENY - prevents clickjacking
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["Referrer-Policy"] = "origin"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown logic."""
    # Startup: Create database tables (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # Create GitHub API client with connection pooling
    # Only initialize if token is configured
    if settings.GITHUB_TOKEN:
        timeout = httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)
        limits = httpx.Limits(max_connections=10, max_keepalive_connections=5)

        app.state.github_http_client = httpx.AsyncClient(
            base_url="https://api.github.com",
            timeout=timeout,
            limits=limits,
            headers={
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Authorization": f"Bearer {settings.GITHUB_TOKEN}",
            },
        )
        # Also store the wrapped GitHubClient for convenience
        app.state.github_client = GitHubClient(app.state.github_http_client)
    else:
        app.state.github_http_client = None
        app.state.github_client = None

    # Register OAuth client if credentials configured
    if settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET:
        register_oauth_client(settings)

    yield

    # Shutdown: Close GitHub client
    if app.state.github_http_client:
        await app.state.github_http_client.aclose()

    # Shutdown: Dispose of connection pool
    await engine.dispose()


app = FastAPI(
    title="Ontology Hub",
    description="Backend API for Ontology Hub - Entity management and draft proposals",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False,  # Prevent 307 redirects with internal hostnames through proxy
)

# Add rate limiter to app state (required by SlowAPI)
app.state.limiter = limiter

# Register rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# SessionMiddleware must come before other middleware for OAuth
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    max_age=1800,  # 30 min - enough for OAuth flow
    same_site="lax",  # Required for OAuth redirects
)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware for development (configure appropriately for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include API routers
app.include_router(drafts_router, prefix="/api/v1")
app.include_router(entities_router, prefix="/api/v1")
app.include_router(modules_router, prefix="/api/v1")
app.include_router(oauth_router, prefix="/api/v1")
app.include_router(versions_router, prefix="/api/v1")
app.include_router(webhooks_router, prefix="/api/v1")

# v2.0 API routers
app.include_router(entities_v2_router, prefix="/api/v2")
app.include_router(graph_router, prefix="/api/v2")


@app.get("/health")
async def health_check():
    """Health endpoint confirming database connectivity."""
    async with async_session_maker() as session:
        # Actually query database to confirm connection
        result = await session.execute(text("SELECT 1"))
        result.scalar()
    return {"status": "healthy", "database": "connected"}


def get_github_client(request: Request) -> GitHubClient:
    """Get GitHubClient from app state.

    Raises:
        HTTPException: If GitHub token is not configured
    """
    if request.app.state.github_http_client is None:
        raise HTTPException(
            status_code=503,
            detail="GitHub integration not configured. Set GITHUB_TOKEN environment variable.",
        )
    return GitHubClient(request.app.state.github_http_client)


@app.post("/admin/sync")
async def trigger_sync(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Trigger full repository sync from GitHub.

    Fetches all entity, module, and profile files from the configured
    GitHub repository and upserts them into the database.

    Returns:
        Sync statistics including commit_sha, entities_synced, files_processed, errors
    """
    github_client = get_github_client(request)
    result = await sync_repository(
        github_client=github_client,
        session=session,
        owner=settings.GITHUB_REPO_OWNER,
        repo=settings.GITHUB_REPO_NAME,
    )
    return result
