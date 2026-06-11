# File: backend/app/services/matching_service.py
"""
Sprint 9 — Upgraded smart job-to-artisan matching service.

Matching pipeline:
1. Find top-N artisans whose skill categories match the job category
2. Filter by availability (not blocked, not already booked at that time)
3. Enrich candidates with full feature vector (district_match, price_delta, etc.)
4. Re-rank using sklearn GradientBoostingClassifier (Sprint 9)
   → Falls back to heuristic sort (rating DESC) when model not trained yet
5. Send push notifications to top-5 ML-ranked matches
6. Also provides "Recommended artisans" for the client home screen
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
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

_log = logging.getLogger(__name__)


# ── District-match scoring ─────────────────────────────────────────────────────


def _compute_district_match(
    artisan_district: str | None,
    artisan_province: str | None,
    job_district: str | None,
    job_province: str | None,
) -> float:
    """
    Returns:
      1.0  — same district
      0.5  — same province, different district
      0.0  — different province or unknown
    """
    if not artisan_district or not job_district:
        return 0.0
    if artisan_district.lower().strip() == job_district.lower().strip():
        return 1.0
    if artisan_province and job_province:
        if artisan_province.lower().strip() == job_province.lower().strip():
            return 0.5
    return 0.0


# ── Core matching query ────────────────────────────────────────────────────────


async def find_matching_artisans(
    db: AsyncSession,
    job: Job,
    limit: int = 5,
    *,
    use_ml: bool = True,
) -> list[dict[str, Any]]:
    """
    Find artisans matching a job by category, availability, and ML quality score.

    Returns a list of candidate dicts enriched with:
      - ml_score (float | None)
      - rank_source ("ml" | "heuristic")
      - district_match (float)
    """
    # ── 1. Build base query: skill + availability filters ─────────────────────
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

    # Soft district filter — prefer same district but don't hard-exclude others
    # (ML ranking will naturally promote district matches via district_match feature)
    if job.district:
        # Fetch a wider pool: same district + same province + a few others
        # We rely on ML/heuristic to rank, not hard-filter by location
        pass  # No hard filter — let ML rank by district_match feature

    # Block dates
    if job.scheduled_time is not None:
        scheduled_date = job.scheduled_time.date()
        blocked_subq = select(BlockedDate.artisan_id).where(
            BlockedDate.blocked_date == scheduled_date
        )
        base_q = base_q.where(not_(ArtisanProfile.user_id.in_(blocked_subq)))

        scheduled_dt: datetime = job.scheduled_time
        window_start = scheduled_dt - timedelta(hours=4)
        window_end = scheduled_dt + timedelta(hours=4)
        booked_subq = (
            select(Booking.artisan_id)
            .join(Job, Booking.job_id == Job.id)
            .where(
                Booking.status.in_(
                    [BookingStatus.confirmed, BookingStatus.in_progress]
                ),
                Job.scheduled_time.between(window_start, window_end),
            )
        )
        base_q = base_q.where(not_(ArtisanProfile.user_id.in_(booked_subq)))

    # Fetch a larger pool for ML re-ranking (3× limit)
    base_q = base_q.limit(limit * 4)

    result = await db.execute(base_q)
    rows = result.all()

    # ── 2. Build candidate dicts with full feature vector ─────────────────────
    candidates: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for profile, user in rows:
        uid = str(user.id)
        if uid in seen_ids:
            continue
        seen_ids.add(uid)

        district_match = _compute_district_match(
            artisan_district=user.district,
            artisan_province=getattr(user, "province", None),
            job_district=job.district,
            job_province=job.province,
        )

        candidates.append(
            {
                # Identity
                "artisan_id": uid,
                "full_name": user.full_name,
                "expo_push_token": user.expo_push_token,
                "fcm_push_token": getattr(user, "fcm_push_token", None),
                "avatar_url": user.avatar_url,
                # Quality signals
                "average_rating": float(profile.average_rating or 0),
                "total_reviews": int(profile.total_reviews or 0),
                "completion_rate": float(profile.completion_rate or 0),
                "response_rate": float(profile.response_rate or 0),
                "on_time_rate": float(profile.on_time_rate or 0),
                "repeat_client_rate": float(profile.repeat_client_rate or 0),
                "years_experience": int(profile.years_experience or 0),
                "community_score": int(profile.community_score or 0),
                "verification_status": str(profile.verification_status.value
                                           if profile.verification_status else "unverified"),
                # Pricing
                "hourly_rate": profile.hourly_rate,
                "job_budget": job.budget,
                # Location
                "district": user.district,
                "province": getattr(user, "province", None),
                "district_match": district_match,
            }
        )

    # ── 3. ML re-ranking ──────────────────────────────────────────────────────
    if use_ml and candidates:
        try:
            from app.services.ml_ranking_service import rank_artisans_ml  # noqa: PLC0415, I001
            candidates = rank_artisans_ml(candidates)
        except Exception as exc:
            _log.warning("[Matching] ML ranking error — using heuristic: %s", exc)
            candidates = sorted(
                candidates,
                key=lambda x: (x["average_rating"], x["completion_rate"]),
                reverse=True,
            )
            for c in candidates:
                c["ml_score"] = None
                c["rank_source"] = "heuristic"

    return candidates[:limit]


async def notify_matching_artisans(
    db: AsyncSession,
    job: Job,
    category_name: str = "",
) -> int:
    """Notify up to 5 best ML-ranked artisans about a new job."""
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
                "ml_score": match.get("ml_score"),
                "rank_source": match.get("rank_source"),
            },
        )
        db.add(n)
        asyncio.create_task(
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
    """Return ML-ranked artisans recommended for a client based on their last job category."""
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
            .limit(limit * 2)
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
            .limit(limit * 2)
        )

    candidates = []
    for profile, user in result.all():
        candidates.append(
            {
                "artisan_id": str(user.id),
                "full_name": user.full_name,
                "avatar_url": user.avatar_url,
                "district": user.district,
                "province": getattr(user, "province", None),
                "average_rating": float(profile.average_rating or 0),
                "total_reviews": int(profile.total_reviews or 0),
                "completion_rate": float(profile.completion_rate or 0),
                "response_rate": float(profile.response_rate or 0),
                "on_time_rate": float(profile.on_time_rate or 0),
                "repeat_client_rate": float(profile.repeat_client_rate or 0),
                "years_experience": int(profile.years_experience or 0),
                "community_score": int(profile.community_score or 0),
                "hourly_rate": profile.hourly_rate,
                "verification_status": str(
                    profile.verification_status.value
                    if profile.verification_status
                    else "unverified"
                ),
                "district_match": _compute_district_match(
                    user.district,
                    getattr(user, "province", None),
                    last_job.district if last_job else None,
                    last_job.province if last_job else None,
                ),
            }
        )

    # ML re-rank recommendations too
    if candidates:
        try:
            from app.services.ml_ranking_service import rank_artisans_ml  # noqa: PLC0415, I001
            candidates = rank_artisans_ml(candidates)
        except Exception:
            pass

    return candidates[:limit]
