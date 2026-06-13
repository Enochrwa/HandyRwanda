# File: backend/migrations/versions/g1h2i3j4k5l6_structured_job_address.py
"""Add structured address fields to jobs table

Revision ID: g1h2i3j4k5l6
Revises: f7a8b9c0d1e2
Create Date: 2026-06-06 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = "g1h2i3j4k5l6"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("jobs") as batch_op:
        batch_op.add_column(sa.Column("province", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("district", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("sector", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("cell", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("village", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("street_road", sa.String(200), nullable=True))
        batch_op.add_column(sa.Column("house_number", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("landmark", sa.String(200), nullable=True))
        # latitude/longitude stored explicitly for easy queries (location is WKT)
        batch_op.add_column(sa.Column("latitude", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("longitude", sa.Float(), nullable=True))

    # Index on district for artisan matching queries
    op.create_index("ix_jobs_district", "jobs", ["district"])
    op.create_index("ix_jobs_sector", "jobs", ["sector"])


def downgrade() -> None:
    op.drop_index("ix_jobs_sector", table_name="jobs")
    op.drop_index("ix_jobs_district", table_name="jobs")
    with op.batch_alter_table("jobs") as batch_op:
        for col in [
            "province", "district", "sector", "cell", "village",
            "street_road", "house_number", "landmark", "latitude", "longitude",
        ]:
            batch_op.drop_column(col)


def upgrade_users() -> None:
    """Add province column to users table (called from upgrade())."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("province", sa.String(100), nullable=True))


# Patch upgrade to also run users migration
_orig_upgrade = upgrade


def upgrade() -> None:
    _orig_upgrade()
    upgrade_users()
