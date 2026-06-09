# File: backend/app/main.py
"""
HandyRwanda FastAPI application.

Real-time layer:
  - Migrated from raw WebSockets to Socket.IO (python-socketio 5.x).
  - Two namespaces:
      /notifications  – per-user notification push (auth via JWT in handshake)
      /messages       – per-booking real-time chat (auth via JWT in handshake)
  - The combined ASGI app (FastAPI + Socket.IO) is created at module level
    via socket_manager.create_combined_asgi() and exposed as `application`.
    Uvicorn / gunicorn should point at  backend.app.main:application.
"""

import asyncio
import logging
import os
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy import text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db, init_db
from app.dependencies.jwt_auth import get_current_user
from app.integrations.socket_manager import create_combined_asgi, sio
from app.integrations.upstash import redis_get, redis_set
from app.integrations.ws_manager import notification_manager
from app.logging_config import configure_logging
from app.models.artisan import ArtisanProfile, Category, PortfolioPhoto, artisan_skills
from app.models.review import Review
from app.models.user import User, UserRole
from app.routers import (
    address,
    admin,
    analytics,
    artisans,
    auth,
    bids,
    bookings,
    disputes,
    escrow,
    jobs,
    legal,
    messages,
    notifications,
    payments,
    reviews,
    schedule,
    uploads,
)
from app.services.safety_score_service import (
    ScoreBreakdown,
    compute_safety_score,
    recalculate_all_scores,
)

configure_logging()

_log = logging.getLogger(__name__)


# ── Background task: auto-release escrow every 30 minutes ────────────────────


async def _auto_release_loop() -> None:
    """Background task that auto-releases overdue escrow holds every 30 minutes."""
    from app.database import AsyncSessionLocal  # noqa: PLC0415
    from app.services.escrow_service import process_auto_releases  # noqa: PLC0415

    await asyncio.sleep(60)  # Initial delay to let app fully start
    while True:
        try:
            async with AsyncSessionLocal() as session:
                released = await process_auto_releases(session)
                if released:
                    print(f"[AutoRelease] Released {released} escrow(s)")
        except Exception as e:
            print(f"[AutoRelease] Error: {e}")
        await asyncio.sleep(1800)  # Run every 30 minutes


