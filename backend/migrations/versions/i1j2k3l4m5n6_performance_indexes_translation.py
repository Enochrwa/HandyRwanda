"""Add performance indexes and detected_lang column

Revision ID: i1j2k3l4m5n6
Revises: h1i2j3k4l5m6
Create Date: 2025-06-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "i1j2k3l4m5n6"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add detected_lang column to messages
    op.add_column(
        "messages",
        sa.Column("detected_lang", sa.String(5), nullable=True),
    )

    # Messages indexes
    op.create_index(
        "ix_messages_booking_created",
        "messages",
        ["booking_id", "created_at"],
    )
    op.create_index(
        "ix_messages_booking_sender_read",
        "messages",
        ["booking_id", "sender_id", "is_read"],
    )

    # Notifications index
    op.create_index(
        "ix_notifications_user_read_created",
        "notifications",
        ["user_id", "is_read", "created_at"],
    )

    # Jobs indexes
    op.create_index("ix_jobs_category_status", "jobs", ["category_id", "status"])
    op.create_index("ix_jobs_client_created", "jobs", ["client_id", "created_at"])
    op.create_index("ix_jobs_district_status", "jobs", ["district", "status"])

    # Bids indexes
    op.create_index("ix_bids_job_id", "bids", ["job_id"])
    op.create_index("ix_bids_artisan_status", "bids", ["artisan_id", "status"])

    # Bookings indexes
    op.create_index("ix_bookings_client_status", "bookings", ["client_id", "status"])
    op.create_index("ix_bookings_artisan_status", "bookings", ["artisan_id", "status"])
    op.create_index("ix_bookings_job_id", "bookings", ["job_id"])


def downgrade() -> None:
    op.drop_index("ix_bookings_job_id", "bookings")
    op.drop_index("ix_bookings_artisan_status", "bookings")
    op.drop_index("ix_bookings_client_status", "bookings")
    op.drop_index("ix_bids_artisan_status", "bids")
    op.drop_index("ix_bids_job_id", "bids")
    op.drop_index("ix_jobs_district_status", "jobs")
    op.drop_index("ix_jobs_client_created", "jobs")
    op.drop_index("ix_jobs_category_status", "jobs")
    op.drop_index("ix_notifications_user_read_created", "notifications")
    op.drop_index("ix_messages_booking_sender_read", "messages")
    op.drop_index("ix_messages_booking_created", "messages")
    op.drop_column("messages", "detected_lang")
