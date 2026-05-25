# File: backend/app/db_compat.py
"""
SQLAlchemy compatibility shims that make PostgreSQL-specific types work on SQLite.
"""
import os
from typing import Any

from sqlalchemy import JSON, String

_USE_PG = bool(os.getenv("DATABASE_URL"))

def UUID(as_uuid: bool = True) -> Any:  # noqa: N802
    if _USE_PG:
        from sqlalchemy.dialects.postgresql import UUID as PG_UUID  # noqa: PLC0415
        if as_uuid:
            return PG_UUID(as_uuid=True)
        return PG_UUID(as_uuid=False)
    return String(36)

def ARRAY(item_type: Any = None) -> Any:  # noqa: N802
    if _USE_PG:
        from sqlalchemy import String as StringType  # noqa: PLC0415, N817
        from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY  # noqa: PLC0415
        return PG_ARRAY(item_type if item_type is not None else StringType)
    return JSON()

class _JSONBMeta(type):
    def __instancecheck__(cls, instance: Any) -> bool:
        return super().__instancecheck__(instance)

    def _resolve(cls) -> Any:
        if _USE_PG:
            from sqlalchemy.dialects.postgresql import (
                JSONB as PG_JSONB,  # noqa: PLC0415
            )
            return PG_JSONB()
        return JSON()

    def __call__(cls, *args: Any, **kwargs: Any) -> Any:
        return cls._resolve()

class JSONB(metaclass=_JSONBMeta):  # noqa: N801
    """Transparent JSONB shim."""

def Geography(geometry_type: str = "POINT", srid: int = 4326) -> Any:  # noqa: N802
    if _USE_PG:
        from geoalchemy2 import Geography as Geo  # noqa: PLC0415
        return Geo(geometry_type=geometry_type, srid=srid)
    return String(50)
