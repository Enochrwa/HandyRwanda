# File: backend/tests/test_sprint11_negotiation.py
"""
Sprint 11 — Price Negotiation / Counter-Offer Flow: full test suite

Tests cover:
  1. Model fields — BidStatus enum values
  2. Unit: client_counter_offer — happy path, guards (wrong status, max rounds)
  3. Unit: artisan_accept_counter — happy path, booking creation
  4. Unit: artisan_reject_counter — status transition
  5. Unit: artisan_propose_middle — happy path, round increment
  6. Unit: client_accept_artisan_counter — booking at artisan price
  7. Unit: client_reject_artisan_counter — status transition
  8. Unit: _build_negotiation_timeline — event ordering
  9. Unit: _current_offer_price — price resolution
 10. Guard: counter on already-accepted bid
 11. Guard: counter price below 500 RWF
 12. Guard: max rounds enforcement → negotiation_expired
 13. Guard: wrong ownership (403 paths)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.job import Bid, BidStatus
from app.services.negotiation_service import (
    MAX_NEGOTIATION_ROUNDS,
    artisan_accept_counter,
    artisan_propose_middle,
    artisan_reject_counter,
    client_accept_artisan_counter,
    client_counter_offer,
    client_reject_artisan_counter,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────


def _make_job(client_id: uuid.UUID | None = None) -> MagicMock:
    job = MagicMock()
    job.id = uuid.uuid4()
    job.client_id = client_id or uuid.uuid4()
    job.title = "Fix kitchen sink"
    return job


def _make_bid(
    *,
    artisan_id: uuid.UUID | None = None,
    job_id: uuid.UUID | None = None,
    status: BidStatus = BidStatus.pending,
    proposed_price: int = 15_000,
    counter_price: int | None = None,
    counter_at: datetime | None = None,
    artisan_counter_price: int | None = None,
    artisan_counter_at: datetime | None = None,
    negotiation_round: int = 0,
) -> MagicMock:
    bid = MagicMock(spec=Bid)
    bid.id = uuid.uuid4()
    bid.job_id = job_id or uuid.uuid4()
    bid.artisan_id = artisan_id or uuid.uuid4()
    bid.status = status
    bid.proposed_price = proposed_price
    bid.counter_price = counter_price
    bid.counter_message = None
    bid.counter_at = counter_at
    bid.artisan_counter_price = artisan_counter_price
    bid.artisan_counter_message = None
    bid.artisan_counter_at = artisan_counter_at
    bid.negotiation_round = negotiation_round
    bid.created_at = datetime.now(timezone.utc)
    return bid


def _make_db(bid: MagicMock, job: MagicMock) -> AsyncMock:
    """Create a mock AsyncSession whose first select returns (bid, job)."""
    db = AsyncMock()

    # execute() returns a result whose .first() returns (bid, job)
    exec_result = MagicMock()
    exec_result.first.return_value = (bid, job)
    db.execute.return_value = exec_result

    # scalar() returns a fake user for name lookups
    fake_user = MagicMock()
    fake_user.full_name = "Test User"
    db.scalar.return_value = fake_user

    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


# ── 1. BidStatus enum values ──────────────────────────────────────────────────


def test_bid_status_has_negotiation_values() -> None:
    assert BidStatus.countered_by_client == "countered_by_client"
    assert BidStatus.artisan_countered == "artisan_countered"
    assert BidStatus.negotiation_expired == "negotiation_expired"


# ── 2. client_counter_offer ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_client_counter_happy_path() -> None:
    client_id = uuid.uuid4()
    job = _make_job(client_id=client_id)
    bid = _make_bid(job_id=job.id, status=BidStatus.pending)
    db = _make_db(bid, job)

    result = await client_counter_offer(db, bid.id, client_id, 12_000, "Can you do cheaper?")

    assert "error" not in result
    assert bid.counter_price == 12_000
    assert bid.counter_message == "Can you do cheaper?"
    assert bid.status == BidStatus.countered_by_client
    assert bid.negotiation_round == 1
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_client_counter_wrong_owner_returns_403() -> None:
    job = _make_job()
    bid = _make_bid(job_id=job.id, status=BidStatus.pending)
    db = _make_db(bid, job)

    result = await client_counter_offer(db, bid.id, uuid.uuid4(), 12_000, None)

    assert result["code"] == 403


@pytest.mark.asyncio
async def test_client_counter_on_accepted_bid_returns_400() -> None:
    client_id = uuid.uuid4()
    job = _make_job(client_id=client_id)
    bid = _make_bid(job_id=job.id, status=BidStatus.accepted)
    db = _make_db(bid, job)

    result = await client_counter_offer(db, bid.id, client_id, 12_000, None)

    assert result["code"] == 400
    assert "Cannot counter" in result["error"]


@pytest.mark.asyncio
async def test_client_counter_below_minimum_returns_400() -> None:
    client_id = uuid.uuid4()
    job = _make_job(client_id=client_id)
    bid = _make_bid(job_id=job.id, status=BidStatus.pending)
    db = _make_db(bid, job)

    result = await client_counter_offer(db, bid.id, client_id, 400, None)

    assert result["code"] == 400
    assert "500 RWF" in result["error"]


@pytest.mark.asyncio
async def test_client_counter_max_rounds_guard() -> None:
    client_id = uuid.uuid4()
    job = _make_job(client_id=client_id)
    bid = _make_bid(
        job_id=job.id,
        status=BidStatus.artisan_countered,
        negotiation_round=MAX_NEGOTIATION_ROUNDS,
    )
    db = _make_db(bid, job)

    result = await client_counter_offer(db, bid.id, client_id, 10_000, None)

    assert result["code"] == 400
    assert "Maximum negotiation rounds" in result["error"]


@pytest.mark.asyncio
async def test_client_counter_bid_not_found() -> None:
    db = AsyncMock()
    exec_result = MagicMock()
    exec_result.first.return_value = None
    db.execute.return_value = exec_result

    result = await client_counter_offer(db, uuid.uuid4(), uuid.uuid4(), 10_000, None)

    assert result["code"] == 404


# ── 3. artisan_accept_counter ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_artisan_accept_counter_happy_path() -> None:
    artisan_id = uuid.uuid4()
    client_id = uuid.uuid4()
    job = _make_job(client_id=client_id)
    bid = _make_bid(
        artisan_id=artisan_id,
        job_id=job.id,
        status=BidStatus.countered_by_client,
        counter_price=12_000,
        counter_at=datetime.now(timezone.utc),
    )
    db = _make_db(bid, job)

    result = await artisan_accept_counter(db, bid.id, artisan_id)

    assert "error" not in result
    assert result["agreed_price"] == 12_000
    assert "booking_id" in result
    assert bid.status == BidStatus.accepted
    assert bid.proposed_price == 12_000


@pytest.mark.asyncio
async def test_artisan_accept_counter_wrong_artisan_returns_403() -> None:
    job = _make_job()
    bid = _make_bid(
        job_id=job.id,
        status=BidStatus.countered_by_client,
        counter_price=12_000,
    )
    db = _make_db(bid, job)

    result = await artisan_accept_counter(db, bid.id, uuid.uuid4())

    assert result["code"] == 403


@pytest.mark.asyncio
async def test_artisan_accept_counter_wrong_status_returns_400() -> None:
    artisan_id = uuid.uuid4()
    job = _make_job()
    bid = _make_bid(artisan_id=artisan_id, job_id=job.id, status=BidStatus.pending)
    db = _make_db(bid, job)

    result = await artisan_accept_counter(db, bid.id, artisan_id)

    assert result["code"] == 400


# ── 4. artisan_reject_counter ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_artisan_reject_counter_sets_rejected() -> None:
    artisan_id = uuid.uuid4()
    job = _make_job()
    bid = _make_bid(
        artisan_id=artisan_id,
        job_id=job.id,
        status=BidStatus.countered_by_client,
        counter_price=12_000,
    )
    db = _make_db(bid, job)

    result = await artisan_reject_counter(db, bid.id, artisan_id)

    assert "error" not in result
    assert bid.status == BidStatus.rejected
    db.commit.assert_awaited_once()


# ── 5. artisan_propose_middle ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_artisan_propose_middle_happy_path() -> None:
    artisan_id = uuid.uuid4()
    job = _make_job()
    bid = _make_bid(
        artisan_id=artisan_id,
        job_id=job.id,
        status=BidStatus.countered_by_client,
        proposed_price=15_000,
        counter_price=10_000,
        negotiation_round=1,
    )
    db = _make_db(bid, job)

    middle = 12_500
    result = await artisan_propose_middle(db, bid.id, artisan_id, middle, "Split the difference?")

    assert "error" not in result
    assert bid.artisan_counter_price == middle
    assert bid.artisan_counter_message == "Split the difference?"
    assert bid.status == BidStatus.artisan_countered


@pytest.mark.asyncio
async def test_artisan_propose_middle_at_max_rounds_expires_bid() -> None:
    artisan_id = uuid.uuid4()
    job = _make_job()
    bid = _make_bid(
        artisan_id=artisan_id,
        job_id=job.id,
        status=BidStatus.countered_by_client,
        negotiation_round=MAX_NEGOTIATION_ROUNDS,
    )
    db = _make_db(bid, job)

    result = await artisan_propose_middle(db, bid.id, artisan_id, 12_000, None)

    assert result["code"] == 400
    assert bid.status == BidStatus.negotiation_expired


# ── 6. client_accept_artisan_counter ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_client_accept_artisan_counter_creates_booking() -> None:
    client_id = uuid.uuid4()
    artisan_id = uuid.uuid4()
    job = _make_job(client_id=client_id)
    bid = _make_bid(
        artisan_id=artisan_id,
        job_id=job.id,
        status=BidStatus.artisan_countered,
        artisan_counter_price=13_000,
        artisan_counter_at=datetime.now(timezone.utc),
    )
    db = _make_db(bid, job)

    result = await client_accept_artisan_counter(db, bid.id, client_id)

    assert "error" not in result
    assert result["agreed_price"] == 13_000
    assert bid.status == BidStatus.accepted
    assert bid.proposed_price == 13_000


# ── 7. client_reject_artisan_counter ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_client_reject_artisan_counter_sets_rejected() -> None:
    client_id = uuid.uuid4()
    job = _make_job(client_id=client_id)
    bid = _make_bid(
        job_id=job.id,
        status=BidStatus.artisan_countered,
        artisan_counter_price=13_000,
    )
    db = _make_db(bid, job)

    result = await client_reject_artisan_counter(db, bid.id, client_id)

    assert "error" not in result
    assert bid.status == BidStatus.rejected


# ── 8. _build_negotiation_timeline ───────────────────────────────────────────


def test_negotiation_timeline_ordering() -> None:
    from app.routers.bids import _build_negotiation_timeline

    now = datetime.now(timezone.utc)
    bid = _make_bid(
        status=BidStatus.artisan_countered,
        proposed_price=15_000,
        counter_price=10_000,
        counter_at=now,
        artisan_counter_price=12_500,
        artisan_counter_at=now,
        negotiation_round=1,
    )
    bid.created_at = now

    timeline = _build_negotiation_timeline(bid, "Alice", "Bob")

    assert len(timeline) == 3
    assert timeline[0]["event_type"] == "bid_submitted"
    assert timeline[1]["event_type"] == "client_counter"
    assert timeline[2]["event_type"] == "artisan_counter"
    assert timeline[0]["price"] == 15_000
    assert timeline[1]["price"] == 10_000
    assert timeline[2]["price"] == 12_500


def test_negotiation_timeline_original_only() -> None:
    from app.routers.bids import _build_negotiation_timeline

    bid = _make_bid(status=BidStatus.pending, proposed_price=15_000)
    timeline = _build_negotiation_timeline(bid)
    assert len(timeline) == 1
    assert timeline[0]["event_type"] == "bid_submitted"


# ── 9. _current_offer_price ───────────────────────────────────────────────────


def test_current_offer_price_pending_returns_proposed() -> None:
    from app.routers.bids import _current_offer_price

    bid = _make_bid(status=BidStatus.pending, proposed_price=15_000)
    assert _current_offer_price(bid) == 15_000


def test_current_offer_price_client_counter_returns_counter() -> None:
    from app.routers.bids import _current_offer_price

    bid = _make_bid(
        status=BidStatus.countered_by_client,
        proposed_price=15_000,
        counter_price=12_000,
    )
    assert _current_offer_price(bid) == 12_000


def test_current_offer_price_artisan_counter_returns_artisan_price() -> None:
    from app.routers.bids import _current_offer_price

    bid = _make_bid(
        status=BidStatus.artisan_countered,
        proposed_price=15_000,
        artisan_counter_price=13_000,
    )
    assert _current_offer_price(bid) == 13_000


# ── 10. MAX_NEGOTIATION_ROUNDS constant ──────────────────────────────────────


def test_max_rounds_constant_is_three() -> None:
    assert MAX_NEGOTIATION_ROUNDS == 3


# ── 11. Multi-round flow simulation ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_full_three_round_flow_ends_in_deal() -> None:
    """
    Simulate: client counters → artisan proposes middle → client accepts.
    """
    client_id = uuid.uuid4()
    artisan_id = uuid.uuid4()
    job = _make_job(client_id=client_id)

    # Round 1: client counters 15k bid at 10k
    bid = _make_bid(
        artisan_id=artisan_id,
        job_id=job.id,
        status=BidStatus.pending,
        proposed_price=15_000,
    )
    db = _make_db(bid, job)
    r = await client_counter_offer(db, bid.id, client_id, 10_000, "Too expensive")
    assert "error" not in r
    assert bid.negotiation_round == 1

    # Round 1b: artisan counters back with 12.5k
    bid.status = BidStatus.countered_by_client
    db2 = _make_db(bid, job)
    r2 = await artisan_propose_middle(db2, bid.id, artisan_id, 12_500, "Meet halfway?")
    assert "error" not in r2

    # Round 2: client accepts artisan's 12.5k
    bid.status = BidStatus.artisan_countered
    bid.artisan_counter_price = 12_500
    bid.artisan_counter_at = datetime.now(timezone.utc)
    db3 = _make_db(bid, job)
    r3 = await client_accept_artisan_counter(db3, bid.id, client_id)
    assert "error" not in r3
    assert r3["agreed_price"] == 12_500


@pytest.mark.asyncio
async def test_negotiation_round_tracks_correctly() -> None:
    """Round counter increments on each client counter, not artisan."""
    client_id = uuid.uuid4()
    job = _make_job(client_id=client_id)
    bid = _make_bid(job_id=job.id, status=BidStatus.pending, negotiation_round=0)
    db = _make_db(bid, job)

    await client_counter_offer(db, bid.id, client_id, 12_000, None)
    assert bid.negotiation_round == 1
