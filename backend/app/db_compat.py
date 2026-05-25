# File: backend/app/db_compat.py
"""
SQLAlchemy compatibility shims that make PostgreSQL-specific types work on SQLite.
Import from here instead of sqlalchemy.dialects.postgresql for portable models.

Usage in models is identical to the PG originals:
    from app.db_compat import UUID, ARRAY, JSONB, Geography
    id = Column(UUID(as_uuid=True), ...)
    tags = Column(ARRAY(String), ...)
    data = Column(JSONB, ...)
    loc = Column(Geography("POINT", 4326), ...)
"""

import os
from typing import Any

from sqlalchemy import JSON, String
from sqlalchemy.types import TypeEngine

_USE_PG = bool(os.getenv("DATABASE_URL"))


def UUID(as_uuid: bool = True) -> TypeEngine[Any]:  # noqa: N802
    """PostgreSQL UUID → SQLite String(36)."""
    if _USE_PG:
        from sqlalchemy.dialects.postgresql import UUID as PG_UUID  # noqa: PLC0415

        return PG_UUID(as_uuid=as_uuid)
    return String(36)


def ARRAY(item_type: TypeEngine[Any] | None = None) -> TypeEngine[Any]:  # noqa: N802
    """PostgreSQL ARRAY → SQLite JSON."""
    if _USE_PG:
        from sqlalchemy import String as StringType  # noqa: PLC0415, N817
        from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY  # noqa: PLC0415

        return PG_ARRAY(item_type if item_type is not None else StringType)
    return JSON()


class _JSONBMeta(type):
    """Make JSONB usable as both Column(JSONB, ...) and Column(JSONB(), ...)."""

    def __instancecheck__(cls, instance: Any) -> bool:
        return super().__instancecheck__(instance)

    def _resolve(cls) -> TypeEngine[Any]:
        if _USE_PG:
            from sqlalchemy.dialects.postgresql import (  # noqa: PLC0415
                JSONB as PG_JSONB,
            )

            return PG_JSONB()
        return JSON()

    def __call__(cls, *args: Any, **kwargs: Any) -> TypeEngine[Any]:  # type: ignore[override]
        return cls._resolve()

    def __instancecheck__(cls, instance: Any) -> bool:  # noqa: F811
        return super().__instancecheck__(instance)


class JSONB(metaclass=_JSONBMeta):  # noqa: N801
    """Transparent JSONB shim: works as Column(JSONB) or Column(JSONB())."""


def Geography(  # noqa: N802
    geometry_type: str = "POINT", srid: int = 4326
) -> TypeEngine[Any]:
    """GeoAlchemy2 Geography → SQLite String (store as 'lon,lat')."""
    if _USE_PG:
        from geoalchemy2 import Geography as Geo  # noqa: PLC0415

        return Geo(geometry_type=geometry_type, srid=srid)
    return String(50)
