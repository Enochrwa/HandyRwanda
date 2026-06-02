# File: backend/app/routers/bookings.py
"""
Bookings router — full lifecycle management.

GET    /bookings/upcoming           — upcoming bookings for current user
GET    /bookings                    — all bookings for current user
GET    /bookings/{id}               — single booking detail
POST   /bookings/{id}/confirm-payment   — client confirms they sent MoMo payment
POST   /bookings/{id}/confirm-receipt   — artisan confirms they received payment → moves to in_progress
POST   /bookings/{id}/complete          — client marks job as complete
POST   /bookings/{id}/dispute           — either party raises dispute
POST   /bookings/{id}/cancel            — cancel booking
PATCH  /bookings/{id}/status            — admin: set arbitrary status
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
from app.models.job import Job
from app.routers.notifications import notify_and_push
from app.models.user import User, UserRole

router = APIRouter(prefix="/bookings", tags=["bookings"])


# ── Helpers ──────────────────────────────────────────────────────────────────




# ── Endpoints ─────────────────────────────────────────────────────────────────




class DirectBookingCreate(BaseModel):
    job_id: UUID
    artisan_id: UUID
    agreed_price: int = Field(..., ge=500, description="Agreed price in RWF")


@router.post("", status_code=201)
async def create_direct_booking(
    payload: DirectBookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client creates a direct booking with a specific artisan (bypasses bidding)."""
    user_id = UUID(current_user["sub"])

    # Verify job belongs to this client and is open
    job = await db.scalar(
        select(Job).where(Job.id == payload.job_id, Job.client_id == user_id)
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status not in (JobStatus.open, JobStatus.pending_bid):
        raise HTTPException(status_code=400, detail="Job is no longer available for booking.")

    # Verify artisan exists
    artisan = await db.scalar(
        select(User).where(User.id == payload.artisan_id, User.role == UserRole.artisan)
    )
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan not found.")

    # Close job to other bids
    job.status = JobStatus.booked

    booking = Booking(
        job_id=payload.job_id,
        client_id=user_id,
        artisan_id=payload.artisan_id,
        status=BookingStatus.pending_payment,
        agreed_price=payload.agreed_price,
    )
    db.add(booking)
    await db.flush()

    client = await db.scalar(select(User).where(User.id == user_id))
    client_name = client.full_name if client else "A client"
    await notify_and_push(
        db,
        payload.artisan_id,
        "booking_request",
        f"New booking request from {client_name} 🔔",
        f"{client_name} wants to book you directly for '{job.title}'. Agreed price: {payload.agreed_price:,} RWF.",
        {"booking_id": str(booking.id), "job_id": str(payload.job_id)},
    )
    await db.commit()
    return {
        "id": str(booking.id),
        "job_id": str(booking.job_id),
        "artisan_id": str(booking.artisan_id),
        "status": booking.status,
        "agreed_price": booking.agreed_price,
        "message": "Booking request sent! The artisan will confirm soon.",
    }


@router.get("/upcoming")
async def get_upcoming_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])

    query = (
        select(
            Booking,
            Job,
            User.full_name.label("artisan_name"),
            User.avatar_url.label("artisan_avatar"),
        )
        .join(Job, Booking.job_id == Job.id)
        .join(User, Booking.artisan_id == User.id)
        .where(
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
            Booking.status.in_(
                [
                    BookingStatus.confirmed,
                    BookingStatus.pending_payment,
                    BookingStatus.in_progress,
                ]
            ),
        )
        .order_by(Job.scheduled_time.asc().nullslast(), Booking.created_at.asc())
        .limit(5)
    )

    result = await db.execute(query)
    bookings = []
    for booking, job, artisan_name, artisan_avatar in result:
        bookings.append(
            {
                "id": str(booking.id),
                "title": job.title,
                "category": None,
                "artisan_name": artisan_name,
                "artisan_avatar": artisan_avatar,
                "scheduled_at": job.scheduled_time.isoformat()
                if job.scheduled_time
                else None,
                "status": booking.status,
                "agreed_price": booking.agreed_price,
                "location_label": job.location_label,
            }
        )

    return bookings


@router.get("")
async def list_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    query = (
        select(
            Booking,
            Job,
            User.full_name.label("other_name"),
            User.avatar_url.label("other_avatar"),
        )
        .join(Job, Booking.job_id == Job.id)
        .outerjoin(
            User,
            or_(
                (Booking.client_id == user_id) & (Booking.artisan_id == User.id),
                (Booking.artisan_id == user_id) & (Booking.client_id == User.id),
            ),
        )
        .where(or_(Booking.client_id == user_id, Booking.artisan_id == user_id))
        .order_by(Booking.created_at.desc())
        .limit(50)
    )
    result = await db.execute(query)
    bookings = []
    for booking, job, other_name, other_avatar in result:
        bookings.append(
            {
                "id": str(booking.id),
                "job_id": str(booking.job_id),
                "title": job.title,
                "location_label": job.location_label,
                "scheduled_at": job.scheduled_time.isoformat()
                if job.scheduled_time
                else None,
                "status": booking.status,
                "agreed_price": booking.agreed_price,
                "other_name": other_name,
                "other_avatar": other_avatar,
                "created_at": booking.created_at.isoformat()
                if booking.created_at
                else None,
            }
        )
    return bookings


