"""Sprint 11 — Price Negotiation / Counter-Offer fields on Bid model

Revision ID: s11_price_negotiation
Revises: s10_skill_video_verification
Create Date: 2026-06-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "s11_price_negotiation"
down_revision = "s10_skill_video_verification"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend BidStatus enum with negotiation values ─────────────────────────
    # We use ADD VALUE which is safe for PostgreSQL (no table lock).
    # For SQLite (test env) we use a batch alter approach.
    connection = op.get_bind()
    dialect = connection.dialect.name

    if dialect == "postgresql":
        # Add new enum values if they don't exist yet (idempotent)
        for val in ("countered_by_client", "artisan_countered", "negotiation_expired"):
            connection.execute(
                sa.text(
                    f"DO $$ BEGIN "
                    f"  ALTER TYPE bidstatus ADD VALUE IF NOT EXISTS '{val}'; "
                    f"EXCEPTION WHEN duplicate_object THEN null; "
                    f"END $$;"
                )
            )

    # ── Add negotiation columns to bids table ─────────────────────────────────
    with op.batch_alter_table("bids", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "negotiation_round",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column("counter_price", sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column("counter_message", sa.String(length=300), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "counter_at", sa.DateTime(timezone=True), nullable=True
            )
        )
        batch_op.add_column(
            sa.Column("artisan_counter_price", sa.Integer(), nullable=True)
        )
        batch_op.add_column(
            sa.Column(
                "artisan_counter_message", sa.String(length=300), nullable=True
            )
        )
        batch_op.add_column(
            sa.Column(
                "artisan_counter_at", sa.DateTime(timezone=True), nullable=True
            )
        )
        # Index for fast negotiation-active bid queries
        batch_op.create_index(
            "ix_bids_negotiation_status",
            ["status", "negotiation_round"],
        )


def downgrade() -> None:
    with op.batch_alter_table("bids", schema=None) as batch_op:
        batch_op.drop_index("ix_bids_negotiation_status")
        batch_op.drop_column("artisan_counter_at")
        batch_op.drop_column("artisan_counter_message")
        batch_op.drop_column("artisan_counter_price")
        batch_op.drop_column("counter_at")
        batch_op.drop_column("counter_message")
        batch_op.drop_column("counter_price")
        batch_op.drop_column("negotiation_round")
