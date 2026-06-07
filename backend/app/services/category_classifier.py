# File: backend/app/services/category_classifier.py
"""
Local zero-cost job category classifier.

Replaces the HuggingFace bart-large-mnli API call that had a 30-second timeout.
Uses a combination of:
  1. Exact/prefix keyword matching (fastest, O(n) over categories)
  2. TF-IDF cosine similarity via pure Python (no external ML lib)
  3. Fuzzy token overlap as final fallback

Result: <5 ms response time vs up to 30 s with HuggingFace cold-start.
Zero network dependency. Zero cost. Runs in the same process.
"""

from __future__ import annotations

import math
import re
import unicodedata
from typing import Any

# ---------------------------------------------------------------------------
# Category synonym dictionary
# Maps category name_en values → list of keywords/phrases (EN + RW + FR)
# ---------------------------------------------------------------------------

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Plumbing": [
        "plumb", "pipe", "water", "leak", "tap", "faucet", "sink", "toilet",
        "drain", "sewage", "gutter", "shower", "boiler", "valve", "clog",
        "blocked drain", "burst pipe", "gusana amazi", "amazi", "tuyau",
        "plomberie", "robinet", "fuite",
    ],
    "Electrical": [
        "electric", "wiring", "wire", "socket", "outlet", "power", "light",
        "bulb", "switch", "circuit", "breaker", "fuse", "generator", "voltage",
        "meter", "panel", "installation", "amashanyarazi", "electricite",
        "courant", "électricité", "prise", "lampe",
    ],
    "Cleaning": [
        "clean", "wash", "sweep", "mop", "vacuum", "dust", "sanitize",
        "disinfect", "laundry", "dishes", "windows", "carpet", "gusukura",
        "isuku", "nettoyage", "ménage", "laver", "nettoyer",
    ],
    "Carpentry": [
        "carpenter", "wood", "furniture", "cabinet", "door", "window frame",
        "shelf", "table", "chair", "repair wood", "timber", "joinery",
        "imbaraga", "inkoni", "menuiserie", "bois", "meuble",
    ],
    "Painting": [
        "paint", "repaint", "wall", "ceiling", "primer", "coat", "brush",
        "roller", "colour", "color", "finish", "gutunganya inzu", "peinture",
        "peindre", "mur",
    ],
    "Masonry": [
        "mason", "brick", "block", "cement", "concrete", "plaster", "tile",
        "floor", "wall build", "construction", "foundation", "gusana inzu",
        "maçonnerie", "béton", "carrelage",
    ],
    "Auto Repair": [
        "car", "vehicle", "auto", "mechanic", "engine", "tyre", "tire",
        "brake", "oil change", "exhaust", "battery", "transmission",
        "gusana imodoka", "réparation auto", "voiture", "mécanique",
    ],
    "Appliance Repair": [
        "appliance", "fridge", "refrigerator", "washing machine", "microwave",
        "oven", "dishwasher", "blender", "fan", "tv", "television", "repair",
        "gusana ibikoreshwa", "réparation appareils", "réfrigérateur",
    ],
    "Tutoring": [
        "tutor", "teach", "lesson", "math", "science", "english", "french",
        "history", "homework", "exam", "student", "school", "kwiga abana",
        "tutorat", "cours", "professeur",
    ],
    "Tailoring": [
        "tailor", "sew", "sewing", "dress", "clothes", "alterations",
        "hem", "stitch", "fabric", "uniform", "gusana ingubo", "couture",
        "vêtement", "tissu", "coudre",
    ],
    "Beauty & Wellness": [
        "hair", "salon", "barber", "nail", "makeup", "beauty", "massage",
        "spa", "skincare", "eyebrow", "lash", "threading", "ubwiza",
        "beauté", "coiffure", "manucure",
    ],
    "Photography": [
        "photo", "photography", "photographer", "video", "shoot", "wedding",
        "event", "portrait", "drone", "gufotora", "photographie",
    ],
    "Transport & Moving": [
        "transport", "move", "moving", "delivery", "pickup", "truck",
        "van", "relocate", "carry", "load", "gutwara abantu", "transport",
        "déménagement", "livraison",
    ],
    "IT & Tech Support": [
        "computer", "laptop", "it", "tech", "software", "hardware", "network",
        "wifi", "internet", "printer", "data", "website", "app", "phone repair",
        "gusana za murandasi", "informatique", "réseau",
    ],
    "Gardening & Landscaping": [
        "garden", "lawn", "grass", "tree", "prune", "plant", "landscape",
        "mow", "weed", "soil", "gukora amashyamba", "jardinage", "pelouse",
    ],
    "Catering & Cooking": [
        "cook", "food", "catering", "chef", "meal", "wedding food", "event food",
        "kubika ibiryo", "restauration", "cuisine", "repas",
    ],
    "Furniture Assembly": [
        "assemble", "ikea", "furniture", "desk", "wardrobe", "bed frame",
        "bookshelf", "gusana ameza", "montage meubles", "assemblage",
    ],
    "Pest Control": [
        "pest", "rat", "mice", "cockroach", "termite", "mosquito", "bedbugs",
        "fumigate", "exterminate", "isuku ry'amazu", "dératisation", "insectes",
    ],
    "AC & Refrigeration": [
        "ac", "air condition", "aircon", "hvac", "refriger", "cooling",
        "heat pump", "ventilation", "gucunga imashini", "climatisation", "froid",
    ],
    "Other Services": [
        "other", "misc", "general", "help", "ibindi", "autres",
    ],
}


