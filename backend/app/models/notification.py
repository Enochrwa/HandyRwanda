import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(String, nullable=False)
    payload = Column(JSONB, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
