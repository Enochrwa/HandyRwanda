# File: backend/app/routers/disputes.py
"""
Dispute management router with evidence collection.

POST /disputes/{booking_id}/evidence     — submit evidence (photo URL or statement)
GET  /disputes/{booking_id}/evidence     — list all evidence for a dispute
GET  /disputes/{booking_id}/timeline     — full dispute timeline (admin)
POST /disputes/{booking_id}/resolve      — admin: resolve dispute
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.booking import Booking, BookingStatus
from app.models.escrow import (
    DisputeEvidence,
    DisputeEvidenceType,
    EscrowStatus,
    EscrowTransaction,
)
from app.models.message import Message
from app.models.notification import Notification
from app.models.user import User, UserRole

router = APIRouter(prefix="/disputes", tags=["disputes"])

EVIDENCE_WINDOW_HOURS = 72


class EvidenceSubmit(BaseModel):
    evidence_type: DisputeEvidenceType
    content: str = Field(..., min_length=1, max_length=2000)


class DisputeResolvePayload(BaseModel):
    winner: str = Field(..., description='"client" or "artisan"')
    notes: str | None = None


@router.post("/{booking_id}/evidence", status_code=201)
async def submit_evidence(
    booking_id: UUID,
    payload: EvidenceSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
            Booking.status == BookingStatus.disputed,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Disputed booking not found or you are not a party to this booking.",
        )
    evidence = DisputeEvidence(
        booking_id=booking_id,
        submitted_by=user_id,
        evidence_type=payload.evidence_type,
        content=payload.content,
    )
    db.add(evidence)
    await db.commit()
    return {"message": "Evidence submitted successfully.", "id": str(evidence.id)}


@router.get("/{booking_id}/evidence")
async def get_evidence(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    role = current_user["role"]
    if role != UserRole.admin:
        booking = await db.scalar(
            select(Booking).where(
                Booking.id == booking_id,
                or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
            )
        )
        if not booking:
            raise HTTPException(status_code=403, detail="Access denied.")
    result = await db.execute(
        select(DisputeEvidence, User)
        .join(User, DisputeEvidence.submitted_by == User.id)
        .where(DisputeEvidence.booking_id == booking_id)
        .order_by(DisputeEvidence.created_at.asc())
    )
    return [
        {
            "id": str(e.id),
            "evidence_type": e.evidence_type,
            "content": e.content,
            "submitted_by_id": str(e.submitted_by),
            "submitted_by_name": u.full_name,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e, u in result.all()
    ]


@router.get("/{booking_id}/timeline")
async def get_dispute_timeline(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    from app.models.job import Job  # noqa: PLC0415
    from app.models.payment import Payment  # noqa: PLC0415

    booking_result = await db.execute(
        select(Booking, Job)
        .join(Job, Booking.job_id == Job.id)
        .where(Booking.id == booking_id)
    )
    row = booking_result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking, job = row

    messages_result = await db.execute(
        select(Message, User)
        .join(User, Message.sender_id == User.id)
        .where(Message.booking_id == booking_id)
        .order_by(Message.sent_at.asc())
        .limit(100)
    )
    messages = [
        {
            "sender_name": u.full_name,
            "content": m.content,
            "sent_at": m.sent_at.isoformat() if m.sent_at else None,
        }
        for m, u in messages_result.all()
    ]

    evidence_result = await db.execute(
        select(DisputeEvidence, User)
        .join(User, DisputeEvidence.submitted_by == User.id)
        .where(DisputeEvidence.booking_id == booking_id)
        .order_by(DisputeEvidence.created_at.asc())
    )
    evidence = [
        {
            "type": e.evidence_type,
            "content": e.content,
            "submitted_by": u.full_name,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e, u in evidence_result.all()
    ]

    payment = await db.scalar(select(Payment).where(Payment.booking_id == booking_id))
    client = await db.scalar(select(User).where(User.id == booking.client_id))
    artisan = await db.scalar(select(User).where(User.id == booking.artisan_id))

    return {
        "booking": {
            "id": str(booking.id),
            "status": booking.status,
            "agreed_price": booking.agreed_price,
            "before_photo_url": booking.before_photo_url,
            "after_photo_url": booking.after_photo_url,
            "created_at": booking.created_at.isoformat()
            if booking.created_at
            else None,
        },
        "job": {
            "title": job.title,
            "description": job.description,
            "location_label": job.location_label,
        },
        "client": {
            "name": client.full_name if client else None,
            "phone": client.phone_number if client else None,
        },
        "artisan": {
            "name": artisan.full_name if artisan else None,
            "phone": artisan.phone_number if artisan else None,
        },
        "payment": {
            "amount": payment.amount if payment else None,
            "status": payment.status if payment else None,
            "proof_url": payment.proof_screenshot_url if payment else None,
        },
        "messages": messages,
        "evidence": evidence,
        "evidence_deadline": (
            datetime.now(timezone.utc) + timedelta(hours=EVIDENCE_WINDOW_HOURS)
        ).isoformat(),
    }


@router.post("/{booking_id}/resolve")
async def resolve_dispute(
    booking_id: UUID,
    payload: DisputeResolvePayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    from app.services.escrow_service import release_escrow  # noqa: PLC0415

    if payload.winner not in ("client", "artisan"):
        raise HTTPException(
            status_code=400, detail='winner must be "client" or "artisan"'
        )

    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.status == BookingStatus.disputed,
        )
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Disputed booking not found.")

    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(
            status=BookingStatus.completed
            if payload.winner == "artisan"
            else BookingStatus.cancelled
        )
    )

    winner_id = booking.artisan_id if payload.winner == "artisan" else booking.client_id
    loser_id = booking.client_id if payload.winner == "artisan" else booking.artisan_id

    if payload.winner == "artisan":
        await release_escrow(db, booking_id, released_by="admin")
    else:
        await db.execute(
            update(EscrowTransaction)
            .where(EscrowTransaction.booking_id == booking_id)
            .values(status=EscrowStatus.refunded, released_by="admin")
        )

    db.add(
        Notification(
            user_id=winner_id,
            event_type="dispute_resolved_win",
            title="Dispute resolved in your favour ✅",
            body=f"The dispute has been resolved in your favour. {payload.notes or ''}",
            payload={
                "booking_id": str(booking_id),
                "event_type": "dispute_resolved_win",
            },
        )
    )
    db.add(
        Notification(
            user_id=loser_id,
            event_type="dispute_resolved_loss",
            title="Dispute outcome",
            body=f"The dispute was resolved. {payload.notes or 'Contact support for details.'}",
            payload={
                "booking_id": str(booking_id),
                "event_type": "dispute_resolved_loss",
            },
        )
    )

    await db.commit()
    return {"message": f"Dispute resolved. Winner: {payload.winner}."}
