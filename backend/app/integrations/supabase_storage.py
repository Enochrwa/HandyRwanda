import base64
import os
import uuid

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = "artisan-media"


async def upload_image(base64_data: str, folder: str, filename: str = None) -> str:
    """Upload base64 image to Supabase Storage. Returns public URL."""
    if not filename:
        filename = f"{uuid.uuid4()}.jpg"
    path = f"{folder}/{filename}"

    if "," in base64_data:
        base64_data = base64_data.rsplit(",", maxsplit=1)[-1]

    image_bytes = base64.b64decode(base64_data)
    headers = {
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers=headers,
            content=image_bytes,
        )
        resp.raise_for_status()

    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"
