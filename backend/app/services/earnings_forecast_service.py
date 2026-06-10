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

HISTORY_WEEKS = 12       # weeks of history used for training
FORECAST_WEEKS = 4       # weeks to project forward
MIN_POINTS_FOR_ML = 6   # need at least 6 weeks for regression to be meaningful


# ── Core ML forecast function ─────────────────────────────────────────────────

async def forecast_earnings(artisan_id: UUID, db: AsyncSession) -> dict[str, Any]:
    """
    Project the next 4 weeks of earnings using sklearn LinearRegression.

    Returns:
        {
            "next_4_weeks_forecast": [12000, 14000, 16000, 18000],  # RWF
            "trend": "up" | "down" | "stable",
            "projected_monthly": 60000,           # RWF
            "confidence": "high" | "medium" | "low",
            "method": "linear_regression" | "rolling_average",
            "history_weeks": 12,
            "weekly_history": [{"week_label": "W1", "earned": 8000}, ...],
        }
    """
    # Fetch last HISTORY_WEEKS weeks of earnings
    weekly_query = text("""
        SELECT
            date_trunc('week', created_at) AS week_start,
            COALESCE(SUM(agreed_price), 0)::bigint AS earned
        FROM bookings
        WHERE artisan_id       = :artisan_id
          AND status           = 'completed'
          AND created_at       >= :since
        GROUP BY week_start
        ORDER BY week_start ASC
    """)
    since = datetime.now(timezone.utc) - timedelta(weeks=HISTORY_WEEKS)
    result = await db.execute(weekly_query, {"artisan_id": artisan_id, "since": since})
    rows = result.mappings().all()

    # Build a dense time-series (fill missing weeks with 0)
    week_map: dict[datetime, int] = {}
    for row in rows:
        week_start = row["week_start"]
        if hasattr(week_start, "replace"):
            week_start = week_start.replace(tzinfo=timezone.utc)
        week_map[week_start] = int(row["earned"])

    # Generate full dense series — one entry per week for last HISTORY_WEEKS
    weekly_earnings: list[int] = []
    weekly_labels: list[str] = []
    current_week = datetime.now(timezone.utc) - timedelta(weeks=HISTORY_WEEKS)
    current_week = current_week.replace(hour=0, minute=0, second=0, microsecond=0)

    for i in range(HISTORY_WEEKS):
        week_key = current_week + timedelta(weeks=i)
        # Find closest matching week in map (±1 day tolerance)
        earned = 0
        for stored_week, val in week_map.items():
            diff = abs((stored_week - week_key).total_seconds())
            if diff < 7 * 24 * 3600:  # within 1 week
                earned = val
                break
        weekly_earnings.append(earned)
        weekly_labels.append(f"W{i + 1}")

    n = len(weekly_earnings)
    nonzero = sum(1 for v in weekly_earnings if v > 0)

    # ── Forecasting logic ─────────────────────────────────────────────────────

    forecast: list[float] = []
    trend: str = "stable"
    method: str = "rolling_average"
    confidence: str = "low"

    if nonzero >= MIN_POINTS_FOR_ML:
        try:
            # Import lazily so the app still starts even if sklearn not installed
            from sklearn.linear_model import LinearRegression  # noqa: PLC0415
            import numpy as np  # noqa: PLC0415

            X = np.array(range(n)).reshape(-1, 1)
            y = np.array(weekly_earnings, dtype=float)

            # Weighted: recent weeks matter more (exponential weights)
            weights = np.exp(np.linspace(-1, 0, n))  # e^-1 → e^0
            model = LinearRegression().fit(X, y, sample_weight=weights)

            future_X = np.array(range(n, n + FORECAST_WEEKS)).reshape(-1, 1)
            raw_forecast = model.predict(future_X)

            # Clamp to non-negative (can't earn negative money)
            forecast = [max(0.0, float(v)) for v in raw_forecast]

            coef = float(model.coef_[0])
            if coef > 500:        # > 500 RWF/week growth
                trend = "up"
            elif coef < -500:     # > 500 RWF/week decline
                trend = "down"
            else:
                trend = "stable"

            method = "linear_regression"
            confidence = "high" if nonzero >= 10 else "medium"

        except ImportError:
            _log.warning("scikit-learn not installed — falling back to rolling average")
            forecast = _rolling_average_forecast(weekly_earnings)
        except Exception as exc:
            _log.warning("ML forecast failed (%s) — falling back to rolling average", exc)
            forecast = _rolling_average_forecast(weekly_earnings)
    else:
        # Sparse data — use simple rolling average of available non-zero weeks
        forecast = _rolling_average_forecast(weekly_earnings)

        if len([v for v in weekly_earnings[-4:] if v > 0]) > 0:
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
        "history_weeks": n,
        "weekly_history": [
            {"week_label": weekly_labels[i], "earned": weekly_earnings[i]}
            for i in range(n)
        ],
    }


