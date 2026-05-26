# File: backend/app/db_compat.py
"""
SQLAlchemy compatibility shims that make PostgreSQL-specific types work on SQLite.
"""
# ruff: noqa: PLC0415
import os
from typing import Any, Literal, overload

from sqlalchemy import JSON, String

_USE_PG = bool(os.getenv("DATABASE_URL"))

@overload
def UUID(as_uuid: Literal[True] = ...) -> Any: ...

@overload
def UUID(as_uuid: Literal[False]) -> Any: ...

def UUID(as_uuid: bool = True) -> Any:  # noqa: N802
    """PostgreSQL UUID → SQLite String(36)."""
    if _USE_PG:
        from sqlalchemy.dialects.postgresql import UUID as PG_UUID
        if as_uuid:
            return PG_UUID(as_uuid=True)
        return PG_UUID(as_uuid=False)
    return String(36)

def ARRAY(item_type: Any = None) -> Any:  # noqa: N802
    """PostgreSQL ARRAY → SQLite JSON."""
    if _USE_PG:
        from sqlalchemy import String as StringType  # noqa: N817
        from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
        return PG_ARRAY(item_type if item_type is not None else StringType)
    return JSON()

class _JSONBMeta(type):
    """Make JSONB usable as both Column(JSONB, ...) and Column(JSONB(), ...)."""

    def __instancecheck__(cls, instance: Any) -> bool:
        return super().__instancecheck__(instance)

    def _resolve(cls) -> Any:
        if _USE_PG:
            from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
            return PG_JSONB()
        return JSON()

    def __call__(cls, *args: Any, **kwargs: Any) -> Any:
        return cls._resolve()

class JSONB(metaclass=_JSONBMeta):  # noqa: N801
    """Transparent JSONB shim: works as Column(JSONB) or Column(JSONB())."""

def Geography(geometry_type: str = "POINT", srid: int = 4326) -> Any:  # noqa: N802
    """GeoAlchemy2 Geography → SQLite String (store as 'lon,lat')."""
    if _USE_PG:
        from geoalchemy2 import Geography as Geo
        return Geo(geometry_type=geometry_type, srid=srid)
    return String(50)
