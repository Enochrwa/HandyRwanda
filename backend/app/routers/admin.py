# File: backend/app/routers/admin.py
"""
Admin router — full dashboard for admin role.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import require_role
from app.models.artisan import ArtisanProfile, Category, VerificationStatus
from app.models.booking import Booking, BookingStatus
from app.models.job import Job, JobStatus
from app.models.notification import Notification
from app.models.payment import Payment, PaymentStatus
from app.models.review import Review
from app.models.user import AccountStatus, User, UserRole
from app.services.safety_score_service import (
    ScoreBreakdown,
    compute_safety_score,
    recalculate_all_scores,
)

router = APIRouter(prefix="/admin", tags=["admin"])


class CategoryCreate(BaseModel):
    name_rw: str
    name_en: str
    name_fr: str
    icon_emoji: str | None = None


class RejectPayload(BaseModel):
    reason: str


class DisputeResolution(BaseModel):
    winner: str  # "client" | "artisan"
    notes: str | None = None


class PaymentVerdict(BaseModel):
    approved: bool
    admin_note: str | None = None


# ── Verification queue ────────────────────────────────────────────────────────


@router.get("/artisans/pending")
async def list_pending_artisans(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    result = await db.execute(
        select(User, ArtisanProfile)
        .join(ArtisanProfile, User.id == ArtisanProfile.user_id)
        .where(ArtisanProfile.verification_status == VerificationStatus.pending)
        .order_by(ArtisanProfile.updated_at.asc().nullslast())
    )
    return [
        {
            "user": {
                "id": str(row[0].id),
                "phone_number": row[0].phone_number,
                "full_name": row[0].full_name,
                "email": row[0].email,
                "avatar_url": row[0].avatar_url,
                "created_at": row[0].created_at.isoformat()
                if row[0].created_at
                else None,
            },
            "profile": {
                "id_document_url": row[1].id_document_url,
                "selfie_url": row[1].selfie_url,
                "verification_status": row[1].verification_status,
                "submitted_at": row[1].updated_at.isoformat()
                if row[1].updated_at
                else None,
            },
        }
        for row in result.all()
    ]


@router.post("/artisans/{user_id}/approve")
async def approve_artisan(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == user_id)
        .values(verification_status=VerificationStatus.id_verified)
    )
    # Activate account if still pending
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(account_status=AccountStatus.active, email_verified=True)
    )

    db.add(
        Notification(
            user_id=user_id,
            event_type="verification_approved",
            title="Identity Verified! ✅",
            body="Your ID has been verified. Your profile now shows a verified badge. You can start accepting jobs.",
            payload={
                "event_type": "verification_approved",
                "screen": "artisan_profile",
            },
        )
    )
    await db.commit()

    from app.integrations.push import send_push_notification  # noqa: PLC0415

    await send_push_notification(
        db,
        user_id,
        "Identity Verified! ✅",
        "Your ID has been verified. You can now accept jobs on HandyRwanda.",
        {"event_type": "verification_approved"},
    )

    # Sprint 5: recalculate score immediately — verification status just changed
    from app.database import AsyncSessionLocal  # noqa: PLC0415
    from app.services.safety_score_service import (  # noqa: PLC0415
        recalculate_single_score,
    )

    async with AsyncSessionLocal() as score_session:
        await recalculate_single_score(user_id, score_session)

    return {"message": "Artisan approved"}


@router.post("/artisans/{user_id}/reject")
async def reject_artisan(
    user_id: UUID,
    payload: RejectPayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == user_id)
        .values(verification_status=VerificationStatus.rejected)
    )

    db.add(
        Notification(
            user_id=user_id,
            event_type="verification_rejected",
            title="Verification Update",
            body=f"Your verification was not approved. Reason: {payload.reason}",
            payload={"event_type": "verification_rejected"},
        )
    )
    await db.commit()
    return {"message": "Artisan rejected", "reason": payload.reason}


# ── Disputes ──────────────────────────────────────────────────────────────────


@router.get("/disputes")
async def list_disputes(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    result = await db.execute(
        select(Booking, User.full_name.label("client_name"))
        .join(User, Booking.client_id == User.id)
        .where(Booking.status == BookingStatus.disputed)
        .order_by(Booking.updated_at.asc().nullslast())
    )
    return [
        {
            "booking_id": str(row[0].id),
            "client_name": row[1],
            "agreed_price": row[0].agreed_price,
            "created_at": row[0].created_at.isoformat() if row[0].created_at else None,
        }
        for row in result.all()
    ]


@router.post("/disputes/{booking_id}/resolve")
async def resolve_dispute(
    booking_id: UUID,
    payload: DisputeResolution,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    await db.execute(
        update(Booking)
        .where(Booking.id == booking_id)
        .values(
            status=BookingStatus.completed
            if payload.winner == "artisan"
            else BookingStatus.cancelled
        )
    )
    await db.commit()
    return {"message": f"Dispute resolved in favour of {payload.winner}."}


# ── Analytics ─────────────────────────────────────────────────────────────────


@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    # Total users
    total_users = await db.scalar(select(func.count(User.id)).where(User.is_active))  # noqa: E712
    total_artisans = await db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.artisan, User.is_active)  # noqa: E712
    )
    total_clients = await db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.client, User.is_active)  # noqa: E712
    )

    # Bookings
    total_bookings = await db.scalar(select(func.count(Booking.id)))
    completed = await db.scalar(
        select(func.count(Booking.id)).where(Booking.status == BookingStatus.completed)
    )
    disputed = await db.scalar(
        select(func.count(Booking.id)).where(Booking.status == BookingStatus.disputed)
    )
    pending_verif = await db.scalar(
        select(func.count(ArtisanProfile.user_id)).where(
            ArtisanProfile.verification_status == VerificationStatus.pending
        )
    )

    # Revenue (sum of completed bookings)
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Booking.agreed_price), 0)).where(
            Booking.status == BookingStatus.completed
        )
    )
    total_revenue = revenue_result.scalar_one()

    # Monthly trend (last 6 months)
    monthly_query = text("""
        SELECT
            to_char(date_trunc('month', created_at), 'Mon YY') as month,
            COUNT(*) as bookings,
            COALESCE(SUM(agreed_price), 0) as revenue
        FROM bookings
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY date_trunc('month', created_at)
        ORDER BY date_trunc('month', created_at)
    """)
    monthly_res = await db.execute(monthly_query)
    monthly = [
        {"month": r.month, "bookings": r.bookings, "revenue": r.revenue}
        for r in monthly_res
    ]

    # Top artisans
    top_artisans_query = text("""
        SELECT u.full_name, ap.average_rating, ap.total_reviews,
               COUNT(b.id) as completed_jobs
        FROM users u
        JOIN artisan_profiles ap ON u.id = ap.user_id
        LEFT JOIN bookings b ON b.artisan_id = u.id AND b.status = 'completed'
        WHERE u.is_active = true
        GROUP BY u.full_name, ap.average_rating, ap.total_reviews
        ORDER BY ap.average_rating DESC, completed_jobs DESC
        LIMIT 5
    """)
    top_res = await db.execute(top_artisans_query)
    top_artisans = [
        {
            "name": r.full_name,
            "rating": float(r.average_rating),
            "reviews": r.total_reviews,
            "jobs": r.completed_jobs,
        }
        for r in top_res
    ]

    return {
        "users": {
            "total": total_users,
            "artisans": total_artisans,
            "clients": total_clients,
        },
        "bookings": {
            "total": total_bookings,
            "completed": completed,
            "disputed": disputed,
        },
        "pending_verifications": pending_verif,
        "total_revenue_rwf": total_revenue,
        "monthly_trend": monthly,
        "top_artisans": top_artisans,
    }


# ── Categories ────────────────────────────────────────────────────────────────


@router.post("/categories")
async def create_category(
    payload: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    cat = Category(
        name_rw=payload.name_rw,
        name_en=payload.name_en,
        name_fr=payload.name_fr,
        icon_emoji=payload.icon_emoji,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return {"id": str(cat.id), "name_en": cat.name_en, "message": "Category created."}


# ── User management ───────────────────────────────────────────────────────────


@router.get("/users")
async def list_users(
    q: str | None = Query(None),
    role: str | None = Query(None),
    page: int = Query(default=1, ge=1),
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    query = select(User).order_by(User.created_at.desc())
    if q:
        query = query.where(
            User.full_name.ilike(f"%{q}%")
            | User.email.ilike(f"%{q}%")
            | User.phone_number.ilike(f"%{q}%")
        )
    if role:
        query = query.where(User.role == role)
    offset = (page - 1) * 20
    query = query.offset(offset).limit(20)
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "phone_number": u.phone_number,
            "role": u.role,
            "account_status": u.account_status,
            "email_verified": u.email_verified,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(account_status=AccountStatus.suspended)
    )
    await db.commit()
    return {"message": "User suspended."}


@router.post("/users/{user_id}/activate")
async def activate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(account_status=AccountStatus.active, is_active=True)
    )
    await db.commit()
    return {"message": "User activated."}


# ── Reviews moderation ────────────────────────────────────────────────────────


@router.get("/reviews/flagged")
async def list_flagged_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    result = await db.execute(
        select(Review, User.full_name.label("client_name"))
        .join(User, Review.client_id == User.id)
        .where(Review.is_flagged == True)  # noqa: E712
        .order_by(Review.created_at.desc())
    )
    return [
        {
            "id": str(r[0].id),
            "client_name": r[1],
            "rating": r[0].rating,
            "comment": r[0].comment,
            "created_at": r[0].created_at,
        }
        for r in result.all()
    ]


@router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    await db.execute(delete(Review).where(Review.id == review_id))
    await db.commit()
    return {"message": "Review deleted."}


# ── Platform stats ─────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Admin dashboard — key platform KPIs."""

    total_users = await db.scalar(select(func.count(User.id))) or 0
    total_clients = (
        await db.scalar(select(func.count(User.id)).where(User.role == "client")) or 0
    )
    total_artisans = (
        await db.scalar(select(func.count(User.id)).where(User.role == "artisan")) or 0
    )

    total_jobs = await db.scalar(select(func.count(Job.id))) or 0
    open_jobs = (
        await db.scalar(select(func.count(Job.id)).where(Job.status == JobStatus.open))
        or 0
    )
    total_bookings = await db.scalar(select(func.count(Booking.id))) or 0
    completed_jobs = (
        await db.scalar(
            select(func.count(Booking.id)).where(
                Booking.status == BookingStatus.completed
            )
        )
        or 0
    )
    disputed_jobs = (
        await db.scalar(
            select(func.count(Booking.id)).where(
                Booking.status == BookingStatus.disputed
            )
        )
        or 0
    )

    total_revenue_res = await db.execute(
        text(
            "SELECT COALESCE(SUM(agreed_price), 0) FROM bookings WHERE status = 'completed'"
        )
    )
    total_revenue = total_revenue_res.scalar() or 0

    pending_verifications = (
        await db.scalar(
            select(func.count(ArtisanProfile.user_id)).where(
                ArtisanProfile.verification_status == "pending"
            )
        )
        or 0
    )

    flagged_reviews = (
        await db.scalar(select(func.count(Review.id)).where(Review.is_flagged)) or 0
    )

    # Monthly booking trend (last 6 months)
    monthly_res = await db.execute(
        text("""
        SELECT date_trunc('month', created_at) as month, COUNT(*) as bookings
        FROM bookings
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month ASC
    """)
    )
    monthly_jobs = [
        {"month": str(row.month)[:7], "bookings": row.bookings} for row in monthly_res
    ]

    return {
        "users": {
            "total": total_users,
            "clients": total_clients,
            "artisans": total_artisans,
        },
        "jobs": {
            "total": total_jobs,
            "open": open_jobs,
            "completed": completed_jobs,
            "disputed": disputed_jobs,
        },
        "bookings": {
            "total": total_bookings,
            "completed": completed_jobs,
            "disputed": disputed_jobs,
        },
        "revenue": {"total_rwf": int(total_revenue), "currency": "RWF"},
        "total_revenue_rwf": int(total_revenue),
        "pending_verifications": pending_verifications,
        "moderation": {
            "pending_verifications": pending_verifications,
            "flagged_reviews": flagged_reviews,
        },
        "monthly_jobs": monthly_jobs,
        "monthly_trend": monthly_jobs,
    }


