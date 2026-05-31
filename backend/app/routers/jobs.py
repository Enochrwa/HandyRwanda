# File: backend/app/routers/jobs.py
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.integrations.huggingface import get_job_category_match
from app.integrations.supabase_storage import upload_image
from app.models.artisan import ArtisanProfile, Category
from app.models.job import Job, JobStatus
from app.models.user import UserRole
from app.services.price_anchor_service import get_price_anchor

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreate(BaseModel):
    category_id: UUID
    title: str
    description: str
    latitude: float
    longitude: float
    location_label: str
    scheduled_time: datetime | None = None
    budget: int | None = None
    photos_base64: list[str] = []


@router.post("")
async def create_job(
    payload: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Sprint 3: Category Suggestion (AI matching)
    # If client hasn't specified a valid category, we could suggest one based on title/description
    if str(payload.category_id) == "00000000-0000-0000-0000-000000000000":
        # Get all active categories to use as candidate labels
        cats_res = await db.execute(select(Category).where(Category.is_active))
        all_cats = list(cats_res.scalars().all())
        candidate_labels = [str(c.name_en) for c in all_cats]

        if candidate_labels:
            match_res = await get_job_category_match(
                f"{payload.title} {payload.description}", candidate_labels
            )
            if match_res and "labels" in match_res and len(match_res["labels"]) > 0:
                top_label = match_res["labels"][0]
                for c in all_cats:
                    if c.name_en == top_label:
                        payload.category_id = cast(Any, c).id
                        break

    # Upload photos
    photo_urls = []
    for base64_data in payload.photos_base64:
        url = await upload_image(base64_data, f"job-photos/{user_id}")
        photo_urls.append(url)

    job = Job(
        client_id=user_id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        location=f"POINT({payload.longitude} {payload.latitude})",
        location_label=payload.location_label,
        scheduled_time=payload.scheduled_time,
        budget=payload.budget,
        photos_urls=photo_urls,
        status=JobStatus.open,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {
        "id": str(job.id),
        "client_id": str(job.client_id),
        "category_id": str(job.category_id),
        "title": job.title,
        "description": job.description,
        "location": job.location,
        "location_label": job.location_label,
        "scheduled_time": job.scheduled_time,
        "budget": job.budget,
        "status": job.status,
        "images": job.photos_urls,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


@router.get("/mine")
async def list_my_jobs(
    status: JobStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    query = select(Job).where(Job.client_id == user_id)
    if status:
        query = query.where(Job.status == status)
    result = await db.execute(query.order_by(Job.created_at.desc()))
    jobs = []
    for job in result.scalars().all():
        jobs.append(
            {
                "id": str(job.id),
                "client_id": str(job.client_id),
                "category_id": str(job.category_id),
                "title": job.title,
                "description": job.description,
                "location": job.location,
                "location_label": job.location_label,
                "scheduled_time": job.scheduled_time,
                "budget": job.budget,
                "status": job.status,
                "images": job.photos_urls,
                "created_at": job.created_at,
                "updated_at": job.updated_at,
            }
        )
    return jobs


@router.get("/available")
async def list_available_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Get artisan location and skills
    artisan_result = await db.execute(
        select(ArtisanProfile).where(ArtisanProfile.user_id == user_id)
    )
    artisan = artisan_result.scalar_one_or_none()
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan profile not found")

    # Match open jobs to artisan skills (jobs have no lat/lng columns yet)
    query = text("""
        SELECT j.*
        FROM jobs j
        JOIN artisan_skills ask ON j.category_id = ask.category_id
        WHERE ask.artisan_id = :artisan_id
        AND j.status = 'open'
        ORDER BY j.created_at DESC
    """)

    result = await db.execute(query, {"artisan_id": user_id})
    jobs_list = []
    for row in result:
        job_dict = dict(row._mapping)
        # Convert UUID fields to string
        for uuid_field in ["id", "client_id", "category_id"]:
            if uuid_field in job_dict and isinstance(job_dict[uuid_field], UUID):
                job_dict[uuid_field] = str(job_dict[uuid_field])
        jobs_list.append(job_dict)
    return jobs_list


@router.get("/{job_id}")
async def get_job_detail(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Sprint 3: Add price anchoring guidance for artisans
    price_guidance: dict[str, Any] | None = None
    if current_user["role"] == UserRole.artisan:
        # We use a default district for now, or extract from location label
        district = "Kigali"
        if job.location_label and "," in job.location_label:
            district = job.location_label.split(",")[-1].strip()

        price_guidance = await get_price_anchor(
            UUID(str(job.category_id)), district, db
        )

    return {
        "job": {
            "id": str(job.id),
            "client_id": str(job.client_id),
            "category_id": str(job.category_id),
            "title": job.title,
            "description": job.description,
            "location": job.location,
            "location_label": job.location_label,
            "scheduled_time": job.scheduled_time,
            "budget": job.budget,
            "status": job.status,
            "images": job.photos_urls,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
        },
        "price_guidance": price_guidance,
    }


@router.delete("/{job_id}")
async def cancel_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.client_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.open:
        raise HTTPException(
            status_code=400, detail="Cannot cancel job in current status"
        )

    job.status = cast(Any, JobStatus.cancelled)
    await db.commit()
    return {"message": "Job cancelled"}


@router.get("")
async def list_open_jobs(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Public: list all open jobs for artisans to bid on."""
    from sqlalchemy import select as _select
    from app.models.artisan import Category as Cat
    from app.models.job import Bid

    result = await db.execute(
        _select(Job, Cat)
        .join(Cat, Job.category_id == Cat.id)
        .where(Job.status == JobStatus.open)
        .order_by(Job.created_at.desc())
        .limit(50)
    )
    jobs = []
    for job, cat in result:
        # count bids
        bid_count = await db.scalar(
            _select(func.count(Bid.id)).where(Bid.job_id == job.id)
        ) or 0
        jobs.append({
            "id": str(job.id),
            "title": job.title,
            "description": job.description,
            "budget": job.budget,
            "location_label": job.location_label,
            "scheduled_time": job.scheduled_time.isoformat() if job.scheduled_time else None,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "bid_count": bid_count,
            "category": {"name_en": cat.name_en, "icon_emoji": cat.icon_emoji},
        })
    return jobs
