"""Sprint 7: Voice Messages — make content nullable for voice-only messages

Revision ID: s7a1b2c3d4e5f
Revises: s5a1b2c3d4e5f
Create Date: 2025-06-10

Changes:
1. messages.content — allow NULL (voice-only messages have no text)
2. messages.voice_note_url — ensure index for efficient lookups
3. messages.voice_note_duration_secs — store audio duration for UI
"""

from alembic import op
import sqlalchemy as sa

revision = "s7a1b2c3d4e5f"
down_revision = "s5a1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Make content nullable so voice-only messages can omit text
    op.alter_column(
        "messages",
        "content",
        existing_type=sa.String(),
        nullable=True,
        server_default=None,
    )

    # 2. Add voice_note_duration_secs column for audio duration display
    op.add_column(
        "messages",
        sa.Column(
            "voice_note_duration_secs",
            sa.Float(),
            nullable=True,
        ),
    )

    # 3. Index for quickly finding voice messages (analytics + admin)
    op.create_index(
        "ix_messages_voice_note",
        "messages",
        ["voice_note_url"],
        postgresql_where=sa.text("voice_note_url IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_messages_voice_note", table_name="messages")
    op.drop_column("messages", "voice_note_duration_secs")
    # Restore NOT NULL — fill any nulls first
    op.execute("UPDATE messages SET content = '' WHERE content IS NULL")
    op.alter_column(
        "messages",
        "content",
        existing_type=sa.String(),
        nullable=False,
    )
