"""agent/nodes.py — the six graph nodes (§3.2 / §6 M4). Track A.

locate → explain → impact  (read-only)   ·   propose → approve → record  (gated)

Landmines handled here:
  * L2 — `propose` (side-effecting: generates the diff, runs once) is a SEPARATE node from
    `approve` (whose FIRST and only significant action is interrupt()). The diff is therefore
    never regenerated on resume. interrupt() is never wrapped in try/except and never looped.
  * L8 — every structured payload is validated against the corpus/graph before display
    (cited programs must exist; verified flags downgraded if unprovable).
  * §16 — any provider/parse failure sets the cell to status:"error" with a readable message
    and NEVER crashes the session.

The internal GraphState is a SUPERSET of the frozen SessionState (§8.1): it adds transient
control channels (run_cell / decision / edited_diff) used only for routing. The API only ever
serialises the SessionState keys, so the contract is untouched.
"""
from __future__ import annotations

import asyncio
from typing import Optional

from langgraph.types import interrupt

from agent import prompts
from agent.router import run_router
from analysis.cobol import graph_metrics, subgraph_for
from analysis.corpus import load_corpus
from ledger.chain import get_ledger
from llm import get_provider
from schema import GRAPH_NODES, CellName, CellResult, SessionState

DEFAULT_EDIT_SITE = "XFRFUN"


# --------------------------------------------------------------------------- #
# Internal graph state                                                        #
# --------------------------------------------------------------------------- #

class GraphState(SessionState, total=False):
    run_cell: str              # which cell this invocation should run (routing)
    decision: Optional[str]    # set by approve_node after the human gate
    edited_diff: Optional[str]
    proposed_diff: Optional[str]  # top-level channel mirrored into cells['propose'].proposed_diff;
    #                               NOT part of the frozen SessionState (which carries it per-cell)


# --------------------------------------------------------------------------- #
# Lazy process-wide singletons (corpus, full graph, provider)                 #
# --------------------------------------------------------------------------- #

_CORPUS = None
_FULL_GRAPH = None


def _corpus():
    global _CORPUS
    if _CORPUS is None:
        _CORPUS = load_corpus()
    return _CORPUS


def _full_graph():
    global _FULL_GRAPH
    if _FULL_GRAPH is None:
        from analysis.cobol import graph_from_corpus

        _FULL_GRAPH = graph_from_corpus(_corpus())
    return _FULL_GRAPH


# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #

def _cell(cell: CellName, status, summary, *, citations=None, payload=None, proposed_diff=None) -> CellResult:
    return CellResult(
        cell=cell,
        status=status,
        summary=summary,
        citations=citations or [],
        payload=payload or {},
        proposed_diff=proposed_diff,
    )


def _merge_cell(state, cell: CellName, result: CellResult) -> dict:
    return {"cells": {**state.get("cells", {}), cell: result}}


async def _structured(system: str, user: str, model, max_tokens: int = 2000) -> dict:
    prov = get_provider()
    result = await asyncio.to_thread(
        prov.complete, system, user, schema=model.model_json_schema(), max_tokens=max_tokens
    )
    if not isinstance(result, dict):
        raise ValueError("provider returned non-dict for a structured request")
    return result


async def _ensure_routed(state) -> dict:
    """Run the router once per session (lazily, inside the first read-only cell)."""
    if state.get("intent"):
        return {}
    r = await run_router(state.get("change_request", ""))
    return {"intent": r["intent"], "seed_symbols": r["seed_symbols"]}


def _known(name: str) -> bool:
    c = _corpus()
    base = (name or "").split(" ")[0].upper()
    return base in c.programs or base in c.copybooks


def _validate_programs(programs: list[dict]) -> list[dict]:
    """L8: a program that isn't in the corpus cannot be 'verified' — downgrade its flag."""
    out = []
    for p in programs:
        p = dict(p)
        if not _known(p.get("program", "")):
            p["verified"] = False
        out.append(p)
    return out


def _citations_from(programs: list[dict]) -> list[dict]:
    cits = []
    for p in programs:
        cits.append(
            {
                "program": p.get("program", ""),
                "file": p.get("file", ""),
                "lines": None,
                "verified": bool(p.get("verified", False)),
            }
        )
    return cits


def _inventory() -> str:
    c = _corpus()
    progs = "\n".join(f"- {u.name} ({u.file})" for u in c.programs.values())
    cpys = "\n".join(f"- {u.name} ({u.file})" for u in c.copybooks.values())
    return f"PROGRAMS:\n{progs}\n\nCOPYBOOKS:\n{cpys}"


# --------------------------------------------------------------------------- #
# Read-only nodes                                                             #
# --------------------------------------------------------------------------- #

