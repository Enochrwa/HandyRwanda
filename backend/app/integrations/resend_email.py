import os
from typing import Any

import resend

resend.api_key = os.getenv("RESEND_API_KEY")


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

    return resend.Emails.send(
        {
            "from": os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
            "to": to_email,
            "subject": subjects.get(lang, subjects["en"]),
            "text": bodies.get(lang, bodies["en"]),
        }
    )
