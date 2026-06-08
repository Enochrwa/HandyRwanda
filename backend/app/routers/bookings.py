# File: backend/app/routers/bookings.py
"""
Bookings router — full lifecycle management.

Sprint 1 additions:
  POST /bookings/{id}/accept      — artisan accepts the booking (15-min window)
  POST /bookings/{id}/en-route    — artisan is travelling to client
  POST /bookings/{id}/arrived     — artisan has arrived at job site
  POST /bookings/{id}/start       — artisan starts the job

Existing endpoints:
  POST   /bookings                    — create direct booking
  GET    /bookings/upcoming           — upcoming bookings for current user
  GET    /bookings                    — all bookings for current user
  GET    /bookings/{id}               — single booking detail
  POST   /bookings/{id}/confirm-payment
  POST   /bookings/{id}/confirm-receipt
  POST   /bookings/{id}/complete
  POST   /bookings/{id}/dispute
  POST   /bookings/{id}/cancel
"""

import asyncio
import logging
from collections.abc import Callable, Coroutine
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.booking import Booking, BookingStatus, CancelledBy
from app.models.job import Job
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services.booking_lifecycle_service import (
    _push_booking_status_change,
    update_completion_rate,
    update_on_time_rate,
    update_repeat_client_rate,
    update_response_rate,
)
from app.services.escrow_service import release_escrow, schedule_release

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/bookings", tags=["bookings"])


# ── Schemas ────────────────────────────────────────────────────────────────────


class DirectBookingCreate(BaseModel):
    """Create a booking directly with a specific artisan (no bid flow)."""
    job_id:       UUID
    artisan_id:   UUID
    agreed_price: int


class EnRoutePayload(BaseModel):
    """Optional payload for /en-route — artisan can provide ETA."""
    eta_minutes: int | None = Field(default=None, ge=1, le=240)