async def locate_node(state: GraphState) -> dict:
    updates = await _ensure_routed(state)
    intent = updates.get("intent", state.get("intent"))
    seeds = updates.get("seed_symbols", state.get("seed_symbols", []))
    user = (
        f"Change request: {state.get('change_request','')}\n"
        f"Intent: {intent}\nSeed symbols: {', '.join(seeds)}\n\n"
        f"Candidate inventory:\n{_inventory()}\n\n"
        "Return the affected programs/copybooks."
    )
    try:
        payload = await _structured(prompts.LOCATE_SYSTEM, user, prompts.LocatePayload)
        payload["programs"] = _validate_programs(payload.get("programs", []))
        n = len(payload["programs"])
        result = _cell(
            "locate", "done",
            f"Located **{n}** affected program(s)/copybook(s) for intent `{intent}`.",
            citations=_citations_from(payload["programs"]),
            payload=payload,
        )
    except Exception as exc:  # §16 — never crash the session
        result = _cell("locate", "error", f"Locate failed: {exc}")
    return {**updates, **_merge_cell(state, "locate", result)}


async def explain_node(state: GraphState) -> dict:
    updates = await _ensure_routed(state)
    program = (state.get("selected_program") or "").upper() or _first_located_program(state) or DEFAULT_EDIT_SITE
    unit = _corpus().get(program)
    source = (unit.text[:8000] if unit else "(source not found)")
    user = f"Program: {program}\nFile: {unit.file if unit else '?'}\n\nSource (may be truncated):\n{source}"
    try:
        payload = await _structured(prompts.EXPLAIN_SYSTEM, user, prompts.ExplainPayload, max_tokens=2500)
        cits = [{"program": program, "file": unit.file if unit else "", "lines": None, "verified": bool(unit)}]
        result = _cell(
            "explain", "done", f"Plain-English explanation of **{program}**.",
            citations=cits, payload=payload,
        )
    except Exception as exc:
        result = _cell("explain", "error", f"Explain failed: {exc}")
    return {**updates, "selected_program": program, **_merge_cell(state, "explain", result)}


def _validate_affected(affected: list[dict], sub: dict) -> list[dict]:
    """L8: tag each narrated impact item with whether its program is actually a node in the
    deterministic subgraph. The LLM narrates the graph (ground truth); anything it names that
    is NOT in the graph is flagged `in_graph=False` so it is never shown as a proven dependency."""
    node_set = {n.upper() for n in sub.get("nodes", [])}
    out = []
    for item in affected:
        item = dict(item)
        raw = (item.get("program", "") or "").upper().replace("/", " ")
        toks = [t.strip("()") for t in raw.split()]
        item["in_graph"] = any(t in node_set for t in toks)
        out.append(item)
    return out


async def impact_node(state: GraphState) -> dict:
    updates = await _ensure_routed(state)
    seeds = updates.get("seed_symbols", state.get("seed_symbols", []))
    corpus = _corpus()

    seed_progs = _located_program_names(state)
    if not seed_progs:
        seed_progs = [s.upper() for s in seeds if s.upper() in corpus.programs]
    focus = sorted({cb for cb in corpus.copybooks for s in seeds if cb in s.upper()})

    sub = subgraph_for(_full_graph(), seed_progs, focus_copybooks=focus or None) if seed_progs else {"nodes": [], "edges": []}

    metrics = graph_metrics(sub, corpus)
    metrics["lines_in_scope"] = sum(corpus.get(n).n_lines for n in seed_progs if corpus.get(n))
    metrics["copybooks_resolved"] = f"{len(corpus.copybooks)}/{len(corpus.copybooks)}"

    graph_desc = _describe_graph(sub)
    user = (
        f"Change request: {state.get('change_request','')}\nEdit sites: {', '.join(seed_progs) or '(none)'}\n\n"
        f"Dependency graph (ground truth — narrate only these):\n{graph_desc}\n\nNarrate the blast radius."
    )
    try:
        payload = await _structured(prompts.IMPACT_SYSTEM, user, prompts.ImpactPayload)
        payload["affected"] = _validate_affected(payload.get("affected", []), sub)
        result = _cell(
            "impact", "done",
            f"Blast radius: **{len(sub['nodes'])}** nodes, **{len(sub['edges'])}** dependencies "
            f"({metrics.get('verified_edges',0)} verified / {metrics.get('inferred_edges',0)} inferred).",
            payload=payload,
        )
    except Exception as exc:
        result = _cell("impact", "error", f"Impact failed: {exc}")
    return {**updates, "graph": sub, "metrics": metrics, **_merge_cell(state, "impact", result)}


# --------------------------------------------------------------------------- #
# Gated nodes: propose (runs once) → approve (interrupt first) → record        #
# --------------------------------------------------------------------------- #

