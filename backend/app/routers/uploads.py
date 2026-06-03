# File: backend/app/routers/uploads.py
"""
Upload router — presigned URL generation for direct client-to-Supabase uploads.

POST /uploads/presign   — get a presigned URL for a specific upload type
GET  /uploads/confirm   — confirm upload completed (returns final public URL)

This bypasses the API server for the actual file transfer, dramatically reducing
load and improving performance on slow mobile connections.
"""
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies.jwt_auth import get_current_user
from app.integrations.supabase_storage import generate_presigned_url

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Allowed upload contexts mapped to storage folders
ALLOWED_FOLDERS = {
    "avatar": "avatars",
    "portfolio": "portfolio-photos",
    "job_photo": "job-photos",
    "id_document": "id-documents",
    "selfie": "selfies",
    "payment_proof": "payment-proofs",
    "dispute_evidence": "dispute-evidence",
    "before_photo": "booking-photos/before",
    "after_photo": "booking-photos/after",
}

ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


class PresignRequest(BaseModel):
    upload_type: str = Field(
        ...,
        description="One of: avatar, portfolio, job_photo, id_document, selfie, payment_proof, dispute_evidence, before_photo, after_photo",
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
      1. Client calls POST /uploads/presign with upload_type
      2. Client uploads file directly to the returned upload_url (PUT request)
      3. Client uses the returned public_url as the final image URL
    """
    if payload.upload_type not in ALLOWED_FOLDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid upload_type. Allowed: {', '.join(ALLOWED_FOLDERS.keys())}",
        )

    if payload.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content type. Allowed: {', '.join(ALLOWED_MIME_TYPES)}",
        )

    user_id = current_user["sub"]
    folder = f"{ALLOWED_FOLDERS[payload.upload_type]}/{user_id}"

    # Sanitize filename
    filename = None
    if payload.filename:
        safe_name = re.sub(r"[^\w\-.]", "_", payload.filename)[:80]
        ext = payload.content_type.split("/")[-1].replace("jpeg", "jpg")
        filename = f"{safe_name}.{ext}" if "." not in safe_name else safe_name

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
            "max_size_bytes": 5 * 1024 * 1024,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate presigned URL: {str(exc)}",
        ) from exc
