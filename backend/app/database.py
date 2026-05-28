# File: backend/app/database.py
import os
from collections.abc import AsyncGenerator
from urllib.parse import parse_qs, urlparse, urlunparse

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
    # PostgreSQL is required - construct from individual env vars if DATABASE_URL not set
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "Munyaneza")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "EnochLabs")
    DB_NAME = os.getenv("DB_NAME", "handyrwanda")
    DATABASE_URL = (
        f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )


_is_sqlite = DATABASE_URL.startswith("sqlite")

# Parse URL to handle SSL parameters correctly for asyncpg
_connect_args = {"check_same_thread": False} if _is_sqlite else {}
if not _is_sqlite and DATABASE_URL.startswith("postgresql+asyncpg://"):
    # Parse the URL to extract query parameters
    parsed = urlparse(DATABASE_URL)
    query_params = parse_qs(parsed.query)

    # Handle sslmode parameter - convert to ssl parameter for asyncpg
    if "sslmode" in query_params:
        sslmode = query_params["sslmode"][0]
        # Convert sslmode to ssl parameter that asyncpg understands
        # For simplicity, we map require/verify-* to True and others to False
        # In production, you might want more sophisticated mapping
        if sslmode in ["require", "verify-ca", "verify-full"]:
            _connect_args["ssl"] = True
        else:
            _connect_args["ssl"] = False
        # Remove sslmode from query parameters to avoid passing it directly to asyncpg
        query_params.pop("sslmode", None)

    # Reconstruct URL without the query parameters we handled
    if query_params:
        # Rebuild query string with remaining parameters
        new_query = "&".join([f"{k}={v[0]}" for k, v in query_params.items()])
        new_parsed = parsed._replace(query=new_query)
        DATABASE_URL = urlunparse(new_parsed)
    else:
        # No query parameters left, remove the query part entirely
        new_parsed = parsed._replace(query="")
        DATABASE_URL = urlunparse(new_parsed)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=_connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create all tables (used in dev with SQLite)."""
    # Import models to ensure they are registered with Base
    from . import models  # noqa: F401, PLC0415

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
