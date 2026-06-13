# File: backend/app/models/job.py
import enum
import uuid
from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_compat import ARRAY, UUID


class JobStatus(str, enum.Enum):
    open = "open"
    pending_bid = "pending_bid"
    booked = "booked"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    disputed = "disputed"


class JobUrgency(str, enum.Enum):
    flexible = "flexible"
    this_week = "this_week"
    tomorrow = "tomorrow"
    today = "today"
    urgent = "urgent"


class BidStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    countered_by_client = "countered_by_client"
    artisan_countered = "artisan_countered"
    negotiation_expired = "negotiation_expired"


class RecurringFrequency(str, enum.Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("ix_jobs_category_status", "category_id", "status"),
        Index("ix_jobs_client_created", "client_id", "created_at"),
        Index("ix_jobs_district_status", "district", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    additional_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    location_label: Mapped[str | None] = mapped_column(String(400), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    province: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cell: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village: Mapped[str | None] = mapped_column(String(100), nullable=True)
    street_road: Mapped[str | None] = mapped_column(String(200), nullable=True)
    house_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    landmark: Mapped[str | None] = mapped_column(String(200), nullable=True)
    scheduled_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    urgency: Mapped[JobUrgency] = mapped_column(Enum(JobUrgency), default=JobUrgency.flexible)
    budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget_negotiable: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.open)
    photos_urls: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    # Sprint 12: link back to the schedule that spawned this job
    recurring_schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recurring_schedules.id"), nullable=True
    )
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())


class Bid(Base):
    __tablename__ = "bids"
    __table_args__ = (
        Index("ix_bids_job_id", "job_id"),
        Index("ix_bids_artisan_status", "artisan_id", "status"),
        Index("ix_bids_negotiation_status", "status", "negotiation_round"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    artisan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=False)
    proposed_price: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str | None] = mapped_column(String(800), nullable=True)
    cover_letter: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proposed_start_time: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_duration_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[BidStatus] = mapped_column(Enum(BidStatus), default=BidStatus.pending)
    negotiation_round: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    counter_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    counter_message: Mapped[str | None] = mapped_column(String(300), nullable=True)
    counter_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    artisan_counter_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    artisan_counter_message: Mapped[str | None] = mapped_column(String(300), nullable=True)
    artisan_counter_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())


# ── Sprint 12: Recurring Job Schedule ────────────────────────────────────────

class RecurringSchedule(Base):
    """
    Defines a repeating job (e.g. clean my house every Saturday).
    APScheduler fires `spawn_session` at each `next_run_at`.
    """

    __tablename__ = "recurring_schedules"
    __table_args__ = (
        Index("ix_recurring_client_active", "client_id", "is_active"),
        Index("ix_recurring_next_run", "next_run_at", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # Preferred artisan from previous completed session (nullable = open bidding)
    preferred_artisan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # Address (Rwanda structured)
    district: Mapped[str] = mapped_column(String(100), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location_label: Mapped[str | None] = mapped_column(String(400), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Budget
    budget_per_session: Mapped[int] = mapped_column(Integer, nullable=False)
    # Recurrence
    frequency: Mapped[RecurringFrequency] = mapped_column(Enum(RecurringFrequency), nullable=False)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)   # 0=Mon, 6=Sun
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-28
    preferred_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    # State
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    next_run_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    total_sessions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Paused/cancelled tracking
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=func.now())
