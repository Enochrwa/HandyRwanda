import json
import uuid
from typing import Any

from sqlalchemy import Text, types
from sqlalchemy.engine.interfaces import Dialect

try:
    from sqlalchemy.dialects.postgresql import ARRAY as _PGA
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID

    _has_pg = True
except ImportError:
    _has_pg = False

# SQLAlchemy <2.0 stubs don't support TypeDecorator[T]
_TypeDecoratorBase: Any = types.TypeDecorator


class UUID(_TypeDecoratorBase):
    """
    Platform-aware UUID column type.

    On PostgreSQL: delegates to the native pg UUID type so that SQLAlchemy
    generates ``$1::UUID`` (not ``$1::VARCHAR``) in WHERE clauses, which
    avoids the "operator does not exist: uuid = character varying" error.

    On SQLite / other dialects: stores as a 36-char VARCHAR string.
    """

    impl = types.String  # fallback for non-PG dialects
    cache_ok = True

    def __init__(self, as_uuid: bool = True) -> None:
        super().__init__(36)
        self.as_uuid = as_uuid

    # ------------------------------------------------------------------
    # Override load_dialect_impl so that on PostgreSQL we use the real
    # pg UUID type, which produces the correct cast in generated SQL.
    # ------------------------------------------------------------------
    def load_dialect_impl(self, dialect: Dialect) -> Any:
        if _has_pg and dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=self.as_uuid))
        return dialect.type_descriptor(types.String(36))

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        if _has_pg and dialect.name == "postgresql":
            # Let the native PG type handle it; just make sure it's a UUID obj
            if isinstance(value, str):
                return uuid.UUID(value)
            return value
        return str(value)

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        if self.as_uuid:
            if isinstance(value, uuid.UUID):
                return value
            return uuid.UUID(str(value))
        return value


class ARRAY(_TypeDecoratorBase):
    impl = Text
    cache_ok = True

    def __init__(self, item_type: Any) -> None:
        super().__init__()
        self._item_type = item_type
        if _has_pg:
            self.impl = _PGA(item_type)  # type: ignore[assignment]

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        return value


class Geography(_TypeDecoratorBase):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        return value


class JSONB(_TypeDecoratorBase):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        return json.dumps(value)

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        return json.loads(value)
