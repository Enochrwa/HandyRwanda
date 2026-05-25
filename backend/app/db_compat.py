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

_USE_PG = bool(os.getenv("DATABASE_URL"))


def UUID(as_uuid: bool = True):  # noqa: N802
    """PostgreSQL UUID → SQLite String(36)."""
    if _USE_PG:
        from sqlalchemy.dialects.postgresql import UUID as PG_UUID  # noqa: PLC0415

        return PG_UUID(as_uuid=as_uuid)
    from sqlalchemy import String  # noqa: PLC0415

    return String(36)


def ARRAY(item_type=None):  # noqa: N802
    """PostgreSQL ARRAY → SQLite JSON."""
    if _USE_PG:
        from sqlalchemy import String as StringType  # noqa: PLC0415, N817
        from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY  # noqa: PLC0415

        return PG_ARRAY(item_type if item_type is not None else StringType)
    from sqlalchemy import JSON  # noqa: PLC0415

    return JSON()


class _JSONBMeta(type):
    """Make JSONB usable as both Column(JSONB, ...) and Column(JSONB(), ...)."""

    def __instancecheck__(cls, instance):
        return super().__instancecheck__(instance)

    def _resolve(cls):
        if _USE_PG:
            from sqlalchemy.dialects.postgresql import (  # noqa: PLC0415
                JSONB as PG_JSONB,
            )

            return PG_JSONB()
        from sqlalchemy import JSON  # noqa: PLC0415

        return JSON()

    # Called when used as Column(JSONB, ...) — SQLAlchemy internally calls type_()
    def __call__(cls, *args, **kwargs):  # type: ignore[override]
        return cls._resolve()

    # SQLAlchemy may also do isinstance checks against the type
    def __instancecheck__(cls, instance):  # noqa: F811
        return super().__instancecheck__(instance)


class JSONB(metaclass=_JSONBMeta):  # noqa: N801
    """Transparent JSONB shim: works as Column(JSONB) or Column(JSONB())."""


def Geography(geometry_type: str = "POINT", srid: int = 4326):  # noqa: N802
    """GeoAlchemy2 Geography → SQLite String (store as 'lon,lat')."""
    if _USE_PG:
        from geoalchemy2 import Geography as Geo  # noqa: PLC0415

        return Geo(geometry_type=geometry_type, srid=srid)
    from sqlalchemy import String  # noqa: PLC0415

    return String(50)
