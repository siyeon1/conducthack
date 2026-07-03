"""llm/claude_provider.py — the Claude API provider (the demo path). Track A.

Structured output is produced via **forced tool use** — the most reliable, always-GA
way to get schema-guaranteed JSON out of Claude (§14 L8). A single tool named `emit`
is defined with the caller's JSON Schema as its `input_schema`, and `tool_choice`
forces the model to call it; we return the tool-call `input` dict.

NOTE (§15): the newer `structured-outputs-2025-11-13` beta (`client.beta.messages.parse`)
is an alternative — confirm its current availability against live Anthropic docs before
relying on it. Forced tool use needs no beta header and works today, so it is the default.
"""
from __future__ import annotations

import os

from llm.provider import LLMProvider

_DEFAULT_MODEL = "claude-sonnet-5"


class ClaudeProvider(LLMProvider):
    def __init__(self, model: str | None = None):
        # Imported lazily so the mock path never requires the SDK/key to be present.
        from anthropic import Anthropic

        self._model = model or os.getenv("LLM_MODEL") or _DEFAULT_MODEL
        self._client = Anthropic()  # reads ANTHROPIC_API_KEY from env
        self._last_usage: dict = {}

    def complete(
        self,
        system: str,
        user: str,
        *,
        schema: dict | None = None,
        max_tokens: int = 2000,
    ) -> dict | str:
        if schema is None:
            resp = self._client.messages.create(
                model=self._model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            self._record_usage(resp)
            return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")

        tool = {
            "name": "emit",
            "description": "Emit the structured result for this step. You MUST call this tool.",
            "input_schema": schema,
        }
        resp = self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
            tools=[tool],
            tool_choice={"type": "tool", "name": "emit"},
        )
        self._record_usage(resp)
        for block in resp.content:
            if getattr(block, "type", None) == "tool_use":
                return dict(block.input)
        # Model failed to call the tool — signal to the caller (node sets status:"error").
        raise ValueError("Claude did not return a tool_use block for the forced 'emit' tool.")

    def _record_usage(self, resp) -> None:
        u = getattr(resp, "usage", None)
        if u is None:
            return
        inp = getattr(u, "input_tokens", 0) or 0
        out = getattr(u, "output_tokens", 0) or 0
        self._last_usage = {"input_tokens": inp, "output_tokens": out, "model": self._model}

    @property
    def last_usage(self) -> dict:
        return dict(self._last_usage)

    @property
    def name(self) -> str:
        return "claude"

    @property
    def runs_locally(self) -> bool:
        return False
