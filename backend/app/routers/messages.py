# File: backend/app/routers/messages.py
"""
Messages router — Sprint 7: Voice Message Support.

Changes vs Sprint 6:
  - MessageCreate: content is now optional; voice_note_url accepted.
  - Model validator ensures at least one of (content, voice_note_url) is set.
  - Voice-only messages skip translation (can't translate audio).
  - _msg_dict now includes voice_note_duration_secs.
  - send_message persists voice_note_url + voice_note_duration_secs.
  - Conversations fallback includes voice_note_url in last_message preview.

Optimisations preserved:
  - get_conversations: single lateral subquery (zero N+1).
  - Socket.IO broadcast on every message (text or voice).
  - Background translation for text messages only.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.integrations.socket_manager import broadcast_message
from app.integrations.translation import create_translation_task, detect_language
from app.models.booking import Booking
from app.models.message import Message
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messages", tags=["messages"])

TARGET_LANGS = ["en", "rw", "fr"]  # Languages we translate into

VOICE_PLACEHOLDER = "🎙️ Voice message"  # shown in conversation list preview


class MessageCreate(BaseModel):
    """
    Payload for sending a message.

    Rules:
      - content may be empty string (voice-only) or omitted entirely.
      - voice_note_url is the final public URL after a presigned upload.
      - voice_note_duration_secs is optional metadata; UI shows it in the
        audio player without needing to load the audio file.
      - At least one of (content, voice_note_url) must be non-empty.
    """

    content: str = ""
    voice_note_url: str | None = None
    voice_note_duration_secs: float | None = None
    sender_lang: str = "auto"

    @field_validator("content", mode="before")
    @classmethod
    def _coerce_none_content(cls, v: Any) -> str:
        """Treat explicit None as empty string for backwards compatibility."""
        return v if v is not None else ""

    @model_validator(mode="after")
    def must_have_content_or_voice(self) -> "MessageCreate":
        if not self.content.strip() and not self.voice_note_url:
            raise ValueError("Message must have text content or a voice note.")
        return self


def _msg_dict(msg: Message) -> dict[str, Any]:
    return {
        "id": str(msg.id),
        "booking_id": str(msg.booking_id),
        "sender_id": str(msg.sender_id),
        "content": msg.content,
        "translated_content": msg.translated_content,
        "detected_lang": getattr(msg, "detected_lang", None),
        "voice_note_url": msg.voice_note_url,
        "voice_note_duration_secs": getattr(msg, "voice_note_duration_secs", None),
        "is_voice_only": bool(msg.voice_note_url and not msg.content),
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

    # Sprint 7 note: last_message content can be NULL for voice-only messages;
    # COALESCE to the placeholder so conversation previews always render.
    stmt = text("""
        SELECT
            b.id                                                AS booking_id,
            b.status                                            AS booking_status,
            ou.id                                               AS other_user_id,
            ou.full_name                                        AS other_user_name,
            ou.avatar_url                                       AS other_user_avatar,
            COALESCE(lm.content, lm.voice_preview)             AS last_content,
            lm.voice_note_url                                   AS last_voice_note_url,
            lm.created_at                                       AS last_created_at,
            COALESCE(uc.cnt, 0)                                 AS unread_count
        FROM bookings b
        JOIN users ou ON (
            CASE
                WHEN b.client_id  = :uid THEN b.artisan_id
                ELSE b.client_id
            END = ou.id
        )
        LEFT JOIN LATERAL (
            SELECT
                content,
                voice_note_url,
                CASE WHEN voice_note_url IS NOT NULL AND (content IS NULL OR content = '')
                     THEN '🎙️ Voice message'
                     ELSE NULL
                END AS voice_preview,
                created_at
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
                    "is_voice": bool(row["last_voice_note_url"]),
                    "created_at": (
                        row["last_created_at"].isoformat()
                        if row["last_created_at"]
                        else None
                    ),
                }
                if row["last_content"] is not None or row["last_voice_note_url"]
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
        last_content = None
        last_is_voice = False
        if latest_msg:
            if latest_msg.voice_note_url and not latest_msg.content:
                last_content = VOICE_PLACEHOLDER
                last_is_voice = True
            else:
                last_content = latest_msg.content

        conversations.append({
            "booking_id": str(booking.id),
            "other_user": {
                "id": str(other_user.id),
                "full_name": other_user.full_name,
                "avatar_url": other_user.avatar_url,
            },
            "last_message": (
                {
                    "content": last_content,
                    "is_voice": last_is_voice,
                    "created_at": (
                        latest_msg.created_at.isoformat()
                        if latest_msg and latest_msg.created_at
                        else None
                    ),
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
# POST /messages/{booking_id}  — send + Socket.IO broadcast + translation
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

    is_voice_only = bool(payload.voice_note_url and not payload.content.strip())

    # For voice-only messages skip language detection entirely
    if is_voice_only:
        detected_lang = "audio"
    else:
        detected_lang = (
            detect_language(payload.content)
            if payload.sender_lang == "auto"
            else payload.sender_lang
        )

    message = Message(
        booking_id=booking_id,
        sender_id=user_id,
        content=payload.content.strip() or None,  # store None for voice-only
        voice_note_url=payload.voice_note_url,
        voice_note_duration_secs=payload.voice_note_duration_secs,
    )
    if hasattr(message, "detected_lang"):
        message.detected_lang = detected_lang

    db.add(message)
    await db.commit()
    await db.refresh(message)

    msg_data = _msg_dict(message)

    # ── Socket.IO broadcast (fire-and-forget) ────────────────────────────────
    import asyncio  # noqa: PLC0415
    asyncio.ensure_future(broadcast_message(str(booking_id), msg_data))

    # ── Background translation (text messages only) ───────────────────────────
    if not is_voice_only:
        other_id = (
            booking.artisan_id if booking.client_id == user_id else booking.client_id
        )
        recipient = await db.scalar(select(User).where(User.id == other_id))
        recipient_lang = getattr(recipient, "preferred_lang", "en") or "en"

        if recipient_lang != detected_lang and payload.content.strip():
            msg_id = message.id

            async def _update_translation(translated: str) -> None:
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
                    logger.warning(
                        "Failed to persist translation for msg %s: %s", msg_id, exc
                    )

            try:
                create_translation_task(
                    payload.content,
                    detected_lang,
                    recipient_lang,
                    on_complete=_update_translation,
                )
            except RuntimeError:
                pass

    return msg_data


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
