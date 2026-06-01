# File: backend/app/routers/bids.py
"""
Bids router — artisans submit bids on open jobs; clients accept/reject them.

POST   /bids/jobs/{job_id}         — artisan submits a bid
GET    /bids/jobs/{job_id}         — list bids on a job (client sees all, artisan sees own)
PATCH  /bids/{bid_id}              — artisan updates their pending bid
POST   /bids/{bid_id}/accept       — client accepts bid → creates Booking (pending_payment)
POST   /bids/{bid_id}/reject       — client rejects a bid
DELETE /bids/{bid_id}              — artisan withdraws their pending bid
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

router = APIRouter(prefix="/bids", tags=["bids"])


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
        description="Why you're the best person for this job — your experience, tools, availability",
    )
    proposed_start_time: datetime | None = None
    estimated_duration_hours: int | None = Field(
        None, ge=1, le=720, description="How many hours you estimate the job will take"
    )


class BidUpdate(BaseModel):
    proposed_price: int | None = Field(None, ge=500)
    message: str | None = Field(None, max_length=500)
    cover_letter: str | None = Field(None, max_length=500)
    proposed_start_time: datetime | None = None
    estimated_duration_hours: int | None = Field(None, ge=1, le=720)


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
        "created_at": bid.created_at.isoformat() if bid.created_at else None,
        "artisan_name": artisan_name,
        "artisan_avatar": artisan_avatar,
        "artisan_rating": artisan_rating,
        "artisan_reviews": artisan_reviews,
        "artisan_verified": artisan_verified,
    }


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

    # Artisan must have a profile
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
        # Artisan sees their own bid only
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
    if bid.status != BidStatus.pending:
        raise HTTPException(
            status_code=400, detail="This bid has already been accepted or rejected."
        )
    if job.status not in (JobStatus.open, JobStatus.pending_bid):
        raise HTTPException(status_code=400, detail="Job is no longer accepting bids.")

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
    await db.flush()

    client = await db.scalar(select(User).where(User.id == user_id))
    client_name = client.full_name if client else "A client"
    await _notify(
        db,
        bid.artisan_id,
        "booking_confirmed",
        "Bid accepted! 🎉",
        f"{client_name} accepted your bid of {bid.proposed_price:,} RWF for '{job.title}'. "
        f"Awaiting MoMo payment confirmation.",
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

    result = await db.execute(
        select(Bid, Job).join(Job, Bid.job_id == Job.id).where(Bid.id == bid_id)
    )
    data = result.first()
    if not data or data[1].client_id != user_id:
        raise HTTPException(status_code=404, detail="Bid not found.")

    bid = data[0]
    if bid.status != BidStatus.pending:
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
