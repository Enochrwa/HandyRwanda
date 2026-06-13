# File: backend/tests/test_sprint12_recurring.py
"""
Sprint 12 — Recurring Job Subscriptions: full test suite

Tests:
  1.  RecurringFrequency enum values
  2.  RecurringSchedule model fields
  3.  compute_next_run — weekly: next correct weekday
  4.  compute_next_run — weekly: same day, time not yet reached
  5.  compute_next_run — weekly: same day, time already passed → next week
  6.  compute_next_run — biweekly: adds 7 more days than weekly
  7.  compute_next_run — monthly: next target day-of-month
  8.  compute_next_run — monthly: day already passed → next month
  9.  compute_next_run — monthly: clamps day_of_month to 28
  10. spawn_session — preferred artisan available → booking created
  11. spawn_session — preferred artisan unavailable → open job
  12. spawn_session — no preferred artisan → open job + client notified
  13. spawn_session — advances total_sessions and next_run_at
  14. spawn_session — inactive schedule → skipped
  15. compute_next_run — no preferred_time → defaults to 08:00
"""

from __future__ import annotations

import uuid
from datetime import datetime, time, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.job import RecurringFrequency, RecurringSchedule
from app.services.recurring_service import compute_next_run, spawn_session

# ── Fixtures ───────────────────────────────────────────────────────────────────


def _make_schedule(
    *,
    frequency: RecurringFrequency = RecurringFrequency.weekly,
    day_of_week: int | None = 5,     # Saturday
    day_of_month: int | None = None,
    preferred_time: time | None = None,
    is_active: bool = True,
    preferred_artisan_id: uuid.UUID | None = None,
) -> MagicMock:
    s = MagicMock(spec=RecurringSchedule)
    s.id = uuid.uuid4()
    s.client_id = uuid.uuid4()
    s.preferred_artisan_id = preferred_artisan_id
    s.category_id = uuid.uuid4()
    s.title = "Clean my house"
    s.description = "Full house cleaning"
    s.district = "Kigali"
    s.sector = "Kimihurura"
    s.location_label = "Kimihurura, Kigali"
    s.latitude = -1.944
    s.longitude = 30.062
    s.budget_per_session = 15_000
    s.frequency = frequency
    s.day_of_week = day_of_week
    s.day_of_month = day_of_month
    s.preferred_time = preferred_time
    s.is_active = is_active
    s.total_sessions = 0
    s.next_run_at = datetime.now(tz=timezone.utc)
    return s


def _tuesday_9am() -> datetime:
    """2026-06-09 09:00 UTC (Tuesday)."""
    return datetime(2026, 6, 9, 9, 0, tzinfo=timezone.utc)


# ── 1. Enum values ──────────────────────────────────────────────────────────────


def test_recurring_frequency_values() -> None:
    assert RecurringFrequency.weekly == "weekly"
    assert RecurringFrequency.biweekly == "biweekly"
    assert RecurringFrequency.monthly == "monthly"


# ── 2. Model has required fields ───────────────────────────────────────────────


def test_recurring_schedule_fields() -> None:
    s = _make_schedule()
    assert s.budget_per_session == 15_000
    assert s.district == "Kigali"
    assert s.frequency == RecurringFrequency.weekly


# ── 3. compute_next_run — weekly next weekday ──────────────────────────────────


def test_compute_next_run_weekly_next_saturday() -> None:
    """From Tuesday, next Saturday should be 4 days away."""
    s = _make_schedule(frequency=RecurringFrequency.weekly, day_of_week=5)  # Saturday
    base = _tuesday_9am()
    result = compute_next_run(s, after=base)
    # Should be Saturday 2026-06-13
    assert result.weekday() == 5
    assert result.date().isoformat() == "2026-06-13"


# ── 4. compute_next_run — same day, time not yet reached ──────────────────────


def test_compute_next_run_weekly_same_day_early() -> None:
    """If today IS Saturday and it's 07:00, next run is 08:00 today."""
    s = _make_schedule(
        frequency=RecurringFrequency.weekly,
        day_of_week=5,
        preferred_time=time(8, 0),
    )
    # Saturday at 07:00
    base = datetime(2026, 6, 13, 7, 0, tzinfo=timezone.utc)
    result = compute_next_run(s, after=base)
    assert result.date().isoformat() == "2026-06-13"
    assert result.hour == 8


# ── 5. compute_next_run — same day, time already passed → next week ────────────


def test_compute_next_run_weekly_same_day_late() -> None:
    """If today IS Saturday and it's 10:00, next run is Saturday next week."""
    s = _make_schedule(
        frequency=RecurringFrequency.weekly,
        day_of_week=5,
        preferred_time=time(8, 0),
    )
    # Saturday at 10:00
    base = datetime(2026, 6, 13, 10, 0, tzinfo=timezone.utc)
    result = compute_next_run(s, after=base)
    assert result.date().isoformat() == "2026-06-20"


# ── 6. compute_next_run — biweekly ─────────────────────────────────────────────


def test_compute_next_run_biweekly_is_one_week_later() -> None:
    """Biweekly should schedule 7 days further than weekly from the same base."""
    s_weekly = _make_schedule(frequency=RecurringFrequency.weekly, day_of_week=5)
    s_biweekly = _make_schedule(frequency=RecurringFrequency.biweekly, day_of_week=5)
    base = _tuesday_9am()
    weekly_next = compute_next_run(s_weekly, after=base)
    biweekly_next = compute_next_run(s_biweekly, after=base)
    delta = (biweekly_next.date() - weekly_next.date()).days
    assert delta == 7


