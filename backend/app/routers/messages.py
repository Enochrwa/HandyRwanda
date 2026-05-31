# File: backend/app/routers/messages.py
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.models.booking import Booking
from app.models.message import Message
from app.models.user import User

router = APIRouter(prefix="/messages", tags=["messages"])


class MessageCreate(BaseModel):
    content: str


@router.get("/conversations")
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),  # Any role
) -> Any:
    user_id = UUID(current_user["sub"])

    # A conversation is linked to a booking where the user is either client or artisan
    # We want the latest message for each booking

    # All bookings for this user (any status except cancelled)
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
        # Latest message
        latest_msg = await db.scalar(
            select(Message)
            .where(Message.booking_id == booking.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        # Unread count
        unread_count = await db.scalar(
            select(func.count(Message.id)).where(
                Message.booking_id == booking.id,
                Message.sender_id != user_id,
                Message.is_read.is_(False),
            )
        ) or 0

        conversations.append(
            {
                "booking_id": str(booking.id),
                "other_user": {
                    "id": str(other_user.id),
                    "full_name": other_user.full_name,
                    "avatar_url": other_user.avatar_url,
                },
                "last_message": {
                    "content": latest_msg.content if latest_msg else None,
                    "created_at": latest_msg.created_at.isoformat() if latest_msg else None,
                } if latest_msg else None,
                "unread_count": unread_count,
                "booking_status": booking.status,
            }
        )

    # Sort: bookings with unread first, then by latest message time
    conversations.sort(
        key=lambda c: (
            -(c["unread_count"] or 0),
            -(c["last_message"]["created_at"] or "" if c["last_message"] else ""),
        )
    )
    return conversations


@router.get("/{booking_id}")
async def get_messages(
    booking_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Check if user is part of the booking
    booking_res = await db.execute(
        select(Booking).where(
            Booking.id == booking_id,
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
        )
    )
    booking = booking_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=403, detail="Not authorized to view these messages"
        )

    # Mark messages as read
    await db.execute(
        update(Message)
        .where(Message.booking_id == booking_id, Message.sender_id != user_id)
        .values(is_read=True)
    )
    await db.commit()

    # Fetch all messages
    messages_res = await db.execute(
        select(Message)
        .where(Message.booking_id == booking_id)
        .order_by(Message.created_at.asc())
    )
    messages = []
    for msg in messages_res.scalars().all():
        messages.append(
            {
                "id": str(msg.id),
                "booking_id": str(msg.booking_id),
                "sender_id": str(msg.sender_id),
                "content": msg.content,
                "translated_content": msg.translated_content,
                "voice_note_url": msg.voice_note_url,
                "is_read": msg.is_read,
                "created_at": msg.created_at,
            }
        )
    return messages


@router.post("/{booking_id}")
async def send_message(
    booking_id: UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    user_id = UUID(current_user["sub"])

    # Check if user is part of the booking
    booking_res = await db.execute(
        select(Booking).where(
            Booking.id == booking_id,
            or_(Booking.client_id == user_id, Booking.artisan_id == user_id),
        )
    )
    booking = booking_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(
            status_code=403, detail="Not authorized to send messages in this booking"
        )

    message = Message(
        booking_id=booking_id,
        sender_id=user_id,
        content=payload.content,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return {
        "id": str(message.id),
        "booking_id": str(message.booking_id),
        "sender_id": str(message.sender_id),
        "content": message.content,
        "translated_content": message.translated_content,
        "voice_note_url": message.voice_note_url,
        "is_read": message.is_read,
        "created_at": message.created_at,
    }


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
