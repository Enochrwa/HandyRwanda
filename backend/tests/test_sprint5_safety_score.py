# File: backend/tests/test_sprint5_safety_score.py
"""
Sprint 5 — Community Safety Score: full test suite

Tests cover:
  1. Unit tests: score computation correctness per component
  2. Unit tests: tier assignment from score
  3. Unit tests: ScoreBreakdown.to_dict() serialization
  4. Integration tests: batch recalculation
  5. Integration tests: single artisan recalculation
  6. Edge cases: missing profile, zero values, score clamping
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.safety_score_service import (
    SCORE_WEIGHTS,
    ScoreBreakdown,
    compute_safety_score,
    get_score_tier,
    recalculate_all_scores,
    recalculate_single_score,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_profile(**kwargs):
    p = MagicMock()
    p.user_id = kwargs.get("user_id", uuid.uuid4())
    p.verification_status = kwargs.get("verification_status", "unverified")
    p.average_rating = kwargs.get("average_rating", 0.0)
    p.completion_rate = kwargs.get("completion_rate", 0.0)
    p.response_rate = kwargs.get("response_rate", 0.0)
    p.on_time_rate = kwargs.get("on_time_rate", 0.0)
    p.repeat_client_rate = kwargs.get("repeat_client_rate", 0.0)
    p.community_score = kwargs.get("community_score", 0)
    return p


def _make_user(days_active: int = 365):
    u = MagicMock()
    u.id = uuid.uuid4()
    u.created_at = datetime.now(timezone.utc) - timedelta(days=days_active)
    return u


def _make_db(profile, user, dispute_count: int = 0) -> AsyncMock:
    db = AsyncMock()
    scalar_iter = iter([profile, user])

    async def _scalar(stmt):
        try:
            return next(scalar_iter)
        except StopIteration:
            return None

    exec_result = MagicMock()
    exec_result.scalar_one.return_value = dispute_count
    exec_result.all.return_value = []

    async def _execute(stmt, params=None):
        return exec_result

    db.scalar = _scalar
    db.execute = _execute
    db.commit = AsyncMock()
    return db


# ── 1. Score component unit tests ─────────────────────────────────────────────

class TestScoreComponents:

    @pytest.mark.asyncio
    async def test_unverified_gets_zero_verification_points(self):
        profile = _make_profile(verification_status="unverified")
        db = _make_db(profile, _make_user(0), dispute_count=1)
        score = await compute_safety_score(profile.user_id, db)
        assert score == 0

    @pytest.mark.asyncio
    async def test_id_verified_gets_200_points(self):
        profile = _make_profile(verification_status="id_verified")
        db = _make_db(profile, _make_user(0), dispute_count=1)
        score = await compute_safety_score(profile.user_id, db)
        assert score == SCORE_WEIGHTS["id_verified"]

    @pytest.mark.asyncio
    async def test_pro_verified_gets_300_points(self):
        profile = _make_profile(verification_status="pro_verified")
        db = _make_db(profile, _make_user(0), dispute_count=1)
        score = await compute_safety_score(profile.user_id, db)
        assert score == (
            SCORE_WEIGHTS["id_verified"] + SCORE_WEIGHTS["pro_verified_bonus"]
        )

    @pytest.mark.asyncio
    async def test_perfect_rating_gives_200_rating_points(self):
        profile = _make_profile(average_rating=5.0)
        db = _make_db(profile, _make_user(0), dispute_count=1)
        score = await compute_safety_score(profile.user_id, db)
        assert score == SCORE_WEIGHTS["average_rating"]

    @pytest.mark.asyncio
    async def test_zero_disputes_gives_50_points(self):
        profile = _make_profile()
        db = _make_db(profile, _make_user(0), dispute_count=0)
        score = await compute_safety_score(profile.user_id, db)
        assert score == SCORE_WEIGHTS["zero_disputes"]

    @pytest.mark.asyncio
    async def test_one_dispute_gives_zero_dispute_points(self):
        profile = _make_profile()
        db = _make_db(profile, _make_user(0), dispute_count=1)
        score = await compute_safety_score(profile.user_id, db)
        assert score == 0

    @pytest.mark.asyncio
    async def test_full_year_account_gives_50_tenure_points(self):
        profile = _make_profile()
        db = _make_db(profile, _make_user(365), dispute_count=1)
        score = await compute_safety_score(profile.user_id, db)
        assert score == SCORE_WEIGHTS["account_age"]

    @pytest.mark.asyncio
    async def test_perfect_artisan_scores_1000(self):
        profile = _make_profile(
            verification_status="pro_verified",
            average_rating=5.0,
            completion_rate=1.0,
            response_rate=1.0,
            on_time_rate=1.0,
            repeat_client_rate=1.0,
        )
        db = _make_db(profile, _make_user(365), dispute_count=0)
        score = await compute_safety_score(profile.user_id, db)
        assert score == 1000

    @pytest.mark.asyncio
    async def test_score_capped_at_1000(self):
        """Raw sum can exceed 1000 (max is 1050); must be capped."""
        profile = _make_profile(
            verification_status="pro_verified",
            average_rating=5.0,
            completion_rate=9.9,
            response_rate=9.9,
            on_time_rate=9.9,
            repeat_client_rate=9.9,
        )
        db = _make_db(profile, _make_user(9999), dispute_count=0)
        score = await compute_safety_score(profile.user_id, db)
        assert score == 1000

    @pytest.mark.asyncio
    async def test_score_never_negative(self):
        profile = _make_profile()
        db = _make_db(profile, _make_user(0), dispute_count=99)
        score = await compute_safety_score(profile.user_id, db)
        assert score >= 0

    @pytest.mark.asyncio
    async def test_missing_profile_returns_zero(self):
        db = AsyncMock()

        async def _scalar(stmt):
            return None

        res = MagicMock()
        res.scalar_one.return_value = 0
        res.all.return_value = []

        async def _execute(stmt, params=None):
            return res

        db.scalar = _scalar
        db.execute = _execute
        score = await compute_safety_score(uuid.uuid4(), db)
        assert score == 0


# ── 2. Rating scaling ─────────────────────────────────────────────────────────

class TestRatingScaling:
    @pytest.mark.asyncio
    async def test_zero_rating_zero_points(self):
        profile = _make_profile(average_rating=0.0)
        db = _make_db(profile, _make_user(0), dispute_count=1)
        assert await compute_safety_score(profile.user_id, db) == 0

    @pytest.mark.asyncio
    async def test_half_rating_half_points(self):
        profile = _make_profile(average_rating=2.5)
        db = _make_db(profile, _make_user(0), dispute_count=1)
        score = await compute_safety_score(profile.user_id, db)
        expected = int(round((2.5 / 5.0) * SCORE_WEIGHTS["average_rating"]))
        assert abs(score - expected) <= 1

    @pytest.mark.asyncio
    async def test_max_rating_max_points(self):
        profile = _make_profile(average_rating=5.0)
        db = _make_db(profile, _make_user(0), dispute_count=1)
        score = await compute_safety_score(profile.user_id, db)
        assert score == SCORE_WEIGHTS["average_rating"]


# ── 3. Tier assignment ────────────────────────────────────────────────────────

class TestGetScoreTier:
    def test_zero_is_unranked(self):
        assert get_score_tier(0).label == "Unranked"

    def test_299_is_unranked(self):
        assert get_score_tier(299).label == "Unranked"

    def test_300_is_registered(self):
        assert get_score_tier(300).label == "Registered"

    def test_500_is_trusted(self):
        assert get_score_tier(500).label == "Trusted"

    def test_700_is_highly_trusted(self):
        assert get_score_tier(700).label == "Highly Trusted"

    def test_850_is_elite(self):
        assert get_score_tier(850).label == "Elite"

    def test_1000_is_legend(self):
        assert get_score_tier(1000).label == "Legend"

    def test_all_tiers_have_required_fields(self):
        for score in [0, 300, 500, 700, 850, 1000]:
            tier = get_score_tier(score)
            assert tier.emoji
            assert tier.label
            assert tier.color.startswith("#")
            assert isinstance(tier.min_score, int)


# ── 4. ScoreBreakdown serialization ──────────────────────────────────────────

class TestScoreBreakdownSerialization:
    @pytest.mark.asyncio
    async def test_to_dict_has_all_keys(self):
        profile = _make_profile(
            verification_status="id_verified",
            average_rating=4.5,
            completion_rate=0.9,
            response_rate=0.85,
            on_time_rate=0.8,
            repeat_client_rate=0.3,
        )
        db = _make_db(profile, _make_user(200), dispute_count=0)
        breakdown = await compute_safety_score(
            profile.user_id, db, return_breakdown=True
        )
        assert isinstance(breakdown, ScoreBreakdown)
        d = breakdown.to_dict()

        assert "artisan_id" in d
        assert "total_score" in d
        assert d["max_score"] == 1000
        assert "tier" in d
        assert {"emoji", "label", "color"} <= set(d["tier"].keys())
        assert "components" in d

        for key in [
            "id_verified", "pro_verified_bonus", "average_rating",
            "completion_rate", "response_rate", "on_time_rate",
            "repeat_client_rate", "zero_disputes", "account_age",
        ]:
            assert key in d["components"], f"Missing component: {key}"
            comp = d["components"][key]
            assert comp["points"] >= 0
            assert comp["max"] > 0
            assert "label" in comp
            assert "description" in comp

    @pytest.mark.asyncio
    async def test_component_points_match_total(self):
        profile = _make_profile(
            verification_status="pro_verified",
            average_rating=4.0,
            completion_rate=0.75,
            response_rate=0.6,
            on_time_rate=0.7,
            repeat_client_rate=0.4,
        )
        db = _make_db(profile, _make_user(180), dispute_count=1)
        breakdown = await compute_safety_score(
            profile.user_id, db, return_breakdown=True
        )
        d = breakdown.to_dict()
        component_sum = sum(d["components"][k]["points"] for k in d["components"])
        # Allow ±5 for floating-point rounding
        assert abs(component_sum - d["total_score"]) <= 5


# ── 5. SCORE_WEIGHTS integrity ────────────────────────────────────────────────

class TestScoreWeights:
    def test_raw_max_is_1050(self):
        assert sum(SCORE_WEIGHTS.values()) == 1050

    def test_all_weights_positive(self):
        for key, val in SCORE_WEIGHTS.items():
            assert val > 0, f"{key} weight must be > 0"

    def test_expected_components_present(self):
        expected = {
            "id_verified", "pro_verified_bonus", "average_rating",
            "completion_rate", "response_rate", "on_time_rate",
            "repeat_client_rate", "zero_disputes", "account_age",
        }
        assert set(SCORE_WEIGHTS.keys()) == expected


# ── 6. Batch recalculation ────────────────────────────────────────────────────

class TestBatchRecalculation:
    @pytest.mark.asyncio
    async def test_empty_artisan_table_returns_zero_counts(self):
        db = AsyncMock()
        res = MagicMock()
        res.all.return_value = []
        res.scalar_one.return_value = 0

        async def _execute(stmt, params=None):
            return res

        db.execute = _execute
        db.scalar = AsyncMock(return_value=None)
        db.commit = AsyncMock()

        result = await recalculate_all_scores(db)
        assert result["recalculated"] == 0
        assert result["errors"] == 0

    @pytest.mark.asyncio
    async def test_summary_keys_present(self):
        db = AsyncMock()
        res = MagicMock()
        res.all.return_value = []
        res.scalar_one.return_value = 0

        async def _execute(stmt, params=None):
            return res

        db.execute = _execute
        db.scalar = AsyncMock(return_value=None)
        db.commit = AsyncMock()

        result = await recalculate_all_scores(db)
        for key in ("recalculated", "errors", "total_artisans", "score_distribution"):
            assert key in result


# ── 7. Single recalculation ───────────────────────────────────────────────────

class TestSingleRecalculation:
    @pytest.mark.asyncio
    async def test_recalculate_persists_and_returns_score(self):
        aid = uuid.uuid4()
        profile = _make_profile(
            user_id=aid,
            verification_status="id_verified",
            average_rating=4.0,
            completion_rate=0.85,
            response_rate=0.9,
            on_time_rate=0.75,
            repeat_client_rate=0.5,
        )
        user = _make_user(300)
        db = _make_db(profile, user, dispute_count=0)

        score = await recalculate_single_score(aid, db)

        assert isinstance(score, int)
        assert 0 <= score <= 1000
        db.commit.assert_called_once()
