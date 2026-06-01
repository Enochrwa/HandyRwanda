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
from app.models.job import Bid, BidStatus, Job, JobStatus, JobUrgency
from app.models.user import UserRole
from app.services.price_anchor_service import get_price_anchor

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _serialize_job(job: Job, category: Category | None = None, bid_count: int = 0) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "client_id": str(job.client_id),
        "category_id": str(job.category_id),
        "category": {
            "id": str(category.id),
            "name_en": category.name_en,
            "name_rw": category.name_rw,
            "icon_emoji": category.icon_emoji,
        } if category else None,
        "title": job.title,
        "description": job.description,
        "additional_notes": job.additional_notes,
        "location": job.location,
        "location_label": job.location_label,
        "scheduled_time": job.scheduled_time.isoformat() if job.scheduled_time else None,
        "urgency": job.urgency,
        "budget": job.budget,
        "budget_negotiable": bool(job.budget_negotiable),
        "status": job.status,
        "images": job.photos_urls or [],
        "bid_count": bid_count,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


class JobCreate(BaseModel):
    category_id: UUID
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=15, max_length=2000)
    additional_notes: str | None = Field(None, max_length=1000,
        description="Any extra info: materials available, access details, preferred artisan skills")
    latitude: float
    longitude: float
    location_label: str = Field(..., min_length=2, max_length=200)
    scheduled_time: datetime | None = None
    urgency: JobUrgency = JobUrgency.flexible
    budget: int | None = Field(None, ge=500, description="Budget in RWF (minimum 500)")
    budget_negotiable: bool = True
    photos_base64: list[str] = Field(default=[], max_length=5)


class JobUpdate(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=200)
    description: str | None = Field(None, min_length=15, max_length=2000)
    additional_notes: str | None = Field(None, max_length=1000)
    scheduled_time: datetime | None = None
    urgency: JobUrgency | None = None
    budget: int | None = Field(None, ge=500)
    budget_negotiable: bool | None = None
    location_label: str | None = Field(None, min_length=2, max_length=200)


@router.post("", status_code=201)
async def create_job(
    payload: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # AI category suggestion if null UUID provided
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

    # Verify category exists
    cat = await db.scalar(select(Category).where(Category.id == payload.category_id, Category.is_active))
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid or inactive category selected.")

    # Upload photos (max 5)
    photo_urls: list[str] = []
    for base64_data in payload.photos_base64[:5]:
        url = await upload_image(base64_data, f"job-photos/{user_id}")
        photo_urls.append(url)

    job = Job(
        client_id=user_id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        additional_notes=payload.additional_notes,
        location=f"POINT({payload.longitude} {payload.latitude})",
        location_label=payload.location_label,
        scheduled_time=payload.scheduled_time,
        urgency=payload.urgency,
        budget=payload.budget,
        budget_negotiable=payload.budget_negotiable,
        photos_urls=photo_urls,
        status=JobStatus.open,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return _serialize_job(job, cat, 0)


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
        bid_count = await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job.id)) or 0
        jobs.append(_serialize_job(job, cat, bid_count))
    return jobs


@router.get("/available")
async def list_available_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """Artisan-specific: open jobs matching their skill categories."""
    user_id = UUID(current_user["sub"])
    artisan_result = await db.execute(
        select(ArtisanProfile).where(ArtisanProfile.user_id == user_id)
    )
    artisan = artisan_result.scalar_one_or_none()
    if not artisan:
        raise HTTPException(status_code=404, detail="Artisan profile not found")

    query = text("""
        SELECT j.*, c.id AS cat_id, c.name_en, c.name_rw, c.icon_emoji,
               (SELECT COUNT(*) FROM bids b2 WHERE b2.job_id = j.id) AS bid_count
        FROM jobs j
        JOIN categories c ON j.category_id = c.id
        JOIN artisan_skills ask ON j.category_id = ask.category_id
        WHERE ask.artisan_id = :artisan_id
        AND j.status = 'open'
        ORDER BY j.created_at DESC
    """)
    result = await db.execute(query, {"artisan_id": user_id})
    jobs_list = []
    for row in result:
        m = dict(row._mapping)
        jobs_list.append({
            "id": str(m["id"]),
            "client_id": str(m["client_id"]),
            "category_id": str(m["category_id"]),
            "category": {"name_en": m["name_en"], "name_rw": m["name_rw"], "icon_emoji": m["icon_emoji"]},
            "title": m["title"],
            "description": m["description"],
            "additional_notes": m.get("additional_notes"),
            "location_label": m.get("location_label"),
            "urgency": m.get("urgency", "flexible"),
            "budget": m.get("budget"),
            "budget_negotiable": bool(m.get("budget_negotiable", True)),
            "status": m["status"],
            "images": m.get("photos_urls") or [],
            "bid_count": m.get("bid_count", 0),
            "scheduled_time": m["scheduled_time"].isoformat() if m.get("scheduled_time") else None,
            "created_at": m["created_at"].isoformat() if m.get("created_at") else None,
        })
    return jobs_list


@router.get("")
async def list_open_jobs(
    category_id: UUID | None = Query(None),
    district: str | None = Query(None),
    urgency: JobUrgency | None = Query(None),
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
    if urgency:
        query = query.where(Job.urgency == urgency)
    if district:
        query = query.where(Job.location_label.ilike(f"%{district}%"))
    query = query.order_by(Job.created_at.desc()).limit(limit)

    result = await db.execute(query)
    jobs = []
    for job, cat in result:
        bid_count = await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job.id)) or 0
        jobs.append(_serialize_job(job, cat, bid_count))
    return jobs


@router.get("/{job_id}")
async def get_job_detail(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    result = await db.execute(
        select(Job, Category)
        .join(Category, Job.category_id == Category.id)
        .where(Job.id == job_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    job, cat = row

    bid_count = await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job_id)) or 0

    # Price anchoring for artisans
    price_guidance: dict[str, Any] | None = None
    if current_user["role"] == UserRole.artisan:
        district = "Kigali"
        if job.location_label and "," in job.location_label:
            district = job.location_label.split(",")[-1].strip()
        price_guidance = await get_price_anchor(UUID(str(job.category_id)), district, db)

    # Check if current artisan already bid
    already_bid = False
    if current_user["role"] == UserRole.artisan:
        artisan_id = UUID(current_user["sub"])
        existing_bid = await db.scalar(
            select(Bid).where(Bid.job_id == job_id, Bid.artisan_id == artisan_id)
        )
        already_bid = existing_bid is not None

    return {
        "job": _serialize_job(job, cat, bid_count),
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
    """Client can update an open job before any bid is accepted."""
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.client_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in (JobStatus.open, JobStatus.pending_bid):
        raise HTTPException(status_code=400, detail="Cannot edit a job that is already booked or completed.")

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")


    await db.execute(update(Job).where(Job.id == job_id).values(**update_data))
    await db.commit()
    await db.refresh(job)
    cat = await db.scalar(select(Category).where(Category.id == job.category_id))
    bid_count = await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job_id)) or 0
    return _serialize_job(job, cat, bid_count)


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
        raise HTTPException(status_code=400, detail="Cannot cancel job in current status")

    await db.execute(update(Job).where(Job.id == job_id).values(status=JobStatus.cancelled))
    await db.commit()
    return {"message": "Job cancelled"}
