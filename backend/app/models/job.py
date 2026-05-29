import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, func

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


class Job(Base):
    __tablename__ = "jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category_id = Column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False
    )
    title = Column(String(200), nullable=False)
    description = Column(String, nullable=False)
    location = Column(String, nullable=True)
    location_label = Column(String(200), nullable=True)
    scheduled_time = Column(DateTime(timezone=True), nullable=True)
    budget = Column(Integer, nullable=True)
    status = Column(Enum(JobStatus), default=JobStatus.open)
    photos_urls = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Bid(Base):
    __tablename__ = "bids"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    artisan_id = Column(
        UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=False
    )
    proposed_price = Column(Integer, nullable=False)
    message = Column(String(500), nullable=True)
    proposed_start_time = Column(DateTime(timezone=True), nullable=True)
    status = Column(Enum(BidStatus), default=BidStatus.pending)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
