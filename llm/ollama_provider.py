"""llm/ollama_provider.py — on-prem sovereignty provider (Tier 3, §11). Track A.

The interface EXISTS now so the repo shows the design; the live demo (if any) runs only
the forgiving `explain` cell on it (§11 honesty note). Talks to Ollama's OpenAI-compatible
/api/chat. `runs_locally=True` lights the "your code never leaves this machine" badge.
"""
from __future__ import annotations

import json
import os

from llm.provider import LLMProvider

_DEFAULT_MODEL = "qwen2.5-coder:7b"


class OllamaProvider(LLMProvider):
    def __init__(self, model: str | None = None, host: str | None = None):
        self._model = model or os.getenv("LLM_MODEL") or _DEFAULT_MODEL
        self._host = (host or os.getenv("OLLAMA_HOST") or "http://localhost:11434").rstrip("/")

    def complete(
        self,
        system: str,
        user: str,
        *,
        schema: dict | None = None,
        max_tokens: int = 2000,
    ) -> dict | str:
        import httpx

        body = {
            "model": self._model,
            "stream": False,
            "options": {"num_predict": max_tokens},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if schema is not None:
            # Ollama supports structured outputs via `format` = a JSON schema.
            body["format"] = schema
        resp = httpx.post(f"{self._host}/api/chat", json=body, timeout=120)
        resp.raise_for_status()
        content = resp.json()["message"]["content"]
        if schema is None:
            return content
        return json.loads(content)

    @property
    def name(self) -> str:
        return f"ollama:{self._model}"

    @property
    def runs_locally(self) -> bool:
        return True
