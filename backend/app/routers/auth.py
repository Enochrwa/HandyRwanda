# File: backend/app/routers/auth.py

"""
---------------
Registration → OTP email verification → Login flow.

Registration flow:
  POST /auth/register          → creates user (account_status=pending_verification)
  POST /auth/otp/request       → sends email OTP (rate-limited)
  POST /auth/otp/verify        → verifies OTP, marks email_verified, activates account
                                  returns JWT pair on success

Login flow (existing users):
  POST /auth/otp/request       → same endpoint, works for login too
  POST /auth/otp/verify        → same endpoint

Other:
  POST /auth/refresh           → rotate access token
  POST /auth/logout            → blacklist refresh token
  GET  /auth/users/{id}/profile
  PATCH /auth/users/{id}/profile
"""

import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.integrations.upstash import redis_get, redis_set
from app.models.artisan import ArtisanProfile, PortfolioPhoto
from app.models.user import AccountStatus, User, UserRole
from app.schemas.auth import (
    AuthResponse,
    OTPRequest,
    OTPVerify,
    ProfileUpdate,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    UserBase,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Register ─────────────────────────────────────────────────────────────────


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    payload: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Create a new account. Account is in 'pending_verification' state until
    the user verifies their email via OTP.
    """
    # 1. Duplicate check — email
    email_exists = await db.scalar(select(User).where(User.email == payload.email))
    if email_exists:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "EMAIL_TAKEN",
                "message": "An account with this email address already exists.",
                "field": "email",
            },
        )

    # 2. Duplicate check — phone
    phone_exists = await db.scalar(
        select(User).where(User.phone_number == payload.phone_number)
    )
    if phone_exists:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "PHONE_TAKEN",
                "message": "An account with this phone number already exists.",
                "field": "phone_number",
            },
        )

    # 3. Create user
    try:
        user = User(
            full_name=payload.full_name,
            phone_number=payload.phone_number,
            email=payload.email,
            role=UserRole(payload.role),
            gender=payload.gender,
            date_of_birth=payload.date_of_birth,
            national_id=payload.national_id,
            district=payload.district,
            sector=payload.sector,
            address_detail=payload.address_detail,
            preferred_lang=payload.preferred_lang,
            account_status=AccountStatus.pending_verification,
            email_verified=False,
            agreed_to_terms=payload.agreed_to_terms,
            terms_version=payload.terms_version,
            agreed_at=datetime.now(timezone.utc),
            registration_ip=_client_ip(request),
        )
        db.add(user)
        await db.flush()

        # 4. Auto-create artisan profile stub
        if user.role == UserRole.artisan:
            profile = ArtisanProfile(user_id=user.id)
            db.add(profile)

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    # 5. Fire OTP immediately after registration
    try:
        await auth_service.request_otp(payload.email, payload.preferred_lang)
    except ValueError:
        # Cooldown shouldn't fire on fresh registration, but handle gracefully
        pass

    return RegisterResponse(
        message="Account created! A verification code has been sent to your email.",
        email=payload.email,
        next_step="otp_verification",
    )


# ── OTP Request ───────────────────────────────────────────────────────────────


@router.post("/otp/request")
async def request_otp(
    payload: OTPRequest, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    # Verify the email belongs to a registered user (prevents fishing for OTPs)
    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user:
        # Intentionally vague to prevent user enumeration
        return {
            "message": "If that email is registered, you will receive a code shortly.",
            "expires_in": 300,
        }

    if user.account_status == AccountStatus.suspended:
        raise HTTPException(
            status_code=403, detail="Account is suspended. Contact support."
        )

    try:
        result = await auth_service.request_otp(payload.email, payload.lang)
    except ValueError as e:
        raise HTTPException(status_code=429, detail=str(e))

    return {
        "message": "Verification code sent to your email.",
        "expires_in": result["expires_in"],
    }


# ── OTP Verify ────────────────────────────────────────────────────────────────


@router.post("/otp/verify", response_model=AuthResponse)
async def verify_otp(
    payload: OTPVerify,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Any:
    valid, reason = await auth_service.verify_otp(payload.email, payload.otp_code)
    if not valid:
        raise HTTPException(
            status_code=400, detail={"code": "OTP_INVALID", "message": reason}
        )

    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Activate account on first OTP verification
    if not user.email_verified:
        user.email_verified = True
        user.account_status = AccountStatus.active
        user.is_active = True

    # Update login metadata
    user.last_login_ip = _client_ip(request)
    user.last_login_at = datetime.now(timezone.utc)
    user.failed_login_attempts = 0

    await db.commit()
    await db.refresh(user)

    access_token = auth_service.create_access_token(str(user.id), str(user.role))
    refresh_token = auth_service.create_refresh_token(str(user.id))

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserBase(
            id=str(user.id),
            phone_number=user.phone_number,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            account_status=user.account_status,
            email_verified=user.email_verified,
            district=user.district,
            preferred_lang=user.preferred_lang,
        ),
    )


# ── Refresh ───────────────────────────────────────────────────────────────────


@router.post("/refresh")
async def refresh_token(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    try:
        decoded = jwt.decode(
            payload.refresh_token,
            os.getenv("JWT_SECRET", "change-me-in-production"),
            algorithms=[os.getenv("JWT_ALGORITHM", "HS256")],
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    # Check blacklist
    bl = await redis_get(f"blacklist:{payload.refresh_token}")
    if bl:
        raise HTTPException(status_code=401, detail="Token has been revoked.")

    user_id = decoded["sub"]
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user or user.account_status == AccountStatus.suspended:
        raise HTTPException(
            status_code=401, detail="User not found or account suspended."
        )

    new_access_token = auth_service.create_access_token(user_id, str(user.role))
    return {"access_token": new_access_token}


# ── Logout ────────────────────────────────────────────────────────────────────


@router.post("/logout")
async def logout(payload: RefreshRequest) -> dict[str, str]:
    await redis_set(
        f"blacklist:{payload.refresh_token}", "true", ttl_seconds=30 * 24 * 60 * 60
    )
    return {"message": "Logged out successfully."}


# ── User Profile ──────────────────────────────────────────────────────────────


@router.get("/users/{user_id}/profile")
async def get_user_profile(user_id: UUID, db: AsyncSession = Depends(get_db)) -> Any:
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    profile: ArtisanProfile | None = None
    portfolio: list[PortfolioPhoto] = []
    if user.role == UserRole.artisan:
        profile = await db.scalar(
            select(ArtisanProfile).where(ArtisanProfile.user_id == user_id)
        )
        portfolio_result = await db.execute(
            select(PortfolioPhoto).where(PortfolioPhoto.artisan_id == user_id)
        )
        portfolio = list(portfolio_result.scalars().all())

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "phone_number": user.phone_number,
        "avatar_url": user.avatar_url,
        "role": user.role,
        "gender": user.gender,
        "district": user.district,
        "sector": user.sector,
        "preferred_lang": user.preferred_lang,
        "account_status": user.account_status,
        "email_verified": user.email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "profile": profile,
        "portfolio": portfolio,
    }


@router.patch("/users/{user_id}/profile")
async def update_profile(
    user_id: UUID,
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    if str(current_user.id) != str(user_id) and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Forbidden.")

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return {
        "message": "Profile updated successfully.",
        "updated_fields": list(update_data.keys()),
    }
