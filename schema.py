"""schema.py — FROZEN shared contract (Claude.MD §8.1).

OWNED BY: Track A (lead). Imported by the agent, the API, the ledger, and mirrored
by the frontend. NEVER redefine any of these types locally — divergent copies are the
#1 way parallel sessions drift. If a type is wrong, fix it HERE, announce it, then
sessions adapt. `SessionState` is the most sacred contract in the repo.

NOTE: the user sees 5 cells, but the graph has 6 NODES — `propose` and `approve`
are split (see §14 L2), so `CellName` includes both.
"""
from __future__ import annotations

from typing import Literal, Optional, TypedDict

CellName = Literal["locate", "explain", "impact", "propose", "approve", "record"]
CellStatus = Literal[
    "pending",
    "running",
    "awaiting_approval",
    "approved",
    "rejected",
    "done",
    "error",
]

# The five USER-VISIBLE cells (propose+approve collapse into one card in the UI).
USER_CELLS: tuple[CellName, ...] = ("locate", "explain", "impact", "propose", "record")
# All SIX graph nodes, in execution order.
GRAPH_NODES: tuple[CellName, ...] = (
    "locate",
    "explain",
    "impact",
    "propose",
    "approve",
    "record",
)


class Citation(TypedDict):
    program: str            # e.g. "XFRFUN"
    file: str               # e.g. "src/base/cobol_src/XFRFUN.cbl"
    lines: Optional[str]    # e.g. "120-155" (None if inferred)
    verified: bool          # True if from the parser, False if LLM-inferred


class GraphEdge(TypedDict):
    frm: str                # program/paragraph id (note: 'frm', NOT 'from' — reserved word)
    to: str
    kind: Literal["CALL", "PERFORM", "COPY", "WRITES"]
    verified: bool          # True if parsed, False if LLM-inferred


class CellResult(TypedDict):
    cell: CellName
    status: CellStatus
    summary: str                    # human-readable (markdown ok)
    citations: list[Citation]
    payload: dict                   # cell-specific structured data (§8.4)
    proposed_diff: Optional[str]    # unified-diff text; set by `propose`, approved in `approve`


class SessionState(TypedDict):
    session_id: str
    thread_id: str          # LangGraph thread; one per session, NEVER shared (§14 L4)
    change_request: str     # plain-English business change
    intent: Optional[str]   # router output: "add-guard"|"change-arithmetic"|"add-field"|...
    seed_symbols: list[str] # router output: data fields / paragraph names / business terms
    selected_program: Optional[str]
    cells: dict             # CellName -> CellResult
    graph: dict             # {"nodes": [...], "edges": [GraphEdge...]} — THE dependency graph
    metrics: dict           # counters (T2.5): programs_traced, paragraphs, lines_in_scope, ...
    ledger_head: Optional[str]  # entry_hash of latest ledger entry


# --------------------------------------------------------------------------- #
# Additive constructors (NOT part of the frozen type surface — helpers only).  #
# Kept here so the server and the agent nodes build identical shapes.          #
# --------------------------------------------------------------------------- #

def new_cell_result(cell: CellName, status: CellStatus = "pending") -> CellResult:
    return CellResult(
        cell=cell,
        status=status,
        summary="",
        citations=[],
        payload={},
        proposed_diff=None,
    )


def new_session_state(session_id: str, thread_id: str, change_request: str) -> SessionState:
    return SessionState(
        session_id=session_id,
        thread_id=thread_id,
        change_request=change_request,
        intent=None,
        seed_symbols=[],
        selected_program=None,
        cells={c: new_cell_result(c) for c in GRAPH_NODES},
        graph={"nodes": [], "edges": []},
        metrics={},
        ledger_head=None,
    )
