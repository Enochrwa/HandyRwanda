# File: backend/app/integrations/supabase_storage.py
"""
Supabase Storage integration.

Supports two upload modes:
1. Presigned URL (preferred): client uploads directly to Supabase Storage,
   bypassing the API server. Use generate_presigned_url() + confirm_upload().
2. Legacy base64 (fallback): backend receives base64, decodes and uploads.
   Use upload_image() for backwards compat.

Bucket policies expected:
  - READ:  public (anon can read)
  - WRITE: authenticated only (service-role key used server-side)
"""
import base64
import os
import uuid

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "artisan-media"

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB hard cap


def _public_url(path: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


async def generate_presigned_url(
    folder: str,
    content_type: str = "image/jpeg",
    filename: str | None = None,
) -> dict:
    """
    Ask Supabase to return a presigned upload URL.
    The client then uploads the file directly from the device.

    Returns:
      {
        "upload_url": "<presigned URL>",
        "path":       "<storage path>",
        "public_url": "<final public URL after upload>",
        "token":      "<upload token for confirmation>",
      }
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
            # Fallback: construct a signed URL manually via the standard method
            resp2 = await client.post(
                f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}",
                headers=headers,
                json={"expiresIn": 300},  # 5 minutes
            )
            if resp2.status_code in (200, 201):
                data = resp2.json()
                return {
                    "upload_url": f"{SUPABASE_URL}/storage/v1{data.get('signedURL', '')}",
                    "path": path,
                    "public_url": _public_url(path),
                    "token": data.get("token", ""),
                }
            resp.raise_for_status()

        data = resp.json()
        signed_url = data.get("url", data.get("signedURL", ""))
        token = data.get("token", "")
        return {
            "upload_url": f"{SUPABASE_URL}/storage/v1{signed_url}" if signed_url.startswith("/") else signed_url,
            "path": path,
            "public_url": _public_url(path),
            "token": token,
        }


async def upload_image(
    base64_data: str, folder: str, filename: str | None = None
) -> str:
    """
    Upload base64-encoded image to Supabase Storage.
    Validates size before uploading (rejects > 5 MB).
    Returns public URL.

    NOTE: Prefer presigned URL flow for production. This exists for
    backwards compatibility and small payloads.
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
    """Delete an image from storage by its path. Returns True on success."""
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
