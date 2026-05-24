from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, select, text, update
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
from app.models.user import UserRole

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
    current_user: dict = Depends(require_role(UserRole.artisan)),
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
            profile.location = location_wkt
        db.add(profile)
    else:
        for key, value in payload.dict(exclude_unset=True).items():
            if key not in ["latitude", "longitude"]:
                setattr(profile, key, value)
        if location_wkt:
            profile.location = location_wkt

    await db.commit()
    return {"message": "Profile updated"}


@router.get("/profile/me")
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.artisan)),
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
    current_user: dict = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])
    await upload_image(payload.national_id_doc_base64, f"id-docs/{user_id}/national_id")
    await upload_image(payload.selfie_base64, f"id-docs/{user_id}/selfie")
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == user_id)
        .values(verification_status=VerificationStatus.pending)
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
    current_user: dict = Depends(require_role(UserRole.artisan)),
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


@router.post("/portfolio")
async def add_portfolio_photo(
    payload: PortfolioCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role(UserRole.artisan)),
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
        SELECT u.id, u.full_name, u.avatar_url, ap.average_rating, ap.total_reviews, ap.is_available, ap.verification_status, ap.community_score, ap.hourly_rate,
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
