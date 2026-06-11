# File: backend/app/routers/referrals.py
"""
Sprint 8 — Referral System Router

Endpoints:
  GET  /referrals/me               — current user's referral dashboard stats
  POST /referrals/validate         — validate a code (onboarding incentive banner)
  GET  /referrals/leaderboard      — top referrers (public, limited)
  GET  /referrals/history          — user's referred contacts with status
  POST /referrals/apply-credit     — apply wallet credit to a booking
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.models.referral import Referral, ReferralStatus
from app.models.user import User
from app.services.referral_service import (
    apply_wallet_credit,
    get_leaderboard,
    get_referral_stats,
)

router = APIRouter(prefix="/referrals", tags=["referrals"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class ValidateCodeRequest(BaseModel):
    code: str = Field(..., min_length=8, max_length=20, description="Referral code to validate")


class ApplyCreditRequest(BaseModel):
    booking_id: UUID
    amount: int = Field(..., gt=0, description="Amount in RWF to apply from wallet")


# ── GET /referrals/me ─────────────────────────────────────────────────────────


@router.get("/me")
async def get_my_referral_stats(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """
    Returns the authenticated user's full referral dashboard:
      - Their unique referral code and shareable link
      - Referred count (total, qualified, pending)
      - Total RWF earned and current wallet balance
      - Current referral tier + progress to next tier
    """
    user_id = UUID(str(current_user["sub"]))
    stats = await get_referral_stats(user_id, db)
    if not stats:
        raise HTTPException(status_code=404, detail="User not found.")
    return stats


# ── POST /referrals/validate ──────────────────────────────────────────────────


@router.post("/validate")
async def validate_referral_code(
    payload: ValidateCodeRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Validates a referral code during onboarding.
    Returns the referrer's first name so the UI can show:
      'You'll get 500 RWF credit when you complete your first booking!'
    """
    code = payload.code.strip().upper()
    referrer = await db.scalar(select(User).where(User.referral_code == code))

    if not referrer:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "INVALID_REFERRAL_CODE",
                "message": "This referral code is not valid.",
            },
        )

    first_name = referrer.full_name.split()[0]

    return {
        "valid": True,
        "referrer_first_name": first_name,
        "reward_rwf": 500,
        "message_en": (
            f"You were referred by {first_name}! "
            "Complete your first booking to earn 500 RWF credit."
        ),
        "message_rw": (
            f"Watumwe na {first_name}! "
            "Uzuza inama yawe ya mbere ubone amafaranga 500 RWF."
        ),
        "message_fr": (
            f"Vous avez été référé par {first_name}! "
            "Terminez votre première réservation pour gagner 500 RWF de crédit."
        ),
    }


# ── GET /referrals/leaderboard ────────────────────────────────────────────────


@router.get("/leaderboard")
async def referral_leaderboard(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Public leaderboard — top referrers by qualified count.
    Limited to top 10 by default (max 20).
    """
    limit = min(limit, 20)
    return await get_leaderboard(db, limit=limit)


# ── GET /referrals/history ────────────────────────────────────────────────────


@router.get("/history")
async def get_my_referral_history(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """
    Returns detailed list of everyone the current user has referred,
    with their name (anonymised to first name + initial) and status.
    """
    user_id = UUID(str(current_user["sub"]))

    result = await db.execute(
        select(Referral).where(Referral.referrer_id == user_id)
    )
    referrals = list(result.scalars().all())

    history = []
    for ref in referrals:
        referred_user = await db.scalar(
            select(User).where(User.id == ref.referred_id)
        )
        if referred_user:
            parts = referred_user.full_name.split()
            display_name = (
                f"{parts[0]} {parts[1][0]}." if len(parts) > 1 else parts[0]
            )
            history.append(
                {
                    "id": str(ref.id),
                    "display_name": display_name,
                    "avatar_url": referred_user.avatar_url,
                    "status": ref.status.value,
                    "registered_at": ref.created_at.isoformat(),
                    "earned_rwf": (
                        500 if ref.status == ReferralStatus.qualified else 0
                    ),
                }
            )

    return sorted(history, key=lambda x: x["registered_at"], reverse=True)


# ── POST /referrals/apply-credit ──────────────────────────────────────────────


@router.post("/apply-credit")
async def apply_credit_to_booking(
    payload: ApplyCreditRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Apply wallet credit balance toward a booking payment.
    Returns actual amount applied and new wallet balance.
    """
    user_id = UUID(str(current_user["sub"]))

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.wallet_balance_rwf <= 0:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "NO_WALLET_BALANCE",
                "message": "You have no wallet credit to apply.",
            },
        )

    applied = await apply_wallet_credit(
        user_id=user_id,
        booking_id=payload.booking_id,
        amount=payload.amount,
        db=db,
    )
    await db.commit()

    # Reload updated balance
    await db.refresh(user)

    return {
        "applied_rwf": applied,
        "new_wallet_balance_rwf": user.wallet_balance_rwf,
        "message": f"{applied:,} RWF credit applied to your booking.",
    }
