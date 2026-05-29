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
    if _DATABASE_URL.startswith("postgresql://"):
        _DATABASE_URL = _DATABASE_URL.replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )
    elif _DATABASE_URL.startswith("postgres://"):
        _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    DATABASE_URL = _DATABASE_URL
else:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_USER = os.getenv("DB_USER", "Munyaneza")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "EnochLabs")
    DB_NAME = os.getenv("DB_NAME", "handyrwanda")
    DATABASE_URL = (
        f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

_is_sqlite = DATABASE_URL.startswith("sqlite")

_connect_args: dict[str, object] = {"check_same_thread": False} if _is_sqlite else {}
if not _is_sqlite and DATABASE_URL.startswith("postgresql+asyncpg://"):
    parsed = urlparse(DATABASE_URL)
    query_params = parse_qs(parsed.query)

    if "sslmode" in query_params:
        sslmode = query_params["sslmode"][0]
        _connect_args["ssl"] = sslmode in ["require", "verify-ca", "verify-full"]
        query_params.pop("sslmode", None)

    if query_params:
        new_query = "&".join([f"{k}={v[0]}" for k, v in query_params.items()])
        DATABASE_URL = urlunparse(parsed._replace(query=new_query))
    else:
        DATABASE_URL = urlunparse(parsed._replace(query=""))

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
    """Create all tables."""
    from . import models  # noqa: F401, PLC0415

    async with engine.begin() as conn:  # type: ignore[no-untyped-call]
        await conn.run_sync(Base.metadata.create_all)
