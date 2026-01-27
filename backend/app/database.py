from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings

# Create async engine with postgresql+asyncpg:// URL
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)

# Async session factory
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide async database session per request with automatic cleanup."""
    async with async_session_maker() as session:
        yield session


# Type alias for dependency injection
SessionDep = Annotated[AsyncSession, Depends(get_session)]
