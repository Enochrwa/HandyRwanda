# File: backend/app/routers/payments.py
"""
Hybrid payment router — MTN MoMo & Airtel Money.

Phase 1 (now):   Manual verification flow.
Phase 2 (later): Replace _initiate_payment with real API calls.

POST   /payments/initiate/{booking_id}      — create payment record, return instructions
POST   /payments/{payment_id}/submit-proof  — client submits transaction ID / screenshot
GET    /payments/{payment_id}               — get payment status
GET    /payments/booking/{booking_id}       — get payment for a booking
"""

import os
import random
import string
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.integrations.supabase_storage import upload_image
from app.models.booking import Booking, BookingStatus
from app.models.notification import Notification
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.user import User, UserRole

router = APIRouter(prefix="/payments", tags=["payments"])

# ── Config ────────────────────────────────────────────────────────────────────

# These are the HandyRwanda business numbers clients send money TO.
# Replace with real registered numbers once business is registered.
RECEIVER_NUMBERS = {
    PaymentMethod.mtn_momo: os.getenv("MTN_MOMO_RECEIVER_NUMBER", "0788000000"),
    PaymentMethod.airtel_money: os.getenv("AIRTEL_MONEY_RECEIVER_NUMBER", "0730000000"),
}


def _generate_reference() -> str:
    """Generate unique booking reference like BOOK-A3X9."""
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"BOOK-{suffix}"


async def _notify(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    title: str,
    body: str,
    payload: dict[str, object] | None = None,
) -> None:
    n = Notification(
        user_id=user_id, event_type=event_type, title=title, body=body, payload=payload
    )
    db.add(n)


# ── Schemas ───────────────────────────────────────────────────────────────────


class InitiatePaymentRequest(BaseModel):
    method: PaymentMethod


