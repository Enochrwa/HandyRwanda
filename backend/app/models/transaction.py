import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class TransactionType(str, enum.Enum):
    payment_in = "payment_in"
    payout_out = "payout_out"
    commission = "commission"
    refund = "refund"


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    type: Column[TransactionType] = Column(Enum(TransactionType), nullable=False)
    status: Column[TransactionStatus] = Column(
        Enum(TransactionStatus), default=TransactionStatus.pending
    )
    momo_reference = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
