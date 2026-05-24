import os
import random
import string
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.integrations.resend_email import send_otp_email
from app.integrations.upstash import redis_del, redis_get, redis_set

SECRET = os.getenv("JWT_SECRET", "")
ALGO = os.getenv("JWT_ALGORITHM", "HS256")


def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


async def request_otp(email: str, lang: str = "rw") -> None:
    otp = generate_otp()
    await redis_set(f"otp:{email}", otp, ttl_seconds=300)  # 5 min TTL
    await send_otp_email(email, otp, lang)


async def verify_otp(email: str, otp: str) -> bool:
    stored = await redis_get(f"otp:{email}")
    if stored == otp:
        await redis_del(f"otp:{email}")
        return True
    return False


def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    token = jwt.encode(payload, SECRET, algorithm=ALGO)
    return str(token)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    token = jwt.encode(payload, SECRET, algorithm=ALGO)
    return str(token)
