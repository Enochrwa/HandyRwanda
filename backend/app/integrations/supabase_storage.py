# File: backend/app/integrations/supabase_storage.py
"""
Supabase Storage integration.

Supports two upload modes:
1. Presigned URL (preferred): client uploads directly to Supabase Storage,
   bypassing the API server.  Use generate_presigned_url().
2. Legacy base64 (fallback): backend receives base64, decodes and uploads.
   Use upload_image() for backwards compat.
"""

from __future__ import annotations

import base64
import os
import uuid

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "artisan-media"

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _public_url(path: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


async def generate_presigned_url(
    folder: str,
    content_type: str = "image/jpeg",
    filename: str | None = None,
) -> dict[str, str]:
    """
    Ask Supabase to return a presigned upload URL.
    Returns:
      { "upload_url": ..., "path": ..., "public_url": ..., "token": ... }
    """
    if not filename:
        filename = f"{uuid.uuid4()}.jpg"
    path = f"{folder}/{filename}"

    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/upload/sign/{BUCKET}/{path}",
            headers=headers,
            json={"upsert": True},
        )
        if resp.status_code not in (200, 201):
            # Fallback: use standard signed URL
            resp2 = await client.post(
                f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}",
                headers=headers,
                json={"expiresIn": 300},
            )
            if resp2.status_code in (200, 201):
                data: dict[str, str] = resp2.json()
                signed = data.get("signedURL", "")
                return {
                    "upload_url": (
                        f"{SUPABASE_URL}/storage/v1{signed}"
                        if signed.startswith("/")
                        else signed
                    ),
                    "path": path,
                    "public_url": _public_url(path),
                    "token": data.get("token", ""),
                }
            resp.raise_for_status()

        result: dict[str, str] = resp.json()
        signed_url = result.get("url", result.get("signedURL", ""))
        return {
            "upload_url": (
                f"{SUPABASE_URL}/storage/v1{signed_url}"
                if signed_url.startswith("/")
                else signed_url
            ),
            "path": path,
            "public_url": _public_url(path),
            "token": result.get("token", ""),
        }


async def upload_image(
    base64_data: str, folder: str, filename: str | None = None
) -> str:
    """
    Upload base64-encoded image to Supabase Storage.
    Validates size before uploading (rejects > 5 MB).
    Returns public URL.
    """
    if not filename:
        filename = f"{uuid.uuid4()}.jpg"
    path = f"{folder}/{filename}"

    if "," in base64_data:
        base64_data = base64_data.rsplit(",", maxsplit=1)[-1]

    image_bytes = base64.b64decode(base64_data)

    if len(image_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(
            f"Image too large: {len(image_bytes) / 1024 / 1024:.1f} MB. Max 5 MB."
        )

    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers=headers,
            content=image_bytes,
        )
        resp.raise_for_status()

    return _public_url(path)


async def delete_image(path: str) -> bool:
    """Delete an image from storage by its path."""
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers=headers,
        )
        return resp.status_code in (200, 204)
