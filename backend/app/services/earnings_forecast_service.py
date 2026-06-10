# File: backend/app/services/earnings_forecast_service.py
"""
Sprint 6 — Artisan Earnings Forecast Service (sklearn ML)

Uses LinearRegression on the last 12 weeks of weekly earnings to project
the next 4 weeks. Falls back to simple rolling average when data is sparse.

Design principles:
  - Pure numpy/sklearn: microsecond inference on < 20 data points — no GPU.
  - Async-safe: all DB calls use SQLAlchemy AsyncSession.
  - Graceful degradation: returns a simple average when fewer than 6 weeks
    of history are available.
  - Models are NOT persisted — earnings change daily, so we re-fit on each
    request (< 1ms cost). No cold-start, no stale models.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_log = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

HISTORY_WEEKS = 12
FORECAST_WEEKS = 4
MIN_POINTS_FOR_ML = 6


# ── ML helper — extracted to keep forecast_earnings under complexity limit ────

def _run_linear_regression(
    weekly_earnings: list[int],
) -> tuple[list[float], str, str, str]:
    """
    Fit LinearRegression on weekly earnings; return (forecast, trend, confidence, method).

    Raises ImportError if sklearn/numpy are absent — caller falls back gracefully.
    """
    import numpy as np  # noqa: PLC0415
    from sklearn.linear_model import LinearRegression  # noqa: PLC0415

    n = len(weekly_earnings)
    x_train = np.array(range(n)).reshape(-1, 1)
    y_train = np.array(weekly_earnings, dtype=float)

    # Exponential recency weights: recent weeks count more
    weights = np.exp(np.linspace(-1, 0, n))
    model = LinearRegression().fit(x_train, y_train, sample_weight=weights)

    future_x = np.array(range(n, n + FORECAST_WEEKS)).reshape(-1, 1)
    raw_forecast = model.predict(future_x)
    forecast = [max(0.0, float(v)) for v in raw_forecast]

    coef = float(model.coef_[0])
    if coef > 500:
        trend = "up"
    elif coef < -500:
        trend = "down"
    else:
        trend = "stable"

    nonzero = sum(1 for v in weekly_earnings if v > 0)
    confidence = "high" if nonzero >= 10 else "medium"
    return forecast, trend, confidence, "linear_regression"


def _rolling_average_forecast(weekly_earnings: list[int]) -> list[float]:
    """Fallback: average of last 4 non-zero weeks, repeated FORECAST_WEEKS times."""
    recent = [v for v in weekly_earnings[-4:] if v > 0]
    avg = sum(recent) / len(recent) if recent else 0.0
    return [avg] * FORECAST_WEEKS


def _build_dense_series(
    week_map: dict[datetime, int],
    since: datetime,
) -> tuple[list[int], list[str]]:
    """Fill any missing weeks with 0 to produce a dense HISTORY_WEEKS series."""
    earnings: list[int] = []
    labels: list[str] = []
    base = since.replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(HISTORY_WEEKS):
        week_key = base + timedelta(weeks=i)
        earned = 0
        for stored_week, val in week_map.items():
            if abs((stored_week - week_key).total_seconds()) < 7 * 24 * 3600:
                earned = val
                break
        earnings.append(earned)
        labels.append(f"W{i + 1}")
    return earnings, labels


# ── Core ML forecast function ─────────────────────────────────────────────────

async def forecast_earnings(artisan_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """
    Project the next 4 weeks of earnings using sklearn LinearRegression.

    Returns:
        {
            "next_4_weeks_forecast": [12000, 14000, 16000, 18000],
            "trend": "up" | "down" | "stable",
            "projected_monthly": 60000,
            "confidence": "high" | "medium" | "low",
            "method": "linear_regression" | "rolling_average",
            "history_weeks": 12,
            "weekly_history": [{"week_label": "W1", "earned": 8000}, ...],
        }
    """
    since = datetime.now(timezone.utc) - timedelta(weeks=HISTORY_WEEKS)

    weekly_query = text("""
        SELECT
            date_trunc('week', created_at) AS week_start,
            COALESCE(SUM(agreed_price), 0)::bigint AS earned
        FROM bookings
        WHERE artisan_id = :artisan_id
          AND status     = 'completed'
          AND created_at >= :since
        GROUP BY week_start
        ORDER BY week_start ASC
    """)
    result = await db.execute(weekly_query, {"artisan_id": artisan_id, "since": since})
    rows = result.mappings().all()

    week_map: dict[datetime, int] = {}
    for row in rows:
        ws = row["week_start"]
        if hasattr(ws, "replace"):
            ws = ws.replace(tzinfo=timezone.utc)
        week_map[ws] = int(row["earned"])

    weekly_earnings, weekly_labels = _build_dense_series(week_map, since)
    nonzero = sum(1 for v in weekly_earnings if v > 0)

    forecast: list[float] = []
    trend = "stable"
    method = "rolling_average"
    confidence = "low"

    if nonzero >= MIN_POINTS_FOR_ML:
        try:
            forecast, trend, confidence, method = _run_linear_regression(weekly_earnings)
        except (ImportError, Exception) as exc:
            _log.warning("ML forecast unavailable (%s) — using rolling average", exc)
            forecast = _rolling_average_forecast(weekly_earnings)
    else:
        forecast = _rolling_average_forecast(weekly_earnings)
        last_avg = sum(weekly_earnings[-4:]) / 4
        first_avg = sum(weekly_earnings[:4]) / 4 if nonzero > 0 else 0
        if last_avg > first_avg * 1.1:
            trend = "up"
        elif last_avg < first_avg * 0.9:
            trend = "down"

    projected_monthly = sum(forecast)

    return {
        "next_4_weeks_forecast": [round(v) for v in forecast],
        "trend": trend,
        "projected_monthly": round(projected_monthly),
        "confidence": confidence,
        "method": method,
        "history_weeks": len(weekly_earnings),
        "weekly_history": [
            {"week_label": weekly_labels[i], "earned": weekly_earnings[i]}
            for i in range(len(weekly_earnings))
        ],
    }


# ── Comprehensive earnings summary ────────────────────────────────────────────

async def get_earnings_summary(
    artisan_id: UUID,
    period: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Full earnings intelligence for the artisan income dashboard.
    Returns the complete response for GET /artisans/me/earnings?period=...
    """
    now = datetime.now(timezone.utc)

    if period == "week":
        period_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        prev_start = period_start - timedelta(weeks=1)
        prev_end = period_start
    elif period == "year":
        period_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = period_start.replace(year=now.year - 1)
        prev_end = period_start
    else:
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if period_start.month == 1:
            prev_start = period_start.replace(year=now.year - 1, month=12)
        else:
            prev_start = period_start.replace(month=period_start.month - 1)
        prev_end = period_start

    core_query = text("""
        SELECT
            COALESCE(SUM(b.agreed_price), 0)::bigint          AS total_earned,
            COUNT(b.id)::int                                   AS total_jobs,
            COALESCE(AVG(b.agreed_price), 0)::float            AS avg_job_value,
            COALESCE(SUM(CASE WHEN b.arrived_at IS NOT NULL
                              AND b.started_at IS NOT NULL
                              AND (b.started_at - b.arrived_at) < interval '10 minutes'
                         THEN 1 ELSE 0 END)::float /
                     NULLIF(COUNT(b.id), 0), 0)                AS on_time_rate
        FROM bookings b
        WHERE b.artisan_id = :artisan_id
          AND b.status     = 'completed'
          AND b.created_at >= :period_start
    """)
    core_res = await db.execute(
        core_query, {"artisan_id": artisan_id, "period_start": period_start}
    )
    core = core_res.mappings().one()

    prev_res = await db.execute(
        text("""
            SELECT COALESCE(SUM(agreed_price), 0)::bigint AS total
            FROM bookings
            WHERE artisan_id = :artisan_id
              AND status     = 'completed'
              AND created_at >= :prev_start
              AND created_at <  :prev_end
        """),
        {"artisan_id": artisan_id, "prev_start": prev_start, "prev_end": prev_end},
    )
    prev_total = int(prev_res.scalar_one() or 0)

    total_earned = int(core["total_earned"])
    if prev_total > 0:
        growth_pct = round(((total_earned - prev_total) / prev_total) * 100, 1)
    elif total_earned > 0:
        growth_pct = 100.0
    else:
        growth_pct = 0.0

    by_day_res = await db.execute(
        text("""
            SELECT
                date_trunc('day', created_at)::date   AS day,
                COALESCE(SUM(agreed_price), 0)::bigint AS earned,
                COUNT(*)::int                          AS jobs
            FROM bookings
            WHERE artisan_id = :artisan_id
              AND status     = 'completed'
              AND created_at >= :period_start
            GROUP BY day
            ORDER BY day ASC
        """),
        {"artisan_id": artisan_id, "period_start": period_start},
    )
    by_day = [
        {"date": str(r["day"]), "earned": int(r["earned"]), "jobs": int(r["jobs"])}
        for r in by_day_res.mappings().all()
    ]
    best_day = max(by_day, key=lambda d: d["earned"]) if by_day else None

    by_hour_res = await db.execute(
        text("""
            SELECT
                EXTRACT(HOUR FROM j.scheduled_time)::int AS hour,
                COUNT(b.id)::int                          AS jobs,
                COALESCE(SUM(b.agreed_price), 0)::bigint  AS earned
            FROM bookings b
            JOIN jobs j ON b.job_id = j.id
            WHERE b.artisan_id = :artisan_id
              AND b.status     = 'completed'
              AND b.created_at >= :period_start
              AND j.scheduled_time IS NOT NULL
            GROUP BY hour
            ORDER BY earned DESC
            LIMIT 5
        """),
        {"artisan_id": artisan_id, "period_start": period_start},
    )
    best_hours = [
        {
            "hour": int(r["hour"]),
            "jobs": int(r["jobs"]),
            "earned": int(r["earned"]),
            "label": _hour_label(int(r["hour"])),
        }
        for r in by_hour_res.mappings().all()
    ]

    by_cat_res = await db.execute(
        text("""
            SELECT
                c.name_en                                   AS category,
                c.icon_emoji                                AS emoji,
                COUNT(b.id)::int                            AS jobs,
                COALESCE(SUM(b.agreed_price), 0)::bigint    AS earned
            FROM bookings b
            JOIN jobs j       ON b.job_id      = j.id
            JOIN categories c ON j.category_id = c.id
            WHERE b.artisan_id = :artisan_id
              AND b.status     = 'completed'
              AND b.created_at >= :period_start
            GROUP BY c.name_en, c.icon_emoji
            ORDER BY earned DESC
        """),
        {"artisan_id": artisan_id, "period_start": period_start},
    )
    by_cat_rows = by_cat_res.mappings().all()
    cat_total = sum(int(r["earned"]) for r in by_cat_rows)
    by_category = [
        {
            "category": r["category"],
            "emoji": r["emoji"] or "🔧",
            "jobs": int(r["jobs"]),
            "earned": int(r["earned"]),
            "pct": round(int(r["earned"]) / cat_total * 100, 1) if cat_total > 0 else 0.0,
        }
        for r in by_cat_rows
    ]

    pending_res = await db.execute(
        text("""
            SELECT COALESCE(SUM(amount), 0)::bigint AS pending
            FROM escrow_transactions
            WHERE artisan_id = :artisan_id AND status = 'held'
        """),
        {"artisan_id": artisan_id},
    )
    pending_payout = int(pending_res.scalar_one() or 0)

    rating_res = await db.execute(
        text("""
            SELECT COALESCE(AVG(r.rating), 0)::float AS avg_rating
            FROM reviews r
            JOIN bookings b ON r.booking_id = b.id
            WHERE b.artisan_id = :artisan_id AND r.created_at >= :period_start
        """),
        {"artisan_id": artisan_id, "period_start": period_start},
    )
    rating_this_period = round(float(rating_res.scalar_one() or 0), 2)

    forecast_data = await forecast_earnings(artisan_id, db)

    return {
        "period": period,
        "period_start": period_start.isoformat(),
        "total_earned": total_earned,
        "total_jobs": int(core["total_jobs"]),
        "avg_job_value": round(float(core["avg_job_value"])),
        "best_day": best_day,
        "best_hours": best_hours,
        "by_category": by_category,
        "by_day": by_day,
        "prev_period_total": prev_total,
        "growth_pct": growth_pct,
        "pending_payout": pending_payout,
        "projected_monthly": forecast_data["projected_monthly"],
        "forecast": forecast_data,
        "rating_this_period": rating_this_period,
        "on_time_rate": round(float(core["on_time_rate"]), 3),
    }


