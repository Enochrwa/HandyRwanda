import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, func

from app.database import Base
from app.db_compat import UUID


class Message(Base):
    __tablename__ = "messages"
    id: "Column[uuid.UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: "Column[uuid.UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False
    )
    sender_id: "Column[uuid.UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    content = Column(String, nullable=False)
    translated_content = Column(String, nullable=True)
    voice_note_url = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
