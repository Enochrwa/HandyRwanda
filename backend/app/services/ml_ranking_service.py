# File: backend/app/services/ml_ranking_service.py
"""
Sprint 9 — sklearn-Powered Smart Matching Upgrade.

Trains a GradientBoostingClassifier on historical bid→booking→outcome data to
predict P(artisan will be hired AND complete the job successfully).

Falls back gracefully to the heuristic sort (rating DESC, completion_rate DESC)
when the model has not been trained yet (< 100 labelled examples).

Model artefacts are serialised to disk with joblib so they survive hot-reloads.
Nightly retraining is scheduled via APScheduler in app/main.py.

Feature vector (8 dims):
  0  avg_rating_norm        — average_rating / 5.0
  1  completion_rate        — from artisan_profiles
  2  response_rate          — from artisan_profiles
  3  on_time_rate           — from artisan_profiles
  4  repeat_client_rate     — from artisan_profiles
  5  experience_years_norm  — min(years_experience / 10, 1.0)
  6  community_score_norm   — community_score / 1000.0
  7  district_match         — 1.0 same / 0.5 same province / 0.0 other
  8  is_verified            — 1.0 if id_verified or pro_verified else 0.0
  9  price_delta_norm       — 1 - abs(rate - budget) / max(budget, 1) capped [0,1]
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any

import joblib
import numpy as np
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_log = logging.getLogger(__name__)

# ── Model persistence paths (writable at runtime) ────────────────────────────
_MODEL_DIR = os.getenv("ML_MODEL_DIR", "/tmp/handyrwanda_ml")
MODEL_PATH = os.path.join(_MODEL_DIR, "ranking_model.pkl")
SCALER_PATH = os.path.join(_MODEL_DIR, "ranking_scaler.pkl")
META_PATH = os.path.join(_MODEL_DIR, "ranking_meta.json")

# Thread lock so concurrent requests don't race on load/save
_model_lock = threading.Lock()

# In-process cache — a single mutable dict avoids `global` statements
_STATE: dict[str, Any] = {
    "model": None,   # fitted GradientBoostingClassifier | None
    "scaler": None,  # fitted StandardScaler | None
}

MIN_TRAINING_SAMPLES = 100  # Won't train below this threshold

# ── Number of features ───────────────────────────────────────────────────────
N_FEATURES = 10


def _ensure_dir() -> None:
    os.makedirs(_MODEL_DIR, exist_ok=True)


# ── Feature helpers ───────────────────────────────────────────────────────────


def _build_feature_vector(c: dict[str, Any]) -> list[float]:
    """
    Build a deterministic 10-dim feature vector from an artisan candidate dict.

    The dict must contain the keys produced by find_matching_artisans_ml in
    matching_service.py.  Missing keys default to safe neutral values.
    """
    avg_rating = float(c.get("average_rating") or 0.0) / 5.0
    completion_rate = float(c.get("completion_rate") or 0.0)
    response_rate = float(c.get("response_rate") or 0.0)
    on_time_rate = float(c.get("on_time_rate") or 0.0)
    repeat_client_rate = float(c.get("repeat_client_rate") or 0.0)
    experience_years_norm = min(float(c.get("years_experience") or 0) / 10.0, 1.0)
    community_score_norm = min(float(c.get("community_score") or 0) / 1000.0, 1.0)
    district_match = float(c.get("district_match") or 0.0)
    is_verified = 1.0 if c.get("verification_status") in ("id_verified", "pro_verified") else 0.0

    # Price compatibility: how close is the artisan's hourly_rate to the job budget?
    hourly_rate = float(c.get("hourly_rate") or 0)
    job_budget = float(c.get("job_budget") or 0)
    if job_budget > 0 and hourly_rate > 0:
        price_delta_norm = max(0.0, 1.0 - abs(hourly_rate - job_budget) / job_budget)
    else:
        price_delta_norm = 0.5  # neutral when one side unknown

    return [
        avg_rating,
        completion_rate,
        response_rate,
        on_time_rate,
        repeat_client_rate,
        experience_years_norm,
        community_score_norm,
        district_match,
        is_verified,
        price_delta_norm,
    ]


# ── Training ─────────────────────────────────────────────────────────────────


async def train_ranking_model(db: AsyncSession) -> dict[str, Any]:
    """
    Train a GradientBoostingClassifier on historical bid→booking outcome data.

    Runs nightly via APScheduler.  Skips training when < MIN_TRAINING_SAMPLES
    labelled examples are available so the model never degrades on sparse data.

    Returns a summary dict suitable for logging.
    """
    import json  # noqa: PLC0415

    from sklearn.ensemble import GradientBoostingClassifier  # noqa: PLC0415
    from sklearn.metrics import roc_auc_score  # noqa: PLC0415
    from sklearn.model_selection import train_test_split  # noqa: PLC0415
    from sklearn.preprocessing import StandardScaler  # noqa: PLC0415

    _log.info("[MLRanking] Starting nightly model training…")

    rows = await db.execute(
        text("""
        SELECT
            COALESCE(ap.average_rating, 0.0) / 5.0           AS avg_rating_norm,
            COALESCE(ap.completion_rate, 0.0)                 AS completion_rate,
            COALESCE(ap.response_rate, 0.0)                   AS response_rate,
            COALESCE(ap.on_time_rate, 0.0)                    AS on_time_rate,
            COALESCE(ap.repeat_client_rate, 0.0)              AS repeat_client_rate,
            LEAST(COALESCE(ap.years_experience, 0)::float / 10.0, 1.0) AS exp_norm,
            LEAST(COALESCE(ap.community_score, 0)::float / 1000.0, 1.0) AS score_norm,
            CASE
                WHEN LOWER(COALESCE(u.district,'')) = LOWER(COALESCE(j.district,'')) THEN 1.0
                WHEN LOWER(COALESCE(u.province,'')) = LOWER(COALESCE(j.province,'')) THEN 0.5
                ELSE 0.0
            END                                                AS district_match,
            CASE WHEN ap.verification_status IN ('id_verified','pro_verified') THEN 1.0
                 ELSE 0.0 END                                  AS is_verified,
            CASE
                WHEN COALESCE(j.budget, 0) > 0 AND COALESCE(ap.hourly_rate, 0) > 0
                THEN GREATEST(0.0,
                        1.0 - ABS(ap.hourly_rate::float - j.budget::float) / j.budget::float
                     )
                ELSE 0.5
            END                                                AS price_delta_norm,
            CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END AS label
        FROM bids bid
        JOIN artisan_profiles ap ON bid.artisan_id = ap.user_id
        JOIN users u ON bid.artisan_id = u.id
        JOIN jobs j ON bid.job_id = j.id
        LEFT JOIN bookings b
            ON  b.job_id = j.id
            AND b.artisan_id = bid.artisan_id
        WHERE bid.created_at > NOW() - INTERVAL '6 months'
          AND j.status NOT IN ('open', 'cancelled')
        """)
    )
    data = rows.fetchall()

    if len(data) < MIN_TRAINING_SAMPLES:
        _log.info(
            "[MLRanking] Only %d labelled samples found (need %d) — skipping training.",
            len(data),
            MIN_TRAINING_SAMPLES,
        )
        return {
            "status": "skipped",
            "reason": f"insufficient_data ({len(data)} < {MIN_TRAINING_SAMPLES})",
            "samples": len(data),
        }

    features = np.array([list(row[:-1]) for row in data], dtype=np.float32)
    labels = np.array([int(row[-1]) for row in data], dtype=np.int32)

    # Stratified split for evaluation
    x_train, x_val, y_train, y_val = train_test_split(
        features, labels, test_size=0.15, random_state=42, stratify=labels
    )

    scaler = StandardScaler()
    x_train_scaled = scaler.fit_transform(x_train)
    x_val_scaled = scaler.transform(x_val)

    model = GradientBoostingClassifier(
        n_estimators=80,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.85,
        min_samples_leaf=5,
        random_state=42,
    )
    model.fit(x_train_scaled, y_train)

    # Evaluate
    val_preds = model.predict_proba(x_val_scaled)[:, 1]
    try:
        auc = round(float(roc_auc_score(y_val, val_preds)), 4)
    except Exception:
        auc = None

    # Feature importances for observability
    feature_names = [
        "avg_rating_norm", "completion_rate", "response_rate", "on_time_rate",
        "repeat_client_rate", "experience_years_norm", "community_score_norm",
        "district_match", "is_verified", "price_delta_norm",
    ]
    importances = {
        name: round(float(imp), 4)
        for name, imp in zip(feature_names, model.feature_importances_, strict=False)
    }

    # Persist artefacts
    _ensure_dir()
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    # Update in-process cache under lock
    with _model_lock:
        _STATE["model"] = model
        _STATE["scaler"] = scaler

    meta = {
        "trained_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "training_samples": len(data),
        "positive_labels": int(labels.sum()),
        "val_auc": auc,
        "feature_importances": importances,
    }
    with open(META_PATH, "w") as fh:
        json.dump(meta, fh, indent=2)

    _log.info(
        "[MLRanking] Training complete — %d samples, val_auc=%.4f",
        len(data),
        auc or 0.0,
    )
    return {"status": "trained", **meta}


# ── Inference ─────────────────────────────────────────────────────────────────


def _load_model_cached() -> tuple[Any, Any] | None:
    """Load model + scaler from cache or disk. Returns None if not available."""
    with _model_lock:
        if _STATE["model"] is not None and _STATE["scaler"] is not None:
            return _STATE["model"], _STATE["scaler"]

    # Try loading from disk
    try:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        with _model_lock:
            _STATE["model"] = model
            _STATE["scaler"] = scaler
        _log.debug("[MLRanking] Model loaded from disk.")
        return model, scaler
    except FileNotFoundError:
        return None
    except Exception as exc:
        _log.warning("[MLRanking] Failed to load model from disk: %s", exc)
        return None


def rank_artisans_ml(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Re-rank candidate artisans using the trained GradientBoosting model.

    Each candidate dict is enriched with:
      - ``ml_score``  — P(hire + complete) in [0, 1]
      - ``rank_source`` — "ml" | "heuristic"

    Falls back to heuristic sort if the model has not been trained yet.
    """
    if not candidates:
        return candidates

    loaded = _load_model_cached()

    if loaded is None:
        # Graceful fallback: heuristic sort
        _log.debug("[MLRanking] Model not available — using heuristic fallback.")
        ranked = sorted(
            candidates,
            key=lambda x: (
                float(x.get("average_rating") or 0),
                float(x.get("completion_rate") or 0),
                float(x.get("response_rate") or 0),
            ),
            reverse=True,
        )
        for c in ranked:
            c["ml_score"] = None
            c["rank_source"] = "heuristic"
        return ranked

    model, scaler = loaded

    try:
        features = np.array(
            [_build_feature_vector(c) for c in candidates], dtype=np.float32
        )
        scores = model.predict_proba(scaler.transform(features))[:, 1]

        for i, c in enumerate(candidates):
            c["ml_score"] = round(float(scores[i]), 4)
            c["rank_source"] = "ml"

        return sorted(candidates, key=lambda x: x["ml_score"], reverse=True)

    except Exception as exc:
        _log.warning("[MLRanking] Inference error — falling back to heuristic: %s", exc)
        ranked = sorted(
            candidates,
            key=lambda x: (
                float(x.get("average_rating") or 0),
                float(x.get("completion_rate") or 0),
            ),
            reverse=True,
        )
        for c in ranked:
            c["ml_score"] = None
            c["rank_source"] = "heuristic_fallback"
        return ranked


# ── Model metadata ─────────────────────────────────────────────────────────────


def get_model_metadata() -> dict[str, Any]:
    """
    Return metadata about the current model state.
    Used by the /admin/ml/ranking-status endpoint.
    """
    import json  # noqa: PLC0415

    loaded = _load_model_cached()
    if loaded is None:
        return {
            "status": "not_trained",
            "model_path": MODEL_PATH,
            "meta": None,
        }

    meta: dict[str, Any] = {}
    try:
        with open(META_PATH) as fh:
            meta = json.load(fh)
    except Exception:
        pass

    return {
        "status": "ready",
        "model_path": MODEL_PATH,
        "meta": meta,
    }