async def get_leaderboard(artisan_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """
    Returns the artisan's rank among peers in their district.
    Only the artisan's own rank is returned — no peer earnings exposed.
    """
    district_res = await db.execute(
        text("SELECT ap.district FROM artisan_profiles ap WHERE ap.user_id = :aid"),
        {"aid": artisan_id},
    )
    district = district_res.scalar_one_or_none()

    if not district:
        return {
            "your_rank": None,
            "total_in_district": 0,
            "top_10_pct": False,
            "district": None,
            "message": "Complete your profile with a district to see your rank.",
        }

    rank_res = await db.execute(
        text("""
            WITH district_earnings AS (
                SELECT b.artisan_id,
                       COALESCE(SUM(b.agreed_price), 0) AS earned
                FROM bookings b
                JOIN artisan_profiles ap ON b.artisan_id = ap.user_id
                WHERE ap.district = :district
                  AND b.status    = 'completed'
                  AND b.created_at >= date_trunc('month', NOW())
                GROUP BY b.artisan_id
            ),
            ranked AS (
                SELECT artisan_id,
                       RANK() OVER (ORDER BY earned DESC) AS rank,
                       COUNT(*) OVER ()                   AS total
                FROM district_earnings
            )
            SELECT rank, total FROM ranked WHERE artisan_id = :artisan_id
        """),
        {"artisan_id": artisan_id, "district": district},
    )
    rank_row = rank_res.mappings().one_or_none()

    if not rank_row:
        count_res = await db.execute(
            text(
                "SELECT COUNT(DISTINCT user_id)::int AS total "
                "FROM artisan_profiles WHERE district = :district"
            ),
            {"district": district},
        )
        total = int(count_res.scalar_one() or 0)
        return {
            "your_rank": total + 1,
            "total_in_district": total,
            "top_10_pct": False,
            "district": district,
        }

    your_rank = int(rank_row["rank"])
    total = int(rank_row["total"])
    return {
        "your_rank": your_rank,
        "total_in_district": total,
        "top_10_pct": your_rank <= max(1, round(total * 0.10)),
        "district": district,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hour_label(hour: int) -> str:
    if hour == 0:
        return "12am"
    if hour < 12:
        return f"{hour}am"
    if hour == 12:
        return "12pm"
    return f"{hour - 12}pm"
