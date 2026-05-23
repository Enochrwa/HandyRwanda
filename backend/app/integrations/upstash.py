import os
from typing import Any

import httpx

UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

async def redis_set(key: str, value: str, ttl_seconds: int) -> None:
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{UPSTASH_URL}/set/{key}/{value}/ex/{ttl_seconds}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"}
        )

async def redis_get(key: str) -> str | None:
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{UPSTASH_URL}/get/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"}
        )
        data: dict[str, Any] = r.json()
        result = data.get("result")
        return str(result) if result is not None else None

async def redis_del(key: str) -> None:
    async with httpx.AsyncClient() as client:
        await client.get(
            f"{UPSTASH_URL}/del/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_TOKEN}"}
        )