def _validate_startup_config() -> None:
    """
    Fail fast with clear messages when critical configuration is missing.
    Called at startup before accepting any requests.
    """
    required: dict[str, str] = {
        "JWT_SECRET": "Required for all authentication. Generate with: openssl rand -hex 32",
        "DATABASE_URL": "PostgreSQL connection string. Format: postgresql://user:pass@host:5432/dbname",
    }
    recommended: dict[str, str] = {
        "SUPABASE_URL": "Required for file uploads (avatars, portfolio photos)",
        "SUPABASE_SERVICE_ROLE_KEY": "Required for Supabase Storage API",
        "RESEND_API_KEY": "Required for OTP email delivery (console fallback active in dev)",
        "UPSTASH_REDIS_REST_URL": "Required for distributed rate limiting (in-memory fallback active)",
        "UPSTASH_REDIS_REST_TOKEN": "Required for distributed rate limiting (in-memory fallback active)",
    }

    missing_required = []
    for key, hint in required.items():
        if not os.getenv(key):
            missing_required.append(f"  ❌ {key}: {hint}")

    missing_recommended = []
    for key, hint in recommended.items():
        if not os.getenv(key):
            missing_recommended.append(f"  ⚠️  {key}: {hint}")

    if missing_required:
        msg = "CRITICAL: Missing required environment variables:\n" + "\n".join(missing_required)
        _log.critical(msg)
        raise RuntimeError(msg)

    if missing_recommended:
        _log.warning(
            "Missing recommended environment variables (degraded functionality):\n%s",
            "\n".join(missing_recommended),
        )

    _log.info("✅ Configuration validated — all required env vars present")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    _validate_startup_config()

    _log.info("🚀 HandyRwanda API starting up…")
    await init_db()
    _log.info("✅ Database initialised")

    # ── Start APScheduler for Sprint 1 + future sprints ──────────────────────
    scheduler = None
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler  # noqa: PLC0415

        scheduler = AsyncIOScheduler(timezone="Africa/Kigali")

        # Sprint 1: no recurring APScheduler jobs needed here — the 15-min
        # accept window is scheduled per-booking via asyncio.create_task in the
        # bookings router. Future sprints add nightly jobs here.

        # Sprint 5: nightly safety score recalculation at 00:00 UTC (02:00 Kigali)
        from apscheduler.triggers.cron import CronTrigger  # noqa: PLC0415

        async def _nightly_score_job() -> None:
            async with AsyncSessionLocal() as session:
                result = await recalculate_all_scores(session)
                _log.info("[SafetyScore] Nightly job complete: %s", result)

        scheduler.add_job(
            _nightly_score_job,
            CronTrigger(hour=0, minute=0, timezone="UTC"),
            id="nightly_safety_score",
            replace_existing=True,
            misfire_grace_time=3600,
        )

        # Placeholder for Sprint 9 nightly ML model training
        # scheduler.add_job(train_ranking_model, CronTrigger(hour=1, minute=0))

        # Placeholder for Sprint 6 weekly artisan insight notifications (Mon 8am Kigali)
        # scheduler.add_job(send_weekly_insights, CronTrigger(day_of_week="mon", hour=8))

        scheduler.start()
        _log.info("✅ APScheduler started (timezone: Africa/Kigali)")
    except Exception as exc:
        _log.warning("APScheduler failed to start: %s", exc)
        scheduler = None

    # Start background escrow auto-release task
    bg_task = asyncio.create_task(_auto_release_loop())
    _log.info("✅ Background tasks started")
    _log.info("✅ Socket.IO server ready — namespaces: /notifications, /messages")

    yield

    # Graceful shutdown
    _log.info("🛑 HandyRwanda API shutting down…")
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        _log.info("✅ APScheduler shut down")

    bg_task.cancel()
    try:
        await bg_task
    except asyncio.CancelledError:
        pass

    # Close shared Redis HTTP client
    from app.integrations.upstash import close_redis_client  # noqa: PLC0415
    await close_redis_client()
    _log.info("✅ Cleanup complete")


app = FastAPI(title="HandyRwanda API", version="2.1.0", lifespan=lifespan)

_CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")
_EXTRA_ORIGINS = [o.strip() for o in _CORS_ORIGINS if o.strip()]

_ALLOW_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://10.0.2.2:5173",
    "http://10.0.2.2:8081",
    *_EXTRA_ORIGINS,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOW_ORIGINS,
    allow_origin_regex=r"http://192\.168\.\d+\.\d+(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(address.router)
app.include_router(admin.router)
app.include_router(analytics.router)
app.include_router(artisans.router)
app.include_router(auth.router)
app.include_router(bids.router)
app.include_router(bookings.router)
app.include_router(disputes.router)
app.include_router(escrow.router)
app.include_router(jobs.router)
app.include_router(legal.router)
app.include_router(messages.router)
app.include_router(notifications.router)
app.include_router(payments.router)
app.include_router(reviews.router)
app.include_router(schedule.router)
app.include_router(uploads.router)


# ── Public categories endpoint ────────────────────────────────────────────────


@app.get(
    "/categories",
    tags=["categories"],
    summary="List all active service categories (public)",
)
async def list_categories_public(db: AsyncSession = Depends(get_db)) -> Any:
    result = await db.execute(
        select(Category).where(Category.is_active).order_by(Category.name_en)
    )
    cats = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name_en": c.name_en,
            "name_rw": c.name_rw,
            "name_fr": c.name_fr,
            "icon_emoji": c.icon_emoji,
            "is_active": c.is_active,
        }
        for c in cats
    ]


