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
import os
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
    rationale: Optional[str]   # the human's typed justification, carried to the ledger
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


_FIELD_INDEX = None


def _field_index():
    global _FIELD_INDEX
    if _FIELD_INDEX is None:
        from analysis.cobol import build_field_index

        _FIELD_INDEX = build_field_index(_corpus())
    return _FIELD_INDEX


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


async def _structured(system: str, user: str, model, max_tokens: int = 2000, provider=None) -> dict:
    prov = provider or get_provider()
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


def _validate_programs(programs: list) -> list[dict]:
    """L8 + real-LLM robustness: downgrade `verified` for programs not in the corpus, coerce
    stray string items to dicts, and de-duplicate by program name (a real model repeats programs
    and occasionally emits a bare string — neither must crash the cell or clutter the list)."""
    out = []
    seen: set[str] = set()
    for p in programs:
        if isinstance(p, str):
            p = {"program": p, "file": "", "reason": "", "verified": False}
        elif isinstance(p, dict):
            p = dict(p)
        else:
            continue
        name = (p.get("program", "") or "").split(" ")[0].upper()
        if not name or name in seen:
            continue
        seen.add(name)
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
# Planner (Level-1) — decompose a change request into a validated DAG.        #
# One-shot structured call (NOT a graph node). Forced tool use guarantees the #
# top-level shape but NOT nested item types or acyclicity — so we coerce and  #
# validate every plan before it can render (parse, don't trust — §14 L8).     #
# --------------------------------------------------------------------------- #

def _slug(text: str) -> str:
    out = []
    for ch in str(text).lower():
        if ch.isalnum():
            out.append(ch)
        elif ch in " -_/":
            out.append("-")
    s = "".join(out).strip("-")
    while "--" in s:
        s = s.replace("--", "-")
    return s[:40] or "node"


def _coerce_to_list(val) -> list:
    """L8: a nested array-typed field may arrive as a JSON STRING (the whole list, serialized).
    Normalise to a list before iterating so we never split a string character-by-character."""
    import json

    if isinstance(val, list):
        return val
    if isinstance(val, dict):
        return [val]
    if isinstance(val, str):
        s = val.strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
        except Exception:
            return []
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            return [parsed]
    return []


def _break_cycles(edges: list[dict]) -> list[dict]:
    """Keep the plan a DAG: add edges one at a time, dropping any edge whose target can already
    reach its source (which would close a cycle). Deterministic in input order."""
    adj: dict[str, set] = {}
    kept: list[dict] = []

    def reachable(a: str, b: str) -> bool:
        stack, seen = [a], set()
        while stack:
            x = stack.pop()
            if x == b:
                return True
            if x in seen:
                continue
            seen.add(x)
            stack.extend(adj.get(x, ()))
        return False

    for e in edges:
        s, t = e["source"], e["target"]
        if reachable(t, s):  # t already reaches s → s->t would create a cycle
            continue
        adj.setdefault(s, set()).add(t)
        kept.append(e)
    return kept


def _validate_plan(payload, *, min_nodes: int = 2, max_nodes: int = 6) -> dict | None:
    """Coerce + validate an LLM decomposition into a safe DAG. Returns {nodes, edges, trimmed}
    or None if it can't be salvaged (caller then uses the canned fallback). Guarantees: unique
    slug ids, referential integrity (edges reference real nodes), no self-loops, acyclic, capped."""
    if not isinstance(payload, dict):
        return None
    nodes_raw = _coerce_to_list(payload.get("nodes"))
    edges_raw = _coerce_to_list(payload.get("edges"))

    nodes: list[dict] = []
    seen: set[str] = set()
    for n in nodes_raw:
        if not isinstance(n, dict):
            continue
        label = str(n.get("label") or "").strip()
        nid = _slug(str(n.get("id") or "").strip() or label)
        if not nid or nid in seen:
            continue
        seen.add(nid)
        sites = [str(x).strip().upper() for x in _coerce_to_list(n.get("edit_sites")) if str(x).strip()]
        nodes.append({
            "id": nid,
            "label": label or nid,
            "change_request": str(n.get("change_request") or label or nid).strip(),
            "edit_sites": sites,
        })

    if len(nodes) < min_nodes:
        return None
    trimmed = len(nodes) > max_nodes
    if trimmed:
        nodes = nodes[:max_nodes]
    valid = {n["id"] for n in nodes}

    edges: list[dict] = []
    eseen: set = set()
    for e in edges_raw:
        if not isinstance(e, dict):
            continue
        s = str(e.get("source") or "").strip()
        t = str(e.get("target") or "").strip()
        s = s if s in valid else _slug(s)
        t = t if t in valid else _slug(t)
        if s not in valid or t not in valid or s == t or (s, t) in eseen:
            continue
        eseen.add((s, t))
        edges.append({"source": s, "target": t, "reason": str(e.get("reason") or "")})
    edges = _break_cycles(edges)

    return {"nodes": nodes, "edges": edges, "trimmed": trimmed}


