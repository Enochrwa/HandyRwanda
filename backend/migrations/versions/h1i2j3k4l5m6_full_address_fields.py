"""Full structured address fields on artisan_profiles and users

Revision ID: h1i2j3k4l5m6
Revises: g1h2i3j4k5l6
Create Date: 2026-06-06 12:00:00.000000

Adds complete Rwanda address hierarchy (province → district → sector → cell →
village → street_road → house_number → landmark) to:
  - artisan_profiles  (new — artisans need their own service-area address)
  - users             (house_number and landmark were missing)

Also adds indexes for district/sector on artisan_profiles to support
proximity search.
"""

import sqlalchemy as sa
from alembic import op

revision = "h1i2j3k4l5m6"
down_revision = "g1h2i3j4k5l6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── artisan_profiles: full structured address ─────────────────────────────
    with op.batch_alter_table("artisan_profiles") as batch_op:
        batch_op.add_column(sa.Column("province", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("district", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("sector", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("cell", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("village", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("street_road", sa.String(200), nullable=True))
        batch_op.add_column(sa.Column("house_number", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("landmark", sa.String(200), nullable=True))

    # Index artisan district/sector for matching queries
    op.create_index("ix_artisan_profiles_district", "artisan_profiles", ["district"])
    op.create_index("ix_artisan_profiles_sector", "artisan_profiles", ["sector"])

    # ── users: add house_number and landmark (street_road already added in f7a8b9c0d1e2) ──
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("house_number", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("landmark", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_index("ix_artisan_profiles_sector", table_name="artisan_profiles")
    op.drop_index("ix_artisan_profiles_district", table_name="artisan_profiles")
    with op.batch_alter_table("artisan_profiles") as batch_op:
        for col in [
            "province", "district", "sector", "cell", "village",
            "street_road", "house_number", "landmark",
        ]:
            batch_op.drop_column(col)

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("house_number")
        batch_op.drop_column("landmark")
