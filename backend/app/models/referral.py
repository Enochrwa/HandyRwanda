import enum
import uuid

from sqlalchemy import Column, DateTime, Enum, ForeignKey, String, func

from app.database import Base
from app.db_compat import UUID


class ReferralStatus(str, enum.Enum):
    registered = "registered"
    qualified = "qualified"


class Referral(Base):
    __tablename__ = "referrals"
    id: "Column" = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id: "Column" = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    referred_id: "Column" = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    referral_code = Column(String(20), nullable=False)
    status: "Column" = Column(Enum(ReferralStatus), default=ReferralStatus.registered)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
