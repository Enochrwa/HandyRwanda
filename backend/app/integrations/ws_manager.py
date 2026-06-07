"""
ws_manager.py

Provides two things:

1. NotificationManager  — A concrete in-memory WebSocket manager.
   Tests import and instantiate this class directly to verify connect /
   disconnect / push behaviour without a running Socket.IO server.

2. notification_manager — The production singleton.  In production it
   delegates every push to Socket.IO via push_notification().  It exposes
   the same NotificationManager interface so all existing call-sites
   (routers, etc.) require zero changes.

The split keeps the test surface clean (pure in-memory, no Socket.IO
dependency) while production still uses Socket.IO end-to-end.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

# Socket.IO push helper — imported at module level to satisfy ruff isort.
# socket_manager has no dependency on ws_manager so there is no circular import.
from app.integrations.socket_manager import push_notification, sio

_log = logging.getLogger(__name__)


# ── In-memory implementation (used directly by tests) ────────────────────────


class NotificationManager:
    """
    Thread-safe per-user connection pool for real-time notification delivery.

    This is the original raw-WebSocket manager, kept as the public class so
    tests can import and instantiate it without any Socket.IO machinery.

    In production the module-level `notification_manager` singleton wraps
    this class but overrides `push` to also emit via Socket.IO.
    """

    def __init__(self) -> None:
        self._connections: dict[str, list[Any]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: Any) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.setdefault(user_id, []).append(ws)

    async def disconnect(self, user_id: str, ws: Any) -> None:
        async with self._lock:
            conns = self._connections.get(user_id, [])
            if ws in conns:
                conns.remove(ws)
            if not conns:
                self._connections.pop(user_id, None)

    async def push(self, user_id: str, data: dict[str, Any]) -> None:
        """Push to all connected WebSocket sessions for user_id."""
        conns = list(self._connections.get(str(user_id), []))
        dead: list[Any] = []
        for ws in conns:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                live = self._connections.get(str(user_id), [])
                self._connections[str(user_id)] = [w for w in live if w not in dead]

    def active_user_count(self) -> int:
        return len(self._connections)


# ── Production singleton — delegates push to Socket.IO ───────────────────────


class _ProductionNotificationManager(NotificationManager):
    """
    Extends NotificationManager so that push() ALSO emits via Socket.IO,
    reaching clients that connected through the /notifications namespace.

    The in-memory WebSocket pool (parent class) is kept as a no-op layer;
    all real-time delivery goes through Socket.IO in production.
    """

    async def push(self, user_id: str, data: dict[str, Any]) -> None:
        # Delegate to Socket.IO (fire-and-forget — never blocks callers)
        try:
            await push_notification(str(user_id), data)
        except Exception as exc:
            _log.warning("socket push failed for user %s: %s", user_id, exc)

    def active_user_count(self) -> int:
        """Return connected socket count in the /notifications namespace."""
        try:
            rooms = sio.manager.rooms.get("/notifications", {})
            sids = {sid for room, sids in rooms.items() if room != "" for sid in sids}
            return len(sids)
        except Exception:
            return 0


# Singleton used by all routers and other modules
notification_manager = _ProductionNotificationManager()