_PLANNER_PROVIDER = None


def _planner_provider():
    """The planner uses the strongest model. The nested plan schema (nodes + edges, two $defs)
    trips smaller models — Sonnet intermittently emits a degenerate placeholder tool call — so the
    Level-1 decomposition runs on Opus by default (PLAN_MODEL to override). Per-cell work stays on
    the session's configured model. Falls back to the shared provider under USE_MOCK_LLM."""
    global _PLANNER_PROVIDER
    if _PLANNER_PROVIDER is None:
        if os.getenv("USE_MOCK_LLM", "0").strip().lower() in ("1", "true", "yes", "on"):
            _PLANNER_PROVIDER = get_provider()  # mock — no model tiers
        else:
            from llm.claude_provider import ClaudeProvider

            _PLANNER_PROVIDER = ClaudeProvider(model=os.getenv("PLAN_MODEL", "claude-opus-4-8"))
    return _PLANNER_PROVIDER


def _ground_plan_edges(nodes: list[dict], edges: list[dict]) -> list[dict]:
    """Tag each plan edge `verified` when the two sub-changes' edit sites are actually coupled in
    the PARSED dependency graph (a real COPY/CALL/… edge), vs `verified: False` for an LLM-inferred
    ordering with no parsed dependency. The 'parse, don't infer' differentiator, applied to the
    Level-1 decomposition edges."""
    g = _full_graph()
    dep: set = set()
    for e in g.get("edges", []):
        a = str(e.get("frm", "")).upper()
        b = str(e.get("to", "")).upper()
        if a and b:
            dep.add((a, b))
            dep.add((b, a))
    sites = {n["id"]: {str(s).upper() for s in n.get("edit_sites", [])} for n in nodes}
    out = []
    for e in edges:
        ss = sites.get(e["source"], set())
        ts = sites.get(e["target"], set())
        verified = any((a, b) in dep for a in ss for b in ts)
        out.append({**e, "verified": bool(verified)})
    return out


async def generate_programme(change_request: str) -> dict:
    """Decompose a change request into a validated DAG programme. Never raises — on ANY failure
    (provider error, empty/invalid plan) it returns the canned fallback so the canvas always
    renders. `source` is 'llm' for a validated live plan, 'fallback' otherwise."""
    import fixtures

    cr = (change_request or "").strip()
    try:
        # An explicit shape example anchors the model on the real fields — without it, Sonnet
        # occasionally emits a degenerate tool call with placeholder keys ($PARAMETER_NAME, ...).
        user = (
            f"Change request: {cr}\n\n"
            f"Candidate program/copybook inventory:\n{_inventory()}\n\n"
            "Decompose this into a small DAG of dependent sub-changes. Fill the emit tool with a "
            "CONCRETE plan of exactly this shape (use real ids and inventory names — never emit "
            "placeholder names):\n"
            '{"nodes":[{"id":"add-field","label":"Add a field to the shared copybook",'
            '"change_request":"Add ... to <COPYBOOK>.","edit_sites":["<COPYBOOK>"]},'
            '{"id":"enforce-it","label":"Enforce it in the program",'
            '"change_request":"Enforce ... in <PROGRAM>.","edit_sites":["<PROGRAM>"]}],'
            '"edges":[{"source":"add-field","target":"enforce-it",'
            '"reason":"<PROGRAM> reads the new field"}]}'
        )
        clean = None
        for _ in range(3):  # Sonnet intermittently emits a placeholder tool call; retry before falling back
            raw = await _structured(
                prompts.PLAN_SYSTEM, user, prompts.PlanPayload, max_tokens=4000, provider=_planner_provider()
            )
            clean = _validate_plan(raw)
            if clean:
                break
        if not clean:
            raise ValueError("plan failed validation")
        return {
            "id": _slug(cr) or "programme",
            "title": cr or fixtures.FALLBACK_PROGRAMME["title"],
            "subtitle": "Decomposed by the planner into dependent, individually-reviewable sub-changes.",
            "nodes": clean["nodes"],
            "edges": _ground_plan_edges(clean["nodes"], clean["edges"]),
            "source": "llm",
        }
    except Exception as exc:
        fb = dict(fixtures.FALLBACK_PROGRAMME)
        fb["title"] = cr or fb["title"]
        fb["edges"] = _ground_plan_edges(fb["nodes"], fb["edges"])
        fb["source"] = "fallback"
        fb["detail"] = str(exc)
        return fb


