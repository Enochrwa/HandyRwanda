# File: backend/app/routers/bids.py
"""
Bids router — artisans submit bids on open jobs; clients accept/reject/negotiate.

POST   /bids/jobs/{job_id}                   — artisan submits a bid
GET    /bids/jobs/{job_id}                   — list bids on a job
PATCH  /bids/{bid_id}                        — artisan updates their pending bid
POST   /bids/{bid_id}/accept                 — client accepts bid → Booking
POST   /bids/{bid_id}/reject                 — client rejects a bid
DELETE /bids/{bid_id}                        — artisan withdraws their pending bid

── Sprint 11: Price Negotiation ─────────────────────────────────────────────
POST   /bids/{bid_id}/counter                — client sends counter-offer
POST   /bids/{bid_id}/counter-accept         — artisan accepts client counter
POST   /bids/{bid_id}/counter-reject         — artisan rejects client counter
POST   /bids/{bid_id}/artisan-counter        — artisan proposes middle ground
POST   /bids/{bid_id}/artisan-counter-accept — client accepts artisan counter
POST   /bids/{bid_id}/artisan-counter-reject — client rejects artisan counter
GET    /bids/{bid_id}/negotiation-history    — full timeline of offers
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.artisan import ArtisanProfile
from app.models.booking import Booking, BookingStatus
from app.models.job import Bid, BidStatus, Job, JobStatus
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services.negotiation_service import (
    MAX_NEGOTIATION_ROUNDS,
    artisan_accept_counter,
    artisan_propose_middle,
    artisan_reject_counter,
    client_accept_artisan_counter,
    client_counter_offer,
    client_reject_artisan_counter,
)

router = APIRouter(prefix="/bids", tags=["bids"])


# ── Internal helpers ──────────────────────────────────────────────────────────


async def _notify(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    title: str,
    body: str,
    payload: dict[str, object] | None = None,
) -> None:
    n = Notification(
        user_id=user_id, event_type=event_type, title=title, body=body, payload=payload
    )
    db.add(n)


# ── Pydantic schemas ──────────────────────────────────────────────────────────


class BidCreate(BaseModel):
    proposed_price: int = Field(..., ge=500, description="Price in RWF (minimum 500)")
    message: str | None = Field(
        None,
        max_length=500,
        description="Short message describing your approach to the job",
    )
    cover_letter: str | None = Field(
        None,
        max_length=500,
        description="Why you're the best person for this job",
    )
    proposed_start_time: datetime | None = None
    estimated_duration_hours: int | None = Field(
        None, ge=1, le=720, description="Estimated job hours"
    )


class BidUpdate(BaseModel):
    proposed_price: int | None = Field(None, ge=500)
    message: str | None = Field(None, max_length=500)
    cover_letter: str | None = Field(None, max_length=500)
    proposed_start_time: datetime | None = None
    estimated_duration_hours: int | None = Field(None, ge=1, le=720)


# ── Sprint 11: Negotiation Pydantic schemas ───────────────────────────────────


class CounterOfferPayload(BaseModel):
    counter_price: int = Field(..., ge=500, description="Counter-offer price in RWF")
    counter_message: str | None = Field(
        None,
        max_length=300,
        description="Optional note to the artisan (max 300 chars)",
    )


class ArtisanCounterPayload(BaseModel):
    artisan_counter_price: int = Field(
        ..., ge=500, description="Middle-ground price in RWF"
    )
    artisan_counter_message: str | None = Field(
        None,
        max_length=300,
        description="Optional note to the client (max 300 chars)",
    )


# ── Serialisation ─────────────────────────────────────────────────────────────


def _serialize_bid(
    bid: Bid,
    artisan_name: str | None = None,
    artisan_avatar: str | None = None,
    artisan_rating: float | None = None,
    artisan_reviews: int | None = None,
    artisan_verified: str | None = None,
) -> dict[str, Any]:
    return {
        "id": str(bid.id),
        "job_id": str(bid.job_id),
        "artisan_id": str(bid.artisan_id),
        "proposed_price": bid.proposed_price,
        "message": bid.message,
        "cover_letter": bid.cover_letter,
        "proposed_start_time": bid.proposed_start_time.isoformat()
        if bid.proposed_start_time
        else None,
        "estimated_duration_hours": bid.estimated_duration_hours,
        "status": bid.status,
        # ── Sprint 11: negotiation fields ────────────────────────────────────
        "negotiation_round": bid.negotiation_round,
        "max_negotiation_rounds": MAX_NEGOTIATION_ROUNDS,
        "counter_price": bid.counter_price,
        "counter_message": bid.counter_message,
        "counter_at": bid.counter_at.isoformat() if bid.counter_at else None,
        "artisan_counter_price": bid.artisan_counter_price,
        "artisan_counter_message": bid.artisan_counter_message,
        "artisan_counter_at": bid.artisan_counter_at.isoformat()
        if bid.artisan_counter_at
        else None,
        # Convenience: what the "current best offer" is for UI display
        "current_offer_price": _current_offer_price(bid),
        "is_negotiable": bid.negotiation_round < MAX_NEGOTIATION_ROUNDS,
        # ── artisan profile fields ───────────────────────────────────────────
        "created_at": bid.created_at.isoformat() if bid.created_at else None,
        "artisan_name": artisan_name,
        "artisan_avatar": artisan_avatar,
        "artisan_rating": artisan_rating,
        "artisan_reviews": artisan_reviews,
        "artisan_verified": artisan_verified,
    }


def _current_offer_price(bid: Bid) -> int:
    """Return the most-recent offer price based on current status."""
    if bid.status == BidStatus.artisan_countered and bid.artisan_counter_price:
        return bid.artisan_counter_price
    if bid.status == BidStatus.countered_by_client and bid.counter_price:
        return bid.counter_price
    return bid.proposed_price


# ── Negotiation history helper ────────────────────────────────────────────────


def _build_negotiation_timeline(
    bid: Bid,
    artisan_name: str | None = None,
    client_name: str | None = None,
) -> list[dict[str, Any]]:
    """
    Build a chronological timeline of all offers/counters for the UI.
    Each entry: {actor, role, price, message, timestamp, event_type}
    """
    events: list[dict[str, Any]] = []

    # Original bid
    if bid.created_at:
        events.append(
            {
                "event_type": "bid_submitted",
                "actor": artisan_name or "Artisan",
                "role": "artisan",
                "price": bid.proposed_price,
                "message": bid.cover_letter or bid.message,
                "timestamp": bid.created_at.isoformat(),
                "is_accepted": bid.status == BidStatus.accepted
                and bid.counter_price is None
                and bid.artisan_counter_price is None,
            }
        )

    # Client counter
    if bid.counter_price and bid.counter_at:
        events.append(
            {
                "event_type": "client_counter",
                "actor": client_name or "Client",
                "role": "client",
                "price": bid.counter_price,
                "message": bid.counter_message,
                "timestamp": bid.counter_at.isoformat(),
                "is_accepted": bid.status == BidStatus.accepted
                and bid.artisan_counter_price is None,
            }
        )

    # Artisan's middle-ground counter
    if bid.artisan_counter_price and bid.artisan_counter_at:
        events.append(
            {
                "event_type": "artisan_counter",
                "actor": artisan_name or "Artisan",
                "role": "artisan",
                "price": bid.artisan_counter_price,
                "message": bid.artisan_counter_message,
                "timestamp": bid.artisan_counter_at.isoformat(),
                "is_accepted": bid.status == BidStatus.accepted,
            }
        )

    events.sort(key=lambda e: e["timestamp"])
    return events


# ── Standard bid endpoints ────────────────────────────────────────────────────


@router.post("/jobs/{job_id}", status_code=201)
async def submit_bid(
    job_id: UUID,
    payload: BidCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])

    existing = await db.scalar(
        select(Bid).where(Bid.job_id == job_id, Bid.artisan_id == user_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already bid on this job.")

    artisan_profile = await db.scalar(
        select(ArtisanProfile).where(ArtisanProfile.user_id == user_id)
    )
    if not artisan_profile:
        raise HTTPException(
            status_code=400, detail="Complete your artisan profile before bidding."
        )

    job = await db.scalar(
        select(Job).where(Job.id == job_id, Job.status == JobStatus.open)
    )
    if not job:
        raise HTTPException(
            status_code=404, detail="Job not found or no longer accepting bids."
        )

    artisan = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan.full_name if artisan else "An artisan"

    bid = Bid(
        job_id=job_id,
        artisan_id=user_id,
        proposed_price=payload.proposed_price,
        message=payload.message,
        cover_letter=payload.cover_letter,
        proposed_start_time=payload.proposed_start_time,
        estimated_duration_hours=payload.estimated_duration_hours,
        status=BidStatus.pending,
    )
    db.add(bid)

    price_str = f"{payload.proposed_price:,}"
    await _notify(
        db,
        job.client_id,
        "new_bid",
        f"New bid from {artisan_name} 📋",
        f"{artisan_name} bid {price_str} RWF on your job '{job.title}'."
        + (
            f" Estimated {payload.estimated_duration_hours}h."
            if payload.estimated_duration_hours
            else ""
        ),
        {"job_id": str(job_id)},
    )

    await db.commit()
    await db.refresh(bid)
    return _serialize_bid(
        bid,
        artisan_name,
        artisan.avatar_url if artisan else None,
        artisan_profile.average_rating,
        artisan_profile.total_reviews,
        artisan_profile.verification_status,
    )


@router.get("/jobs/{job_id}")
async def list_bids(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    user_role = current_user.get("role")

    job = await db.scalar(select(Job).where(Job.id == job_id))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    query = (
        select(
            Bid,
            User.full_name,
            User.avatar_url,
            ArtisanProfile.average_rating,
            ArtisanProfile.total_reviews,
            ArtisanProfile.verification_status,
        )
        .join(User, Bid.artisan_id == User.id)
        .join(ArtisanProfile, Bid.artisan_id == ArtisanProfile.user_id)
    )

    if user_role == UserRole.client:
        if job.client_id != user_id:
            raise HTTPException(
                status_code=403, detail="Not authorized to view bids for this job."
            )
        query = query.where(Bid.job_id == job_id)
    else:
        query = query.where(Bid.job_id == job_id, Bid.artisan_id == user_id)

    result = await db.execute(query.order_by(Bid.created_at.desc()))
    return [
        _serialize_bid(row[0], row[1], row[2], row[3], row[4], str(row[5]))
        for row in result.all()
    ]


@router.patch("/{bid_id}")
async def update_bid(
    bid_id: UUID,
    payload: BidUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan can update their pending bid."""
    user_id = UUID(current_user["sub"])
    bid = await db.scalar(
        select(Bid).where(
            Bid.id == bid_id, Bid.artisan_id == user_id, Bid.status == BidStatus.pending
        )
    )
    if not bid:
        raise HTTPException(
            status_code=404, detail="Bid not found or cannot be edited."
        )

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    await db.execute(update(Bid).where(Bid.id == bid_id).values(**update_data))
    await db.commit()
    await db.refresh(bid)
    return _serialize_bid(bid)


