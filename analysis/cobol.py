"""analysis/cobol.py — THE SPINE: the deterministic COBOL dependency graph (§8.6 / §5).

    build_dependency_graph(corpus_dir) -> {"nodes": [...], "edges": [GraphEdge...]}

Each edge carries a first-class `verified` flag (§8.4). The LLM only NARRATES over this
graph — it never invents edges (§5). The RETURN SHAPE is frozen across tiers: only the
`verified` flags and accuracy change when a fuller parser lands (T2.1). That is what lets
the UI/cells stay untouched when inferred edges become verified.

A lightweight, honest static extractor (T2.1 — a "lightweight static extractor", not a full grammar):
  * COPY edges     → parsed from `COPY <name>`                          → verified=True
  * CALL edges     → parsed from static `CALL '<name>'`                 → verified=True
  * CICS LINK/XCTL → parsed from `... LINK|XCTL ... PROGRAM('<name>')` AND data-name dispatch
                     `PROGRAM(<name>)` resolved via VALUE/MOVE bindings           → verified=True
  * other PROGRAM()→ e.g. HANDLE ABEND, or an ambiguous/unresolved data-name      → verified=False
  * WRITES edges   → heuristic (WRITE-TO-<copybook> / SQL INSERT INTO)   → verified=False (inferred)
  * data items     → 01–49/77 names + PIC via build_field_index()        → deterministic field grounding
Comment lines (indicator column 7 == '*') are skipped. Self-loops are dropped.
"""
from __future__ import annotations

import re

from analysis.corpus import Corpus, load_corpus

