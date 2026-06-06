# File: backend/app/routers/reviews.py
"""
Reviews router — create, read, reply, flag reviews.
POST   /reviews/{booking_id}        — client submits review after completed booking
GET    /reviews/artisan/{artisan_id} — public: list artisan reviews
PATCH  /reviews/{review_id}/reply   — artisan replies
PATCH  /reviews/{review_id}/flag    — flag review for admin
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.artisan import ArtisanProfile
from app.models.booking import Booking, BookingStatus
from app.models.review import Review
from app.models.user import User, UserRole

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(None, max_length=500)


class ReviewReply(BaseModel):
    reply: str = Field(..., max_length=300)


@router.post("/{booking_id}", status_code=201)
async def create_review(
    booking_id: UUID,
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Check booking exists, belongs to client, and is completed
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            Booking.client_id == user_id,
            Booking.status == BookingStatus.completed,
        )
    )
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found or not eligible for review (must be completed).",
        )

    # Check not already reviewed
    existing = await db.scalar(select(Review).where(Review.booking_id == booking_id))
    if existing:
        raise HTTPException(
            status_code=409, detail="You have already reviewed this booking."
        )

    review = Review(
        booking_id=booking_id,
        client_id=user_id,
        artisan_id=booking.artisan_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)

    # Update artisan aggregate stats
    stats = await db.execute(
        select(
            func.avg(Review.rating).label("avg"),
            func.count(Review.id).label("cnt"),
        ).where(Review.artisan_id == booking.artisan_id)
    )
    row = stats.one()
    new_avg = float(row.avg or payload.rating)
    new_cnt = int(row.cnt or 0) + 1

    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == booking.artisan_id)
        .values(average_rating=new_avg, total_reviews=new_cnt)
    )

    await db.commit()
    await db.refresh(review)
    return {
        "id": str(review.id),
        "booking_id": str(review.booking_id),
        "artisan_id": str(review.artisan_id),
        "rating": review.rating,
        "comment": review.comment,
        "created_at": review.created_at,
    }


@router.get("/artisan/{artisan_id}")
async def get_artisan_reviews(
    artisan_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(
            Review,
            User.full_name.label("client_name"),
            User.avatar_url.label("client_avatar"),
        )
        .join(User, Review.client_id == User.id)
        .where(Review.artisan_id == artisan_id, Review.is_flagged.is_(False))
        .order_by(Review.created_at.desc())
        .limit(50)
    )
    reviews = []
    for rev, client_name, client_avatar in result:
        reviews.append(
            {
                "id": str(rev.id),
                "booking_id": str(rev.booking_id),
                "rating": rev.rating,
                "comment": rev.comment,
                "artisan_reply": rev.artisan_reply,
                "client_name": client_name,
                "client_avatar": client_avatar,
                "created_at": rev.created_at,
            }
        )
    return reviews


@router.patch("/{review_id}/reply")
async def reply_to_review(
    review_id: UUID,
    payload: ReviewReply,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    review = await db.scalar(
        select(Review).where(Review.id == review_id, Review.artisan_id == user_id)
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    if review.artisan_reply:
        raise HTTPException(
            status_code=409, detail="You have already replied to this review."
        )

    await db.execute(
        update(Review).where(Review.id == review_id).values(artisan_reply=payload.reply)
    )
    await db.commit()
    return {"message": "Reply posted."}


@router.patch("/{review_id}/flag")
async def flag_review(
    review_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    await db.execute(
        update(Review).where(Review.id == review_id).values(is_flagged=True)
    )
    await db.commit()
    return {"message": "Review flagged for moderation."}
