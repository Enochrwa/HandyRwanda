import httpx
import os

HF_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN")
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"} if HF_TOKEN else {}

async def get_job_category_match(job_description: str, candidate_labels: list[str]) -> list[dict]:
    """
    Suggest relevant service category using zero-shot classification.
    """
    if not HF_TOKEN:
        return []

    payload = {
        "inputs": job_description,
        "parameters": {"candidate_labels": candidate_labels}
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
            headers=HEADERS, json=payload, timeout=15.0)
        if r.status_code != 200:
            return []
        return r.json()

async def translate_message(text: str, src_lang: str, tgt_lang: str) -> str:
    """
    Translate chat message using Helsinki-NLP models.
    """
    if not HF_TOKEN or src_lang == tgt_lang:
        return text

    model = f"Helsinki-NLP/opus-mt-{src_lang}-{tgt_lang}"
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://api-inference.huggingface.co/models/{model}",
            headers=HEADERS, json={"inputs": text}, timeout=20.0)
        if r.status_code != 200:
            return text
        result = r.json()
        return result[0]["translation_text"] if isinstance(result, list) else text
