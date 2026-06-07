# File: backend/app/routers/auth.py

"""
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
from sqlalchemy import select, update
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


# ── Register ──────────────────────────────────────────────────────────────────


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

    try:
        user = User(
            full_name=payload.full_name,
            phone_number=payload.phone_number,
            email=payload.email,
            role=UserRole(payload.role),
            gender=payload.gender,
            date_of_birth=payload.date_of_birth,
            national_id=payload.national_id,
            province=payload.province,
            district=payload.district,
            sector=payload.sector,
            cell=payload.cell,
            village=payload.village,
            street_road=payload.street_road,
            house_number=payload.house_number,
            landmark=payload.landmark,
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

        if user.role == UserRole.artisan:
            profile = ArtisanProfile(user_id=user.id)
            db.add(profile)

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    try:
        await auth_service.request_otp(payload.email, payload.preferred_lang)
    except ValueError:
        pass

    return RegisterResponse(
        message="Account created! A verification code has been sent to your email.",
        email=payload.email,
        next_step="otp_verification",
    )


# ── OTP Request ───────────────────────────────────────────────────────────────


@router.post("/otp/request")
async def request_otp(
    payload: OTPRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    # Rate limit: max 5 requests per email per 10 minutes
    rate_key = f"otp_rate:{payload.email.lower()}"
    count_raw = await redis_get(rate_key)
    count = int(count_raw) if count_raw else 0
    if count >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many OTP requests. Please wait 10 minutes before trying again.",
        )
    await redis_set(rate_key, str(count + 1), ttl_seconds=600)

    user = await db.scalar(select(User).where(User.email == payload.email))
    if not user:
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

    # Use an explicit UPDATE rather than ORM attribute mutation to avoid the
    # "operator does not exist: uuid = character varying" error that occurs when
    # SQLAlchemy's flush generates  WHERE users.id = $N::VARCHAR  against a
    # native PostgreSQL UUID primary-key column.
    now_utc = datetime.now(timezone.utc)
    update_values: dict[str, Any] = {
        "last_login_ip": _client_ip(request),
        "last_login_at": now_utc,
        "failed_login_attempts": 0,
    }
    if not user.email_verified:
        update_values["email_verified"] = True
        update_values["account_status"] = AccountStatus.active
        update_values["is_active"] = True

    await db.execute(update(User).where(User.id == user.id).values(**update_values))
    await db.commit()
    await db.refresh(user)

    access_token = auth_service.create_access_token(str(user.id), user.role.value)
    refresh_token = auth_service.create_refresh_token(str(user.id))

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserBase(
            id=str(user.id),
            phone_number=str(user.phone_number),
            full_name=str(user.full_name),
            email=str(user.email),
            role=UserRole(user.role),
            account_status=AccountStatus(user.account_status),
            email_verified=bool(user.email_verified),
            avatar_url=str(user.avatar_url) if user.avatar_url else None,
            province=str(user.province) if user.province else None,
            district=str(user.district) if user.district is not None else None,
            sector=str(user.sector) if user.sector else None,
            cell=str(user.cell) if user.cell else None,
            village=str(user.village) if user.village else None,
            street_road=str(user.street_road) if user.street_road else None,
            house_number=str(user.house_number) if user.house_number else None,
            landmark=str(user.landmark) if user.landmark else None,
            address_detail=str(user.address_detail) if user.address_detail else None,
            preferred_lang=str(user.preferred_lang),
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

    bl = await redis_get(f"blacklist:{payload.refresh_token}")
    if bl:
        raise HTTPException(status_code=401, detail="Token has been revoked.")

    user_id = decoded["sub"]
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user or user.account_status == AccountStatus.suspended:
        raise HTTPException(
            status_code=401, detail="User not found or account suspended."
        )

    new_access_token = auth_service.create_access_token(user_id, user.role.value)
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
        "province": user.province,
        "district": user.district,
        "sector": user.sector,
        "cell": user.cell,
        "village": user.village,
        "street_road": user.street_road,
        "house_number": user.house_number,
        "landmark": user.landmark,
        "address_detail": user.address_detail,
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
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    if (
        str(current_user["sub"]) != str(user_id)
        and current_user["role"] != UserRole.admin
    ):
        raise HTTPException(status_code=403, detail="Forbidden.")

    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        return {"message": "No fields to update.", "updated_fields": []}

    # Use explicit UPDATE to avoid uuid = varchar cast error on PostgreSQL
    await db.execute(update(User).where(User.id == user.id).values(**update_data))
    await db.commit()
    await db.refresh(user)
    return {
        "message": "Profile updated successfully.",
        "updated_fields": list(update_data.keys()),
    }


# ── Convenience alias: PATCH /auth/profile (authenticated user updates own profile) ──
# Both mobile (step3-location) and web (onboarding/artisan) call this endpoint.
# Previously missing — only /auth/users/{user_id}/profile existed.

@router.patch("/profile")
async def update_own_profile(
    payload: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """Update the currently authenticated user's profile fields."""
    from uuid import UUID as _UUID

    user_id = _UUID(str(current_user["sub"]))
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        return {"message": "No fields to update.", "updated_fields": []}

    await db.execute(update(User).where(User.id == user.id).values(**update_data))
    await db.commit()
    await db.refresh(user)
    return {
        "message": "Profile updated successfully.",
        "updated_fields": list(update_data.keys()),
    }