class InstantBookCreate(BaseModel):
    """
    Sprint 4 — Instant Book: skip the bidding flow entirely.
    Client must have at least one completed booking with this artisan.
    """
    artisan_id:       UUID
    category_id:      UUID
    description:      str = Field(..., min_length=10, max_length=2000)
    scheduled_time:   datetime | None = None
    address_district: str | None = None
    address_detail:   str | None = None
    budget:           int = Field(..., gt=0, description="Agreed price in RWF")
    use_last_price:   bool = Field(
        default=False,
        description="Pre-fill agreed_price from last completed booking with artisan",
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


async def _notify(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    title: str,
    body: str,
    payload: dict[str, object] | None = None,
) -> None:
    n = Notification(
        user_id=user_id,
        event_type=event_type,
        title=title,
        body=body,
        payload=payload or {},
    )
    db.add(n)


async def _get_booking_with_users(
    booking_id: UUID,
    db: AsyncSession,
) -> tuple[Booking, User, User]:
    """Fetch booking + artisan user + client user in 2 queries."""
    booking = await db.scalar(select(Booking).where(Booking.id == booking_id))
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    users_res = await db.execute(
        select(User).where(User.id.in_([booking.artisan_id, booking.client_id]))
    )
    users_by_id = {u.id: u for u in users_res.scalars().all()}
    artisan_user = users_by_id.get(booking.artisan_id)
    client_user  = users_by_id.get(booking.client_id)
    return booking, artisan_user, client_user  # type: ignore[return-value]


def _schedule_auto_cancel(booking_id: UUID, delay_minutes: int = 15) -> None:
    """
    Schedule an APScheduler job to auto-cancel an unaccepted booking.

    We use a fire-and-forget asyncio task rather than importing the global
    scheduler here (avoids circular imports and keeps the router thin).
    The actual scheduling is done via the app-level scheduler registered
    in main.py; here we simply enqueue via a background coroutine.
    """
    async def _run() -> None:
        await asyncio.sleep(delay_minutes * 60)
        try:
            async with AsyncSessionLocal() as session:
                from app.services.booking_lifecycle_service import (  # noqa: PLC0415
                    auto_cancel_unaccepted_booking,
                )
                await auto_cancel_unaccepted_booking(booking_id, session)
        except Exception:
            _log.exception("auto_cancel task failed for booking %s", booking_id)

    asyncio.create_task(_run())


# ── CREATE ─────────────────────────────────────────────────────────────────────


@router.post("", status_code=201)
async def create_direct_booking(
    payload: DirectBookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Direct booking: client selects a specific artisan without the bid flow."""
    client_id = UUID(current_user["sub"])

    job = await db.scalar(select(Job).where(Job.id == payload.job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if str(job.client_id) != str(client_id):
        raise HTTPException(status_code=403, detail="You do not own this job.")

    artisan = await db.scalar(
        select(User).where(User.id == payload.artisan_id, User.role == UserRole.artisan)
    )
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan not found.")

    booking = Booking(
        job_id=payload.job_id,
        client_id=client_id,
        artisan_id=payload.artisan_id,
        agreed_price=payload.agreed_price,
        status=BookingStatus.pending_payment,
        auto_confirm_at=datetime.now(timezone.utc) + timedelta(hours=72),
    )
    db.add(booking)
    await db.flush()

    await _notify(
        db,
        payload.artisan_id,
        "new_booking",
        "New Booking Request 📋",
        f"You have a new booking for: {job.title}",
        {"booking_id": str(booking.id), "job_id": str(payload.job_id)},
    )

    await db.commit()
    return {"id": str(booking.id), "status": booking.status}



# ── Sprint 4: Instant Book ────────────────────────────────────────────────────


@router.post("/instant", status_code=201)
async def create_instant_booking(
    payload: InstantBookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """
    Sprint 4 — Instant Booking.

    Allows a client to re-book a previously used artisan with one tap,
    skipping the bidding flow entirely. Requirements:
      1. Client must have at least 1 completed booking with this artisan.
      2. Job is auto-created with status=\'booked\' (skips \'open\').
      3. Booking is auto-created with status=\'pending_payment\'.
      4. Artisan is notified; has 10 minutes to confirm or decline.
      5. If artisan declines / timeout: job reverts to \'open\' for normal bidding.
    """
    from app.models.artisan import ArtisanProfile, VerificationStatus
    from app.models.job import Job as JobModel, JobStatus

    client_id = UUID(current_user["sub"])
    artisan_id = payload.artisan_id

    # ── 1. Verify prior relationship ─────────────────────────────────────────
    prior_booking = await db.scalar(
        select(Booking).where(
            Booking.client_id == client_id,
            Booking.artisan_id == artisan_id,
            Booking.status == BookingStatus.completed,
        )
    )
    if not prior_booking:
        raise HTTPException(
            status_code=403,
            detail=(
                "Instant booking is only available with artisans you have previously worked with. "
                "Please post an open job or request a quote instead."
            ),
        )

    # ── 2. Verify artisan exists, is active, and is eligible ─────────────────
    artisan_user = await db.scalar(
        select(User).where(User.id == artisan_id, User.role == UserRole.artisan)
    )
    if not artisan_user:
        raise HTTPException(status_code=404, detail="Artisan not found.")

    artisan_profile = await db.scalar(
        select(ArtisanProfile).where(ArtisanProfile.user_id == artisan_id)
    )
    if not artisan_profile:
        raise HTTPException(status_code=404, detail="Artisan profile not found.")

    if not artisan_profile.is_available:
        raise HTTPException(
            status_code=409,
            detail=f"{artisan_user.full_name} is currently marked as unavailable. "
                   "You can post an open job to receive bids instead.",
        )

    if artisan_profile.verification_status not in (
        VerificationStatus.id_verified,
        VerificationStatus.pro_verified,
    ):
        raise HTTPException(
            status_code=409,
            detail="This artisan is not yet verified for instant booking. "
                   "Please post an open job instead.",
        )

    # ── 3. Resolve agreed price ───────────────────────────────────────────────
    agreed_price = payload.budget
    if payload.use_last_price and prior_booking.agreed_price:
        agreed_price = prior_booking.agreed_price

    # ── 4. Auto-create Job (status=booked, bypassing open) ───────────────────
    client_user = await db.scalar(select(User).where(User.id == client_id))
    from app.models.artisan import Category

    category = await db.scalar(
        select(Category).where(Category.id == payload.category_id)
    )
    category_name = category.name_en if category else "Service"

    job = JobModel(
        client_id=client_id,
        category_id=payload.category_id,
        title=f"⚡ Instant Booking — {category_name}",
        description=payload.description,
        district=payload.address_district,
        status=JobStatus.booked,          # Skip \'open\' — goes straight to booked
        budget=agreed_price,
        budget_negotiable=False,
        scheduled_time=payload.scheduled_time,
        location_label=payload.address_detail or payload.address_district,
    )
    db.add(job)
    await db.flush()  # get job.id

    # ── 5. Auto-create Booking (status=pending_payment) ───────────────────────
    booking = Booking(
        job_id=job.id,
        client_id=client_id,
        artisan_id=artisan_id,
        agreed_price=agreed_price,
        status=BookingStatus.pending_payment,
        auto_confirm_at=datetime.now(timezone.utc) + timedelta(hours=72),
    )
    db.add(booking)
    await db.flush()  # get booking.id

    # ── 6. Notify artisan via DB notification + real-time push ────────────────
    client_name = client_user.full_name if client_user else "A client"
    await _notify(
        db,
        artisan_id,
        "instant_booking_request",
        "⚡ Instant Booking Request!",
        f"{client_name} wants to book you again for: {category_name}. "
        f"Agreed price: {agreed_price:,} RWF. You have 10 minutes to confirm.",
        {
            "booking_id": str(booking.id),
            "job_id": str(job.id),
            "screen": "booking_detail",
            "client_name": client_name,
            "category": category_name,
            "agreed_price": agreed_price,
        },
    )

    await db.commit()

    # ── 7. Push real-time WS event to artisan ─────────────────────────────────
    import asyncio as _asyncio
    from app.services.booking_lifecycle_service import _push_booking_status_change
    _asyncio.create_task(
        _push_booking_status_change(
            artisan_id,
            booking_id=str(booking.id),
            new_status="instant_booking_request",
            client_name=client_name,
        )
    )

    # ── 8. Schedule 10-minute auto-revert if artisan doesn\'t confirm ──────────
    async def _auto_revert_if_unaccepted() -> None:
        """
        If artisan has not accepted the instant booking within 10 minutes,
        revert the job to \'open\' status so the client can receive bids.
        """
        import asyncio as _a
        await _a.sleep(10 * 60)
        try:
            async with AsyncSessionLocal() as session:
                fresh_booking = await session.scalar(
                    select(Booking).where(Booking.id == booking.id)
                )
                if fresh_booking and fresh_booking.status == BookingStatus.pending_payment:
                    # Artisan did not respond — revert job to open for bidding
                    await session.execute(
                        update(Booking)
                        .where(Booking.id == booking.id)
                        .values(status=BookingStatus.cancelled, cancelled_by=CancelledBy.system)
                    )
                    await session.execute(
                        update(JobModel)
                        .where(JobModel.id == job.id)
                        .values(status=JobStatus.open)
                    )

                    # Notify client
                    revert_notif = Notification(
                        user_id=client_id,
                        event_type="instant_book_expired",
                        title="⚠️ Artisan did not respond",
                        body=(
                            (artisan_user.full_name if artisan_user else "Your artisan")
                            + " did not confirm your instant booking in time. "
                            + "Your job is now open for other artisans to bid on."
                        ),
                        payload={
                            "job_id": str(job.id),
                            "screen": "job_bids",
                        },
                    )
                    session.add(revert_notif)
                    await session.commit()

                    _log.info(
                        "Instant booking %s auto-reverted to open job %s "
                        "(artisan %s did not confirm within 10 min)",
                        booking.id, job.id, artisan_id,
                    )
        except Exception:
            _log.exception("auto_revert_if_unaccepted failed for booking %s", booking.id)

    _asyncio.create_task(_auto_revert_if_unaccepted())

    return {
        "id": str(booking.id),
        "job_id": str(job.id),
        "status": booking.status,
        "agreed_price": agreed_price,
        "artisan_name": artisan_user.full_name if artisan_user else "",
        "message": (
            f"\u26a1 Instant booking sent to {artisan_user.full_name if artisan_user else 'your artisan'}! "
            "They have 10 minutes to confirm. You'll be notified immediately."
        ),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
    }


# ── READ ───────────────────────────────────────────────────────────────────────


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
                    BookingStatus.artisan_accepted,
                    BookingStatus.artisan_en_route,
                    BookingStatus.arrived,
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
                "artisan_name": artisan_name,
                "artisan_avatar": artisan_avatar,
                "scheduled_at": job.scheduled_time.isoformat() if job.scheduled_time else None,
                "status": booking.status,
                "agreed_price": booking.agreed_price,
                "location_label": job.location_label,
                "eta_minutes": booking.eta_minutes,
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
                "id":           str(booking.id),
                "job_id":       str(booking.job_id),
                "title":        job.title,
                "location_label": job.location_label,
                "scheduled_at": job.scheduled_time.isoformat() if job.scheduled_time else None,
                "status":       booking.status,
                "agreed_price": booking.agreed_price,
                "other_name":   other_name,
                "other_avatar": other_avatar,
                "eta_minutes":  booking.eta_minutes,
                "created_at":   booking.created_at.isoformat() if booking.created_at else None,
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

    users_res = await db.execute(
        select(User).where(User.id.in_([booking.artisan_id, booking.client_id]))
    )
    users_by_id = {u.id: u for u in users_res.scalars().all()}
    artisan_user = users_by_id.get(booking.artisan_id)
    client_user  = users_by_id.get(booking.client_id)

    return {
        "id":              str(booking.id),
        "job_id":          str(booking.job_id),
        "status":          booking.status,
        "agreed_price":    booking.agreed_price,
        "before_photo_url": booking.before_photo_url,
        "after_photo_url":  booking.after_photo_url,
        "auto_confirm_at":  booking.auto_confirm_at,
        "eta_minutes":     booking.eta_minutes,
        "accepted_at":     booking.accepted_at.isoformat() if booking.accepted_at else None,
        "en_route_at":     booking.en_route_at.isoformat() if booking.en_route_at else None,
        "arrived_at":      booking.arrived_at.isoformat() if booking.arrived_at else None,
        "started_at":      booking.started_at.isoformat() if booking.started_at else None,
        "created_at":      booking.created_at.isoformat() if booking.created_at else None,
        "job": {
            "title":        job.title,
            "description":  job.description,
            "location_label": job.location_label,
            "scheduled_at": job.scheduled_time.isoformat() if job.scheduled_time else None,
            "budget":       job.budget,
        },
        "artisan": {
            "id":           str(artisan_user.id)       if artisan_user else None,
            "name":         artisan_user.full_name      if artisan_user else None,
            "avatar_url":   artisan_user.avatar_url     if artisan_user else None,
            "phone_number": artisan_user.phone_number   if artisan_user else None,
        },
        "client": {
            "id":         str(client_user.id)     if client_user else None,
            "name":       client_user.full_name    if client_user else None,
            "avatar_url": client_user.avatar_url   if client_user else None,
        },
        "is_client": str(booking.client_id) == str(user_id),
    }


# ── PAYMENT FLOW ───────────────────────────────────────────────────────────────


@router.post("/{booking_id}/confirm-payment")
async def client_confirm_payment(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client taps 'I've sent payment' → confirmed → schedule 15-min artisan accept window."""
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.client_id == user_id,
            Booking.status == BookingStatus.pending_payment,
        )
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or wrong status.")

    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.confirmed
        )
    )

    # Notify artisan
    await _notify(
        db,
        booking.artisan_id,
        "payment_sent",
        "Payment received — Accept now! 💰",
        "Your client has sent the MoMo payment. Tap Accept within 15 minutes to confirm.",
        {"booking_id": str(booking_id), "screen": "artisan_jobs"},
    )

    await db.commit()

    # Schedule the 15-minute auto-cancel window AFTER commit
    _schedule_auto_cancel(booking_id, delay_minutes=15)

    # Push real-time status to artisan
    client_user  = await db.scalar(select(User).where(User.id == user_id))
    asyncio.create_task(
        _push_booking_status_change(
            booking.artisan_id,
            booking_id=str(booking_id),
            new_status="confirmed",
            client_name=client_user.full_name if client_user else "",
        )
    )

    return {
        "message": "Payment confirmed. Artisan has been notified. 15-minute accept window started.",
        "status": BookingStatus.confirmed,
    }


