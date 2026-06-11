# File: backend/app/routers/jobs.py
import asyncio
import logging
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
from app.models.job import Bid, Job, JobStatus, JobUrgency
from app.models.user import UserRole
from app.services.matching_service import notify_matching_artisans
from app.services.price_anchor_service import get_price_anchor
from app.services.sklearn_category_service import suggest_job_description
from app.utils.rwanda_address import format_full_address

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)


def _serialize_job(
    job: Job, category: Category | None = None, bid_count: int = 0
) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "client_id": str(job.client_id),
        "category_id": str(job.category_id),
        "category": {
            "id": str(category.id),
            "name_en": category.name_en,
            "name_rw": category.name_rw,
            "icon_emoji": category.icon_emoji,
        }
        if category
        else None,
        "title": job.title,
        "description": job.description,
        "additional_notes": job.additional_notes,
        # Geo
        "location": job.location,
        "latitude": job.latitude,
        "longitude": job.longitude,
        # Human-readable labels
        "location_label": job.location_label,
        # Structured Rwanda address
        "address": {
            "province": job.province,
            "district": job.district,
            "sector": job.sector,
            "cell": job.cell,
            "village": job.village,
            "street_road": job.street_road,
            "house_number": job.house_number,
            "landmark": job.landmark,
        },
        "scheduled_time": job.scheduled_time.isoformat()
        if job.scheduled_time
        else None,
        "urgency": job.urgency,
        "budget": job.budget,
        "budget_negotiable": bool(job.budget_negotiable),
        "status": job.status,
        "images": job.photos_urls or [],
        "bid_count": bid_count,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }


class RwandaAddressInput(BaseModel):
    """Structured Rwanda address — all fields optional except district."""

    province: str | None = Field(None, max_length=100)
    district: str = Field(..., min_length=2, max_length=100)
    sector: str | None = Field(None, max_length=100)
    cell: str | None = Field(None, max_length=100)
    village: str | None = Field(None, max_length=100)
    street_road: str | None = Field(None, max_length=200)
    house_number: str | None = Field(
        None,
        max_length=50,
        description="Plot/house number, apartment number, floor, etc.",
    )
    landmark: str | None = Field(
        None,
        max_length=200,
        description="Nearby landmark to help artisan find the exact spot (e.g. 'Near Total petrol station')",
    )


class JobCreate(BaseModel):
    category_id: UUID
    title: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=15, max_length=2000)
    additional_notes: str | None = Field(
        None,
        max_length=1000,
        description="Extra info: materials available, access details, preferred artisan skills",
    )
    latitude: float
    longitude: float
    # Structured address (preferred — replaces free-text location_label)
    address: RwandaAddressInput | None = None
    # Fallback plain label (used if address not provided)
    location_label: str | None = Field(None, min_length=2, max_length=400)
    scheduled_time: datetime | None = None
    urgency: JobUrgency = JobUrgency.flexible
    budget: int | None = Field(None, ge=500, description="Budget in RWF (minimum 500)")
    budget_negotiable: bool = True
    photos_base64: list[str] = Field(default=[], max_length=5)
    photos_urls: list[str] = Field(
        default=[],
        max_length=5,
        description="Already-uploaded photo URLs (from presigned upload)",
    )


class JobUpdate(BaseModel):
    title: str | None = Field(None, min_length=5, max_length=200)
    description: str | None = Field(None, min_length=15, max_length=2000)
    additional_notes: str | None = Field(None, max_length=1000)
    scheduled_time: datetime | None = None
    urgency: JobUrgency | None = None
    budget: int | None = Field(None, ge=500)
    budget_negotiable: bool | None = None
    location_label: str | None = Field(None, min_length=2, max_length=400)
    address: RwandaAddressInput | None = None


class JobSuggestRequest(BaseModel):
    """Request body for POST /jobs/suggest."""
    partial_description: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="Partial or complete job description to classify and enrich.",
    )


