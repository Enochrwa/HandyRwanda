# File: backend/app/services/booking_lifecycle_service.py
"""
Sprint 1 — Booking Lifecycle Service

Handles:
  1. Auto-cancel when artisan does NOT accept within 15 minutes
  2. Re-match to next best artisan on auto-cancel
  3. Rate metric updates (response_rate, on_time_rate, completion_rate)
     that feed into the Community Safety Score (Sprint 5)

Called by:
  - APScheduler DateTrigger jobs (scheduled in bookings router)
  - bookings router on each status transition
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.ws_manager import notification_manager
from app.models.artisan import ArtisanProfile
from app.models.booking import Booking, BookingStatus, CancelledBy
from app.models.job import Job
from app.models.notification import Notification
from app.models.user import User

_log = logging.getLogger(__name__)


# ── WebSocket / Notification helpers ─────────────────────────────────────────


async def _push_booking_status_change(
    user_id: UUID | str,
    *,
    booking_id: str,
    new_status: str,
    artisan_name: str = "",
    client_name: str = "",
    eta_minutes: int | None = None,
) -> None:
    """Push a standardised booking_status_change event via Socket.IO."""
    await notification_manager.push(
        str(user_id),
        {
            "type": "booking_status_change",
            "booking_id": booking_id,
            "new_status": new_status,
            "artisan_name": artisan_name,
            "client_name": client_name,
            "eta_minutes": eta_minutes,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


async def _db_notify(
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


# ── Auto-cancel: artisan did not accept within 15 minutes ────────────────────


async def auto_cancel_unaccepted_booking(
    booking_id: UUID,
    db: AsyncSession,
) -> None:
    """
    Called by APScheduler 15 minutes after a booking reaches `confirmed`.

    If the booking is still `confirmed` (artisan has not accepted):
      1. Cancel the booking (cancelled_by = system).
      2. Decrement artisan's response_rate.
      3. Notify client.
      4. Re-match: find next best artisan and create a new booking.
    """
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.status == BookingStatus.confirmed,
        )
    )
    if not booking:
        # Already accepted or cancelled — nothing to do
        _log.debug(
            "auto_cancel: booking %s is no longer 'confirmed', skipping.", booking_id
        )
        return

    _log.info("auto_cancel: artisan did not accept booking %s within 15 min", booking_id)

    # ── 1. Cancel this booking ───────────────────────────────────────────────
    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(
            status=BookingStatus.cancelled,
            cancelled_by=CancelledBy.system,
            cancellation_reason="Artisan did not respond within 15 minutes.",
        )
    )

    # ── 2. Update artisan response_rate & auto_cancelled_count ───────────────
    await _decrement_response_rate(booking.artisan_id, db)
    await _increment_auto_cancelled_count(booking.artisan_id, db)

    # ── 3. Notify client ─────────────────────────────────────────────────────
    job = await db.scalar(select(Job).where(Job.id == booking.job_id))
    artisan_user = await db.scalar(select(User).where(User.id == booking.artisan_id))
    artisan_name = artisan_user.full_name if artisan_user else "The artisan"

    notif_body = (
        f"{artisan_name} did not respond in time. "
        "We're finding you another match now — hang tight! 🔍"
    )
    await _db_notify(
        db,
        booking.client_id,
        "artisan_no_response",
        "Finding a new match for you ⏱️",
        notif_body,
        {"booking_id": str(booking_id), "job_id": str(booking.job_id)},
    )

    await db.flush()

    # Push via WebSocket
    asyncio.create_task(
        _push_booking_status_change(
            booking.client_id,
            booking_id=str(booking_id),
            new_status="cancelled_no_response",
            artisan_name=artisan_name,
        )
    )

    # ── 4. Re-match: notify next best artisan ────────────────────────────────
    if job:
        try:
            from app.models.artisan import Category  # noqa: PLC0415
            from app.services.matching_service import (  # noqa: PLC0415
                notify_matching_artisans,
            )
            category = await db.scalar(
                select(Category).where(Category.id == job.category_id)
            ) if job.category_id else None
            category_name = category.name_en if category else "Service"
            await notify_matching_artisans(db, job, category_name)
            _log.info("auto_cancel: re-matched booking %s to new artisans", booking_id)
        except Exception:
            _log.exception("auto_cancel: re-match failed for booking %s", booking_id)

    await db.commit()


# ── Rate metric helpers ───────────────────────────────────────────────────────


async def update_response_rate(artisan_id: UUID, db: AsyncSession) -> None:
    """
    Recalculate and persist response_rate for an artisan.

    response_rate = accepted_bookings / assigned_bookings (last 90 days).
    Called when booking transitions to `artisan_accepted`.
    """
    from sqlalchemy import text  # noqa: PLC0415

    row = await db.execute(
        text("""
            SELECT
                COUNT(*) FILTER (WHERE status IN ('artisan_accepted','artisan_en_route',
                                                  'arrived','in_progress','completed'))
                    AS accepted,
                COUNT(*) AS total
            FROM bookings
            WHERE artisan_id = :aid
              AND created_at > NOW() - INTERVAL '90 days'
        """),
        {"aid": str(artisan_id)},
    )
    r = row.fetchone()
    if r and r.total > 0:
        rate = round(r.accepted / r.total, 4)
        await db.execute(
            update(ArtisanProfile)
            .where(ArtisanProfile.user_id == artisan_id)
            .values(response_rate=rate)
        )


async def update_on_time_rate(artisan_id: UUID, db: AsyncSession) -> None:
    """
    Recalculate on_time_rate.

    on_time = arrived_at <= scheduled_time + 15 minutes.
    Called when booking transitions to `arrived`.
    """
    from sqlalchemy import text  # noqa: PLC0415

    row = await db.execute(
        text("""
            SELECT
                COUNT(*) FILTER (
                    WHERE b.arrived_at IS NOT NULL
                      AND b.arrived_at <= (j.scheduled_time + INTERVAL '15 minutes')
                ) AS on_time,
                COUNT(*) FILTER (WHERE b.arrived_at IS NOT NULL) AS total_arrived
            FROM bookings b
            JOIN jobs j ON b.job_id = j.id
            WHERE b.artisan_id = :aid
              AND b.status IN ('arrived','in_progress','completed')
        """),
        {"aid": str(artisan_id)},
    )
    r = row.fetchone()
    if r and r.total_arrived > 0:
        rate = round(r.on_time / r.total_arrived, 4)
        await db.execute(
            update(ArtisanProfile)
            .where(ArtisanProfile.user_id == artisan_id)
            .values(on_time_rate=rate)
        )


async def update_completion_rate(artisan_id: UUID, db: AsyncSession) -> None:
    """
    Recalculate completion_rate.

    completion_rate = completed / (completed + cancelled_by_artisan).
    Called when booking reaches `completed` or `cancelled`.
    """
    from sqlalchemy import text  # noqa: PLC0415

    row = await db.execute(
        text("""
            SELECT
                COUNT(*) FILTER (WHERE status = 'completed') AS completed,
                COUNT(*) FILTER (
                    WHERE status = 'cancelled'
                      AND cancelled_by = 'artisan'
                ) AS cancelled_by_artisan
            FROM bookings
            WHERE artisan_id = :aid
        """),
        {"aid": str(artisan_id)},
    )
    r = row.fetchone()
    if r is None:
        return
    denom = (r.completed or 0) + (r.cancelled_by_artisan or 0)
    if denom > 0:
        rate = round(r.completed / denom, 4)
        await db.execute(
            update(ArtisanProfile)
            .where(ArtisanProfile.user_id == artisan_id)
            .values(completion_rate=rate)
        )


async def update_repeat_client_rate(artisan_id: UUID, db: AsyncSession) -> None:
    """
    Recalculate repeat_client_rate.

    repeat_client_rate = unique_clients_who_booked_2+_times / total_unique_clients
    Called after every completed booking.
    """
    from sqlalchemy import text  # noqa: PLC0415

    row = await db.execute(
        text("""
            WITH client_counts AS (
                SELECT client_id, COUNT(*) AS booking_count
                FROM bookings
                WHERE artisan_id = :aid
                  AND status = 'completed'
                GROUP BY client_id
            )
            SELECT
                COUNT(*) FILTER (WHERE booking_count >= 2) AS repeat_clients,
                COUNT(*) AS total_clients
            FROM client_counts
        """),
        {"aid": str(artisan_id)},
    )
    r = row.fetchone()
    if r and r.total_clients > 0:
        rate = round(r.repeat_clients / r.total_clients, 4)
        await db.execute(
            update(ArtisanProfile)
            .where(ArtisanProfile.user_id == artisan_id)
            .values(repeat_client_rate=rate)
        )


# ── Private helpers ───────────────────────────────────────────────────────────


async def _decrement_response_rate(artisan_id: UUID, db: AsyncSession) -> None:
    """Quick-decrement response_rate without full recalculation (used in auto-cancel path)."""
    profile = await db.scalar(
        select(ArtisanProfile).where(ArtisanProfile.user_id == artisan_id)
    )
    if profile:
        new_rate = max(0.0, round(profile.response_rate - 0.05, 4))
        await db.execute(
            update(ArtisanProfile)
            .where(ArtisanProfile.user_id == artisan_id)
            .values(response_rate=new_rate)
        )


async def _increment_auto_cancelled_count(artisan_id: UUID, db: AsyncSession) -> None:
    """
    Placeholder for Sprint 5 — increment auto_cancelled_count on ArtisanProfile.
    The column will be added in Sprint 5's migration.
    For now, we log only.
    """
    _log.info("auto_cancel_count++ for artisan %s", artisan_id)