# --------------------------------------------------------------------------- #
# Read-only nodes                                                             #
# --------------------------------------------------------------------------- #

def _seed_field_defs(seeds) -> dict[str, str]:
    """FIELD -> the copybook that DEFINES it, for seeds that are real fields (field index; parsed,
    no LLM). Non-field seeds ("overdraft fee cap", "FCA Consumer Duty") resolve to nothing."""
    fidx = _field_index()
    corpus = _corpus()
    defs: dict[str, str] = {}
    for s in seeds:
        su = str(s).upper()
        for cb in fidx.get(su, []):
            if cb in corpus.copybooks:
                defs[su] = cb
                break
    return defs


def _ground_programs(programs: list[dict], seeds) -> list[dict]:
    """Deterministic (no-LLM) grounding of the LLM's Locate result against the field index and the
    parsed COPY graph — the 'parse, don't infer' keystone applied to Locate. For each located unit
    we try to PROVE it is in the change's data-scope three ways (strongest first):
      1. it DEFINES a seed field (it is the copybook),
      2. it USES a seed field name directly in its source,
      3. it COPYs a copybook that defines a seed field.
    A grounded unit is marked verified with a parsed citation prefixed to its reason. We also
    ADD any seed-field-defining copybook the LLM missed (provably central). This only ever adds
    proof — it never downgrades or drops what the LLM found."""
    corpus = _corpus()
    field_defs = _seed_field_defs(seeds)
    if not field_defs:
        return programs

    copies: dict[str, set[str]] = {}  # program(UPPER) -> {copybooks it COPYs (UPPER)}
    for e in _full_graph().get("edges", []):
        if str(e.get("kind", "")).upper() == "COPY":
            copies.setdefault(str(e.get("frm", "")).upper(), set()).add(str(e.get("to", "")).upper())

    def reason_for(name: str) -> str | None:
        nameU = name.upper()
        for fld, cb in field_defs.items():
            if cb.upper() == nameU:
                return f"Defines seed field {fld} — field index (parsed)."
        unit = corpus.get(name)
        if unit:
            txt = (unit.text or "").upper()
            for fld in field_defs:
                if fld in txt:
                    return f"Uses seed field {fld} in source (parsed)."
        for fld, cb in field_defs.items():
            if cb.upper() in copies.get(nameU, ()):
                return f"COPYs {cb}, which defines seed field {fld} (parsed)."
        return None

    out: list[dict] = []
    present: set[str] = set()
    for p in programs:
        p = dict(p)
        name = (p.get("program", "") or "").split(" ")[0]
        present.add(name.upper())
        r = reason_for(name) if name else None
        if r:
            p["grounded"] = True
            p["verified"] = True
            base = (p.get("reason", "") or "").strip()
            p["reason"] = f"✓ Parsed: {r}" + (f" {base}" if base else "")
        else:
            p.setdefault("grounded", False)
        out.append(p)

    # Add any seed-field-defining copybook the LLM omitted — provably central, no guessing.
    for fld, cb in field_defs.items():
        if cb.upper() in present:
            continue
        present.add(cb.upper())
        u = corpus.get(cb)
        out.append({
            "program": cb,
            "file": u.file if u else "",
            "reason": f"✓ Parsed: Defines seed field {fld} — field index (no LLM). Added deterministically.",
            "verified": True,
            "grounded": True,
        })
    return out


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
        payload["programs"] = _ground_programs(
            _validate_programs(payload.get("programs", [])), seeds
        )
        n = len(payload["programs"])
        n_grounded = sum(1 for p in payload["programs"] if p.get("grounded"))
        result = _cell(
            "locate", "done",
            f"Located **{n}** affected program(s)/copybook(s) for intent `{intent}` "
            f"— **{n_grounded}** grounded in the field index (parsed, no LLM).",
            citations=_citations_from(payload["programs"]),
            payload=payload,
        )
    except Exception as exc:  # §16 — never crash the session
        result = _cell("locate", "error", f"Locate failed: {exc}")
    return {**updates, **_merge_cell(state, "locate", result)}


def _validate_idioms(payload: dict) -> dict:
    """Real-LLM robustness: guarantee plain_english is a str and cobol_idioms is a list of
    {snippet, explanation} dicts. A real model sometimes returns cobol_idioms as one long string
    instead of a list — the UI does cobol_idioms.map(), so a non-list would break the cell."""
    payload = dict(payload)
    payload["plain_english"] = str(payload.get("plain_english") or "")
    clean = []
    idioms = payload.get("cobol_idioms")
    if isinstance(idioms, list):
        for it in idioms:
            if isinstance(it, dict):
                clean.append({"snippet": str(it.get("snippet", "")), "explanation": str(it.get("explanation", ""))})
            elif isinstance(it, str) and it.strip():
                clean.append({"snippet": "", "explanation": it})
    payload["cobol_idioms"] = clean
    return payload


