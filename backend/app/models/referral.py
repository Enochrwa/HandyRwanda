# File: backend/app/models/referral.py
import enum
import uuid

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_compat import UUID


class ReferralStatus(str, enum.Enum):
    registered = "registered"
    qualified = "qualified"


class Referral(Base):
    __tablename__ = "referrals"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    referrer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    referred_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    referral_code: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[ReferralStatus] = mapped_column(
        Enum(ReferralStatus), default=ReferralStatus.registered
    )
    created_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
