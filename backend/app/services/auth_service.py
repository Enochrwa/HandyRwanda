# File: backend/app/services/auth_service.py

"""
---------------
Handles OTP generation/verification with rate-limiting, secure token creation,
and account security helpers.
"""

import os
import secrets
import string
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.integrations.resend_email import send_otp_email
from app.integrations.upstash import redis_del, redis_get, redis_set

SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
ALGO = os.getenv("JWT_ALGORITHM", "HS256")

# OTP config
OTP_TTL_SECONDS = 300  # 5 minutes
OTP_MAX_ATTEMPTS = 5  # lock after 5 wrong attempts per email
OTP_ATTEMPT_TTL = 600  # attempt counter window: 10 minutes
OTP_RESEND_COOLDOWN = 60  # minimum seconds between resend requests
TERMS_VERSION = "v1.0"


def _otp_key(email: str) -> str:
    return f"otp:{email}"


def _attempt_key(email: str) -> str:
    return f"otp_attempts:{email}"


def _cooldown_key(email: str) -> str:
    return f"otp_cooldown:{email}"


def generate_otp() -> str:
    """Cryptographically adequate OTP using secrets module."""
    return "".join(secrets.choice(string.digits) for _ in range(6))


async def request_otp(email: str, lang: str = "rw") -> dict[str, str | int]:
    """
    Send OTP with resend-cooldown protection.
    Returns {'status': 'sent'} or raises ValueError with a user-safe message.
    """
    # Check cooldown: prevent spamming the endpoint
    cooldown = await redis_get(_cooldown_key(email))
    if cooldown:
        raise ValueError(
            f"Please wait {OTP_RESEND_COOLDOWN} seconds before requesting a new code."
        )

    otp = generate_otp()
    await redis_set(_otp_key(email), otp, ttl_seconds=OTP_TTL_SECONDS)
    await redis_set(_cooldown_key(email), "1", ttl_seconds=OTP_RESEND_COOLDOWN)
    # Reset attempt counter on fresh send
    await redis_del(_attempt_key(email))

    await send_otp_email(email, otp, lang)
    return {"status": "sent", "expires_in": OTP_TTL_SECONDS}


async def verify_otp(email: str, otp: str) -> tuple[bool, str]:
    """
    Verify OTP with attempt tracking.
    Returns (True, "ok") or (False, reason).
    """
    # Check attempt count
    attempts_raw = await redis_get(_attempt_key(email))
    attempts = int(attempts_raw) if attempts_raw else 0

    if attempts >= OTP_MAX_ATTEMPTS:
        return False, "Too many incorrect attempts. Please request a new code."

    stored = await redis_get(_otp_key(email))
    if stored is None:
        return (
            False,
            "Code has expired or was not requested. Please request a new code.",
        )

    if stored != otp:
        new_attempts = attempts + 1
        await redis_set(
            _attempt_key(email), str(new_attempts), ttl_seconds=OTP_ATTEMPT_TTL
        )
        remaining = OTP_MAX_ATTEMPTS - new_attempts
        if remaining <= 0:
            await redis_del(_otp_key(email))
            return False, "Too many incorrect attempts. Please request a new code."
        return False, f"Invalid code. {remaining} attempt(s) remaining."

    # Success — clean up
    await redis_del(_otp_key(email))
    await redis_del(_attempt_key(email))
    return True, "ok"


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=30),  # 30 min for better UX
        "iat": datetime.now(timezone.utc),
    }
    return str(jwt.encode(payload, SECRET, algorithm=ALGO))


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    return str(jwt.encode(payload, SECRET, algorithm=ALGO))
