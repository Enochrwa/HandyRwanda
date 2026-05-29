# File: backend/app/schemas/auth.py

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import AccountStatus, Gender, UserRole

# ── Rwanda phone regex ──────────────────────────────────────────────────────
RW_PHONE_RE = re.compile(r"^\+2507[2-9]\d{7}$")

# ── Rwanda 16-digit NID regex ───────────────────────────────────────────────
RW_NID_RE = re.compile(r"^\d{16}$")

# ── Rwanda districts ────────────────────────────────────────────────────────
RWANDA_DISTRICTS = {
    "Kigali": ["Gasabo", "Kicukiro", "Nyarugenge"],
    "Eastern": [
        "Bugesera",
        "Gatsibo",
        "Kayonza",
        "Kirehe",
        "Ngoma",
        "Nyagatare",
        "Rwamagana",
    ],
    "Northern": ["Burera", "Gakenke", "Gicumbi", "Musanze", "Rulindo"],
    "Southern": [
        "Gisagara",
        "Huye",
        "Kamonyi",
        "Muhanga",
        "Nyamagabe",
        "Nyamasheke",
        "Nyanza",
        "Nyaruguru",
        "Ruhango",
    ],
    "Western": [
        "Karongi",
        "Ngororero",
        "Nyabihu",
        "Nyamasheke",
        "Rubavu",
        "Rusizi",
        "Rutsiro",
    ],
}
ALL_DISTRICTS = [
    d for districts in RWANDA_DISTRICTS.values() for d in districts
] + list(RWANDA_DISTRICTS.keys())


# ── Registration ────────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    # Required core identity
    full_name: str = Field(..., min_length=2, max_length=150)
    phone_number: str = Field(..., description="Rwanda phone: +2507XXXXXXXX")
    email: EmailStr
    role: Literal["client", "artisan"] = "client"

    # Security
    agreed_to_terms: bool = Field(..., description="Must be True")
    terms_version: str = Field(default="v1.0")

    # Optional extended identity (encouraged, required for artisans via validation)
    gender: Gender | None = None
    date_of_birth: date | None = None
    national_id: str | None = Field(default=None, description="Rwanda 16-digit NID")
    district: str | None = None
    sector: str | None = None
    address_detail: str | None = Field(default=None, max_length=300)

    # Preferences
    preferred_lang: Literal["rw", "en", "fr"] = "rw"

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not RW_PHONE_RE.match(v):
            raise ValueError("Phone must be a valid Rwanda number: +2507[2-9]XXXXXXX")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        parts = v.strip().split()
        if len(parts) < 2:
            raise ValueError("Please provide your full name (first and last name)")
        if any(len(p) < 2 for p in parts):
            raise ValueError("Each name component must be at least 2 characters")
        return " ".join(p.capitalize() for p in parts)

    @field_validator("national_id")
    @classmethod
    def validate_nid(cls, v: str | None) -> str | None:
        if v is not None and not RW_NID_RE.match(v):
            raise ValueError("National ID must be exactly 16 digits")
        return v

    @field_validator("agreed_to_terms")
    @classmethod
    def must_agree(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must agree to the terms and conditions to register")
        return v

    @field_validator("date_of_birth")
    @classmethod
    def validate_age(cls, v: date | None) -> date | None:
        if v is None:
            return v
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age < 18:
            raise ValueError("You must be at least 18 years old to register")
        if age > 120:
            raise ValueError("Invalid date of birth")
        return v


class RegisterResponse(BaseModel):
    message: str
    email: str
    next_step: str = "otp_verification"


# ── OTP ─────────────────────────────────────────────────────────────────────


class OTPRequest(BaseModel):
    email: EmailStr
    lang: Literal["rw", "en", "fr"] = "rw"


class OTPVerify(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


# ── Token / Session ──────────────────────────────────────────────────────────


class RefreshRequest(BaseModel):
    refresh_token: str


# ── User representation ──────────────────────────────────────────────────────


class UserBase(BaseModel):
    id: str
    phone_number: str
    full_name: str
    email: str
    role: UserRole
    account_status: AccountStatus
    email_verified: bool
    district: str | None
    preferred_lang: str

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserBase


# ── Profile update ───────────────────────────────────────────────────────────


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    gender: Gender | None = None
    date_of_birth: date | None = None
    national_id: str | None = None
    district: str | None = None
    sector: str | None = None
    address_detail: str | None = None
    preferred_lang: Literal["rw", "en", "fr"] | None = None

    @field_validator("national_id")
    @classmethod
    def validate_nid(cls, v: str | None) -> str | None:
        if v is not None and not RW_NID_RE.match(v):
            raise ValueError("National ID must be exactly 16 digits")
        return v
