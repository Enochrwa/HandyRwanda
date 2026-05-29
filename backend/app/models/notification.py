import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func

from app.database import Base
from app.db_compat import JSONB, UUID


class Notification(Base):
    __tablename__ = "notifications"
    id: "Column[UUID]" = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )  # type: ignore[type-arg]
    user_id: "Column[UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    event_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(String, nullable=False)
    payload = Column(JSONB, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
