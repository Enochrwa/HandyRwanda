from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

async def get_price_anchor(category_id: UUID, district: str, db: AsyncSession) -> dict:
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
        "sample_size": 15
    }