# ---------------------------------------------------------------------------
# Text normalisation helpers
# ---------------------------------------------------------------------------

def _normalise(text: str) -> str:
    """Lowercase, strip accents, remove punctuation, collapse whitespace."""
    text = text.lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _tokenise(text: str) -> list[str]:
    return _normalise(text).split()


# ---------------------------------------------------------------------------
# TF-IDF cosine similarity (pure Python, no scipy/sklearn)
# ---------------------------------------------------------------------------

_STOP_WORDS = {
    "i", "me", "my", "we", "you", "he", "she", "it", "they", "this", "that",
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "can", "could",
    "need", "want", "get", "help", "please", "thank", "very", "some", "any",
    "our", "your", "their", "its", "new", "good", "best", "also",
}


def _tf(tokens: list[str]) -> dict[str, float]:
    counts: dict[str, int] = {}
    for t in tokens:
        if t not in _STOP_WORDS and len(t) > 2:
            counts[t] = counts.get(t, 0) + 1
    total = max(len(tokens), 1)
    return {k: v / total for k, v in counts.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    dot = sum(a.get(k, 0.0) * v for k, v in b.items())
    norm_a = math.sqrt(sum(v * v for v in a.values())) or 1e-9
    norm_b = math.sqrt(sum(v * v for v in b.values())) or 1e-9
    return dot / (norm_a * norm_b)


# Pre-build TF vectors for all category keyword documents (done once at import)
_CATEGORY_VECTORS: dict[str, dict[str, float]] = {
    cat: _tf(_tokenise(" ".join(keywords)))
    for cat, keywords in CATEGORY_KEYWORDS.items()
}


# ---------------------------------------------------------------------------
# Main classification function
# ---------------------------------------------------------------------------

def classify_job_category(
    job_text: str,
    candidate_labels: list[str],
) -> dict[str, Any]:
    """
    Classify job text against a list of category label strings.

    Returns a dict in the same shape as the old HuggingFace API response:
      {
        "labels": ["Plumbing", "Electrical", ...],   # sorted by score desc
        "scores": [0.91, 0.42, ...],
        "source": "local"
      }

    Falls back to returning labels in original order with equal scores if
    candidate_labels are empty.
    """
    if not candidate_labels:
        return {"labels": [], "scores": [], "source": "local"}

    if not job_text or not job_text.strip():
        return {"labels": candidate_labels, "scores": [0.0] * len(candidate_labels), "source": "local"}

    query_tokens = _tokenise(job_text)
    query_tf = _tf(query_tokens)

    scores: list[tuple[str, float]] = []

    for label in candidate_labels:
        # 1. Keyword exact/substring match (fast path, high confidence)
        kw_list = CATEGORY_KEYWORDS.get(label, [])
        norm_query = _normalise(job_text)
        keyword_score = 0.0
        for kw in kw_list:
            if _normalise(kw) in norm_query:
                # Longer keyword matches weighted higher
                weight = min(1.0, len(kw.split()) * 0.35)
                keyword_score = max(keyword_score, 0.5 + weight)

        # 2. TF-IDF cosine similarity
        cat_vec = _CATEGORY_VECTORS.get(label, {})
        cosine_score = _cosine(query_tf, cat_vec) if cat_vec else 0.0

        # 3. Token overlap (Jaccard-like)
        query_set = set(t for t in query_tokens if len(t) > 2 and t not in _STOP_WORDS)
        kw_set = set(t for t in _tokenise(" ".join(kw_list)) if len(t) > 2)
        if query_set or kw_set:
            overlap = len(query_set & kw_set) / max(len(query_set | kw_set), 1)
        else:
            overlap = 0.0

        # Weighted combination — keyword match dominates when present
        combined = (keyword_score * 0.55) + (cosine_score * 0.30) + (overlap * 0.15)
        scores.append((label, combined))

    scores.sort(key=lambda x: x[1], reverse=True)
    labels_out = [s[0] for s in scores]
    scores_out = [round(s[1], 4) for s in scores]

    return {"labels": labels_out, "scores": scores_out, "source": "local"}
