# File: backend/app/services/sklearn_category_service.py
"""
Sprint 9 — sklearn TF-IDF Category Classifier & Job Description Assistant.

Replaces the pure-Python TF-IDF in category_classifier.py with a proper
sklearn TfidfVectorizer fitted on ALL historical job titles + descriptions
stored in the database.

Two main capabilities:
  1. classify_with_sklearn(text, candidate_labels) — higher-accuracy category
     prediction by computing cosine similarity of the query against per-category
     averaged TF-IDF vectors trained on real historical jobs.

  2. suggest_job_description(partial_description, db) — the POST /jobs/suggest
     endpoint logic.  Returns:
       • suggested_category (id, name_en, emoji)
       • confidence float [0, 1]
       • related_suggestions (up to 3 tips extracted from similar past jobs)
       • typical_price_range (min / max / currency) derived from matching past jobs

Both functions fall back to the pure-Python classifier (category_classifier.py)
when the sklearn index hasn't been built yet (e.g. on a fresh deploy with no
historical data).

The TF-IDF index is rebuilt nightly via APScheduler.
"""

from __future__ import annotations

import logging
import threading
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artisan import Category
from app.models.job import Job
from app.services.category_classifier import classify_job_category

_log = logging.getLogger(__name__)

# ── In-memory TF-IDF index ────────────────────────────────────────────────────
# Rebuilt nightly — no disk persistence needed (fast to rebuild from DB).
_index_lock = threading.Lock()

# Shared mutable state (updated atomically under _index_lock)
_tfidf_state: dict[str, Any] = {
    "vectorizer": None,       # fitted TfidfVectorizer
    "cat_matrix": None,       # shape (n_categories, n_features) — one row per category
    "cat_ids": [],            # list[str] — category UUIDs matching row order
    "cat_labels": [],         # list[str] — category name_en matching row order
    "cat_emojis": [],         # list[str | None]
    "job_texts": [],          # list[str] — all raw job texts (for similarity search)
    "job_meta": [],           # list[dict] — parallel metadata for each job text
    "job_matrix": None,       # shape (n_jobs, n_features) — for cosine similarity
    "built_at": None,         # ISO timestamp
    "n_jobs_indexed": 0,
}


