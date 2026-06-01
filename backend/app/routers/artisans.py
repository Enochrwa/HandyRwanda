# File: backend/app/routers/artisans.py
from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import require_role
from app.integrations.supabase_storage import upload_image
from app.models.artisan import (
    ArtisanProfile,
    Category,
    PortfolioPhoto,
    VerificationStatus,
    artisan_skills,
)
from app.models.booking import Booking, BookingStatus
from app.models.job import Bid, BidStatus, Job
from app.models.user import User, UserRole
from app.utils.geo import HAVERSINE_KM_AP

router = APIRouter(prefix="/artisans", tags=["artisans"])


class ArtisanProfileUpdate(BaseModel):
    bio: str | None = None
    years_experience: int | None = None
    service_radius_km: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    location_label: str | None = None
    hourly_rate: int | None = None
    fixed_rate: int | None = None
    spoken_languages: str | None = None


class IDVerificationRequest(BaseModel):
    national_id_number: str
    national_id_doc_base64: str
    selfie_base64: str


class PortfolioCreate(BaseModel):
    photo_base64: str
    job_type: str | None = None
    description: str | None = None


@router.post("/profile")
async def update_profile(
    payload: ArtisanProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(ArtisanProfile).where(ArtisanProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    location_wkt = None
    if payload.latitude is not None and payload.longitude is not None:
        location_wkt = f"POINT({payload.longitude} {payload.latitude})"

    if not profile:
        profile = ArtisanProfile(
            user_id=user_id,
            bio=payload.bio,
            years_experience=payload.years_experience or 0,
            service_radius_km=payload.service_radius_km or 10,
            location_label=payload.location_label,
            hourly_rate=payload.hourly_rate,
            fixed_rate=payload.fixed_rate,
            spoken_languages=payload.spoken_languages,
            latitude=payload.latitude,
            longitude=payload.longitude,
        )
        if location_wkt:
            profile.location = cast(Any, location_wkt)
        db.add(profile)
    else:
        for key, value in payload.dict(exclude_unset=True).items():
            if key not in ["latitude", "longitude"]:
                setattr(profile, key, value)
        if payload.latitude is not None:
            profile.latitude = payload.latitude
        if payload.longitude is not None:
            profile.longitude = payload.longitude
        if location_wkt:
            profile.location = cast(Any, location_wkt)

    await db.commit()
    return {"message": "Profile updated"}


@router.get("/portfolio/me")
async def get_my_portfolio(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(PortfolioPhoto).where(PortfolioPhoto.artisan_id == user_id)
    )
    return result.scalars().all()


@router.get("/profile/me")
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(ArtisanProfile).where(ArtisanProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.post("/profile/me/id-verification")
async def submit_id_verification(
    payload: IDVerificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    id_url = await upload_image(
        payload.national_id_doc_base64, f"id-docs/{user_id}/national_id"
    )
    selfie_url = await upload_image(payload.selfie_base64, f"id-docs/{user_id}/selfie")
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == user_id)
        .values(
            verification_status=VerificationStatus.pending,
            id_document_url=id_url,
            selfie_url=selfie_url,
        )
    )
    await db.commit()
    return {"message": "Verification documents submitted"}


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)) -> Any:
    result = await db.execute(select(Category).where(Category.is_active))
    cats = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name_en": c.name_en,
            "name_rw": c.name_rw,
            "name_fr": c.name_fr,
            "icon_emoji": c.icon_emoji,
            "is_active": c.is_active,
        }
        for c in cats
    ]


