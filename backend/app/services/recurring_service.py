# File: backend/app/services/recurring_service.py
"""
Sprint 12 — Recurring Job Service

Handles spawning of recurring job sessions and next-run calculation.
Called by APScheduler and exposed via the /recurring router.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artisan import ArtisanProfile
from app.models.booking import Booking, BookingStatus
from app.models.job import (
    Job,
    JobStatus,
    JobUrgency,
    RecurringFrequency,
    RecurringSchedule,
)
from app.models.notification import Notification
from app.models.user import User

_log = logging.getLogger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _fmt(price: int) -> str:
    return f"{price:,}"


def _day_name(dow: int | None) -> str:
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    if dow is None or not (0 <= dow <= 6):
        return "scheduled day"
    return days[dow]


async def _notify(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    title: str,
    body: str,
    payload: dict[str, object] | None = None,
) -> None:
    db.add(Notification(user_id=user_id, event_type=event_type, title=title, body=body, payload=payload))


def compute_next_run(
    schedule: RecurringSchedule,
    after: datetime | None = None,
) -> datetime:
    """
    Compute the next UTC datetime for a recurring schedule.

    Strategy:
    - weekly:   next occurrence of day_of_week (0=Mon) at preferred_time (or 08:00)
    - biweekly: same, but skip one week
    - monthly:  next occurrence of day_of_month at preferred_time
    """
    base = after or _now()
    pref_h = schedule.preferred_time.hour if schedule.preferred_time else 8
    pref_m = schedule.preferred_time.minute if schedule.preferred_time else 0

    if schedule.frequency in (RecurringFrequency.weekly, RecurringFrequency.biweekly):
        target_dow = schedule.day_of_week if schedule.day_of_week is not None else 0
        # How many days until the next target day?
        current_dow = base.weekday()  # 0=Mon
        days_ahead = (target_dow - current_dow) % 7
        if days_ahead == 0:
            # Same day: if we haven't passed the time yet today, use today; else next week
            candidate = base.replace(hour=pref_h, minute=pref_m, second=0, microsecond=0)
            if candidate <= base:
                days_ahead = 7
        if schedule.frequency == RecurringFrequency.biweekly:
            days_ahead = days_ahead + 7 if days_ahead > 0 else 14
        result = (base + timedelta(days=days_ahead)).replace(
            hour=pref_h, minute=pref_m, second=0, microsecond=0
        )
    else:  # monthly
        target_dom = max(1, min(28, schedule.day_of_month or 1))
        # Try this month first
        try:
            candidate = base.replace(day=target_dom, hour=pref_h, minute=pref_m, second=0, microsecond=0)
        except ValueError:
            candidate = base.replace(day=28, hour=pref_h, minute=pref_m, second=0, microsecond=0)
        if candidate <= base:
            # Move to next month
            if base.month == 12:
                candidate = candidate.replace(year=base.year + 1, month=1)
            else:
                candidate = candidate.replace(month=base.month + 1)
        result = candidate

    return result


# ── Core spawn logic ──────────────────────────────────────────────────────────


async def spawn_session(schedule_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """
    Called by APScheduler at each `next_run_at`.
    Creates a Job + optionally a Booking, then advances the schedule.
    """
    schedule = await db.scalar(
        select(RecurringSchedule).where(
            RecurringSchedule.id == schedule_id,
            RecurringSchedule.is_active == True,  # noqa: E712
        )
    )
    if not schedule:
        _log.warning("[Recurring] Schedule %s not found or inactive — skipping", schedule_id)
        return {"skipped": True, "reason": "not_found_or_inactive"}

    client = await db.scalar(select(User).where(User.id == schedule.client_id))
    client_name = client.full_name if client else "Client"

    # Check preferred artisan availability
    preferred_available = False
    if schedule.preferred_artisan_id:
        artisan = await db.scalar(
            select(ArtisanProfile).where(
                ArtisanProfile.user_id == schedule.preferred_artisan_id,
                ArtisanProfile.is_available == True,  # noqa: E712
            )
        )
        preferred_available = artisan is not None

    # Create the Job
    job = Job(
        client_id=schedule.client_id,
        category_id=schedule.category_id,
        title=schedule.title,
        description=schedule.description,
        district=schedule.district,
        sector=schedule.sector,
        location_label=schedule.location_label,
        latitude=schedule.latitude,
        longitude=schedule.longitude,
        budget=schedule.budget_per_session,
        budget_negotiable=False,
        urgency=JobUrgency.this_week,
        status=JobStatus.booked if preferred_available else JobStatus.open,
        recurring_schedule_id=schedule.id,
    )
    db.add(job)
    await db.flush()

    booking_id: UUID | None = None
    artisan_name = "your regular artisan"

    if preferred_available and schedule.preferred_artisan_id:
        # Directly create a confirmed booking with the preferred artisan
        artisan_user = await db.scalar(
            select(User).where(User.id == schedule.preferred_artisan_id)
        )
        artisan_name = artisan_user.full_name if artisan_user else artisan_name

        booking = Booking(
            job_id=job.id,
            client_id=schedule.client_id,
            artisan_id=schedule.preferred_artisan_id,
            status=BookingStatus.pending_payment,
            agreed_price=schedule.budget_per_session,
        )
        db.add(booking)
        await db.flush()
        booking_id = booking.id

        # Notify artisan
        await _notify(
            db,
            schedule.preferred_artisan_id,
            "recurring_booking_created",
            "🔄 Recurring booking scheduled",
            f"Recurring booking from {client_name} — {schedule.title}, "
            f"{_day_name(schedule.day_of_week)}. {_fmt(schedule.budget_per_session)} RWF.",
            {"booking_id": str(booking_id), "schedule_id": str(schedule_id)},
        )

        # Notify client
        await _notify(
            db,
            schedule.client_id,
            "recurring_session_confirmed",
            "✅ Recurring session auto-scheduled",
            f"Your recurring booking has been auto-scheduled with {artisan_name}. "
            f"Awaiting MoMo payment confirmation.",
            {"booking_id": str(booking_id), "schedule_id": str(schedule_id)},
        )
    # Open job — notify matching artisans (simplified here; full match logic via matching_service)
    elif schedule.preferred_artisan_id:
        # Preferred artisan unavailable — warn client
        await _notify(
            db,
            schedule.client_id,
            "recurring_artisan_unavailable",
            "⚠️ Your regular artisan is unavailable",
            f"Your regular artisan is unavailable this week for '{schedule.title}'. "
            "We're finding you a replacement — check new bids soon.",
            {"job_id": str(job.id), "schedule_id": str(schedule_id)},
        )
    else:
        await _notify(
            db,
            schedule.client_id,
            "recurring_session_open",
            "🔄 Recurring job posted",
            f"Your recurring job '{schedule.title}' has been posted. "
            "Artisans will start bidding shortly.",
            {"job_id": str(job.id), "schedule_id": str(schedule_id)},
        )

    # Advance schedule
    schedule.next_run_at = compute_next_run(schedule)
    schedule.total_sessions = schedule.total_sessions + 1

    await db.commit()

    _log.info(
        "[Recurring] Spawned session for schedule %s → job %s (preferred_available=%s, next=%s)",
        schedule_id, job.id, preferred_available, schedule.next_run_at,
    )

    return {
        "job_id": str(job.id),
        "booking_id": str(booking_id) if booking_id else None,
        "preferred_artisan_used": preferred_available,
        "next_run_at": schedule.next_run_at.isoformat(),
        "total_sessions": schedule.total_sessions,
    }


# ── APScheduler dispatcher (called from main.py lifespan) ─────────────────────


async def recurring_dispatcher(async_session_factory: object) -> None:
    """
    Scan recurring_schedules for rows whose next_run_at ≤ now and spawn sessions.
    Designed to run every 15 minutes via APScheduler.
    `async_session_factory` is AsyncSessionLocal from app.database.
    """
    import datetime as _dt  # noqa: PLC0415

    from sqlalchemy import select as _select  # noqa: PLC0415

    now = _dt.datetime.now(tz=_dt.timezone.utc)

    # async_session_factory is AsyncSessionLocal
    async with async_session_factory() as session:  # type: ignore[operator]
        result = await session.execute(
            _select(RecurringSchedule).where(
                RecurringSchedule.is_active == True,  # noqa: E712
                RecurringSchedule.next_run_at <= now,
            )
        )
        due = result.scalars().all()
        for sched in due:
            try:
                info = await spawn_session(sched.id, session)
                _log.info("[Recurring] Spawned: %s", info)
            except Exception as exc:  # noqa: BLE001
                _log.error("[Recurring] Spawn failed for %s: %s", sched.id, exc)
