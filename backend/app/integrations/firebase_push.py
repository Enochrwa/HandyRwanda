# File: backend/app/integrations/firebase_push.py
"""
Firebase Cloud Messaging (FCM) push notification integration.

Env vars:
  FIREBASE_SERVICE_ACCOUNT_JSON  — full service account JSON string
  FIREBASE_SERVER_KEY             — legacy FCM server key (fallback)
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import httpx

FIREBASE_SERVER_KEY = os.getenv("FIREBASE_SERVER_KEY", "")
FIREBASE_SA_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
FCM_LEGACY_URL = "https://fcm.googleapis.com/fcm/send"
FCM_V1_URL_TEMPLATE = (
    "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
)

_access_token_cache: dict[str, Any] = {}

# Optional google-auth support for FCM HTTP v1 API.
# Installed via: pip install google-auth
try:
    from google.auth.transport.requests import Request as _GoogleRequest
    from google.oauth2 import service_account as _google_sa

    _HAS_GOOGLE_AUTH = True
except ImportError:
    _HAS_GOOGLE_AUTH = False


def _google_sa_credentials(sa_info: dict[str, Any]) -> Any | None:
    """Return refreshed google-auth credentials or None if not available."""
    if not _HAS_GOOGLE_AUTH:
        return None
    credentials = _google_sa.Credentials.from_service_account_info(
        sa_info,
        scopes=["https://www.googleapis.com/auth/firebase.messaging"],
    )
    credentials.refresh(_GoogleRequest())
    return credentials


async def _get_oauth2_token() -> str | None:
    """Get OAuth2 access token for FCM HTTP v1 API using service account."""
    if not FIREBASE_SA_JSON:
        return None
    try:
        now = time.time()
        cached = _access_token_cache.get("token")
        exp = float(_access_token_cache.get("exp", 0))
        if cached and now < exp - 60:
            return str(cached)

        sa: dict[str, Any] = json.loads(FIREBASE_SA_JSON)
        try:
            credentials = _google_sa_credentials(sa)
            if credentials is None:
                return None
            token: str = credentials.token
            _access_token_cache["token"] = token
            _access_token_cache["exp"] = now + 3600
            return token
        except Exception:
            return None
    except Exception:
        return None


async def send_fcm_push(
    fcm_token: str | None,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
    image_url: str | None = None,
) -> bool:
    """Send push notification via FCM. Returns True on success, never raises."""
    if not fcm_token:
        return False
    if not FIREBASE_SERVER_KEY and not FIREBASE_SA_JSON:
        return False

    notification_payload: dict[str, str] = {"title": title, "body": body}
    if image_url:
        notification_payload["image"] = image_url

    data_payload: dict[str, str] = {k: str(v) for k, v in (data or {}).items()}

    try:
        oauth_token = await _get_oauth2_token()
        if oauth_token and FIREBASE_SA_JSON:
            sa: dict[str, Any] = json.loads(FIREBASE_SA_JSON)
            project_id: str = sa.get("project_id", "")
            url = FCM_V1_URL_TEMPLATE.format(project_id=project_id)
            headers = {
                "Authorization": f"Bearer {oauth_token}",
                "Content-Type": "application/json",
            }
            message: dict[str, Any] = {
                "message": {
                    "token": fcm_token,
                    "notification": notification_payload,
                    "data": data_payload,
                    "android": {
                        "notification": {
                            "channel_id": "default",
                            "notification_priority": "PRIORITY_HIGH",
                            "sound": "default",
                        }
                    },
                    "apns": {
                        "payload": {
                            "aps": {
                                "alert": {"title": title, "body": body},
                                "sound": "default",
                                "badge": 1,
                            }
                        }
                    },
                }
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, headers=headers, json=message)
                return resp.status_code == 200

        if FIREBASE_SERVER_KEY:
            headers_legacy = {
                "Authorization": f"key={FIREBASE_SERVER_KEY}",
                "Content-Type": "application/json",
            }
            legacy_payload: dict[str, Any] = {
                "to": fcm_token,
                "notification": notification_payload,
                "data": data_payload,
                "priority": "high",
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    FCM_LEGACY_URL, headers=headers_legacy, json=legacy_payload
                )
                result: dict[str, Any] = resp.json()
                success: int = result.get("success", 0)
                return success == 1
    except Exception:
        pass
    return False


async def send_push_to_user_fcm(
    db_session: Any,
    user_id: Any,
    title: str,
    body: str,
    data: dict[str, str] | None = None,
) -> bool:
    """Look up user's FCM token from DB and send push notification."""
    from sqlalchemy import select  # noqa: PLC0415

    from app.models.user import User  # noqa: PLC0415

    user = await db_session.scalar(select(User).where(User.id == user_id))
    if not user:
        return False

    fcm_sent = False
    fcm_token: str | None = getattr(user, "fcm_push_token", None)
    if fcm_token:
        fcm_sent = await send_fcm_push(fcm_token, title, body, data)

    if not fcm_sent:
        expo_token: str | None = getattr(user, "expo_push_token", None)
        if expo_token:
            from app.integrations.expo_push import send_push  # noqa: PLC0415

            return bool(await send_push(expo_token, title, body, data or {}))

    return fcm_sent
