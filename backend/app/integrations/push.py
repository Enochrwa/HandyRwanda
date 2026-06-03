# File: backend/app/integrations/push.py
"""
Unified push notification dispatcher.

Priority: FCM (Android/iOS native) → Expo push (Expo Go / managed workflow)
Both can coexist on the same user account.
"""
from typing import Any


async def send_push_notification(
    db_session: Any,
    user_id: Any,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> bool:
    """
    Send a push notification to a user via the best available channel.
    Also checks notification preferences before sending.
    Never raises.
    """
    import json  # noqa: PLC0415
    from sqlalchemy import select  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415

    try:
        user = await db_session.scalar(select(User).where(User.id == user_id))
        if not user:
            return False

        # Check notification preferences
        event_type = (data or {}).get("event_type", "")
        if user.notification_prefs:
            try:
                prefs = json.loads(user.notification_prefs)
                # Map event types to preference keys
                pref_map = {
                    "new_bid": "new_bid",
                    "bid_accepted": "booking_update",
                    "booking_confirmed": "booking_update",
                    "payment_sent": "payment",
                    "payment_approved": "payment",
                    "job_started": "booking_update",
                    "job_completed": "booking_update",
                    "new_message": "message",
                    "dispute_opened": "booking_update",
                }
                pref_key = pref_map.get(event_type, "")
                if pref_key and not prefs.get(pref_key, True):
                    return False  # User opted out
            except Exception:
                pass

        sent = False

        # Try FCM first
        fcm_token = getattr(user, "fcm_push_token", None)
        if fcm_token:
            from app.integrations.firebase_push import send_fcm_push  # noqa: PLC0415
            sent = await send_fcm_push(fcm_token, title, body, data)

        # Fallback to Expo
        if not sent:
            expo_token = getattr(user, "expo_push_token", None)
            if expo_token:
                from app.integrations.expo_push import send_push  # noqa: PLC0415
                sent = await send_push(expo_token, title, body, data)

        return sent
    except Exception:
        return False