# ── SPRINT 1: ARTISAN LIFECYCLE TRANSITIONS ───────────────────────────────────


@router.post("/{booking_id}/accept")
async def artisan_accept_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Sprint 1 — Artisan accepts the confirmed booking.

    Guard: booking.artisan_id == user_id, status == confirmed.
    Effect: status → artisan_accepted, updates response_rate.
    Notifies client via push notification + WebSocket.
    """
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
            status_code=404,
            detail="Booking not found or not in 'confirmed' status. "
                   "Check that you are the assigned artisan.",
        )

    now = datetime.now(timezone.utc)
    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.artisan_accepted,
            accepted_at=now,
        )
    )

    # Update response rate (async — non-blocking)
    asyncio.create_task(
        _update_rate_async(update_response_rate, user_id)
    )

    artisan_user = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan_user.full_name if artisan_user else "Your artisan"

    await _notify(
        db,
        booking.client_id,
        "artisan_accepted",
        f"✅ {artisan_name} accepted your job!",
        f"{artisan_name} has confirmed your booking. They'll be on their way soon.",
        {"booking_id": str(booking_id), "screen": "booking_detail"},
    )

    await db.commit()

    asyncio.create_task(
        _push_booking_status_change(
            booking.client_id,
            booking_id=str(booking_id),
            new_status="artisan_accepted",
            artisan_name=artisan_name,
        )
    )

    return {
        "message": "Booking accepted successfully.",
        "status": BookingStatus.artisan_accepted,
        "accepted_at": now.isoformat(),
    }


@router.post("/{booking_id}/en-route")
async def artisan_en_route(
    booking_id: UUID,
    payload: EnRoutePayload | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Sprint 1 — Artisan taps "I'm on my way".

    Guard: status == artisan_accepted.
    Accepts optional eta_minutes in body.
    Effect: status → artisan_en_route, stores eta_minutes.
    """
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.artisan_id == user_id,
            Booking.status == BookingStatus.artisan_accepted,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or not in 'artisan_accepted' status.",
        )

    eta_minutes = payload.eta_minutes if payload else None
    now = datetime.now(timezone.utc)

    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.artisan_en_route,
            eta_minutes=eta_minutes,
            en_route_at=now,
        )
    )

    artisan_user = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan_user.full_name if artisan_user else "Your artisan"

    eta_text = f" Estimated arrival: {eta_minutes} minutes." if eta_minutes else ""
    await _notify(
        db,
        booking.client_id,
        "artisan_en_route",
        f"🚗 {artisan_name} is on the way!",
        f"{artisan_name} is heading to your location.{eta_text}",
        {
            "booking_id": str(booking_id),
            "eta_minutes": eta_minutes,
            "screen": "booking_detail",
        },
    )

    await db.commit()

    asyncio.create_task(
        _push_booking_status_change(
            booking.client_id,
            booking_id=str(booking_id),
            new_status="artisan_en_route",
            artisan_name=artisan_name,
            eta_minutes=eta_minutes,
        )
    )

    return {
        "message": "Status updated — client notified you're on the way.",
        "status": BookingStatus.artisan_en_route,
        "eta_minutes": eta_minutes,
    }


