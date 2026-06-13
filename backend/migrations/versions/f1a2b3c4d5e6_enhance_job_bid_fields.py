"""enhance job and bid fields - urgency, additional_notes, cover_letter, estimated_duration

Revision ID: f1a2b3c4d5e6
Revises: e5ad3e241444
Create Date: 2025-06-01 00:00:00.000000

"""
from alembic import op

revision = 'f1a2b3c4d5e6'
down_revision = 'e5ad3e241444'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add urgency enum type
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'joburgency') THEN
                CREATE TYPE joburgency AS ENUM (
                    'flexible', 'this_week', 'tomorrow', 'today', 'urgent'
                );
            END IF;
        END
        $$;
    """)

    # jobs table: new columns
    op.execute("""
        ALTER TABLE jobs
            ADD COLUMN IF NOT EXISTS additional_notes TEXT,
            ADD COLUMN IF NOT EXISTS urgency joburgency DEFAULT 'flexible',
            ADD COLUMN IF NOT EXISTS budget_negotiable BOOLEAN DEFAULT TRUE;
    """)

    # bids table: new columns
    op.execute("""
        ALTER TABLE bids
            ADD COLUMN IF NOT EXISTS cover_letter VARCHAR(500),
            ADD COLUMN IF NOT EXISTS estimated_duration_hours INTEGER;
    """)

    # Extend bids.message to 800 chars
    op.execute("""
        ALTER TABLE bids
            ALTER COLUMN message TYPE VARCHAR(800);
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE jobs
            DROP COLUMN IF EXISTS additional_notes,
            DROP COLUMN IF EXISTS urgency,
            DROP COLUMN IF EXISTS budget_negotiable;
    """)
    op.execute("""
        ALTER TABLE bids
            DROP COLUMN IF EXISTS cover_letter,
            DROP COLUMN IF EXISTS estimated_duration_hours;
    """)
