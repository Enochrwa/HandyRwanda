# File: backend/app/routers/uploads.py
"""
Upload router — presigned URL generation for direct client-to-Supabase uploads.

Sprint 7 additions:
  - "voice_note" upload type → "voice-notes" folder
  - Audio MIME types: audio/m4a, audio/aac, audio/mp4, audio/webm
  - Voice notes get 10 MB max (vs 5 MB for images)
  - max_size_bytes is now per-type in the response

POST /uploads/presign   — get a presigned URL for a specific upload type
GET  /uploads/confirm   — confirm upload completed (returns final public URL)
"""

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies.jwt_auth import get_current_user
from app.integrations.supabase_storage import generate_presigned_url

router = APIRouter(prefix="/uploads", tags=["uploads"])

# ── Upload contexts mapped to storage folders ─────────────────────────────

ALLOWED_FOLDERS: dict[str, str] = {
    "avatar": "avatars",
    "portfolio": "portfolio-photos",
    "job_photo": "job-photos",
    "id_document": "id-documents",
    "selfie": "selfies",
    "payment_proof": "payment-proofs",
    "dispute_evidence": "dispute-evidence",
    "before_photo": "booking-photos/before",
    "after_photo": "booking-photos/after",
    # Sprint 7 — voice messages
    "voice_note": "voice-notes",
}

# Max file size per upload type (bytes)
MAX_SIZE_BYTES: dict[str, int] = {
    "voice_note": 10 * 1024 * 1024,  # 10 MB for audio
}
DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB for everything else

# ── Allowed MIME types ────────────────────────────────────────────────────

IMAGE_MIME_TYPES: set[str] = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}

# Sprint 7: Expo Audio records .m4a (iOS) and .mp4 audio (Android)
AUDIO_MIME_TYPES: set[str] = {
    "audio/m4a",
    "audio/aac",
    "audio/mp4",
    "audio/webm",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    # Some devices send x- prefixed types
    "audio/x-m4a",
}

ALLOWED_MIME_TYPES = IMAGE_MIME_TYPES | AUDIO_MIME_TYPES

# Types that only accept audio
AUDIO_ONLY_TYPES = {"voice_note"}

# Types that only accept images
IMAGE_ONLY_TYPES = {
    "avatar", "portfolio", "job_photo", "id_document",
    "selfie", "payment_proof", "dispute_evidence", "before_photo", "after_photo",
}


class PresignRequest(BaseModel):
    upload_type: str = Field(
        ...,
        description=(
            "One of: avatar, portfolio, job_photo, id_document, selfie, "
            "payment_proof, dispute_evidence, before_photo, after_photo, voice_note"
        ),
    )
    content_type: str = Field(default="image/jpeg")
    filename: str | None = Field(None, max_length=100)


@router.post("/presign")
async def get_presigned_url(
    payload: PresignRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """
    Generate a presigned upload URL for direct client-to-storage upload.

    Workflow:
      1. Client calls POST /uploads/presign with upload_type + content_type
      2. Client uploads file directly to the returned upload_url (PUT request)
      3. Client uses the returned public_url as the final resource URL
    """
    if payload.upload_type not in ALLOWED_FOLDERS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid upload_type. Allowed: {', '.join(sorted(ALLOWED_FOLDERS.keys()))}"
            ),
        )

    if payload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported content_type '{payload.content_type}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
            ),
        )

    # Cross-validate type vs content_type
    if payload.upload_type in AUDIO_ONLY_TYPES and payload.content_type not in AUDIO_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"upload_type '{payload.upload_type}' requires an audio content_type.",
        )
    if payload.upload_type in IMAGE_ONLY_TYPES and payload.content_type not in IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"upload_type '{payload.upload_type}' requires an image content_type.",
        )

    user_id = current_user["sub"]
    folder = f"{ALLOWED_FOLDERS[payload.upload_type]}/{user_id}"

    # Sanitize filename
    filename = None
    if payload.filename:
        safe_name = re.sub(r"[^\w\-.]", "_", payload.filename)[:80]
        ext = payload.content_type.split("/")[-1].replace("jpeg", "jpg").replace("x-m4a", "m4a")
        filename = f"{safe_name}.{ext}" if "." not in safe_name else safe_name

    max_bytes = MAX_SIZE_BYTES.get(payload.upload_type, DEFAULT_MAX_SIZE_BYTES)

    try:
        result = await generate_presigned_url(
            folder=folder,
            content_type=payload.content_type,
            filename=filename,
        )
        return {
            "upload_url": result["upload_url"],
            "public_url": result["public_url"],
            "path": result["path"],
            "expires_in_seconds": 300,
            "max_size_bytes": max_bytes,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate presigned URL: {str(exc)}",
        ) from exc
