"""
Socket.IO manager for HandyRwanda.

Two namespaces:
  /notifications  - per-user notification push
  /messages       - per-booking real-time chat

Architecture:
  - python-socketio 5.x AsyncServer (ASGI mode).
  - Namespace handlers use the class-based on_<event> method pattern
    (the @ns.on() decorator is NOT available in v5.x AsyncNamespace).
  - Rooms:  notifications → "user:{user_id}"
            messages      → "booking:{booking_id}"
  - Auth:   JWT passed in Socket.IO handshake `auth` dict — never in URL.
  - CORS:   FastAPI CORSMiddleware runs first; sio allows all origins.

Broadcast helpers (used by routers):
    await push_notification(user_id, data)
    await broadcast_message(booking_id, data)
"""

from __future__ import annotations

import logging
import os
from typing import Any

import socketio

_log = logging.getLogger(__name__)

# ── Socket.IO async server ────────────────────────────────────────────────────

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
    transports=["websocket", "polling"],
    ping_interval=25,
    ping_timeout=60,
    allow_upgrades=True,
    max_http_buffer_size=1_000_000,
)


# ── JWT helper ────────────────────────────────────────────────────────────────


def _decode_token(token: str | None) -> dict[str, Any] | None:
    """Decode and validate a JWT; returns payload or None on failure."""
    if not token:
        return None
    try:
        from jose import JWTError, jwt  # noqa: PLC0415

        secret = os.getenv("JWT_SECRET", "")
        payload: dict[str, Any] = jwt.decode(token, secret, algorithms=["HS256"])
        return payload
    except (Exception,):  # JWTError and any jose import error
        return None


def _extract_qs_token(environ: dict[str, Any]) -> str | None:
    """Extract JWT from ASGI query string as a fallback."""
    qs: str = environ.get("QUERY_STRING", "") or ""
    for part in qs.split("&"):
        if part.startswith("token="):
            return part[len("token="):]
    return None


# ════════════════════════════════════════════════════════════════════════════
# /notifications  namespace  (class-based — required by python-socketio 5.x)
# ════════════════════════════════════════════════════════════════════════════


class NotificationsNamespace(socketio.AsyncNamespace):
    """
    Per-user notification push.

    On connect the client must supply  auth={"token": "<jwt>"}.
    The server joins the socket to room "user:{user_id}" and emits
    "notification" events whenever push_notification() is called.
    """

    async def on_connect(
        self,
        sid: str,
        environ: dict[str, Any],
        auth: dict[str, Any] | None = None,
    ) -> bool:
        token = (auth or {}).get("token") or _extract_qs_token(environ)
        payload = _decode_token(token)
        if not payload:
            _log.warning("notifications: rejected unauthenticated connect sid=%s", sid)
            return False

        user_id = str(payload.get("sub", ""))
        if not user_id:
            return False

        await self.save_session(sid, {"user_id": user_id})
        await self.enter_room(sid, f"user:{user_id}")
        _log.debug("notifications: sid=%s joined room user:%s", sid, user_id)
        await self.emit("connected", {"user_id": user_id}, to=sid)
        return True

    async def on_disconnect(self, sid: str) -> None:
        session = await self.get_session(sid)
        user_id = (session or {}).get("user_id", "unknown")
        _log.debug("notifications: sid=%s (user:%s) disconnected", sid, user_id)

    async def on_ping(self, sid: str) -> None:  # noqa: ARG002
        """Client keepalive — respond with pong."""
        await self.emit("pong", {}, to=sid)


# ════════════════════════════════════════════════════════════════════════════
# /messages  namespace
# ════════════════════════════════════════════════════════════════════════════


class MessagesNamespace(socketio.AsyncNamespace):
    """
    Per-booking real-time chat.

    On connect the client supplies auth={"token": "<jwt>", "booking_id": "<uuid>"}.
    It can also emit "join" events to switch booking rooms without reconnecting.
    The server broadcasts "message" events whenever broadcast_message() is called.
    """

    async def on_connect(
        self,
        sid: str,
        environ: dict[str, Any],
        auth: dict[str, Any] | None = None,
    ) -> bool:
        token = (auth or {}).get("token") or _extract_qs_token(environ)
        payload = _decode_token(token)
        if not payload:
            _log.warning("messages: rejected unauthenticated connect sid=%s", sid)
            return False

        user_id = str(payload.get("sub", ""))
        booking_id = str((auth or {}).get("booking_id", ""))

        if not user_id:
            return False

        await self.save_session(sid, {"user_id": user_id, "booking_id": booking_id})

        if booking_id:
            await self.enter_room(sid, f"booking:{booking_id}")
            _log.debug("messages: sid=%s joined booking:%s", sid, booking_id)
            await self.emit("connected", {"booking_id": booking_id}, to=sid)

        return True

    async def on_join(self, sid: str, data: dict[str, Any]) -> None:
        """Client emits 'join' with {booking_id} to subscribe to a booking room."""
        booking_id = str(data.get("booking_id", ""))
        if not booking_id:
            return

        session = await self.get_session(sid)
        old_booking = (session or {}).get("booking_id", "")
        if old_booking and old_booking != booking_id:
            await self.leave_room(sid, f"booking:{old_booking}")

        await self.save_session(sid, {**(session or {}), "booking_id": booking_id})
        await self.enter_room(sid, f"booking:{booking_id}")
        await self.emit("joined", {"booking_id": booking_id}, to=sid)
        _log.debug("messages: sid=%s joined booking:%s", sid, booking_id)

    async def on_leave(self, sid: str, data: dict[str, Any]) -> None:
        booking_id = str(data.get("booking_id", ""))
        if booking_id:
            await self.leave_room(sid, f"booking:{booking_id}")

    async def on_disconnect(self, sid: str) -> None:
        session = await self.get_session(sid)
        _log.debug("messages: sid=%s disconnected session=%s", sid, session)

    async def on_ping(self, sid: str) -> None:  # noqa: ARG002
        await self.emit("pong", {}, to=sid)


# ── Register namespaces ───────────────────────────────────────────────────────

sio.register_namespace(NotificationsNamespace("/notifications"))
sio.register_namespace(MessagesNamespace("/messages"))


# ── Broadcast helpers ─────────────────────────────────────────────────────────


async def push_notification(user_id: str, data: dict[str, Any]) -> None:
    """Push a notification event to all sessions of a user."""
    await sio.emit(
        "notification",
        {"type": "notification", "data": data},
        room=f"user:{user_id}",
        namespace="/notifications",
    )


async def broadcast_message(booking_id: str, data: dict[str, Any]) -> None:
    """Broadcast a new message to all participants in a booking room."""
    await sio.emit(
        "message",
        data,
        room=f"booking:{booking_id}",
        namespace="/messages",
    )


# ── Combined ASGI app ─────────────────────────────────────────────────────────


def create_combined_asgi(fastapi_app: Any) -> Any:
    """
    Wrap FastAPI app with Socket.IO ASGI middleware.
    Uvicorn should serve the returned object (app.main:application).
    """
    return socketio.ASGIApp(
        sio,
        other_asgi_app=fastapi_app,
        socketio_path="/socket.io",
    )
