# File: backend/app/routers/artisans.py
from datetime import datetime, timezone
from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
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
    # Structured Rwanda address
    province: str | None = None
    district: str | None = None
    sector: str | None = None
    cell: str | None = None
    village: str | None = None
    street_road: str | None = None
    house_number: str | None = None
    landmark: str | None = None
    hourly_rate: int | None = None
    fixed_rate: int | None = None
    spoken_languages: str | None = None


class IDVerificationRequest(BaseModel):
    national_id_number: str | None = None
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
            province=payload.province,
            district=payload.district,
            sector=payload.sector,
            cell=payload.cell,
            village=payload.village,
            street_road=payload.street_road,
            house_number=payload.house_number,
            landmark=payload.landmark,
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
        skip_keys = {"latitude", "longitude"}
        for key, value in payload.dict(exclude_unset=True).items():
            if key not in skip_keys:
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

    # Join User so we can return district (lives on users table, not artisan_profiles)
    result = await db.execute(
        select(ArtisanProfile, User)
        .join(User, User.id == ArtisanProfile.user_id)
        .where(ArtisanProfile.user_id == user_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile, user = row

    # Include skills for onboarding gate check
    skills_result = await db.execute(
        select(Category)
        .join(artisan_skills, artisan_skills.c.category_id == Category.id)
        .where(artisan_skills.c.artisan_id == user_id)
    )
    skills = [
        {"id": str(c.id), "name_en": c.name_en} for c in skills_result.scalars().all()
    ]

    return {
        "bio": profile.bio,
        "years_experience": profile.years_experience,
        "hourly_rate": profile.hourly_rate,
        "fixed_rate": profile.fixed_rate,
        # Address from artisan_profiles (preferred) — falls back to users table
        "province": profile.province or user.province,
        "district": profile.district or user.district,
        "sector": profile.sector or user.sector,
        "cell": profile.cell or user.cell,
        "village": profile.village or user.village,
        "street_road": profile.street_road or user.street_road,
        "house_number": getattr(profile, "house_number", None) or getattr(user, "house_number", None),
        "landmark": getattr(profile, "landmark", None) or getattr(user, "landmark", None),
        "location_label": profile.location_label,
        "latitude": profile.latitude,
        "longitude": profile.longitude,
        "spoken_languages": profile.spoken_languages,
        "service_radius_km": profile.service_radius_km,
        "is_available": profile.is_available,
        "verification_status": profile.verification_status,
        "skills": skills,
    }


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
    result = await db.execute(
        select(Category).where(Category.is_active).order_by(Category.name_en)
    )
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


@router.get("/categories/{category_id}")
async def get_category(category_id: UUID, db: AsyncSession = Depends(get_db)) -> Any:
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return {
        "id": str(cat.id),
        "name_en": cat.name_en,
        "name_rw": cat.name_rw,
        "name_fr": cat.name_fr,
        "icon_emoji": cat.icon_emoji,
        "is_active": cat.is_active,
    }


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
    expo_push_token: str | None = None
    fcm_push_token: str | None = None


@router.post("/push-token")
async def register_push_token(
    payload: PushTokenUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """Register or update push notification token(s). Accepts both Expo and FCM tokens."""
    user_id = UUID(current_user["sub"])
    update_values: dict[str, Any] = {}
    if payload.expo_push_token is not None:
        update_values["expo_push_token"] = payload.expo_push_token
    if payload.fcm_push_token is not None:
        update_values["fcm_push_token"] = payload.fcm_push_token

    if update_values:
        await db.execute(update(User).where(User.id == user_id).values(**update_values))
        await db.commit()
    return {"message": "Push token registered."}


@router.get("/{artisan_id}/skills")
async def get_artisan_skills(
    artisan_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Public: list skill categories for a given artisan."""

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


# ── Sprint 4: Previous Artisans (Instant Booking) ─────────────────────────────


class PreviousArtisanItem(BaseModel):
    artisan_id: str
    full_name: str
    avatar_url: str | None
    average_rating: float
    total_reviews: int
    verification_status: str
    is_available: bool
    hourly_rate: int | None
    last_price: int
    last_booked_at: str
    last_job_title: str
    last_category: str
    instant_book_eligible: bool


@router.get("/previous", response_model=list[PreviousArtisanItem])
async def get_previous_artisans(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """
    Sprint 4 — Returns artisans a client has successfully worked with before,
    ordered by most recent booking. Used to power the "Book Again 🔄" UI.

    Each item includes `instant_book_eligible` which is True when:
      - artisan is available
      - artisan is id_verified or pro_verified
      - artisan has no active booking conflict in next 4 hours
      - artisan is not blocked today
    """
    from datetime import date, timedelta
    from sqlalchemy import text as sa_text

    client_id = UUID(current_user["sub"])

    query = sa_text("""
        SELECT DISTINCT ON (b.artisan_id)
            b.artisan_id::text            AS artisan_id,
            u.full_name,
            u.avatar_url,
            ap.average_rating,
            ap.total_reviews,
            ap.verification_status,
            ap.is_available,
            ap.hourly_rate,
            b.agreed_price                AS last_price,
            b.created_at                  AS last_booked_at,
            j.title                       AS last_job_title,
            c.name_en                     AS last_category
        FROM bookings b
        JOIN users u          ON b.artisan_id = u.id
        JOIN artisan_profiles ap ON b.artisan_id = ap.user_id
        JOIN jobs j           ON b.job_id = j.id
        JOIN categories c     ON j.category_id = c.id
        WHERE b.client_id = :client_id
          AND b.status = 'completed'
        ORDER BY b.artisan_id, b.created_at DESC
        LIMIT 10
    """)

    result = await db.execute(query, {"client_id": client_id})
    rows = result.mappings().all()

    today = date.today()

    # For each artisan, check booking conflicts in next 4 hours and blocked dates
    from datetime import timezone as tz
    now_utc = datetime.now(timezone.utc)
    window_end = now_utc + timedelta(hours=4)

    from app.models.schedule import BlockedDate
    from app.models.booking import Booking as BookingModel, BookingStatus

    output = []
    for row in rows:
        artisan_id_uuid = UUID(row["artisan_id"])

        # Eligibility checks
        is_verified = row["verification_status"] in ("id_verified", "pro_verified")
        is_available = row["is_available"]

        # Check blocked dates today
        blocked = await db.scalar(
            select(BlockedDate).where(
                BlockedDate.artisan_id == artisan_id_uuid,
                BlockedDate.blocked_date == today,
            )
        )

        # Check active booking conflicts (any active booking in next 4h)
        active_conflict = await db.scalar(
            select(BookingModel).where(
                BookingModel.artisan_id == artisan_id_uuid,
                BookingModel.status.in_([
                    BookingStatus.artisan_en_route,
                    BookingStatus.arrived,
                    BookingStatus.in_progress,
                    BookingStatus.artisan_accepted,
                ]),
            )
        )

        eligible = (
            is_available
            and is_verified
            and not blocked
            and not active_conflict
        )

        output.append({
            "artisan_id": row["artisan_id"],
            "full_name": row["full_name"],
            "avatar_url": row["avatar_url"],
            "average_rating": float(row["average_rating"] or 0),
            "total_reviews": int(row["total_reviews"] or 0),
            "verification_status": row["verification_status"],
            "is_available": bool(row["is_available"]),
            "hourly_rate": row["hourly_rate"],
            "last_price": int(row["last_price"]),
            "last_booked_at": row["last_booked_at"].isoformat() if row["last_booked_at"] else "",
            "last_job_title": row["last_job_title"],
            "last_category": row["last_category"],
            "instant_book_eligible": eligible,
        })

    return output
