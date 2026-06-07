# File: backend/app/routers/messages.py
"""
Messages router.

Optimisations vs original:
- get_conversations: replaced N+1 loop (2 queries × N bookings) with a single
  lateral subquery that fetches latest_message + unread_count in one round-trip.
- send_message: triggers background translation task (non-blocking).
- Language detection on message send — stored as detected_lang on message.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.integrations.translation import create_translation_task, detect_language
from app.models.booking import Booking
from app.models.message import Message
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messages", tags=["messages"])

TARGET_LANGS = ["en", "rw", "fr"]  # Languages we translate into


class MessageCreate(BaseModel):
    content: str
    # Optional: caller can hint the sender's language; "auto" means detect
    sender_lang: str = "auto"


def _msg_dict(msg: Message) -> dict[str, Any]:
    return {
        "id": str(msg.id),
        "booking_id": str(msg.booking_id),
        "sender_id": str(msg.sender_id),
        "content": msg.content,
        "translated_content": msg.translated_content,
        "detected_lang": getattr(msg, "detected_lang", None),
        "voice_note_url": msg.voice_note_url,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# ---------------------------------------------------------------------------
# GET /messages/conversations  — single-query version (no N+1)
# ---------------------------------------------------------------------------

@router.get("/conversations")
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Single query: join bookings → other_user, lateral-style subqueries for
    # latest message and unread count per booking.
    # Using raw SQL for the LATERAL + aggregation pattern (cleaner than ORM).
    stmt = text("""
        SELECT
            b.id                    AS booking_id,
            b.status                AS booking_status,
            ou.id                   AS other_user_id,
            ou.full_name            AS other_user_name,
            ou.avatar_url           AS other_user_avatar,
            lm.content              AS last_content,
            lm.created_at           AS last_created_at,
            COALESCE(uc.cnt, 0)     AS unread_count
        FROM bookings b
        JOIN users ou ON (
            CASE
                WHEN b.client_id  = :uid THEN b.artisan_id
                ELSE b.client_id
            END = ou.id
        )
        LEFT JOIN LATERAL (
            SELECT content, created_at
            FROM messages
            WHERE booking_id = b.id
            ORDER BY created_at DESC
            LIMIT 1
        ) lm ON TRUE
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS cnt
            FROM messages
            WHERE booking_id = b.id
              AND sender_id  <> :uid
              AND is_read = FALSE
        ) uc ON TRUE
        WHERE (b.client_id = :uid OR b.artisan_id = :uid)
          AND b.status <> 'cancelled'
        ORDER BY unread_count DESC, last_created_at DESC NULLS LAST
    """)

    try:
        result = await db.execute(stmt, {"uid": user_id})
        rows = result.mappings().all()
    except Exception:
        # LATERAL not supported (e.g. SQLite in test env) — fall back to ORM
        rows_fallback = await _conversations_fallback(db, user_id)
        return rows_fallback

    conversations = []
    for row in rows:
        conversations.append({
            "booking_id": str(row["booking_id"]),
            "other_user": {
                "id": str(row["other_user_id"]),
                "full_name": row["other_user_name"],
                "avatar_url": row["other_user_avatar"],
            },
            "last_message": (
                {
                    "content": row["last_content"],
                    "created_at": row["last_created_at"].isoformat()
                    if row["last_created_at"] else None,
                }
                if row["last_content"] is not None
                else None
            ),
            "unread_count": row["unread_count"],
            "booking_status": row["booking_status"],
        })
    return conversations


async def _conversations_fallback(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    """ORM fallback for non-PostgreSQL environments (tests, SQLite)."""
    bookings_res = await db.execute(
        select(Booking, User)
        .join(
            User,
            or_(
                (Booking.client_id == User.id) & (Booking.artisan_id == user_id),
                (Booking.artisan_id == User.id) & (Booking.client_id == user_id),
            ),
        )
        .where(
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
            Booking.status != "cancelled",
        )
        .order_by(Booking.created_at.desc())
    )

    conversations = []
    for booking, other_user in bookings_res.all():
        latest_msg = await db.scalar(
            select(Message)
            .where(Message.booking_id == booking.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        unread_count = (
            await db.scalar(
                select(func.count(Message.id)).where(
                    Message.booking_id == booking.id,
                    Message.sender_id != user_id,
                    Message.is_read.is_(False),
                )
            )
            or 0
        )
        conversations.append({
            "booking_id": str(booking.id),
            "other_user": {
                "id": str(other_user.id),
                "full_name": other_user.full_name,
                "avatar_url": other_user.avatar_url,
            },
            "last_message": (
                {
                    "content": latest_msg.content,
                    "created_at": latest_msg.created_at.isoformat()
                    if latest_msg and latest_msg.created_at else None,
                }
                if latest_msg
                else None
            ),
            "unread_count": unread_count,
            "booking_status": booking.status,
        })
    return conversations


# ---------------------------------------------------------------------------
# GET /messages/{booking_id}
# ---------------------------------------------------------------------------

@router.get("/{booking_id}")
async def get_messages(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])

    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
        )
    )
    if not booking:
        raise HTTPException(status_code=403, detail="Not authorized to view these messages")

    # Mark incoming messages as read (batch update)
    await db.execute(
        update(Message)
        .where(Message.booking_id == booking_id, Message.sender_id != user_id)
        .values(is_read=True)
    )
    await db.commit()

    messages_res = await db.execute(
        select(Message)
        .where(Message.booking_id == booking_id)
        .order_by(Message.created_at.asc())
    )
    return [_msg_dict(m) for m in messages_res.scalars().all()]


# ---------------------------------------------------------------------------
# POST /messages/{booking_id}  — send + background translation
# ---------------------------------------------------------------------------

@router.post("/{booking_id}")
async def send_message(
    booking_id: UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])

    booking = await db.scalar(
        select(Booking).where(
            Booking.id == booking_id,
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
        )
    )
    if not booking:
        raise HTTPException(
            status_code=403, detail="Not authorized to send messages in this booking"
        )

    # Detect sender language locally (zero-cost, <1ms)
    detected_lang = (
        detect_language(payload.content)
        if payload.sender_lang == "auto"
        else payload.sender_lang
    )

    message = Message(
        booking_id=booking_id,
        sender_id=user_id,
        content=payload.content,
    )
    # Store detected language if the model has the column
    if hasattr(message, "detected_lang"):
        message.detected_lang = detected_lang  # type: ignore[assignment]

    db.add(message)
    await db.commit()
    await db.refresh(message)

    # ── Background translation (non-blocking) ────────────────────────────────
    # Determine recipient language: fetch the other party's preferred_lang
    other_id = (
        booking.artisan_id if booking.client_id == user_id else booking.client_id
    )
    recipient = await db.scalar(select(User).where(User.id == other_id))
    recipient_lang = getattr(recipient, "preferred_lang", "en") or "en"

    if recipient_lang != detected_lang:
        msg_id = message.id

        async def _update_translation(translated: str) -> None:
            """Persist translation back to the message row."""
            from app.database import AsyncSessionLocal  # noqa: PLC0415
            try:
                async with AsyncSessionLocal() as session:
                    await session.execute(
                        update(Message)
                        .where(Message.id == msg_id)
                        .values(translated_content=translated)
                    )
                    await session.commit()
            except Exception as exc:
                logger.warning("Failed to persist translation for msg %s: %s", msg_id, exc)

        try:
            create_translation_task(
                payload.content,
                detected_lang,
                recipient_lang,
                on_complete=_update_translation,
            )
        except RuntimeError:
            # No running event loop — skip background task
            pass

    return _msg_dict(message)


# ---------------------------------------------------------------------------
# PATCH /messages/{booking_id}/read
# ---------------------------------------------------------------------------

@router.patch("/{booking_id}/read")
async def mark_as_read(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])
    await db.execute(
        update(Message)
        .where(Message.booking_id == booking_id, Message.sender_id != user_id)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "Messages marked as read"}
