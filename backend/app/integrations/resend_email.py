# File: backend/app/integrations/resend_email.py
"""
Email sending via Resend, with console fallback for local dev.

SETUP GUIDE:
------------
DEV (local):
  - Leave RESEND_API_KEY unset (or empty) → OTPs print to console. No emails sent.
  - OR set RESEND_API_KEY but leave RESEND_VERIFIED_DOMAIN unset → emails are
    redirected to DEV_EMAIL_OVERRIDE (your Resend account email) so Resend's
    test-mode restriction doesn't block you.

PROD:
  - Set RESEND_API_KEY       → your Resend API key
  - Set RESEND_FROM_EMAIL    → e.g. noreply@yourdomain.com  (must use a verified domain)
  - Set ENV=production       → disables all dev overrides
  - Verify your domain at:     https://resend.com/domains
"""

import os
from typing import Any

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

# The environment name. Set ENV=production in your prod environment.
# Anything else (dev, staging, unset) is treated as non-production.
ENV = os.getenv("ENV", "development")
IS_PRODUCTION = ENV == "production"

# In non-production environments, if RESEND_API_KEY is set, Resend will reject
# emails sent to addresses other than your own account email.
# Set this to the email address registered on your Resend account so all
# outgoing emails are safely redirected to you during development/testing.
# Example: DEV_EMAIL_OVERRIDE=enockuwumukiza850@gmail.com
DEV_EMAIL_OVERRIDE = os.getenv("DEV_EMAIL_OVERRIDE", "")


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

    # -------------------------------------------------------------------------
    # CASE 1: No API key set → pure local dev, print OTP to console.
    # This is the safest and simplest local setup — no Resend account needed.
    # -------------------------------------------------------------------------
    if not RESEND_API_KEY:
        print(f"\n{'=' * 50}")
        print(f"[DEV] OTP for {to_email}: {otp}")
        print(f"[DEV] Subject: {subject}")
        print(f"[DEV] Body: {body}")
        print(f"{'=' * 50}\n")
        return {"id": "dev-local", "to": to_email}

    # Only import resend when we actually have an API key.
    import resend  # noqa: PLC0415

    resend.api_key = RESEND_API_KEY

    # -------------------------------------------------------------------------
    # CASE 2: API key is set but we're NOT in production.
    # Resend restricts unverified accounts to only send to their own email.
    # We redirect all emails to DEV_EMAIL_OVERRIDE to avoid that 403 error.
    #
    # If DEV_EMAIL_OVERRIDE is not set, fall through to the real address and
    # let Resend fail loudly — a reminder to configure the override.
    # -------------------------------------------------------------------------
    if not IS_PRODUCTION:
        if not DEV_EMAIL_OVERRIDE:
            # Warn the developer that they need to set DEV_EMAIL_OVERRIDE.
            # Without it, Resend will reject the email unless to_email happens
            # to match their Resend account address.
            print(
                f"\n[WARNING] ENV is not 'production' and DEV_EMAIL_OVERRIDE is not set.\n"
                f"Resend will likely reject this email to '{to_email}'.\n"
                f"Set DEV_EMAIL_OVERRIDE=<your-resend-account-email> in your .env file.\n"
            )
        else:
            print(
                f"\n[DEV] Email for '{to_email}' redirected to '{DEV_EMAIL_OVERRIDE}' "
                f"(Resend test-mode restriction).\n"
                f"[DEV] OTP: {otp}\n"
            )

        # Use the override address if available, otherwise attempt the real one.
        actual_recipient = DEV_EMAIL_OVERRIDE or to_email

        return resend.Emails.send(
            {
                # In dev, "onboarding@resend.dev" is Resend's built-in test sender.
                # Once you verify a domain, update RESEND_FROM_EMAIL in your .env.
                "from": os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
                "to": actual_recipient,
                "subject": f"[DEV → {to_email}] {subject}",  # keep original recipient visible in subject
                "text": body,
            }
        )

    # -------------------------------------------------------------------------
    # CASE 3: Production — send to the real recipient.
    # Requires RESEND_FROM_EMAIL to use a verified domain, e.g.:
    #   RESEND_FROM_EMAIL=noreply@yourdomain.com
    # Verify your domain at: https://resend.com/domains
    # -------------------------------------------------------------------------
    return resend.Emails.send(
        {
            "from": os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev"),
            "to": to_email,
            "subject": subject,
            "text": body,
        }
    )
