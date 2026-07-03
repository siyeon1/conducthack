"""ledger/schema.py — FROZEN ledger contract (Claude.MD §8.5). OWNED BY: Track D.

Import LedgerEntry from here; never redefine it. The hash-chain rules (RFC 8785
canonical bytes, numbers-as-strings, datetimes-as-ISO-8601 strings, entry_hash
excludes itself) live in ledger/chain.py and are load-bearing (§14 L5).
"""
from __future__ import annotations

from typing import TypedDict


class LedgerEntry(TypedDict):
    index: int              # 0-based position in the chain
    session_id: str
    timestamp: str          # ISO-8601 STRING (never a datetime object — §14 L5)
    intent: str             # the change request / intent
    programs: list[str]     # affected programs
    explanation_hash: str   # sha256 of the explain result
    diff_hash: str          # sha256 of the approved diff
    decision: str           # "approve" | "edit"
    approver: str           # user identity string (demo: "engineer@bank")
    prev_hash: str          # entry_hash of previous entry ("" for genesis)
    entry_hash: str         # sha256 of THIS entry's canonical bytes (excluding entry_hash)


# Fields that participate in the canonical hash, in a fixed order. `entry_hash`
# is deliberately excluded (it is the output). RFC 8785 sorts keys anyway, but we
# keep this list explicit so the hashed surface is auditable and stable.
HASHED_FIELDS: tuple[str, ...] = (
    "index",
    "session_id",
    "timestamp",
    "intent",
    "programs",
    "explanation_hash",
    "diff_hash",
    "decision",
    "approver",
    "prev_hash",
)