async def explain_node(state: GraphState) -> dict:
    updates = await _ensure_routed(state)
    program = (state.get("selected_program") or "").upper() or _first_located_program(state) or DEFAULT_EDIT_SITE
    unit = _corpus().get(program)
    source = (unit.text[:8000] if unit else "(source not found)")
    user = f"Program: {program}\nFile: {unit.file if unit else '?'}\n\nSource (may be truncated):\n{source}"
    try:
        payload = await _structured(prompts.EXPLAIN_SYSTEM, user, prompts.ExplainPayload, max_tokens=2500)
        payload = _validate_idioms(payload)
        cits = [{"program": program, "file": unit.file if unit else "", "lines": None, "verified": bool(unit)}]
        result = _cell(
            "explain", "done", f"Plain-English explanation of **{program}**.",
            citations=cits, payload=payload,
        )
    except Exception as exc:
        result = _cell("explain", "error", f"Explain failed: {exc}")
    return {**updates, "selected_program": program, **_merge_cell(state, "explain", result)}


def _coerce_affected_list(affected) -> list:
    """L8: forced tool use guarantees the top-level object shape but NOT that a nested array-typed
    field is actually a list — Claude occasionally returns `affected` as a JSON STRING (the real
    list, serialized). Normalise it to a list BEFORE validation, so we never iterate a string
    character-by-character (which produced 41 one-letter "programs"). Parsing recovers the real
    items when the string is valid JSON."""
    import json

    if isinstance(affected, list):
        return affected
    if isinstance(affected, dict):
        inner = affected.get("affected")
        return inner if isinstance(inner, list) else [affected]
    if isinstance(affected, str):
        s = affected.strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
        except Exception:
            return []
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            inner = parsed.get("affected")
            return inner if isinstance(inner, list) else [parsed]
        return []
    return []


def _validate_affected(affected, sub: dict) -> list[dict]:
    """L8: tag each narrated impact item with whether its program is actually a node in the
    deterministic subgraph. The LLM narrates the graph (ground truth); anything it names that
    is NOT in the graph is flagged `in_graph=False` so it is never shown as a proven dependency."""
    node_set = {n.upper() for n in sub.get("nodes", [])}
    out = []
    seen: set[str] = set()
    for item in _coerce_affected_list(affected):
        if isinstance(item, str):
            item = {"program": item, "relationship": "", "risk": "low"}
        elif isinstance(item, dict):
            item = dict(item)
        else:
            continue
        prog = (item.get("program", "") or "").strip()
        if not prog or prog.upper() in seen:
            continue
        seen.add(prog.upper())
        toks = [t.strip("()") for t in prog.upper().replace("/", " ").split()]
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
    # Deterministic seed->copybook grounding: resolve each seed field to the copybook that
    # DEFINES it (field index, no LLM), falling back to a substring match for non-field seeds.
    fidx = _field_index()
    focus_set: set[str] = set()
    for s in seeds:
        su = s.upper()
        for unit in fidx.get(su, []):
            if unit in corpus.copybooks:
                focus_set.add(unit)
        for cb in corpus.copybooks:
            if cb in su:
                focus_set.add(cb)
    focus = sorted(focus_set)

    # Add-field / copybook-targeted changes resolve NO seed programs (the fields are new), but
    # the focus set still names the copybook — and changing a shared record's layout has a real,
    # deterministic blast radius: the recompile set, i.e. every program with a parsed COPY edge
    # to it. subgraph_for's focus expansion computes exactly that with empty seeds.
    if seed_progs or focus:
        sub = subgraph_for(_full_graph(), seed_progs, focus_copybooks=focus or None)
    else:
        sub = {"nodes": [], "edges": []}

    edit_sites = seed_progs or focus
    metrics = graph_metrics(sub, corpus)
    metrics["lines_in_scope"] = sum(corpus.get(n).n_lines for n in edit_sites if corpus.get(n))
    metrics["copybooks_resolved"] = f"{len(corpus.copybooks)}/{len(corpus.copybooks)}"

    graph_desc = _describe_graph(sub)
    user = (
        f"Change request: {state.get('change_request','')}\nEdit sites: {', '.join(edit_sites) or '(none)'}\n\n"
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
            payload={"explanation": str(payload.get("explanation") or "")},
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
    rationale = (resume or {}).get("rationale", "") if isinstance(resume, dict) else ""

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
    return {"decision": decision, "edited_diff": edited, "rationale": rationale, "cells": cells}


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
            rationale=str(state.get("rationale") or ""),
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
