"""v2 improvements: schedules, escrow, withdrawal, dispute evidence, user fcm/address fields

Revision ID: f7a8b9c0d1e2
Revises: a2b3c4d5e6f7
Create Date: 2025-06-03 00:00:00.000000
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic
revision = "f7a8b9c0d1e2"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── New columns on users ──────────────────────────────────────────────────
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("sector", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("cell", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("village", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("street_road", sa.String(200), nullable=True))
        batch_op.add_column(sa.Column("address_detail", sa.String(300), nullable=True))
        batch_op.add_column(sa.Column("fcm_push_token", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(
            sa.Column(
                "notification_prefs",
                sa.String(500),
                nullable=True,
                server_default='{"new_bid":true,"booking_update":true,"payment":true,"message":true,"promo":false}',
            )
        )

    # ── artisan_schedules ─────────────────────────────────────────────────────
    op.create_table(
        "artisan_schedules",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "artisan_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("artisan_profiles.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("ix_artisan_schedules_artisan_id", "artisan_schedules", ["artisan_id"])

    # ── artisan_blocked_dates ─────────────────────────────────────────────────
    op.create_table(
        "artisan_blocked_dates",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "artisan_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("artisan_profiles.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("blocked_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(200), nullable=True),
    )
    op.create_index("ix_artisan_blocked_dates_artisan_id", "artisan_blocked_dates", ["artisan_id"])

    # ── escrow_transactions ───────────────────────────────────────────────────
    op.create_table(
        "escrow_transactions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "booking_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("bookings.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("artisan_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("client_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("held", "released", "refunded", "disputed", name="escrowstatus"),
            nullable=False,
            server_default="held",
        ),
        sa.Column("held_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("release_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_by", sa.String(20), nullable=True),
        sa.Column("notes", sa.String(300), nullable=True),
    )
    op.create_index("ix_escrow_transactions_artisan_id", "escrow_transactions", ["artisan_id"])

    # ── withdrawal_requests ───────────────────────────────────────────────────
    op.create_table(
        "withdrawal_requests",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("artisan_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("momo_number", sa.String(20), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "processing", "paid", "rejected", name="withdrawalstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("admin_note", sa.String(300), nullable=True),
        sa.Column("processed_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_withdrawal_requests_artisan_id", "withdrawal_requests", ["artisan_id"])

    # ── dispute_evidence ──────────────────────────────────────────────────────
    op.create_table(
        "dispute_evidence",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("booking_id", sa.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("submitted_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "evidence_type",
            sa.Enum("photo", "statement", "receipt", name="disputeevidencetype"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_dispute_evidence_booking_id", "dispute_evidence", ["booking_id"])


def downgrade() -> None:
    op.drop_table("dispute_evidence")
    op.drop_table("withdrawal_requests")
    op.drop_table("escrow_transactions")
    op.drop_table("artisan_blocked_dates")
    op.drop_table("artisan_schedules")

    with op.batch_alter_table("users") as batch_op:
        for col in ["sector", "cell", "village", "street_road", "address_detail",
                    "fcm_push_token", "terms_accepted_at", "notification_prefs"]:
            batch_op.drop_column(col)
