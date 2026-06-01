# File: backend/app/routers/notifications.py
"""
Notifications router.
GET    /notifications              — list user notifications (newest first)
PATCH  /notifications/read-all     — mark all as read
PATCH  /notifications/{id}/read    — mark single as read
DELETE /notifications/{id}         — delete a notification
GET    /notifications/unread-count — unread count for badge
"""
import httpx

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_expo_push(token: str, title: str, body: str, data: dict | None = None) -> None:
    """Fire-and-forget: send an Expo push notification."""
    if not token or not token.startswith("ExponentPushToken"):
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                EXPO_PUSH_URL,
                json={
                    "to": token,
                    "sound": "default",
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "channelId": "default",
                },
            )
    except Exception:
        pass  # Non-critical — never crash the main flow


async def notify_and_push(
    db: AsyncSession,
    user_id: UUID,
    event_type: str,
    title: str,
    body: str,
    payload: dict | None = None,
) -> None:
    """Persist a DB notification and optionally send Expo push notification."""
    n = Notification(
        user_id=user_id,
        event_type=event_type,
        title=title,
        body=body,
        payload=payload,
    )
    db.add(n)

    # Also fire push notification if user has a token
    user = await db.scalar(select(User).where(User.id == user_id))
    if user and user.expo_push_token:
        await send_expo_push(user.expo_push_token, title, body, payload)


@router.get("/unread-count")
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    count = await db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id, Notification.is_read.is_(False)
        )
    )
    return {"count": count or 0}


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


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    await db.execute(
        delete(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    await db.commit()
    return {"message": "Notification deleted."}
