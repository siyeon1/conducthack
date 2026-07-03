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
