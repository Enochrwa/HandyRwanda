# File: backend/app/database.py
import os
from collections.abc import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

_DATABASE_URL = os.getenv("DATABASE_URL", "")

if _DATABASE_URL:
    # Production / staging: PostgreSQL
    if _DATABASE_URL.startswith("postgresql://"):
        _DATABASE_URL = _DATABASE_URL.replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )
    elif _DATABASE_URL.startswith("postgres://"):
        _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    DATABASE_URL = _DATABASE_URL
else:
    # Local dev fallback: SQLite (no extra infrastructure needed)
    _db_path = os.path.join(os.path.dirname(__file__), "..", "handyrwanda_dev.db")
    DATABASE_URL = f"sqlite+aiosqlite:///{os.path.abspath(_db_path)}"


_is_sqlite = DATABASE_URL.startswith("sqlite")

_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=_connect_args)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass




async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create all tables (used in dev with SQLite)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