@router.post("/{booking_id}/arrived")
async def artisan_arrived(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Sprint 1 — Artisan has arrived at the job site.

    Guard: status == artisan_en_route.
    Effect: status → arrived, records arrived_at timestamp, updates on_time_rate.
    Client sees a pulsing green "Artisan arrived" indicator.
    """
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.artisan_id == user_id,
            Booking.status == BookingStatus.artisan_en_route,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or not in 'artisan_en_route' status.",
        )

    now = datetime.now(timezone.utc)
    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.arrived,
            arrived_at=now,
        )
    )

    # Update on_time_rate asynchronously
    asyncio.create_task(
        _update_rate_async(update_on_time_rate, user_id)
    )

    artisan_user = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan_user.full_name if artisan_user else "Your artisan"

    await _notify(
        db,
        booking.client_id,
        "artisan_arrived",
        f"📍 {artisan_name} has arrived!",
        f"{artisan_name} is at your location. Please let them in.",
        {"booking_id": str(booking_id), "screen": "booking_detail"},
    )

    await db.commit()

    asyncio.create_task(
        _push_booking_status_change(
            booking.client_id,
            booking_id=str(booking_id),
            new_status="arrived",
            artisan_name=artisan_name,
        )
    )

    return {
        "message": "Arrival confirmed — client notified.",
        "status": BookingStatus.arrived,
        "arrived_at": now.isoformat(),
    }


@router.post("/{booking_id}/start")
async def artisan_start_job(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Sprint 1 — Artisan taps "Start Job".

    Guard: status == arrived.
    Effect: status → in_progress, records started_at timestamp.
    """
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.artisan_id == user_id,
            Booking.status == BookingStatus.arrived,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or not in 'arrived' status.",
        )

    now = datetime.now(timezone.utc)
    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.in_progress,
            started_at=now,
        )
    )

    artisan_user = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan_user.full_name if artisan_user else "Your artisan"

    await _notify(
        db,
        booking.client_id,
        "job_started",
        "🔧 Work has started!",
        f"{artisan_name} has started working on your job.",
        {"booking_id": str(booking_id), "screen": "booking_detail"},
    )

    await db.commit()

    asyncio.create_task(
        _push_booking_status_change(
            booking.client_id,
            booking_id=str(booking_id),
            new_status="in_progress",
            artisan_name=artisan_name,
        )
    )

    return {
        "message": "Job started.",
        "status": BookingStatus.in_progress,
        "started_at": now.isoformat(),
    }


