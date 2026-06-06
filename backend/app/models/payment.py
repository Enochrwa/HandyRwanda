# File: backend/app/models/payment.py
"""
Payment model — hybrid MTN MoMo / Airtel Money.

Phase 1 (now):  Manual — user sends money then submits proof.
                Admin verifies and approves/rejects.
Phase 2 (later): Automated — backend calls MTN/Airtel Collections API,
                 no admin step needed.  Field layout is identical;
                 api_reference and auto_verified flags are populated
                 instead of proof fields.

Status machine:
  initiated → pending_verification → approved → failed/refunded
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_compat import UUID


class PaymentMethod(str, enum.Enum):
    mtn_momo = "mtn_momo"
    airtel_money = "airtel_money"


class PaymentStatus(str, enum.Enum):
    initiated = "initiated"  # payment screen shown, user hasn't acted yet
    pending_verification = (
        "pending_verification"  # user submitted proof, awaiting admin
    )
    approved = "approved"  # admin (or future API) confirmed receipt
    rejected = "rejected"  # admin rejected proof
    refunded = "refunded"  # money sent back
    auto_verified = "auto_verified"  # future: API confirmed automatically


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False, unique=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # RWF
    method: Mapped[PaymentMethod | None] = mapped_column(
        Enum(PaymentMethod), nullable=True
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.initiated, nullable=False
    )

    # Reference code shown to user: "BOOK-XXXX"
    reference_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    # Receiver number displayed to user
    receiver_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Phase 1 — manual proof
    client_transaction_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    proof_screenshot_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proof_submitted_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    admin_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    verified_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Phase 2 — API (populated when MTN/Airtel API is integrated)
    api_request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    api_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    auto_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )
