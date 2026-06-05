# File: backend/app/models/schedule.py
"""
Artisan availability models.
- ArtisanSchedule: weekly recurring availability windows
- BlockedDate:     one-off days the artisan is unavailable
"""
import uuid
from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_compat import UUID

# Day-of-week constants (matches Python's date.weekday(): 0=Mon, 6=Sun)
DAYS = {
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
    5: "saturday",
    6: "sunday",
}


class ArtisanSchedule(Base):
    """Weekly recurring availability slot for an artisan."""
    __tablename__ = "artisan_schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artisan_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 0=Monday … 6=Sunday
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class BlockedDate(Base):
    """A specific date on which the artisan is unavailable (holiday / personal)."""
    __tablename__ = "artisan_blocked_dates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("artisan_profiles.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    blocked_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
