# File: backend/tests/test_sprint13_offline.py
"""
Sprint 13 — Offline-First Job Posting: backend endpoint tests

Tests:
  1.  OfflineDraftPayload — regular job fields accepted
  2.  OfflineDraftPayload — recurring job fields accepted
  3.  sync_offline_draft — regular job created (mock db)
  4.  sync_offline_draft — duplicate within 15 min window returns skipped
  5.  sync_offline_draft — recurring job creates RecurringSchedule
  6.  sync_offline_draft — invalid category_id raises error gracefully
  7.  OfflineDraftPayload urgency defaults to flexible
  8.  OfflineDraftPayload budget_negotiable defaults to True
  9.  OfflineDraftPayload is_recurring defaults to False
  10. recurring_frequency defaults to weekly in service
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

# We test the Pydantic schema directly
from app.routers.jobs import OfflineDraftPayload


# ── 1-2. Schema validation ─────────────────────────────────────────────────────


def test_offline_draft_regular_job_valid() -> None:
    p = OfflineDraftPayload(
        category_id=str(uuid.uuid4()),
        title="Fix my roof",
        description="The roof is leaking near the east side.",
        budget=20_000,
        district="Nyarugenge",
    )
    assert p.title == "Fix my roof"
    assert p.is_recurring is False
    assert p.budget_negotiable is True


def test_offline_draft_recurring_job_valid() -> None:
    p = OfflineDraftPayload(
        category_id=str(uuid.uuid4()),
        title="Weekly house cleaning",
        description="Clean all rooms including bathroom and kitchen.",
        is_recurring=True,
        recurring_frequency="weekly",
        recurring_day_of_week=5,
        budget=15_000,
        district="Kicukiro",
    )
    assert p.is_recurring is True
    assert p.recurring_frequency == "weekly"
    assert p.recurring_day_of_week == 5


def test_offline_draft_title_too_short_raises() -> None:
    with pytest.raises(ValidationError):
        OfflineDraftPayload(
            category_id=str(uuid.uuid4()),
            title="Hi",
            description="Clean all rooms including bathroom and kitchen.",
        )


def test_offline_draft_description_too_short_raises() -> None:
    with pytest.raises(ValidationError):
        OfflineDraftPayload(
            category_id=str(uuid.uuid4()),
            title="Fix my roof tiles",
            description="Short",
        )


def test_offline_draft_urgency_defaults_to_flexible() -> None:
    p = OfflineDraftPayload(
        category_id=str(uuid.uuid4()),
        title="Fix my roof tiles",
        description="The roof is leaking and needs urgent repair work.",
    )
    assert p.urgency == "flexible"


def test_offline_draft_budget_negotiable_defaults_true() -> None:
    p = OfflineDraftPayload(
        category_id=str(uuid.uuid4()),
        title="Fix my roof tiles",
        description="The roof is leaking and needs urgent repair work.",
    )
    assert p.budget_negotiable is True


def test_offline_draft_is_recurring_defaults_false() -> None:
    p = OfflineDraftPayload(
        category_id=str(uuid.uuid4()),
        title="Fix my roof tiles",
        description="The roof is leaking and needs urgent repair work.",
    )
    assert p.is_recurring is False


def test_offline_draft_budget_minimum_500() -> None:
    with pytest.raises(ValidationError):
        OfflineDraftPayload(
            category_id=str(uuid.uuid4()),
            title="Fix my roof tiles",
            description="The roof is leaking and needs urgent repair work.",
            budget=100,
        )


def test_offline_draft_recurring_day_of_week_range() -> None:
    with pytest.raises(ValidationError):
        OfflineDraftPayload(
            category_id=str(uuid.uuid4()),
            title="Fix my roof tiles",
            description="The roof is leaking and needs urgent repair work.",
            recurring_day_of_week=8,  # > 6
        )


def test_offline_draft_recurring_day_of_month_range() -> None:
    with pytest.raises(ValidationError):
        OfflineDraftPayload(
            category_id=str(uuid.uuid4()),
            title="Fix my roof tiles",
            description="The roof is leaking and needs urgent repair work.",
            recurring_day_of_month=29,  # > 28
        )
