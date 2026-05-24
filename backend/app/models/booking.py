import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class BookingStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    disputed = "disputed"


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    artisan_id = Column(
        UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=False
    )
    status: Column[BookingStatus] = Column(
        Enum(BookingStatus), default=BookingStatus.pending_payment
    )
    agreed_price = Column(Integer, nullable=False)
    before_photo_url = Column(String, nullable=True)
    after_photo_url = Column(String, nullable=True)
    before_photo_taken_at = Column(DateTime(timezone=True), nullable=True)
    auto_confirm_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
