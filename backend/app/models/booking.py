# File: backend/app/models/booking.py
"""
Booking model with full Sprint 1 lifecycle:

pending_payment
  → confirmed        (payment verified)
  → artisan_accepted (artisan taps Accept — 15-min window)
  → artisan_en_route (artisan taps "On my way")
  → arrived          (artisan taps "I've arrived")
  → in_progress      (artisan taps "Start Job")
  → completed        (client taps "Mark complete")
  → cancelled / disputed (any point)
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_compat import UUID


class BookingStatus(str, enum.Enum):
    pending_payment  = "pending_payment"
    confirmed        = "confirmed"
    artisan_accepted = "artisan_accepted"   # Sprint 1 — artisan tapped Accept
    artisan_en_route = "artisan_en_route"   # Sprint 1 — artisan is travelling
    arrived          = "arrived"            # Sprint 1 — artisan at job site
    in_progress      = "in_progress"
    completed        = "completed"
    cancelled        = "cancelled"
    disputed         = "disputed"


class CancelledBy(str, enum.Enum):
    client  = "client"
    artisan = "artisan"
    system  = "system"


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_bookings_client_status",  "client_id",  "status"),
        Index("ix_bookings_artisan_status", "artisan_id", "status"),
        Index("ix_bookings_job_id",         "job_id"),
        Index("ix_bookings_status_created", "status",     "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=False
    )

    # ── Core fields ──────────────────────────────────────────────────────────
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="bookingstatus"),
        default=BookingStatus.pending_payment,
        nullable=False,
    )
    agreed_price: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Sprint 1: ETA & tracking timestamps ─────────────────────────────────
    eta_minutes:   Mapped[int | None]      = mapped_column(Integer,              nullable=True)
    started_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    arrived_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    en_route_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Sprint 1: cancellation tracking ─────────────────────────────────────
    cancelled_by: Mapped[CancelledBy | None] = mapped_column(
        Enum(CancelledBy, name="cancelledby"), nullable=True
    )
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ── Existing fields ──────────────────────────────────────────────────────
    before_photo_url:     Mapped[str | None] = mapped_column(String,              nullable=True)
    after_photo_url:      Mapped[str | None] = mapped_column(String,              nullable=True)
    before_photo_taken_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_confirm_at:      Mapped[str | None]  = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )
