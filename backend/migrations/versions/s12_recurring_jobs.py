"""Sprint 12 — Recurring Job Subscriptions

Revision ID: s12_recurring_jobs
Revises: s11_price_negotiation
Create Date: 2026-06-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "s12_recurring_jobs"
down_revision = "s11_price_negotiation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Create recurring_schedules table ──────────────────────────────────────
    op.create_table(
        "recurring_schedules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("preferred_artisan_id", sa.Uuid(), nullable=True),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("district", sa.String(length=100), nullable=False),
        sa.Column("sector", sa.String(length=100), nullable=True),
        sa.Column("location_label", sa.String(length=400), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("budget_per_session", sa.Integer(), nullable=False),
        sa.Column(
            "frequency",
            sa.Enum("weekly", "biweekly", "monthly", name="recurringfrequency"),
            nullable=False,
        ),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("day_of_month", sa.Integer(), nullable=True),
        sa.Column("preferred_time", sa.Time(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("paused_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["preferred_artisan_id"], ["artisan_profiles.user_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_recurring_client_active", "recurring_schedules", ["client_id", "is_active"])
    op.create_index("ix_recurring_next_run", "recurring_schedules", ["next_run_at", "is_active"])

    # ── Add recurring_schedule_id FK to jobs ──────────────────────────────────
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.add_column(sa.Column("recurring_schedule_id", sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            "fk_jobs_recurring_schedule",
            "recurring_schedules",
            ["recurring_schedule_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.drop_constraint("fk_jobs_recurring_schedule", type_="foreignkey")
        batch_op.drop_column("recurring_schedule_id")

    op.drop_index("ix_recurring_next_run", table_name="recurring_schedules")
    op.drop_index("ix_recurring_client_active", table_name="recurring_schedules")
    op.drop_table("recurring_schedules")

    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        connection.execute(sa.text("DROP TYPE IF EXISTS recurringfrequency"))