@router.delete("/{bid_id}")
async def withdraw_bid(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan withdraws their pending bid."""
    user_id = UUID(current_user["sub"])
    bid = await db.scalar(
        select(Bid).where(
            Bid.id == bid_id, Bid.artisan_id == user_id, Bid.status == BidStatus.pending
        )
    )
    if not bid:
        raise HTTPException(
            status_code=404, detail="Bid not found or already accepted/rejected."
        )

    await db.execute(delete(Bid).where(Bid.id == bid_id))
    await db.commit()
    return {"message": "Bid withdrawn."}


@router.post("/{bid_id}/accept")
async def accept_bid(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])

    result = await db.execute(
        select(Bid, Job).join(Job, Bid.job_id == Job.id).where(Bid.id == bid_id)
    )
    data = result.first()
    if not data or data[1].client_id != user_id:
        raise HTTPException(status_code=404, detail="Bid not found.")

    bid, job = data
    if bid.status not in (BidStatus.pending, BidStatus.artisan_countered):
        raise HTTPException(
            status_code=400, detail="This bid has already been accepted or rejected."
        )
    if job.status not in (JobStatus.open, JobStatus.pending_bid):
        raise HTTPException(status_code=400, detail="Job is no longer accepting bids.")

    # Use artisan counter price if accepting from artisan_countered state
    agreed_price = (
        bid.artisan_counter_price
        if bid.status == BidStatus.artisan_countered and bid.artisan_counter_price
        else bid.proposed_price
    )

    bid.status = BidStatus.accepted
    bid.proposed_price = agreed_price
    job.status = JobStatus.booked

    await db.execute(
        update(Bid)
        .where(Bid.job_id == job.id, Bid.id != bid.id)
        .values(status=BidStatus.rejected)
    )

    booking = Booking(
        job_id=job.id,
        client_id=user_id,
        artisan_id=bid.artisan_id,
        status=BookingStatus.pending_payment,
        agreed_price=agreed_price,
    )
    db.add(booking)
    await db.flush()

    client = await db.scalar(select(User).where(User.id == user_id))
    client_name = client.full_name if client else "A client"
    await _notify(
        db,
        bid.artisan_id,
        "booking_confirmed",
        "Bid accepted! 🎉",
        f"{client_name} accepted your bid of {agreed_price:,} RWF for '{job.title}'. "
        f"Awaiting MoMo payment confirmation.",
        {"booking_id": str(booking.id)},
    )

    await db.commit()
    return {
        "message": "Bid accepted — booking created.",
        "booking_id": str(booking.id),
        "agreed_price": agreed_price,
    }


@router.post("/{bid_id}/reject")
async def reject_bid(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])

    result = await db.execute(
        select(Bid, Job).join(Job, Bid.job_id == Job.id).where(Bid.id == bid_id)
    )
    data = result.first()
    if not data or data[1].client_id != user_id:
        raise HTTPException(status_code=404, detail="Bid not found.")

    bid = data[0]
    if bid.status not in (
        BidStatus.pending,
        BidStatus.countered_by_client,
        BidStatus.artisan_countered,
    ):
        raise HTTPException(status_code=400, detail="Bid already processed.")

    await db.execute(
        update(Bid).where(Bid.id == bid_id).values(status=BidStatus.rejected)
    )

    await _notify(
        db,
        bid.artisan_id,
        "bid_rejected",
        "Bid not selected",
        "Your bid was not selected for this job. Keep it up — more jobs are posted daily!",
    )

    await db.commit()
    return {"message": "Bid rejected."}


# ── Sprint 11: Negotiation endpoints ─────────────────────────────────────────


@router.post("/{bid_id}/counter")
async def client_counter(
    bid_id: UUID,
    payload: CounterOfferPayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client proposes a counter-offer price on an artisan's bid."""
    client_id = UUID(current_user["sub"])
    result = await client_counter_offer(
        db,
        bid_id,
        client_id,
        payload.counter_price,
        payload.counter_message,
    )
    if "error" in result:
        raise HTTPException(status_code=result["code"], detail=result["error"])

    bid: Bid = result["bid"]
    return {
        "message": result["message"],
        "bid_id": str(bid.id),
        "status": bid.status,
        "counter_price": bid.counter_price,
        "negotiation_round": bid.negotiation_round,
        "rounds_remaining": MAX_NEGOTIATION_ROUNDS - bid.negotiation_round,
    }


@router.post("/{bid_id}/counter-accept")
async def counter_accept(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan accepts the client's counter-offer price."""
    artisan_id = UUID(current_user["sub"])
    result = await artisan_accept_counter(db, bid_id, artisan_id)
    if "error" in result:
        raise HTTPException(status_code=result["code"], detail=result["error"])
    return result


@router.post("/{bid_id}/counter-reject")
async def counter_reject(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan rejects the client's counter-offer."""
    artisan_id = UUID(current_user["sub"])
    result = await artisan_reject_counter(db, bid_id, artisan_id)
    if "error" in result:
        raise HTTPException(status_code=result["code"], detail=result["error"])
    return result


@router.post("/{bid_id}/artisan-counter")
async def artisan_counter(
    bid_id: UUID,
    payload: ArtisanCounterPayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan proposes a middle-ground price in response to a client counter."""
    artisan_id = UUID(current_user["sub"])
    result = await artisan_propose_middle(
        db,
        bid_id,
        artisan_id,
        payload.artisan_counter_price,
        payload.artisan_counter_message,
    )
    if "error" in result:
        raise HTTPException(status_code=result["code"], detail=result["error"])

    bid: Bid = result["bid"]
    return {
        "message": result["message"],
        "bid_id": str(bid.id),
        "status": bid.status,
        "artisan_counter_price": bid.artisan_counter_price,
        "negotiation_round": bid.negotiation_round,
        "rounds_remaining": MAX_NEGOTIATION_ROUNDS - bid.negotiation_round,
    }


@router.post("/{bid_id}/artisan-counter-accept")
async def artisan_counter_accept(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client accepts the artisan's middle-ground counter price."""
    client_id = UUID(current_user["sub"])
    result = await client_accept_artisan_counter(db, bid_id, client_id)
    if "error" in result:
        raise HTTPException(status_code=result["code"], detail=result["error"])
    return result


@router.post("/{bid_id}/artisan-counter-reject")
async def artisan_counter_reject(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client rejects the artisan's middle-ground counter."""
    client_id = UUID(current_user["sub"])
    result = await client_reject_artisan_counter(db, bid_id, client_id)
    if "error" in result:
        raise HTTPException(status_code=result["code"], detail=result["error"])
    return result


@router.get("/{bid_id}/negotiation-history")
async def negotiation_history(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """
    Returns the full chronological timeline of offers/counters for a bid.
    Accessible by both the job's client and the bidding artisan.
    """
    user_id = UUID(current_user["sub"])

    result = await db.execute(
        select(Bid, Job, User)
        .join(Job, Bid.job_id == Job.id)
        .join(User, Bid.artisan_id == User.id)
        .where(Bid.id == bid_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Bid not found.")

    bid, job, artisan = row

    # Only the two parties may view the negotiation timeline
    if user_id not in (job.client_id, bid.artisan_id):
        raise HTTPException(status_code=403, detail="Not authorised.")

    client_user = await db.scalar(select(User).where(User.id == job.client_id))
    client_name = client_user.full_name if client_user else "Client"

    timeline = _build_negotiation_timeline(
        bid,
        artisan_name=artisan.full_name,
        client_name=client_name,
    )

    return {
        "bid_id": str(bid.id),
        "job_id": str(job.id),
        "job_title": job.title,
        "status": bid.status,
        "negotiation_round": bid.negotiation_round,
        "max_rounds": MAX_NEGOTIATION_ROUNDS,
        "rounds_remaining": MAX_NEGOTIATION_ROUNDS - bid.negotiation_round,
        "is_negotiation_active": bid.status
        in (BidStatus.countered_by_client, BidStatus.artisan_countered),
        "timeline": timeline,
        "summary": {
            "original_ask": bid.proposed_price
            if not (bid.counter_price or bid.artisan_counter_price)
            else timeline[0]["price"] if timeline else bid.proposed_price,
            "current_offer": _current_offer_price(bid),
            "savings": (
                timeline[0]["price"] - _current_offer_price(bid)
                if len(timeline) > 1
                else 0
            ),
        },
    }


@router.get("/my")
async def my_bids(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Artisan fetches all their submitted bids (across all jobs).
    Returns bids enriched with job title / client info for the
    mobile 'My Bids' screen (Sprint 11).
    """
    artisan_id = UUID(current_user["sub"])

    result = await db.execute(
        select(
            Bid,
            Job.title.label("job_title"),
            Job.location_label.label("location_label"),
            User.full_name.label("client_name"),
        )
        .join(Job, Bid.job_id == Job.id)
        .join(User, Job.client_id == User.id)
        .where(Bid.artisan_id == artisan_id)
        .order_by(
            # surface negotiation-active bids first, then newest
            Bid.status.in_(
                [BidStatus.countered_by_client, BidStatus.artisan_countered]
            ).desc(),
            Bid.created_at.desc(),
        )
    )

    rows = result.all()
    out = []
    for row in rows:
        bid: Bid = row[0]
        serialised = _serialize_bid(bid)
        serialised["job_title"] = row[1]
        serialised["location_label"] = row[2]
        serialised["client_name"] = row[3]
        out.append(serialised)

    return out
