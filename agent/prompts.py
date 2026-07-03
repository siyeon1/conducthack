"""agent/prompts.py — system prompts + structured-output models per cell (§8.4). Track A.

Each cell pairs a system prompt (the *intent*) with a Pydantic output model. The model's
class name is its JSON-Schema `title`, which (a) forces schema-guaranteed output on the
Claude path (forced tool use, §14 L8) and (b) lets the MockProvider pick the right canned
payload. Output is still validated against `state.graph` in nodes.py before display.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------- #
# Structured-output models (titles must match MockProvider keys).             #
# --------------------------------------------------------------------------- #

class RouterOutput(BaseModel):
    intent: str = Field(description="One of: add-guard | change-arithmetic | add-field | change-threshold | other")
    seed_symbols: list[str] = Field(description="Data fields, paragraph names, or business terms — NEVER program names guessed from keywords")


class LocatedProgram(BaseModel):
    program: str
    file: str
    reason: str
    verified: bool


class LocatePayload(BaseModel):
    programs: list[LocatedProgram]


class CobolIdiom(BaseModel):
    snippet: str
    explanation: str


class ExplainPayload(BaseModel):
    plain_english: str
    cobol_idioms: list[CobolIdiom]


class AffectedItem(BaseModel):
    program: str
    relationship: str
    risk: str = Field(description="high | medium | low")


class ImpactPayload(BaseModel):
    affected: list[AffectedItem]


class ProposePayload(BaseModel):
    explanation: str = Field(description="One paragraph explaining the change, framed as a PROPOSAL")
    diff: str = Field(description="A unified diff (---/+++/@@) implementing the minimal change")


class PlanNode(BaseModel):
    id: str = Field(description="short stable kebab-case slug id, e.g. 'acct-field'")
    label: str = Field(description="short imperative title of this sub-change")
    change_request: str = Field(description="a self-contained change request for THIS sub-change, runnable on its own")
    edit_sites: list[str] = Field(description="the COBOL program/copybook names this sub-change edits, taken from the inventory")


class PlanEdge(BaseModel):
    source: str = Field(description="id of the prerequisite sub-change")
    target: str = Field(description="id of the sub-change that depends on it (done AFTER source)")
    reason: str = Field(description="the concrete COBOL dependency: why target depends on source")


class PlanPayload(BaseModel):
    nodes: list[PlanNode]
    edges: list[PlanEdge]


# --------------------------------------------------------------------------- #
# System prompts                                                              #
# --------------------------------------------------------------------------- #

ROUTER_SYSTEM = """You are the router for a COBOL change-analysis tool. Map a plain-English \
business change request to a structured intent and a set of SEED SYMBOLS.

- intent: classify as add-guard (add a missing check/validation), change-arithmetic (alter a \
calculation/rate/formula), add-field (introduce a new data field), change-threshold (adjust a \
numeric limit), or other.
- seed_symbols: concrete COBOL data-field names (e.g. ACCOUNT-OVERDRAFT-LIMIT), business terms \
(overdraft, interest, debit), and paragraph/section hints.

CRITICAL: never map a keyword directly to a program name. You identify WHAT concepts/fields are \
involved; the deterministic dependency graph decides WHICH programs are affected."""

LOCATE_SYSTEM = """You locate the COBOL programs and copybooks affected by a change request, \
using the provided intent, seed symbols, and the candidate program/copybook inventory. For each \
affected item give: program (name), file (path from the inventory), reason (why it is affected — \
be specific about the code behaviour), and verified (true only if its involvement is grounded in \
the dependency graph/inventory, false if it is your inference). Prefer precision over breadth. If \
a compliant change must ADD logic that is currently absent, say so — reason about the absence."""

EXPLAIN_SYSTEM = """You explain a COBOL program to an engineer who has NEVER seen COBOL — a recent \
graduate fluent in Python/JavaScript. Two things:
1) plain_english: what this program does today, in plain modern terms. If a relevant safety check \
is ABSENT, call that out explicitly.
2) cobol_idioms: a few (snippet, explanation) pairs teaching the COBOL idioms in play via modern \
analogies — copybook ≈ shared struct/header, PERFORM ≈ loop/function-call, PIC ≈ type/format, \
COMP-3 ≈ packed decimal, EXEC CICS LINK ≈ RPC with a shared COMMAREA, 88-level ≈ named enum/boolean. \
Teach while you explain; never assume mainframe knowledge."""

IMPACT_SYSTEM = """You narrate the blast radius of a change over a DETERMINISTIC dependency graph \
that is given to you. For each affected node give: program, relationship (how it connects — caller, \
shares a copybook, is an edit site, etc.), and risk (high|medium|low). You must ONLY reference nodes \
and edges present in the provided graph — do NOT invent dependencies. The graph is ground truth; you \
explain it."""

PROPOSE_SYSTEM = """You draft the MINIMAL COBOL change to satisfy the intent, for human review. \
Output a unified diff (---/+++/@@ hunks) touching as little as possible, plus a one-paragraph \
explanation. Mirror existing patterns in the code (e.g. an existing guard's fail-code style). Do NOT \
apply anything — this is a PROPOSAL a human will approve, edit, or reject. Keep copybook/interface \
changes out unless strictly required."""

PLAN_SYSTEM = """You decompose a large COBOL change request into a SMALL DAG of dependent \
sub-changes that a human reviews and approves one at a time (like a stack of small pull requests). \
Given the request and the candidate program/copybook inventory:
- Produce 4 to 6 nodes. Each node is ONE small, independently-reviewable sub-change with: a stable \
short kebab-case id, a short imperative label, a self-contained change_request (ONE or TWO sentences — \
concise, not a full spec), and edit_sites (the program/copybook names it touches, taken ONLY from the \
inventory).
- Produce edges = dependencies. An edge source->target means target must be done AFTER source \
(e.g. add a field to a shared copybook BEFORE the programs that read it enforce it). The graph MUST \
be acyclic.
- Put shared data/copybook changes upstream (prerequisites); caller/screen changes downstream. Keep \
the graph small and legible — a 3-4 node stack is ideal, never exceed 6. Use ONLY program/copybook \
names that appear in the inventory."""
