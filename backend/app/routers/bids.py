# File: backend/app/routers/bids.py
"""
Bids router — artisans submit bids on open jobs; clients accept/reject them.

POST   /bids/jobs/{job_id}     — artisan submits a bid
GET    /bids/jobs/{job_id}     — list bids on a job (client sees all, artisan sees own)
POST   /bids/{bid_id}/accept   — client accepts bid → creates Booking (pending_payment)
POST   /bids/{bid_id}/reject   — client rejects a bid
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.booking import Booking, BookingStatus
from app.models.job import Bid, BidStatus, Job, JobStatus
from app.models.notification import Notification
from app.models.user import User, UserRole

router = APIRouter(prefix="/bids", tags=["bids"])


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _notify(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    title: str,
    body: str,
    payload: dict | None = None,
) -> None:
    n = Notification(user_id=user_id, event_type=event_type, title=title, body=body, payload=payload)
    db.add(n)


# ── Endpoints ─────────────────────────────────────────────────────────────────


class BidCreate(BaseModel):
    proposed_price: int
    message: str | None = None
    proposed_start_time: datetime | None = None


@router.post("/jobs/{job_id}", status_code=201)
async def submit_bid(
    job_id: UUID,
    payload: BidCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Duplicate bid guard
    existing = await db.scalar(
        select(Bid).where(Bid.job_id == job_id, Bid.artisan_id == user_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already bid on this job.")

    # Fetch job to get client_id for notification
    job = await db.scalar(select(Job).where(Job.id == job_id, Job.status == JobStatus.open))
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or no longer accepting bids.")

    # Fetch artisan name for notification
    artisan = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan.full_name if artisan else "An artisan"

    bid = Bid(
        job_id=job_id,
        artisan_id=user_id,
        proposed_price=payload.proposed_price,
        message=payload.message,
        proposed_start_time=payload.proposed_start_time,
        status=BidStatus.pending,
    )
    db.add(bid)

    # Notify client
    await _notify(
        db, job.client_id,
        "new_bid",
        f"New bid from {artisan_name} 📋",
        f"{artisan_name} bid {payload.proposed_price:,} RWF on your job '{job.title}'.",
        {"job_id": str(job_id)},
    )

    await db.commit()
    await db.refresh(bid)
    return {
        "id": str(bid.id),
        "job_id": str(bid.job_id),
        "artisan_id": str(bid.artisan_id),
        "proposed_price": bid.proposed_price,
        "message": bid.message,
        "proposed_start_time": bid.proposed_start_time,
        "status": bid.status,
        "created_at": bid.created_at,
    }


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

    query = select(Bid, User.full_name, User.avatar_url).join(User, Bid.artisan_id == User.id)

    if user_role == UserRole.client:
        if job.client_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view bids for this job.")
        query = query.where(Bid.job_id == job_id)
    else:
        query = query.where(Bid.job_id == job_id, Bid.artisan_id == user_id)

    result = await db.execute(query.order_by(Bid.created_at.desc()))
    return [
        {
            "id": str(row[0].id),
            "job_id": str(row[0].job_id),
            "artisan_id": str(row[0].artisan_id),
            "proposed_price": row[0].proposed_price,
            "message": row[0].message,
            "proposed_start_time": row[0].proposed_start_time,
            "status": row[0].status,
            "created_at": row[0].created_at,
            "artisan_name": row[1],
            "artisan_avatar": row[2],
        }
        for row in result.all()
    ]


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

    bid.status = BidStatus.accepted
    job.status = JobStatus.booked

    # Reject all other bids on this job
    await db.execute(
        update(Bid)
        .where(Bid.job_id == job.id, Bid.id != bid.id)
        .values(status=BidStatus.rejected)
    )

    # Create booking
    booking = Booking(
        job_id=job.id,
        client_id=user_id,
        artisan_id=bid.artisan_id,
        status=BookingStatus.pending_payment,
        agreed_price=bid.proposed_price,
    )
    db.add(booking)
    await db.flush()  # get booking.id

    # Notify artisan
    client = await db.scalar(select(User).where(User.id == user_id))
    client_name = client.full_name if client else "A client"
    await _notify(
        db, bid.artisan_id,
        "booking_confirmed",
        "Bid accepted! 🎉",
        f"{client_name} accepted your bid of {bid.proposed_price:,} RWF for '{job.title}'. "
        f"Awaiting payment confirmation.",
        {"booking_id": str(booking.id)},
    )

    await db.commit()
    return {
        "message": "Bid accepted — booking created.",
        "booking_id": str(booking.id),
        "agreed_price": bid.proposed_price,
    }


@router.post("/{bid_id}/reject")
async def reject_bid(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Verify client owns the job this bid is on
    result = await db.execute(
        select(Bid, Job).join(Job, Bid.job_id == Job.id).where(Bid.id == bid_id)
    )
    data = result.first()
    if not data or data[1].client_id != user_id:
        raise HTTPException(status_code=404, detail="Bid not found.")

    await db.execute(update(Bid).where(Bid.id == bid_id).values(status=BidStatus.rejected))

    # Notify artisan
    bid = data[0]
    await _notify(
        db, bid.artisan_id,
        "bid_rejected",
        "Bid not selected",
        "Your bid was not selected for this job. Keep it up — more jobs are posted daily!",
    )

    await db.commit()
    return {"message": "Bid rejected."}
