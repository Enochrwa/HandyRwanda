import uuid

from typing import Any

from sqlalchemy import String, TypeDecorator
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

# SQLite doesn't support UUID, JSONB, or ARRAY natively in the same way as Postgres.
# This shim allows the models to work on both.


class UUID(TypeDecorator[uuid.UUID]):
    """Platform-independent UUID type.
    Uses PostgreSQL's UUID type, otherwise uses String(32).
    """

    impl = String
    cache_ok = True

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__()

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID())
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return value
        else:
            return str(value)

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return value
        else:
            return uuid.UUID(value)


class JSONB(TypeDecorator[Any]):
    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_JSONB())
        else:
            return dialect.type_descriptor(String)


class ARRAY(TypeDecorator[Any]):
    impl = String
    cache_ok = True

    def __init__(self, item_type: Any) -> None:
        self.item_type = item_type
        super().__init__()

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_ARRAY(self.item_type))
        else:
            return dialect.type_descriptor(String)


# Mock Geography for SQLite
class Geography(TypeDecorator[Any]):
    impl = String
    cache_ok = True

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__()

    def load_dialect_impl(self, dialect: Any) -> Any:
        return dialect.type_descriptor(String)