async def build_tfidf_index(db: AsyncSession) -> dict[str, Any]:
    """
    Fit a TF-IDF vectorizer on all historical job titles + descriptions.
    Groups text by category to build per-category centroid vectors.
    Also stores all individual job vectors for similarity-based suggestions.

    Designed to run nightly via APScheduler.  Thread-safe via _index_lock.
    """
    import datetime  # noqa: PLC0415

    import numpy as np  # noqa: PLC0415
    from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: PLC0415

    _log.info("[TF-IDF] Building sklearn TF-IDF index from historical jobs…")

    # ── Fetch all past jobs with their categories ────────────────────────────
    jobs_result = await db.execute(
        select(
            Job.title,
            Job.description,
            Job.budget,
            Job.category_id,
        ).where(Job.title.isnot(None), Job.description.isnot(None))
        .limit(50_000)  # safety cap — more than enough for any real deployment
    )
    job_rows = jobs_result.fetchall()

    cats_result = await db.execute(
        select(Category).where(Category.is_active.is_(True))
    )
    categories = cats_result.scalars().all()

    if not categories:
        _log.warning("[TF-IDF] No categories found — index not built.")
        return {"status": "no_categories"}

    # Map category_id → category object
    cat_map: dict[str, Category] = {str(c.id): c for c in categories}

    # ── Build per-category document corpora ─────────────────────────────────
    # Each category gets one "mega-document" = all job texts concatenated
    cat_texts: dict[str, list[str]] = {cid: [] for cid in cat_map}
    job_texts: list[str] = []
    job_meta: list[dict[str, Any]] = []

    for title, desc, budget, cat_id in job_rows:
        combined = f"{title or ''} {desc or ''}".strip()
        if not combined:
            continue
        cid = str(cat_id)
        if cid in cat_texts:
            cat_texts[cid].append(combined)
        job_texts.append(combined)
        job_meta.append({
            "category_id": cid,
            "category_name": cat_map[cid].name_en if cid in cat_map else "Unknown",
            "budget": budget,
            "title": title,
            "description": desc,
        })

    if not job_texts:
        _log.warning("[TF-IDF] No job texts found — index not built.")
        return {"status": "no_jobs"}

    # ── Fit vectorizer on ALL job texts (learns vocabulary from real data) ───
    vectorizer = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),       # unigrams + bigrams
        min_df=2,                  # ignore very rare terms
        max_df=0.85,               # ignore very common terms
        max_features=15_000,       # cap vocabulary for speed
        sublinear_tf=True,         # log(1 + tf) for smoother weighting
        strip_accents="unicode",
        lowercase=True,
    )
    job_matrix = vectorizer.fit_transform(job_texts)

    # Build per-category centroid matrices
    cat_ids: list[str] = []
    cat_labels: list[str] = []
    cat_emojis: list[str | None] = []
    centroid_rows = []

    for cid, cat in cat_map.items():
        texts_for_cat = cat_texts.get(cid, [])
        # Also add the static keyword list from the legacy classifier as seed
        from app.services.category_classifier import CATEGORY_KEYWORDS  # noqa: PLC0415
        seed_text = " ".join(CATEGORY_KEYWORDS.get(cat.name_en, []))
        if seed_text:
            texts_for_cat = [seed_text] + texts_for_cat

        if not texts_for_cat:
            texts_for_cat = [cat.name_en]  # minimal fallback

        # Centroid = mean of TF-IDF vectors for this category
        cat_vecs = vectorizer.transform(texts_for_cat)
        centroid = np.asarray(cat_vecs.mean(axis=0)).flatten()
        centroid_rows.append(centroid)
        cat_ids.append(cid)
        cat_labels.append(cat.name_en)
        cat_emojis.append(cat.icon_emoji)

    cat_matrix = np.vstack(centroid_rows)  # (n_cats, n_features)

    built_at = datetime.datetime.utcnow().isoformat() + "Z"

    with _index_lock:
        _tfidf_state.update({
            "vectorizer": vectorizer,
            "cat_matrix": cat_matrix,
            "cat_ids": cat_ids,
            "cat_labels": cat_labels,
            "cat_emojis": cat_emojis,
            "job_texts": job_texts,
            "job_meta": job_meta,
            "job_matrix": job_matrix,
            "built_at": built_at,
            "n_jobs_indexed": len(job_texts),
        })

    _log.info(
        "[TF-IDF] Index built: %d categories, %d job texts, vocabulary=%d, at=%s",
        len(cat_ids),
        len(job_texts),
        len(vectorizer.vocabulary_),
        built_at,
    )
    return {
        "status": "built",
        "categories": len(cat_ids),
        "job_texts": len(job_texts),
        "vocabulary_size": len(vectorizer.vocabulary_),
        "built_at": built_at,
    }


def classify_with_sklearn(
    job_text: str,
    candidate_labels: list[str],
) -> dict[str, Any]:
    """
    Classify job text using the sklearn TF-IDF index.
    Falls back to the pure-Python classifier if the index isn't built yet.

    Returns the same shape as classify_job_category():
      { "labels": [...], "scores": [...], "source": "sklearn" | "local" }
    """
    from sklearn.metrics.pairwise import cosine_similarity  # noqa: PLC0415

    with _index_lock:
        vectorizer = _tfidf_state["vectorizer"]
        cat_matrix = _tfidf_state["cat_matrix"]

    if vectorizer is None or cat_matrix is None:
        # Index not built yet — use legacy fallback
        return classify_job_category(job_text, candidate_labels)

    # Filter to only requested labels (preserving order of cat_labels)
    label_set = set(candidate_labels)
    with _index_lock:
        cat_labels_local = _tfidf_state["cat_labels"][:]
        cat_matrix_local = _tfidf_state["cat_matrix"]

    mask = [i for i, lbl in enumerate(cat_labels_local) if lbl in label_set]
    if not mask:
        return classify_job_category(job_text, candidate_labels)

    filtered_labels = [cat_labels_local[i] for i in mask]
    filtered_matrix = cat_matrix_local[mask]

    query_vec = vectorizer.transform([job_text])
    sims = cosine_similarity(query_vec, filtered_matrix).flatten()

    # Blend with legacy classifier for robustness (keyword signals still valuable)
    legacy = classify_job_category(job_text, candidate_labels)
    legacy_map = dict(zip(legacy["labels"], legacy["scores"], strict=False))

    combined: list[tuple[str, float]] = []
    for label, sim in zip(filtered_labels, sims, strict=False):
        legacy_score = float(legacy_map.get(label, 0.0))
        blended = 0.6 * float(sim) + 0.4 * legacy_score
        combined.append((label, round(blended, 4)))

    combined.sort(key=lambda x: x[1], reverse=True)

    return {
        "labels": [x[0] for x in combined],
        "scores": [x[1] for x in combined],
        "source": "sklearn",
    }


