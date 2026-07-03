"""server/routers.py — the REST endpoints (Claude.MD §8.2). Track B.

State is authoritative in the LangGraph checkpointer; handlers read it back with
`aget_state` after each invocation and return only the frozen SessionState keys.
`thread_id` discipline (L4): one fresh UUID per session, threaded through /cell/run and
/cell/approve; never shared across sessions.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ledger.chain import get_ledger
from schema import CellName, SessionState, new_session_state

router = APIRouter()

# Keys that belong to the frozen SessionState contract (§8.1). Internal graph control
# channels (run_cell/decision/edited_diff/proposed_diff) are deliberately NOT serialised.
_SESSION_KEYS = (
    "session_id", "thread_id", "change_request", "intent", "seed_symbols",
    "selected_program", "cells", "graph", "metrics", "ledger_head",
)


def _to_session_state(values: dict) -> dict:
    return {k: values.get(k) for k in _SESSION_KEYS}


def _err(status: int, error: str, detail: str | None = None) -> JSONResponse:
    body = {"error": error}
    if detail:
        body["detail"] = detail
    return JSONResponse(status_code=status, content=body)


# --------------------------------------------------------------------------- #
# Request bodies                                                              #
# --------------------------------------------------------------------------- #

class SessionCreate(BaseModel):
    change_request: str


class CellRun(BaseModel):
    session_id: str
    cell: CellName
    selected_program: str | None = None


class CellApprove(BaseModel):
    session_id: str
    decision: str  # "approve" | "edit" | "reject"
    edited_diff: str | None = None
    rationale: str | None = None  # required for approve/edit — the human's typed justification


class SessionRef(BaseModel):
    session_id: str


class PlanRequest(BaseModel):
    change_request: str


# --------------------------------------------------------------------------- #
# Endpoints                                                                   #
# --------------------------------------------------------------------------- #

@router.post("/plan")
async def plan(body: PlanRequest):
    """Level-1: decompose a change request into a validated DAG programme. Self-guarding —
    generate_programme() never raises and returns the canned fallback on any failure, so the
    canvas always gets a renderable plan (source: 'llm' | 'fallback')."""
    cr = (body.change_request or "").strip()
    if not cr:
        return _err(400, "change_request is required")
    from agent.nodes import generate_programme

    return await generate_programme(cr)


@router.post("/session")
async def create_session(body: SessionCreate, request: Request):
    session_id = str(uuid.uuid4())
    thread_id = str(uuid.uuid4())  # fresh per session, NEVER shared (L4)
    state = new_session_state(session_id, thread_id, body.change_request)
    request.app.state.sessions[session_id] = {
        "thread_id": thread_id,
        "change_request": body.change_request,
        "seeded": False,
    }
    return {"session_id": session_id, "state": state}


@router.post("/cell/run")
async def cell_run(body: CellRun, request: Request):
    sess = request.app.state.sessions.get(body.session_id)
    if not sess:
        return _err(404, "unknown session_id", body.session_id)

    cfg = {"configurable": {"thread_id": sess["thread_id"]}}
    inp: dict = {"run_cell": body.cell}
    if body.selected_program:
        inp["selected_program"] = body.selected_program
    if not sess["seeded"]:
        seed = new_session_state(body.session_id, sess["thread_id"], sess["change_request"])
        inp = {**seed, **inp}
        sess["seeded"] = True

    try:
        await request.app.state.graph.ainvoke(inp, cfg)
        st = await request.app.state.graph.aget_state(cfg)
    except Exception as exc:  # never crash the session (§16)
        return _err(500, "cell execution failed", str(exc))
    return {"state": _to_session_state(st.values)}


@router.post("/cell/approve")
async def cell_approve(body: CellApprove, request: Request):
    from langgraph.types import Command

    sess = request.app.state.sessions.get(body.session_id)
    if not sess:
        return _err(404, "unknown session_id", body.session_id)
    if body.decision not in ("approve", "edit", "reject"):
        return _err(400, "invalid decision", body.decision)
    if body.decision == "edit" and not body.edited_diff:
        return _err(400, "edited_diff is required when decision == 'edit'")
    if body.decision in ("approve", "edit") and not (body.rationale or "").strip():
        # Attested approval: a state-changing decision must carry the human's reasoning, which is
        # hash-chained into the ledger. Re-validated here — never trust the client-side gate.
        return _err(400, "a justification (rationale) is required to approve or edit")

    cfg = {"configurable": {"thread_id": sess["thread_id"]}}
    resume = {"decision": body.decision, "edited_diff": body.edited_diff, "rationale": body.rationale or ""}
    try:
        # Resume the graph on the SAME thread — the resume value becomes the return of
        # interrupt() inside approve_node (§8.2 resume mechanics / L2).
        await request.app.state.graph.ainvoke(Command(resume=resume), cfg)
        st = await request.app.state.graph.aget_state(cfg)
    except Exception as exc:
        return _err(500, "approval failed", str(exc))
    return {"state": _to_session_state(st.values)}


@router.get("/ledger")
async def get_ledger_entries(session_id: str):
    led = get_ledger()
    ok, _ = led.verify(session_id)
    return {"entries": led.entries(session_id), "verified": ok}


@router.post("/ledger/verify")
async def verify_ledger(body: SessionRef):
    ok, broken_at = get_ledger().verify(body.session_id)
    out = {"verified": ok}
    if broken_at is not None:
        out["broken_at"] = broken_at
    return out


@router.post("/ledger/tamper")
async def tamper_ledger(body: SessionRef):
    """Demo/debug only: silently mutate a stored entry so the next Verify FAILS (§12)."""
    ok = get_ledger().tamper(body.session_id)
    return {"ok": ok}


@router.get("/source/{name}")
async def get_source(name: str):
    """Serve the raw COBOL source for a program/copybook so the engineer can actually READ the
    code the agent is narrating. Deterministic — straight from the in-memory corpus."""
    from agent.nodes import _corpus

    unit = _corpus().get(name)
    if not unit:
        return _err(404, "unknown program or copybook", name)
    return {
        "name": unit.name,
        "file": unit.file,
        "kind": unit.kind,
        "n_lines": unit.n_lines,
        "text": unit.text,
    }


@router.get("/metrics/{session_id}")
async def metrics(session_id: str, request: Request):
    sess = request.app.state.sessions.get(session_id)
    if not sess:
        return _err(404, "unknown session_id", session_id)
    cfg = {"configurable": {"thread_id": sess["thread_id"]}}
    st = await request.app.state.graph.aget_state(cfg)
    return st.values.get("metrics", {}) or {}
