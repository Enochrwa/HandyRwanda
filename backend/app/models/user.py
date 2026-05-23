import uuid
import enum
from sqlalchemy import Column, String, Boolean, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class UserRole(str, enum.Enum):
    client = "client"
    artisan = "artisan"
    admin = "admin"

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone_number = Column(String(20), unique=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    avatar_url = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.client)
    preferred_lang = Column(String(5), default="rw")
    is_active = Column(Boolean, default=True)
    expo_push_token = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
