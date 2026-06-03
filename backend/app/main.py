import os
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, init_db
from app.models.artisan import ArtisanProfile, Category, PortfolioPhoto, artisan_skills
from app.models.review import Review
from app.models.user import User, UserRole
from app.routers import (
    admin,
    artisans,
    auth,
    bids,
    bookings,
    jobs,
    messages,
    notifications,
    payments,
    reviews,
)

# ── WebSocket connection manager ──────────────────────────────────────────────


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, booking_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(booking_id, []).append(ws)

    def disconnect(self, booking_id: str, ws: WebSocket) -> None:
        conns = self._connections.get(booking_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, booking_id: str, data: dict[str, object]) -> None:
        for ws in list(self._connections.get(booking_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(booking_id, ws)


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Always create tables (no-op if they exist) and seed categories if empty.
    # In production, Alembic migrations handle schema changes; seeding is safe to always run.
    await init_db()
    yield


app = FastAPI(title="HandyRwanda API", version="2.0.0", lifespan=lifespan)

_CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",")
_EXTRA_ORIGINS = [o.strip() for o in _CORS_ORIGINS if o.strip()]

# NOTE: allow_credentials=True is incompatible with allow_origins=["*"] per the
# CORS spec (browsers reject such responses). We therefore list known origins
# explicitly and fall back to env-injected extras for production deployments.
_ALLOW_ORIGINS = [
    "http://localhost:5173",    # Vite web dev
    "http://localhost:8081",    # Expo web / Metro
    "http://localhost:19006",   # Expo web (older port)
    "http://10.0.2.2:5173",    # Android emulator → host Vite
    "http://10.0.2.2:8081",    # Android emulator → host Metro
    *_EXTRA_ORIGINS,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOW_ORIGINS,
    allow_origin_regex=r"http://192\.168\.\d+\.\d+(:\d+)?",  # LAN (Expo Go physical device)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(artisans.router)
app.include_router(auth.router)
app.include_router(bids.router)
app.include_router(bookings.router)
app.include_router(jobs.router)
app.include_router(messages.router)
app.include_router(notifications.router)
app.include_router(payments.router)
app.include_router(reviews.router)


@app.get(
    "/categories",
    tags=["categories"],
    summary="List all active service categories (public)",
)
async def list_categories_public(db: AsyncSession = Depends(get_db)) -> Any:
    """
    Public endpoint — no authentication required.

    Returns every active service category.  Both the web job-posting form
    and the mobile category-picker call this endpoint.  It mirrors
    GET /artisans/categories but lives at the root so clients don't need to
    know which sub-router owns categories.
    """
    result = await db.execute(select(Category).where(Category.is_active).order_by(Category.name_en))
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


@app.websocket("/ws/messages/{booking_id}")
async def websocket_messages(websocket: WebSocket, booking_id: str) -> None:
    await manager.connect(booking_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(booking_id, data)
    except WebSocketDisconnect:
        manager.disconnect(booking_id, websocket)


@app.get("/artisans/{artisan_id}/public")
async def get_artisan_public(
    artisan_id: UUID, db: AsyncSession = Depends(get_db)
) -> Any:
    user = await db.scalar(
        select(User).where(
            User.id == artisan_id, User.role == UserRole.artisan, User.is_active
        )
    )  # noqa
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
            "photo_url": p.photo_url,
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
        .where(Review.artisan_id == artisan_id, Review.is_flagged.is_(False))  # noqa
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

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "phone_number": user.phone_number,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "district": user.district,
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


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "Welcome to HandyRwanda API v2.0"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "2.0.0"}
