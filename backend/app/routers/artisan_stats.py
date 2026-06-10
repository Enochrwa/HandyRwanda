# File: backend/app/routers/artisan_stats.py
"""
Sprint 6 — Artisan Income Intelligence Dashboard API

Routes:
  GET /artisans/me/earnings?period=week|month|year
      → Comprehensive earnings data: totals, trends, category breakdown,
        by-day chart data, forecast, and performance metrics.

  GET /artisans/me/earnings/leaderboard
      → Artisan's rank within their district (no absolute earnings exposed).

  GET /artisans/me/earnings/forecast
      → Raw ML forecast data: next 4 weeks projection + confidence.

All routes are artisan-only (JWT required, role=artisan).
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import require_role
from app.models.user import UserRole
from app.services.earnings_forecast_service import (
    forecast_earnings,
    get_earnings_summary,
    get_leaderboard,
)

router = APIRouter(prefix="/artisans/me/earnings", tags=["artisan-income"])


@router.get("")
async def get_earnings(
    period: str = Query(
        default="month",
        description="Time period: week | month | year",
        regex="^(week|month|year)$",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Comprehensive earnings intelligence endpoint.

    Returns totals, growth vs previous period, day-by-day chart data,
    category breakdown, best working hours, pending payout balance,
    ML-powered earnings forecast, and performance metrics.

    Designed to power the full Income Intelligence Dashboard in both
    web and mobile.

    Example response:
    ```json
    {
      "period": "month",
      "total_earned": 185000,
      "total_jobs": 12,
      "avg_job_value": 15416,
      "growth_pct": 30.3,
      "best_day": {"date": "2025-05-15", "earned": 45000, "jobs": 3},
      "by_category": [
        {"category": "Plumbing", "emoji": "🔧", "jobs": 7, "earned": 105000, "pct": 56.7}
      ],
      "by_day": [{"date": "2025-05-01", "earned": 0, "jobs": 0}, ...],
      "pending_payout": 45000,
      "projected_monthly": 220000,
      "forecast": {
        "next_4_weeks_forecast": [48000, 52000, 55000, 57000],
        "trend": "up",
        "confidence": "high",
        "method": "linear_regression"
      },
      "rating_this_period": 4.7,
      "on_time_rate": 0.91
    }
    ```
    """
    artisan_id = UUID(current_user["sub"])
    return await get_earnings_summary(artisan_id, period, db)


@router.get("/leaderboard")
async def get_earnings_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    Returns the artisan's rank among peers in their district.

    Only the artisan's own rank is returned — other artisans' absolute
    earnings are never exposed. This preserves privacy while motivating
    competitive performance.

    Example response:
    ```json
    {
      "your_rank": 3,
      "total_in_district": 47,
      "top_10_pct": false,
      "district": "Gasabo"
    }
    ```
    """
    artisan_id = UUID(current_user["sub"])
    return await get_leaderboard(artisan_id, db)


@router.get("/forecast")
async def get_earnings_forecast(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    """
    ML-powered earnings forecast for the next 4 weeks.

    Uses LinearRegression trained on the last 12 weeks of weekly earnings
    with exponential recency weights (recent weeks count more). Falls back
    to a rolling average when fewer than 6 data points are available.

    Example response:
    ```json
    {
      "next_4_weeks_forecast": [48000, 52000, 55000, 57000],
      "trend": "up",
      "projected_monthly": 212000,
      "confidence": "high",
      "method": "linear_regression",
      "history_weeks": 12,
      "weekly_history": [
        {"week_label": "W1", "earned": 35000},
        ...
      ]
    }
    ```
    """
    artisan_id = UUID(current_user["sub"])
    return await forecast_earnings(artisan_id, db)
