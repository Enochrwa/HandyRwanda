"""Sprint 10: Artisan Skill Verification via Video

Creates the `skill_videos` table — artisans submit short (≤60 sec) proof-of-skill
videos. Clients can watch before hiring. Admins approve or reject with a reason.

New table:
  skill_videos
    id                UUID PK
    artisan_id        UUID FK → artisan_profiles.user_id
    category_id       UUID FK → categories.id (nullable)
    video_url         TEXT NOT NULL
    thumbnail_url     TEXT
    title             VARCHAR(100) NOT NULL
    description       VARCHAR(300)
    duration_seconds  INTEGER
    is_approved       BOOLEAN DEFAULT FALSE
    rejection_reason  VARCHAR(500)
    view_count        INTEGER DEFAULT 0
    created_at        TIMESTAMPTZ DEFAULT now()

New endpoints (code-only, no DB changes needed for these):
  POST /artisans/me/skill-videos            — artisan submit video
  GET  /artisans/me/skill-videos            — artisan get own videos (all statuses)
  GET  /artisans/{id}/skill-videos          — public, approved only
  POST /artisans/skill-videos/{id}/view     — increment view count (rate-limited)
  DELETE /artisans/me/skill-videos/{id}     — artisan delete own video
  GET  /admin/skill-videos/pending          — admin queue
  POST /admin/skill-videos/{id}/approve     — admin approve + notify artisan
  POST /admin/skill-videos/{id}/reject      — admin reject + notify artisan

Revision ID: s10a1b2c3d4e5f
Revises: s9a1b2c3d4e5f
Create Date: 2026-06-11
"""

import sqlalchemy as sa
from alembic import op

revision = "s10a1b2c3d4e5f"
down_revision = "s9a1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "skill_videos",
        sa.Column(
            "id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "artisan_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("artisan_profiles.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "category_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("video_url", sa.Text(), nullable=False),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("description", sa.String(300), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("is_approved", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("rejection_reason", sa.String(500), nullable=True),
        sa.Column("view_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # Index for fetching approved videos for a given artisan quickly
    op.create_index(
        "ix_skill_videos_artisan_approved",
        "skill_videos",
        ["artisan_id", "is_approved"],
    )

    # Index for admin moderation queue (pending = not approved + no rejection reason)
    op.create_index(
        "ix_skill_videos_pending_review",
        "skill_videos",
        ["is_approved", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_skill_videos_pending_review", table_name="skill_videos")
    op.drop_index("ix_skill_videos_artisan_approved", table_name="skill_videos")
    op.drop_table("skill_videos")
