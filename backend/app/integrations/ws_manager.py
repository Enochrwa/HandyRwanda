# File: backend/app/integrations/ws_manager.py
"""
WebSocket connection manager for real-time notifications.

Maintains per-user WebSocket connections so notifications are pushed
immediately rather than polling every 30 seconds.

Usage:
    # In main.py WebSocket endpoint:
    await notification_manager.connect(user_id, websocket)

    # When creating a notification anywhere:
    await notification_manager.push(user_id, notification_dict)
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket


class NotificationManager:
    """Thread-safe per-user WebSocket pool for real-time notification delivery."""

    def __init__(self) -> None:
        # user_id (str) → list of active WebSocket connections
        self._connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.setdefault(user_id, []).append(ws)

    async def disconnect(self, user_id: str, ws: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(user_id, [])
            if ws in conns:
                conns.remove(ws)
            if not conns:
                self._connections.pop(user_id, None)

    async def push(self, user_id: str, data: dict[str, Any]) -> None:
        """Push a notification to all connected WebSocket sessions for a user."""
        conns = list(self._connections.get(str(user_id), []))
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        # Clean up dead connections
        if dead:
            async with self._lock:
                live = self._connections.get(str(user_id), [])
                self._connections[str(user_id)] = [w for w in live if w not in dead]

    def active_user_count(self) -> int:
        return len(self._connections)


# Singleton instance
notification_manager = NotificationManager()
