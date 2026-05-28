from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import require_role
from app.models.artisan import ArtisanProfile, VerificationStatus
from app.models.user import User, UserRole

router = APIRouter(prefix="/admin", tags=["admin"])


class CategoryCreate(BaseModel):
    name_rw: str
    name_en: str
    name_fr: str
    icon_emoji: str | None = None


class RejectPayload(BaseModel):
    reason: str


@router.get("/artisans/pending")
async def list_pending_artisans(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    result = await db.execute(
        select(User, ArtisanProfile)
        .join(ArtisanProfile, User.id == ArtisanProfile.user_id)
        .where(ArtisanProfile.verification_status == VerificationStatus.pending)
    )
    return [
        {
            "user": {
                "id": str(row[0].id),
                "phone_number": row[0].phone_number,
                "full_name": row[0].full_name,
                "email": row[0].email,
                "avatar_url": row[0].avatar_url,
                "role": row[0].role,
                "preferred_lang": row[0].preferred_lang,
                "is_active": row[0].is_active,
                "expo_push_token": row[0].expo_push_token,
                "created_at": row[0].created_at,
                "updated_at": row[0].updated_at,
            },
            "profile": row[1],
        }
        for row in result.all()
    ]


@router.post("/artisans/{user_id}/approve")
async def approve_artisan(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == user_id)
        .values(verification_status=VerificationStatus.id_verified)
    )
    await db.commit()
    return {"message": "Artisan approved"}


@router.post("/artisans/{user_id}/reject")
async def reject_artisan(
    user_id: UUID,
    payload: RejectPayload,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(require_role(UserRole.admin)),
) -> Any:
    await db.execute(
        update(ArtisanProfile)
        .where(ArtisanProfile.user_id == user_id)
        .values(verification_status=VerificationStatus.rejected)
    )
    await db.commit()
    return {"message": "Artisan rejected"}
