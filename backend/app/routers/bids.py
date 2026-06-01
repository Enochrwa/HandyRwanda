# File: backend/app/routers/bids.py
"""
Bids router — artisans submit bids on open jobs; clients accept/reject them.

POST   /bids/jobs/{job_id}       — artisan submits a bid
GET    /bids/jobs/{job_id}       — list bids on a job (client sees all, artisan sees own)
GET    /bids/mine                — artisan sees all their own bids
POST   /bids/{bid_id}/accept     — client accepts bid → creates Booking
POST   /bids/{bid_id}/reject     — client rejects a bid
DELETE /bids/{bid_id}            — artisan withdraws a pending bid
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.artisan import ArtisanProfile, Category
from app.models.booking import Booking, BookingStatus
from app.models.job import Bid, BidStatus, Job, JobStatus
from app.models.user import User, UserRole
from app.routers.notifications import notify_and_push

router = APIRouter(prefix="/bids", tags=["bids"])





class BidCreate(BaseModel):
    proposed_price: int = Field(..., ge=500, description="Price in RWF, minimum 500")
    message: str | None = Field(None, max_length=500)
    proposed_start_time: datetime | None = None
    estimated_duration_hours: float | None = Field(None, ge=0.5, le=720)


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

    # Fetch job
    result = await db.execute(
        select(Job, Category).join(Category, Job.category_id == Category.id).where(Job.id == job_id)
    )
    row = result.first()
    if not row or row[0].status != JobStatus.open:
        raise HTTPException(
            status_code=404, detail="Job not found or no longer accepting bids."
        )
    job, cat = row

    # Fetch artisan name
    artisan = await db.scalar(select(User).where(User.id == user_id))
    artisan_name = artisan.full_name if artisan else "An artisan"

    # Fetch artisan profile for rating
    artisan_profile = await db.scalar(
        select(ArtisanProfile).where(ArtisanProfile.user_id == user_id)
    )

    bid = Bid(
        job_id=job_id,
        artisan_id=user_id,
        proposed_price=payload.proposed_price,
        message=payload.message,
        proposed_start_time=payload.proposed_start_time,
        estimated_duration_hours=payload.estimated_duration_hours,
        status=BidStatus.pending,
    )
    db.add(bid)

    # Notify client
    await notify_and_push(
        db,
        job.client_id,
        "new_bid",
        f"New bid from {artisan_name} 📋",
        f"{artisan_name} bid {payload.proposed_price:,} RWF on your job '{job.title}'.",
        {"job_id": str(job_id), "bid_price": payload.proposed_price},
    )

    await db.commit()
    await db.refresh(bid)
    return {
        "id": str(bid.id),
        "job_id": str(bid.job_id),
        "artisan_id": str(bid.artisan_id),
        "artisan_name": artisan_name,
        "artisan_avatar": artisan.avatar_url if artisan else None,
        "artisan_rating": artisan_profile.average_rating if artisan_profile else 0.0,
        "artisan_total_reviews": artisan_profile.total_reviews if artisan_profile else 0,
        "proposed_price": bid.proposed_price,
        "message": bid.message,
        "proposed_start_time": bid.proposed_start_time.isoformat() if bid.proposed_start_time else None,
        "estimated_duration_hours": bid.estimated_duration_hours,
        "status": bid.status,
        "created_at": bid.created_at.isoformat() if bid.created_at else None,
        "category": {"name_en": cat.name_en, "icon_emoji": cat.icon_emoji},
    }


@router.get("/mine")
async def list_my_bids(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan: list all bids they've submitted."""
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(Bid, Job, Category)
        .join(Job, Bid.job_id == Job.id)
        .join(Category, Job.category_id == Category.id)
        .where(Bid.artisan_id == user_id)
        .order_by(Bid.created_at.desc())
    )
    return [
        {
            "id": str(row[0].id),
            "job_id": str(row[0].job_id),
            "job_title": row[1].title,
            "job_location": row[1].location_label,
            "job_budget": row[1].budget,
            "proposed_price": row[0].proposed_price,
            "message": row[0].message,
            "proposed_start_time": row[0].proposed_start_time.isoformat() if row[0].proposed_start_time else None,
            "estimated_duration_hours": row[0].estimated_duration_hours,
            "status": row[0].status,
            "job_status": row[1].status,
            "created_at": row[0].created_at.isoformat() if row[0].created_at else None,
            "category": {"name_en": row[2].name_en, "icon_emoji": row[2].icon_emoji},
        }
        for row in result.all()
    ]


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
        select(Bid, User.full_name, User.avatar_url, ArtisanProfile.average_rating, ArtisanProfile.total_reviews, ArtisanProfile.verification_status)
        .join(User, Bid.artisan_id == User.id)
        .outerjoin(ArtisanProfile, Bid.artisan_id == ArtisanProfile.user_id)
    )

    if user_role == UserRole.client:
        if job.client_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view bids for this job.")
        query = query.where(Bid.job_id == job_id)
    elif user_role == UserRole.artisan:
        query = query.where(Bid.job_id == job_id, Bid.artisan_id == user_id)
    else:
        # admin can see all
        query = query.where(Bid.job_id == job_id)

    result = await db.execute(query.order_by(Bid.created_at.desc()))
    return [
        {
            "id": str(row[0].id),
            "job_id": str(row[0].job_id),
            "artisan_id": str(row[0].artisan_id),
            "proposed_price": row[0].proposed_price,
            "message": row[0].message,
            "proposed_start_time": row[0].proposed_start_time.isoformat() if row[0].proposed_start_time else None,
            "estimated_duration_hours": row[0].estimated_duration_hours,
            "status": row[0].status,
            "created_at": row[0].created_at.isoformat() if row[0].created_at else None,
            "artisan_name": row[1],
            "artisan_avatar": row[2],
            "artisan_rating": float(row[3]) if row[3] else 0.0,
            "artisan_total_reviews": row[4] or 0,
            "artisan_verification_status": row[5],
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
    if bid.status != BidStatus.pending:
        raise HTTPException(status_code=400, detail="Bid is no longer pending.")

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
    await notify_and_push(
        db,
        bid.artisan_id,
        "booking_confirmed",
        "Bid accepted! 🎉",
        f"{client_name} accepted your bid of {bid.proposed_price:,} RWF for '{job.title}'. Awaiting payment confirmation.",
        {"booking_id": str(booking.id), "job_id": str(job.id)},
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
        raise HTTPException(status_code=400, detail="Bid is no longer pending.")

    await db.execute(update(Bid).where(Bid.id == bid_id).values(status=BidStatus.rejected))
    await notify_and_push(
        db,
        bid.artisan_id,
        "bid_rejected",
        "Bid not selected",
        "Your bid was not selected for this job. Keep it up — more jobs are posted daily!",
    )

    await db.commit()
    return {"message": "Bid rejected."}


@router.delete("/{bid_id}")
async def withdraw_bid(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan withdraws their own pending bid."""
    user_id = UUID(current_user["sub"])
    bid = await db.scalar(
        select(Bid).where(Bid.id == bid_id, Bid.artisan_id == user_id)
    )
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found.")
    if bid.status != BidStatus.pending:
        raise HTTPException(status_code=400, detail="Can only withdraw pending bids.")

    await db.execute(update(Bid).where(Bid.id == bid_id).values(status=BidStatus.rejected))
    await db.commit()
    return {"message": "Bid withdrawn."}
