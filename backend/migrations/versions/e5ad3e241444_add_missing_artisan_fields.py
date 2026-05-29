"""add_missing_artisan_fields

Revision ID: e5ad3e241444
Revises: e1a2b3c4d5e6
Create Date: 2026-05-29 02:58:43.570420

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5ad3e241444"
down_revision: str | Sequence[str] | None = "e1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add missing columns to artisan_profiles table
    op.add_column(
        "artisan_profiles", sa.Column("id_document_url", sa.String(), nullable=True)
    )
    op.add_column(
        "artisan_profiles", sa.Column("selfie_url", sa.String(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove columns from artisan_profiles table
    op.drop_column("artisan_profiles", "selfie_url")
    op.drop_column("artisan_profiles", "id_document_url")
