"""Harden job fields: add urgency, job_type, coordinates, special_requirements

Revision ID: f7g8h9i0j1k2
Revises: e5ad3e241444
Create Date: 2025-01-01 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f7g8h9i0j1k2"
down_revision: str | None = "f1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add urgency enum type
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE urgencylevel AS ENUM ('flexible','this_week','tomorrow','today','urgent');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # Add job_type enum type
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE jobtype AS ENUM ('one_time','recurring','emergency');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # Add new columns to jobs table
    op.execute("""
        ALTER TABLE jobs
            ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS budget_max INTEGER,
            ADD COLUMN IF NOT EXISTS special_requirements VARCHAR(500),
            ADD COLUMN IF NOT EXISTS is_remote_possible BOOLEAN DEFAULT FALSE
    """)

    # Add urgency column with default
    op.execute("""
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS urgency urgencylevel DEFAULT 'flexible' NOT NULL
    """)

    # Add job_type column with default
    op.execute("""
        ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type jobtype DEFAULT 'one_time' NOT NULL
    """)

    # Add estimated_duration_hours to bids
    op.execute("""
        ALTER TABLE bids ADD COLUMN IF NOT EXISTS estimated_duration_hours DOUBLE PRECISION
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE jobs
            DROP COLUMN IF EXISTS latitude,
            DROP COLUMN IF EXISTS longitude,
            DROP COLUMN IF EXISTS budget_max,
            DROP COLUMN IF EXISTS special_requirements,
            DROP COLUMN IF EXISTS is_remote_possible,
            DROP COLUMN IF EXISTS urgency,
            DROP COLUMN IF EXISTS job_type
    """)
    op.execute("ALTER TABLE bids DROP COLUMN IF EXISTS estimated_duration_hours")
