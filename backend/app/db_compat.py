import json
import uuid
from typing import Any

from sqlalchemy import Text, types
from sqlalchemy.engine.interfaces import Dialect

try:
    from sqlalchemy.dialects.postgresql import ARRAY as _PGA

    _has_pg = True
except ImportError:
    _has_pg = False

# SQLAlchemy <2.0 stubs don't support TypeDecorator[T]
_TypeDecoratorBase: Any = types.TypeDecorator


class UUID(_TypeDecoratorBase):
    impl = types.String
    cache_ok = True

    def __init__(self, as_uuid: bool = True) -> None:
        super().__init__(36)
        self.as_uuid = as_uuid

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return None
        if self.as_uuid:
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
