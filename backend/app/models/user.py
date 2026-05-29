# File: backend/app/models/user.py

import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import column_property
from sqlalchemy.sql import true

from app.database import Base
from app.db_compat import UUID


class UserRole(str, enum.Enum):
    client = "client"
    artisan = "artisan"
    admin = "admin"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    prefer_not_to_say = "prefer_not_to_say"


class AccountStatus(str, enum.Enum):
    pending_verification = "pending_verification"  # registered, OTP not yet verified
    active = "active"
    suspended = "suspended"
    deactivated = "deactivated"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # ── Core Identity ──────────────────────────────────────────────────────────
    phone_number = Column(String(20), unique=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False)

    # ── Extended Identity (optional but collected at signup) ───────────────────
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    national_id = Column(String(20), nullable=True)  # Rwanda 16-digit NID
    district = Column(String(100), nullable=True)  # Rwanda district
    sector = Column(String(100), nullable=True)  # Rwanda sector (optional)
    address_detail = Column(String(300), nullable=True)  # Free-text street/cell

    # ── Profile ────────────────────────────────────────────────────────────────
    avatar_url = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.client)
    preferred_lang = Column(String(5), default="rw")

    # ── Account Status & Verification ─────────────────────────────────────────
    account_status = Column(
        Enum(AccountStatus),
        nullable=False,
        default=AccountStatus.pending_verification,
    )
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)  # future SMS OTP

    # ── Security Metadata ──────────────────────────────────────────────────────
    registration_ip = Column(String(45), nullable=True)  # IPv4 or IPv6
    last_login_ip = Column(String(45), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # ── Legal / Compliance ─────────────────────────────────────────────────────
    agreed_to_terms = Column(Boolean, default=False, nullable=False)
    terms_version = Column(String(20), nullable=True)  # e.g. "v1.0"
    agreed_at = Column(DateTime(timezone=True), nullable=True)

    # ── Notifications ──────────────────────────────────────────────────────────
    expo_push_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)  # kept for backward compat
    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    is_fully_verified = column_property(
        email_verified.is_(true()) & (account_status == AccountStatus.active)
    )