# ── EXISTING ENDPOINTS (PRESERVED + ENHANCED) ─────────────────────────────────


@router.post("/{booking_id}/confirm-receipt")
async def artisan_confirm_receipt(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan confirms they received the MoMo money (legacy flow)."""
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.artisan_id == user_id,
            Booking.status == BookingStatus.confirmed,
        )
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or wrong status.")

    auto_confirm = datetime.now(timezone.utc) + timedelta(hours=48)
    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.in_progress,
            auto_confirm_at=auto_confirm,
        )
    )

    await schedule_release(db, booking_id, release_in_hours=48)

    await _notify(
        db,
        booking.client_id,
        "job_started",
        "Job started! 🔨",
        "Your artisan has confirmed payment and is now on the way.",
        {"booking_id": str(booking_id)},
    )

    await db.commit()
    return {"message": "Receipt confirmed. Job is now in progress.", "status": BookingStatus.in_progress}


@router.post("/{booking_id}/complete")
async def client_mark_complete(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client confirms job is done → completed, releases escrow, updates metrics."""
    user_id = UUID(current_user["sub"])
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.client_id == user_id,
            Booking.status == BookingStatus.in_progress,
        )
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or wrong status.")

    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.completed
        )
    )

    await release_escrow(db, booking_id, released_by="client")

    await _notify(
        db,
        booking.artisan_id,
        "job_completed",
        "Job completed! ⭐",
        "The client has confirmed the job is complete. A review may follow.",
        {"booking_id": str(booking_id)},
    )
    await _notify(
        db,
        booking.client_id,
        "review_prompt",
        "How did it go?",
        "Leave a review to help other clients find great artisans.",
        {"booking_id": str(booking_id)},
    )

    await db.commit()

    # Update rate metrics asynchronously
    asyncio.create_task(_update_rate_async(update_completion_rate,   booking.artisan_id))
    asyncio.create_task(_update_rate_async(update_repeat_client_rate, booking.artisan_id))

    asyncio.create_task(
        _push_booking_status_change(
            booking.artisan_id,
            booking_id=str(booking_id),
            new_status="completed",
        )
    )

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
                    BookingStatus.artisan_accepted,
                    BookingStatus.artisan_en_route,
                    BookingStatus.arrived,
                    BookingStatus.in_progress,
                    BookingStatus.pending_payment,
                ]
            ),
        )
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found or not eligible for dispute.")

    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(status=BookingStatus.disputed)
    )

    other_id = (
        booking.artisan_id if str(booking.client_id) == str(user_id) else booking.client_id
    )
    await _notify(
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
                [
                    BookingStatus.pending_payment,
                    BookingStatus.confirmed,
                    BookingStatus.artisan_accepted,
                ]
            ),
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or cannot be cancelled at this stage.",
        )

    # Determine who cancelled for rate tracking
    if str(booking.artisan_id) == str(user_id):
        cancelled_by = CancelledBy.artisan
    else:
        cancelled_by = CancelledBy.client

    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.cancelled,
            cancelled_by=cancelled_by,
        )
    )

    other_id = (
        booking.artisan_id if str(booking.client_id) == str(user_id) else booking.client_id
    )
    await _notify(
        db,
        other_id,
        "booking_cancelled",
        "Booking cancelled",
        "A booking has been cancelled.",
        {"booking_id": str(booking_id)},
    )

    await db.commit()

    # If artisan cancelled, update completion rate
    if cancelled_by == CancelledBy.artisan:
        asyncio.create_task(_update_rate_async(update_completion_rate, booking.artisan_id))

    return {"message": "Booking cancelled.", "status": BookingStatus.cancelled}


