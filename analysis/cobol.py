"""analysis/cobol.py — THE SPINE: the deterministic COBOL dependency graph (§8.6 / §5).

    build_dependency_graph(corpus_dir) -> {"nodes": [...], "edges": [GraphEdge...]}

Each edge carries a first-class `verified` flag (§8.4). The LLM only NARRATES over this
graph — it never invents edges (§5). The RETURN SHAPE is frozen across tiers: only the
`verified` flags and accuracy change when a fuller parser lands (T2.1). That is what lets
the UI/cells stay untouched when inferred edges become verified.

Tier-1 status of this implementation — a lightweight, honest static extractor:
  * COPY edges  → parsed from `COPY <name>` statements           → verified=True
  * CALL edges  → parsed from `CALL '<name>'`                     → verified=True
  * CICS LINK/XCTL edges → heuristic `PROGRAM('<name>')` match    → verified=False (labelled inferred)
  * WRITES edges → heuristic (WRITE-TO-<copybook> / INSERT INTO)  → verified=False (labelled inferred)
Comment lines (indicator column 7 == '*') are skipped. Self-loops are dropped.
"""
from __future__ import annotations

import re

from analysis.corpus import Corpus, load_corpus

_COPY_RE = re.compile(r"^\s*COPY\s+([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
_CALL_RE = re.compile(r"""\bCALL\s+['"]([A-Z0-9][A-Z0-9-]*)['"]""", re.IGNORECASE)
_PROGRAM_RE = re.compile(r"""PROGRAM\(\s*['"]([A-Z0-9][A-Z0-9-]*)['"]\s*\)""", re.IGNORECASE)
_INSERT_RE = re.compile(r"\bINSERT\s+INTO\s+([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)
_WRITE_SECT_RE = re.compile(r"\bWRITE-TO-([A-Z0-9][A-Z0-9-]*)", re.IGNORECASE)


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

        # CICS LINK/XCTL: PROGRAM('X') referencing another known program → inferred CALL.
        for m in _PROGRAM_RE.finditer(blob):
            target = m.group(1).upper()
            if target in corpus.programs and target != prog.name:
                edges.append(_edge(prog.name, target, "CALL", False))

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
