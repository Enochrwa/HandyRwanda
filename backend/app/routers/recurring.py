# File: backend/app/routers/recurring.py
"""
Sprint 12 — Recurring Job Subscriptions Router

POST   /recurring                  — create a recurring schedule
GET    /recurring/mine             — list client's active schedules
GET    /recurring/{id}             — schedule detail
PATCH  /recurring/{id}             — update frequency/budget/preferred artisan
DELETE /recurring/{id}             — cancel (sets is_active=False)
POST   /recurring/{id}/pause       — pause without cancelling
POST   /recurring/{id}/resume      — resume a paused schedule
POST   /recurring/{id}/spawn-now   — admin/debug: trigger a session immediately
"""

from datetime import datetime, time, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.job import RecurringFrequency, RecurringSchedule
from app.models.user import UserRole
from app.services.recurring_service import compute_next_run

router = APIRouter(prefix="/recurring", tags=["recurring"])

# ── Schemas ───────────────────────────────────────────────────────────────────


class RecurringCreate(BaseModel):
    category_id: str
    title: str = Field(..., min_length=3, max_length=200)
    description: str = Field(..., min_length=10, max_length=1000)
    district: str = Field(..., min_length=2, max_length=100)
    sector: str | None = Field(None, max_length=100)
    location_label: str | None = Field(None, max_length=400)
    latitude: float | None = None
    longitude: float | None = None
    budget_per_session: int = Field(..., ge=500)
    frequency: RecurringFrequency
    day_of_week: int | None = Field(None, ge=0, le=6, description="0=Mon, 6=Sun")
    day_of_month: int | None = Field(None, ge=1, le=28)
    preferred_time: str | None = Field(None, description="HH:MM 24h format")
    preferred_artisan_id: str | None = None


class RecurringUpdate(BaseModel):
    title: str | None = Field(None, min_length=3, max_length=200)
    description: str | None = Field(None, min_length=10, max_length=1000)
    budget_per_session: int | None = Field(None, ge=500)
    frequency: RecurringFrequency | None = None
    day_of_week: int | None = Field(None, ge=0, le=6)
    day_of_month: int | None = Field(None, ge=1, le=28)
    preferred_time: str | None = None
    preferred_artisan_id: str | None = None


# ── Serialisation ─────────────────────────────────────────────────────────────


