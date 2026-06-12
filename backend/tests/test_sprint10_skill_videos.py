"""Sprint 10 — Artisan Skill Verification via Video: backend tests.

Tests cover:
  - SkillVideo model fields and defaults
  - _video_to_dict serialisation helper
  - Upload MIME type enforcement (VIDEO_ONLY_TYPES, VIDEO_MIME_TYPES)
  - submit_skill_video: 5-video limit and 404 when profile missing
  - delete_skill_video: success and wrong-owner 404
  - get_artisan_skill_videos: public approved-only filter
  - increment_video_view: rate-limit skip, count, 404 for unapproved
  - Admin approve/reject: state transitions, empty-reason guard, 404s
  - Alembic migration: revision IDs and callable upgrade/downgrade
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

import migrations.versions.s10_skill_video_verification as s10_migration
from app.models.artisan import SkillVideo
from app.routers.admin import (
    VideoRejectionPayload,
    approve_skill_video,
    reject_skill_video,
)
from app.routers.artisans import (
    SkillVideoCreate,
    _video_to_dict,
    delete_skill_video,
    get_artisan_skill_videos,
    increment_video_view,
    submit_skill_video,
)
from app.routers.uploads import (
    ALLOWED_FOLDERS,
    AUDIO_ONLY_TYPES,
    IMAGE_ONLY_TYPES,
    MAX_SIZE_BYTES,
    VIDEO_MIME_TYPES,
    VIDEO_ONLY_TYPES,
)

# ── Test factories ─────────────────────────────────────────────────────────────

def _make_video(**kwargs) -> MagicMock:
    v = MagicMock()
    v.id = kwargs.get("id", uuid.uuid4())
    v.artisan_id = kwargs.get("artisan_id", uuid.uuid4())
    v.category_id = kwargs.get("category_id", None)
    v.video_url = kwargs.get("video_url", "https://cdn.example.com/skill-videos/test.mp4")
    v.thumbnail_url = kwargs.get("thumbnail_url", None)
    v.title = kwargs.get("title", "Fixing a leaky tap")
    v.description = kwargs.get("description", "Step-by-step fix")
    v.duration_seconds = kwargs.get("duration_seconds", 45)
    v.is_approved = kwargs.get("is_approved", False)
    v.rejection_reason = kwargs.get("rejection_reason", None)
    v.view_count = kwargs.get("view_count", 0)
    v.created_at = MagicMock()
    v.created_at.isoformat.return_value = "2026-06-01T10:00:00+00:00"
    return v


def _make_category(**kwargs) -> MagicMock:
    c = MagicMock()
    c.id = kwargs.get("id", uuid.uuid4())
    c.name_en = kwargs.get("name_en", "Plumbing")
    return c


def _make_user(**kwargs) -> MagicMock:
    u = MagicMock()
    u.id = kwargs.get("id", uuid.uuid4())
    u.full_name = kwargs.get("full_name", "Jean Paul")
    u.avatar_url = kwargs.get("avatar_url", None)
    u.role = kwargs.get("role", "artisan")
    u.is_active = True
    return u


def _make_admin_db(video, user, cat=None) -> AsyncMock:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.first.return_value = (video, user, cat)
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()
    return mock_db


# ══════════════════════════════════════════════════════════════════════════════
# _video_to_dict
# ══════════════════════════════════════════════════════════════════════════════

class TestVideoToDict:
    def test_approved_video_serialisation(self) -> None:
        video = _make_video(is_approved=True, view_count=42)
        result = _video_to_dict(video, _make_category(name_en="Electrical"))

        assert result["is_approved"] is True
        assert result["view_count"] == 42
        assert result["rejection_reason"] is None
        assert result["category_name"] == "Electrical"
        assert result["video_url"] == video.video_url

    def test_rejected_video_serialisation(self) -> None:
        video = _make_video(is_approved=False, rejection_reason="Poor lighting")
        result = _video_to_dict(video)

        assert result["is_approved"] is False
        assert result["rejection_reason"] == "Poor lighting"
        assert result["category_name"] is None

    def test_pending_video_has_no_rejection_reason(self) -> None:
        result = _video_to_dict(_make_video(is_approved=False, rejection_reason=None))
        assert result["rejection_reason"] is None

    def test_null_category_id_serialises_as_none(self) -> None:
        result = _video_to_dict(_make_video(category_id=None))
        assert result["category_id"] is None

    def test_category_id_serialises_as_string(self) -> None:
        cat_id = uuid.uuid4()
        result = _video_to_dict(_make_video(category_id=cat_id))
        assert result["category_id"] == str(cat_id)

    def test_duration_seconds_preserved(self) -> None:
        result = _video_to_dict(_make_video(duration_seconds=57))
        assert result["duration_seconds"] == 57


# ══════════════════════════════════════════════════════════════════════════════
# Upload MIME type enforcement
# ══════════════════════════════════════════════════════════════════════════════

class TestVideoMimeEnforcement:
    def test_skill_video_in_video_only_types(self) -> None:
        assert "skill_video" in VIDEO_ONLY_TYPES

    def test_video_mime_includes_mp4(self) -> None:
        assert "video/mp4" in VIDEO_MIME_TYPES

    def test_video_mime_includes_quicktime(self) -> None:
        assert "video/quicktime" in VIDEO_MIME_TYPES

    def test_skill_video_max_size_is_50mb(self) -> None:
        assert MAX_SIZE_BYTES["skill_video"] == 50 * 1024 * 1024

    def test_skill_video_folder_maps_to_skill_videos(self) -> None:
        assert ALLOWED_FOLDERS["skill_video"] == "skill-videos"

    def test_skill_video_not_in_image_only_types(self) -> None:
        assert "skill_video" not in IMAGE_ONLY_TYPES

    def test_skill_video_not_in_audio_only_types(self) -> None:
        assert "skill_video" not in AUDIO_ONLY_TYPES


# ══════════════════════════════════════════════════════════════════════════════
# SkillVideo model
# ══════════════════════════════════════════════════════════════════════════════

class TestSkillVideoModel:
    def _cols(self):
        return {c.key for c in SkillVideo.__table__.columns}

    def test_required_columns_exist(self) -> None:
        required = {"id", "artisan_id", "video_url", "title", "is_approved", "view_count", "created_at"}
        assert required <= self._cols(), f"Missing: {required - self._cols()}"

    def test_optional_columns_exist(self) -> None:
        optional = {"thumbnail_url", "description", "duration_seconds", "rejection_reason", "category_id"}
        assert optional <= self._cols()

    def test_table_name(self) -> None:
        assert SkillVideo.__tablename__ == "skill_videos"

    def test_artisan_id_fk_points_to_artisan_profiles(self) -> None:
        col = SkillVideo.__table__.columns["artisan_id"]
        fk_tables = {fk.column.table.name for fk in col.foreign_keys}
        assert "artisan_profiles" in fk_tables

    def test_is_approved_has_server_default(self) -> None:
        col = SkillVideo.__table__.columns["is_approved"]
        assert col.server_default is not None or col.default is not None

    def test_view_count_has_server_default(self) -> None:
        col = SkillVideo.__table__.columns["view_count"]
        assert col.server_default is not None or col.default is not None


# ══════════════════════════════════════════════════════════════════════════════
# submit_skill_video
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestSubmitSkillVideo:
    async def test_max_5_videos_enforced(self) -> None:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.first.return_value = (MagicMock(), _make_user())
        mock_db.execute.return_value = mock_result
        mock_db.scalar = AsyncMock(return_value=5)

        with pytest.raises(HTTPException) as exc:
            await submit_skill_video(
                SkillVideoCreate(video_url="https://cdn.x.com/v.mp4", title="New"),
                mock_db,
                {"sub": str(uuid.uuid4())},
            )
        assert exc.value.status_code == 400
        assert "Maximum 5" in exc.value.detail

    async def test_artisan_not_found_raises_404(self) -> None:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_db.execute.return_value = mock_result

        with pytest.raises(HTTPException) as exc:
            await submit_skill_video(
                SkillVideoCreate(video_url="https://cdn.x.com/v.mp4", title="My Video"),
                mock_db,
                {"sub": str(uuid.uuid4())},
            )
        assert exc.value.status_code == 404

    async def test_category_id_is_optional_in_pydantic_model(self) -> None:
        payload = SkillVideoCreate(video_url="https://cdn.x.com/v.mp4", title="Demo")
        assert payload.category_id is None


# ══════════════════════════════════════════════════════════════════════════════
# delete_skill_video
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestDeleteSkillVideo:
    async def test_delete_success_returns_message(self) -> None:
        user_id = uuid.uuid4()
        video = _make_video(artisan_id=user_id)
        mock_db = AsyncMock()
        mock_db.scalar = AsyncMock(return_value=video)

        result = await delete_skill_video(video.id, mock_db, {"sub": str(user_id)})
        assert result["message"] == "Video deleted successfully."

    async def test_delete_wrong_owner_raises_404(self) -> None:
        mock_db = AsyncMock()
        mock_db.scalar = AsyncMock(return_value=None)

        with pytest.raises(HTTPException) as exc:
            await delete_skill_video(uuid.uuid4(), mock_db, {"sub": str(uuid.uuid4())})
        assert exc.value.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# get_artisan_skill_videos (public, approved-only)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestPublicSkillVideos:
    async def test_returns_approved_videos(self) -> None:
        approved = _make_video(is_approved=True, view_count=10)
        category = _make_category()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = [(approved, category)]
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await get_artisan_skill_videos(uuid.uuid4(), mock_db)

        assert len(result) == 1
        assert result[0]["is_approved"] is True

    async def test_returns_empty_when_none_approved(self) -> None:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        assert await get_artisan_skill_videos(uuid.uuid4(), mock_db) == []


# ══════════════════════════════════════════════════════════════════════════════
# increment_video_view
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestVideoViewCount:
    async def test_increments_for_approved_video(self) -> None:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.fetchone.return_value = (7,)
        mock_db.execute = AsyncMock(return_value=mock_result)

        with (
            patch("app.integrations.upstash.redis_get", new_callable=AsyncMock, return_value=None),
            patch("app.integrations.upstash.redis_set", new_callable=AsyncMock),
        ):
            result = await increment_video_view(uuid.uuid4(), mock_db)

        assert result["counted"] is True
        assert result["view_count"] == 7

    async def test_skips_when_rate_limited(self) -> None:
        mock_db = AsyncMock()
        with patch("app.integrations.upstash.redis_get", new_callable=AsyncMock, return_value="1"):
            result = await increment_video_view(uuid.uuid4(), mock_db)

        assert result["counted"] is False
        mock_db.execute.assert_not_called()

    async def test_raises_404_when_video_not_found_or_unapproved(self) -> None:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.fetchone.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        with (
            patch("app.integrations.upstash.redis_get", new_callable=AsyncMock, return_value=None),
            pytest.raises(HTTPException) as exc,
        ):
            await increment_video_view(uuid.uuid4(), mock_db)

        assert exc.value.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# Admin moderation
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
class TestAdminVideoModeration:
    async def test_approve_sets_is_approved_true(self) -> None:
        video = _make_video(is_approved=False)
        mock_db = _make_admin_db(video, _make_user(), _make_category())

        with patch("app.routers.notifications.create_and_push_notification", new_callable=AsyncMock):
            result = await approve_skill_video(video.id, mock_db, {"sub": str(uuid.uuid4())})

        assert video.is_approved is True
        assert "approved" in result["message"].lower()

    async def test_approve_already_approved_raises_400(self) -> None:
        video = _make_video(is_approved=True)
        mock_db = _make_admin_db(video, _make_user())

        with pytest.raises(HTTPException) as exc:
            await approve_skill_video(video.id, mock_db, {"sub": str(uuid.uuid4())})
        assert exc.value.status_code == 400

    async def test_approve_nonexistent_raises_404(self) -> None:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc:
            await approve_skill_video(uuid.uuid4(), mock_db, {"sub": str(uuid.uuid4())})
        assert exc.value.status_code == 404

    async def test_reject_sets_rejection_reason(self) -> None:
        video = _make_video(is_approved=False)
        reason = "Video too dark — skill not clearly visible"
        mock_db = _make_admin_db(video, _make_user(), _make_category())

        with patch("app.routers.notifications.create_and_push_notification", new_callable=AsyncMock):
            result = await reject_skill_video(
                video.id,
                VideoRejectionPayload(reason=reason),
                mock_db,
                {"sub": str(uuid.uuid4())},
            )

        assert video.rejection_reason == reason
        assert result["rejection_reason"] == reason

    async def test_reject_whitespace_reason_raises_400(self) -> None:
        mock_db = _make_admin_db(_make_video(), _make_user())

        with pytest.raises(HTTPException) as exc:
            await reject_skill_video(
                uuid.uuid4(),
                VideoRejectionPayload(reason="   "),
                mock_db,
                {"sub": str(uuid.uuid4())},
            )
        assert exc.value.status_code == 400

    async def test_reject_nonexistent_raises_404(self) -> None:
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc:
            await reject_skill_video(
                uuid.uuid4(),
                VideoRejectionPayload(reason="Not relevant"),
                mock_db,
                {"sub": str(uuid.uuid4())},
            )
        assert exc.value.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# Migration file integrity
# ══════════════════════════════════════════════════════════════════════════════

class TestMigrationFile:
    def test_revision_ids(self) -> None:
        assert s10_migration.revision == "s10a1b2c3d4e5f"
        assert s10_migration.down_revision == "s9a1b2c3d4e5f"

    def test_upgrade_and_downgrade_callable(self) -> None:
        assert callable(s10_migration.upgrade)
        assert callable(s10_migration.downgrade)