@router.post("/suggest", summary="Sprint 9 — AI Job Description Assistant")
async def suggest_job(
    payload: JobSuggestRequest,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    **Sprint 9 — sklearn-Powered Job Description Assistant**

    Given a partial job description, returns:
    - `suggested_category` — best matching service category (id, name_en, emoji)
    - `confidence` — classifier confidence score [0, 1]
    - `related_suggestions` — up to 3 context-aware tips from similar historical jobs
    - `typical_price_range` — interquartile price range from completed similar jobs
    - `source` — "sklearn" | "local" (indicates which classifier was used)

    No authentication required — safe to call while the user is still typing.
    Response time target: < 50 ms (pure in-memory inference).
    """
    result = await suggest_job_description(
        partial_description=payload.partial_description,
        db=db,
    )
    return result


@router.post("", status_code=201)
async def create_job(
    payload: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.client)),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Validate: need either address.district or location_label
    if not payload.address and not payload.location_label:
        raise HTTPException(
            status_code=422,
            detail="Provide either `address.district` or `location_label`.",
        )

    # AI category suggestion if null UUID provided — now uses sklearn TF-IDF (Sprint 9)
    if str(payload.category_id) == "00000000-0000-0000-0000-000000000000":
        cats_res = await db.execute(select(Category).where(Category.is_active))
        all_cats = list(cats_res.scalars().all())
        candidate_labels = [str(c.name_en) for c in all_cats]
        if candidate_labels:
            try:
                from app.services.sklearn_category_service import classify_with_sklearn  # noqa: PLC0415, I001
                match_res = classify_with_sklearn(
                    f"{payload.title} {payload.description}", candidate_labels
                )
            except Exception:
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
    cat = await db.scalar(
        select(Category).where(Category.id == payload.category_id, Category.is_active)
    )
    if not cat:
        raise HTTPException(
            status_code=400, detail="Invalid or inactive category selected."
        )

    # Upload photos via base64 (legacy path) — max 5
    photo_urls: list[str] = list(payload.photos_urls[:5])
    remaining_slots = 5 - len(photo_urls)
    for base64_data in payload.photos_base64[:remaining_slots]:
        url = await upload_image(base64_data, f"job-photos/{user_id}")
        photo_urls.append(url)

    # Build location label from structured address if provided
    addr = payload.address
    if addr:
        computed_label = format_full_address(
            province=addr.province,
            district=addr.district,
            sector=addr.sector,
            cell=addr.cell,
            village=addr.village,
            street_road=addr.street_road,
            house_number=addr.house_number,
            landmark=addr.landmark,
        )
    else:
        computed_label = payload.location_label or "Rwanda"

    job = Job(
        client_id=user_id,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        additional_notes=payload.additional_notes,
        location=f"POINT({payload.longitude} {payload.latitude})",
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_label=computed_label,
        # Structured fields
        province=addr.province if addr else None,
        district=addr.district if addr else None,
        sector=addr.sector if addr else None,
        cell=addr.cell if addr else None,
        village=addr.village if addr else None,
        street_road=addr.street_road if addr else None,
        house_number=addr.house_number if addr else None,
        landmark=addr.landmark if addr else None,
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

    # Trigger smart matching: notify top-5 artisans in background
    assert job.id is not None, "Job ID must be set after commit"
    asyncio.create_task(_notify_artisans_async(job.id, cat.name_en if cat else ""))

    return _serialize_job(job, cat, 0)


async def _notify_artisans_async(job_id: UUID, category_name: str) -> None:
    """Background task: fetch fresh DB session and notify matching artisans."""
    from app.database import AsyncSessionLocal  # noqa: PLC0415

    try:
        async with AsyncSessionLocal() as session:
            job = await session.scalar(select(Job).where(Job.id == job_id))
            if job:
                await notify_matching_artisans(session, job, category_name)
                await session.commit()
    except Exception as e:
        logger.error("[MatchingService] Error notifying artisans for job %s: %s", job_id, e)


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
    rows = result.all()

    if not rows:
        return []

    # Single query for all bid counts (no N+1)
    job_ids = [job.id for job, _ in rows]
    bid_counts_res = await db.execute(
        select(Bid.job_id, func.count(Bid.id).label("cnt"))
        .where(Bid.job_id.in_(job_ids))
        .group_by(Bid.job_id)
    )
    bid_count_map: dict[object, int] = {row.job_id: row.cnt for row in bid_counts_res.all()}

    return [_serialize_job(job, cat, bid_count_map.get(job.id, 0)) for job, cat in rows]


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
        jobs_list.append(
            {
                "id": str(m["id"]),
                "client_id": str(m["client_id"]),
                "category_id": str(m["category_id"]),
                "category": {
                    "name_en": m["name_en"],
                    "name_rw": m["name_rw"],
                    "icon_emoji": m["icon_emoji"],
                },
                "title": m["title"],
                "description": m["description"],
                "additional_notes": m.get("additional_notes"),
                "latitude": m.get("latitude"),
                "longitude": m.get("longitude"),
                "location_label": m.get("location_label"),
                "address": {
                    "province": m.get("province"),
                    "district": m.get("district"),
                    "sector": m.get("sector"),
                    "cell": m.get("cell"),
                    "village": m.get("village"),
                    "street_road": m.get("street_road"),
                    "house_number": m.get("house_number"),
                    "landmark": m.get("landmark"),
                },
                "urgency": m.get("urgency", "flexible"),
                "budget": m.get("budget"),
                "budget_negotiable": bool(m.get("budget_negotiable", True)),
                "status": m["status"],
                "images": m.get("photos_urls") or [],
                "bid_count": m.get("bid_count", 0),
                "scheduled_time": m["scheduled_time"].isoformat()
                if m.get("scheduled_time")
                else None,
                "created_at": m["created_at"].isoformat()
                if m.get("created_at")
                else None,
            }
        )
    return jobs_list


@router.get("")
async def list_open_jobs(
    category_id: UUID | None = Query(None),
    district: str | None = Query(None),
    sector: str | None = Query(None),
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
        query = query.where(
            (Job.district == district) | Job.location_label.ilike(f"%{district}%")
        )
    if sector:
        query = query.where(Job.sector == sector)
    query = query.order_by(Job.created_at.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return []

    # Single query for all bid counts (no N+1)
    job_ids = [job.id for job, _ in rows]
    bid_counts_res = await db.execute(
        select(Bid.job_id, func.count(Bid.id).label("cnt"))
        .where(Bid.job_id.in_(job_ids))
        .group_by(Bid.job_id)
    )
    bid_count_map: dict[object, int] = {row.job_id: row.cnt for row in bid_counts_res.all()}

    return [_serialize_job(job, cat, bid_count_map.get(job.id, 0)) for job, cat in rows]


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

    bid_count = (
        await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job_id)) or 0
    )

    # Price anchoring for artisans
    price_guidance: dict[str, Any] | None = None
    if current_user["role"] == UserRole.artisan:
        district = job.district or "Kigali"
        price_guidance = await get_price_anchor(
            UUID(str(job.category_id)), district, db
        )

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
        raise HTTPException(
            status_code=400,
            detail="Cannot edit a job that is already booked or completed.",
        )

    update_data = payload.model_dump(exclude_none=True)
    # Flatten structured address into top-level columns
    if "address" in update_data:
        addr = update_data.pop("address")
        update_data.update(
            {
                "province": addr.get("province"),
                "district": addr.get("district"),
                "sector": addr.get("sector"),
                "cell": addr.get("cell"),
                "village": addr.get("village"),
                "street_road": addr.get("street_road"),
                "house_number": addr.get("house_number"),
                "landmark": addr.get("landmark"),
            }
        )
        if "location_label" not in update_data:
            update_data["location_label"] = format_full_address(
                **{
                    k: addr.get(k)
                    for k in [
                        "province",
                        "district",
                        "sector",
                        "cell",
                        "village",
                        "street_road",
                        "house_number",
                        "landmark",
                    ]
                }
            )

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    await db.execute(update(Job).where(Job.id == job_id).values(**update_data))
    await db.commit()
    await db.refresh(job)
    cat = await db.scalar(select(Category).where(Category.id == job.category_id))
    bid_count = (
        await db.scalar(select(func.count(Bid.id)).where(Bid.job_id == job_id)) or 0
    )
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
        raise HTTPException(
            status_code=400, detail="Cannot cancel job in current status"
        )

    await db.execute(
        update(Job).where(Job.id == job_id).values(status=JobStatus.cancelled)
    )
    await db.commit()
    return {"message": "Job cancelled"}


# ── Sprint 9: ML-ranked recommended artisans for a client ────────────────────


@router.get("/recommended-artisans", summary="Sprint 9 — ML-ranked artisan recommendations")
async def get_recommended_artisans(
    limit: int = Query(default=6, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """
    **Sprint 9 — Personalised Artisan Recommendations**

    Returns ML-ranked artisans for the current client, based on their last job
    category. Artisans are scored by GradientBoosting P(hire + complete) and
    enriched with district_match, price_delta, and verification signals.

    Falls back to top-rated artisans when the model isn't trained yet or the
    client has no job history.
    """
    from app.services.matching_service import get_recommended_artisans as _get  # noqa: PLC0415, I001

    client_id = UUID(current_user["sub"])
    results = await _get(db, client_id, limit=limit)
    return {"artisans": results, "total": len(results)}
