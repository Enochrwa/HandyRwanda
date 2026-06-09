# File: backend/app/services/safety_score_service.py
"""
Sprint 5 — Community Safety Score Service

Computes, stores, and manages the Community Safety Score for every artisan.
The score is a weighted integer from 0 to 1000 built from trust signals:

  Signal                          Max Points  Source
  ─────────────────────────────── ─────────── ────────────────────────────────
  ID Verified                         200     verification_status >= id_verified
  Pro Verified bonus                  +100    verification_status == pro_verified
  Average Rating (≥4.0 = full)        200     average_rating / 5.0 * 200
  Completion Rate                     150     completion_rate * 150
  Response Rate                       100     response_rate * 100
  On-Time Rate                        100     on_time_rate * 100
  Repeat Client Rate                  100     repeat_client_rate * 100
  Zero Disputes (last 6 months)        50     no disputed bookings in 6 months
  Account Age (max 1 year = full)      50     min(days_active / 365, 1) * 50
  ─────────────────────────────── ─────────── ────────────────────────────────
  TOTAL                             0–1000

Score tiers displayed as trust badges:
  0–299   ⭕ Unranked   — "Unranked"
  300–499 🥉 Bronze     — "Registered"
  500–699 🥈 Silver     — "Trusted"
  700–849 🥇 Gold       — "Highly Trusted"
  850–999 💎 Platinum   — "Elite"
  1000    🌟 Legend     — "Legend" (rare, shown prominently)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import NamedTuple
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artisan import ArtisanProfile, VerificationStatus
from app.models.booking import Booking, BookingStatus
from app.models.user import User

_log = logging.getLogger(__name__)

# ── Score tier definitions ────────────────────────────────────────────────────

SCORE_TIERS = [
    (1000, "🌟", "Legend",       "#FFD700"),
    (850,  "💎", "Elite",        "#9B59B6"),
    (700,  "🥇", "Highly Trusted","#F4A300"),
    (500,  "🥈", "Trusted",      "#95A5A6"),
    (300,  "🥉", "Registered",   "#CD7F32"),
    (0,    "⭕", "Unranked",     "#BDC3C7"),
]

SCORE_WEIGHTS = {
    "id_verified":       200,
    "pro_verified_bonus": 100,
    "average_rating":    200,
    "completion_rate":   150,
    "response_rate":     100,
    "on_time_rate":      100,
    "repeat_client_rate": 100,
    "zero_disputes":      50,
    "account_age":        50,
}

MAX_SCORE = sum(SCORE_WEIGHTS.values())  # 1050 but capped at 1000


# ── Score breakdown dataclass (for transparent auditing) ─────────────────────

@dataclass
class ScoreBreakdown:
    """Full breakdown of how a score was calculated — returned for admin + UI."""
    artisan_id: str
    total_score: int

    # Component scores
    id_verified_pts: int
    pro_verified_pts: int
    rating_pts: float
    completion_pts: float
    response_pts: float
    on_time_pts: float
    repeat_client_pts: float
    dispute_pts: int
    account_age_pts: float

    # Source values
    verification_status: str
    average_rating: float
    completion_rate: float
    response_rate: float
    on_time_rate: float
    repeat_client_rate: float
    dispute_count_6m: int
    account_age_days: int

    # Tier info
    tier_emoji: str
    tier_label: str
    tier_color: str

    def to_dict(self) -> dict:
        return {
            "artisan_id": self.artisan_id,
            "total_score": self.total_score,
            "max_score": 1000,
            "tier": {
                "emoji": self.tier_emoji,
                "label": self.tier_label,
                "color": self.tier_color,
            },
            "components": {
                "id_verified": {
                    "points": self.id_verified_pts,
                    "max": SCORE_WEIGHTS["id_verified"],
                    "label": "Identity Verified",
                    "description": "Artisan has submitted and passed ID verification",
                },
                "pro_verified_bonus": {
                    "points": self.pro_verified_pts,
                    "max": SCORE_WEIGHTS["pro_verified_bonus"],
                    "label": "Pro Verified Bonus",
                    "description": "Extra points for achieving Pro Verified status",
                },
                "average_rating": {
                    "points": round(self.rating_pts),
                    "max": SCORE_WEIGHTS["average_rating"],
                    "label": "Client Rating",
                    "description": f"Based on {self.average_rating:.1f}/5.0 average rating",
                    "raw_value": self.average_rating,
                },
                "completion_rate": {
                    "points": round(self.completion_pts),
                    "max": SCORE_WEIGHTS["completion_rate"],
                    "label": "Job Completion Rate",
                    "description": f"{self.completion_rate * 100:.0f}% of jobs completed",
                    "raw_value": self.completion_rate,
                },
                "response_rate": {
                    "points": round(self.response_pts),
                    "max": SCORE_WEIGHTS["response_rate"],
                    "label": "Response Rate",
                    "description": f"Accepts {self.response_rate * 100:.0f}% of assigned bookings",
                    "raw_value": self.response_rate,
                },
                "on_time_rate": {
                    "points": round(self.on_time_pts),
                    "max": SCORE_WEIGHTS["on_time_rate"],
                    "label": "On-Time Arrival Rate",
                    "description": f"Arrives on time {self.on_time_rate * 100:.0f}% of the time",
                    "raw_value": self.on_time_rate,
                },
                "repeat_client_rate": {
                    "points": round(self.repeat_client_pts),
                    "max": SCORE_WEIGHTS["repeat_client_rate"],
                    "label": "Repeat Client Rate",
                    "description": f"{self.repeat_client_rate * 100:.0f}% of clients book again",
                    "raw_value": self.repeat_client_rate,
                },
                "zero_disputes": {
                    "points": self.dispute_pts,
                    "max": SCORE_WEIGHTS["zero_disputes"],
                    "label": "Dispute-Free Record",
                    "description": "No disputes in the last 6 months"
                    if self.dispute_count_6m == 0
                    else f"{self.dispute_count_6m} dispute(s) in last 6 months",
                    "raw_value": self.dispute_count_6m,
                },
                "account_age": {
                    "points": round(self.account_age_pts),
                    "max": SCORE_WEIGHTS["account_age"],
                    "label": "Account Tenure",
                    "description": f"Account {self.account_age_days} days old",
                    "raw_value": self.account_age_days,
                },
            },
        }


class ScoreTier(NamedTuple):
    emoji: str
    label: str
    color: str
    min_score: int


def get_score_tier(score: int) -> ScoreTier:
    """Return the tier metadata for a given score integer."""
    for min_pts, emoji, label, color in SCORE_TIERS:
        if score >= min_pts:
            return ScoreTier(emoji=emoji, label=label, color=color, min_score=min_pts)
    return ScoreTier(emoji="⭕", label="Unranked", color="#BDC3C7", min_score=0)


# ── Core computation ──────────────────────────────────────────────────────────


async def compute_safety_score(
    artisan_id: UUID,
    db: AsyncSession,
    *,
    return_breakdown: bool = False,
) -> int | ScoreBreakdown:
    """
    Compute and return the Community Safety Score for a single artisan.

    Args:
        artisan_id: The artisan's user UUID.
        db: Async SQLAlchemy session.
        return_breakdown: If True, returns a full ScoreBreakdown dataclass
                          instead of just the integer score.

    Returns:
        int (0–1000) or ScoreBreakdown if return_breakdown=True.
    """
    # ── 1. Load artisan profile ───────────────────────────────────────────────
    profile = await db.scalar(
        select(ArtisanProfile).where(ArtisanProfile.user_id == artisan_id)
    )
    if profile is None:
        _log.warning("compute_safety_score: no profile for artisan %s", artisan_id)
        if return_breakdown:
            tier = get_score_tier(0)
            return ScoreBreakdown(
                artisan_id=str(artisan_id),
                total_score=0,
                id_verified_pts=0,
                pro_verified_pts=0,
                rating_pts=0,
                completion_pts=0,
                response_pts=0,
                on_time_pts=0,
                repeat_client_pts=0,
                dispute_pts=0,
                account_age_pts=0,
                verification_status="unverified",
                average_rating=0.0,
                completion_rate=0.0,
                response_rate=0.0,
                on_time_rate=0.0,
                repeat_client_rate=0.0,
                dispute_count_6m=0,
                account_age_days=0,
                tier_emoji=tier.emoji,
                tier_label=tier.label,
                tier_color=tier.color,
            )
        return 0

    # ── 2. Dispute count (last 6 months) ─────────────────────────────────────
    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    dispute_result = await db.execute(
        select(func.count(Booking.id)).where(
            Booking.artisan_id == artisan_id,
            Booking.status == BookingStatus.disputed,
            Booking.created_at >= six_months_ago,
        )
    )
    dispute_count = dispute_result.scalar_one() or 0

    # ── 3. Account age ────────────────────────────────────────────────────────
    user_row = await db.scalar(select(User).where(User.id == artisan_id))
    if user_row and user_row.created_at:
        created = user_row.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        account_age_days = (datetime.now(timezone.utc) - created).days
    else:
        account_age_days = 0

    # ── 4. Component point calculation ───────────────────────────────────────

    # Verification
    id_verified_pts = 0
    pro_verified_pts = 0
    vs = profile.verification_status
    if vs in (VerificationStatus.id_verified, VerificationStatus.pro_verified):
        id_verified_pts = SCORE_WEIGHTS["id_verified"]
    if vs == VerificationStatus.pro_verified:
        pro_verified_pts = SCORE_WEIGHTS["pro_verified_bonus"]

    # Rating: scale 0–5 → 0–200; artisans with no reviews get 0
    rating = profile.average_rating or 0.0
    rating_pts = (rating / 5.0) * SCORE_WEIGHTS["average_rating"]

    # Rate metrics: each is a 0.0–1.0 float → scale to max
    completion_pts = (profile.completion_rate or 0.0) * SCORE_WEIGHTS["completion_rate"]
    response_pts = (profile.response_rate or 0.0) * SCORE_WEIGHTS["response_rate"]
    on_time_pts = (profile.on_time_rate or 0.0) * SCORE_WEIGHTS["on_time_rate"]
    repeat_client_pts = (profile.repeat_client_rate or 0.0) * SCORE_WEIGHTS["repeat_client_rate"]

    # Disputes
    dispute_pts = SCORE_WEIGHTS["zero_disputes"] if dispute_count == 0 else 0

    # Account age: caps at 365 days
    account_age_pts = min(account_age_days / 365.0, 1.0) * SCORE_WEIGHTS["account_age"]

    # ── 5. Sum and cap ────────────────────────────────────────────────────────
    raw_total = (
        id_verified_pts
        + pro_verified_pts
        + rating_pts
        + completion_pts
        + response_pts
        + on_time_pts
        + repeat_client_pts
        + dispute_pts
        + account_age_pts
    )
    score = min(int(round(raw_total)), 1000)

    if not return_breakdown:
        return score

    tier = get_score_tier(score)
    return ScoreBreakdown(
        artisan_id=str(artisan_id),
        total_score=score,
        id_verified_pts=id_verified_pts,
        pro_verified_pts=pro_verified_pts,
        rating_pts=rating_pts,
        completion_pts=completion_pts,
        response_pts=response_pts,
        on_time_pts=on_time_pts,
        repeat_client_pts=repeat_client_pts,
        dispute_pts=dispute_pts,
        account_age_pts=account_age_pts,
        verification_status=vs.value if hasattr(vs, "value") else str(vs),
        average_rating=rating,
        completion_rate=profile.completion_rate or 0.0,
        response_rate=profile.response_rate or 0.0,
        on_time_rate=profile.on_time_rate or 0.0,
        repeat_client_rate=profile.repeat_client_rate or 0.0,
        dispute_count_6m=dispute_count,
        account_age_days=account_age_days,
        tier_emoji=tier.emoji,
        tier_label=tier.label,
        tier_color=tier.color,
    )


# ── Nightly batch recalculation ───────────────────────────────────────────────

BATCH_SIZE = 50  # process 50 artisans at a time to bound memory pressure


async def recalculate_all_scores(db: AsyncSession) -> dict:
    """
    Nightly cron job: recompute community_score for every artisan.

    Runs at 00:00 UTC (02:00 Kigali time) via APScheduler CronTrigger.
    Processes artisans in batches of BATCH_SIZE to avoid memory pressure.

    Returns a summary dict for logging/admin audit.
    """
    _log.info("[SafetyScore] Nightly recalculation starting…")

    # Fetch all artisan IDs in one query
    result = await db.execute(select(ArtisanProfile.user_id))
    artisan_ids: list[UUID] = [row[0] for row in result.all()]

    if not artisan_ids:
        _log.info("[SafetyScore] No artisans found — skipping.")
        return {
            "recalculated": 0,
            "errors": 0,
            "total_artisans": 0,
            "score_distribution": {
                "legend": 0, "platinum": 0, "gold": 0,
                "silver": 0, "bronze": 0, "unranked": 0,
            },
        }

    recalculated = 0
    errors = 0
    score_distribution: dict[str, int] = {
        "legend": 0,
        "platinum": 0,
        "gold": 0,
        "silver": 0,
        "bronze": 0,
        "unranked": 0,
    }

    # Process in batches
    for batch_start in range(0, len(artisan_ids), BATCH_SIZE):
        batch = artisan_ids[batch_start : batch_start + BATCH_SIZE]
        score_updates: list[dict] = []

        for aid in batch:
            try:
                score = await compute_safety_score(aid, db)
                score_updates.append({"uid": aid, "score": score})

                # Track distribution
                tier = get_score_tier(score)
                label_lower = tier.label.lower().replace(" ", "_")
                if label_lower in score_distribution:
                    score_distribution[label_lower] += 1
                else:
                    score_distribution["unranked"] += 1

                recalculated += 1
            except Exception:
                _log.exception("[SafetyScore] Error computing score for artisan %s", aid)
                errors += 1

        # Batch update — one UPDATE per artisan in this batch
        for update_data in score_updates:
            await db.execute(
                update(ArtisanProfile)
                .where(ArtisanProfile.user_id == update_data["uid"])
                .values(community_score=update_data["score"])
            )

        # Commit each batch to avoid holding a long transaction
        await db.commit()
        _log.info(
            "[SafetyScore] Batch %d–%d complete (%d/%d artisans processed)",
            batch_start + 1,
            min(batch_start + BATCH_SIZE, len(artisan_ids)),
            recalculated,
            len(artisan_ids),
        )

    _log.info(
        "[SafetyScore] Nightly recalculation complete — %d updated, %d errors. Distribution: %s",
        recalculated,
        errors,
        score_distribution,
    )

    return {
        "recalculated": recalculated,
        "errors": errors,
        "total_artisans": len(artisan_ids),
        "score_distribution": score_distribution,
    }


async def recalculate_single_score(artisan_id: UUID, db: AsyncSession) -> int:
    """
    Recompute and persist community_score for a single artisan.

    Called after significant events: booking completed, review posted,
    verification status change, etc.
    Returns the new score.
    """
    score = await compute_safety_score(artisan_id, db)
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == artisan_id)
        .values(community_score=score)
    )
    await db.commit()
    _log.debug("[SafetyScore] Artisan %s new score: %d", artisan_id, score)
    return score
