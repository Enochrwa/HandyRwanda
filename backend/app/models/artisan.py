# File: backend/app/models/artisan.py
import enum
import uuid
from datetime import datetime
from typing import Any

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
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name_rw: Mapped[str] = mapped_column(String(100), nullable=False)
    name_en: Mapped[str] = mapped_column(String(100), nullable=False)
    name_fr: Mapped[str] = mapped_column(String(100), nullable=False)
    icon_emoji: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ArtisanProfile(Base):
    __tablename__ = "artisan_profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    bio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    years_experience: Mapped[int] = mapped_column(Integer, default=0)
    service_radius_km: Mapped[int] = mapped_column(Integer, default=10)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    location: Mapped[str | None] = mapped_column(Geography, nullable=True)
    location_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hourly_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fixed_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    spoken_languages: Mapped[str | None] = mapped_column(String, nullable=True)
    id_document_url: Mapped[str | None] = mapped_column(String, nullable=True)
    selfie_url: Mapped[str | None] = mapped_column(String, nullable=True)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus), default=VerificationStatus.unverified
    )
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    average_rating: Mapped[float] = mapped_column(Float, default=0.0)
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    response_rate: Mapped[float] = mapped_column(Float, default=0.0)
    on_time_rate: Mapped[float] = mapped_column(Float, default=0.0)
    repeat_client_rate: Mapped[float] = mapped_column(Float, default=0.0)
    completion_rate: Mapped[float] = mapped_column(Float, default=0.0)
    community_score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[str | None] = mapped_column(
        DateTime(timezone=True), onupdate=func.now()
    )

    user: Mapped[Any] = relationship("User", backref="artisan_profile")
    categories: Mapped[list["Category"]] = relationship(
        "Category", secondary=artisan_skills, backref="artisans"
    )


class PortfolioPhoto(Base):
    __tablename__ = "portfolio_photos"
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    artisan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=False
    )
    image_url: Mapped[str] = mapped_column(String, nullable=False)
    job_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
