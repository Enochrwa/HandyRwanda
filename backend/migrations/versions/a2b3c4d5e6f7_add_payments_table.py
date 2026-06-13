"""add payments table

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-02

Phase 1: Hybrid MTN MoMo / Airtel Money payment table.
Phase 2: api_request_id and api_reference will be populated when
         MTN/Airtel Collections API is integrated.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "a2b3c4d5e6f7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bookings.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "artisan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("amount", sa.Integer, nullable=False),
        sa.Column(
            "method",
            sa.Enum("mtn_momo", "airtel_money", name="paymentmethod"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "initiated",
                "pending_verification",
                "approved",
                "rejected",
                "refunded",
                "auto_verified",
                name="paymentstatus",
            ),
            nullable=False,
            server_default="initiated",
        ),
        sa.Column("reference_code", sa.String(20), unique=True, nullable=False),
        sa.Column("receiver_phone", sa.String(20), nullable=True),
        sa.Column("client_transaction_id", sa.String(100), nullable=True),
        sa.Column("proof_screenshot_url", sa.String(500), nullable=True),
        sa.Column("proof_submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("admin_note", sa.String(300), nullable=True),
        sa.Column(
            "verified_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("api_request_id", sa.String(100), nullable=True),
        sa.Column("api_reference", sa.String(100), nullable=True),
        sa.Column("auto_verified", sa.Boolean, server_default="false"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_payments_booking_id", "payments", ["booking_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_client_id", "payments", ["client_id"])


def downgrade() -> None:
    op.drop_table("payments")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS paymentmethod")
