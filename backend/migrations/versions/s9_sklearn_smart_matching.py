"""Sprint 9: sklearn-Powered Smart Matching — no new DB columns needed.

This migration documents the Sprint 9 changes for tracking purposes.
All Sprint 9 features are purely computational (sklearn models trained from
existing DB data). No new columns or tables are required.

The sprint relies on the following existing columns that were already present:
  - artisan_profiles.average_rating
  - artisan_profiles.completion_rate
  - artisan_profiles.response_rate
  - artisan_profiles.on_time_rate
  - artisan_profiles.repeat_client_rate
  - artisan_profiles.years_experience
  - artisan_profiles.community_score
  - artisan_profiles.hourly_rate
  - artisan_profiles.verification_status
  - users.district, users.province
  - jobs.district, jobs.province, jobs.budget
  - bids.status
  - bookings.status

Revision ID: s9a1b2c3d4e5f
Revises: s8a1b2c3d4e5f
Create Date: 2026-06-11

Sprint 9 deliverables (code-only changes):
  1. app/services/ml_ranking_service.py      — GradientBoosting ranking model
  2. app/services/sklearn_category_service.py — TF-IDF category classifier + suggest
  3. app/services/matching_service.py        — upgraded with ML re-ranking
  4. app/routers/jobs.py                     — POST /jobs/suggest endpoint
  5. app/routers/admin.py                    — ML status + on-demand training endpoints
  6. app/main.py                             — nightly APScheduler jobs for ML
  7. web/src/                                — AI description assistant UI
  8. mobile/app/                             — AI description assistant mobile UI
"""

from alembic import op

revision = "s9a1b2c3d4e5f"
down_revision = "s8a1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No schema changes needed for Sprint 9 — ML is purely computational.
    # The migration record exists for sprint traceability.
    pass


def downgrade() -> None:
    pass