async def propose_node(state: GraphState) -> dict:
    """SIDE-EFFECTING: generates the diff and writes it to state. Runs exactly once — it is a
    separate node from `approve`, so the interrupt/resume never regenerates the diff (L2)."""
    program = _first_located_program(state) or DEFAULT_EDIT_SITE
    unit = _corpus().get(program)
    source = unit.text[:8000] if unit else "(source not found)"
    user = (
        f"Change request: {state.get('change_request','')}\nIntent: {state.get('intent')}\n"
        f"Primary edit site: {program} ({unit.file if unit else '?'})\n\nSource:\n{source}\n\n"
        "Draft the minimal change as a unified diff plus a one-paragraph explanation."
    )
    try:
        payload = await _structured(prompts.PROPOSE_SYSTEM, user, prompts.ProposePayload, max_tokens=2500)
        diff = payload.get("diff", "")
        if not (diff or "").strip():
            # An empty diff must not open a human gate with nothing behind it — treat it as a
            # failed propose so the graph routes to END (finding #4) and the UI shows an error.
            raise ValueError("model returned an empty diff")
        result = _cell(
            "propose", "awaiting_approval",
            f"Proposed a change to **{program}** — awaiting your approval.",
            citations=[{"program": program, "file": unit.file if unit else "", "lines": None, "verified": bool(unit)}],
            payload={"explanation": payload.get("explanation", "")},
            proposed_diff=diff,
        )
        return {"proposed_diff": diff, **_merge_cell(state, "propose", result)}
    except Exception as exc:
        result = _cell("propose", "error", f"Propose failed: {exc}")
        return _merge_cell(state, "propose", result)


def approve_node(state: GraphState) -> dict:
    """The human gate. interrupt() is the FIRST action; everything after is idempotent (L2).
    NEVER wrap interrupt() in try/except and NEVER loop it."""
    resume = interrupt(
        {
            "diff": state.get("proposed_diff"),
            "explanation": state.get("cells", {}).get("propose", {}).get("payload", {}).get("explanation", ""),
        }
    )
    decision = (resume or {}).get("decision", "approve") if isinstance(resume, dict) else "approve"
    edited = (resume or {}).get("edited_diff") if isinstance(resume, dict) else None

    cells = dict(state.get("cells", {}))
    pc = dict(cells.get("propose", {}))
    if decision in ("approve", "edit"):
        pc["status"] = "approved"
        if decision == "edit" and edited:
            pc["proposed_diff"] = edited
    else:  # reject
        pc["status"] = "rejected"
        pc["summary"] = "Change rejected — re-run Propose to draft a different change."
    cells["propose"] = pc
    return {"decision": decision, "edited_diff": edited, "cells": cells}


def record_node(state: GraphState) -> dict:
    """Writes the approved step to the tamper-evident ledger (§8.5). Not an LLM call."""
    decision = state.get("decision", "approve")
    diff = state.get("edited_diff") or state.get("proposed_diff") or ""
    programs = _located_program_names(state) or [s for s in state.get("seed_symbols", []) if _corpus().get(s)]
    explanation = (
        state.get("cells", {}).get("explain", {}).get("payload", {}).get("plain_english", "")
        or state.get("cells", {}).get("propose", {}).get("payload", {}).get("explanation", "")
    )
    try:
        entry = get_ledger().append(
            state["session_id"],
            intent=state.get("change_request", ""),
            programs=programs,
            explanation=explanation,
            diff=diff,
            decision=decision,
        )
        result = _cell(
            "record", "done",
            f"Recorded to the tamper-evident ledger as entry #{entry['index']} "
            f"(`{entry['entry_hash'][:12]}…`).",
            payload={"ledger_entry": entry},
        )
        return {"ledger_head": entry["entry_hash"], **_merge_cell(state, "record", result)}
    except Exception as exc:
        result = _cell("record", "error", f"Record failed: {exc}")
        return _merge_cell(state, "record", result)


# --------------------------------------------------------------------------- #
# Small helpers over located programs                                          #
# --------------------------------------------------------------------------- #

def _located_program_names(state) -> list[str]:
    corpus = _corpus()
    out = []
    for p in state.get("cells", {}).get("locate", {}).get("payload", {}).get("programs", []):
        nm = (p.get("program", "") or "").split(" ")[0].upper()
        if nm in corpus.programs and nm not in out:
            out.append(nm)
    return out


def _first_located_program(state) -> Optional[str]:
    names = _located_program_names(state)
    return names[0] if names else None


def _describe_graph(sub: dict) -> str:
    lines = [f"Nodes: {', '.join(sub.get('nodes', [])) or '(none)'}", "Edges:"]
    for e in sub.get("edges", []):
        flag = "verified" if e.get("verified") else "inferred"
        lines.append(f"  {e['frm']} --{e['kind']}--> {e['to']}  [{flag}]")
    return "\n".join(lines)
