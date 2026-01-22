"""Pytest configuration and fixtures for testing."""

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession


# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )
    # Import models to register metadata
    from app.models import Entity, Module, Profile, Draft  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    test_async_session_maker = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with test_async_session_maker() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_engine) -> AsyncGenerator[AsyncClient, None]:
    """Create test HTTP client with overridden dependencies."""
    from app.main import app
    from app.database import get_session, async_session_maker as prod_session_maker

    test_session_maker = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_session():
        async with test_session_maker() as session:
            yield session

    # Override database session
    app.dependency_overrides[get_session] = override_get_session

    # Initialize github_client to None for tests (can be overridden per-test)
    if not hasattr(app.state, "github_client"):
        app.state.github_client = None

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=True,  # Handle trailing slash redirects
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
    # Reset github_client after test
    app.state.github_client = None