# ── Private async helper for rate updates ─────────────────────────────────────


async def _update_rate_async(
    fn: Callable[[UUID, AsyncSession], Coroutine[object, object, None]],
    artisan_id: UUID,
) -> None:
    """Run a rate-update function in its own DB session (fire-and-forget)."""
    try:
        async with AsyncSessionLocal() as session:
            await fn(artisan_id, session)
            await session.commit()
    except Exception:
        _log.exception("Rate update failed for artisan %s via %s", artisan_id, fn.__name__)


# ── Admin: set arbitrary status ───────────────────────────────────────────────


class AdminStatusPayload(BaseModel):
    status: BookingStatus
    reason: str | None = None


@router.patch("/{booking_id}/status")
async def admin_set_status(
    booking_id: UUID,
    payload: AdminStatusPayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Admin override: set booking to any status with optional reason.
    Also pushes a real-time WebSocket event to both parties."""
    booking = await db.scalar(select(Booking).where(Booking.id == booking_id))
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    old_status = booking.status
    values: dict[str, object] = {"status": payload.status}

    # Auto-populate timestamps for Sprint 1 statuses
    now = datetime.now(timezone.utc)
    if payload.status == BookingStatus.artisan_accepted:
        values["accepted_at"] = now
    elif payload.status == BookingStatus.artisan_en_route:
        values["en_route_at"] = now
    elif payload.status == BookingStatus.arrived:
        values["arrived_at"] = now
    elif payload.status == BookingStatus.in_progress:
        values["started_at"] = now
    elif payload.status == BookingStatus.cancelled:
        values["cancelled_by"] = CancelledBy.system
        if payload.reason:
            values["cancellation_reason"] = payload.reason

    await db.execute(update(Booking).where(Booking.id == booking_id).values(**values))

    reason_text = f" Reason: {payload.reason}" if payload.reason else ""
    await _notify(
        db, booking.client_id, "booking_status_admin",
        "Booking Updated",
        f"Your booking status was updated to {payload.status}.{reason_text}",
        {"booking_id": str(booking_id)},
    )
    await _notify(
        db, booking.artisan_id, "booking_status_admin",
        "Booking Updated",
        f"Booking status was updated to {payload.status}.{reason_text}",
        {"booking_id": str(booking_id)},
    )

    await db.commit()

    # Push real-time event to both parties
    asyncio.create_task(
        _push_booking_status_change(
            booking.client_id,
            booking_id=str(booking_id),
            new_status=payload.status,
        )
    )
    asyncio.create_task(
        _push_booking_status_change(
            booking.artisan_id,
            booking_id=str(booking_id),
            new_status=payload.status,
        )
    )

    return {
        "message": f"Status changed from {old_status} → {payload.status}",
        "booking_id": str(booking_id),
        "old_status": old_status,
        "new_status": payload.status,
    }


# ── Sprint 4: Artisan accept / decline instant booking ────────────────────────


@router.post("/{booking_id}/instant-confirm")
async def artisan_confirm_instant_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Sprint 4 — Artisan confirms an instant booking (transitions → confirmed).

    The booking was auto-created with status=pending_payment. Artisan
    tapping "Confirm" sets it to confirmed, signalling they've accepted
    and are preparing for the job. Client is notified immediately.
    """
    user_id = UUID(current_user["sub"])

    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.artisan_id == user_id,
            Booking.status == BookingStatus.pending_payment,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or already responded to.",
        )

    now = datetime.now(timezone.utc)
    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.confirmed,
            accepted_at=now,
        )
    )

    artisan_user = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan_user.full_name if artisan_user else "Your artisan"

    await _notify(
        db,
        booking.client_id,
        "instant_booking_confirmed",
        "⚡ Instant Booking Confirmed!",
        f"{artisan_name} has confirmed your booking! They'll be in touch soon.",
        {"booking_id": str(booking_id), "screen": "booking_detail"},
    )

    await db.commit()

    import asyncio
    from app.services.booking_lifecycle_service import _push_booking_status_change
    asyncio.create_task(
        _push_booking_status_change(
            booking.client_id,
            booking_id=str(booking_id),
            new_status="confirmed",
            artisan_name=artisan_name,
        )
    )

    return {
        "message": "Instant booking confirmed! The client has been notified.",
        "status": BookingStatus.confirmed,
        "booking_id": str(booking_id),
    }


