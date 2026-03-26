"""
Async SQLAlchemy engine + session factory
Auto-converts Railway's postgresql:// URL to postgresql+asyncpg://
"""
import re
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def _fix_db_url(url: str) -> str:
    """
    Railway provides DATABASE_URL as postgresql:// or postgres://
    SQLAlchemy asyncpg requires postgresql+asyncpg://
    """
    url = re.sub(r'^postgres://', 'postgresql+asyncpg://', url)
    url = re.sub(r'^postgresql://', 'postgresql+asyncpg://', url)
    return url


_db_url = _fix_db_url(settings.DATABASE_URL)

engine = create_async_engine(
    _db_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Called at startup — skips migrations in production (use CLI instead)"""
    if settings.ENV == "development":
        from alembic.config import Config
        from alembic import command
        import asyncio, concurrent.futures

        def run_migrations():
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, "head")

        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            await loop.run_in_executor(pool, run_migrations)
