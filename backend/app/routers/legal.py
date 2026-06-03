# File: backend/app/routers/legal.py
"""
Legal pages router.

GET  /legal/terms    — Terms of Service content
GET  /legal/privacy  — Privacy Policy content
POST /legal/accept   — Record user's acceptance of current terms version
"""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.jwt_auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/legal", tags=["legal"])

CURRENT_TERMS_VERSION = "1.0"
CURRENT_PRIVACY_VERSION = "1.0"
LAST_UPDATED = "1 June 2025"


@router.get("/terms")
async def get_terms() -> Any:
    return {
        "version": CURRENT_TERMS_VERSION,
        "last_updated": LAST_UPDATED,
        "title": "HandyRwanda Terms of Service",
        "sections": [
            {
                "heading": "1. About HandyRwanda",
                "body": (
                    "HandyRwanda is a marketplace platform that connects clients who need skilled "
                    "services (plumbing, electrical work, cleaning, etc.) with qualified artisans "
                    "across Rwanda. HandyRwanda acts as an intermediary facilitating connections "
                    "and holding payments; it is not a party to the service contract between "
                    "client and artisan."
                ),
            },
            {
                "heading": "2. Account Registration",
                "body": (
                    "You must be at least 18 years old to register. You agree to provide accurate "
                    "information including your full name, phone number, and email address. You are "
                    "responsible for maintaining the confidentiality of your account credentials. "
                    "One person may not maintain multiple accounts."
                ),
            },
            {
                "heading": "3. Payments & Escrow",
                "body": (
                    "All payments are processed through HandyRwanda's escrow system. Clients send "
                    "payment to HandyRwanda via MTN Mobile Money or Airtel Money before work begins. "
                    "HandyRwanda holds the payment until the client confirms the job is complete or "
                    "48 hours after the artisan marks the job done (whichever comes first). "
                    "Payments are non-refundable except in cases of verified artisan non-performance "
                    "or successful dispute resolution in the client's favour."
                ),
            },
            {
                "heading": "4. Artisan Vetting & Verification",
                "body": (
                    "All artisans are required to submit a government-issued national ID and a selfie "
                    "for identity verification. HandyRwanda reviews submitted documents and may approve "
                    "or reject applications at its sole discretion. Verification does not constitute "
                    "an endorsement of the artisan's work quality."
                ),
            },
            {
                "heading": "5. Dispute Resolution",
                "body": (
                    "Either party may raise a dispute within 48 hours of job completion. Both parties "
                    "will have 72 hours to submit evidence (photos, written statements). HandyRwanda's "
                    "team will review submitted evidence and make a binding decision. The losing party "
                    "may request one re-review within 24 hours of the decision."
                ),
            },
            {
                "heading": "6. Prohibited Conduct",
                "body": (
                    "Users may not: provide false information, circumvent HandyRwanda's payment system, "
                    "harass or threaten other users, post fraudulent jobs or bids, or use the platform "
                    "for illegal services. Violations may result in immediate account suspension."
                ),
            },
            {
                "heading": "7. Liability Disclaimer",
                "body": (
                    "HandyRwanda is not liable for the quality of work performed by artisans, "
                    "any property damage, personal injury, or consequential damages arising from "
                    "service engagements. Clients engage artisans at their own risk. HandyRwanda's "
                    "maximum liability is limited to the value of the disputed transaction."
                ),
            },
            {
                "heading": "8. Data Collection",
                "body": (
                    "We collect your name, phone number, email, location (district and sector), "
                    "and payment transaction details. This information is used to provide our services "
                    "and improve the platform. See our Privacy Policy for full details."
                ),
            },
            {
                "heading": "9. Changes to Terms",
                "body": (
                    "We may update these terms from time to time. Users will be notified of material "
                    "changes and required to re-accept the updated terms before continuing to use the platform."
                ),
            },
            {
                "heading": "10. Governing Law",
                "body": (
                    "These terms are governed by the laws of the Republic of Rwanda. Any disputes "
                    "shall be resolved in the competent courts of Kigali, Rwanda."
                ),
            },
        ],
    }


@router.get("/privacy")
async def get_privacy() -> Any:
    return {
        "version": CURRENT_PRIVACY_VERSION,
        "last_updated": LAST_UPDATED,
        "title": "HandyRwanda Privacy Policy",
        "sections": [
            {
                "heading": "1. Information We Collect",
                "body": (
                    "We collect: (a) Identity data — full name, national ID number, date of birth, gender; "
                    "(b) Contact data — phone number, email address; "
                    "(c) Location data — district, sector, cell, village; "
                    "(d) Payment data — MoMo transaction IDs, payment screenshots (not card numbers); "
                    "(e) Usage data — pages visited, searches performed, jobs posted; "
                    "(f) Device data — device type, push notification tokens."
                ),
            },
            {
                "heading": "2. How We Use Your Information",
                "body": (
                    "We use your information to: match clients with artisans, process and verify payments, "
                    "send job and booking notifications, verify artisan identity, resolve disputes, "
                    "improve our services, and comply with Rwandan legal obligations."
                ),
            },
            {
                "heading": "3. Data Sharing",
                "body": (
                    "We share your contact information with the other party in a confirmed booking "
                    "(e.g. client phone number shared with artisan after booking confirmation). "
                    "We do not sell your personal data to third parties. We may share data with "
                    "law enforcement when required by Rwandan law."
                ),
            },
            {
                "heading": "4. Data Security",
                "body": (
                    "Your data is stored on secure servers hosted by Supabase (PostgreSQL database with "
                    "row-level security). Passwords are hashed using bcrypt. We use HTTPS for all "
                    "data transmission. Identity documents are stored in a private, access-controlled "
                    "storage bucket."
                ),
            },
            {
                "heading": "5. Data Retention",
                "body": (
                    "Account data is retained for as long as your account is active plus 3 years. "
                    "Transaction records are retained for 7 years per Rwandan financial regulations. "
                    "You may request deletion of your account by contacting support@handyrwanda.rw."
                ),
            },
            {
                "heading": "6. Your Rights",
                "body": (
                    "You have the right to: access the personal data we hold about you, correct "
                    "inaccurate data, request deletion of your account, and opt out of marketing "
                    "notifications. To exercise these rights, email support@handyrwanda.rw."
                ),
            },
            {
                "heading": "7. Cookies",
                "body": (
                    "Our web application uses authentication cookies and local storage to maintain "
                    "your login session. We do not use advertising or tracking cookies."
                ),
            },
            {
                "heading": "8. Contact",
                "body": (
                    "For privacy-related questions: privacy@handyrwanda.rw. "
                    "HandyRwanda Ltd, Kigali Innovation City, Kigali, Rwanda."
                ),
            },
        ],
    }


@router.post("/accept")
async def accept_terms(
    db: AsyncSession = Depends(get_db),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> Any:
    """Record that the authenticated user has accepted the current terms version."""
    from uuid import UUID  # noqa: PLC0415

    user_id = UUID(current_user["sub"])
    now = datetime.now(timezone.utc)

    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(
            agreed_to_terms=True,
            terms_version=CURRENT_TERMS_VERSION,
            agreed_at=now,
            terms_accepted_at=now,
        )
    )
    await db.commit()
    return {
        "message": "Terms accepted.",
        "terms_version": CURRENT_TERMS_VERSION,
        "accepted_at": now.isoformat(),
    }