# ── Artisan public profile ─────────────────────────────────────────────────────


@app.get("/artisans/{artisan_id}/public")
async def get_artisan_public(
    artisan_id: UUID, db: AsyncSession = Depends(get_db)
) -> Any:
    user = await db.scalar(
        select(User).where(
            User.id == artisan_id, User.role == UserRole.artisan, User.is_active
        )
    )
    if not user:
        raise HTTPException(status_code=404, detail="Artisan not found.")

    profile = await db.scalar(
        select(ArtisanProfile).where(ArtisanProfile.user_id == artisan_id)
    )

    cats_result = await db.execute(
        select(Category)
        .join(artisan_skills, artisan_skills.c.category_id == Category.id)
        .where(artisan_skills.c.artisan_id == artisan_id)
    )
    categories = [
        {
            "id": str(c.id),
            "name_en": c.name_en,
            "name_rw": c.name_rw,
            "icon_emoji": c.icon_emoji,
        }
        for c in cats_result.scalars().all()
    ]

    portfolio_result = await db.execute(
        select(PortfolioPhoto).where(PortfolioPhoto.artisan_id == artisan_id).limit(12)
    )
    portfolio = [
        {
            "id": str(p.id),
            "image_url": p.image_url,
            "job_type": p.job_type,
            "description": p.description,
        }
        for p in portfolio_result.scalars().all()
    ]

    reviews_result = await db.execute(
        select(
            Review,
            User.full_name.label("client_name"),
            User.avatar_url.label("client_avatar"),
        )
        .join(User, Review.client_id == User.id)
        .where(Review.artisan_id == artisan_id, Review.is_flagged.is_(False))
        .order_by(Review.created_at.desc())
        .limit(10)
    )
    reviews = [
        {
            "id": str(r[0].id),
            "rating": r[0].rating,
            "comment": r[0].comment,
            "artisan_reply": r[0].artisan_reply,
            "client_name": r[1],
            "client_avatar": r[2],
            "created_at": r[0].created_at.isoformat() if r[0].created_at else None,
        }
        for r in reviews_result
    ]

    from app.utils.rwanda_address import format_address  # noqa: PLC0415

    full_address = format_address(
        district=user.district,
        sector=user.sector,
        cell=getattr(user, "cell", None),
        village=getattr(user, "village", None),
        street_road=getattr(user, "street_road", None),
    )

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "district": user.district,
        "sector": getattr(user, "sector", None),
        "cell": getattr(user, "cell", None),
        "village": getattr(user, "village", None),
        "street_road": getattr(user, "street_road", None),
        "full_address": full_address,
        "preferred_lang": user.preferred_lang,
        "profile": {
            "bio": profile.bio if profile else None,
            "years_experience": profile.years_experience if profile else 0,
            "service_radius_km": profile.service_radius_km if profile else 10,
            "hourly_rate": profile.hourly_rate if profile else None,
            "fixed_rate": profile.fixed_rate if profile else None,
            "spoken_languages": profile.spoken_languages if profile else None,
            "verification_status": profile.verification_status
            if profile
            else "unverified",
            "is_available": profile.is_available if profile else False,
            "average_rating": profile.average_rating if profile else 0.0,
            "total_reviews": profile.total_reviews if profile else 0,
            "completion_rate": profile.completion_rate if profile else 0.0,
            "response_rate": profile.response_rate if profile else 0.0,
            "community_score": profile.community_score if profile else 0,
        },
        "categories": categories,
        "portfolio": portfolio,
        "reviews": reviews,
    }


# ── Sprint 5: Public Safety Score Breakdown ──────────────────────────────────


