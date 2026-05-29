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
    id: "Column[UUID]" = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )  # type: ignore[type-arg]
    referrer_id: "Column[UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    referred_id: "Column[UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    referral_code = Column(String(20), nullable=False)
    status: "Column[ReferralStatus]" = Column(  # type: ignore[type-arg]
        Enum(ReferralStatus), default=ReferralStatus.registered
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
