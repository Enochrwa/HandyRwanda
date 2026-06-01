# File: backend/app/services/price_anchor_service.py
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus


async def get_price_anchor(
    category_id: UUID, district: str, db: AsyncSession
) -> dict[str, Any]:
    """
    Returns real price guidance from historical completed bookings in this category/district.
    Falls back to category-level stats if no district data, then global defaults.
    """
    # Try district-specific first
    district_query = text("""
        SELECT
            MIN(b.agreed_price) as min_price,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.agreed_price) as median_price,
            MAX(b.agreed_price) as max_price,
            AVG(b.agreed_price) as avg_price,
            COUNT(*) as sample_size
        FROM bookings b
        JOIN jobs j ON b.job_id = j.id
        WHERE j.category_id = :category_id
          AND b.status = 'completed'
          AND (j.location_label ILIKE :district OR :district = 'Kigali')
          AND b.created_at >= NOW() - INTERVAL '6 months'
    """)

    try:
        result = await db.execute(
            district_query, {"category_id": category_id, "district": f"%{district}%"}
        )
        row = result.one()
        if row.sample_size and row.sample_size >= 3:
            return {
                "min": int(row.min_price or 0),
                "median": int(row.median_price or 0),
                "max": int(row.max_price or 0),
                "avg": int(row.avg_price or 0),
                "currency": "RWF",
                "sample_size": int(row.sample_size),
                "district": district,
                "note": f"Based on {row.sample_size} completed jobs in {district}",
            }
    except Exception:
        pass

    # Fallback: category-wide stats
    try:
        cat_query = text("""
            SELECT
                MIN(b.agreed_price) as min_price,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.agreed_price) as median_price,
                MAX(b.agreed_price) as max_price,
                COUNT(*) as sample_size
            FROM bookings b
            JOIN jobs j ON b.job_id = j.id
            WHERE j.category_id = :category_id
              AND b.status = 'completed'
        """)
        result = await db.execute(cat_query, {"category_id": category_id})
        row = result.one()
        if row.sample_size and row.sample_size >= 1:
            return {
                "min": int(row.min_price or 0),
                "median": int(row.median_price or 0),
                "max": int(row.max_price or 0),
                "avg": int(row.median_price or 0),
                "currency": "RWF",
                "sample_size": int(row.sample_size),
                "district": "Rwanda",
                "note": f"Based on {row.sample_size} completed jobs nationwide",
            }
    except Exception:
        pass

    # Hardcoded fallback defaults per common categories (in RWF)
    return {
        "min": 3000,
        "median": 8000,
        "max": 25000,
        "avg": 9000,
        "currency": "RWF",
        "sample_size": 0,
        "district": district,
        "note": "Market estimate — no historical data yet for this category",
    }
