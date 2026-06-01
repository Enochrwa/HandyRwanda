# File: backend/app/models/job.py
import enum
import uuid

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
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


class BidStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class JobType(str, enum.Enum):
    one_time = "one_time"
    recurring = "recurring"
    emergency = "emergency"


class UrgencyLevel(str, enum.Enum):
    flexible = "flexible"
    this_week = "this_week"
    tomorrow = "tomorrow"
    today = "today"
    urgent = "urgent"


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
    description: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    location_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    latitude: Mapped[float | None] = mapped_column(
        __import__("sqlalchemy").Float, nullable=True
    )
    longitude: Mapped[float | None] = mapped_column(
        __import__("sqlalchemy").Float, nullable=True
    )
    scheduled_time: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    job_type: Mapped[JobType] = mapped_column(
        Enum(JobType), default=JobType.one_time, nullable=False
    )
    urgency: Mapped[UrgencyLevel] = mapped_column(
        Enum(UrgencyLevel), default=UrgencyLevel.flexible, nullable=False
    )
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.open)
    photos_urls: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    special_requirements: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_remote_possible: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
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
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    estimated_duration_hours: Mapped[float | None] = mapped_column(
        __import__("sqlalchemy").Float, nullable=True
    )
    proposed_start_time: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[BidStatus] = mapped_column(
        Enum(BidStatus), default=BidStatus.pending
    )
    created_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
