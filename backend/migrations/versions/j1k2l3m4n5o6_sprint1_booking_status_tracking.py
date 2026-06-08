"""Sprint 1: Real-Time Job Status Tracking — new BookingStatus values + tracking columns

Revision ID: j1k2l3m4n5o6
Revises: i1j2k3l4m5n6
Create Date: 2025-06-07 12:00:00.000000

Changes:
  - Add new BookingStatus enum values: artisan_accepted, artisan_en_route, arrived
  - Add new CancelledBy enum type
  - Add columns: eta_minutes, started_at, arrived_at, accepted_at, en_route_at
  - Add columns: cancelled_by, cancellation_reason
  - Add composite index on (status, created_at) for APScheduler queries
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "j1k2l3m4n5o6"
down_revision = "i1j2k3l4m5n6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Extend BookingStatus enum ─────────────────────────────────────────
    # PostgreSQL requires ALTER TYPE ... ADD VALUE (cannot be done in a transaction
    # for some PostgreSQL versions, so we use COMMIT-free approach with IF NOT EXISTS)
    conn = op.get_bind()

    # Check if we're using PostgreSQL
    is_pg = conn.dialect.name == "postgresql"

    if is_pg:
        conn.execute(sa.text(
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'artisan_accepted'"
        ))
        conn.execute(sa.text(
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'artisan_en_route'"
        ))
        conn.execute(sa.text(
            "ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'arrived'"
        ))
    else:
        # SQLite fallback (dev/test): recreate column with updated values
        # (SQLite doesn't have native enums so this is a no-op; values are stored as strings)
        pass

    # ── 2. Create CancelledBy enum ───────────────────────────────────────────
    if is_pg:
        cancelled_by_exists = conn.execute(sa.text(
            "SELECT 1 FROM pg_type WHERE typname = 'cancelledby'"
        )).fetchone()
        if not cancelled_by_exists:
            cancelled_by_enum = sa.Enum("client", "artisan", "system", name="cancelledby")
            cancelled_by_enum.create(conn)
    else:
        cancelled_by_enum = sa.Enum("client", "artisan", "system", name="cancelledby")

    # ── 3. Add new columns to bookings table ─────────────────────────────────
    op.add_column(
        "bookings",
        sa.Column("eta_minutes", sa.Integer(), nullable=True, comment="ETA in minutes when artisan is en route"),
    )
    op.add_column(
        "bookings",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True, comment="When artisan tapped Start Job"),
    )
    op.add_column(
        "bookings",
        sa.Column("arrived_at", sa.DateTime(timezone=True), nullable=True, comment="When artisan tapped Arrived"),
    )
    op.add_column(
        "bookings",
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True, comment="When artisan tapped Accept"),
    )
    op.add_column(
        "bookings",
        sa.Column("en_route_at", sa.DateTime(timezone=True), nullable=True, comment="When artisan tapped On My Way"),
    )

    if is_pg:
        op.add_column(
            "bookings",
            sa.Column(
                "cancelled_by",
                sa.Enum("client", "artisan", "system", name="cancelledby"),
                nullable=True,
            ),
        )
    else:
        op.add_column(
            "bookings",
            sa.Column("cancelled_by", sa.String(20), nullable=True),
        )

    op.add_column(
        "bookings",
        sa.Column("cancellation_reason", sa.String(500), nullable=True),
    )

    # ── 4. Add composite index for APScheduler timeout queries ───────────────
    op.create_index(
        "ix_bookings_status_created",
        "bookings",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_bookings_status_created", table_name="bookings")
    op.drop_column("bookings", "cancellation_reason")
    op.drop_column("bookings", "cancelled_by")
    op.drop_column("bookings", "en_route_at")
    op.drop_column("bookings", "accepted_at")
    op.drop_column("bookings", "arrived_at")
    op.drop_column("bookings", "started_at")
    op.drop_column("bookings", "eta_minutes")

    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        # Note: PostgreSQL does not support removing enum values.
        # The artisan_accepted / artisan_en_route / arrived values remain in the type.
        # In production, handle via a full enum recreation if truly needed.
        conn.execute(sa.text("DROP TYPE IF EXISTS cancelledby"))