@router.get("/{booking_id}")
async def get_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(Booking, Job)
        .join(Job, Booking.job_id == Job.id)
        .where(
            Booking.id == booking_id,
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking, job = row

    # Get artisan info
    artisan_user = await db.scalar(select(User).where(User.id == booking.artisan_id))
    client_user = await db.scalar(select(User).where(User.id == booking.client_id))

    return {
        "id": str(booking.id),
        "job_id": str(booking.job_id),
        "status": booking.status,
        "agreed_price": booking.agreed_price,
        "before_photo_url": booking.before_photo_url,
        "after_photo_url": booking.after_photo_url,
        "auto_confirm_at": booking.auto_confirm_at,
        "created_at": booking.created_at.isoformat() if booking.created_at else None,
        "job": {
            "title": job.title,
            "description": job.description,
            "location_label": job.location_label,
            "scheduled_at": job.scheduled_time.isoformat()
            if job.scheduled_time
            else None,
            "budget": job.budget,
        },
        "artisan": {
            "id": str(artisan_user.id) if artisan_user else None,
            "name": artisan_user.full_name if artisan_user else None,
            "avatar_url": artisan_user.avatar_url if artisan_user else None,
            "phone_number": artisan_user.phone_number if artisan_user else None,
        },
        "client": {
            "id": str(client_user.id) if client_user else None,
            "name": client_user.full_name if client_user else None,
            "avatar_url": client_user.avatar_url if client_user else None,
        },
        "is_client": str(booking.client_id) == str(user_id),
    }


@router.post("/{booking_id}/confirm-payment")
async def client_confirm_payment(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client taps 'I've sent payment'. Moves status → confirmed and notifies artisan."""
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.client_id == user_id,
            Booking.status == BookingStatus.pending_payment,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404, detail="Booking not found or wrong status."
        )

    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(status=BookingStatus.confirmed)
    )

    # Notify artisan
    await notify_and_push(
        db,
        booking.artisan_id,
        "payment_sent",
        "Payment sent! 💰",
        "Your client has sent the MoMo payment. Please confirm receipt to begin the job.",
        {"booking_id": str(booking_id)},
    )

    await db.commit()
    return {
        "message": "Payment confirmed. Artisan has been notified.",
        "status": BookingStatus.confirmed,
    }


@router.post("/{booking_id}/confirm-receipt")
async def artisan_confirm_receipt(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan confirms they received the MoMo money. Moves status → in_progress."""
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.artisan_id == user_id,
            Booking.status == BookingStatus.confirmed,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404, detail="Booking not found or wrong status."
        )

    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(status=BookingStatus.in_progress)
    )

    # Set auto-confirm 48h from now
    auto_confirm = datetime.now(timezone.utc) + timedelta(hours=48)
    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(auto_confirm_at=auto_confirm)
    )

    # Notify client
    await notify_and_push(
        db,
        booking.client_id,
        "job_started",
        "Job started! 🔨",
        "Your artisan has confirmed payment and is now on the way.",
        {"booking_id": str(booking_id)},
    )

    await db.commit()
    return {
        "message": "Receipt confirmed. Job is now in progress.",
        "status": BookingStatus.in_progress,
    }


@router.post("/{booking_id}/complete")
async def client_mark_complete(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client confirms job is done. Moves status → completed."""
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.client_id == user_id,
            Booking.status == BookingStatus.in_progress,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404, detail="Booking not found or wrong status."
        )

    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(status=BookingStatus.completed)
    )

    # Notify artisan
    await notify_and_push(
        db,
        booking.artisan_id,
        "job_completed",
        "Job completed! ⭐",
        "The client has confirmed the job is complete. A review may follow.",
        {"booking_id": str(booking_id)},
    )
    # Notify client to review
    await notify_and_push(
        db,
        booking.client_id,
        "review_prompt",
        "How did it go?",
        "Leave a review to help other clients find great artisans.",
        {"booking_id": str(booking_id)},
    )

    await db.commit()
    return {"message": "Job marked as complete.", "status": BookingStatus.completed}


class DisputePayload(BaseModel):
    reason: str


@router.post("/{booking_id}/dispute")
async def raise_dispute(
    booking_id: UUID,
    payload: DisputePayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
            Booking.status.in_(
                [
                    BookingStatus.confirmed,
                    BookingStatus.in_progress,
                    BookingStatus.pending_payment,
                ]
            ),
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404, detail="Booking not found or not eligible for dispute."
        )

    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(status=BookingStatus.disputed)
    )

    # Notify both parties
    other_id = (
        booking.artisan_id
        if str(booking.client_id) == str(user_id)
        else booking.client_id
    )
    await notify_and_push(
        db,
        other_id,
        "dispute_opened",
        "Dispute raised ⚠️",
        f"A dispute has been raised for your booking. Reason: {payload.reason}",
        {"booking_id": str(booking_id)},
    )

    await db.commit()
    return {
        "message": "Dispute raised. Our team will review within 24 hours.",
        "status": BookingStatus.disputed,
    }


@router.post("/{booking_id}/cancel")
async def cancel_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
            Booking.status.in_(
                [BookingStatus.pending_payment, BookingStatus.confirmed]
            ),
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or cannot be cancelled at this stage.",
        )

    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(status=BookingStatus.cancelled)
    )

    other_id = (
        booking.artisan_id
        if str(booking.client_id) == str(user_id)
        else booking.client_id
    )
    await notify_and_push(
        db,
        other_id,
        "booking_cancelled",
        "Booking cancelled",
        "A booking has been cancelled.",
        {"booking_id": str(booking_id)},
    )

    await db.commit()
    return {"message": "Booking cancelled.", "status": BookingStatus.cancelled}
