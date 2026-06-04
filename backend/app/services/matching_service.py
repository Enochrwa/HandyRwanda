# File: backend/app/services/matching_service.py
"""
Smart job-to-artisan matching service.

When a job is posted:
1. Find top-N artisans whose skill categories match the job category
2. Filter by availability (not blocked, not already booked at that time)
3. Rank by: rating DESC, completion_rate DESC
4. Send push notifications to top 5 matches
5. Also provides "Recommended artisans" for the client home screen
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import not_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.push import send_push_notification
from app.models.artisan import ArtisanProfile, artisan_skills
from app.models.booking import Booking, BookingStatus
from app.models.job import Job
from app.models.notification import Notification
from app.models.schedule import BlockedDate
from app.models.user import User


async def find_matching_artisans(
    db: AsyncSession,
    job: Job,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """Find artisans matching a job by category, availability, and quality."""
    base_q = (
        select(ArtisanProfile, User)
        .join(User, ArtisanProfile.user_id == User.id)
        .join(artisan_skills, artisan_skills.c.artisan_id == ArtisanProfile.user_id)
        .where(
            artisan_skills.c.category_id == job.category_id,
            ArtisanProfile.is_available.is_(True),
            User.is_active.is_(True),
        )
    )

    if job.location_label:
        district = job.location_label.split(",")[0].strip()
        base_q = base_q.where(User.district.ilike(f"%{district}%"))

    if job.scheduled_time:
        scheduled_date = job.scheduled_time.date()
        blocked_subq = select(BlockedDate.artisan_id).where(
            BlockedDate.blocked_date == scheduled_date
        )
        base_q = base_q.where(not_(ArtisanProfile.user_id.in_(blocked_subq)))

        booked_subq = (
            select(Booking.artisan_id)
            .join(Job, Booking.job_id == Job.id)
            .where(
                Booking.status.in_(
                    [BookingStatus.confirmed, BookingStatus.in_progress]
                ),
                Job.scheduled_time.between(
                    job.scheduled_time - timedelta(hours=4),
                    job.scheduled_time + timedelta(hours=4),
                ),
            )
        )
        base_q = base_q.where(not_(ArtisanProfile.user_id.in_(booked_subq)))

    base_q = base_q.order_by(
        ArtisanProfile.average_rating.desc(),
        ArtisanProfile.completion_rate.desc(),
    ).limit(limit * 3)

    result = await db.execute(base_q)
    rows = result.all()

    matches = []
    seen_ids: set[str] = set()
    for profile, user in rows:
        uid = str(user.id)
        if uid in seen_ids:
            continue
        seen_ids.add(uid)
        matches.append(
            {
                "artisan_id": uid,
                "full_name": user.full_name,
                "expo_push_token": user.expo_push_token,
                "fcm_push_token": getattr(user, "fcm_push_token", None),
                "average_rating": profile.average_rating,
                "total_reviews": profile.total_reviews,
                "completion_rate": profile.completion_rate,
                "district": user.district,
            }
        )
        if len(matches) >= limit:
            break

    return matches


async def notify_matching_artisans(
    db: AsyncSession,
    job: Job,
    category_name: str = "",
) -> int:
    """Notify up to 5 best-matching artisans about a new job."""
    matches = await find_matching_artisans(db, job, limit=5)
    if not matches:
        return 0

    price_str = f" — {job.budget:,} RWF" if job.budget else ""
    location_str = job.location_label or "Rwanda"
    notif_title = f"New job near you: {category_name or 'Service'} in {location_str}"
    notif_body = f"{job.title}{price_str}"

    notified = 0
    for match in matches:
        artisan_id = UUID(match["artisan_id"])
        n = Notification(
            user_id=artisan_id,
            event_type="new_job_match",
            title=notif_title,
            body=notif_body,
            payload={
                "job_id": str(job.id),
                "event_type": "new_job_match",
                "screen": "artisan_jobs",
            },
        )
        db.add(n)
        asyncio.ensure_future(
            send_push_notification(
                db,
                artisan_id,
                notif_title,
                notif_body,
                {
                    "job_id": str(job.id),
                    "event_type": "new_job_match",
                    "screen": "artisan_jobs",
                },
            )
        )
        notified += 1

    await db.flush()
    return notified


async def get_recommended_artisans(
    db: AsyncSession,
    client_id: UUID,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """Return artisans recommended for a client based on their last job category."""
    last_job = await db.scalar(
        select(Job)
        .where(Job.client_id == client_id)
        .order_by(Job.created_at.desc())
        .limit(1)
    )

    if not last_job:
        result = await db.execute(
            select(ArtisanProfile, User)
            .join(User, ArtisanProfile.user_id == User.id)
            .where(ArtisanProfile.is_available.is_(True), User.is_active.is_(True))
            .order_by(ArtisanProfile.average_rating.desc())
            .limit(limit)
        )
    else:
        result = await db.execute(
            select(ArtisanProfile, User)
            .join(User, ArtisanProfile.user_id == User.id)
            .join(artisan_skills, artisan_skills.c.artisan_id == ArtisanProfile.user_id)
            .where(
                artisan_skills.c.category_id == last_job.category_id,
                ArtisanProfile.is_available.is_(True),
                User.is_active.is_(True),
            )
            .order_by(ArtisanProfile.average_rating.desc())
            .limit(limit)
        )

    recommendations = []
    for profile, user in result.all():
        recommendations.append(
            {
                "artisan_id": str(user.id),
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
                "district": user.district,
                "average_rating": profile.average_rating,
                "total_reviews": profile.total_reviews,
                "hourly_rate": profile.hourly_rate,
                "verification_status": profile.verification_status,
            }
        )
    return recommendations
