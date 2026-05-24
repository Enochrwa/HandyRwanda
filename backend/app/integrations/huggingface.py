import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

HF_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN")
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}


async def get_job_category_match(
    job_description: str, candidate_labels: list[str]
) -> dict[str, Any]:
    """
    Suggest relevant service category using zero-shot classification.
    Uses the new Hugging Face Inference Router.
    """
    if not HF_TOKEN:
        return {}

    payload = {
        "inputs": job_description,
        "parameters": {"candidate_labels": candidate_labels},
    }

    url = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                url,
                headers=HEADERS,
                json=payload,
                timeout=30.0,
            )
            r.raise_for_status()
            return r.json()  # type: ignore
        except Exception:
            return {}


async def translate_message(text: str, src_lang: str, tgt_lang: str) -> str:
    """
    Translate chat message.
    Uses NLLB-200 for better support of African languages like Kinyarwanda.
    """
    if not HF_TOKEN or src_lang == tgt_lang:
        return text

    # NLLB-200 requires specific language codes (e.g., 'kin_Latn' for Kinyarwanda)
    # This is a simplified mapping for MVP
    lang_map = {
        "rw": "kin_Latn",
        "en": "eng_Latn",
        "fr": "fra_Latn",
        "sw": "swh_Latn",
    }

    src = lang_map.get(src_lang, src_lang)
    tgt = lang_map.get(tgt_lang, tgt_lang)

    url = "https://router.huggingface.co/hf-inference/models/facebook/nllb-200-distilled-600M"

    payload = {
        "inputs": text,
        "parameters": {"src_lang": src, "tgt_lang": tgt},
    }

    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(
                url,
                headers=HEADERS,
                json=payload,
                timeout=30.0,
            )
            if r.status_code != 200:
                return text
            result = r.json()
            if isinstance(result, list) and len(result) > 0:
                return str(result[0].get("translation_text", text))
            return text
        except Exception:
            return text
