# File: backend/app/services/price_anchor_service.py
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus


async def get_price_anchor(
    category_id: UUID, district: str, db: AsyncSession
) -> dict[str, Any]:
    """
    Returns suggested price range for a category in a district,
    based on historical completed bookings.
    Falls back to default estimates if no data yet.
    """
    # Query historical completed bookings for this category/district
    query = text("""
        SELECT
            MIN(b.agreed_price) AS min_price,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.agreed_price) AS median_price,
            MAX(b.agreed_price) AS max_price,
            COUNT(*) AS sample_size,
            AVG(b.agreed_price) AS avg_price
        FROM bookings b
        JOIN jobs j ON b.job_id = j.id
        JOIN categories c ON j.category_id = c.id
        WHERE c.id = :category_id
          AND b.status = 'completed'
          AND (:district = 'all' OR j.location_label ILIKE :district_pattern)
    """)
    result = await db.execute(
        query,
        {"category_id": category_id, "district": district, "district_pattern": f"%{district}%"},
    )
    row = result.first()

    if row and row.sample_size and row.sample_size >= 3:
        return {
            "min": int(row.min_price),
            "median": int(row.median_price),
            "max": int(row.max_price),
            "avg": int(row.avg_price),
            "currency": "RWF",
            "sample_size": row.sample_size,
            "district": district,
            "is_estimated": False,
        }

    # Fallback: category-wide defaults
    category_defaults: dict[str, dict[str, int]] = {
        "Plumbing": {"min": 5000, "median": 15000, "max": 40000},
        "Electrical": {"min": 8000, "median": 20000, "max": 60000},
        "Carpentry": {"min": 10000, "median": 25000, "max": 80000},
        "Painting": {"min": 15000, "median": 40000, "max": 150000},
        "Cleaning": {"min": 5000, "median": 10000, "max": 30000},
        "Tailoring": {"min": 3000, "median": 8000, "max": 25000},
        "Welding": {"min": 10000, "median": 30000, "max": 100000},
        "Masonry": {"min": 15000, "median": 50000, "max": 200000},
    }
    # Try to fetch category name for better defaults
    from app.models.artisan import Category
    cat = await db.scalar(select(Category).where(Category.id == category_id))
    defaults = category_defaults.get(cat.name_en if cat else "", {"min": 5000, "median": 15000, "max": 50000})
    return {
        "min": defaults["min"],
        "median": defaults["median"],
        "max": defaults["max"],
        "avg": defaults["median"],
        "currency": "RWF",
        "sample_size": 0,
        "district": district,
        "is_estimated": True,
    }
