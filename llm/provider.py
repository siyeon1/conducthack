"""llm/provider.py — the LLMProvider interface (Claude.MD §8.3). OWNED BY: Track A.

The graph and every cell depend ONLY on this abstraction — no cell imports the
Anthropic SDK or Ollama directly. This is what makes "swap to on-prem" a one-line
env change (the whole data-sovereignty differentiator, §3.3 / §11).

The interface is intentionally SYNCHRONOUS (as frozen in §8.3). Async callers wrap it
in `asyncio.to_thread(...)` so the FastAPI event loop is never blocked (§14 L3).
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def complete(
        self,
        system: str,
        user: str,
        *,
        schema: dict | None = None,
        max_tokens: int = 2000,
    ) -> dict | str:
        """Return the model's output.

        If `schema` (a JSON Schema dict, e.g. from `Model.model_json_schema()`) is
        provided, return a parsed structured object (dict) matching it; otherwise return
        text. Structured output is enforced via provider-native means (Claude: forced
        tool use / structured-outputs beta — §14 L8). This guarantees *format*, not
        *correctness* — callers must still validate against `state.graph`.
        """
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider id, e.g. "claude" | "ollama:qwen2.5-coder:7b" | "mock"."""
        ...

    @property
    @abstractmethod
    def runs_locally(self) -> bool:
        """True for on-prem providers (Ollama) — powers the "your code never leaves this
        machine" UI badge (§11)."""
        ...

    # Optional: providers may expose token/cost usage from the last call for metrics
    # (T2.5). Default = nothing recorded.
    @property
    def last_usage(self) -> dict:
        return {}