_COPY_RE = re.compile(r"""^\s*COPY\s+['"]?([A-Z0-9][A-Z0-9-]*)""", re.IGNORECASE)
_CALL_RE = re.compile(r"""\bCALL\s+['"]([A-Z0-9][A-Z0-9-]*)['"]""", re.IGNORECASE)
_PROGRAM_RE = re.compile(r"""PROGRAM\(\s*['"]([A-Z0-9][A-Z0-9-]*)['"]""", re.IGNORECASE)
# Unquoted PROGRAM(data-name): CBSA dispatches CICS via a data-name whose VALUE/MOVE binds it
# to a program literal (e.g. PROGRAM(WS-ABEND-PGM) with WS-ABEND-PGM VALUE 'ABNDPROC'). Resolved below.
_PROGRAM_VAR_RE = re.compile(r"""PROGRAM\(\s*([A-Z0-9][A-Z0-9-]*)""", re.IGNORECASE)
_VALUE_BIND_RE = re.compile(r"""\b([A-Z0-9][A-Z0-9-]*)\s+PIC\s+X\(\d+\)[^.]*?VALUE\s+(?:IS\s+)?['"]([A-Z0-9][A-Z0-9-]*)['"]""", re.IGNORECASE)
_MOVE_BIND_RE = re.compile(r"""\bMOVE\s+['"]([A-Z0-9][A-Z0-9-]*)['"]\s+TO\s+([A-Z0-9][A-Z0-9-]*)""", re.IGNORECASE)
_INSERT_RE = re.compile(r"\bINSERT\s+INTO\s+([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
_WRITE_SECT_RE = re.compile(r"\bWRITE-TO-([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
_DATA_ITEM_RE = re.compile(r"^\s*(0[1-9]|[1-4][0-9]|77)\s+([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
_PIC_RE = re.compile(r"\bPIC(?:TURE)?\s+(?:IS\s+)?([-A-Z0-9()V.,+*$/CRDBZ]+)", re.IGNORECASE)


def _is_comment(line: str) -> bool:
    # Fixed-format COBOL: column 7 (index 6) is the indicator area; '*' or '/' => comment.
    return len(line) > 6 and line[6] in "*/"


def _content_lines(text: str) -> list[str]:
    return [ln for ln in text.splitlines() if not _is_comment(ln)]


def _dedupe(edges: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    out: list[dict] = []
    for e in edges:
        key = (e["frm"], e["to"], e["kind"])
        if key in seen or e["frm"] == e["to"]:
            continue
        seen.add(key)
        out.append(e)
    return out


def _edge(frm: str, to: str, kind: str, verified: bool) -> dict:
    return {"frm": frm.upper(), "to": to.upper(), "kind": kind, "verified": verified}


def _cics_transfer(blob: str, pos: int) -> bool:
    """True if the PROGRAM(...) at `pos` sits inside an EXEC CICS LINK/XCTL statement (a real
    control transfer). Scans back to the enclosing EXEC so multi-line EXEC blocks still resolve."""
    start = blob.rfind("EXEC", max(0, pos - 400), pos)
    ctx = (blob[start:pos] if start != -1 else blob[max(0, pos - 60):pos]).upper()
    return "LINK" in ctx or "XCTL" in ctx


def graph_from_corpus(corpus: Corpus) -> dict:
    """Build the full dependency graph from an already-loaded Corpus."""
    known = set(corpus.programs) | set(corpus.copybooks)
    edges: list[dict] = []

    for prog in corpus.programs.values():
        lines = _content_lines(prog.text)
        blob = "\n".join(lines)

        for ln in lines:
            m = _COPY_RE.match(ln)
            if m:
                edges.append(_edge(prog.name, m.group(1), "COPY", True))

        for m in _CALL_RE.finditer(blob):
            edges.append(_edge(prog.name, m.group(1), "CALL", True))

        # program-name bindings: data-name -> known program literal(s), from VALUE clauses and
        # MOVE 'LIT' TO <name>. Lets us resolve PROGRAM(<data-name>) dispatch (the CBSA norm).
        bindings: dict[str, set[str]] = {}
        for m in _VALUE_BIND_RE.finditer(blob):
            lit = m.group(2).upper()
            if lit in corpus.programs:
                bindings.setdefault(m.group(1).upper(), set()).add(lit)
        for m in _MOVE_BIND_RE.finditer(blob):
            lit = m.group(1).upper()
            if lit in corpus.programs:
                bindings.setdefault(m.group(2).upper(), set()).add(lit)

        # CICS transfers. PROGRAM('LIT') and PROGRAM(<data-name>) both count; a LINK/XCTL in the
        # enclosing EXEC block => verified; other PROGRAM() refs (e.g. HANDLE ABEND) => inferred.
        for m in _PROGRAM_RE.finditer(blob):  # quoted literal
            target = m.group(1).upper()
            if target in corpus.programs and target != prog.name:
                edges.append(_edge(prog.name, target, "CALL", _cics_transfer(blob, m.start())))
        for m in _PROGRAM_VAR_RE.finditer(blob):  # unquoted data-name (or bare literal)
            tok = m.group(1).upper()
            targets = bindings.get(tok) or ({tok} if tok in corpus.programs else set())
            resolvable = len(targets) == 1  # a single unambiguous binding is a verifiable target
            for target in targets:
                if target != prog.name:
                    edges.append(_edge(prog.name, target, "CALL", _cics_transfer(blob, m.start()) and resolvable))

        # WRITES: heuristic — a WRITE-TO-<X> section or SQL INSERT INTO <X> naming a copybook.
        for m in list(_WRITE_SECT_RE.finditer(blob)) + list(_INSERT_RE.finditer(blob)):
            target = m.group(1).upper()
            if target in corpus.copybooks:
                edges.append(_edge(prog.name, target, "WRITES", False))

    edges = _dedupe(edges)
    node_set = set(corpus.programs) | {e["frm"] for e in edges} | {e["to"] for e in edges}
    nodes = sorted(node_set)
    return {"nodes": nodes, "edges": edges}


def build_dependency_graph(corpus_dir: str) -> dict:
    """§8.6 entry point — load the corpus and build the graph. Shape frozen across tiers."""
    return graph_from_corpus(load_corpus(corpus_dir))


# --------------------------------------------------------------------------- #
# Data-item extraction (01/05 + PIC) — deterministic field grounding (T2.1).    #
# --------------------------------------------------------------------------- #

def extract_fields(text: str) -> list[dict]:
    """Parse 01–49/77-level data items (name + PIC) from COBOL source. Elementary items carry
    a PIC; group items do not. FILLER is skipped. Deterministic — no LLM."""
    out: list[dict] = []
    for ln in _content_lines(text):
        m = _DATA_ITEM_RE.match(ln)
        if not m:
            continue
        name = m.group(2).upper()
        if name == "FILLER":
            continue
        pm = _PIC_RE.search(ln)
        out.append({"level": int(m.group(1)), "name": name, "pic": pm.group(1).rstrip(".") if pm else None})
    return out


def build_field_index(corpus: Corpus) -> dict[str, list[str]]:
    """Map each data-field name -> the unit(s) that DEFINE it (copybooks first, then programs).
    Lets a seed symbol like ACCOUNT-OVERDRAFT-LIMIT resolve to its defining copybook with NO
    LLM — the deterministic 'not a prompt wrapper' keystone (§5)."""
    index: dict[str, list[str]] = {}
    for unit in list(corpus.copybooks.values()) + list(corpus.programs.values()):
        for f in extract_fields(unit.text):
            bucket = index.setdefault(f["name"], [])
            if unit.name not in bucket:
                bucket.append(unit.name)
    return index


# --------------------------------------------------------------------------- #
# Blast-radius extraction — the subgraph the Impact cell narrates + renders.   #
# --------------------------------------------------------------------------- #

def subgraph_for(
    graph: dict,
    seeds: list[str],
    focus_copybooks: list[str] | None = None,
    max_fanin: int = 10,
) -> dict:
    """Return the blast-radius subgraph around `seeds`:
      * the seed programs,
      * their direct neighbours (anything one CALL/COPY/WRITES hop away),
      * plus programs that share a *domain* copybook with a seed (2-hop via shared record) —
        this is what makes the blast radius visibly wide (e.g. everything COPYing ACCOUNT).

    The 2-hop expansion is deliberately gated so it does NOT explode through ubiquitous
    plumbing copybooks (SORTCODE, ABNDINFO, copied by nearly every program). Expansion runs
    only through `focus_copybooks` if given, else through the seeds' copybooks whose fan-in
    is <= `max_fanin` (domain records, not utilities). Plumbing copybooks still appear as
    1-hop leaves — they just don't drag in all of their other users.
    """
    from collections import Counter

    edges = graph.get("edges", [])
    seed_set = {s.upper() for s in seeds}
    included: set[str] = set(seed_set)

    # 1-hop neighbours in either direction.
    for e in edges:
        if e["frm"] in seed_set:
            included.add(e["to"])
        if e["to"] in seed_set:
            included.add(e["frm"])

    # Which copybooks may drive the 2-hop expansion.
    if focus_copybooks is not None:
        expand_via = {c.upper() for c in focus_copybooks}
    else:
        fanin = Counter(e["to"] for e in edges if e["kind"] == "COPY")
        seed_copybooks = {
            e["to"] for e in edges if e["frm"] in seed_set and e["kind"] == "COPY"
        }
        expand_via = {cb for cb in seed_copybooks if fanin[cb] <= max_fanin}

    for e in edges:
        if e["kind"] == "COPY" and e["to"] in expand_via:
            included.add(e["frm"])
            included.add(e["to"])

    sub_edges = [e for e in edges if e["frm"] in included and e["to"] in included]
    nodes = sorted(set(seed_set) | {e["frm"] for e in sub_edges} | {e["to"] for e in sub_edges})
    return {"nodes": nodes, "edges": sub_edges}


def graph_metrics(graph: dict, corpus: Corpus | None = None) -> dict:
    """Counters derived straight from the graph (feeds T2.5 hero metrics)."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    if corpus:
        program_names = set(corpus.programs)
        copybook_names = set(corpus.copybooks)
        programs = [n for n in nodes if n in program_names]
        copybooks = [n for n in nodes if n in copybook_names]
    else:
        programs, copybooks = nodes, []
    return {
        "programs_traced": len(programs),
        "copybooks_traced": len(copybooks),
        "nodes": len(nodes),
        "dependencies_found": len(edges),
        "verified_edges": sum(1 for e in edges if e.get("verified")),
        "inferred_edges": sum(1 for e in edges if not e.get("verified")),
    }