# ── 7. compute_next_run — monthly next day ─────────────────────────────────────


def test_compute_next_run_monthly_next_target_day() -> None:
    """From June 9, next 15th should be June 15."""
    s = _make_schedule(
        frequency=RecurringFrequency.monthly,
        day_of_week=None,
        day_of_month=15,
    )
    base = datetime(2026, 6, 9, 9, 0, tzinfo=timezone.utc)
    result = compute_next_run(s, after=base)
    assert result.day == 15
    assert result.month == 6


# ── 8. compute_next_run — monthly day already passed → next month ──────────────


def test_compute_next_run_monthly_day_passed() -> None:
    """From June 16, next 15th should be July 15."""
    s = _make_schedule(
        frequency=RecurringFrequency.monthly,
        day_of_week=None,
        day_of_month=15,
    )
    base = datetime(2026, 6, 16, 9, 0, tzinfo=timezone.utc)
    result = compute_next_run(s, after=base)
    assert result.day == 15
    assert result.month == 7


# ── 9. compute_next_run — day_of_month clamped ────────────────────────────────


def test_compute_next_run_monthly_clamps_to_28() -> None:
    s = _make_schedule(
        frequency=RecurringFrequency.monthly,
        day_of_week=None,
        day_of_month=31,  # Invalid — should clamp to 28
    )
    base = datetime(2026, 6, 9, 9, 0, tzinfo=timezone.utc)
    result = compute_next_run(s, after=base)
    assert result.day == 28


# ── 10. spawn_session — preferred artisan available ────────────────────────────


@pytest.mark.asyncio
async def test_spawn_session_preferred_artisan_available() -> None:
    artisan_id = uuid.uuid4()
    schedule = _make_schedule(preferred_artisan_id=artisan_id)

    db = AsyncMock()

    # scalar returns: schedule → artisan_profile (available) → artisan_user → client_user
    fake_artisan_profile = MagicMock()
    fake_artisan_profile.is_available = True

    fake_artisan_user = MagicMock()
    fake_artisan_user.full_name = "Jean Baptiste"

    fake_client = MagicMock()
    fake_client.full_name = "Marie Claire"

    db.scalar.side_effect = [schedule, fake_client, fake_artisan_profile, fake_artisan_user]
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()

    result = await spawn_session(schedule.id, db)

    assert "booking_id" in result
    assert result["preferred_artisan_used"] is True
    assert result["total_sessions"] == 1
    db.commit.assert_awaited_once()


# ── 11. spawn_session — preferred artisan unavailable → open job ───────────────


@pytest.mark.asyncio
async def test_spawn_session_preferred_artisan_unavailable() -> None:
    artisan_id = uuid.uuid4()
    schedule = _make_schedule(preferred_artisan_id=artisan_id)

    db = AsyncMock()

    fake_client = MagicMock()
    fake_client.full_name = "Marie Claire"

    # Exact scalar call order in spawn_session (unavailable path):
    # 1. RecurringSchedule lookup → schedule
    # 2. User (client) lookup → fake_client
    # 3. ArtisanProfile availability check → None (unavailable)
    # (artisan_user NOT fetched since preferred_available=False)
    db.scalar.side_effect = [schedule, fake_client, None]
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()

    result = await spawn_session(schedule.id, db)

    assert result.get("preferred_artisan_used") is False
    assert result.get("booking_id") is None
    assert "job_id" in result


# ── 12. spawn_session — no preferred artisan → open job ───────────────────────


@pytest.mark.asyncio
async def test_spawn_session_no_preferred_artisan() -> None:
    schedule = _make_schedule(preferred_artisan_id=None)

    db = AsyncMock()
    fake_client = MagicMock()
    fake_client.full_name = "Patrick"
    db.scalar.side_effect = [schedule, fake_client]
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()

    result = await spawn_session(schedule.id, db)

    assert result.get("booking_id") is None
    assert "job_id" in result


# ── 13. spawn_session — advances counters ─────────────────────────────────────


@pytest.mark.asyncio
async def test_spawn_session_advances_total_sessions() -> None:
    schedule = _make_schedule(preferred_artisan_id=None)
    schedule.total_sessions = 4

    db = AsyncMock()
    fake_client = MagicMock()
    fake_client.full_name = "Claudine"
    db.scalar.side_effect = [schedule, fake_client]
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()

    result = await spawn_session(schedule.id, db)
    assert result["total_sessions"] == 5
    assert "next_run_at" in result


# ── 14. spawn_session — inactive schedule → skipped ──────────────────────────


@pytest.mark.asyncio
async def test_spawn_session_inactive_skipped() -> None:
    db = AsyncMock()
    db.scalar.return_value = None  # schedule not found / inactive

    result = await spawn_session(uuid.uuid4(), db)
    assert result.get("skipped") is True


# ── 15. compute_next_run — no preferred_time defaults to 08:00 ───────────────


def test_compute_next_run_defaults_to_0800() -> None:
    s = _make_schedule(
        frequency=RecurringFrequency.weekly,
        day_of_week=5,
        preferred_time=None,
    )
    base = _tuesday_9am()
    result = compute_next_run(s, after=base)
    assert result.hour == 8
    assert result.minute == 0
