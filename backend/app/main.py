from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from sqlmodel import SQLModel, text
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import engine, async_session_maker
from app.dependencies.rate_limit import limiter, rate_limit_exceeded_handler
# Import all models to register them with SQLModel.metadata before create_all
from app.models import Entity, Module, Profile, Draft  # noqa: F401
from app.routers import drafts_router


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
    yield
    # Shutdown: Dispose of connection pool
    await engine.dispose()


app = FastAPI(
    title="Ontology Hub",
    description="Backend API for Ontology Hub - Entity management and draft proposals",
    version="0.1.0",
    lifespan=lifespan,
)

# Add rate limiter to app state (required by SlowAPI)
app.state.limiter = limiter

# Register rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

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


@app.get("/health")
async def health_check():
    """Health endpoint confirming database connectivity."""
    async with async_session_maker() as session:
        # Actually query database to confirm connection
        result = await session.execute(text("SELECT 1"))
        result.scalar()
    return {"status": "healthy", "database": "connected"}
