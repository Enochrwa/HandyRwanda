import asyncio
import os
from urllib.parse import parse_qs, urlparse, urlunparse

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import (
    async_engine_from_config,  # type: ignore[attr-defined]
)

from app.database import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    from logging.config import fileConfig

    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def do_run_migrations_sync(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def do_run_migrations() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    configuration = config.get_section(config.config_ini_section)
    if configuration is None:
        configuration = {}

    url: str | None = os.getenv("DATABASE_URL")
    if not url:
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "5432")
        db_user = os.getenv("DB_USER", "Munyaneza")
        db_password = os.getenv("DB_PASSWORD", "EnochLabs")
        db_name = os.getenv("DB_NAME", "handyrwanda")
        url = f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Handle sslmode parameter for asyncpg compatibility
    if url and url.startswith("postgresql+asyncpg://"):
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)

        # Handle sslmode parameter - convert to ssl parameter for asyncpg
        if "sslmode" in query_params:
            sslmode = query_params["sslmode"][0]
            # Convert sslmode to ssl parameter that asyncpg understands
            # For simplicity, we map require/verify-* to True and others to False
            if sslmode in ["require", "verify-ca", "verify-full"]:
                configuration["sqlalchemy.engine_kwargs"] = {  # type: ignore[assignment]
                    "connect_args": {"ssl": True}
                }
            else:
                configuration["sqlalchemy.engine_kwargs"] = {  # type: ignore[assignment]
                    "connect_args": {"ssl": False}
                }
            # Remove sslmode from query parameters to avoid passing it directly to asyncpg
            query_params.pop("sslmode", None)

        # Reconstruct URL without the query parameters we handled
        if query_params:
            # Rebuild query string with remaining parameters
            new_query = "&".join([f"{k}={v[0]}" for k, v in query_params.items()])
            new_parsed = parsed._replace(query=new_query)
            url = urlunparse(new_parsed)
        else:
            # No query parameters left, remove the query part entirely
            new_parsed = parsed._replace(query="")
            url = urlunparse(new_parsed)

    configuration["sqlalchemy.url"] = url or ""

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations_sync)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    asyncio.run(do_run_migrations())


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url: str = os.getenv("DATABASE_URL", "")
    if not url:
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "5432")
        db_user = os.getenv("DB_USER", "Munyaneza")
        db_password = os.getenv("DB_PASSWORD", "EnochLabs")
        db_name = os.getenv("DB_NAME", "handyrwanda")
        url = f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
