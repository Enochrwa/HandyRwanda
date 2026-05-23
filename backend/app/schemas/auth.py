
from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class OTPRequest(BaseModel):
    phone_number: str
    email: EmailStr
    lang: str = "rw"

class OTPVerify(BaseModel):
    email: EmailStr
    otp_code: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UserBase(BaseModel):
    id: str
    phone_number: str
    full_name: str
    email: str | None
    role: UserRole

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UserBase
