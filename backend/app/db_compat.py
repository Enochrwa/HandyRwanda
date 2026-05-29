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


class UUID(types.TypeDecorator[Any]):
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


class ARRAY(types.TypeDecorator[Any]):
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


class Geography(types.TypeDecorator[Any]):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        return value


class JSONB(types.TypeDecorator[Any]):
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
