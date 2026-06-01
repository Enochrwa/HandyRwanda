# File: backend/app/routers/jobs.py
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.integrations.huggingface import get_job_category_match
from app.integrations.supabase_storage import upload_image
from app.models.artisan import ArtisanProfile, Category
from app.models.job import Bid, BidStatus, Job, JobStatus, JobType, UrgencyLevel
from app.models.user import UserRole
from app.services.price_anchor_service import get_price_anchor

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreate(BaseModel):
    category_id: UUID
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=15, max_length=2000)
    latitude: float
    longitude: float
    location_label: str
    scheduled_time: datetime | None = None
    budget: int | None = None
    budget_max: int | None = None
    job_type: JobType = JobType.one_time
    urgency: UrgencyLevel = UrgencyLevel.flexible
    special_requirements: str | None = None
    is_remote_possible: bool = False
    photos_base64: list[str] = []


class JobUpdate(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=200)
    description: str | None = Field(None, min_length=15, max_length=2000)
    location_label: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    scheduled_time: datetime | None = None
    budget: int | None = None
    budget_max: int | None = None
    job_type: JobType | None = None
    urgency: UrgencyLevel | None = None
    special_requirements: str | None = None
    is_remote_possible: bool | None = None


def _job_to_dict(job: Job, cat: Category | None = None, bid_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "client_id": str(job.client_id),
        "category_id": str(job.category_id),
        "title": job.title,
        "description": job.description,
        "location": job.location,
        "location_label": job.location_label,
        "latitude": job.latitude,
        "longitude": job.longitude,
        "scheduled_time": job.scheduled_time.isoformat() if job.scheduled_time else None,
        "budget": job.budget,
        "budget_max": job.budget_max,
        "job_type": job.job_type,
        "urgency": job.urgency,
        "special_requirements": job.special_requirements,
        "is_remote_possible": job.is_remote_possible,
        "status": job.status,
        "images": job.photos_urls or [],
        "bid_count": bid_count,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
        "category": {
            "id": str(cat.id),
            "name_en": cat.name_en,
            "name_rw": cat.name_rw,
            "icon_emoji": cat.icon_emoji,
        } if cat else None,
    }


