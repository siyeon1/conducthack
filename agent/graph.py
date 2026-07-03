"""agent/graph.py — the compiled 6-node LangGraph (§5 / §6 M4). Track A.

Shape:

    START ─(run_cell)─▶ locate ─▶ END
                     ├▶ explain ─▶ END
                     ├▶ impact ──▶ END
                     └▶ propose ─▶ approve ─(decision)─▶ record ─▶ END
                                    │  (interrupt)        └─(reject)─▶ END

A conditional entry lets the API run ONE named cell per invocation (§8.2 `/cell/run`) while
sharing state through the checkpointer. `propose` and `approve` are distinct nodes so the diff
is generated once and the interrupt/resume never regenerates it (L2). The checkpointer is
REQUIRED to compile a graph that uses interrupt() and to make `/cell/approve` resume work (L3).
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, START, StateGraph

from agent.nodes import (
    GraphState,
    approve_node,
    explain_node,
    impact_node,
    locate_node,
    propose_node,
    record_node,
)

# run_cell value → entry node. record is intentionally absent (only reachable via approve).
_ENTRY = {"locate": "locate", "explain": "explain", "impact": "impact", "propose": "propose"}


def _route_entry(state) -> str:
    cell = state.get("run_cell") or "locate"
    return cell if cell in _ENTRY else "locate"


def _route_after_approve(state) -> str:
    return "record" if state.get("decision") in ("approve", "edit") else "END"


def _route_after_propose(state) -> str:
    """Gate the human-approval step behind a SUCCESSFUL propose. A failed propose
    (status:"error", no diff) must NOT reach interrupt() or be recorded with an empty
    diff — route it straight to END instead (finding #4)."""
    pc = state.get("cells", {}).get("propose", {})
    return "approve" if pc.get("status") == "awaiting_approval" and state.get("proposed_diff") else "END"


def build_builder() -> StateGraph:
    b = StateGraph(GraphState)
    b.add_node("locate", locate_node)
    b.add_node("explain", explain_node)
    b.add_node("impact", impact_node)
    b.add_node("propose", propose_node)
    b.add_node("approve", approve_node)
    b.add_node("record", record_node)

    b.add_conditional_edges(START, _route_entry, _ENTRY)
    b.add_edge("locate", END)
    b.add_edge("explain", END)
    b.add_edge("impact", END)
    b.add_conditional_edges("propose", _route_after_propose, {"approve": "approve", "END": END})
    b.add_conditional_edges("approve", _route_after_approve, {"record": "record", "END": END})
    b.add_edge("record", END)
    return b


@asynccontextmanager
async def open_graph(db_path: str = "checkpoints.sqlite"):
    """Compile the graph with an AsyncSqliteSaver. Use inside the FastAPI lifespan (§14 L3)
    and in tests: `async with open_graph() as graph: ...`."""
    async with AsyncSqliteSaver.from_conn_string(db_path) as saver:
        yield build_builder().compile(checkpointer=saver)
