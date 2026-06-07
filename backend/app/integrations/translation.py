# File: backend/app/integrations/translation.py
"""
HandyRwanda Translation Module — Zero-cost, self-hosted architecture.

ARCHITECTURE DECISION
=====================
After evaluating all options for Kinyarwanda support:

  Option                     | Kinyarwanda | Cost  | Latency | Self-hostable
  ---------------------------|-------------|-------|---------|---------------
  HuggingFace API (NLLB-600M)| Good        | Free* | 5-30s   | No (API)
  Self-hosted NLLB-600M      | Good        | Free  | 1-3s    | Yes (needs GPU)
  MarianMT (Helsinki-NLP)    | Limited*    | Free  | <1s     | Yes
  Argos Translate            | Limited*    | Free  | <500ms  | Yes
  LibreTranslate             | Limited     | Free  | <1s     | Yes (Docker)
  Google Translate API       | Excellent   | Paid  | <200ms  | No

  *HuggingFace free tier has cold-start delays and is an external dependency.
  *MarianMT/Argos: rw↔en coverage exists but is less accurate than NLLB.

CHOSEN STRATEGY (Bootstrap Phase)
==================================
1.  **Redis caching** for ALL translation paths — identical messages never
    translated twice. Cache TTL: 30 days. This dramatically reduces load.

2.  **HuggingFace NLLB-600M** (existing key) as PRIMARY engine — kept because:
    - The token is already paid for and active.
    - NLLB has the best Kinyarwanda accuracy of all free options.
    - Translations happen asynchronously AFTER message delivery (non-blocking).
    - On cache miss, the user sees original text immediately; translation
      appears within seconds on next fetch.

3.  **Language detection** is done locally using a fast character n-gram
    approach (no API, no external library). Kinyarwanda has distinctive
    trigrams that distinguish it reliably from EN/FR.

4.  **UPGRADE PATH** (when budget allows or traffic grows):
    - Deploy NLLB-600M on-premise (needs ~4GB RAM, works on CPU).
    - Replace HF_API_URL with local endpoint: http://localhost:8001/translate
    - Zero code changes beyond the env var TRANSLATION_BACKEND=local.

WHEN TRANSLATION RUNS
=====================
- Translation is triggered AFTER a message is stored in the DB.
- It runs as a background task (asyncio.create_task).
- Message delivery via WebSocket happens IMMEDIATELY (0ms overhead).
- The translated_content field is populated within ~3 seconds.
- Web/mobile poll or receive a WS update with the translated field.

This means translation NEVER blocks the user experience.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
from typing import Any

import httpx

from app.integrations.upstash import redis_get, redis_set

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HF_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN", "")
TRANSLATION_BACKEND = os.getenv("TRANSLATION_BACKEND", "huggingface")  # or "local"
LOCAL_TRANSLATION_URL = os.getenv("LOCAL_TRANSLATION_URL", "http://localhost:8001/translate")

# Cache TTL: 30 days — translations rarely change
TRANSLATION_CACHE_TTL = 30 * 24 * 60 * 60

# Supported language pairs for NLLB-200
NLLB_LANG_MAP: dict[str, str] = {
    "rw": "kin_Latn",   # Kinyarwanda
    "en": "eng_Latn",   # English
    "fr": "fra_Latn",   # French
    "sw": "swh_Latn",   # Swahili (bonus)
}

HF_NLLB_URL = (
    "https://router.huggingface.co/hf-inference/models/facebook/nllb-200-distilled-600M"
)

# ---------------------------------------------------------------------------
# Language Detection (local, zero-cost)
# ---------------------------------------------------------------------------

# Kinyarwanda distinctive trigrams (high precision for RW vs EN/FR)
_RW_TRIGRAMS = {
    "nde", "rwa", "ndi", "nta", "aba", "iki", "iri", "izi", "ubu", "umu",
    "ibi", "ama", "aka", "ugu", "ngo", "nga", "nyi", "sha", "twa",
    "mwe", "mba", "gus", "kub", "kur", "kug", "kuw", "ntw", "guk",
}

_FR_TRIGRAMS = {
    "les", "des", "est", "une", "pas", "que", "qui", "par", "sur", "ave",
    "mon", "ton", "son", "nous", "vous", "ils", "ell", "ain", "eur", "ien",
    "ait", "ant", "ent", "ons", "ion", "tio", "men", "pou", "pré",
}

_EN_TRIGRAMS = {
    "the", "and", "ing", "ion", "tio", "for", "not", "are", "you", "was",
    "tha", "wit", "his", "her", "its", "our", "can", "hav", "wil", "lik",
    "thi", "fro", "ome", "ork", "ith", "ter",
}


def detect_language(text: str) -> str:
    """
    Detect language of text using character trigram statistics.
    Returns ISO 639-1 code: 'rw', 'en', or 'fr'.
    Falls back to 'en' for very short or ambiguous text.
    """
    if not text or len(text.strip()) < 4:
        return "en"

    clean = text.lower()
    clean = re.sub(r"[^\w\s]", " ", clean)
    words = clean.split()

    # Generate word-level trigrams
    trigrams: set[str] = set()
    for word in words:
        for i in range(len(word) - 2):
            trigrams.add(word[i : i + 3])

    # Also check individual words for common Kinyarwanda morphemes
    word_set = set(words)
    rw_word_markers = {"ndi", "nta", "kuko", "ariko", "ngaho", "ubu", "aho",
                       "kandi", "ngo", "cyane", "buri", "muri", "mwe"}
    rw_word_hits = len(word_set & rw_word_markers)

    rw_score = len(trigrams & _RW_TRIGRAMS) + rw_word_hits * 2
    fr_score = len(trigrams & _FR_TRIGRAMS)
    en_score = len(trigrams & _EN_TRIGRAMS)

    scores = {"rw": rw_score, "fr": fr_score, "en": en_score}
    detected = max(scores, key=lambda k: scores[k])

    # Only return rw/fr if score is clearly above en
    if detected in ("rw", "fr") and scores[detected] <= scores["en"]:
        return "en"

    return detected


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_key(text: str, src: str, tgt: str) -> str:
    h = hashlib.md5(f"{src}:{tgt}:{text}".encode()).hexdigest()[:16]
    return f"trans:{h}"


async def _get_cached(text: str, src: str, tgt: str) -> str | None:
    try:
        return await redis_get(_cache_key(text, src, tgt))
    except Exception:
        return None


async def _set_cached(text: str, src: str, tgt: str, translated: str) -> None:
    try:
        await redis_set(_cache_key(text, src, tgt), translated, ttl_seconds=TRANSLATION_CACHE_TTL)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Translation backends
# ---------------------------------------------------------------------------

async def _translate_via_huggingface(text: str, src_lang: str, tgt_lang: str) -> str:
    """Call HuggingFace NLLB-200 REST API."""
    if not HF_TOKEN:
        return text

    src = NLLB_LANG_MAP.get(src_lang, src_lang)
    tgt = NLLB_LANG_MAP.get(tgt_lang, tgt_lang)

    payload = {
        "inputs": text,
        "parameters": {"src_lang": src, "tgt_lang": tgt},
    }
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(HF_NLLB_URL, headers=headers, json=payload)
            if r.status_code != 200:
                logger.warning("HF translation %s→%s HTTP %s", src_lang, tgt_lang, r.status_code)
                return text
            result = r.json()
            if isinstance(result, list) and result:
                return str(result[0].get("translation_text", text))
            return text
    except Exception as exc:
        logger.warning("HF translation error: %s", exc)
        return text


async def _translate_via_local(text: str, src_lang: str, tgt_lang: str) -> str:
    """Call self-hosted translation server (e.g. local NLLB, LibreTranslate)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                LOCAL_TRANSLATION_URL,
                json={"text": text, "source": src_lang, "target": tgt_lang},
            )
            if r.status_code == 200:
                data = r.json()
                return str(data.get("translated", text))
            return text
    except Exception as exc:
        logger.warning("Local translation error: %s", exc)
        return text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def translate_message(text: str, src_lang: str, tgt_lang: str) -> str:
    """
    Translate text from src_lang to tgt_lang with Redis caching.

    - Same language: returns immediately (no-op).
    - Cache hit: returns in <1ms.
    - Cache miss: calls backend (HuggingFace or local), stores result.
    - On any failure: returns original text (graceful degradation).

    This function is always called from background tasks, never from
    the request/response critical path.
    """
    src_lang = src_lang.lower().strip()
    tgt_lang = tgt_lang.lower().strip()

    if src_lang == tgt_lang or not text.strip():
        return text

    # Only translate between supported languages
    if src_lang not in NLLB_LANG_MAP or tgt_lang not in NLLB_LANG_MAP:
        return text

    # Cache check
    cached = await _get_cached(text, src_lang, tgt_lang)
    if cached is not None:
        return cached

    # Backend translation
    if TRANSLATION_BACKEND == "local":
        translated = await _translate_via_local(text, src_lang, tgt_lang)
    else:
        translated = await _translate_via_huggingface(text, src_lang, tgt_lang)

    if translated and translated != text:
        await _set_cached(text, src_lang, tgt_lang, translated)

    return translated


async def translate_for_user(
    text: str,
    author_lang: str,
    recipient_lang: str,
) -> tuple[str, str]:
    """
    Translate a message for the recipient if their language differs from author.

    Returns: (detected_author_lang, translated_text)
    The detected_author_lang is stored on the message for reference.
    """
    detected = detect_language(text) if author_lang == "auto" else author_lang
    if detected == recipient_lang:
        return detected, text

    translated = await translate_message(text, detected, recipient_lang)
    return detected, translated


def create_translation_task(
    text: str,
    src_lang: str,
    tgt_lang: str,
    on_complete: Any = None,
) -> asyncio.Task[str]:
    """
    Fire-and-forget background translation task.
    Optionally calls on_complete(translated_text) when done.
    Never raises — translation failures are logged and swallowed.
    """
    async def _run() -> str:
        try:
            result = await translate_message(text, src_lang, tgt_lang)
            if on_complete is not None:
                await on_complete(result)
            return result
        except Exception as exc:
            logger.warning("Background translation task failed: %s", exc)
            return text

    loop = asyncio.get_event_loop()
    if loop.is_running():
        return asyncio.ensure_future(_run())
    raise RuntimeError("No running event loop for translation task")
