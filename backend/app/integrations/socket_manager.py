"""
Socket.IO manager for HandyRwanda.

Provides two namespaces:
  /notifications  - per-user notification push
  /messages       - per-booking real-time chat

Architecture:
  - Uses python-socketio AsyncServer (ASGI mode) mounted via socketio.ASGIApp
  - Rooms:    notifications → "user:{user_id}"
              messages      → "booking:{booking_id}"
  - Auth:     JWT token passed in `auth` during handshake (best practice —
              avoids token leakage in URL paths used by raw WS)
  - CORS:     delegated to FastAPI CORSMiddleware; sio allows all origins
              (FastAPI middleware runs first)

Usage (from other routers/services):
    from app.integrations.socket_manager import sio

    # Push a notification to a user
    await sio.emit(
        "notification",
        {"type": "notification", "data": {...}},
        room=f"user:{user_id}",
        namespace="/notifications",
    )

    # Broadcast a message to a booking room
    await sio.emit(
        "message",
        message_dict,
        room=f"booking:{booking_id}",
        namespace="/messages",
    )
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
    cors_allowed_origins="*",          # FastAPI CORS MW handles origin policy
    logger=False,
    engineio_logger=False,
    # Prefer websocket transport; fall back to polling automatically
    # (essential for React Native where some networks block WS upgrades)
    transports=["websocket", "polling"],
    ping_interval=25,
    ping_timeout=60,
    # Allow the client to re-attach after a brief network drop
    allow_upgrades=True,
    max_http_buffer_size=1_000_000,    # 1 MB — sufficient for all payloads
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
    except JWTError:
        return None


# ════════════════════════════════════════════════════════════════════════════
# /notifications  namespace
# ════════════════════════════════════════════════════════════════════════════

notif_ns = socketio.AsyncNamespace("/notifications")


@notif_ns.on("connect")
async def notif_connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None = None) -> bool:
    """
    Authenticate the client and join their personal room.

    Auth payload expected:  { "token": "<jwt>" }
    The client can also fall back to query param: ?token=<jwt>
    """
    token = (auth or {}).get("token") or _extract_qs_token(environ)
    payload = _decode_token(token)
    if not payload:
        _log.warning("notifications: rejected unauthenticated connect sid=%s", sid)
        return False  # Reject connection

    user_id = str(payload.get("sub", ""))
    if not user_id:
        return False

    await notif_ns.save_session(sid, {"user_id": user_id})
    await notif_ns.enter_room(sid, f"user:{user_id}")
    _log.debug("notifications: sid=%s joined room user:%s", sid, user_id)
    # Acknowledge successful connection with server info
    await notif_ns.emit("connected", {"user_id": user_id}, to=sid)
    return True


@notif_ns.on("disconnect")
async def notif_disconnect(sid: str) -> None:
    session = await notif_ns.get_session(sid)
    user_id = (session or {}).get("user_id", "unknown")
    _log.debug("notifications: sid=%s (user:%s) disconnected", sid, user_id)


@notif_ns.on("ping")
async def notif_ping(sid: str) -> None:
    """Client-side keepalive — respond with pong."""
    await notif_ns.emit("pong", {}, to=sid)


sio.register_namespace(notif_ns)


# ════════════════════════════════════════════════════════════════════════════
# /messages  namespace
# ════════════════════════════════════════════════════════════════════════════

msg_ns = socketio.AsyncNamespace("/messages")


@msg_ns.on("connect")
async def msg_connect(sid: str, environ: dict[str, Any], auth: dict[str, Any] | None = None) -> bool:
    """
    Authenticate and hold sid until the client emits 'join'.
    Auth payload expected:  { "token": "<jwt>", "booking_id": "<uuid>" }
    """
    token = (auth or {}).get("token") or _extract_qs_token(environ)
    payload = _decode_token(token)
    if not payload:
        _log.warning("messages: rejected unauthenticated connect sid=%s", sid)
        return False

    user_id = str(payload.get("sub", ""))
    booking_id = (auth or {}).get("booking_id", "")

    if not user_id:
        return False

    await msg_ns.save_session(sid, {"user_id": user_id, "booking_id": booking_id})

    if booking_id:
        await msg_ns.enter_room(sid, f"booking:{booking_id}")
        _log.debug("messages: sid=%s joined booking:%s", sid, booking_id)
        await msg_ns.emit("connected", {"booking_id": booking_id}, to=sid)

    return True


@msg_ns.on("join")
async def msg_join(sid: str, data: dict[str, Any]) -> None:
    """
    Client emits 'join' with { booking_id } to subscribe to a booking room.
    Allows switching rooms without reconnecting.
    """
    booking_id = str(data.get("booking_id", ""))
    if not booking_id:
        return

    session = await msg_ns.get_session(sid)
    # Leave old room if present
    old_booking = (session or {}).get("booking_id", "")
    if old_booking and old_booking != booking_id:
        await msg_ns.leave_room(sid, f"booking:{old_booking}")

    await msg_ns.save_session(sid, {**(session or {}), "booking_id": booking_id})
    await msg_ns.enter_room(sid, f"booking:{booking_id}")
    await msg_ns.emit("joined", {"booking_id": booking_id}, to=sid)
    _log.debug("messages: sid=%s joined booking:%s", sid, booking_id)


@msg_ns.on("leave")
async def msg_leave(sid: str, data: dict[str, Any]) -> None:
    booking_id = str(data.get("booking_id", ""))
    if booking_id:
        await msg_ns.leave_room(sid, f"booking:{booking_id}")


@msg_ns.on("disconnect")
async def msg_disconnect(sid: str) -> None:
    session = await msg_ns.get_session(sid)
    _log.debug("messages: sid=%s disconnected, session=%s", sid, session)


@msg_ns.on("ping")
async def msg_ping(sid: str) -> None:
    await msg_ns.emit("pong", {}, to=sid)


sio.register_namespace(msg_ns)


# ════════════════════════════════════════════════════════════════════════════
# Convenience broadcast helpers (used by other routers)
# ════════════════════════════════════════════════════════════════════════════

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


# ── Utility ───────────────────────────────────────────────────────────────────

def _extract_qs_token(environ: dict[str, Any]) -> str | None:
    """
    Extract JWT from ASGI query string as a fallback for clients that cannot
    set Socket.IO auth (e.g. some React Native environments).
    """
    qs: str = environ.get("QUERY_STRING", "") or ""
    for part in qs.split("&"):
        if part.startswith("token="):
            return part[len("token="):]
    return None


# ── ASGI app wrapping FastAPI ─────────────────────────────────────────────────

def create_combined_asgi(fastapi_app: Any) -> Any:
    """
    Wrap FastAPI app with Socket.IO ASGI middleware.

    The returned app is what uvicorn should serve.
    Socket.IO handles /socket.io/* paths; everything else is forwarded to FastAPI.
    """
    return socketio.ASGIApp(
        sio,
        other_asgi_app=fastapi_app,
        socketio_path="/socket.io",
    )
