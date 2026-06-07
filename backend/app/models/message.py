# File: backend/app/models/message.py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_compat import UUID


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        # Conversations list: filter by booking, sort by created_at
        Index("ix_messages_booking_created", "booking_id", "created_at"),
        # Unread count per booking per sender
        Index("ix_messages_booking_sender_read", "booking_id", "sender_id", "is_read"),
    )
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(String, nullable=False)
    translated_content: Mapped[str | None] = mapped_column(String, nullable=True)
    detected_lang: Mapped[str | None] = mapped_column(String(5), nullable=True)
    voice_note_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