@router.post("/skills")
async def update_skills(
    category_ids: list[UUID],
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    await db.execute(
        delete(artisan_skills).where(artisan_skills.c.artisan_id == user_id)
    )
    for cat_id in category_ids:
        await db.execute(
            artisan_skills.insert().values(artisan_id=user_id, category_id=cat_id)
        )
    await db.commit()
    return {"message": "Skills updated"}


@router.delete("/portfolio/{photo_id}")
async def delete_portfolio_photo(
    photo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    await db.execute(
        delete(PortfolioPhoto).where(
            PortfolioPhoto.id == photo_id, PortfolioPhoto.artisan_id == user_id
        )
    )
    await db.commit()
    return {"message": "Photo deleted"}


@router.post("/portfolio")
async def add_portfolio_photo(
    payload: PortfolioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    url = await upload_image(payload.photo_base64, f"portfolio/{user_id}")
    photo = PortfolioPhoto(
        artisan_id=user_id,
        image_url=url,
        job_type=payload.job_type,
        description=payload.description,
    )
    db.add(photo)
    await db.commit()
    return photo


class AvailabilityUpdate(BaseModel):
    available_now: bool


@router.patch("/availability")
async def toggle_availability(
    payload: AvailabilityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == user_id)
        .values(is_available=payload.available_now)
    )
    await db.commit()
    return {"message": "Availability updated"}


@router.get("/dashboard")
async def get_artisan_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Earnings this month
    earnings_query = text("""
        SELECT COALESCE(SUM(agreed_price), 0) as total
        FROM bookings
        WHERE artisan_id = :artisan_id
        AND status = 'completed'
        AND created_at >= date_trunc('month', current_timestamp)
    """)
    earnings_res = await db.execute(earnings_query, {"artisan_id": user_id})
    earnings_this_month = earnings_res.scalar_one()

    # Jobs count
    jobs_count_query = select(func.count(Booking.id)).where(
        Booking.artisan_id == user_id, Booking.status == BookingStatus.completed
    )
    jobs_count_res = await db.execute(jobs_count_query)
    jobs_count = jobs_count_res.scalar_one()

    # Avg rating
    profile_res = await db.execute(
        select(ArtisanProfile.average_rating).where(ArtisanProfile.user_id == user_id)
    )
    avg_rating = profile_res.scalar_one_or_none() or 0.0

    # Today's schedule
    schedule_query = (
        select(Booking, Job, User.full_name)
        .join(Job, Booking.job_id == Job.id)
        .join(User, Job.client_id == User.id)
        .where(
            Booking.artisan_id == user_id,
            Booking.status.in_([BookingStatus.confirmed, BookingStatus.in_progress]),
            func.date(Job.scheduled_time) == func.current_date(),
        )
        .order_by(Job.scheduled_time)
    )
    schedule_res = await db.execute(schedule_query)
    schedule = []
    for booking, job, client_name in schedule_res:
        schedule.append(
            {
                "id": str(booking.id),
                "title": job.title,
                "client_name": client_name,
                "time": job.scheduled_time.isoformat() if job.scheduled_time else None,
                "status": booking.status,
            }
        )

    # Nearby jobs (category-matched; geo requires lat/lng on jobs — not yet stored)
    nearby_jobs = []
    nearby_query = text("""
        SELECT j.id, j.title, j.budget, j.description, j.location_label, c.name_en as category_name
        FROM jobs j
        JOIN categories c ON j.category_id = c.id
        JOIN artisan_skills ask ON j.category_id = ask.category_id AND ask.artisan_id = :artisan_id
        WHERE j.status = 'open'
        ORDER BY j.created_at DESC
        LIMIT 5
    """)
    nearby_res = await db.execute(nearby_query, {"artisan_id": user_id})
    for row in nearby_res:
        nearby_jobs.append(
            {
                "id": str(row.id),
                "title": row.title,
                "budget": row.budget,
                "description": row.description,
                "location_label": row.location_label,
                "category": row.category_name,
                "distance": None,
            }
        )

    # Active bids (pending)
    active_bids_res = await db.execute(
        select(Bid, Job)
        .join(Job, Bid.job_id == Job.id)
        .where(Bid.artisan_id == user_id, Bid.status == BidStatus.pending)
        .order_by(Bid.created_at.desc())
        .limit(10)
    )
    active_bids = [
        {
            "bid_id": str(b.id),
            "job_id": str(b.job_id),
            "job_title": j.title,
            "proposed_price": b.proposed_price,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b, j in active_bids_res
    ]

    return {
        "earnings_this_month": earnings_this_month,
        "jobs_count": jobs_count,
        "avg_rating": avg_rating,
        "schedule": schedule,
        "nearby_jobs": nearby_jobs,
        "active_bids": active_bids,
    }


@router.get("")
async def list_artisans(
    limit: int = Query(default=20, le=50),
    sort: str = Query(default="rating"),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Browse artisans — used by home screen featured list."""
    order = (
        "ap.average_rating DESC NULLS LAST"
        if sort == "rating"
        else "ap.created_at DESC"
    )
    query = text(f"""
        SELECT u.id::text AS id, u.full_name, u.avatar_url, u.district,
            ap.average_rating, ap.total_reviews, ap.is_available,
            ap.hourly_rate, ap.fixed_rate, ap.latitude AS lat, ap.longitude AS lng
        FROM users u
        JOIN artisan_profiles ap ON u.id = ap.user_id
        WHERE u.is_active = true AND u.role = 'artisan'
        ORDER BY {order}
        LIMIT :limit
    """)
    result = await db.execute(query, {"limit": limit})
    items = [dict(row._mapping) for row in result]
    return {"items": items}


@router.get("/search")
async def search_artisans(
    category_id: UUID | None = Query(None),
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius_km: int = Query(default=10, le=50),
    page: int = Query(default=1, ge=1),
    q: str | None = Query(None),
    district: str | None = Query(None),
    min_hourly_rate: int | None = Query(None),
    max_hourly_rate: int | None = Query(None),
    available_now: bool = Query(default=False),
    min_rating: float = Query(default=0, ge=0, le=5),
    db: AsyncSession = Depends(get_db),
) -> Any:
    offset = (page - 1) * 20
    districts = [d.strip() for d in district.split(",")] if district else None

    query = text(f"""
        SELECT u.id::text AS id, u.full_name, u.avatar_url, u.district,
            ap.average_rating, ap.total_reviews, ap.is_available,
            ap.verification_status, ap.community_score, ap.hourly_rate, ap.fixed_rate,
            ap.latitude AS lat, ap.longitude AS lng,
            CASE
              WHEN ap.latitude IS NULL OR ap.longitude IS NULL THEN NULL
              ELSE {HAVERSINE_KM_AP}
            END AS distance_km,
            (
              SELECT c.name_en FROM categories c
              JOIN artisan_skills ask ON ask.category_id = c.id
              WHERE ask.artisan_id = u.id
              LIMIT 1
            ) AS category_name
        FROM users u
        JOIN artisan_profiles ap ON u.id = ap.user_id
        WHERE u.is_active = true
          AND u.role = 'artisan'
          AND (
            ap.latitude IS NULL OR ap.longitude IS NULL
            OR {HAVERSINE_KM_AP} <= :radius_km
          )
          AND (CAST(:category_id AS uuid) IS NULL OR EXISTS (
              SELECT 1 FROM artisan_skills ask
              WHERE ask.artisan_id = ap.user_id AND ask.category_id = CAST(:category_id AS uuid)
          ))
          AND (CAST(:q AS text) IS NULL OR u.full_name ILIKE '%' || :q || '%' OR ap.bio ILIKE '%' || :q || '%')
          AND (CAST(:districts AS varchar[]) IS NULL OR u.district = ANY(CAST(:districts AS varchar[])))
          AND (CAST(:min_hourly_rate AS integer) IS NULL OR ap.hourly_rate >= CAST(:min_hourly_rate AS integer))
          AND (CAST(:max_hourly_rate AS integer) IS NULL OR ap.hourly_rate <= CAST(:max_hourly_rate AS integer))
          AND (NOT :available_now OR ap.is_available = true)
          AND ap.average_rating >= :min_rating
        ORDER BY distance_km ASC NULLS LAST, ap.average_rating DESC
        LIMIT 20 OFFSET :offset
    """)
    result = await db.execute(
        query,
        {
            "lng": longitude,
            "lat": latitude,
            "radius_km": radius_km,
            "category_id": category_id,
            "offset": offset,
            "q": q or None,
            "districts": districts,
            "min_hourly_rate": min_hourly_rate,
            "max_hourly_rate": max_hourly_rate,
            "available_now": available_now,
            "min_rating": min_rating,
        },
    )
    return [dict(row._mapping) for row in result]


# ── Push Token Registration ────────────────────────────────────────────────────

class PushTokenUpdate(BaseModel):
    expo_push_token: str


@router.post("/push-token")
async def register_push_token(
    payload: PushTokenUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Register or update Expo push notification token for the artisan."""
    user_id = UUID(current_user["sub"])
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(expo_push_token=payload.expo_push_token)
    )
    await db.commit()
    return {"message": "Push token registered."}


@router.get("/{artisan_id}/skills")
async def get_artisan_skills(
    artisan_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Public: list skill categories for a given artisan."""
    from sqlalchemy import select
    from app.models.artisan import Category, artisan_skills
    cats_result = await db.execute(
        select(Category)
        .join(artisan_skills, artisan_skills.c.category_id == Category.id)
        .where(artisan_skills.c.artisan_id == artisan_id)
    )
    return [
        {
            "id": str(c.id),
            "name_en": c.name_en,
            "name_rw": c.name_rw,
            "name_fr": c.name_fr,
            "icon_emoji": c.icon_emoji,
        }
        for c in cats_result.scalars().all()
    ]
