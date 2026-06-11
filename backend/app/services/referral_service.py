# File: backend/app/services/referral_service.py
"""
Sprint 8 — Referral System Service

Handles:
  - Unique referral code generation
  - Referral qualification on first booking completion
  - Wallet credit rewards for both referrer and referred user
  - Leaderboard statistics
"""

from __future__ import annotations

import logging
import os
import secrets
import string
import uuid
from typing import Any, TypedDict

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.referral import Referral, ReferralStatus
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User

_log = logging.getLogger(__name__)

# ── Configurable reward amounts ─────────────────────────────────────────────
REFERRAL_REFERRER_REWARD_RWF: int = int(
    os.getenv("REFERRAL_REFERRER_REWARD_RWF", "500")
)
REFERRAL_REFERRED_REWARD_RWF: int = int(
    os.getenv("REFERRAL_REFERRED_REWARD_RWF", "500")
)

BASE_URL: str = os.getenv("APP_BASE_URL", "https://handyrwanda.com")


class _TierEntry(TypedDict):
    name: str
    icon: str
    min: int
    max: int | None


# ── Referral tiers (for gamification / leaderboard) ─────────────────────────
REFERRAL_TIERS: list[_TierEntry] = [
    {"name": "Bronze Referrer",  "icon": "🥉", "min": 1,  "max": 2},
    {"name": "Silver Referrer",  "icon": "🥈", "min": 3,  "max": 5},
    {"name": "Gold Referrer",    "icon": "🥇", "min": 6,  "max": 10},
    {"name": "Platinum Referrer","icon": "💎", "min": 11, "max": 20},
    {"name": "Legend Referrer",  "icon": "🌟", "min": 21, "max": None},
]


def generate_referral_code(full_name: str) -> str:
    """
    Generate a unique-enough referral code.
    Format: HW-{3 chars of name}-{4 random UPPER+DIGITS}
    e.g. HW-JEA-X7K2
    """
    prefix = "".join(c for c in full_name[:3].upper() if c.isalpha()).ljust(3, "X")
    charset = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(charset) for _ in range(4))
    return f"HW-{prefix}-{suffix}"


async def ensure_unique_referral_code(full_name: str, db: AsyncSession) -> str:
    """Generate a referral code guaranteed to be unique in the DB."""
    for attempt in range(10):
        code = generate_referral_code(full_name)
        # Add randomness on subsequent attempts to avoid collision loops
        if attempt > 0:
            extra = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(2))
            code = f"HW-{full_name[:2].upper().replace(' ','X')}-{extra}{secrets.choice(string.ascii_uppercase + string.digits)}{secrets.choice(string.digits)}"
        existing = await db.scalar(select(User).where(User.referral_code == code))
        if not existing:
            return code
    # Fallback: UUID-based code (100% unique)
    return f"HW-{str(uuid.uuid4()).upper()[:8]}"


def get_referral_tier(qualified_count: int) -> dict[str, Any]:
    """Return current tier and progress metadata."""
    current_tier: _TierEntry | None = None
    for tier in REFERRAL_TIERS:
        tier_max = tier["max"]
        tier_min = int(tier["min"])
        if tier_max is None or qualified_count <= int(tier_max):
            if qualified_count >= tier_min:
                current_tier = tier
                break

    if current_tier is None:
        first = REFERRAL_TIERS[0]
        return {
            "name": "Unranked",
            "icon": "⭕",
            "next_tier": first,
            "needed_for_next": int(first["min"]) - qualified_count,
        }

    # Find next tier
    idx = REFERRAL_TIERS.index(current_tier)
    next_tier: _TierEntry | None = (
        REFERRAL_TIERS[idx + 1] if idx + 1 < len(REFERRAL_TIERS) else None
    )

    return {
        "name": current_tier["name"],
        "icon": current_tier["icon"],
        "next_tier": next_tier,
        "needed_for_next": (int(next_tier["min"]) - qualified_count) if next_tier else 0,
    }