@router.post("", status_code=201)
async def create_job(
    payload: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # AI Category Suggestion if zero UUID
    if str(payload.category_id) == "00000000-0000-0000-0000-000000000000":
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

    # Validate category exists
    cat_check = await db.scalar(select(Category).where(Category.id == payload.category_id))
    if not cat_check:
        raise HTTPException(status_code=400, detail="Invalid category_id")

    # Upload photos
    photo_urls = []
    for base64_data in payload.photos_base64[:5]:  # max 5 photos
        url = await upload_image(base64_data, f"job-photos/{user_id}")
        photo_urls.append(url)

    job = Job(
        client_id=user_id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        location=f"POINT({payload.longitude} {payload.latitude})",
        location_label=payload.location_label,
        latitude=payload.latitude,
        longitude=payload.longitude,
        scheduled_time=payload.scheduled_time,
        budget=payload.budget,
        budget_max=payload.budget_max,
        job_type=payload.job_type,
        urgency=payload.urgency,
        special_requirements=payload.special_requirements,
        is_remote_possible=payload.is_remote_possible,
        photos_urls=photo_urls,
        status=JobStatus.open,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    cat = await db.scalar(select(Category).where(Category.id == job.category_id))
    return _job_to_dict(job, cat)


@router.get("/mine")
async def list_my_jobs(
    status: JobStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    query = (
        select(Job, Category)
        .join(Category, Job.category_id == Category.id)
        .where(Job.client_id == user_id)
    )
    if status:
        query = query.where(Job.status == status)
    result = await db.execute(query.order_by(Job.created_at.desc()))
    jobs = []
    for job, cat in result:
        bid_count = await db.scalar(
            select(func.count(Bid.id)).where(Bid.job_id == job.id)
        ) or 0
        jobs.append(_job_to_dict(job, cat, bid_count))
    return jobs


@router.get("/available")
async def list_available_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Jobs matching artisan's skills — with full category info and bid counts."""
    user_id = UUID(current_user["sub"])

    artisan_result = await db.execute(
        select(ArtisanProfile).where(ArtisanProfile.user_id == user_id)
    )
    artisan = artisan_result.scalar_one_or_none()
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan profile not found")

    query = text("""
        SELECT j.id, j.title, j.description, j.budget, j.budget_max,
               j.location_label, j.latitude, j.longitude, j.scheduled_time,
               j.status, j.job_type, j.urgency, j.photos_urls, j.created_at,
               j.special_requirements, j.is_remote_possible,
               j.client_id, j.category_id,
               c.name_en AS cat_name_en, c.name_rw AS cat_name_rw,
               c.icon_emoji AS cat_icon,
               (SELECT COUNT(*) FROM bids b2 WHERE b2.job_id = j.id) AS bid_count,
               (SELECT COUNT(*) FROM bids b3 WHERE b3.job_id = j.id AND b3.artisan_id = :artisan_id) AS already_bid
        FROM jobs j
        JOIN categories c ON j.category_id = c.id
        JOIN artisan_skills ask ON j.category_id = ask.category_id
        WHERE ask.artisan_id = :artisan_id
        AND j.status = 'open'
        ORDER BY
            CASE j.urgency WHEN 'urgent' THEN 0 WHEN 'today' THEN 1 WHEN 'tomorrow' THEN 2 ELSE 3 END,
            j.created_at DESC
    """)
    result = await db.execute(query, {"artisan_id": user_id})
    jobs_list = []
    for row in result:
        d = dict(row._mapping)
        for f in ["id", "client_id", "category_id"]:
            if f in d and d[f] is not None:
                d[f] = str(d[f])
        d["already_bid"] = bool(d.get("already_bid", 0))
        d["category"] = {
            "name_en": d.pop("cat_name_en"),
            "name_rw": d.pop("cat_name_rw"),
            "icon_emoji": d.pop("cat_icon"),
        }
        if d.get("scheduled_time"):
            d["scheduled_time"] = d["scheduled_time"].isoformat()
        if d.get("created_at"):
            d["created_at"] = d["created_at"].isoformat()
        jobs_list.append(d)
    return jobs_list


@router.get("")
async def list_open_jobs(
    category_id: UUID | None = Query(None),
    limit: int = Query(default=50, le=100),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Public: list all open jobs for artisans to bid on."""
    query = (
        select(Job, Category)
        .join(Category, Job.category_id == Category.id)
        .where(Job.status == JobStatus.open)
    )
    if category_id:
        query = query.where(Job.category_id == category_id)
    query = query.order_by(
        Job.created_at.desc()
    ).limit(limit)

    result = await db.execute(query)
    jobs = []
    for job, cat in result:
        bid_count = (
            await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job.id)) or 0
        )
        jobs.append(_job_to_dict(job, cat, bid_count))
    return jobs


@router.get("/{job_id}")
async def get_job_detail(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    result = await db.execute(
        select(Job, Category).join(Category, Job.category_id == Category.id).where(Job.id == job_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")

    job, cat = row
    bid_count = await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job.id)) or 0

    price_guidance: dict[str, Any] | None = None
    if current_user.get("role") == UserRole.artisan:
        district = "Kigali"
        if job.location_label and "," in job.location_label:
            district = job.location_label.split(",")[-1].strip()
        price_guidance = await get_price_anchor(UUID(str(job.category_id)), district, db)

    # Check if current artisan already bid
    already_bid = False
    if current_user.get("role") == UserRole.artisan:
        user_id = UUID(current_user["sub"])
        existing_bid = await db.scalar(
            select(Bid).where(Bid.job_id == job_id, Bid.artisan_id == user_id)
        )
        already_bid = existing_bid is not None

    return {
        "job": _job_to_dict(job, cat, bid_count),
        "price_guidance": price_guidance,
        "already_bid": already_bid,
    }


@router.patch("/{job_id}")
async def update_job(
    job_id: UUID,
    payload: JobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    """Client updates their own open job."""
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.client_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.open, JobStatus.pending_bid):
        raise HTTPException(status_code=400, detail="Cannot edit job in current status")

    update_data = payload.model_dump(exclude_none=True)
    if "latitude" in update_data and "longitude" in update_data:
        update_data["location"] = f"POINT({update_data['longitude']} {update_data['latitude']})"

    await db.execute(update(Job).where(Job.id == job_id).values(**update_data))
    await db.commit()
    await db.refresh(job)
    cat = await db.scalar(select(Category).where(Category.id == job.category_id))
    bid_count = await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job.id)) or 0
    return _job_to_dict(job, cat, bid_count)


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

    if job.status not in (JobStatus.open, JobStatus.pending_bid):
        raise HTTPException(
            status_code=400, detail="Cannot cancel job in current status"
        )

    job.status = cast(Any, JobStatus.cancelled)
    await db.commit()
    return {"message": "Job cancelled"}
