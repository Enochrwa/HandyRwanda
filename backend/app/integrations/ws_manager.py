"""
ws_manager.py — Legacy compatibility shim.

The real-time layer has been migrated from raw WebSockets to Socket.IO.
This module now re-exports the Socket.IO push helpers under the original
API so existing callers (notifications router, etc.) require zero changes.

Original API:
    notification_manager.push(user_id, data)   →  push_notification(user_id, data)
    notification_manager.active_user_count()   →  sio connected count

All new code should import directly from socket_manager.
"""

from __future__ import annotations

import logging
from typing import Any

from app.integrations.socket_manager import push_notification, sio

_log = logging.getLogger(__name__)


class _SocketIONotificationManager:
    """
    Drop-in replacement for the old NotificationManager.
    Delegates to Socket.IO under the hood.
    """

    async def connect(self, user_id: str, ws: Any) -> None:  # noqa: ARG002
        """No-op: Socket.IO manages connections internally."""

    async def disconnect(self, user_id: str, ws: Any) -> None:  # noqa: ARG002
        """No-op: Socket.IO manages disconnects internally."""

    async def push(self, user_id: str, data: dict[str, Any]) -> None:
        """Push notification to all sessions for user_id."""
        await push_notification(str(user_id), data)

    def active_user_count(self) -> int:
        """Return approximate connected socket count across all namespaces."""
        try:
            return len(sio.manager.rooms.get("/notifications", {}).get("", set()))
        except Exception:
            return 0


# Singleton — matches original usage pattern
notification_manager = _SocketIONotificationManager()