async def qualify_referral_and_reward(
    client_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    """
    Called when a booking transitions to `completed`.

    1. Checks if client has a `registered` Referral record.
    2. Upgrades status to `qualified`.
    3. Credits both referrer and referred user.
    4. Creates in-app notifications for both parties.

    Returns True if a referral was qualified, False otherwise.
    """
    referral = await db.scalar(
        select(Referral).where(
            Referral.referred_id == client_id,
            Referral.status == ReferralStatus.registered,
        )
    )
    if not referral:
        return False

    # Load both users
    referrer = await db.scalar(select(User).where(User.id == referral.referrer_id))
    referred = await db.scalar(select(User).where(User.id == client_id))

    if not referrer or not referred:
        _log.warning(
            "[Referral] Could not load users for referral %s — skipping reward",
            referral.id,
        )
        return False

    # ── 1. Upgrade referral status ───────────────────────────────────────────
    await db.execute(
        update(Referral)
        .where(Referral.id == referral.id)
        .values(status=ReferralStatus.qualified)
    )

    # ── 2. Credit referrer ───────────────────────────────────────────────────
    await db.execute(
        update(User)
        .where(User.id == referrer.id)
        .values(wallet_balance_rwf=User.wallet_balance_rwf + REFERRAL_REFERRER_REWARD_RWF)
    )
    db.add(
        Transaction(
            user_id=referrer.id,
            amount=REFERRAL_REFERRER_REWARD_RWF,
            type=TransactionType.credit,
            status=TransactionStatus.completed,
            description=(
                f"Referral reward: {referred.full_name} completed their first booking"
            ),
        )
    )

    # ── 3. Credit referred user ──────────────────────────────────────────────
    await db.execute(
        update(User)
        .where(User.id == referred.id)
        .values(wallet_balance_rwf=User.wallet_balance_rwf + REFERRAL_REFERRED_REWARD_RWF)
    )
    db.add(
        Transaction(
            user_id=referred.id,
            amount=REFERRAL_REFERRED_REWARD_RWF,
            type=TransactionType.credit,
            status=TransactionStatus.completed,
            description="Referral reward: first booking completed",
        )
    )

    # ── 4. In-app notifications ──────────────────────────────────────────────
    referred_first_name = referred.full_name.split()[0]
    db.add(
        Notification(
            user_id=referrer.id,
            event_type="referral_qualified",
            title="🎉 Referral Reward Earned!",
            body=(
                f"Your friend {referred_first_name} completed their first booking! "
                f"You've earned {REFERRAL_REFERRER_REWARD_RWF:,} RWF credit."
            ),
            payload={
                "type": "referral_qualified",
                "referred_name": referred.full_name,
                "reward_rwf": REFERRAL_REFERRER_REWARD_RWF,
            },
        )
    )
    db.add(
        Notification(
            user_id=referred.id,
            event_type="referral_qualified",
            title="🎁 You've Earned a Reward!",
            body=(
                f"Congratulations! You've earned {REFERRAL_REFERRED_REWARD_RWF:,} RWF "
                "credit for completing your first booking."
            ),
            payload={
                "type": "referral_reward",
                "reward_rwf": REFERRAL_REFERRED_REWARD_RWF,
            },
        )
    )

    _log.info(
        "[Referral] Qualified referral %s: referrer=%s referred=%s each rewarded %d/%d RWF",
        referral.id,
        referrer.id,
        referred.id,
        REFERRAL_REFERRER_REWARD_RWF,
        REFERRAL_REFERRED_REWARD_RWF,
    )
    return True


async def apply_wallet_credit(
    user_id: uuid.UUID,
    booking_id: uuid.UUID,
    amount: int,
    db: AsyncSession,
) -> int:
    """
    Apply wallet credit toward a booking payment.
    Deducts min(wallet_balance, amount) and records a credit_applied transaction.
    Returns the actual amount applied.
    """
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user or user.wallet_balance_rwf <= 0:
        return 0

    applied = min(user.wallet_balance_rwf, amount)
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(wallet_balance_rwf=User.wallet_balance_rwf - applied)
    )
    db.add(
        Transaction(
            user_id=user_id,
            booking_id=booking_id,
            amount=applied,
            type=TransactionType.credit_applied,
            status=TransactionStatus.completed,
            description=f"Wallet credit applied to booking {booking_id}",
        )
    )
    return applied


async def get_referral_stats(user_id: uuid.UUID, db: AsyncSession) -> dict[str, Any]:
    """Return comprehensive referral statistics for the dashboard."""
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        return {}

    referral_code = user.referral_code or ""
    referral_link = f"{BASE_URL}/join?ref={referral_code}" if referral_code else ""

    # Count by status
    all_referrals_result = await db.execute(
        select(Referral).where(Referral.referrer_id == user_id)
    )
    all_referrals = list(all_referrals_result.scalars().all())

    total_referred = len(all_referrals)
    qualified = sum(1 for r in all_referrals if r.status == ReferralStatus.qualified)
    pending = total_referred - qualified
    total_earned_rwf = qualified * REFERRAL_REFERRER_REWARD_RWF

    tier_info = get_referral_tier(qualified)

    return {
        "referral_code": referral_code,
        "referral_link": referral_link,
        "total_referred": total_referred,
        "qualified": qualified,
        "pending": pending,
        "total_earned_rwf": total_earned_rwf,
        "wallet_balance_rwf": user.wallet_balance_rwf,
        "tier": tier_info,
        "reward_referrer_rwf": REFERRAL_REFERRER_REWARD_RWF,
        "reward_referred_rwf": REFERRAL_REFERRED_REWARD_RWF,
    }


async def get_leaderboard(db: AsyncSession, limit: int = 10) -> list[dict[str, Any]]:
    """
    Return top referrers by qualified referral count.
    Used by the admin panel and the in-app leaderboard.
    """
    rows = await db.execute(
        select(
            Referral.referrer_id,
            func.count(Referral.id).label("qualified_count"),
        )
        .where(Referral.status == ReferralStatus.qualified)
        .group_by(Referral.referrer_id)
        .order_by(func.count(Referral.id).desc())
        .limit(limit)
    )
    entries = rows.all()

    results = []
    for rank, (referrer_id, qualified_count) in enumerate(entries, start=1):
        user = await db.scalar(select(User).where(User.id == referrer_id))
        if user:
            tier = get_referral_tier(qualified_count)
            results.append(
                {
                    "rank": rank,
                    "user_id": str(referrer_id),
                    "full_name": user.full_name,
                    "avatar_url": user.avatar_url,
                    "qualified_count": qualified_count,
                    "total_earned_rwf": qualified_count * REFERRAL_REFERRER_REWARD_RWF,
                    "tier": tier,
                }
            )
    return results
