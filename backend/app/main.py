from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import SQLModel, text

from app.database import engine, async_session_maker
# Import all models to register them with SQLModel.metadata before create_all
from app.models import Entity, Module, Profile, Draft  # noqa: F401


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


@app.get("/health")
async def health_check():
    """Health endpoint confirming database connectivity."""
    async with async_session_maker() as session:
        # Actually query database to confirm connection
        result = await session.execute(text("SELECT 1"))
        result.scalar()
    return {"status": "healthy", "database": "connected"}
