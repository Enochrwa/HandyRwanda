from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.models.booking import Booking, BookingStatus
from app.models.job import Job
from app.models.user import User

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/upcoming")
async def get_upcoming_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])

    query = (
        select(Booking, Job, User.full_name.label("artisan_name"))  # type: ignore[no-untyped-call]
        .join(Job, Booking.job_id == Job.id)
        .join(User, Booking.artisan_id == User.id)
        .where(
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
            Booking.status.in_(
                [BookingStatus.confirmed, BookingStatus.pending_payment]
            ),
            Job.scheduled_time >= func.now(),
        )
        .order_by(Job.scheduled_time.asc())
        .limit(5)
    )

    result = await db.execute(query)
    bookings = []
    for booking, job, artisan_name in result:
        bookings.append(
            {
                "id": str(booking.id),
                "title": job.title,
                "artisan_name": artisan_name,
                "scheduled_at": job.scheduled_time.isoformat()
                if job.scheduled_time
                else None,
                "status": booking.status,
            }
        )

    return bookings
