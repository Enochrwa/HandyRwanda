import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from app.database import Base
from app.db_compat import UUID


class Review(Base):
    __tablename__ = "reviews"
    id: "Column[UUID]" = Column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )  # type: ignore[type-arg]
    booking_id: "Column[UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), ForeignKey("bookings.id"), unique=True, nullable=False
    )
    client_id: "Column[UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    artisan_id: "Column[UUID]" = Column(  # type: ignore[type-arg]
        UUID(as_uuid=True), ForeignKey("artisan_profiles.user_id"), nullable=False
    )
    rating = Column(Integer, nullable=False)
    comment = Column(String(500), nullable=True)
    artisan_reply = Column(String(300), nullable=True)
    is_flagged = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
