import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Integer,
    String,
    func,
)
from sqlalchemy import (
    Enum as SQLEnum,
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
    pending_verification = "pending_verification"
    active = "active"
    suspended = "suspended"
    deactivated = "deactivated"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    phone_number = Column(String(20), unique=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False)

    date_of_birth = Column(Date, nullable=True)
    gender = Column(SQLEnum(Gender), nullable=True)
    national_id = Column(String(20), nullable=True)
    district = Column(String(100), nullable=True)
    sector = Column(String(100), nullable=True)
    address_detail = Column(String(300), nullable=True)

    avatar_url = Column(String, nullable=True)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.client)
    preferred_lang = Column(String(5), default="rw")

    account_status = Column(
        SQLEnum(AccountStatus),
        nullable=False,
        default=AccountStatus.pending_verification,
    )
    email_verified = Column(Boolean, default=False)
    phone_verified = Column(Boolean, default=False)

    registration_ip = Column(String(45), nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    agreed_to_terms = Column(Boolean, default=False, nullable=False)
    terms_version = Column(String(20), nullable=True)
    agreed_at = Column(DateTime(timezone=True), nullable=True)

    expo_push_token = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    is_fully_verified = column_property(
        email_verified.is_(true()) & (account_status == AccountStatus.active)
    )