# ── Dispute resolution ──────────────────────────────────────────────────────────


@router.post("/bookings/{booking_id}/resolve-dispute")
async def resolve_booking_dispute(
    booking_id: UUID,
    payload: DisputeResolution,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Admin resolves a dispute — marks booking completed or cancelled depending on winner."""
    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id, Booking.status == BookingStatus.disputed
        )
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Disputed booking not found.")

    if payload.winner == "client":
        new_status = BookingStatus.cancelled
    else:
        new_status = BookingStatus.completed

    await db.execute(
        update(Booking).where(Booking.id == booking_id).values(status=new_status)
    )
    await db.commit()
    return {
        "message": f"Dispute resolved. Winner: {payload.winner}. Booking status: {new_status}",
        "notes": payload.notes,
    }


# ── Payment Verification ───────────────────────────────────────────────────────


@router.get("/payments/pending")
async def list_pending_payments(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """List all payments awaiting manual verification."""
    result = await db.execute(
        select(Payment, User)
        .join(User, Payment.client_id == User.id)
        .where(Payment.status == PaymentStatus.pending_verification)
        .order_by(Payment.proof_submitted_at.asc())
    )
    items = []
    for payment, client in result:
        items.append(
            {
                "payment_id": str(payment.id),
                "booking_id": str(payment.booking_id),
                "client_name": client.full_name,
                "client_phone": client.phone_number,
                "amount": payment.amount,
                "method": payment.method,
                "reference_code": payment.reference_code,
                "client_transaction_id": payment.client_transaction_id,
                "proof_screenshot_url": payment.proof_screenshot_url,
                "proof_submitted_at": payment.proof_submitted_at,
                "created_at": payment.created_at,
            }
        )
    return items


@router.post("/payments/{payment_id}/verify")
async def verify_payment(
    payment_id: UUID,
    payload: PaymentVerdict,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Approve or reject a pending payment proof."""
    admin_id = UUID(current_user["sub"])

    payment = await db.scalar(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.status == PaymentStatus.pending_verification,
        )
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found or not pending.")

    new_status = PaymentStatus.approved if payload.approved else PaymentStatus.rejected
    await db.execute(
        update(Payment)
        .where(Payment.id == payment_id)
        .values(
            status=new_status,
            admin_note=payload.admin_note,
            verified_by=admin_id,
            verified_at=datetime.now(timezone.utc),
        )
    )

    if payload.approved:
        # Move booking to confirmed
        await db.execute(
            update(Booking)
            .where(Booking.id == payment.booking_id)
            .values(status=BookingStatus.confirmed)
        )
        db.add(
            Notification(
                user_id=payment.artisan_id,
                event_type="booking_confirmed",
                title="✅ Booking Confirmed",
                body=f"Payment of {payment.amount:,} RWF received. Job is confirmed!",
                payload={"booking_id": str(payment.booking_id)},
            )
        )
        db.add(
            Notification(
                user_id=payment.client_id,
                event_type="payment_approved",
                title="💚 Payment Verified",
                body=f"Your payment of {payment.amount:,} RWF has been confirmed. Your artisan is on the way!",
                payload={"booking_id": str(payment.booking_id)},
            )
        )
        await db.commit()

        from app.integrations.expo_push import send_push_to_user  # noqa: PLC0415

        await send_push_to_user(
            db,
            payment.artisan_id,
            "✅ New Booking Confirmed",
            f"Payment of {payment.amount:,} RWF received. A job is waiting for you!",
            {"screen": "messages", "booking_id": str(payment.booking_id)},
        )
        await send_push_to_user(
            db,
            payment.client_id,
            "💚 Payment Verified",
            "Your payment was confirmed. Your artisan has been notified!",
            {"screen": "messages", "booking_id": str(payment.booking_id)},
        )
    else:
        db.add(
            Notification(
                user_id=payment.client_id,
                event_type="payment_rejected",
                title="❌ Payment Not Verified",
                body=payload.admin_note
                or "We couldn't verify your payment. Please try again.",
                payload={
                    "payment_id": str(payment_id),
                    "booking_id": str(payment.booking_id),
                },
            )
        )
        await db.commit()

        from app.integrations.expo_push import send_push_to_user  # noqa: PLC0415

        await send_push_to_user(
            db,
            payment.client_id,
            "❌ Payment Not Verified",
            payload.admin_note
            or "We couldn't verify your payment. Please try again or contact support.",
            {"screen": "payment", "booking_id": str(payment.booking_id)},
        )

    return {
        "message": f"Payment {'approved' if payload.approved else 'rejected'}.",
        "payment_id": str(payment_id),
        "new_status": new_status,
    }


# ── Pro verification nightly upgrade ─────────────────────────────────────────


@router.post("/artisans/cron/pro-upgrade")
async def cron_pro_upgrade(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """
    Nightly cron: auto-upgrade artisans to pro_verified if they meet criteria:
    - Already id_verified
    - 10+ reviews
    - Average rating >= 4.0
    - completion_rate >= 0.8
    """
    # Single SELECT to get eligible artisan IDs
    eligible = await db.execute(
        select(ArtisanProfile.user_id).where(
            ArtisanProfile.verification_status == VerificationStatus.id_verified,
            ArtisanProfile.total_reviews >= 10,
            ArtisanProfile.average_rating >= 4.0,
            ArtisanProfile.completion_rate >= 0.8,
        )
    )
    artisan_ids = [row[0] for row in eligible.all()]
    upgraded = len(artisan_ids)

    if not upgraded:
        return {"upgraded": 0, "message": "No artisans eligible for pro upgrade."}

    # Single batch UPDATE (1 query, not N)
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id.in_(artisan_ids))
        .values(verification_status=VerificationStatus.pro_verified)
    )

    # Bulk INSERT notifications (1 query, not N)
    import uuid as _uuid  # noqa: PLC0415
    for uid in artisan_ids:
        db.add(
            Notification(
                id=_uuid.uuid4(),
                user_id=uid,
                event_type="pro_verified",
                title="You're now Pro Verified! 🌟",
                body="Congratulations! You've earned the Pro Verified badge for your outstanding service.",
                payload={"event_type": "pro_verified", "screen": "artisan_profile"},
            )
        )

    await db.commit()

    return {
        "upgraded": upgraded,
        "message": f"{upgraded} artisan(s) upgraded to pro_verified.",
    }


