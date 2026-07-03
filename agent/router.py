"""agent/router.py — the (internal, pre-Locate) router (§8.4). Track A.

Maps a free-text change request → intent + seed symbols. Runs inside locate_node the first
time a session's Locate cell is run (so it is invisible to the user, exactly as specified).
Never keyword-matches to a program — that is the deterministic graph's job (§5 anti-pattern).
"""
from __future__ import annotations

import asyncio

from agent.prompts import ROUTER_SYSTEM, RouterOutput
from llm import get_provider


async def run_router(change_request: str) -> dict:
    """Return {"intent": str, "seed_symbols": list[str]}. Never raises — falls back to a
    neutral classification so the pipeline continues (graceful failure, §16)."""
    prov = get_provider()
    user = f"Change request:\n{change_request}\n\nClassify it and extract seed symbols."
    try:
        result = await asyncio.to_thread(
            prov.complete, ROUTER_SYSTEM, user, schema=RouterOutput.model_json_schema()
        )
        if isinstance(result, dict):
            # Coerce to the RouterOutput contract: intent must be a str, seed_symbols a
            # list[str]. Forced tool use guarantees the top-level shape but NOT item types,
            # so a real model can emit [null] / [123]; we drop non-string / blank seeds here
            # so no downstream node crashes on ', '.join(seeds) or s.upper() (§16, findings 1/2/5).
            intent = result.get("intent")
            raw_seeds = result.get("seed_symbols")
            seeds = (
                [s for s in raw_seeds if isinstance(s, str) and s.strip()]
                if isinstance(raw_seeds, list)
                else []
            )
            return {
                "intent": intent if isinstance(intent, str) and intent else "other",
                "seed_symbols": seeds,
            }
    except Exception:
        pass
    return {"intent": "other", "seed_symbols": []}
