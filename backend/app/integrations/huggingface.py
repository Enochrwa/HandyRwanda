# File: backend/app/integrations/huggingface.py
"""
HuggingFace integration — now a thin compatibility shim.

- get_job_category_match(): delegated to local classifier (zero latency, zero cost).
- translate_message(): delegated to translation module (cached, non-blocking).

The HuggingFace API is still used for translation via the translation module
(as the best free Kinyarwanda translation engine), but:
  1. It is called asynchronously / in background tasks only.
  2. Results are Redis-cached so repeat calls are instant.
  3. It can be replaced by a self-hosted backend via TRANSLATION_BACKEND env var.
"""

from __future__ import annotations

from typing import Any

from app.services.category_classifier import classify_job_category


async def get_job_category_match(
    job_description: str,
    candidate_labels: list[str],
) -> dict[str, Any]:
    """
    Classify job description against candidate category labels.
    Uses local TF-IDF + keyword matching — no network calls, <5ms response.
    Signature-compatible with the old HuggingFace API call.
    """
    return classify_job_category(job_description, candidate_labels)


# translate_message is now in app.integrations.translation
# Import it here for backwards compatibility with any existing callers.
from app.integrations.translation import translate_message  # noqa: E402, F401
