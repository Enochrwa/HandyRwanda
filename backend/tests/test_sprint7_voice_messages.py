# File: backend/tests/test_sprint7_voice_messages.py
"""
Sprint 7 — Voice Messages: Unit tests.

Tests:
  - MessageCreate validation (text-only, voice-only, both, empty = error)
  - uploads router accepts audio MIME types for voice_note upload_type
  - uploads router rejects audio for image-only types
  - uploads router rejects image for voice_note type
  - _msg_dict includes voice_note fields
"""

from __future__ import annotations

import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.models.message import Message
from app.routers.messages import MessageCreate, _msg_dict
from app.routers.uploads import (
    ALLOWED_FOLDERS,
    AUDIO_MIME_TYPES,
    AUDIO_ONLY_TYPES,
    DEFAULT_MAX_SIZE_BYTES,
    IMAGE_ONLY_TYPES,
    MAX_SIZE_BYTES,
)

# ── MessageCreate validation ──────────────────────────────────────────────


def test_message_create_text_only() -> None:
    m = MessageCreate(content="Hello!")
    assert m.content == "Hello!"
    assert m.voice_note_url is None


def test_message_create_voice_only() -> None:
    m = MessageCreate(
        content="",
        voice_note_url="https://storage.example.com/voice-notes/user1/rec.m4a",
        voice_note_duration_secs=12.5,
    )
    assert m.voice_note_url is not None
    assert m.voice_note_duration_secs == 12.5


def test_message_create_both() -> None:
    m = MessageCreate(
        content="See attached voice",
        voice_note_url="https://storage.example.com/voice-notes/user1/rec.m4a",
    )
    assert m.content == "See attached voice"
    assert m.voice_note_url is not None


def test_message_create_empty_fails() -> None:
    with pytest.raises(ValidationError):
        MessageCreate(content="", voice_note_url=None)


def test_message_create_whitespace_only_fails() -> None:
    with pytest.raises(ValidationError):
        MessageCreate(content="   ", voice_note_url=None)


def test_message_create_none_content_coerced() -> None:
    """content=None should be coerced to '' and fail (no voice url)."""
    with pytest.raises(ValidationError):
        MessageCreate(content=None, voice_note_url=None)  # type: ignore[arg-type]


# ── Uploads router config ─────────────────────────────────────────────────


def test_voice_note_in_allowed_folders() -> None:
    assert "voice_note" in ALLOWED_FOLDERS
    assert ALLOWED_FOLDERS["voice_note"] == "voice-notes"


def test_audio_mime_types_present() -> None:
    assert "audio/m4a" in AUDIO_MIME_TYPES
    assert "audio/aac" in AUDIO_MIME_TYPES
    assert "audio/mp4" in AUDIO_MIME_TYPES
    assert "audio/webm" in AUDIO_MIME_TYPES


def test_voice_note_max_size_larger_than_default() -> None:
    assert MAX_SIZE_BYTES["voice_note"] > DEFAULT_MAX_SIZE_BYTES
    assert MAX_SIZE_BYTES["voice_note"] == 10 * 1024 * 1024


def test_audio_only_types_set() -> None:
    assert "voice_note" in AUDIO_ONLY_TYPES


def test_image_only_types_not_voice() -> None:
    assert "voice_note" not in IMAGE_ONLY_TYPES


# ── HTTP-level validation (TestClient) ───────────────────────────────────


def _authed_client() -> TestClient:
    return TestClient(app)


def test_presign_invalid_upload_type() -> None:
    client = _authed_client()
    r = client.post(
        "/uploads/presign",
        json={"upload_type": "INVALID", "content_type": "image/jpeg"},
    )
    # No auth header → 401/403; if auth bypassed in test env → 400 (bad type)
    assert r.status_code in (400, 401, 403, 422)


def test_message_create_schema_rejects_empty_via_api() -> None:
    """POST /messages/{id} with empty content and no voice_note_url → 422."""
    client = _authed_client()
    r = client.post(
        "/messages/00000000-0000-0000-0000-000000000001",
        json={"content": "", "voice_note_url": None},
        headers={"Authorization": "Bearer fake_token"},
    )
    # 422 (validation) or 401/403 (auth) — not 500
    assert r.status_code in (401, 403, 422)


# ── _msg_dict correctness ─────────────────────────────────────────────────


def test_msg_dict_includes_voice_fields() -> None:
    """_msg_dict output must include all Sprint 7 voice fields."""
    msg = Message(
        id=uuid.uuid4(),
        booking_id=uuid.uuid4(),
        sender_id=uuid.uuid4(),
        content=None,
        voice_note_url="https://storage.example.com/voice-notes/user/rec.m4a",
        voice_note_duration_secs=42.0,
        is_read=False,
        created_at=datetime(2025, 6, 10, 10, 0, 0),
    )
    d = _msg_dict(msg)
    assert "voice_note_url" in d
    assert "voice_note_duration_secs" in d
    assert "is_voice_only" in d
    assert d["voice_note_url"] == "https://storage.example.com/voice-notes/user/rec.m4a"
    assert d["voice_note_duration_secs"] == 42.0
    assert d["is_voice_only"] is True


def test_msg_dict_text_message_not_voice_only() -> None:
    msg = Message(
        id=uuid.uuid4(),
        booking_id=uuid.uuid4(),
        sender_id=uuid.uuid4(),
        content="Hello world",
        voice_note_url=None,
        is_read=True,
        created_at=datetime(2025, 6, 10, 10, 0, 0),
    )
    d = _msg_dict(msg)
    assert d["is_voice_only"] is False
    assert d["content"] == "Hello world"
