# File: backend/app/routers/schedule.py
"""
Artisan availability schedule router.

GET  /schedule/me                     — artisan: get my weekly schedule + blocked dates
POST /schedule/slots                  — artisan: set/replace weekly schedule
POST /schedule/blocked                — artisan: add a blocked date
DELETE /schedule/blocked/{date}       — artisan: remove a blocked date
GET  /schedule/{artisan_id}/available — public: check if artisan is available on a date
"""

from datetime import date, datetime, time, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import require_role
from app.models.booking import Booking, BookingStatus
from app.models.job import Job
from app.models.schedule import ArtisanSchedule, BlockedDate
from app.models.user import UserRole

router = APIRouter(prefix="/schedule", tags=["schedule"])


class ScheduleSlot(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    start_time: time
    end_time: time


class BlockedDateCreate(BaseModel):
    blocked_date: date
    reason: str | None = None


@router.get("/me")
async def get_my_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    artisan_id = UUID(current_user["sub"])

    slots_result = await db.execute(
        select(ArtisanSchedule)
        .where(ArtisanSchedule.artisan_id == artisan_id, ArtisanSchedule.is_active)
        .order_by(ArtisanSchedule.day_of_week, ArtisanSchedule.start_time)
    )
    slots = [
        {
            "id": str(s.id),
            "day_of_week": s.day_of_week,
            "start_time": s.start_time.isoformat(),
            "end_time": s.end_time.isoformat(),
        }
        for s in slots_result.scalars().all()
    ]

    blocked_result = await db.execute(
        select(BlockedDate)
        .where(BlockedDate.artisan_id == artisan_id)
        .order_by(BlockedDate.blocked_date)
    )
    blocked = [
        {
            "id": str(b.id),
            "blocked_date": b.blocked_date.isoformat(),
            "reason": b.reason,
        }
        for b in blocked_result.scalars().all()
    ]

    return {"schedule": slots, "blocked_dates": blocked}


@router.post("/slots")
async def set_schedule(
    slots: list[ScheduleSlot],
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    artisan_id = UUID(current_user["sub"])

    # Replace existing schedule
    await db.execute(
        delete(ArtisanSchedule).where(ArtisanSchedule.artisan_id == artisan_id)
    )
    for slot in slots:
        if slot.end_time <= slot.start_time:
            raise HTTPException(
                status_code=400,
                detail=f"end_time must be after start_time for day {slot.day_of_week}",
            )
        db.add(
            ArtisanSchedule(
                artisan_id=artisan_id,
                day_of_week=slot.day_of_week,
                start_time=slot.start_time,
                end_time=slot.end_time,
                is_active=True,
            )
        )
    await db.commit()
    return {"message": f"{len(slots)} schedule slots saved."}


@router.post("/blocked")
async def add_blocked_date(
    payload: BlockedDateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    artisan_id = UUID(current_user["sub"])
    db.add(
        BlockedDate(
            artisan_id=artisan_id,
            blocked_date=payload.blocked_date,
            reason=payload.reason,
        )
    )
    await db.commit()
    return {"message": "Blocked date added."}


@router.delete("/blocked/{blocked_date}")
async def remove_blocked_date(
    blocked_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    artisan_id = UUID(current_user["sub"])
    await db.execute(
        delete(BlockedDate).where(
            BlockedDate.artisan_id == artisan_id,
            BlockedDate.blocked_date == blocked_date,
        )
    )
    await db.commit()
    return {"message": "Blocked date removed."}


@router.get("/{artisan_id}/available")
async def check_artisan_availability(
    artisan_id: UUID,
    check_date: date,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Public: check if an artisan is available on a specific date.
    Returns available time slots and any conflicts.
    """
    # Check blocked dates
    blocked = await db.scalar(
        select(BlockedDate).where(
            BlockedDate.artisan_id == artisan_id,
            BlockedDate.blocked_date == check_date,
        )
    )
    if blocked:
        return {
            "available": False,
            "reason": "blocked",
            "slots": [],
        }

    # Get weekly schedule for this day of week
    day_of_week = check_date.weekday()  # 0=Monday
    slots_result = await db.execute(
        select(ArtisanSchedule).where(
            ArtisanSchedule.artisan_id == artisan_id,
            ArtisanSchedule.day_of_week == day_of_week,
            ArtisanSchedule.is_active,
        )
    )
    slots = slots_result.scalars().all()

    if not slots:
        return {
            "available": False,
            "reason": "no_schedule",
            "slots": [],
        }

    # Check for existing confirmed bookings on this date
    day_start = datetime.combine(check_date, datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    day_end = datetime.combine(check_date, datetime.max.time()).replace(
        tzinfo=timezone.utc
    )

    bookings_result = await db.execute(
        select(Booking, Job)
        .join(Job, Booking.job_id == Job.id)
        .where(
            Booking.artisan_id == artisan_id,
            Booking.status.in_([BookingStatus.confirmed, BookingStatus.in_progress]),
            Job.scheduled_time.between(day_start, day_end),
        )
    )
    booked_times = [
        {
            "start": row[1].scheduled_time.isoformat()
            if row[1].scheduled_time
            else None,
            "job_title": row[1].title,
        }
        for row in bookings_result.all()
        if row[1].scheduled_time
    ]

    return {
        "available": True,
        "slots": [
            {"start_time": s.start_time.isoformat(), "end_time": s.end_time.isoformat()}
            for s in slots
        ],
        "booked_slots": booked_times,
    }
