# File: backend/app/services/insights_notification_service.py
"""
Sprint 6 — Weekly Artisan Insight Notifications

Sent every Monday at 8:00 AM Kigali time (UTC+2) to every artisan
who has completed at least one booking in the past 30 days.

Insight types:
  - Earnings summary: "Last week you earned X RWF across N jobs"
  - Personal best: "That's your best week yet! 🎉"
  - Peak day insight: "Your busiest day is Saturday — stay available!"
  - Profile view gap: "3 clients viewed your profile but didn't hire"
  - Trend nudge: "You're down 20% vs last week — check your availability"

Design notes:
  - Uses the same push infrastructure (send_push_notification) as all
    other notifications — FCM → Expo push fallback chain.
  - Never sends if artisan has been inactive for 30+ days (avoid noise).
  - Called by APScheduler CronTrigger in main.py lifespan.
  - All DB queries are batched — O(1) queries per artisan, not N+1.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.push import send_push_notification

_log = logging.getLogger(__name__)


async def send_weekly_insights(db: AsyncSession) -> dict[str, int]:
    """
    Send weekly insight push notifications to all eligible artisans.

    Returns a summary dict: {"sent": N, "skipped": M, "errors": K}
    Called by APScheduler every Monday at 08:00 Kigali.
    """

    now = datetime.now(timezone.utc)
    last_week_start = (now - timedelta(weeks=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    two_weeks_ago = last_week_start - timedelta(weeks=1)
    thirty_days_ago = now - timedelta(days=30)

    # ── Fetch all active artisans with last-week and previous-week data ───────
    artisan_query = text("""
        WITH last_week AS (
            SELECT
                b.artisan_id,
                COUNT(b.id)::int                           AS jobs,
                COALESCE(SUM(b.agreed_price), 0)::bigint   AS earned,
                MAX(b.agreed_price)::bigint                AS best_job
            FROM bookings b
            WHERE b.status     = 'completed'
              AND b.created_at >= :last_week_start
              AND b.created_at <  :now
            GROUP BY b.artisan_id
        ),
        prev_week AS (
            SELECT
                b.artisan_id,
                COALESCE(SUM(b.agreed_price), 0)::bigint AS earned
            FROM bookings b
            WHERE b.status     = 'completed'
              AND b.created_at >= :two_weeks_ago
              AND b.created_at <  :last_week_start
            GROUP BY b.artisan_id
        ),
        all_time AS (
            SELECT
                b.artisan_id,
                MAX(weekly_total) AS personal_best_week
            FROM (
                SELECT
                    artisan_id,
                    SUM(agreed_price) AS weekly_total
                FROM bookings
                WHERE status = 'completed'
                GROUP BY artisan_id, date_trunc('week', created_at)
            ) weekly_data
            GROUP BY b.artisan_id
        ),
        peak_day AS (
            SELECT
                b.artisan_id,
                to_char(b.created_at, 'Day') AS busiest_day
            FROM bookings b
            WHERE b.status = 'completed'
            GROUP BY b.artisan_id, to_char(b.created_at, 'Day')
            ORDER BY COUNT(*) DESC
        )
        SELECT
            u.id                        AS artisan_id,
            u.full_name,
            COALESCE(lw.jobs, 0)        AS last_week_jobs,
            COALESCE(lw.earned, 0)      AS last_week_earned,
            COALESCE(pw.earned, 0)      AS prev_week_earned,
            COALESCE(at.personal_best_week, 0) AS personal_best,
            pd.busiest_day
        FROM users u
        JOIN artisan_profiles ap ON u.id = ap.user_id
        LEFT JOIN last_week  lw ON u.id = lw.artisan_id
        LEFT JOIN prev_week  pw ON u.id = pw.artisan_id
        LEFT JOIN all_time   at ON u.id = at.artisan_id
        LEFT JOIN LATERAL (
            SELECT DISTINCT ON (b2.artisan_id) to_char(b2.created_at, 'Day') AS busiest_day
            FROM bookings b2
            WHERE b2.artisan_id = u.id AND b2.status = 'completed'
            GROUP BY b2.artisan_id, to_char(b2.created_at, 'Day')
            ORDER BY b2.artisan_id, COUNT(*) DESC
            LIMIT 1
        ) pd ON true
        WHERE u.role       = 'artisan'
          AND u.is_active  = true
          AND EXISTS (
              SELECT 1 FROM bookings b3
              WHERE b3.artisan_id = u.id
                AND b3.status     = 'completed'
                AND b3.created_at >= :thirty_days_ago
          )
    """)

    result = await db.execute(artisan_query, {
        "last_week_start": last_week_start,
        "two_weeks_ago": two_weeks_ago,
        "now": now,
        "thirty_days_ago": thirty_days_ago,
    })
    rows = result.mappings().all()

    sent = 0
    skipped = 0
    errors = 0

    for row in rows:
        try:
            artisan_id = row["artisan_id"]
            full_name = (row["full_name"] or "").split()[0]  # first name only
            last_week_jobs: int = int(row["last_week_jobs"])
            last_week_earned: int = int(row["last_week_earned"])
            prev_week_earned: int = int(row["prev_week_earned"])
            personal_best: int = int(row["personal_best"])
            busiest_day: str = (row["busiest_day"] or "Saturday").strip()

            if last_week_jobs == 0 and prev_week_earned == 0:
                # No activity — send a gentle "come back" nudge
                title = f"👋 Hey {full_name}, we miss you!"
                body = (
                    "Clients are looking for artisans in your area. "
                    "Make sure your profile is up to date and you're marked available!"
                )
            elif last_week_jobs == 0:
                skipped += 1
                continue  # Skip completely inactive artisans
            else:
                # Active artisan — personalised insight
                earned_fmt = f"{last_week_earned:,}"
                jobs_word = "job" if last_week_jobs == 1 else "jobs"

                lines: list[str] = [
                    f"Last week you earned {earned_fmt} RWF across "
                    f"{last_week_jobs} {jobs_word}."
                ]

                # Personal best check
                if last_week_earned >= personal_best and last_week_earned > 0:
                    lines.append("That's your best week yet! 🎉")

                # Trend vs previous week
                if prev_week_earned > 0:
                    change_pct = ((last_week_earned - prev_week_earned) / prev_week_earned) * 100
                    if change_pct >= 20:
                        lines.append(f"You're up {round(change_pct)}% from last week 📈")
                    elif change_pct <= -20:
                        lines.append(
                            f"You're down {abs(round(change_pct))}% vs last week. "
                            "Consider updating your availability."
                        )

                # Peak day insight
                if busiest_day:
                    lines.append(
                        f"Your busiest day is {busiest_day}. "
                        "Stay available to maximise earnings!"
                    )

                title = "📊 Your weekly income summary"
                body = " ".join(lines)

            success = await send_push_notification(
                db_session=db,
                user_id=artisan_id,
                title=title,
                body=body,
                data={
                    "event_type": "weekly_insight",
                    "screen": "earnings",
                },
            )

            if success:
                sent += 1
            else:
                skipped += 1

        except Exception as exc:
            _log.error(
                "[WeeklyInsights] Failed for artisan %s: %s",
                row.get("artisan_id"),
                exc,
            )
            errors += 1

    _log.info(
        "[WeeklyInsights] Complete — sent=%d skipped=%d errors=%d",
        sent,
        skipped,
        errors,
    )
    return {"sent": sent, "skipped": skipped, "errors": errors}
