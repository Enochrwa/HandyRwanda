# File: backend/app/integrations/expo_push.py
"""
Expo Push Notification integration.

Sends push notifications to mobile devices via Expo's push service.
Requires EXPO_ACCESS_TOKEN for production priority delivery.
Silently no-ops if the token is missing or the device token is None.

Docs: https://docs.expo.dev/push-notifications/sending-notifications/
"""
import os
from typing import Any

import httpx

EXPO_ACCESS_TOKEN = os.getenv("EXPO_ACCESS_TOKEN", "")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push(
    expo_push_token: str | None,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    sound: str = "default",
) -> bool:
    """
    Send a push notification to a single device.
    Returns True if successfully dispatched, False otherwise.
    Never raises — push failure must not break the main flow.
    """
    if not expo_push_token:
        return False
    if not expo_push_token.startswith("ExponentPushToken["):
        return False

    payload: dict[str, Any] = {
        "to": expo_push_token,
        "title": title,
        "body": body,
        "sound": sound,
        "data": data or {},
    }

    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
    }
    if EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {EXPO_ACCESS_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(EXPO_PUSH_URL, json=payload, headers=headers)
            result: dict[str, Any] = resp.json()
            status: str = result.get("data", {}).get("status", "")
            return status == "ok"
    except Exception:
        return False


async def send_push_to_user(
    db_session: Any,
    user_id: Any,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> bool:
    """Look up a user's Expo push token from the DB then dispatch the notification."""
    # Local imports to avoid circular dependency at module load time
    from sqlalchemy import select  # noqa: PLC0415

    from app.models.user import User  # noqa: PLC0415

    token = await db_session.scalar(
        select(User.expo_push_token).where(User.id == user_id)
    )
    return await send_push(token, title, body, data)
