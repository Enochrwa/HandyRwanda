# File: backend/app/routers/analytics.py
"""
Admin analytics router.

GET /analytics/overview         — key metrics dashboard
GET /analytics/revenue          — revenue by week/month
GET /analytics/funnel           — jobs → bids → bookings → payments funnel
GET /analytics/artisan-leaderboard — top artisans by revenue/rating/completion
GET /analytics/geo-heatmap      — jobs per district + artisans per district
GET /analytics/cohort-retention — client retention by monthly cohort
GET /analytics/export/{report}  — CSV export
"""

import csv
import io
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import require_role
from app.models.artisan import ArtisanProfile
from app.models.booking import Booking, BookingStatus
from app.models.job import Bid, Job, JobStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_overview(
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Key metrics: total users, jobs, bookings, revenue."""
    total_users = await db.scalar(select(func.count(User.id)).where(User.is_active))
    total_artisans = await db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.artisan, User.is_active)
    )
    total_clients = await db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.client, User.is_active)
    )
    total_jobs = await db.scalar(select(func.count(Job.id)))
    open_jobs = await db.scalar(
        select(func.count(Job.id)).where(Job.status == JobStatus.open)
    )
    total_bookings = await db.scalar(select(func.count(Booking.id)))
    completed_bookings = await db.scalar(
        select(func.count(Booking.id)).where(Booking.status == BookingStatus.completed)
    )
    disputed_bookings = await db.scalar(
        select(func.count(Booking.id)).where(Booking.status == BookingStatus.disputed)
    )

    # Revenue (approved payments)
    total_revenue = await db.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.status.in_([PaymentStatus.approved, PaymentStatus.auto_verified])
        )
    )

    # This month
    month_start = datetime.now(timezone.utc).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    month_revenue = await db.scalar(
        select(func.sum(Payment.amount)).where(
            Payment.status.in_([PaymentStatus.approved, PaymentStatus.auto_verified]),
            Payment.created_at >= month_start,
        )
    )
    month_bookings = await db.scalar(
        select(func.count(Booking.id)).where(Booking.created_at >= month_start)
    )

    return {
        "users": {
            "total": total_users or 0,
            "artisans": total_artisans or 0,
            "clients": total_clients or 0,
        },
        "jobs": {"total": total_jobs or 0, "open": open_jobs or 0},
        "bookings": {
            "total": total_bookings or 0,
            "completed": completed_bookings or 0,
            "disputed": disputed_bookings or 0,
            "completion_rate": round(
                (completed_bookings or 0) / max(total_bookings or 1, 1) * 100, 1
            ),
        },
        "revenue": {
            "total_rwf": int(total_revenue or 0),
            "this_month_rwf": int(month_revenue or 0),
            "this_month_bookings": int(month_bookings or 0),
        },
    }


@router.get("/revenue")
async def get_revenue(
    period: str = Query(default="monthly", enum=["weekly", "monthly"]),
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Revenue and booking counts over time."""
    if period == "weekly":
        trunc = "week"
        limit = 12
    else:
        trunc = "month"
        limit = 12

    query = text(f"""
        SELECT
            DATE_TRUNC('{trunc}', p.created_at AT TIME ZONE 'UTC') AS period,
            SUM(p.amount) AS total_revenue,
            COUNT(p.id) AS payment_count,
            AVG(p.amount) AS avg_booking_value
        FROM payments p
        WHERE p.status IN ('approved', 'auto_verified')
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT {limit}
    """)
    try:
        result = await db.execute(query)
        rows = result.mappings().all()
        return [
            {
                "period": row["period"].isoformat() if row["period"] else None,
                "total_revenue_rwf": int(row["total_revenue"] or 0),
                "payment_count": int(row["payment_count"] or 0),
                "avg_booking_value_rwf": int(row["avg_booking_value"] or 0),
            }
            for row in rows
        ]
    except Exception:
        # SQLite fallback
        return []


@router.get("/funnel")
async def get_funnel(
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Conversion funnel: jobs posted → bids received → bookings → payments."""
    jobs = await db.scalar(select(func.count(Job.id)))
    jobs_with_bids = await db.scalar(select(func.count(func.distinct(Bid.job_id))))
    bookings = await db.scalar(select(func.count(Booking.id)))
    payments = await db.scalar(
        select(func.count(Payment.id)).where(
            Payment.status.in_([PaymentStatus.approved, PaymentStatus.auto_verified])
        )
    )

    j = jobs or 1  # avoid division by zero
    return {
        "jobs_posted": jobs or 0,
        "jobs_with_bids": jobs_with_bids or 0,
        "bookings_created": bookings or 0,
        "payments_completed": payments or 0,
        "bid_rate_pct": round((jobs_with_bids or 0) / j * 100, 1),
        "booking_rate_pct": round((bookings or 0) / j * 100, 1),
        "payment_rate_pct": round((payments or 0) / j * 100, 1),
    }


@router.get("/artisan-leaderboard")
async def get_leaderboard(
    metric: str = Query(default="rating", enum=["rating", "completion", "revenue"]),
    limit: int = Query(default=10, le=20),
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    if metric == "revenue":
        try:
            query = text("""
                SELECT u.id, u.full_name, u.avatar_url, u.district,
                       ap.average_rating, ap.total_reviews, ap.completion_rate,
                       COALESCE(SUM(p.amount), 0) AS total_revenue
                FROM users u
                JOIN artisan_profiles ap ON u.id = ap.user_id
                LEFT JOIN bookings b ON b.artisan_id = u.id
                LEFT JOIN payments p ON p.booking_id = b.id AND p.status IN ('approved', 'auto_verified')
                WHERE u.role = 'artisan'
                GROUP BY u.id, u.full_name, u.avatar_url, u.district, ap.average_rating, ap.total_reviews, ap.completion_rate
                ORDER BY total_revenue DESC
                LIMIT :limit
            """)
            result = await db.execute(query, {"limit": limit})
            rows = result.mappings().all()
            return [dict(r) for r in rows]
        except Exception:
            pass

    # Default: by rating
    result = await db.execute(
        select(ArtisanProfile, User)
        .join(User, ArtisanProfile.user_id == User.id)
        .where(User.is_active)
        .order_by(
            ArtisanProfile.completion_rate.desc()
            if metric == "completion"
            else ArtisanProfile.average_rating.desc()
        )
        .limit(limit)
    )
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "avatar_url": u.avatar_url,
            "district": u.district,
            "average_rating": ap.average_rating,
            "total_reviews": ap.total_reviews,
            "completion_rate": ap.completion_rate,
        }
        for ap, u in result.all()
    ]


@router.get("/geo-heatmap")
async def get_geo_heatmap(
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Jobs per district + artisans per district to identify demand/supply gaps."""
    try:
        jobs_query = text("""
            SELECT
                SPLIT_PART(location_label, ',', 1) AS district,
                COUNT(*) AS job_count
            FROM jobs
            WHERE location_label IS NOT NULL
            GROUP BY 1
            ORDER BY 2 DESC
        """)
        jobs_result = await db.execute(jobs_query)
        jobs_by_district = {
            row["district"].strip(): row["job_count"]
            for row in jobs_result.mappings().all()
        }
    except Exception:
        jobs_by_district = {}

    artisans_result = await db.execute(
        select(User.district, func.count(User.id).label("artisan_count"))
        .where(User.role == UserRole.artisan, User.is_active, User.district.isnot(None))
        .group_by(User.district)
    )
    artisans_by_district = {row[0]: row[1] for row in artisans_result.all()}

    # Combine
    all_districts = set(
        list(jobs_by_district.keys()) + list(artisans_by_district.keys())
    )
    return [
        {
            "district": d,
            "job_count": jobs_by_district.get(d, 0),
            "artisan_count": artisans_by_district.get(d, 0),
            "demand_gap": max(
                0, jobs_by_district.get(d, 0) - artisans_by_district.get(d, 0)
            ),
        }
        for d in sorted(all_districts)
    ]


@router.get("/export/{report}")
async def export_report(
    report: str,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Export analytics data as CSV."""
    allowed_reports = ["users", "bookings", "payments", "jobs"]
    if report not in allowed_reports:
        raise HTTPException(
            status_code=400,
            detail=f"Report must be one of: {', '.join(allowed_reports)}",
        )

    output = io.StringIO()
    writer = csv.writer(output)

    if report == "users":
        writer.writerow(
            [
                "id",
                "full_name",
                "email",
                "phone",
                "role",
                "district",
                "account_status",
                "created_at",
            ]
        )
        result = await db.execute(
            select(User).order_by(User.created_at.desc()).limit(5000)
        )
        for u in result.scalars().all():
            writer.writerow(
                [
                    str(u.id),
                    u.full_name,
                    u.email,
                    u.phone_number,
                    u.role,
                    u.district,
                    u.account_status,
                    u.created_at,
                ]
            )

    elif report == "bookings":
        writer.writerow(["id", "status", "agreed_price", "created_at"])
        result = await db.execute(
            select(Booking).order_by(Booking.created_at.desc()).limit(5000)
        )
        for b in result.scalars().all():
            writer.writerow([str(b.id), b.status, b.agreed_price, b.created_at])

    elif report == "payments":
        writer.writerow(["id", "amount", "status", "method", "created_at"])
        result = await db.execute(
            select(Payment).order_by(Payment.created_at.desc()).limit(5000)
        )
        for p in result.scalars().all():
            writer.writerow([str(p.id), p.amount, p.status, p.method, p.created_at])

    elif report == "jobs":
        writer.writerow(
            ["id", "title", "status", "budget", "location_label", "created_at"]
        )
        result = await db.execute(
            select(Job).order_by(Job.created_at.desc()).limit(5000)
        )
        for j in result.scalars().all():
            writer.writerow(
                [str(j.id), j.title, j.status, j.budget, j.location_label, j.created_at]
            )

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={report}_{datetime.now().strftime('%Y%m%d')}.csv"
        },
    )
