# File: backend/app/integrations/upstash.py
"""
Upstash Redis integration with in-memory fallback for local dev.
When UPSTASH_REDIS_REST_URL is not set, all operations use a simple dict.
"""

import os
import time
from typing import Any

import httpx

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

# In-memory fallback store: { key: (value, expires_at) }
_local_store: dict[str, tuple[str, float]] = {}


def _use_local() -> bool:
    return not UPSTASH_URL or not UPSTASH_TOKEN


async def redis_set(key: str, value: str, ttl_seconds: int) -> None:
    if _use_local():
        _local_store[key] = (value, time.time() + ttl_seconds)
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{UPSTASH_URL}/set/{key}/{value}/ex/{ttl_seconds}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
        )


async def redis_get(key: str) -> str | None:
    if _use_local():
        entry = _local_store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            del _local_store[key]
            return None
        return value
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{UPSTASH_URL}/get/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
        )
        data: dict[str, Any] = r.json()
        result = data.get("result")
        return str(result) if result is not None else None


async def redis_del(key: str) -> None:
    if _use_local():
        _local_store.pop(key, None)
        return
    async with httpx.AsyncClient() as client:
        await client.get(
            f"{UPSTASH_URL}/del/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"},
        )
