# File: backend/app/integrations/resend_email.py
"""
Email sending via Resend, with console fallback for local dev.
"""

import os
from typing import Any

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")


async def send_otp_email(to_email: str, otp: str, lang: str = "rw") -> Any:
    subjects = {
        "rw": "Kode yawe ya HandyRwanda",
        "en": "Your HandyRwanda OTP",
        "fr": "Votre code HandyRwanda",
    }
    bodies = {
        "rw": f"Kode yawe ni: {otp}\nIyi kode izamara iminota 5.",
        "en": f"Your verification code is: {otp}\nThis code expires in 5 minutes.",
        "fr": f"Votre code de vérification est: {otp}\nCe code expire dans 5 minutes.",
    }

    subject = subjects.get(lang, subjects["en"])
    body = bodies.get(lang, bodies["en"])

    if not RESEND_API_KEY:
        # Local dev: print OTP to console instead of sending email
        print(f"\n{'=' * 50}")
        print(f"[DEV] OTP for {to_email}: {otp}")
        print(f"[DEV] Subject: {subject}")
        print(f"[DEV] Body: {body}")
        print(f"{'=' * 50}\n")
        return {"id": "dev-local", "to": to_email}

    import resend  # noqa: PLC0415 - only import when key is set

    resend.api_key = RESEND_API_KEY
    return resend.Emails.send(
        {
            "from": os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
            "to": to_email,
            "subject": subject,
            "text": body,
        }
    )
