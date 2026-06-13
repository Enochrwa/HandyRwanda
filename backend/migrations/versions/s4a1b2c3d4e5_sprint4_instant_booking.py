"""sprint4_instant_booking

Sprint 4 — Instant Booking (Alongside Bidding)

No schema changes required for Sprint 4:
- All necessary columns already exist on Booking model (agreed_price, status, etc.)
- The sprint adds new API endpoints only:
    GET  /artisans/previous         — previous artisans for a client
    POST /bookings/instant          — instant book a previous artisan
    POST /bookings/{id}/instant-confirm  — artisan confirms instant booking
    POST /bookings/{id}/instant-decline  — artisan declines instant booking
- Job.status=booked is already supported in JobStatus enum
- Booking.status=pending_payment is already the default

If future model changes are needed (e.g. instant_booking flag on Booking),
add them here.

Revision ID: s4a1b2c3d4e5
Revises: e1a2b3c4d5e6
Create Date: 2025-06-01
"""


# revision identifiers, used by Alembic.
revision = "s4a1b2c3d4e5"
down_revision = "e1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Sprint 4 is endpoint-only. No DDL changes needed.
    # This migration documents the sprint boundary.
    pass


def downgrade() -> None:
    pass
