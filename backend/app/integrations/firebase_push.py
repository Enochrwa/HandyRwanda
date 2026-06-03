# File: backend/app/integrations/firebase_push.py
"""
Firebase Cloud Messaging (FCM) push notification integration.

Used for Android (via google-services.json) and iOS (via GoogleService-Info.plist).
Falls back to Expo push if FCM token is not available.

Env vars required:
  FIREBASE_SERVICE_ACCOUNT_JSON  — full service account JSON string (for server-side auth)
  or
  FIREBASE_SERVER_KEY             — legacy FCM server key (for HTTP v1 fallback)
"""
import json
import os
from typing import Any

import httpx

FIREBASE_SERVER_KEY = os.getenv("FIREBASE_SERVER_KEY", "")
FIREBASE_SA_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
FCM_LEGACY_URL = "https://fcm.googleapis.com/fcm/send"
FCM_V1_URL_TEMPLATE = (
    "https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
)

_access_token_cache: dict[str, Any] = {}


async def _get_oauth2_token() -> str | None:
    """Get an OAuth2 access token for FCM HTTP v1 API using service account."""
    if not FIREBASE_SA_JSON:
        return None

    try:
        import time

        now = time.time()
        cached = _access_token_cache.get("token")
        exp = _access_token_cache.get("exp", 0)
        if cached and now < exp - 60:
            return str(cached)

        sa = json.loads(FIREBASE_SA_JSON)
        import base64
        import hashlib
        import hmac

        # Build JWT for service account auth
        header = base64.urlsafe_b64encode(
            json.dumps({"alg": "RS256", "typ": "JWT"}).encode()
        ).rstrip(b"=").decode()

        payload_data = {
            "iss": sa["client_email"],
            "scope": "https://www.googleapis.com/auth/firebase.messaging",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": int(now),
            "exp": int(now) + 3600,
        }
        payload = base64.urlsafe_b64encode(
            json.dumps(payload_data).encode()
        ).rstrip(b"=").decode()

        signing_input = f"{header}.{payload}".encode()

        # Use google-auth if available
        try:
            from google.oauth2 import service_account  # type: ignore
            from google.auth.transport.requests import Request  # type: ignore

            credentials = service_account.Credentials.from_service_account_info(
                sa,
                scopes=["https://www.googleapis.com/auth/firebase.messaging"],
            )
            credentials.refresh(Request())
            token = credentials.token
            _access_token_cache["token"] = token
            _access_token_cache["exp"] = now + 3600
            return str(token)
        except ImportError:
            # google-auth not installed, use legacy key
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
    """
    Send a push notification via FCM.
    Supports both legacy HTTP API and HTTP v1 API.
    Returns True on success, False otherwise. Never raises.
    """
    if not fcm_token:
        return False

    if not FIREBASE_SERVER_KEY and not FIREBASE_SA_JSON:
        return False

    notification_payload: dict[str, Any] = {
        "title": title,
        "body": body,
    }
    if image_url:
        notification_payload["image"] = image_url

    data_payload: dict[str, str] = {k: str(v) for k, v in (data or {}).items()}

    try:
        # Try HTTP v1 first (preferred)
        oauth_token = await _get_oauth2_token()
        if oauth_token and FIREBASE_SA_JSON:
            sa = json.loads(FIREBASE_SA_JSON)
            project_id = sa.get("project_id", "")
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

        # Fallback to legacy
        if FIREBASE_SERVER_KEY:
            headers = {
                "Authorization": f"key={FIREBASE_SERVER_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "to": fcm_token,
                "notification": notification_payload,
                "data": data_payload,
                "priority": "high",
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(FCM_LEGACY_URL, headers=headers, json=payload)
                result = resp.json()
                return result.get("success", 0) == 1

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
    """
    Look up user's FCM token from DB and send push notification.
    Falls back to Expo push if no FCM token but expo token exists.
    """
    from sqlalchemy import select  # noqa: PLC0415
    from app.models.user import User  # noqa: PLC0415

    user = await db_session.scalar(select(User).where(User.id == user_id))
    if not user:
        return False

    fcm_sent = False
    if getattr(user, "fcm_push_token", None):
        fcm_sent = await send_fcm_push(
            user.fcm_push_token, title, body, data  # type: ignore
        )

    if not fcm_sent and getattr(user, "expo_push_token", None):
        from app.integrations.expo_push import send_push  # noqa: PLC0415
        return await send_push(
            user.expo_push_token,  # type: ignore
            title,
            body,
            {k: v for k, v in (data or {}).items()},
        )

    return fcm_sent
