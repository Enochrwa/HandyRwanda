# File: backend/migrations/versions/e1a2b3c4d5e6_robust_registration_fields.py

"""robust_registration_fields

Revision ID: e1a2b3c4d5e6
Revises: d5534d6d14f3
Create Date: 2025-05-28 00:00:00.000000

Adds extended identity, security metadata, account-status, and legal fields
to the users table to support robust registration.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e1a2b3c4d5e6"
down_revision: str | None = "d5534d6d14f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── New enums ────────────────────────────────────────────────────────────
    op.execute("CREATE TYPE gender AS ENUM ('male', 'female', 'prefer_not_to_say')")
    op.execute(
        "CREATE TYPE accountstatus AS ENUM "
        "('pending_verification', 'active', 'suspended', 'deactivated')"
    )

    # ── Extended identity columns ────────────────────────────────────────────
    op.add_column("users", sa.Column("date_of_birth", sa.Date(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "gender",
            sa.Enum("male", "female", "prefer_not_to_say", name="gender"),
            nullable=True,
        ),
    )
    op.add_column(
        "users", sa.Column("national_id", sa.String(length=20), nullable=True)
    )
    op.add_column("users", sa.Column("district", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("sector", sa.String(length=100), nullable=True))
    op.add_column(
        "users", sa.Column("address_detail", sa.String(length=300), nullable=True)
    )

    # ── Account status & verification ────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column(
            "account_status",
            sa.Enum(
                "pending_verification",
                "active",
                "suspended",
                "deactivated",
                name="accountstatus",
            ),
            nullable=False,
            server_default="active",  # existing users are already active
        ),
    )
    op.add_column(
        "users",
        sa.Column("email_verified", sa.Boolean(), nullable=True, server_default="true"),
    )
    op.add_column(
        "users",
        sa.Column(
            "phone_verified", sa.Boolean(), nullable=True, server_default="false"
        ),
    )

    # ── Security metadata ────────────────────────────────────────────────────
    op.add_column(
        "users", sa.Column("registration_ip", sa.String(length=45), nullable=True)
    )
    op.add_column(
        "users", sa.Column("last_login_ip", sa.String(length=45), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column(
            "failed_login_attempts", sa.Integer(), nullable=True, server_default="0"
        ),
    )
    op.add_column(
        "users",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Legal / compliance ───────────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column(
            "agreed_to_terms", sa.Boolean(), nullable=False, server_default="true"
        ),
    )
    op.add_column(
        "users", sa.Column("terms_version", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "users",
        sa.Column("agreed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── Make email non-nullable (it was nullable before) ────────────────────
    # Data migration: fill any null emails first (shouldn't exist in practice)
    op.execute(
        "UPDATE users SET email = CONCAT('unknown_', id::text, '@placeholder.invalid') "
        "WHERE email IS NULL"
    )
    op.alter_column("users", "email", nullable=False)


def downgrade() -> None:
    op.alter_column("users", "email", nullable=True)

    for col in [
        "agreed_at",
        "terms_version",
        "agreed_to_terms",
        "locked_until",
        "failed_login_attempts",
        "last_login_at",
        "last_login_ip",
        "registration_ip",
        "phone_verified",
        "email_verified",
        "account_status",
        "address_detail",
        "sector",
        "district",
        "national_id",
        "gender",
        "date_of_birth",
    ]:
        op.drop_column("users", col)

    op.execute("DROP TYPE IF EXISTS accountstatus")
    op.execute("DROP TYPE IF EXISTS gender")