class SubmitProofRequest(BaseModel):
    client_transaction_id: str = Field(
        ..., min_length=3, max_length=100, description="Transaction ID from MoMo SMS"
    )
    proof_screenshot_base64: str | None = Field(
        None, description="Optional base64 screenshot of payment confirmation"
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/initiate/{booking_id}", status_code=201)
async def initiate_payment(
    booking_id: UUID,
    payload: InitiatePaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """
    Create a payment record for the booking and return payment instructions.
    Phase 1: returns manual instructions.
    Phase 2: will trigger MTN/Airtel Collections API call here instead.
    """
    client_id = UUID(current_user["sub"])

    # Verify booking belongs to client
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.client_id == client_id,
            Booking.status == BookingStatus.pending_payment,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or not in pending_payment status.",
        )

    # Check no existing payment already initiated
    existing = await db.scalar(select(Payment).where(Payment.booking_id == booking_id))
    if existing:
        # Re-use existing payment record — idempotent
        return _payment_instructions(existing, payload.method)

    # Generate unique reference
    reference = _generate_reference()
    while await db.scalar(select(Payment).where(Payment.reference_code == reference)):
        reference = _generate_reference()

    payment = Payment(
        booking_id=booking_id,
        client_id=client_id,
        artisan_id=booking.artisan_id,
        amount=booking.agreed_price,
        method=payload.method,
        status=PaymentStatus.initiated,
        reference_code=reference,
        receiver_phone=RECEIVER_NUMBERS[payload.method],
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)

    return _payment_instructions(payment, payload.method)


def _payment_instructions(payment: Payment, method: PaymentMethod) -> dict[str, Any]:
    """Build the instructions object shown on the payment screen."""
    method_label = "MTN MoMo" if method == PaymentMethod.mtn_momo else "Airtel Money"
    return {
        "payment_id": str(payment.id),
        "reference_code": payment.reference_code,
        "amount": payment.amount,
        "method": method,
        "method_label": method_label,
        "receiver_phone": payment.receiver_phone,
        "status": payment.status,
        "instructions": [
            f"1. Open your {method_label} app or dial *182# (MTN) / *185# (Airtel)",
            "2. Select 'Send Money' → 'To Mobile Number'",
            f"3. Enter number: {payment.receiver_phone}",
            f"4. Enter amount: {payment.amount:,} RWF",
            f"5. Use reference/reason: {payment.reference_code}",
            "6. Confirm and note your transaction ID from the SMS",
            "7. Come back here and tap 'I've Sent the Payment'",
        ],
        "note": "Payment is verified within 5 minutes. "
        "Your booking is confirmed immediately after verification.",
    }


@router.post("/{payment_id}/submit-proof")
async def submit_proof(
    payment_id: UUID,
    payload: SubmitProofRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client submits transaction ID (and optional screenshot) after sending money."""
    client_id = UUID(current_user["sub"])

    payment = await db.scalar(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.client_id == client_id,
        )
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if payment.status not in (PaymentStatus.initiated, PaymentStatus.rejected):
        raise HTTPException(
            status_code=409,
            detail=f"Payment is already in '{payment.status}' status.",
        )

    screenshot_url: str | None = None
    if payload.proof_screenshot_base64:
        screenshot_url = await upload_image(
            payload.proof_screenshot_base64,
            f"payment-proofs/{payment_id}",
        )

    await db.execute(
        update(Payment)
        .where(Payment.id == payment_id)
        .values(
            status=PaymentStatus.pending_verification,
            client_transaction_id=payload.client_transaction_id,
            proof_screenshot_url=screenshot_url,
            proof_submitted_at=datetime.now(timezone.utc),
        )
    )

    # Notify admins (all admin users)
    admins_result = await db.execute(
        select(User).where(User.role == UserRole.admin, User.is_active)
    )
    for admin_user in admins_result.scalars().all():
        await _notify(
            db,
            admin_user.id,
            "payment_proof_submitted",
            "💰 Payment Proof Submitted",
            f"Booking {payment.reference_code}: {payment.amount:,} RWF via "
            f"{'MTN MoMo' if payment.method == PaymentMethod.mtn_momo else 'Airtel Money'}",
            {
                "payment_id": str(payment_id),
                "booking_id": str(payment.booking_id),
                "reference": payment.reference_code,
            },
        )

    await db.commit()
    return {
        "status": "pending_verification",
        "message": "Payment proof received. We'll verify within 5 minutes.",
        "reference_code": payment.reference_code,
    }


@router.get("/booking/{booking_id}")
async def get_payment_for_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """Get current payment status for a booking."""
    user_id = UUID(current_user["sub"])
    payment = await db.scalar(select(Payment).where(Payment.booking_id == booking_id))
    if not payment:
        return {"status": "not_initiated"}
    # Only client or artisan on this booking can view
    if str(payment.client_id) != str(user_id) and str(payment.artisan_id) != str(
        user_id
    ):
        raise HTTPException(status_code=403, detail="Forbidden.")

    return {
        "payment_id": str(payment.id),
        "booking_id": str(payment.booking_id),
        "amount": payment.amount,
        "method": payment.method,
        "status": payment.status,
        "reference_code": payment.reference_code,
        "receiver_phone": payment.receiver_phone,
        "client_transaction_id": payment.client_transaction_id,
        "proof_submitted_at": payment.proof_submitted_at,
        "admin_note": payment.admin_note,
        "created_at": payment.created_at,
    }


@router.get("/{payment_id}")
async def get_payment(
    payment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    payment = await db.scalar(select(Payment).where(Payment.id == payment_id))
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found.")
    if str(payment.client_id) != str(user_id) and str(payment.artisan_id) != str(
        user_id
    ):
        raise HTTPException(status_code=403, detail="Forbidden.")
    return {
        "payment_id": str(payment.id),
        "booking_id": str(payment.booking_id),
        "amount": payment.amount,
        "method": payment.method,
        "status": payment.status,
        "reference_code": payment.reference_code,
        "receiver_phone": payment.receiver_phone,
        "client_transaction_id": payment.client_transaction_id,
        "proof_submitted_at": payment.proof_submitted_at,
        "admin_note": payment.admin_note,
        "created_at": payment.created_at,
    }