def _serialize(s: RecurringSchedule) -> dict[str, Any]:
    return {
        "id": str(s.id),
        "client_id": str(s.client_id),
        "preferred_artisan_id": str(s.preferred_artisan_id) if s.preferred_artisan_id else None,
        "category_id": str(s.category_id),
        "title": s.title,
        "description": s.description,
        "district": s.district,
        "sector": s.sector,
        "location_label": s.location_label,
        "latitude": s.latitude,
        "longitude": s.longitude,
        "budget_per_session": s.budget_per_session,
        "frequency": s.frequency,
        "day_of_week": s.day_of_week,
        "day_of_month": s.day_of_month,
        "preferred_time": s.preferred_time.strftime("%H:%M") if s.preferred_time else None,
        "is_active": s.is_active,
        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
        "total_sessions": s.total_sessions,
        "paused_at": s.paused_at.isoformat() if s.paused_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _parse_preferred_time(time_str: str | None) -> time | None:
    if not time_str:
        return None
    try:
        parts = time_str.split(":")
        return time(int(parts[0]), int(parts[1]))
    except (ValueError, IndexError):
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("", status_code=201)
async def create_recurring(
    payload: RecurringCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Create a new recurring job schedule."""
    client_id = UUID(current_user["sub"])

    # Validate frequency constraints
    if payload.frequency in (RecurringFrequency.weekly, RecurringFrequency.biweekly):
        if payload.day_of_week is None:
            raise HTTPException(status_code=400, detail="day_of_week required for weekly/biweekly.")
    elif payload.frequency == RecurringFrequency.monthly:
        if payload.day_of_month is None:
            raise HTTPException(status_code=400, detail="day_of_month required for monthly.")

    preferred_time = _parse_preferred_time(payload.preferred_time)

    schedule = RecurringSchedule(
        client_id=client_id,
        preferred_artisan_id=UUID(payload.preferred_artisan_id) if payload.preferred_artisan_id else None,
        category_id=UUID(payload.category_id),
        title=payload.title,
        description=payload.description,
        district=payload.district,
        sector=payload.sector,
        location_label=payload.location_label,
        latitude=payload.latitude,
        longitude=payload.longitude,
        budget_per_session=payload.budget_per_session,
        frequency=payload.frequency,
        day_of_week=payload.day_of_week,
        day_of_month=payload.day_of_month,
        preferred_time=preferred_time,
        is_active=True,
        total_sessions=0,
        next_run_at=datetime.now(tz=timezone.utc),  # will be computed below
    )

    # Compute first run time before persisting
    schedule.next_run_at = compute_next_run(schedule)

    db.add(schedule)
    await db.commit()
    await db.refresh(schedule)
    return _serialize(schedule)


@router.get("/mine")
async def list_my_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    client_id = UUID(current_user["sub"])
    result = await db.execute(
        select(RecurringSchedule)
        .where(RecurringSchedule.client_id == client_id)
        .order_by(RecurringSchedule.created_at.desc())
    )
    return [_serialize(s) for s in result.scalars().all()]


@router.get("/{schedule_id}")
async def get_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    s = await db.scalar(select(RecurringSchedule).where(RecurringSchedule.id == schedule_id))
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    user_id = UUID(current_user["sub"])
    if s.client_id != user_id and current_user.get("role") != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorised.")
    return _serialize(s)


@router.patch("/{schedule_id}")
async def update_schedule(
    schedule_id: UUID,
    payload: RecurringUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    client_id = UUID(current_user["sub"])
    s = await db.scalar(
        select(RecurringSchedule).where(
            RecurringSchedule.id == schedule_id, RecurringSchedule.client_id == client_id
        )
    )
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    if not s.is_active:
        raise HTTPException(status_code=400, detail="Cannot update a cancelled schedule.")

    if payload.title is not None:
        s.title = payload.title
    if payload.description is not None:
        s.description = payload.description
    if payload.budget_per_session is not None:
        s.budget_per_session = payload.budget_per_session
    if payload.frequency is not None:
        s.frequency = payload.frequency
    if payload.day_of_week is not None:
        s.day_of_week = payload.day_of_week
    if payload.day_of_month is not None:
        s.day_of_month = payload.day_of_month
    if payload.preferred_time is not None:
        s.preferred_time = _parse_preferred_time(payload.preferred_time)
    if payload.preferred_artisan_id is not None:
        s.preferred_artisan_id = (
            UUID(payload.preferred_artisan_id) if payload.preferred_artisan_id else None
        )

    # Recompute next_run_at if schedule changed
    s.next_run_at = compute_next_run(s)

    await db.commit()
    await db.refresh(s)
    return _serialize(s)


@router.delete("/{schedule_id}")
async def cancel_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    client_id = UUID(current_user["sub"])
    s = await db.scalar(
        select(RecurringSchedule).where(
            RecurringSchedule.id == schedule_id, RecurringSchedule.client_id == client_id
        )
    )
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found.")

    s.is_active = False
    s.cancelled_at = datetime.now(tz=timezone.utc)
    await db.commit()
    return {"message": "Recurring schedule cancelled.", "id": str(schedule_id)}


@router.post("/{schedule_id}/pause")
async def pause_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    client_id = UUID(current_user["sub"])
    s = await db.scalar(
        select(RecurringSchedule).where(
            RecurringSchedule.id == schedule_id, RecurringSchedule.client_id == client_id
        )
    )
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    if not s.is_active:
        raise HTTPException(status_code=400, detail="Schedule is already cancelled.")
    if s.paused_at:
        raise HTTPException(status_code=400, detail="Schedule is already paused.")

    s.paused_at = datetime.now(tz=timezone.utc)
    s.is_active = False
    await db.commit()
    return {"message": "Schedule paused.", "id": str(schedule_id)}


@router.post("/{schedule_id}/resume")
async def resume_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    client_id = UUID(current_user["sub"])
    s = await db.scalar(
        select(RecurringSchedule).where(
            RecurringSchedule.id == schedule_id, RecurringSchedule.client_id == client_id
        )
    )
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    if s.cancelled_at:
        raise HTTPException(status_code=400, detail="Cannot resume a cancelled schedule. Create a new one.")
    if not s.paused_at:
        raise HTTPException(status_code=400, detail="Schedule is not paused.")

    s.paused_at = None
    s.is_active = True
    s.next_run_at = compute_next_run(s)
    await db.commit()
    await db.refresh(s)
    return {**_serialize(s), "message": "Schedule resumed."}
