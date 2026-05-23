from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Any
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import OTPRequest, OTPVerify, RefreshRequest, AuthResponse
from app.services import auth_service
from app.integrations.upstash import redis_set

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/otp/request")
async def request_otp(payload: OTPRequest) -> dict[str, str]:
    await auth_service.request_otp(payload.email, payload.lang)
    return {"message": "OTP sent to email"}

@router.post("/otp/verify", response_model=AuthResponse)
async def verify_otp(payload: OTPVerify, db: AsyncSession = Depends(get_db)) -> Any:
    is_valid = await auth_service.verify_otp(payload.email, payload.otp_code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    # Check if user exists, otherwise create
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user:
        # For MVP, we might need more info for registration, but let's assume default for now
        # In a real flow, verify_otp might return a temporary token for registration
        user = User(
            phone_number=f"temp_{payload.email}", # Placeholder
            full_name="New User", # Placeholder
            email=payload.email,
            role=UserRole.client
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = auth_service.create_access_token(str(user.id), user.role)
    refresh_token = auth_service.create_refresh_token(str(user.id))

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user
    }

@router.post("/refresh")
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    # Simplified refresh logic for MVP
    # In production, validate refresh token from DB/Redis
    try:
        from jose import jwt
        import os
        decoded = jwt.decode(payload.refresh_token, os.getenv("JWT_SECRET", ""), algorithms=[os.getenv("JWT_ALGORITHM", "HS256")])
        if decoded.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token type")

        user_id = str(decoded.get("sub"))
        # Fetch user to get their actual role
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        new_access_token = auth_service.create_access_token(user_id, user.role)
        return {"access_token": new_access_token}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@router.post("/logout")
async def logout(payload: RefreshRequest) -> dict[str, str]:
    # In production, blacklist the refresh token in Redis
    await redis_set(f"blacklist:{payload.refresh_token}", "true", ttl_seconds=30*24*60*60)
    return {"message": "Logged out successfully"}
