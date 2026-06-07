# File: backend/app/routers/notifications.py
"""
Notifications router.

GET    /notifications             — list user notifications (newest first)
PATCH  /notifications/read-all    — mark all as read
PATCH  /notifications/{id}/read   — mark single as read
PATCH  /notifications/preferences — update notification preferences
GET    /notifications/preferences — get current preferences

Real-time delivery is handled by Socket.IO (namespace /notifications).
This module exposes create_and_push_notification() used by all other routers
to persist a notification AND push it instantly over Socket.IO.
"""

import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.integrations.socket_manager import push_notification
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def create_and_push_notification(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    title: str,
    body: str,
    payload: dict[str, Any] | None = None,
) -> Notification:
    """
    Create a notification record in DB and push it over Socket.IO immediately.

    Use this helper instead of directly instantiating Notification everywhere.
    The Socket.IO emit is fire-and-forget — it never blocks the DB transaction.
    """
    n = Notification(
        user_id=user_id,
        event_type=event_type,
        title=title,
        body=body,
        payload=payload,
    )
    db.add(n)
    await db.flush()

    # Fire-and-forget Socket.IO push
    import asyncio  # noqa: PLC0415

    asyncio.ensure_future(
        push_notification(
            str(user_id),
            {
                "id": str(n.id),
                "event_type": event_type,
                "title": title,
                "body": body,
                "payload": payload or {},
                "is_read": False,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            },
        )
    )

    return n


@router.get("")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifs = result.scalars().all()
    return [
        {
            "id": str(n.id),
            "event_type": n.event_type,
            "title": n.title,
            "body": n.body,
            "payload": n.payload,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read."}


@router.patch("/{notification_id}/read")
async def mark_one_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    await db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_id)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "Notification marked as read."}


class NotificationPrefs(BaseModel):
    new_bid: bool = True
    booking_update: bool = True
    payment: bool = True
    message: bool = True
    promo: bool = False


@router.get("/preferences")
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        return NotificationPrefs().model_dump()
    try:
        prefs = json.loads(user.notification_prefs or "{}")
        return prefs
    except Exception:
        return NotificationPrefs().model_dump()


@router.patch("/preferences")
async def update_preferences(
    prefs: NotificationPrefs,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(notification_prefs=json.dumps(prefs.model_dump()))
    )
    await db.commit()
    return {"message": "Preferences updated.", **prefs.model_dump()}