# ── Job description suggestion ────────────────────────────────────────────────


def _classify_and_build_category(
    partial_description: str,
    categories: list[Any],
) -> tuple[dict[str, Any] | None, float, str]:
    """Classify text → (suggested_category dict | None, confidence, source)."""
    cat_labels = [c.name_en for c in categories]
    cat_by_name = {c.name_en: c for c in categories}

    classification = classify_with_sklearn(partial_description, cat_labels)
    best_label: str | None = classification["labels"][0] if classification["labels"] else None
    confidence: float = classification["scores"][0] if classification["scores"] else 0.0
    source: str = classification.get("source", "local")

    if best_label and best_label in cat_by_name:
        cat = cat_by_name[best_label]
        return (
            {
                "id": str(cat.id),
                "name_en": cat.name_en,
                "name_rw": cat.name_rw,
                "emoji": cat.icon_emoji or "🔧",
            },
            confidence,
            source,
        )
    return None, confidence, source


def _extract_similar_job_tips(
    partial_description: str,
    suggested_category: dict[str, Any] | None,
) -> list[str]:
    """Find top-3 similar historical job descriptions and extract suggestion tips."""
    import numpy as np  # noqa: PLC0415
    from sklearn.metrics.pairwise import cosine_similarity  # noqa: PLC0415

    with _index_lock:
        vectorizer = _tfidf_state["vectorizer"]
        job_matrix_ref = _tfidf_state["job_matrix"]
        job_meta: list[dict[str, Any]] = _tfidf_state["job_meta"][:]

    if vectorizer is None or job_matrix_ref is None or not job_meta:
        return []

    try:
        query_vec = vectorizer.transform([partial_description])
        sims = cosine_similarity(query_vec, job_matrix_ref).flatten()
        top_indices: list[int] = list(np.argsort(sims)[-8:][::-1])

        # Prefer same-category jobs
        if suggested_category:
            cat_id = suggested_category["id"]
            same_cat = [i for i in top_indices if job_meta[i].get("category_id") == cat_id]
            top_indices = (same_cat or top_indices)[:3]
        else:
            top_indices = top_indices[:3]

        tips: list[str] = []
        seen: set[str] = set()
        for idx in top_indices:
            desc_text = str(job_meta[idx].get("description") or "")
            key = desc_text[:50]
            if len(desc_text) > 30 and key not in seen:
                words = desc_text.split()
                if len(words) >= 8:
                    fragment = " ".join(words[:12])
                    tips.append(f'Similar clients mentioned: "{fragment}…"')
                    seen.add(key)
        return tips

    except Exception as exc:  # pragma: no cover
        _log.warning("[TF-IDF] Similar-job tip extraction error: %s", exc)
        return []


async def _fetch_price_range(
    db: AsyncSession,
    category_id: str,
) -> dict[str, Any] | None:
    """Query interquartile price range for completed jobs in this category."""
    price_result = await db.execute(
        text("""
        SELECT
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY j.budget) AS p25,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY j.budget) AS p75,
            COUNT(*) AS n
        FROM jobs j
        WHERE j.category_id = :cat_id
          AND j.budget IS NOT NULL
          AND j.budget > 0
          AND j.status = 'completed'
        """),
        {"cat_id": category_id},
    )
    row = price_result.fetchone()
    if not row or not row[2] or int(row[2]) < 3:
        return None
    p25, p75, n = int(row[0] or 0), int(row[1] or 0), int(row[2])
    if p25 <= 0 or p75 < p25:
        return None
    return {"min": p25, "max": p75, "currency": "RWF", "based_on": n}


