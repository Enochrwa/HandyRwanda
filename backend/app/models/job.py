# File: backend/app/models/job.py
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
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
    urgent = "urgent"  # within 2 hours


class BidStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # Free-text extra context: materials needed, access instructions, etc.
    additional_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    location_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    scheduled_time: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # How quickly the client needs this done
    urgency: Mapped[JobUrgency] = mapped_column(
        Enum(JobUrgency), default=JobUrgency.flexible
    )
    budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Whether client is open to negotiate above budget
    budget_negotiable: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.open)
    photos_urls: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )


class Bid(Base):
    __tablename__ = "bids"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=False
    )
    proposed_price: Mapped[int] = mapped_column(Integer, nullable=False)
    message: Mapped[str | None] = mapped_column(String(800), nullable=True)
    # Additional pitch: why this artisan is right for the job
    cover_letter: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proposed_start_time: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    estimated_duration_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[BidStatus] = mapped_column(
        Enum(BidStatus), default=BidStatus.pending
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
