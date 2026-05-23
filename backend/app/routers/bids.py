import uuid
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.job import Job, JobStatus, Bid, BidStatus
from app.models.booking import Booking, BookingStatus
from app.models.user import User, UserRole
from pydantic import BaseModel

router = APIRouter(prefix="/bids", tags=["bids"])

class BidCreate(BaseModel):
    proposed_price: int
    message: str | None = None
    proposed_start_time: datetime | None = None

@router.post("/jobs/{job_id}")
async def submit_bid(
    job_id: UUID,
    payload: BidCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.artisan))
) -> Any:
    user_id = UUID(current_user["sub"])

    # Check if bid already exists
    existing = await db.execute(
        select(Bid).where(Bid.job_id == job_id, Bid.artisan_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already bid on this job")

    bid = Bid(
        job_id=job_id,
        artisan_id=user_id,
        proposed_price=payload.proposed_price,
        message=payload.message,
        proposed_start_time=payload.proposed_start_time,
        status=BidStatus.pending
    )
    db.add(bid)
    await db.commit()
    await db.refresh(bid)
    return bid

@router.get("/jobs/{job_id}")
async def list_bids(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
) -> Any:
    # Logic to return bids (Client sees all, Artisan sees only theirs)
    user_id = UUID(current_user["sub"])

    result = await db.execute(
        select(Bid, User.full_name, User.avatar_url)
        .join(User, Bid.artisan_id == User.id)
        .where(Bid.job_id == job_id)
    )

    return [
        {
            **dict(row[0].__dict__),
            "artisan_name": row[1],
            "artisan_avatar": row[2]
        } for row in result.all()
    ]

@router.post("/{bid_id}/accept")
async def accept_bid(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.client))
) -> Any:
    user_id = UUID(current_user["sub"])

    # Get bid and job
    result = await db.execute(
        select(Bid, Job).join(Job, Bid.job_id == Job.id).where(Bid.id == bid_id)
    )
    data = result.first()
    if not data or data[1].client_id != user_id:
        raise HTTPException(status_code=404, detail="Bid not found")

    bid, job = data

    # Update statuses
    bid.status = BidStatus.accepted
    job.status = JobStatus.assigned

    # Reject other bids
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
        status=BookingStatus.pending,
        agreed_price=bid.proposed_price,
        scheduled_at=bid.proposed_start_time
    )
    db.add(booking)
    await db.commit()

    return {"message": "Bid accepted, booking created"}

@router.post("/{bid_id}/reject")
async def reject_bid(
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.client))
) -> Any:
    await db.execute(
        update(Bid).where(Bid.id == bid_id).values(status=BidStatus.rejected)
    )
    await db.commit()
    return {"message": "Bid rejected"}
