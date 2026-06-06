# File: backend/app/models/escrow.py
"""
Escrow / earnings models.

EscrowTransaction: tracks hold → release lifecycle for a booking payment.
ArtisanEarnings:   aggregated earnings ledger per artisan.
WithdrawalRequest: artisan payout request (manual MoMo process).
DisputeEvidence:   evidence submitted during a dispute.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_compat import UUID


class EscrowStatus(str, enum.Enum):
    held = "held"  # payment received, job not yet complete
    released = "released"  # payment released to artisan
    refunded = "refunded"  # payment refunded to client
    disputed = "disputed"  # under dispute, hold extended


class EscrowTransaction(Base):
    """
    Tracks the hold-and-release lifecycle of a booking payment.
    Created when admin approves a payment; released 48h after job completion.
    """

    __tablename__ = "escrow_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False, unique=True
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # RWF
    status: Mapped[EscrowStatus] = mapped_column(
        Enum(EscrowStatus), default=EscrowStatus.held, nullable=False
    )
    held_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # When to auto-release if client doesn't respond
    release_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    released_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    released_by: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,  # "client", "auto", "admin"
    )
    notes: Mapped[str | None] = mapped_column(String(300), nullable=True)


class WithdrawalStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    paid = "paid"
    rejected = "rejected"


class WithdrawalRequest(Base):
    """Artisan requests payout; admin manually sends via MoMo and marks paid."""

    __tablename__ = "withdrawal_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # RWF
    momo_number: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[WithdrawalStatus] = mapped_column(
        Enum(WithdrawalStatus), default=WithdrawalStatus.pending
    )
    admin_note: Mapped[str | None] = mapped_column(String(300), nullable=True)
    processed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class DisputeEvidenceType(str, enum.Enum):
    photo = "photo"
    statement = "statement"
    receipt = "receipt"


class DisputeEvidence(Base):
    """Evidence submitted by either party during a booking dispute."""

    __tablename__ = "dispute_evidence"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False, index=True
    )
    submitted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    evidence_type: Mapped[DisputeEvidenceType] = mapped_column(
        Enum(DisputeEvidenceType), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)  # URL or text
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
