# File: backend/app/models/user.py
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, func
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, column_property, mapped_column

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
    pending_verification = "pending_verification"
    active = "active"
    suspended = "suspended"
    deactivated = "deactivated"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    phone_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)

    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[Gender | None] = mapped_column(SQLEnum(Gender), nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Granular Rwanda address fields
    province: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cell: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village: Mapped[str | None] = mapped_column(String(100), nullable=True)
    street_road: Mapped[str | None] = mapped_column(String(200), nullable=True)
    house_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    landmark: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_detail: Mapped[str | None] = mapped_column(String(300), nullable=True)

    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole), nullable=False, default=UserRole.client
    )
    preferred_lang: Mapped[str] = mapped_column(String(5), default="rw")

    account_status: Mapped[AccountStatus] = mapped_column(
        SQLEnum(AccountStatus),
        nullable=False,
        default=AccountStatus.pending_verification,
    )
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    registration_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    last_login_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    agreed_to_terms: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    terms_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    agreed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Explicit timestamp per terms version acceptance (for legal compliance)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Push notification tokens
    expo_push_token: Mapped[str | None] = mapped_column(String, nullable=True)
    fcm_push_token: Mapped[str | None] = mapped_column(String, nullable=True)

    # Notification preferences (JSON-encoded bitmask as string for SQLite compat)
    notification_prefs: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        default='{"new_bid":true,"booking_update":true,"payment":true,"message":true,"promo":false}',
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Sprint 8: Referral System
    referral_code: Mapped[str | None] = mapped_column(
        String(20), unique=True, nullable=True, index=True
    )
    wallet_balance_rwf: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    is_fully_verified: Mapped[bool] = column_property(
        email_verified.is_(True) & (account_status == AccountStatus.active)
    )
