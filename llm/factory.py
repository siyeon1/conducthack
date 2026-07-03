"""llm/factory.py — provider selection from env (Claude.MD §8.3). Track A.

    get_provider() -> LLMProvider

Precedence:
  1. USE_MOCK_LLM in {1,true,yes}      → MockProvider  (offline canned payloads)
  2. LLM_PROVIDER == "ollama"          → OllamaProvider (on-prem, Tier 3)
  3. otherwise (default "claude")      → ClaudeProvider
"""
from __future__ import annotations

import os

from llm.provider import LLMProvider

_TRUE = {"1", "true", "yes", "on"}


def _use_mock() -> bool:
    return os.getenv("USE_MOCK_LLM", "0").strip().lower() in _TRUE


def get_provider() -> LLMProvider:
    if _use_mock():
        from llm.mock_provider import MockProvider

        return MockProvider()

    provider = os.getenv("LLM_PROVIDER", "claude").strip().lower()
    if provider == "ollama":
        from llm.ollama_provider import OllamaProvider

        return OllamaProvider()

    from llm.claude_provider import ClaudeProvider

    return ClaudeProvider()
