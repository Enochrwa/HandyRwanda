# File: backend/app/services/escrow_service.py
"""
Escrow lifecycle management.

Flow:
  1. Admin approves payment → create_escrow_hold()
  2. Client marks job complete → schedule_release() (48h countdown)
     OR artisan marks done and client doesn't respond in 48h → auto_release()
  3. release_escrow() → moves funds to artisan earnings
  4. Artisan requests withdrawal → handled by withdrawal router
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.escrow import (
    EscrowStatus,
    EscrowTransaction,
    WithdrawalRequest,
    WithdrawalStatus,
)
from app.models.notification import Notification
from app.models.user import User


async def create_escrow_hold(
    db: AsyncSession,
    booking_id: UUID,
    artisan_id: UUID,
    client_id: UUID,
    amount: int,
) -> EscrowTransaction:
    """
    Called when admin approves a payment.
    Creates the escrow record to hold funds until job completion.
    """
    escrow = EscrowTransaction(
        booking_id=booking_id,
        artisan_id=artisan_id,
        client_id=client_id,
        amount=amount,
        status=EscrowStatus.held,
    )
    db.add(escrow)
    await db.flush()
    return escrow


async def schedule_release(
    db: AsyncSession,
    booking_id: UUID,
    release_in_hours: int = 48,
) -> EscrowTransaction | None:
    """
    Called when artisan marks job done.
    Sets auto-release timer: if client doesn't dispute in 48h, funds auto-release.
    """
    escrow = await db.scalar(
        select(EscrowTransaction).where(
            EscrowTransaction.booking_id == booking_id,
            EscrowTransaction.status == EscrowStatus.held,
        )
    )
    if not escrow:
        return None

    release_at = datetime.now(timezone.utc) + timedelta(hours=release_in_hours)
    await db.execute(
        update(EscrowTransaction)
        .where(EscrowTransaction.id == escrow.id)
        .values(release_at=release_at)
    )
    await db.flush()
    return escrow


async def release_escrow(
    db: AsyncSession,
    booking_id: UUID,
    released_by: str = "client",  # "client" | "auto" | "admin"
) -> bool:
    """
    Release held funds to the artisan's earnings.
    """
    escrow = await db.scalar(
        select(EscrowTransaction).where(
            EscrowTransaction.booking_id == booking_id,
            EscrowTransaction.status.in_([EscrowStatus.held]),
        )
    )
    if not escrow:
        return False

    now = datetime.now(timezone.utc)
    await db.execute(
        update(EscrowTransaction)
        .where(EscrowTransaction.id == escrow.id)
        .values(
            status=EscrowStatus.released,
            released_at=now,
            released_by=released_by,
        )
    )

    # Notify artisan that funds are released
    notif = Notification(
        user_id=escrow.artisan_id,
        event_type="earnings_released",
        title="Payment released! 💸",
        body=f"{escrow.amount:,} RWF has been released to your earnings. You can request withdrawal.",
        payload={
            "booking_id": str(booking_id),
            "amount": str(escrow.amount),
            "event_type": "earnings_released",
            "screen": "artisan_earnings",
        },
    )
    db.add(notif)
    await db.flush()
    return True


async def get_artisan_earnings_summary(
    db: AsyncSession, artisan_id: UUID
) -> dict[str, Any]:
    """
    Return earnings breakdown: pending release, available, total earned.
    """
    from sqlalchemy import func  # noqa: PLC0415

    # Held (job complete but release not yet triggered)
    held_result = await db.execute(
        select(func.sum(EscrowTransaction.amount)).where(
            EscrowTransaction.artisan_id == artisan_id,
            EscrowTransaction.status == EscrowStatus.held,
        )
    )
    held = held_result.scalar() or 0

    # Released (available for withdrawal)
    released_result = await db.execute(
        select(func.sum(EscrowTransaction.amount)).where(
            EscrowTransaction.artisan_id == artisan_id,
            EscrowTransaction.status == EscrowStatus.released,
        )
    )
    total_released = released_result.scalar() or 0

    # Withdrawn
    withdrawn_result = await db.execute(
        select(func.sum(WithdrawalRequest.amount)).where(
            WithdrawalRequest.artisan_id == artisan_id,
            WithdrawalRequest.status == WithdrawalStatus.paid,
        )
    )
    withdrawn = withdrawn_result.scalar() or 0

    # Pending withdrawal requests
    pending_withdrawal_result = await db.execute(
        select(func.sum(WithdrawalRequest.amount)).where(
            WithdrawalRequest.artisan_id == artisan_id,
            WithdrawalRequest.status.in_(
                [WithdrawalStatus.pending, WithdrawalStatus.processing]
            ),
        )
    )
    pending_withdrawal = pending_withdrawal_result.scalar() or 0

    available = total_released - withdrawn - pending_withdrawal

    return {
        "pending_release": int(held),
        "available_for_withdrawal": max(0, int(available)),
        "pending_withdrawal": int(pending_withdrawal),
        "total_withdrawn": int(withdrawn),
        "total_earned": int(total_released),
    }


async def process_auto_releases(db: AsyncSession) -> int:
    """
    Cron job: find escrows past their release_at timestamp and auto-release.
    Returns count of released escrows.
    """
    now = datetime.now(timezone.utc)
    due = await db.execute(
        select(EscrowTransaction).where(
            EscrowTransaction.status == EscrowStatus.held,
            EscrowTransaction.release_at <= now,
            EscrowTransaction.release_at.isnot(None),
        )
    )
    released = 0
    for escrow in due.scalars().all():
        success = await release_escrow(db, escrow.booking_id, released_by="auto")
        if success:
            released += 1

    if released:
        await db.commit()

    return released
