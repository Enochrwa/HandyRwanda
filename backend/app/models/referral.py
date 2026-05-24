import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ReferralStatus(str, enum.Enum):
    registered = "registered"
    qualified = "qualified"


class Referral(Base):
    __tablename__ = "referrals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    referred_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    referral_code = Column(String(20), nullable=False)
    status: Column[ReferralStatus] = Column(
        Enum(ReferralStatus), default=ReferralStatus.registered
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