@app.get("/artisans/{artisan_id}/score")
async def get_artisan_score_public(
    artisan_id: UUID, db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Sprint 5 — Return the full Community Safety Score breakdown for an artisan.
    Public endpoint — no auth required (transparency is a trust signal).

    Returns the artisan's score, tier, and per-component breakdown so clients
    can understand exactly why they trust this artisan.
    """
    # Verify artisan exists
    profile = await db.scalar(
        select(ArtisanProfile).where(ArtisanProfile.user_id == artisan_id)
    )
    if profile is None:
        raise HTTPException(status_code=404, detail="Artisan not found.")

    breakdown = await compute_safety_score(artisan_id, db, return_breakdown=True)
    assert isinstance(breakdown, ScoreBreakdown)
    return breakdown.to_dict()


# ── Recommended artisans (client home screen) ─────────────────────────────────


@app.get("/recommended-artisans")
async def get_recommended(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """Client home screen: recommended artisans based on recent job category."""
    from app.services.matching_service import get_recommended_artisans  # noqa: PLC0415

    client_id = UUID(current_user["sub"])
    return await get_recommended_artisans(db, client_id)


# ── Health ────────────────────────────────────────────────────────────────────


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to HandyRwanda API v2.1"}


@app.get("/health", tags=["monitoring"])
async def health() -> dict[str, Any]:
    """Basic health check — always fast, no DB/Redis queries."""
    return {
        "status": "ok",
        "version": "2.1.0",
        "realtime": "socket.io",
        "ws_users": notification_manager.active_user_count(),
    }


@app.get("/health/db", tags=["monitoring"])
async def health_db(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Deep health check — verifies DB connectivity."""
    t0 = time.monotonic()
    try:
        await db.execute(sa_text("SELECT 1"))
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        return {"status": "ok", "db_latency_ms": latency_ms}
    except Exception:
        _log.exception("Health DB check failed")
        return {"status": "error", "detail": "Database unreachable"}


@app.get("/health/redis", tags=["monitoring"])
async def health_redis() -> dict[str, Any]:
    """Deep health check — verifies Redis connectivity."""
    t0 = time.monotonic()
    try:
        await redis_set("__health__", "1", ttl_seconds=5)
        val = await redis_get("__health__")
        latency_ms = round((time.monotonic() - t0) * 1000, 1)
        return {
            "status": "ok" if val == "1" else "degraded",
            "latency_ms": latency_ms,
            "backend": "upstash" if os.getenv("UPSTASH_REDIS_REST_URL") else "in-memory",
        }
    except Exception:
        _log.exception("Health Redis check failed")
        return {"status": "error", "detail": "Redis unreachable"}


# ── Socket.IO connection stats endpoint ──────────────────────────────────────


@app.get("/health/socketio", tags=["monitoring"])
async def health_socketio() -> dict[str, Any]:
    """Returns Socket.IO namespace connection counts."""
    try:
        notif_rooms = sio.manager.rooms.get("/notifications", {})
        msg_rooms = sio.manager.rooms.get("/messages", {})
        # Count unique sids across all rooms (excluding the default '' room)
        notif_sids = {sid for room, sids in notif_rooms.items() if room != "" for sid in sids}
        msg_sids = {sid for room, sids in msg_rooms.items() if room != "" for sid in sids}
        return {
            "status": "ok",
            "notifications_connected": len(notif_sids),
            "messages_connected": len(msg_sids),
            "notifications_rooms": len([r for r in notif_rooms if r.startswith("user:")]),
            "messages_rooms": len([r for r in msg_rooms if r.startswith("booking:")]),
        }
    except Exception:
        _log.exception("Health Socket.IO check failed")
        return {"status": "error", "detail": "Socket.IO health check failed"}


# ── Combined ASGI application (FastAPI + Socket.IO) ───────────────────────────
#
# Uvicorn must be pointed at  `app.main:application`  (not `app.main:app`).
# The socket_manager.ASGIApp intercepts /socket.io/* requests before they
# reach FastAPI, so no route collision occurs.
#
# server.py already handles this; no changes needed there.

application = create_combined_asgi(app)
