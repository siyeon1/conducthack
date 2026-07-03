"""ledger/chain.py — tamper-EVIDENT hash-chain ledger (Claude.MD §8.5 / §12). Track D.

Every approved change appends an entry whose `entry_hash` is the SHA-256 of its
RFC 8785 (JCS) canonical bytes, and whose `prev_hash` links to the previous entry —
so any later alteration is *detectable* (not preventable: a local file can be rewritten,
but the chain then fails verification; the optional on-chain Merkle root externalises the
head, §12).

Landmines handled:
  * L5 — canonical JSON via `rfc8785.dumps` (NOT naive json.dumps: floats/datetimes/unicode
    are non-deterministic under stdlib). Numbers that would be floats are avoided entirely
    (we store SHA-256 hex strings of the explanation/diff, plus an integer index and ISO-8601
    string timestamp — all JCS-deterministic). `entry_hash` excludes itself.
  * L6 — Merkle leaves/nodes are domain-separated (H(0x00‖leaf) vs H(0x01‖l‖r)); a lonely
    final node is carried up, never duplicated (RFC 6962 style).
"""
from __future__ import annotations

import hashlib
import os
import sqlite3
import threading
from datetime import datetime, timezone

import rfc8785

from ledger.schema import HASHED_FIELDS, LedgerEntry

DEFAULT_DB = os.getenv("LEDGER_DB", "ledger.sqlite")


# --------------------------------------------------------------------------- #
# Hashing primitives                                                          #
# --------------------------------------------------------------------------- #

def sha256_hex(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def canonical_entry_hash(entry: dict) -> str:
    """SHA-256 over the RFC 8785 canonical bytes of the entry MINUS `entry_hash`."""
    payload = {k: entry[k] for k in HASHED_FIELDS}
    return hashlib.sha256(rfc8785.dumps(payload)).hexdigest()


def _now_iso() -> str:
    # ISO-8601 STRING — never a datetime object in the entry (§14 L5).
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------------- #
# Merkle root (domain-separated) — for the optional on-chain anchor (§12).    #
# --------------------------------------------------------------------------- #

def _leaf(h_hex: str) -> bytes:
    return hashlib.sha256(b"\x00" + bytes.fromhex(h_hex)).digest()


def _node(left: bytes, right: bytes) -> bytes:
    return hashlib.sha256(b"\x01" + left + right).digest()


def merkle_root(entry_hashes: list[str]) -> str:
    """Domain-separated Merkle root over the entry hashes. '' for an empty chain."""
    if not entry_hashes:
        return ""
    level = [_leaf(h) for h in entry_hashes]
    while len(level) > 1:
        nxt: list[bytes] = []
        for i in range(0, len(level), 2):
            if i + 1 < len(level):
                nxt.append(_node(level[i], level[i + 1]))
            else:
                nxt.append(level[i])  # lonely node carried up — NOT duplicated (L6)
        level = nxt
    return level[0].hex()


# --------------------------------------------------------------------------- #
# The store                                                                   #
# --------------------------------------------------------------------------- #

class LedgerStore:
    def __init__(self, db_path: str = DEFAULT_DB):
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS ledger ("
            "session_id TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, "
            "PRIMARY KEY (session_id, idx))"
        )
        self._conn.commit()

    # ---- reads ----
    def entries(self, session_id: str) -> list[LedgerEntry]:
        import json

        with self._lock:
            rows = self._conn.execute(
                "SELECT data FROM ledger WHERE session_id=? ORDER BY idx", (session_id,)
            ).fetchall()
        return [json.loads(r[0]) for r in rows]

    def head(self, session_id: str) -> str | None:
        rows = self.entries(session_id)
        return rows[-1]["entry_hash"] if rows else None

    def merkle_root(self, session_id: str) -> str:
        return merkle_root([e["entry_hash"] for e in self.entries(session_id)])

    # ---- write ----
    def append(
        self,
        session_id: str,
        *,
        intent: str,
        programs: list[str],
        explanation: str,
        diff: str,
        decision: str,
        approver: str = "engineer@bank",
        rationale: str = "",
    ) -> LedgerEntry:
        existing = self.entries(session_id)
        index = len(existing)
        prev_hash = existing[-1]["entry_hash"] if existing else ""

        entry: dict = {
            "index": index,
            "session_id": session_id,
            "timestamp": _now_iso(),
            "intent": intent,
            "programs": list(programs),
            "explanation_hash": sha256_hex(explanation),
            "diff_hash": sha256_hex(diff),
            "decision": decision,
            "approver": approver,
            "rationale": rationale,
            "prev_hash": prev_hash,
        }
        entry["entry_hash"] = canonical_entry_hash(entry)

        import json

        with self._lock:
            self._conn.execute(
                "INSERT INTO ledger (session_id, idx, data) VALUES (?,?,?)",
                (session_id, index, json.dumps(entry)),
            )
            self._conn.commit()
        return entry  # type: ignore[return-value]

    # ---- verify ----
    def verify(self, session_id: str) -> tuple[bool, int | None]:
        """Re-walk the chain: recompute each entry_hash and check each prev_hash link.
        Returns (ok, first_broken_index)."""
        entries = self.entries(session_id)
        prev = ""
        for e in entries:
            if canonical_entry_hash(e) != e.get("entry_hash"):
                return False, e["index"]
            if e.get("prev_hash", "") != prev:
                return False, e["index"]
            prev = e["entry_hash"]
        return True, None

    # ---- demo-only tamper (drives the "Verify fails" moment, §12) ----
    def tamper(self, session_id: str, index: int | None = None) -> bool:
        """Silently mutate a stored entry's CONTENT without updating its entry_hash, so
        verify() detects the break. Demo/debug only."""
        import json

        entries = self.entries(session_id)
        if not entries:
            return False
        target = entries[0] if index is None else next(
            (e for e in entries if e["index"] == index), entries[0]
        )
        target = dict(target)
        target["intent"] = (target.get("intent", "") + " [TAMPERED]").strip()
        with self._lock:
            self._conn.execute(
                "UPDATE ledger SET data=? WHERE session_id=? AND idx=?",
                (json.dumps(target), session_id, target["index"]),
            )
            self._conn.commit()
        return True


# --------------------------------------------------------------------------- #
# Process-wide singleton (record node + API share one store)                  #
# --------------------------------------------------------------------------- #

_STORE: LedgerStore | None = None
_STORE_LOCK = threading.Lock()


def get_ledger() -> LedgerStore:
    global _STORE
    if _STORE is None:
        with _STORE_LOCK:
            if _STORE is None:
                _STORE = LedgerStore()
    return _STORE