@router.post("/escrow/create")
async def admin_create_escrow(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Create escrow hold when payment is manually approved (called from verify_payment)."""
    from uuid import UUID as _UUID  # noqa: PLC0415

    from app.models.booking import Booking  # noqa: PLC0415
    from app.models.payment import Payment  # noqa: PLC0415
    from app.services.escrow_service import create_escrow_hold  # noqa: PLC0415

    bid = _UUID(booking_id)
    booking = await db.scalar(select(Booking).where(Booking.id == bid))
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    payment = await db.scalar(select(Payment).where(Payment.booking_id == bid))
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    escrow = await create_escrow_hold(
        db, bid, booking.artisan_id, booking.client_id, payment.amount
    )
    await db.commit()
    return {
        "escrow_id": str(escrow.id),
        "amount": escrow.amount,
        "status": escrow.status,
    }


# ── Sprint 5: Community Safety Score Admin Endpoints ─────────────────────────


class ScoreOverridePayload(BaseModel):
    adjustment: int  # positive or negative, clamped to keep score in 0–1000
    reason: str


@router.get("/artisans/{artisan_id}/score")
async def get_artisan_score_breakdown(
    artisan_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """
    Sprint 5 — Return the full Community Safety Score breakdown for an artisan.

    Returns the score components, tier, raw source values, and a transparency
    narrative that admins can review before any manual override.
    """
    breakdown = await compute_safety_score(artisan_id, db, return_breakdown=True)
    assert isinstance(breakdown, ScoreBreakdown)
    return breakdown.to_dict()


@router.patch("/artisans/{artisan_id}/score")
async def override_artisan_score(
    artisan_id: UUID,
    payload: ScoreOverridePayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """
    Sprint 5 — Manually adjust an artisan's Community Safety Score by ±points.

    Useful for edge cases: artisan was robbed, had a family emergency, disputed
    bookings were fraudulent, etc. The adjustment is applied on top of the
    computed score. A reason note is required for the audit trail.

    The adjusted score is clamped to 0–1000.
    """
    import uuid as _uuid  # noqa: PLC0415

    from app.models.notification import Notification  # noqa: PLC0415

    # Guard: artisan must exist
    profile = await db.scalar(
        select(ArtisanProfile).where(ArtisanProfile.user_id == artisan_id)
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Artisan profile not found")

    current_score = profile.community_score or 0
    new_score = max(0, min(1000, current_score + payload.adjustment))

    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == artisan_id)
        .values(community_score=new_score)
    )

    # Persist an audit notification so there's a record in the DB
    admin_id = current_user.get("sub") or current_user.get("user_id")
    direction = "increased" if payload.adjustment > 0 else "decreased"
    db.add(
        Notification(
            id=_uuid.uuid4(),
            user_id=artisan_id,
            event_type="score_override",
            title="Your Safety Score was adjusted by an admin",
            body=(
                f"Your Community Safety Score was {direction} by "
                f"{abs(payload.adjustment)} points "
                f"(from {current_score} → {new_score}). "
                f"Reason: {payload.reason}"
            ),
            payload={
                "event_type": "score_override",
                "admin_id": str(admin_id),
                "previous_score": current_score,
                "new_score": new_score,
                "adjustment": payload.adjustment,
                "reason": payload.reason,
            },
        )
    )
    await db.commit()

    return {
        "artisan_id": str(artisan_id),
        "previous_score": current_score,
        "adjustment": payload.adjustment,
        "new_score": new_score,
        "reason": payload.reason,
        "adjusted_by": str(admin_id),
    }


@router.post("/scores/recalculate")
async def trigger_score_recalculation(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """
    Sprint 5 — Manually trigger a full nightly score recalculation for all artisans.

    This is the same job that runs automatically at 00:00 UTC each night.
    Admins can trigger it on-demand (e.g., after a bulk verification run).
    """
    result = await recalculate_all_scores(db)
    return {
        "status": "complete",
        **result,
    }


# ── Sprint 9 — ML Ranking admin endpoints ────────────────────────────────────


@router.get("/ml/ranking-status", summary="Sprint 9 — ML Ranking model status")
async def get_ml_ranking_status(
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """
    Return the current state of the sklearn ranking model:
    - Whether it has been trained
    - Training timestamp + sample count
    - Validation AUC
    - Feature importances
    """
    from app.services.ml_ranking_service import get_model_metadata  # noqa: PLC0415
    return get_model_metadata()


@router.post("/ml/train-now", summary="Sprint 9 — Trigger ML model training on-demand")
async def trigger_ml_training(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """
    Trigger on-demand ML ranking model training.
    Normally runs nightly; use this after a significant data import.
    """
    from app.services.ml_ranking_service import train_ranking_model  # noqa: PLC0415
    result = await train_ranking_model(db)
    return result


@router.post("/ml/build-tfidf", summary="Sprint 9 — Rebuild TF-IDF category index")
async def trigger_tfidf_rebuild(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """
    Trigger on-demand TF-IDF index rebuild.
    Normally runs nightly; use this after seeding new job data.
    """
    from app.services.sklearn_category_service import build_tfidf_index  # noqa: PLC0415
    result = await build_tfidf_index(db)
    return result


@router.get("/ml/tfidf-status", summary="Sprint 9 — TF-IDF index status")
async def get_tfidf_status_endpoint(
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    """Return the current state of the sklearn TF-IDF category index."""
    from app.services.sklearn_category_service import get_tfidf_status  # noqa: PLC0415
    return get_tfidf_status()
