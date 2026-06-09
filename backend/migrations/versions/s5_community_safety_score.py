"""Sprint 5: Community Safety Score — ensure community_score column is populated

Revision ID: s5a1b2c3d4e5f
Revises: h1i2j3k4l5m6
Create Date: 2025-06-09

This migration ensures:
1. community_score column has a proper default of 0 (column already exists)
2. Adds an index on community_score for efficient leaderboard / sort queries
3. Adds score_override_reason column for admin audit trail (optional text)
"""

from alembic import op
import sqlalchemy as sa

revision = "s5a1b2c3d4e5f"
down_revision = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # community_score column already exists. Ensure default is 0 (not null).
    op.execute(
        "UPDATE artisan_profiles SET community_score = 0 WHERE community_score IS NULL"
    )
    op.alter_column(
        "artisan_profiles",
        "community_score",
        existing_type=sa.Integer(),
        server_default="0",
        nullable=False,
    )

    # Add index on community_score for efficient sort/leaderboard queries
    op.create_index(
        "ix_artisan_profiles_community_score",
        "artisan_profiles",
        ["community_score"],
        unique=False,
    )

    # Add score_override_reason for admin audit trail
    op.add_column(
        "artisan_profiles",
        sa.Column(
            "score_override_reason",
            sa.String(500),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_index("ix_artisan_profiles_community_score", table_name="artisan_profiles")
    op.drop_column("artisan_profiles", "score_override_reason")
    op.alter_column(
        "artisan_profiles",
        "community_score",
        existing_type=sa.Integer(),
        server_default=None,
        nullable=True,
    )