def _rolling_average_forecast(weekly_earnings: list[int]) -> list[float]:
    """Fallback: average of last 4 non-zero weeks × FORECAST_WEEKS."""
    recent = [v for v in weekly_earnings[-4:] if v > 0]
    avg = sum(recent) / len(recent) if recent else 0.0
    return [avg] * FORECAST_WEEKS


# ── Comprehensive earnings summary ────────────────────────────────────────────

async def get_earnings_summary(
    artisan_id: UUID,
    period: str,  # "week" | "month" | "year"
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Full earnings intelligence for the artisan income dashboard.

    Returns the complete response for GET /artisans/me/earnings?period=...
    """

    # ── Date range calculation ────────────────────────────────────────────────
    now = datetime.now(timezone.utc)

    if period == "week":
        period_start = now - timedelta(days=now.weekday())  # Monday
        period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
        prev_start = period_start - timedelta(weeks=1)
        prev_end = period_start
    elif period == "year":
        period_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_start = period_start.replace(year=now.year - 1)
        prev_end = period_start
    else:  # month (default)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if period_start.month == 1:
            prev_start = period_start.replace(year=now.year - 1, month=12)
        else:
            prev_start = period_start.replace(month=period_start.month - 1)
        prev_end = period_start

    # ── Core earnings & jobs ──────────────────────────────────────────────────
    core_query = text("""
        SELECT
            COALESCE(SUM(b.agreed_price), 0)::bigint          AS total_earned,
            COUNT(b.id)::int                                   AS total_jobs,
            COALESCE(AVG(b.agreed_price), 0)::float            AS avg_job_value,
            COALESCE(SUM(CASE WHEN b.status = 'completed' AND
                              b.arrived_at IS NOT NULL AND
                              b.started_at IS NOT NULL AND
                              (b.started_at - b.arrived_at) < interval '10 minutes'
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

    # ── Previous period total (for growth %) ─────────────────────────────────
    prev_query = text("""
        SELECT COALESCE(SUM(agreed_price), 0)::bigint AS total
        FROM bookings
        WHERE artisan_id = :artisan_id
          AND status     = 'completed'
          AND created_at >= :prev_start
          AND created_at <  :prev_end
    """)
    prev_res = await db.execute(
        prev_query,
        {"artisan_id": artisan_id, "prev_start": prev_start, "prev_end": prev_end},
    )
    prev_total = int(prev_res.scalar_one() or 0)

    total_earned = int(core["total_earned"])
    growth_pct: float = 0.0
    if prev_total > 0:
        growth_pct = round(((total_earned - prev_total) / prev_total) * 100, 1)
    elif total_earned > 0:
        growth_pct = 100.0

    # ── By-day breakdown ─────────────────────────────────────────────────────
    by_day_query = text("""
        SELECT
            date_trunc('day', created_at)::date  AS day,
            COALESCE(SUM(agreed_price), 0)::bigint AS earned,
            COUNT(*)::int                          AS jobs
        FROM bookings
        WHERE artisan_id = :artisan_id
          AND status     = 'completed'
          AND created_at >= :period_start
        GROUP BY day
        ORDER BY day ASC
    """)
    by_day_res = await db.execute(
        by_day_query, {"artisan_id": artisan_id, "period_start": period_start}
    )
    by_day_rows = by_day_res.mappings().all()
    by_day = [
        {"date": str(row["day"]), "earned": int(row["earned"]), "jobs": int(row["jobs"])}
        for row in by_day_rows
    ]

    # Best day
    best_day = max(by_day, key=lambda d: d["earned"]) if by_day else None

    # ── By-hour distribution (for "best times") ───────────────────────────────
    by_hour_query = text("""
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
    """)
    by_hour_res = await db.execute(
        by_hour_query, {"artisan_id": artisan_id, "period_start": period_start}
    )
    best_hours = [
        {
            "hour": int(row["hour"]),
            "jobs": int(row["jobs"]),
            "earned": int(row["earned"]),
            "label": _hour_label(int(row["hour"])),
        }
        for row in by_hour_res.mappings().all()
    ]

    # ── By-category breakdown ─────────────────────────────────────────────────
    by_cat_query = text("""
        SELECT
            c.name_en                                   AS category,
            c.icon_emoji                                AS emoji,
            COUNT(b.id)::int                            AS jobs,
            COALESCE(SUM(b.agreed_price), 0)::bigint    AS earned
        FROM bookings b
        JOIN jobs j      ON b.job_id     = j.id
        JOIN categories c ON j.category_id = c.id
        WHERE b.artisan_id = :artisan_id
          AND b.status     = 'completed'
          AND b.created_at >= :period_start
        GROUP BY c.name_en, c.icon_emoji
        ORDER BY earned DESC
    """)
    by_cat_res = await db.execute(
        by_cat_query, {"artisan_id": artisan_id, "period_start": period_start}
    )
    by_cat_rows = by_cat_res.mappings().all()
    cat_total = sum(int(r["earned"]) for r in by_cat_rows)
    by_category = [
        {
            "category": row["category"],
            "emoji": row["emoji"] or "🔧",
            "jobs": int(row["jobs"]),
            "earned": int(row["earned"]),
            "pct": round(int(row["earned"]) / cat_total * 100, 1) if cat_total > 0 else 0.0,
        }
        for row in by_cat_rows
    ]

    # ── Pending payout ────────────────────────────────────────────────────────
    pending_query = text("""
        SELECT COALESCE(SUM(amount), 0)::bigint AS pending
        FROM escrow_transactions
        WHERE artisan_id = :artisan_id
          AND status     = 'held'
    """)
    pending_res = await db.execute(pending_query, {"artisan_id": artisan_id})
    pending_payout = int(pending_res.scalar_one() or 0)

    # ── Rating this period ────────────────────────────────────────────────────
    rating_query = text("""
        SELECT COALESCE(AVG(r.rating), 0)::float AS avg_rating
        FROM reviews r
        JOIN bookings b ON r.booking_id = b.id
        WHERE b.artisan_id = :artisan_id
          AND r.created_at >= :period_start
    """)
    rating_res = await db.execute(
        rating_query, {"artisan_id": artisan_id, "period_start": period_start}
    )
    rating_this_period = round(float(rating_res.scalar_one() or 0), 2)

    # ── Forecast (from ML service) ────────────────────────────────────────────
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
    Ranking is by completed bookings earnings in the current month.
    Does NOT expose other artisans' absolute earnings — only rank.
    """
    # Get artisan's district
    district_query = text("""
        SELECT ap.district
        FROM artisan_profiles ap
        WHERE ap.user_id = :artisan_id
    """)
    district_res = await db.execute(district_query, {"artisan_id": artisan_id})
    district = district_res.scalar_one_or_none()

    if not district:
        return {
            "your_rank": None,
            "total_in_district": 0,
            "top_10_pct": False,
            "district": None,
            "message": "Complete your profile with a district to see your rank.",
        }

    # Rank all artisans in same district by this-month earnings
    rank_query = text("""
        WITH district_earnings AS (
            SELECT
                b.artisan_id,
                COALESCE(SUM(b.agreed_price), 0) AS earned
            FROM bookings b
            JOIN artisan_profiles ap ON b.artisan_id = ap.user_id
            WHERE ap.district = :district
              AND b.status    = 'completed'
              AND b.created_at >= date_trunc('month', NOW())
            GROUP BY b.artisan_id
        ),
        ranked AS (
            SELECT
                artisan_id,
                RANK() OVER (ORDER BY earned DESC) AS rank,
                COUNT(*) OVER ()                   AS total
            FROM district_earnings
        )
        SELECT rank, total
        FROM ranked
        WHERE artisan_id = :artisan_id
    """)

    rank_res = await db.execute(
        rank_query, {"artisan_id": artisan_id, "district": district}
    )
    rank_row = rank_res.mappings().one_or_none()

    if not rank_row:
        # Artisan has no earnings this month — count how many do
        count_query = text("""
            SELECT COUNT(DISTINCT ap.user_id)::int AS total
            FROM artisan_profiles ap
            WHERE ap.district = :district
        """)
        count_res = await db.execute(count_query, {"district": district})
        total = int(count_res.scalar_one() or 0)
        return {
            "your_rank": total + 1,  # At the bottom if no earnings this month
            "total_in_district": total,
            "top_10_pct": False,
            "district": district,
        }

    your_rank = int(rank_row["rank"])
    total = int(rank_row["total"])
    top_10 = your_rank <= max(1, round(total * 0.10))

    return {
        "your_rank": your_rank,
        "total_in_district": total,
        "top_10_pct": top_10,
        "district": district,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hour_label(hour: int) -> str:
    """Convert 24h hour to human-readable label."""
    if hour == 0:
        return "12am"
    if hour < 12:
        return f"{hour}am"
    if hour == 12:
        return "12pm"
    return f"{hour - 12}pm"
