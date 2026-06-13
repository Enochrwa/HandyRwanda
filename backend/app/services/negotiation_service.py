# File: backend/app/services/negotiation_service.py
"""
Sprint 11 — Price Negotiation Service

Business logic for the counter-offer flow, decoupled from the HTTP layer.
All mutation functions return a result dict consumed by the router.

Negotiation flow:
  1. Client counter → bid.status = countered_by_client
  2a. Artisan accepts counter  → booking created at counter_price
  2b. Artisan rejects counter  → bid.status = rejected
  2c. Artisan proposes middle  → bid.status = artisan_countered, round++
  3a. Client accepts artisan's counter → booking at artisan_counter_price
  3b. Client rejects artisan's counter → bid.status = rejected
  (max 3 rounds; after that, status = negotiation_expired)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.job import Bid, BidStatus, Job, JobStatus
from app.models.notification import Notification
from app.models.user import User

MAX_NEGOTIATION_ROUNDS: int = 3


# ── Internal helpers ──────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


async def _get_bid_with_job(
    db: AsyncSession,
    bid_id: UUID,
) -> tuple[Bid, Job] | None:
    result = await db.execute(
        select(Bid, Job).join(Job, Bid.job_id == Job.id).where(Bid.id == bid_id)
    )
    row = result.first()
    if not row:
        return None
    return row[0], row[1]


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
        payload=payload,
    )
    db.add(n)


async def _get_user_name(db: AsyncSession, user_id: UUID) -> str:
    user = await db.scalar(select(User).where(User.id == user_id))
    return user.full_name if user else "Someone"


def _fmt(price: int) -> str:
    """Format RWF price with thousands separator."""
    return f"{price:,}"


# ── Public service functions ───────────────────────────────────────────────────


async def client_counter_offer(
    db: AsyncSession,
    bid_id: UUID,
    client_id: UUID,
    counter_price: int,
    counter_message: str | None,
) -> dict[str, Any]:
    """
    Client proposes a lower (or different) price.

    Guards:
    - Bid must belong to a job owned by client_id.
    - Bid status must be `pending` OR `artisan_countered` (multi-round).
    - negotiation_round must be < MAX_NEGOTIATION_ROUNDS.
    """
    row = await _get_bid_with_job(db, bid_id)
    if not row:
        return {"error": "Bid not found.", "code": 404}

    bid, job = row
    if job.client_id != client_id:
        return {"error": "Not authorised.", "code": 403}

    allowed_statuses = {BidStatus.pending, BidStatus.artisan_countered}
    if bid.status not in allowed_statuses:
        return {
            "error": f"Cannot counter a bid with status '{bid.status.value}'.",
            "code": 400,
        }

    if bid.negotiation_round >= MAX_NEGOTIATION_ROUNDS:
        return {
            "error": "Maximum negotiation rounds reached. Please accept or decline.",
            "code": 400,
        }

    if counter_price < 500:
        return {"error": "Minimum counter-offer is 500 RWF.", "code": 400}

    # Apply counter
    bid.counter_price = counter_price
    bid.counter_message = counter_message
    bid.counter_at = _now()
    bid.status = BidStatus.countered_by_client
    bid.negotiation_round = bid.negotiation_round + 1

    client_name = await _get_user_name(db, client_id)
    await _notify(
        db,
        bid.artisan_id,
        "counter_offer_received",
        f"💬 Counter-offer from {client_name}",
        f"{client_name} is suggesting {_fmt(counter_price)} RWF "
        f"(you asked {_fmt(bid.proposed_price)} RWF) for '{job.title}'."
        + (f" Note: {counter_message}" if counter_message else ""),
        {"bid_id": str(bid_id), "job_id": str(job.id)},
    )

    await db.commit()
    await db.refresh(bid)
    return {"bid": bid, "message": "Counter-offer sent to artisan."}


async def artisan_accept_counter(
    db: AsyncSession,
    bid_id: UUID,
    artisan_id: UUID,
) -> dict[str, Any]:
    """
    Artisan agrees to the client's counter price.
    The agreed price becomes counter_price; a Booking is created.
    """
    row = await _get_bid_with_job(db, bid_id)
    if not row:
        return {"error": "Bid not found.", "code": 404}

    bid, job = row
    if bid.artisan_id != artisan_id:
        return {"error": "Not authorised.", "code": 403}

    if bid.status != BidStatus.countered_by_client:
        return {
            "error": "No pending client counter-offer on this bid.",
            "code": 400,
        }

    if not bid.counter_price:
        return {"error": "No counter price on record.", "code": 400}

    agreed_price = bid.counter_price

    # Settle the bid
    bid.proposed_price = agreed_price
    bid.status = BidStatus.accepted
    job.status = JobStatus.booked

    # Reject other bids on this job
    await db.execute(
        update(Bid)
        .where(Bid.job_id == job.id, Bid.id != bid.id)
        .values(status=BidStatus.rejected)
    )

    # Create booking
    booking = Booking(
        job_id=job.id,
        client_id=job.client_id,
        artisan_id=artisan_id,
        status=BookingStatus.pending_payment,
        agreed_price=agreed_price,
    )
    db.add(booking)
    await db.flush()

    artisan_name = await _get_user_name(db, artisan_id)
    await _notify(
        db,
        job.client_id,
        "counter_accepted",
        "✅ Counter-offer accepted!",
        f"{artisan_name} accepted your counter-offer of {_fmt(agreed_price)} RWF "
        f"for '{job.title}'. Booking created — awaiting payment.",
        {"booking_id": str(booking.id), "job_id": str(job.id)},
    )

    await db.commit()
    return {
        "message": "Counter accepted — booking created.",
        "booking_id": str(booking.id),
        "agreed_price": agreed_price,
    }


async def artisan_reject_counter(
    db: AsyncSession,
    bid_id: UUID,
    artisan_id: UUID,
) -> dict[str, Any]:
    """
    Artisan declines the client's counter-offer; bid becomes rejected.
    """
    row = await _get_bid_with_job(db, bid_id)
    if not row:
        return {"error": "Bid not found.", "code": 404}

    bid, job = row
    if bid.artisan_id != artisan_id:
        return {"error": "Not authorised.", "code": 403}

    if bid.status != BidStatus.countered_by_client:
        return {
            "error": "No pending client counter-offer on this bid.",
            "code": 400,
        }

    bid.status = BidStatus.rejected

    artisan_name = await _get_user_name(db, artisan_id)
    await _notify(
        db,
        job.client_id,
        "counter_rejected",
        "Counter-offer declined",
        f"{artisan_name} declined your counter-offer for '{job.title}'. "
        "You may accept their original price or look for another artisan.",
        {"bid_id": str(bid_id), "job_id": str(job.id)},
    )

    await db.commit()
    return {"message": "Counter-offer rejected."}


async def artisan_propose_middle(
    db: AsyncSession,
    bid_id: UUID,
    artisan_id: UUID,
    artisan_counter_price: int,
    artisan_counter_message: str | None,
) -> dict[str, Any]:
    """
    Artisan proposes a middle-ground price in response to a client counter.
    Status → artisan_countered. Client can then accept or decline.
    """
    row = await _get_bid_with_job(db, bid_id)
    if not row:
        return {"error": "Bid not found.", "code": 404}

    bid, job = row
    if bid.artisan_id != artisan_id:
        return {"error": "Not authorised.", "code": 403}

    if bid.status != BidStatus.countered_by_client:
        return {
            "error": "No pending client counter-offer on this bid.",
            "code": 400,
        }

    if bid.negotiation_round >= MAX_NEGOTIATION_ROUNDS:
        bid.status = BidStatus.negotiation_expired
        await db.commit()
        return {
            "error": (
                "Maximum negotiation rounds reached. "
                "The bid has expired — please accept or decline the last offer."
            ),
            "code": 400,
        }

    if artisan_counter_price < 500:
        return {"error": "Minimum counter-offer is 500 RWF.", "code": 400}

    bid.artisan_counter_price = artisan_counter_price
    bid.artisan_counter_message = artisan_counter_message
    bid.artisan_counter_at = _now()
    bid.status = BidStatus.artisan_countered
    # negotiation_round was already incremented when client countered

    artisan_name = await _get_user_name(db, artisan_id)
    await _notify(
        db,
        job.client_id,
        "artisan_counter_offer",
        f"🔄 New offer from {artisan_name}",
        f"{artisan_name} suggests {_fmt(artisan_counter_price)} RWF for '{job.title}'."
        + (f" Note: {artisan_counter_message}" if artisan_counter_message else "")
        + (
            f" (Round {bid.negotiation_round}/{MAX_NEGOTIATION_ROUNDS})"
        ),
        {"bid_id": str(bid_id), "job_id": str(job.id)},
    )

    await db.commit()
    await db.refresh(bid)
    return {
        "bid": bid,
        "message": f"Counter-proposal sent. Round {bid.negotiation_round}/{MAX_NEGOTIATION_ROUNDS}.",
    }


async def client_accept_artisan_counter(
    db: AsyncSession,
    bid_id: UUID,
    client_id: UUID,
) -> dict[str, Any]:
    """
    Client accepts the artisan's middle-ground counter price.
    Booking created at artisan_counter_price.
    """
    row = await _get_bid_with_job(db, bid_id)
    if not row:
        return {"error": "Bid not found.", "code": 404}

    bid, job = row
    if job.client_id != client_id:
        return {"error": "Not authorised.", "code": 403}

    if bid.status != BidStatus.artisan_countered:
        return {
            "error": "No pending artisan counter-offer on this bid.",
            "code": 400,
        }

    if not bid.artisan_counter_price:
        return {"error": "No artisan counter price on record.", "code": 400}

    agreed_price = bid.artisan_counter_price

    bid.proposed_price = agreed_price
    bid.status = BidStatus.accepted
    job.status = JobStatus.booked

    await db.execute(
        update(Bid)
        .where(Bid.job_id == job.id, Bid.id != bid.id)
        .values(status=BidStatus.rejected)
    )

    booking = Booking(
        job_id=job.id,
        client_id=client_id,
        artisan_id=bid.artisan_id,
        status=BookingStatus.pending_payment,
        agreed_price=agreed_price,
    )
    db.add(booking)
    await db.flush()

    client_name = await _get_user_name(db, client_id)
    await _notify(
        db,
        bid.artisan_id,
        "booking_confirmed",
        "🎉 Deal agreed — booking created!",
        f"{client_name} accepted your offer of {_fmt(agreed_price)} RWF "
        f"for '{job.title}'. Awaiting MoMo payment.",
        {"booking_id": str(booking.id), "job_id": str(job.id)},
    )

    await db.commit()
    return {
        "message": "Artisan counter accepted — booking created.",
        "booking_id": str(booking.id),
        "agreed_price": agreed_price,
    }


async def client_reject_artisan_counter(
    db: AsyncSession,
    bid_id: UUID,
    client_id: UUID,
) -> dict[str, Any]:
    """
    Client declines the artisan's middle-ground counter.
    Bid becomes rejected.
    """
    row = await _get_bid_with_job(db, bid_id)
    if not row:
        return {"error": "Bid not found.", "code": 404}

    bid, job = row
    if job.client_id != client_id:
        return {"error": "Not authorised.", "code": 403}

    if bid.status != BidStatus.artisan_countered:
        return {
            "error": "No pending artisan counter-offer on this bid.",
            "code": 400,
        }

    bid.status = BidStatus.rejected

    await _notify(
        db,
        bid.artisan_id,
        "artisan_counter_rejected",
        "Counter-proposal declined",
        f"The client declined your counter-offer for '{job.title}'. "
        "Keep bidding — more jobs are available!",
        {"bid_id": str(bid_id), "job_id": str(job.id)},
    )

    await db.commit()
    return {"message": "Artisan counter-offer rejected."}
