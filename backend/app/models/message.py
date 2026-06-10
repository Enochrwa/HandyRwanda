# File: backend/app/models/message.py
"""
Message model — Sprint 7 update: voice message support.

Changes vs previous:
  - content is now nullable (voice-only messages carry no text)
  - voice_note_duration_secs added for UI display without re-loading audio
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, func
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
    # Nullable for voice-only messages (Sprint 7)
    content: Mapped[str | None] = mapped_column(String, nullable=True)
    translated_content: Mapped[str | None] = mapped_column(String, nullable=True)
    detected_lang: Mapped[str | None] = mapped_column(String(5), nullable=True)
    voice_note_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # Duration in seconds — populated on upload, used by audio player UI
    voice_note_duration_secs: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    @property
    def is_voice_only(self) -> bool:
        """True when the message has no text content — only a voice note."""
        return bool(self.voice_note_url and not self.content)
