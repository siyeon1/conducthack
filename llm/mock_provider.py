"""llm/mock_provider.py — offline canned-payload provider (USE_MOCK_LLM=1). Track A.

Returns the canonical overdraft fixtures (fixtures.py) keyed off the requested
structured-output schema's title, so the ENTIRE pipeline runs end-to-end with no
API key (§9.5 mock-first integration). It intentionally implements the same frozen
LLMProvider interface as the real ClaudeProvider — nothing downstream knows it's a mock.
"""
from __future__ import annotations

import fixtures
from llm.provider import LLMProvider

# Program names the mock can recognise inside a prompt (to pick the explain payload).
_KNOWN_PROGRAMS = ("XFRFUN", "DBCRFUN", "BNK1TFN", "INQACC", "UPDACC", "CREACC", "DBCRFUN")


def _find_program_in_text(text: str) -> str | None:
    up = (text or "").upper()
    for prog in _KNOWN_PROGRAMS:
        if prog in up:
            return prog
    return None


class MockProvider(LLMProvider):
    def complete(
        self,
        system: str,
        user: str,
        *,
        schema: dict | None = None,
        max_tokens: int = 2000,
    ) -> dict | str:
        if schema is None:
            return "[mock] no structured schema requested."

        title = schema.get("title") if isinstance(schema, dict) else None

        if title == "ExplainPayload":
            prog = _find_program_in_text(user) or _find_program_in_text(system)
            return dict(fixtures.explain_for(prog))

        if title == "ProposePayload":
            # The propose node expects BOTH the one-paragraph explanation and the diff.
            return {**fixtures.PROPOSE_PAYLOAD, "diff": fixtures.PROPOSED_DIFF}

        if title in fixtures.MOCK_BY_SCHEMA:
            return dict(fixtures.MOCK_BY_SCHEMA[title])

        # Unknown schema — return an empty dict; nodes handle gracefully (status:"error"
        # is set upstream if a required field is missing).
        return {}

    @property
    def name(self) -> str:
        return "mock"

    @property
    def runs_locally(self) -> bool:
        # The mock is a stand-in, not a real on-prem model — do not light the badge.
        return False