@router.post("/{booking_id}/instant-decline")
async def artisan_decline_instant_booking(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Sprint 4 — Artisan declines an instant booking.

    Cancels the booking and reverts the associated job to 'open'
    status so the client can receive bids from other artisans.
    """
    from app.models.job import Job as JobModel, JobStatus

    user_id = UUID(current_user["sub"])

    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.artisan_id == user_id,
            Booking.status == BookingStatus.pending_payment,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or already responded to.",
        )

    artisan_user = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan_user.full_name if artisan_user else "The artisan"

    # Cancel the instant booking
    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(
            status=BookingStatus.cancelled,
            cancelled_by=CancelledBy.artisan,
            cancellation_reason="Artisan declined instant booking",
        )
    )

    # Revert job to open so client can receive bids
    await db.execute(
        update(JobModel)
        .where(JobModel.id == booking.job_id)
        .values(status=JobStatus.open)
    )

    # Notify client
    await _notify(
        db,
        booking.client_id,
        "instant_booking_declined",
        "Artisan Unavailable",
        f"{artisan_name} is unable to take your booking right now. "
        "Your job has been posted for other artisans to bid on.",
        {
            "booking_id": str(booking_id),
            "job_id": str(booking.job_id),
            "screen": "job_bids",
        },
    )

    await db.commit()

    return {
        "message": "Instant booking declined. The job has been posted for open bids.",
        "status": BookingStatus.cancelled,
        "job_id": str(booking.job_id),
    }
