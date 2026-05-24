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
    return [{"user": row[0], "profile": row[1]} for row in result.all()]


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
