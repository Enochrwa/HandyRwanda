from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


async def get_price_anchor(
    category_id: UUID, district: str, db: AsyncSession
) -> dict[str, Any]:
    """
    Returns suggested price range for a category in a district.
    """
    # Simplified mock for now
    # In production, query historical completed bookings
    return {
        "min": 5000,
        "median": 10000,
        "max": 20000,
        "currency": "RWF",
        "sample_size": 15,
    }
