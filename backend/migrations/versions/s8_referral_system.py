"""Sprint 8: Referral System — wallet, referral code, transaction types

Revision ID: s8a1b2c3d4e5f
Revises: s7a1b2c3d4e5f
Create Date: 2026-06-10

Changes:
1. users.referral_code       — unique VARCHAR(20), nullable, indexed
2. users.wallet_balance_rwf  — INTEGER NOT NULL DEFAULT 0
3. transactions.description  — VARCHAR(300) nullable (for credit/credit_applied labels)
4. transactions.type enum    — add 'credit' and 'credit_applied' values
"""

import sqlalchemy as sa
from alembic import op

revision = "s8a1b2c3d4e5f"
down_revision = "s7a1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add referral_code column to users
    op.add_column(
        "users",
        sa.Column("referral_code", sa.String(20), nullable=True),
    )
    op.create_unique_constraint("uq_users_referral_code", "users", ["referral_code"])
    op.create_index("ix_users_referral_code", "users", ["referral_code"], unique=True)

    # 2. Add wallet_balance_rwf to users
    op.add_column(
        "users",
        sa.Column(
            "wallet_balance_rwf",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    # 3. Add description column to transactions
    op.add_column(
        "transactions",
        sa.Column("description", sa.String(300), nullable=True),
    )

    # 4. Extend the TransactionType enum with credit and credit_applied
    # PostgreSQL requires ALTER TYPE ... ADD VALUE; SQLite just recreates the column.
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        # PostgreSQL: add enum values (cannot be done inside a transaction for older PG)
        op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'credit'")
        op.execute(
            "ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'credit_applied'"
        )
    # SQLite: the Enum is stored as VARCHAR so no DDL change needed.


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_column("transactions", "description")
    op.drop_column("users", "wallet_balance_rwf")
    op.drop_index("ix_users_referral_code", table_name="users")
    op.drop_constraint("uq_users_referral_code", "users", type_="unique")
    op.drop_column("users", "referral_code")

    # Note: PostgreSQL does not support removing enum values without recreating the type.
    # Downgrade leaves the enum values in place on PostgreSQL.
