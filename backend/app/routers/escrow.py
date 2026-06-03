# File: backend/app/routers/escrow.py
"""
Escrow & earnings router.

GET  /escrow/earnings              — artisan: earnings summary
GET  /escrow/transactions          — artisan: list escrow transactions
POST /escrow/withdraw              — artisan: request payout
GET  /escrow/withdrawals           — artisan: my withdrawal history
GET  /escrow/admin/withdrawals     — admin: pending withdrawal requests
POST /escrow/admin/withdrawals/{id}/pay     — admin: mark withdrawal as paid
POST /escrow/admin/withdrawals/{id}/reject  — admin: reject withdrawal
POST /escrow/admin/cron/auto-release        — admin/cron: process auto-releases
"""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user, require_role
from app.models.escrow import (
    EscrowStatus,
    EscrowTransaction,
    WithdrawalRequest,
    WithdrawalStatus,
)
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.services.escrow_service import (
    get_artisan_earnings_summary,
    process_auto_releases,
)

router = APIRouter(prefix="/escrow", tags=["escrow"])


class WithdrawalRequestCreate(BaseModel):
    amount: int = Field(..., ge=1000, description="Amount in RWF (minimum 1,000)")
    momo_number: str = Field(..., min_length=10, max_length=20)


@router.get("/earnings")
async def get_earnings(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    artisan_id = UUID(current_user["sub"])
    return await get_artisan_earnings_summary(db, artisan_id)


@router.get("/transactions")
async def list_transactions(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    artisan_id = UUID(current_user["sub"])
    result = await db.execute(
        select(EscrowTransaction)
        .where(EscrowTransaction.artisan_id == artisan_id)
        .order_by(EscrowTransaction.held_at.desc())
        .limit(50)
    )
    txns = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "booking_id": str(t.booking_id),
            "amount": t.amount,
            "status": t.status,
            "held_at": t.held_at.isoformat() if t.held_at else None,
            "release_at": t.release_at.isoformat() if t.release_at else None,
            "released_at": t.released_at.isoformat() if t.released_at else None,
            "released_by": t.released_by,
        }
        for t in txns
    ]


@router.post("/withdraw", status_code=201)
async def request_withdrawal(
    payload: WithdrawalRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    artisan_id = UUID(current_user["sub"])

    # Validate available balance
    summary = await get_artisan_earnings_summary(db, artisan_id)
    available = summary["available_for_withdrawal"]
    if payload.amount > available:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: {available:,} RWF, requested: {payload.amount:,} RWF.",
        )

    withdrawal = WithdrawalRequest(
        artisan_id=artisan_id,
        amount=payload.amount,
        momo_number=payload.momo_number,
        status=WithdrawalStatus.pending,
    )
    db.add(withdrawal)
    await db.flush()

    # Notify admin (store as notification for admin user lookup)
    # In production, also send email to admin
    await db.commit()
    return {
        "id": str(withdrawal.id),
        "amount": withdrawal.amount,
        "status": withdrawal.status,
        "message": "Withdrawal request submitted. Admin will process within 24 hours.",
    }


@router.get("/withdrawals")
async def my_withdrawals(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.artisan)),
) -> Any:
    artisan_id = UUID(current_user["sub"])
    result = await db.execute(
        select(WithdrawalRequest)
        .where(WithdrawalRequest.artisan_id == artisan_id)
        .order_by(WithdrawalRequest.created_at.desc())
    )
    withdrawals = result.scalars().all()
    return [
        {
            "id": str(w.id),
            "amount": w.amount,
            "momo_number": w.momo_number,
            "status": w.status,
            "admin_note": w.admin_note,
            "created_at": w.created_at.isoformat() if w.created_at else None,
            "processed_at": w.processed_at.isoformat() if w.processed_at else None,
        }
        for w in withdrawals
    ]


# ── Admin endpoints ────────────────────────────────────────────────────────────


@router.get("/admin/withdrawals")
async def admin_list_withdrawals(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    result = await db.execute(
        select(WithdrawalRequest, User)
        .join(User, WithdrawalRequest.artisan_id == User.id)
        .where(WithdrawalRequest.status.in_([WithdrawalStatus.pending, WithdrawalStatus.processing]))
        .order_by(WithdrawalRequest.created_at.asc())
    )
    return [
        {
            "id": str(w.id),
            "artisan_id": str(w.artisan_id),
            "artisan_name": u.full_name,
            "artisan_phone": u.phone_number,
            "amount": w.amount,
            "momo_number": w.momo_number,
            "status": w.status,
            "created_at": w.created_at.isoformat() if w.created_at else None,
        }
        for w, u in result.all()
    ]


class WithdrawalUpdate(BaseModel):
    admin_note: str | None = None


@router.post("/admin/withdrawals/{withdrawal_id}/pay")
async def admin_mark_paid(
    withdrawal_id: UUID,
    payload: WithdrawalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    from datetime import datetime, timezone  # noqa: PLC0415
    from sqlalchemy import update  # noqa: PLC0415

    w = await db.scalar(
        select(WithdrawalRequest).where(WithdrawalRequest.id == withdrawal_id)
    )
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal request not found.")

    admin_id = UUID(current_user["sub"])
    await db.execute(
        update(WithdrawalRequest)
        .where(WithdrawalRequest.id == withdrawal_id)
        .values(
            status=WithdrawalStatus.paid,
            admin_note=payload.admin_note,
            processed_by=admin_id,
            processed_at=datetime.now(timezone.utc),
        )
    )

    # Notify artisan
    notif = Notification(
        user_id=w.artisan_id,
        event_type="withdrawal_paid",
        title="Withdrawal sent! 💸",
        body=f"{w.amount:,} RWF has been sent to {w.momo_number}.",
        payload={"withdrawal_id": str(withdrawal_id), "event_type": "withdrawal_paid"},
    )
    db.add(notif)
    await db.commit()
    return {"message": "Withdrawal marked as paid."}


@router.post("/admin/withdrawals/{withdrawal_id}/reject")
async def admin_reject_withdrawal(
    withdrawal_id: UUID,
    payload: WithdrawalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    from datetime import datetime, timezone  # noqa: PLC0415
    from sqlalchemy import update  # noqa: PLC0415

    w = await db.scalar(
        select(WithdrawalRequest).where(WithdrawalRequest.id == withdrawal_id)
    )
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal request not found.")

    admin_id = UUID(current_user["sub"])
    await db.execute(
        update(WithdrawalRequest)
        .where(WithdrawalRequest.id == withdrawal_id)
        .values(
            status=WithdrawalStatus.rejected,
            admin_note=payload.admin_note,
            processed_by=admin_id,
            processed_at=datetime.now(timezone.utc),
        )
    )

    notif = Notification(
        user_id=w.artisan_id,
        event_type="withdrawal_rejected",
        title="Withdrawal rejected ❌",
        body=f"Your withdrawal of {w.amount:,} RWF was rejected. Reason: {payload.admin_note or 'see admin'}",
        payload={"withdrawal_id": str(withdrawal_id), "event_type": "withdrawal_rejected"},
    )
    db.add(notif)
    await db.commit()
    return {"message": "Withdrawal rejected."}


@router.post("/admin/cron/auto-release")
async def cron_auto_release(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Trigger auto-release of overdue escrow holds. Call via cron job."""
    count = await process_auto_releases(db)
    return {"released": count, "message": f"Auto-released {count} escrow(s)."}