async def suggest_job_description(
    partial_description: str,
    db: AsyncSession,
) -> dict[str, Any]:
    """
    Core logic for POST /jobs/suggest.

    1. Classify the partial description → best matching category.
    2. Find top-3 most similar historical job descriptions (cosine on TF-IDF).
    3. Extract "related suggestions" from those similar jobs.
    4. Compute typical price range from jobs in the same category.

    Returns:
    {
      "suggested_category": {"id": "...", "name_en": "...", "emoji": "..."},
      "confidence": 0.91,
      "related_suggestions": ["Also mention: ...", "Clients also requested: ..."],
      "typical_price_range": {"min": 5000, "max": 20000, "currency": "RWF"},
      "source": "sklearn" | "local"
    }
    """
    if not partial_description or not partial_description.strip():
        return {
            "suggested_category": None,
            "confidence": 0.0,
            "related_suggestions": [],
            "typical_price_range": None,
            "source": "empty_input",
        }

    # Step 1: Classify → category
    cats_result = await db.execute(select(Category).where(Category.is_active.is_(True)))
    categories = list(cats_result.scalars().all())
    suggested_category, confidence, source = _classify_and_build_category(
        partial_description, categories
    )

    # Step 2: Similar job tips (pure in-memory — no DB)
    related_suggestions = _extract_similar_job_tips(partial_description, suggested_category)

    # Step 3: Price range (DB query)
    typical_price_range: dict[str, Any] | None = None
    if suggested_category:
        try:
            typical_price_range = await _fetch_price_range(db, suggested_category["id"])
        except Exception as exc:
            _log.warning("[TF-IDF] Price range fetch error: %s", exc)

    # Step 4: Pad with static category prompts if we have fewer than 3 tips
    best_label = suggested_category["name_en"] if suggested_category else None
    if best_label:
        for tip in _CATEGORY_PROMPTS.get(best_label, []):
            if len(related_suggestions) >= 3:
                break
            if tip not in related_suggestions:
                related_suggestions.append(tip)

    return {
        "suggested_category": suggested_category,
        "confidence": round(confidence, 4),
        "related_suggestions": related_suggestions[:3],
        "typical_price_range": typical_price_range,
        "source": source,
    }



# ── Static category-specific description prompts ─────────────────────────────
# Surfaced as "related_suggestions" when similar job examples are sparse.

_CATEGORY_PROMPTS: dict[str, list[str]] = {
    "Plumbing": [
        "Also mention: is it the tank or the bowl? Is there water on the floor?",
        "Clients who posted similar jobs also specified: pipe material (PVC / metal)",
        "Helpful detail: approximate age of the plumbing installation",
    ],
    "Electrical": [
        "Also mention: which rooms are affected and what appliances are involved",
        "Clients also noted: whether the circuit breaker trips on reset",
        "Helpful detail: is this a new installation or a repair job?",
    ],
    "Cleaning": [
        "Also mention: number of rooms, floors, and bathrooms",
        "Clients who posted similar jobs also specified: carpet, oven, or fridge cleaning",
        "Helpful detail: do you provide cleaning supplies or should the artisan bring their own?",
    ],
    "Carpentry": [
        "Also mention: wood type and approximate dimensions",
        "Clients also noted: whether materials need to be sourced or are already available",
        "Helpful detail: attach photos of the damaged area if possible",
    ],
    "Painting": [
        "Also mention: wall dimensions, current colour, and desired finish",
        "Clients also noted: whether walls have cracks or peeling paint to address first",
        "Helpful detail: preferred paint brand or colour codes if you have them",
    ],
    "Masonry": [
        "Also mention: area size in m² and type of surface (floor / wall / outdoor)",
        "Clients also noted: type of tile or brick preferred",
        "Helpful detail: is this a repair or a new installation?",
    ],
    "Auto Repair": [
        "Also mention: vehicle make, model, year, and mileage",
        "Clients also noted: specific symptoms (sounds, smells, warning lights)",
        "Helpful detail: last service date and recent repairs help the mechanic prepare",
    ],
    "Tutoring": [
        "Also mention: student's grade level and specific subjects struggling with",
        "Clients also noted: preferred schedule (mornings, evenings, weekends)",
        "Helpful detail: whether sessions should be at home, at school, or online",
    ],
    "Gardening & Landscaping": [
        "Also mention: garden size in m² and type of work needed (mowing / pruning / planting)",
        "Clients also noted: frequency (one-time vs regular maintenance)",
        "Helpful detail: whether you provide tools or the artisan should bring their own",
    ],
    "Beauty & Wellness": [
        "Also mention: specific style references or inspiration photos if available",
        "Clients also noted: whether home service or studio visit is preferred",
        "Helpful detail: hair length, type, and current condition for hair services",
    ],
}


# ── Index health check ─────────────────────────────────────────────────────────


def get_tfidf_status() -> dict[str, Any]:
    """Return the current state of the TF-IDF index (for admin health endpoint)."""
    with _index_lock:
        return {
            "built": _tfidf_state["vectorizer"] is not None,
            "built_at": _tfidf_state["built_at"],
            "n_categories": len(_tfidf_state["cat_ids"]),
            "n_jobs_indexed": _tfidf_state["n_jobs_indexed"],
            "vocabulary_size": len(_tfidf_state["vectorizer"].vocabulary_)
            if _tfidf_state["vectorizer"] is not None
            else 0,
        }
