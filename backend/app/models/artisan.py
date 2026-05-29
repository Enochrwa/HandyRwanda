import enum
import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.db_compat import UUID, Geography


class VerificationStatus(str, enum.Enum):
    unverified = "unverified"
    pending = "pending"
    id_verified = "id_verified"
    pro_verified = "pro_verified"
    rejected = "rejected"


artisan_skills = Table(
    "artisan_skills",
    Base.metadata,
    Column(
        "artisan_id",
        UUID(as_uuid=True),
        ForeignKey("artisan_profiles.user_id"),
        primary_key=True,
    ),
    Column(
        "category_id", UUID(as_uuid=True), ForeignKey("categories.id"), primary_key=True
    ),
)


class Category(Base):
    __tablename__ = "categories"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name_rw = Column(String(100), nullable=False)
    name_en = Column(String(100), nullable=False)
    name_fr = Column(String(100), nullable=False)
    icon_emoji = Column(String(10), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ArtisanProfile(Base):
    __tablename__ = "artisan_profiles"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    bio = Column(String(500), nullable=True)
    years_experience = Column(Integer, default=0)
    service_radius_km = Column(Integer, default=10)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location = Column(Geography, nullable=True)
    location_label = Column(String(200), nullable=True)
    hourly_rate = Column(Integer, nullable=True)
    fixed_rate = Column(Integer, nullable=True)
    spoken_languages = Column(String, nullable=True)  # Comma-separated or JSON
    id_document_url = Column(String, nullable=True)
    selfie_url = Column(String, nullable=True)
    verification_status = Column(
        Enum(VerificationStatus), default=VerificationStatus.unverified
    )
    is_available = Column(Boolean, default=True)
    average_rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)
    response_rate = Column(Float, default=0.0)
    on_time_rate = Column(Float, default=0.0)
    repeat_client_rate = Column(Float, default=0.0)
    completion_rate = Column(Float, default=0.0)
    community_score = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", backref="artisan_profile")
    categories = relationship("Category", secondary=artisan_skills, backref="artisans")


class PortfolioPhoto(Base):
    __tablename__ = "portfolio_photos"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artisan_id = Column(
        UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=False
    )
    image_url = Column(String, nullable=False)
    job_type = Column(String(100), nullable=True)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
