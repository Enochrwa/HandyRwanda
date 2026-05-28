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
from app.models.job import Job
from app.models.user import User, UserRole

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
        )
        if location_wkt:
            profile.location = cast(Any, location_wkt)
        db.add(profile)
    else:
        for key, value in payload.dict(exclude_unset=True).items():
            if key not in ["latitude", "longitude"]:
                setattr(profile, key, value)
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
    return result.scalars().all()


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

    # Nearby jobs
    profile_loc_res = await db.execute(
        select(ArtisanProfile.location, ArtisanProfile.service_radius_km).where(
            ArtisanProfile.user_id == user_id
        )
    )
    profile_row = profile_loc_res.one_or_none()

    nearby_jobs = []
    if profile_row and profile_row.location:
        nearby_query = text("""
            SELECT j.id, j.title, j.budget, j.description, j.location_label, c.name as category_name,
                ST_Distance(j.location::geography, :loc::geography) / 1000 AS distance_km
            FROM jobs j
            JOIN categories c ON j.category_id = c.id
            WHERE j.status = 'open'
            AND ST_DWithin(j.location::geography, :loc::geography, :radius * 1000)
            ORDER BY j.created_at DESC
            LIMIT 5
        """)
        nearby_res = await db.execute(
            nearby_query,
            {"loc": profile_row.location, "radius": profile_row.service_radius_km},
        )
        for row in nearby_res:
            nearby_jobs.append(
                {
                    "id": str(row.id),
                    "title": row.title,
                    "budget": row.budget,
                    "description": row.description,
                    "location_label": row.location_label,
                    "category": row.category_name,
                    "distance": round(row.distance_km, 1),
                }
            )

    return {
        "earnings_this_month": earnings_this_month,
        "jobs_count": jobs_count,
        "avg_rating": avg_rating,
        "schedule": schedule,
        "nearby_jobs": nearby_jobs,
    }


@router.get("/search")
async def search_artisans(
    category_id: UUID | None = Query(None),
    latitude: float = Query(...),
    longitude: float = Query(...),
    radius_km: int = Query(default=10, le=50),
    page: int = Query(default=1, ge=1),
    db: AsyncSession = Depends(get_db),
) -> Any:
    offset = (page - 1) * 20
    query = text("""
        SELECT u.id::text as id, u.full_name, u.avatar_url, ap.average_rating, ap.total_reviews, ap.is_available, ap.verification_status, ap.community_score, ap.hourly_rate,
            ST_X(ap.location::geometry) as lng, ST_Y(ap.location::geometry) as lat,
            ST_Distance(ap.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography) / 1000 AS distance_km
        FROM users u JOIN artisan_profiles ap ON u.id = ap.user_id LEFT JOIN artisan_skills ask ON ap.user_id = ask.artisan_id
        WHERE ST_DWithin(ap.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius_km * 1000)
        AND u.is_active = true AND (:category_id IS NULL OR ask.category_id = :category_id)
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
        },
    )
    return [dict(row._mapping) for row in result]
