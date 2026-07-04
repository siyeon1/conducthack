# shft — Complete Build & Instructions Document (v2)
### Conduct AI Track: "Make Legacy Move" · Imperial Hackathon
**This is the single source of truth for the team. If you have a question while building, check here first. If the answer isn't here, ask the lead, then we add it here.**

> **v2 changelog (read if you saw v1):** Corpus switched to **IBM CBSA as primary**, Bank-of-Z now documented fallback (§10). Scope is now **three tiers**, not two — the MVP stays small but the *deterministic dependency graph is built graph-shaped from day one* (§6/§7). Frozen contracts updated: the `propose` step is **split into `propose` + `approve` nodes** (§8.1, landmine L2), the ledger hashing rule is now **RFC 8785 canonical JSON with Decimals-as-strings** (§8.5, landmine L5), and every dependency edge carries a **`verified` vs `inferred`** flag as a first-class payload field (§8.4). New §14 = the technical landmine map. Version pins added (§15). This document and the team's `CLAUDE.md` are designed to agree; where they ever conflict on a contract, **stop and ask the lead**.

---

## 0. How to read this document

- **Sections 1–3** are the *why* and *what*: the problem, the user, the product. Read once, fully, before writing code.
- **Section 4** is the *90-second pitch* + how we win. Memorise the spine.
- **Sections 5–9** are the *how*: architecture, frozen contracts, parallel workstreams, timeline.
- **Sections 10–13** are *reference*: corpus, local-LLM infra, blockchain, demo script.
- **Sections 14–15** are the *technical landmine map* and *quick-reference pins* — the most load-bearing engineering detail. If you write agent, checkpointer, or ledger code, read §14 before you start.

**Golden rules (non-negotiable):**
1. **Stay in your lane.** You own a disjoint set of files (§8/§9). Need another lane's file? **STOP** — a contract is missing. Surface it; don't cross the streams.
2. **Contracts are frozen.** Never change a shared schema, the REST shape, the hashing rule, or a version pin without the lead's sign-off. Silent changes break other live sessions.
3. **The MVP is sacred.** Nothing in Tier 2 or Tier 3 starts until the full MVP runs end-to-end **twice in a row without a restart**. The judges explicitly penalise demos that only run when scripted.
4. **The COBOL never executes.** Static analysis + reasoning over source only. No mainframe, CICS, IMS, Db2. GnuCOBOL is allowed *only* as an optional `-fsyntax-only` check on a generated diff — never to run bank logic.
5. **Control beats autonomy.** Every state-changing action is gated behind explicit human approve/edit/reject. This is the whole thesis and 20% of the score.
6. **Verify, don't assume.** Exact file paths, copybook field names, and program lists must be confirmed against the live checkout before they enter code or the pitch (§10). A wrong field name in front of a banking judge is expensive.

**When you hit a judgment call, optimise in this order:** (1) does the MVP still run twice cold? → (2) does this strengthen generality or the impact metric? → (3) does it reinforce human control? → (4) is it honest / not over-claiming? If a change fails (1) or (4), don't do it.

---

## 1. The problem statement (detailed)

### 1.1 The problem in one paragraph
Large UK banks run core systems written in COBOL, decades old, millions of lines deep, poorly documented. When the business must change — a new regulation, a new pricing rule, a new market — that software must change too. But the people who understood it have retired, and the graduates the bank can hire have never seen COBOL. So a change that should take days takes months: a scarce specialist (or a consultant at £550+/day) spends weeks manually tracing what a program does and what will break if it's touched, before a single line is altered. That manual comprehension-and-dependency-tracing step is the bottleneck. **We built the tool that collapses it — while keeping a human in control of every change.**

### 1.2 Why this problem, grounded in evidence
Not invented for the demo. It is the documented, repeated cause of the largest IT failures in banking and public administration:

- **The comprehension gap is real and quantified.** A 2025 Baringa survey of UK banks found 50% depend on one or two staff — at or near retirement — to understand their legacy software; 16% still run 1960s code and ~40% run 1970s code. When those people leave, the knowledge leaves with them.
- **Losing the thread causes catastrophes.** TSB's 2018 "big-bang" migration (proceeding without fully understanding the risks, incomplete testing) locked out ~1.9M customers, cost £330M+ in post-migration costs plus a £48.65M regulatory fine. Queensland Health's payroll replacement went live with known defects and ~10% testing, mis-paid 78,000 staff, ballooned past A$1.2B. The IRS has failed for over a decade to replace a 60-year-old assembly/COBOL system that 20M+ lines of code and hundreds of applications depend on.
- **It's not the language — it's the lost knowledge.** During the 2020 COVID unemployment surge, states publicly begged for COBOL programmers. Experts (Gartner, Micro Focus) were unanimous: the real problem was not COBOL syntax but the accumulated, undocumented business rules and the retirement of the people who understood them.

**The lesson every one teaches:** legacy change fails when humans lose the thread on what the code does, what depends on it, and what a safe change looks like. Our tool keeps the human on the thread at every step, and makes every step verifiable.

### 1.3 The specific slow process we attack
Of the whole modernization journey, we attack its **first and most expensive step**: *understanding a legacy system well enough to change it safely.* No bank rewrites a COBOL program until someone has traced every program that calls it, every copybook it shares, and every downstream effect of touching it. Today that is manual, slow, and gated on a handful of retiring experts. We do **not** attempt a full COBOL→Java rewrite (multi-year; would break in a demo). We make the comprehension-and-safe-change step 10× faster, with the human as approver.

### 1.4 The worked example threaded through everything
Our concrete change, used in every section and the demo: **"Introduce a cap / compliant guard on overdraft fees to comply with FCA Consumer Duty."** A non-engineer instantly understands it; it's regulation-driven (exactly the kind of change the brief names); and on our primary corpus (CBSA) it has a genuinely impressive property — the overdraft limit lives on the ACCOUNT record but is **not enforced** on the transfer/debit path (XFRFUN/DBCRFUN). So the honest, impressive answer is *"a compliant change must ADD a guard here"* — the tool reasons about the **absence** of logic, not just find-and-replace. (FCA framing note in §10.)

---

## 2. The end user (and how the product is tuned for them)

### 2.1 Who the user is
**Primary user: the "new-joiner enterprise engineer."** A recent computer-science graduate (or a developer new to the bank's mainframe estate), fluent in modern tools — Python, JavaScript, Git, React, cloud — who has *never* seen COBOL, a copybook, a `PIC` clause, or a CICS `EXEC` block. This is the person banks *can* actually hire, standing in for the retiring veteran they *cannot* replace.

This reframes the whole product. The gap is not a labour shortage — it's a **comprehension gap between two generations of technology.** Our tool is the bridge: it lets the engineer the bank can hire do the work of the expert it can't.

**Secondary users** (mention in pitch): the modernization lead/architect who needs confidence changes are safe and reversible; the IT auditor/compliance officer who later needs to prove exactly what changed, who approved it, and why (this is who the ledger serves).

### 2.2 How the product is specifically tuned for this user
Not a generic code assistant. Every design choice serves the new-joiner engineer:

- **Explains in modern-language analogies, never assuming mainframe knowledge.** "A copybook is like a shared header / struct definition imported across files"; "this `PERFORM ... VARYING` is a for-loop." (Implemented via the `explain` cell's system prompt — §8.4.)
- **Teaches while doing.** The explanation cell surfaces not just *what* the code does but *the COBOL idiom in play*, so the user levels up as they work.
- **Never dumps raw complexity.** One bounded, digestible cell at a time. Comprehension is paced.
- **Shows the blast radius visually.** A graduate can't hold the dependency web in their head like a veteran could, so we render it.
- **Keeps them in control without requiring expertise to *be* in control.** Approve/edit/reject on a plain-English change plan — the user needn't know COBOL to decide whether it's what they intended.
- **Honesty about uncertainty.** When a dependency is LLM-`inferred` rather than statically `verified`, the UI says so. A new joiner especially needs to know what's proven vs suggested.

### 2.3 What the product is NOT
Not an autonomous migration bot. Not a full COBOL→Java transpiler. Not a mainframe emulator. Not a chatbot. It is a **controllable change cockpit** for one engineer to safely make one business-driven change at a time.

---

## 3. The product (concept)

### 3.1 One-sentence definition
An AI "change cockpit" for legacy banking code: a professional describes a business change in plain English, and a human-in-the-loop agent locates every affected COBOL program and copybook, explains what each does today, maps the blast radius, proposes the specific edits, and records every step to a tamper-evident (optionally blockchain-anchored) ledger — executing only what the human approves.

### 3.2 The interaction model: a notebook of reviewable steps
The UI is a **notebook** — a vertical stack of "cells." Critically, each cell is a *step in the change plan*, not a live code kernel. "Running" a cell means the agent performs that analysis or drafting step and renders its result for review. The COBOL never executes.

The five *user-visible* cells (the MVP flow), for our overdraft example:

| Cell | Name | What "run" does | Gated? |
|------|------|-----------------|--------|
| 1 | **Locate** | Given the change request, find every program/copybook affected. Returns a list with citations + verified/inferred flags. | No (read-only) |
| 2 | **Explain** | For a selected program, explain in plain English (teaching COBOL idioms) what it does today. | No (read-only) |
| 3 | **Impact** | Map the blast radius — what else calls/depends on this, what could break. Render as a graph. | No (read-only) |
| 4 | **Propose** | Draft the specific change as a diff, clearly marked as a *proposal*. | **YES — hard gate** |
| 5 | **Record** | On approval, write the step to the tamper-evident ledger. | (writes only on approval) |

> **Engineering note (see §14, L2):** the single "Propose" cell is implemented as **two graph nodes** — `propose` (generates the diff, writes it to state) and `approve` (whose first and only significant action is `interrupt()`). This is invisible to the user but essential: it prevents the diff-generation LLM call from re-running on resume and producing a different diff than the human approved.

**The control lives in the gaps between cells.** Read-only cells (1–3) run freely. The Propose/Approve gate (4) cannot finalise a change without explicit human **approve / edit / reject**. This is the structural embodiment of "real constraints on what the agent can change on its own."

### 3.3 The three differentiators (what makes this prize-worthy, not a prompt wrapper)
1. **The control surface.** A stateful, checkpointed agent graph with a human-approval interrupt on the state-changing step, time-travel to re-run a cell with edits, and a structural allowlist (read-only auto-approved, writes default-denied). Maps to real frontier engineering (LangGraph interrupts/checkpoints).
2. **Verifiable provenance.** A canonical-JSON, SHA-256 hash-chained, append-only ledger of every change decision, optionally anchored by Merkle root to a blockchain — so an auditor can *prove* the record wasn't altered. Ties to auditability requirements (e.g. EU AI Act Article 12, banking regulation).
3. **Data sovereignty by design.** A provider-abstraction layer lets the entire system run against a **local LLM** (air-gapped, on-premise) so a bank's code never leaves the building — the #1 reason UK financial institutions cite for on-prem AI. (Infra built and shown in the repo; demo runs on the Claude API.)

**The keystone under all three (and the thing that makes us not-a-prompt-wrapper): the deterministic COBOL dependency graph** (§5). It proves generality (works on any request/corpus) *and* produces every impact metric (programs/paragraphs/lines/deps come straight from it). It is built **graph-shaped from day one** even when its first edges are LLM-`inferred`.

---

## 4. The 90-second pitch + how we win

### 4.1 How we win (the competition north star)
~100+ teams; many will build "AI reads COBOL." Assume that obvious version is table stakes. **Judging: 35% technical execution · 30% impact/speed-up · 20% user-stays-in-control · 20% demo.** We separate on **two axes**, both powered by the one artifact (the dependency graph):

- **A · Generality (technicality).** Prove the engine is *not* a scripted one-shot: it handles **multiple genuinely different change types**, **a second unseen codebase**, and **fails gracefully** on messy input. This beats "a wrapper around a prompt."
- **B · Impact/speed-up.** An **honest, instrumented before/after** a non-engineer grasps in 90 seconds: *weeks of a £550/day specialist → ~30 seconds, human still approves the diff.*

### 4.2 The pitch spine (memorise the shape, not the words)
1. **Hook (15s) — documented pain.** "In 2018, TSB tried to change its core banking system. It locked 1.9 million customers out and cost over £330 million. The cause wasn't bad code — it was that nobody fully understood the system they were changing. Across UK banking, half of banks now depend on one or two people, near retirement, to understand software written in the 1970s."
2. **Gap (15s) — who's left.** "The engineers who understood COBOL are retiring. The graduates banks can hire have never seen it. So every business change waits months while a scarce specialist traces, by hand, what the code does and what will break."
3. **Product (20s) — what we built.** "This is shft. A graduate engineer types a change in plain English — 'cap overdraft fees for Consumer Duty.' The agent finds every affected program, explains each in plain English, shows exactly what will break, and proposes the change — one reviewable step at a time. The engineer approves each step. The agent never changes anything on its own."
4. **Before/after (20s) — the live moment.** "What took a specialist weeks — [old way: backlog ticket, weeks, £550/day] — happens here in about thirty seconds. [Run the cells live.] Locate. Explain. Impact. Propose. Approve."
5. **Differentiators (15s) — enterprise-real.** "Every change is recorded to a tamper-evident, optionally blockchain-anchored ledger — so an auditor can prove exactly what changed and who approved it. Parsing, the dependency graph, and the ledger run on-premise; the model itself can be deployed in the bank's own cloud under a zero-retention agreement."
6. **Close (5s).** "shft: change your systems as fast as you change your mind — without losing control."

**One-liner if you get one sentence:** *"We let the graduate engineer a bank can hire do the work of the COBOL veteran it can't — safely, step by step, with every change provable, governed, and auditable."*

---

## 5. Architecture spine (the thing that makes us not-a-prompt-wrapper)

```
Plain-English change request
        │
        ▼
[ Router / classifier ]  ── LLM maps text → intent type + seed symbols (NO keyword→program hardcoding)
        │
        ▼
[ DETERMINISTIC COBOL INDEX ]  ← THE SPINE. Computed by code, identical every run.
   programs · paragraphs · copybooks · CALL/COPY/PERFORM edges · data fields · PIC · WRITE/REWRITE sites
        │           (LLM only NARRATES over this; it never invents the graph)
        ▼
[ Hybrid retrieval ]  semantic embeddings over paragraph text/comments  +  exact symbol/graph search
        │
        ▼
5 user cells:  Locate → Explain → Impact(blast-radius graph) → Propose ─[HUMAN GATE]─ Record(ledger)
                                                              (propose + approve nodes internally)
```

**The rule that defines the whole product:** dependency **edges are deterministic** — parsed by code, or clearly labelled `inferred` until the parser lands. **The LLM explains, proposes, and narrates — it does not decide what depends on what.** Tag every edge/claim **`verified`** (from the parser) vs **`inferred`** (from the LLM) and surface it in the UI. This single honesty feature scores under *both* "technical execution" and "user-stays-in-control."

**Why graph-shaped from day one matters:** whether the edges come from an LLM guess or a real parser, the *shape* the cells consume is identical (nodes + edges + verified flag). So we can ship the MVP on inferred edges and later swap in parsed edges **without touching a single cell payload or UI component.** This is what lets Tier-2 work proceed in parallel without breaking Tier-1.

**Tech stack (frozen):**
- **Agent/orchestration:** Python 3.11+, LangGraph (pinned — §15), LangChain core.
- **LLM:** Claude API (live/demo) via a provider abstraction that also supports Ollama (local). Anthropic Python SDK; **structured outputs** for cell payloads (§14, L8).
- **API:** FastAPI + Uvicorn, **async-everywhere** (§14, L3).
- **Frontend:** React (Vite) + Tailwind. Plain fetch to the API.
- **Ledger:** Python (`hashlib` + `rfc8785` for canonical bytes — §14, L5). Stretch anchoring: local Anvil/Hardhat dev chain + minimal Solidity contract storing Merkle roots.
- **State/persistence:** LangGraph `AsyncSqliteSaver` checkpointer; SQLite for the ledger store.
- **COBOL corpus:** **IBM CBSA primary** (`src/base/cobol_src`, `src/base/cobol_copy`); AWS CardDemo for the live swap; IBM Bank-of-Z documented fallback (§10).

---

## 6. TIER 1 — MVP scope (BUILD THIS FIRST — must all run twice cold)

The demoable core. Nothing in Tier 2/3 starts until all of this runs end-to-end twice in a row without a restart.

- [ ] **M1 — Corpus ingestion.** Clone CBSA; **verify paths on clone** (§10); load COBOL + copybooks from disk into memory; a simple index (filename → contents). No mainframe.
- [ ] **M2 — LLM provider abstraction (Claude path).** One `LLMProvider` interface (§8.3); a working `ClaudeProvider`. The `OllamaProvider` is Tier 3, but the *interface* exists now so the repo shows the design. `USE_MOCK_LLM=1` returns canned payloads for offline integration.
- [ ] **M3 — Dependency graph, graph-shaped, edges may be `inferred`.** A `build_dependency_graph(corpus)` that returns `{nodes, edges}` with each edge tagged `verified|inferred`. **In Tier 1 the edges may be LLM-inferred** — but the *shape* is final. (§8.6.)
- [ ] **M4 — The graph nodes.** `locate → explain → impact → propose → approve → record`, with an `AsyncSqliteSaver` checkpointer and `interrupt()` as the **first action of `approve`** (never in `propose`). (§14, L2/L3.)
- [ ] **M5 — FastAPI endpoints, async.** `/session`, `/cell/run`, `/cell/approve`, `/ledger`, `/ledger/verify` per §8.2, threading one `thread_id` per session (§14, L4).
- [ ] **M6 — React notebook UI.** Vertical cells; Run button, status, result pane each. Locate shows citations with verified/inferred badges. Propose shows the diff + Approve/Edit/Reject. A ledger panel.
- [ ] **M7 — Hash-chain ledger + verify.** Every approved step appends a canonical-JSON, SHA-256-linked entry (§8.5, §14 L5); a "Verify integrity" button re-walks the chain and shows pass/fail + the first broken index.
- [ ] **M8 — The worked example runs end-to-end.** Overdraft request → Locate → Explain → Impact → Propose → Approve → Record → Verify. **Reliably, twice in a row, no restart.**

**Definition of done for the MVP:** a non-engineer watches the overdraft change go from plain-English request to a recorded, verified change in under 3 minutes, with a visible human approval gate, working on a second run without a restart. A cell that gets a malformed LLM response returns `status:"error"` and never crashes the session.

---

## 7. TIER 2 — The differentiators (do these BEFORE any polish, after MVP is solid)

These are what win the 35% + 30%. Do them in this order; each must be fully working and committed before the next.

- [ ] **T2.1 — Deterministic parsed edges.** Replace LLM-inferred edges with a real parsed COBOL graph: extract `PROGRAM-ID`, `CALL`, `PERFORM`, `COPY`, `01/05` items + `PIC`, `EXEC CICS/SQL` (as text), and `WRITE/REWRITE` targets. Swap `inferred`→`verified` where proven. **No cell payload changes** — only accuracy + flags. Cite IBM's ICSE 2026 program-analysis-augmented lineage. If a real parser (ProLeap/Koopa) isn't running in ~3h, ship a pragmatic Python line/regex extractor and label it honestly as a "lightweight static extractor."
- [ ] **T2.2 — Second & third change types (zero per-change code paths).** Prove no hardcoding by making the *same engine* handle: (2) **interest-rate change** — different code path (arithmetic/`COMPUTE` + data def): CREACC default, UPDACC update, the interest field; (3) **add a transaction/audit field** (e.g. `channel`) — ripples widest via the **PROCTRAN copybook** and every program that COPYs/writes it (the blast-radius graph lights up — great for the impact shot). The change request must be routed to intent + seed symbols, **never keyword-matched to a program**.
- [ ] **T2.3 — Live corpus swap.** Pre-index **AWS CardDemo** (different vocabulary: cards not accounts). In the demo, `index ./carddemo` and re-run the request to show a *new graph on unseen code*. Do NOT run all corpora live; keep the swap to one pre-warmed command.
- [ ] **T2.4 — Graceful-failure cases (scripted deliberately).** (i) vague request → ask a clarifying question / "insufficient specificity," never hallucinate; (ii) request matching nothing → "no matching symbols, 0 blast radius"; (iii) missing copybook → "unresolved COPY X; copybooks resolved 36/37" and continue with a partial graph; (iv) dialect variance → CardDemo still parses.
- [ ] **T2.5 — Instrumented impact metrics.** Put counters on the LangGraph state; expose `/metrics/{run_id}`; render one ticking hero counter: programs traced · paragraphs traced · lines in scope · dependencies found · copybooks resolved (`36/37`) · wall-clock seconds (`perf_counter`) · tokens/£ (`usage_metadata`). Honest hero denominator with the assumption shown on-screen (§13.2). Always show raw traced counts too.

---

## 8. FROZEN CONTRACTS (the interfaces parallel sessions depend on)

**Do not change anything here without the lead's sign-off.** If a contract is wrong, fix it *here first*, announce it, then sessions update — never silently. **Import shared types from the one canonical module; never redefine a shared type locally** (divergent copies are the #1 way parallel AI sessions drift).

### 8.1 The cell/session state object (the shared shape — the most sacred contract)
`SessionState` is read by the agent, the API, and the frontend. Treat any change to it as a breaking change requiring a broadcast.

```python
# schema.py  — OWNED BY: Track A (lead). Imported by everyone; never redefined.
from typing import TypedDict, Literal, Optional

# NOTE: user sees 5 cells, but the graph has 6 nodes — propose & approve are split (see §14 L2).
CellName  = Literal["locate", "explain", "impact", "propose", "approve", "record"]
CellStatus = Literal["pending", "running", "awaiting_approval",
                     "approved", "rejected", "done", "error"]

class Citation(TypedDict):
    program: str            # e.g. "XFRFUN"
    file: str               # e.g. "src/base/cobol_src/XFRFUN.cbl"
    lines: Optional[str]    # e.g. "120-155" (None if inferred)
    verified: bool          # True if from the parser, False if LLM-inferred

class GraphEdge(TypedDict):
    frm: str                # program/paragraph id  (note: 'frm', not 'from' — reserved word)
    to: str
    kind: Literal["CALL", "PERFORM", "COPY", "WRITES"]
    verified: bool          # True if parsed, False if LLM-inferred

class CellResult(TypedDict):
    cell: CellName
    status: CellStatus
    summary: str            # human-readable (markdown ok)
    citations: list[Citation]
    payload: dict           # cell-specific structured data (see §8.4)
    proposed_diff: Optional[str]   # unified-diff text; set by `propose`, approved in `approve`

class SessionState(TypedDict):
    session_id: str
    thread_id: str          # LangGraph thread; one per session, NEVER shared (see §14 L4)
    change_request: str     # plain-English business change
    intent: Optional[str]   # router output: "add-guard"|"change-arithmetic"|"add-field"|...
    seed_symbols: list[str] # router output: data fields / paragraph names / business terms
    selected_program: Optional[str]
    cells: dict             # CellName -> CellResult
    graph: dict             # {"nodes": [...], "edges": [GraphEdge...]} — THE dependency graph
    metrics: dict           # counters (T2.5): programs_traced, paragraphs, lines_in_scope, ...
    ledger_head: Optional[str]  # entry_hash of latest ledger entry
```

### 8.2 The REST API (server ↔ client contract)
Base URL `http://localhost:8000`. All bodies JSON.

```
POST /session
  body:  { "change_request": string }
  200 →  { "session_id": string, "state": SessionState }
         # server also mints a fresh thread_id (UUID) and stores it in state

POST /cell/run
  body:  { "session_id": string, "cell": CellName, "selected_program"?: string }
  200 →  { "state": SessionState }
         # read-only cells (locate/explain/impact) run to completion
         # `propose` runs, writes proposed_diff, and the graph pauses at `approve`
         #   → returned cell status is "awaiting_approval"

POST /cell/approve
  body:  { "session_id": string,
           "decision": "approve" | "edit" | "reject",
           "edited_diff"?: string }          # required iff decision == "edit"
  200 →  { "state": SessionState }
         # resumes the graph via Command(resume=...) on the SAME thread_id
         # approve/edit → runs `record`; reject → returns to pre-propose state

GET  /ledger?session_id=...
  200 →  { "entries": LedgerEntry[], "verified": boolean }

POST /ledger/verify
  body:  { "session_id": string }
  200 →  { "verified": boolean, "broken_at"?: number }   # index of first broken link

GET  /metrics/{run_id}          # (Tier 2) live counters for the hero display
  200 →  { "programs_traced": int, "paragraphs_traced": int, "lines_in_scope": int,
           "dependencies_found": int, "copybooks_resolved": string,   # "36/37"
           "wall_clock_seconds": number, "tokens": int, "cost_gbp": number }
```

**Error shape (all endpoints):** non-200 → `{ "error": string, "detail"?: string }`.

**Resume mechanics (critical — see §14 L2/L4):** `/cell/approve` calls `graph.ainvoke(Command(resume={"decision": ..., "edited_diff": ...}), config)` with `config={"configurable": {"thread_id": state.thread_id}}`. The resume value becomes the return of the `interrupt()` call inside `approve`.

### 8.3 The LLM provider interface (so local-LLM infra is real)
```python
# llm/provider.py  — OWNED BY: Track A.
from abc import ABC, abstractmethod

class LLMProvider(ABC):
    @abstractmethod
    def complete(self, system: str, user: str, *, schema: dict | None = None,
                 max_tokens: int = 2000) -> dict | str:
        """Return the model's output. If `schema` is provided, return parsed structured
           output (dict) matching it; else return text. (See §14 L8 — structured outputs.)"""
        ...
    @property
    @abstractmethod
    def name(self) -> str: ...           # "claude" | "ollama:<model>"
    @property
    @abstractmethod
    def runs_locally(self) -> bool: ...  # True for Ollama — powers the "data never leaves" UI badge

# Concrete: ClaudeProvider (MVP), OllamaProvider (Tier 3). Selected via env by
#   llm/factory.py::get_provider() -> LLMProvider   (LLM_PROVIDER=claude|ollama, LLM_MODEL=...)
```
**Contract guarantee:** the graph and all cells depend ONLY on `LLMProvider`. No cell imports the Anthropic SDK or Ollama directly. This is what lets the repo credibly show "swap to on-prem" as a one-line env change.

### 8.4 Per-cell payload shapes & prompt contracts
Each cell's `payload` (what the UI relies on); prompt *intent* here, exact prompt text in `agent/prompts.py` (Track A). **All payloads are produced via structured outputs (§14 L8), then validated against `state.graph` before display.**

- **router** (internal, pre-Locate) — sets `state.intent` + `state.seed_symbols`. Prompt intent: map free-text change → an intent type (`add-guard`/`change-arithmetic`/`add-field`/`change-threshold`) and seed symbols (data fields, paragraph names, business terms). **Never keyword-match to a program.**
- **locate** — `payload = {"programs": [{program, file, reason, verified}]}`. Prompt intent: from the graph + retrieval, identify affected programs/copybooks; cite; `verified` mirrors the edge/citation source.
- **explain** — `payload = {"plain_english": str, "cobol_idioms": [{snippet, explanation}]}`. Prompt intent: explain the selected program for someone who has never seen COBOL; teach idioms via modern analogies (copybook≈shared struct/header, `PERFORM`≈loop, `PIC`≈type/format, `COMP-3`≈packed decimal).
- **impact** — `payload = {"affected": [{program, relationship, risk}]}` and the blast-radius subgraph is written into `state.graph` (nodes/edges with verified flags). Prompt intent: given the graph, narrate what calls/depends on this and what could break. **The LLM narrates the graph; it does not invent edges.**
- **propose** — sets `state.proposed_diff` (unified diff) + `payload = {"explanation": str}`. Prompt intent: draft the minimal change to satisfy the intent; output a diff; explain in one paragraph. **Result comes back via the `approve` node as `awaiting_approval`, never `done`.**
- **record** — `payload = {"ledger_entry": LedgerEntry}`. Not an LLM call; writes to the ledger on approval.

### 8.5 The ledger entry & hash-chain contract
```python
# ledger/schema.py  — OWNED BY: Track D.
class LedgerEntry(TypedDict):
    index: int              # 0-based position in the chain
    session_id: str
    timestamp: str          # ISO-8601 STRING (never a datetime object — see §14 L5)
    intent: str             # the change request / intent
    programs: list[str]     # affected programs
    explanation_hash: str   # sha256 of the explain result
    diff_hash: str          # sha256 of the approved diff
    decision: str           # "approve" | "edit"
    approver: str           # user identity string (demo: "engineer@bank")
    prev_hash: str          # entry_hash of previous entry ("" for genesis)
    entry_hash: str         # sha256 of THIS entry's canonical bytes (excluding entry_hash)
```
**Hashing rule (frozen — see §14 L5, do NOT use naive `json.dumps`):**
- Canonical bytes = **RFC 8785 (JCS)** via the `rfc8785` PyPI lib: `rfc8785.dumps(entry_without_entry_hash)` → UTF-8 bytes.
- **All numbers** (fees, thresholds, rates) stored as **strings/Decimals** before hashing; **all datetimes** as ISO-8601 strings.
- `entry_hash = sha256(canonical_bytes).hexdigest()`, excluding the `entry_hash` field itself.
- `prev_hash` of entry N = `entry_hash` of entry N-1. Verify = recompute every `entry_hash` and check each `prev_hash` link; report the first broken index.
- **Framing:** the ledger is **tamper-evident, not tamper-proof** — a local file can be rewritten, but the chain makes any change *detectable*; the optional on-chain root externalises the head (§11).

**Merkle (for the optional on-chain anchor) — domain-separate to avoid CVE-2012-2459 (§14 L6):**
```python
leaf = sha256(b"\x00" + data).digest()             # leaf prefix
node = sha256(b"\x01" + left + right).digest()      # internal-node prefix
# do NOT duplicate a lonely last node; carry it up (RFC 6962 style)
```

### 8.6 The COBOL analysis interface (the spine — NOT stretch; graph-shaped from day one)
```python
# analysis/cobol.py — OWNED BY: Track A (or a dedicated Analysis session once shape is agreed).
def build_dependency_graph(corpus_dir: str) -> dict:
    """Return {"nodes": [program/paragraph ids...],
               "edges": [GraphEdge...]}   # each edge tagged verified True|False
       TIER 1: edges may be LLM-inferred (verified=False).
       TIER 2 (T2.1): edges parsed from CALL/PERFORM/COPY/WRITE (verified=True).
       THE RETURN SHAPE IS IDENTICAL ACROSS TIERS — cells never change."""
```
**This is why the graph can be built in parallel without breaking the UI:** the shape is frozen now; only the `verified` flags and accuracy change when the real parser lands.

---

## 9. Parallel-session operating rules & timeline

### 9.1 On startup, every session does this, in order
1. `git pull`; read this doc's §8 (frozen contracts) and §14 (landmines), and the team `CLAUDE.md`.
2. Confirm your assigned **track**. You may edit **only** your track's files (§9.2).
3. `pip install -r requirements.txt` — **do not upgrade or add** any dependency; versions are pinned (§15). Adding/bumping a dep is a contract change → lead sign-off.
4. Import shared types from the **one** canonical module (`schema.py`, `ledger/schema.py`). **Never redefine a shared type locally.**
5. Use the canonical example payloads (§8.2/§8.4) as fixtures/mocks so backend and frontend can't disagree.

### 9.2 Track ownership (disjoint — no two tracks touch the same file)
| Track | Owns | Depends only on | May start |
|---|---|---|---|
| **A · Contracts + Agent + Graph** | `schema.py`, `agent/`, `llm/`, `analysis/` | nothing (defines contracts) | immediately |
| **B · API + Server** | `server/` | §8.1, §8.2 | once contracts committed |
| **C · Frontend** | `web/` | §8.2, §8.4 | immediately (mock the API) |
| **D · Ledger (+chain)** | `ledger/`, `chain/` | §8.5 | immediately |

> Note vs v1: `analysis/` now lives with Track A (it's the spine, not a late add-on). If you run a 5th session dedicated to the parser, it owns `analysis/cobol.py` *only*, against the frozen §8.6 shape.

### 9.3 Collision & change protocol
- **Need another lane's file?** Stop. Tell the lead. Add/adjust the missing contract *there first*, announce it, then each session updates. Never have two sessions edit one file.
- **A contract must change?** Only the lead approves. Sequence: fix in `BUILD_DOC.md`/`schema.py` → announce → sessions pull and adapt. Never silent.
- **`SessionState` is the most sacred contract** — any change is a broadcast-level breaking change.
- **No cross-cutting refactors.** A tidy-up spanning lanes breaks other sessions mid-flight.

### 9.4 Git discipline
- One branch per track (`track-a-agent`, `track-b-api`, …). Small, frequent commits. **Pull before you push.** Never force-push a shared branch.
- Commit messages name the track and whether a contract was touched: `A: add router node (no contract change)`.
- Name **one integration owner** who merges to `main` and runs the end-to-end smoke test.

### 9.5 Integrate early, not at hour 40
Wire the whole flow end-to-end with the **mock LLM** (`USE_MOCK_LLM=1`) in the first phase, then swap in Claude. Standard cure for last-4-hours integration hell.

### 9.6 Hour-by-hour timeline
Assumes ~24h; scale phases proportionally but keep the "MVP frozen, rehearse once" gate sacred. "H+N" = N hours in.

**Phase 0 — Foundations (H+0 → H+3)**
- A: repo skeleton, `schema.py`, freeze contracts (§8), stub the 6-node graph returning canned data (mock LLM). Commit contracts. `ClaudeProvider` doing a real structured-output completion. `build_dependency_graph` returning a graph-shaped result (inferred edges ok).
- B: async FastAPI app up; all endpoints return canned `SessionState` matching §8.2; `lifespan` compiles the graph with `AsyncSqliteSaver`.
- C: Vite+React+Tailwind up; render five static cells against a mock; Run buttons flip status; verified/inferred badge component.
- D: canonical-JSON hash-chain + `verify()` (RFC 8785) working against hand-made entries; unit-test the chain and the tamper-detection.
- **Gate H+3:** contracts committed; each track has a hello-world respecting them; the `interrupt()`/resume round-trip works once on mock data.

**Phase 1 — MVP vertical slice (H+3 → H+10)**
- A: real `router`, `locate`, `explain` via provider; `propose` writes the diff; `approve` calls `interrupt()` first; `record` writes via the ledger interface.
- B: endpoints call the real graph; `/cell/run` runs read-only cells to completion; `/cell/approve` resumes with `Command(resume=...)` on the session's `thread_id`.
- C: real fetch; render citations + verified/inferred; Propose shows the diff, posts approve/edit/reject; ledger panel reads `/ledger`.
- D: expose `verify` via B; entry-writing on `record`.
- **Gate H+10:** overdraft example runs Locate→Explain→Propose→Approve→Record end-to-end on real LLM output, even if `impact` is thin.

**Phase 2 — Complete the MVP (H+10 → H+15)**
- A: real `impact` writing the blast-radius subgraph into `state.graph`; harden prompts; graceful `status:"error"` on malformed responses (never crash).
- C: blast-radius visual (list→boxes is fine for MVP); "Verify integrity" button with pass/fail; polish approval UX; a hidden debug button that mutates a ledger entry so you can *show* the chain breaking.
- D: finalise ledger view + tamper-detection demo path.
- **Gate H+15 — TIER 1 DONE (§6 checklist all green, runs twice cold). Freeze. Rehearse the calm single-flow demo once now** (this is your safe fallback).

**Phase 3 — TIER 2 differentiators (H+15 → H+21)** *(in order; each fully working + committed before the next)*
- T2.1 parsed edges → T2.2 change types #2/#3 → T2.3 CardDemo swap → T2.4 graceful-failure cases → T2.5 metrics/hero counter. (§7.)
- **Rule:** a half-built Tier-2 feature that breaks the MVP is a net negative. If T2.1's parser is fragile at H+18, ship the pragmatic regex extractor labelled "lightweight static extractor" and move on.

**Phase 4 — TIER 3 + demo hardening (H+21 → H+24)**
- Optional Tier 3 only if ahead: S1 local-LLM live toggle → S2 on-chain anchoring → verifier loop → time-travel UI. None may be in the critical demo path.
- Freeze code. Rehearse the ambitious choreography (§13.3) AND the calm fallback. Prepare the "old way" visual. Pre-index CBSA + CardDemo; prompt-cache. **Record a backup demo video.** Rehearse 3× cold.

---

## 10. Corpus (verify on clone BEFORE wiring discovery)

```
PRIMARY   IBM CBSA   cicsdev/cics-banking-sample-application-cbsa   (EPL-2.0)
          PINNED TAG: 2026Q1  →  29 programs / 37 copybooks  (verified on clone 2026-07-02)
          COBOL:  src/base/cobol_src        copybooks:  src/base/cobol_copy   (NOT src/base/copybook)
SWAP      AWS CardDemo  aws-samples/aws-mainframe-modernization-carddemo   (Apache-2.0)
          different vocabulary (cards not accounts), different naming — proves corpus-independence
FALLBACK  IBM Bank-of-Z  IBM/Bank-of-Z
          COBOL:  src/base/cics/cobol/   copy:  src/base/cics/copy/
          (NOTE: NOT src/base/cobol/ — that path does not exist in Bank-of-Z)
```

**Why CBSA is primary (vs v1's Bank-of-Z):** its account/transfer/overdraft/debit-credit domain maps directly onto the Consumer Duty worked example, and it yields the strongest honest moment — the overdraft limit exists on the ACCOUNT record but is **not enforced** on the transfer/debit path, so the tool reasons about the *absence* of logic. Bank-of-Z's two-banks-merged backstory remains a nice *narrative* aside, but CBSA is the better demo terrain.

**Confirmed CBSA programs to expect** (verify on clone): INQCUST, INQACC, INQACCCU, CRECUST, **CREACC** (sets default interest rate), **UPDACC** (updates rate), DELACC, DELCUS, **XFRFUN** (transfer — *no overdraft/balance check*), **DBCRFUN** (debit/credit — blocks debits on MORTGAGE/LOAN, fail code '4'), CRDTAGY1–CRDTAGY5, BANKDATA (test-data generator), and the BNK1xxx BMS/3270 screen handlers. **Open `src/base/cobol_copy/ACCOUNT.cpy` and `PROCTRAN.cpy` yourself and quote the real field names in the pitch** — don't trust remembered names.

**Program/copybook counts conflict across sources** (46/31/9/3 in an academic analysis vs 29/37 for a community port) because they count different scopes. Cite the scope explicitly ("full base set" vs "ported subset") and **confirm against the live tree before putting a number on a slide.**

**FCA framing (worked example):** say *"Consumer Duty-driven overdraft repricing / adding a compliant guard,"* not a specific new numeric cap. Do **not** cite the US CFPB $5 overdraft rule as current law — it was finalised Dec 2024 and then repealed by Congress.

---

## 11. Local-LLM infrastructure (data sovereignty)

**Why in the repo even though the demo uses Claude:** UK banks cite data residency, GDPR, and IP protection as the #1 reason for on-prem AI; a credible enterprise product must show the code can run air-gapped. We *build* the capability and *show* it in the repo; Tier 3 optionally live-demos one cell on it.

**Design:** everything routes through `LLMProvider` (§8.3). Switching to local is a one-line env change:
```
LLM_PROVIDER=ollama
LLM_MODEL=qwen2.5-coder:7b      # local coding model; the right pick for a laptop demo
OLLAMA_HOST=http://localhost:11434
```
`OllamaProvider.complete()` POSTs to Ollama's `/api/chat` (OpenAI-compatible `/v1/chat/completions` also available) and returns text/parsed output; `runs_locally=True` lights up a **"Running locally — your code never leaves this machine"** badge in the UI. Nothing else in the system knows which provider is active.

**Repo artifacts (so judges see it's real, not vapor):** `llm/ollama_provider.py` (full impl); `docs/ON_PREM.md` (air-gapped deployment — install Ollama, pull a model, set env, no network egress); a README architecture note: "frontier API for capability, local model for sovereignty — same code path."

**Honesty note (§8 anti-over-claiming):** local coding models are weaker at COBOL than frontier models, and COBOL is underrepresented in their training data. If we live-demo Tier 3, do it on the **forgiving `explain` cell** and frame it as "proof the sovereignty path works," not "identical quality." Run the quality-critical cells (propose/impact) on Claude. Don't demo the full pipeline on local.

---

## 12. Blockchain / tamper-evident ledger

**What we claim (be precise):** the ledger is **tamper-evident**, not "tamper-proof." A canonical-JSON SHA-256 hash chain (§8.5) detects any alteration; anchoring the Merkle root to a blockchain means even someone with database access can't silently rewrite history without the on-chain root disagreeing.

**MVP (must-have, Tier 1):** the hash chain + `verify`. This alone is a strong, honest provenance story and is enough for the pitch. Demo the tamper-detection: mutate an entry, hit Verify, watch it fail and point to the broken index.

**Tier 3 — actual on-chain anchoring, kept simple:**
- Local dev chain: **Anvil** (from Foundry) is fastest to stand up; Hardhat also fine. No real gas, no testnet flakiness.
- Minimal contract:
```solidity
// chain/contracts/LedgerAnchor.sol
pragma solidity ^0.8.28;
contract LedgerAnchor {
    event Anchored(string sessionId, bytes32 merkleRoot, uint256 timestamp);
    mapping(string => bytes32) public roots;
    function anchor(string calldata sessionId, bytes32 merkleRoot) external {
        roots[sessionId] = merkleRoot;
        emit Anchored(sessionId, merkleRoot, block.timestamp);
    }
}
```
- On `Record` (or a "Seal to chain" button), compute the domain-separated Merkle root over all `entry_hash`es (§8.5) and call `anchor()`; show the **transaction hash** + on-chain root. Verify: recompute locally, read `roots[sessionId]`, assert equal.
- Python side: `web3.py` (7.x) to a local RPC. `chain/anchor.py` **no-ops gracefully if no chain is running** — the MVP must never depend on the chain being up. Put it behind a feature flag.

**Why hashes-only on-chain (say this if a judge probes):** we never put code or customer data on-chain — only hashes/roots. This sidesteps GDPR's right-to-erasure and data-residency problems while still giving cryptographic integrity proof. Deliberately *more* enterprise-credible than dumping records on a public chain.

---

## 13. Impact framing & the demo script

### 13.1 Baseline ("before") — cite, don't invent
- Comprehension is ~58% (Xia et al., *IEEE TSE* 2018, field study of 78 professionals) up to ~70% (Minelli et al.) of change effort.
- UK COBOL contractor median **£550/day** (IT Jobs Watch, 6 months to 3 Jun 2026).
- Vendor speed-up figures (IBM watsonx "20–80%", AWS "weeks to hours") go on the slide **flagged as vendor-reported**, never as our own result.

### 13.2 In-product live metrics (all derived from the graph)
Programs traced · paragraphs traced · lines in scope · dependencies found · copybooks resolved (`36/37`, shown honestly) · wall-clock seconds (`perf_counter`) · tokens/£ (`usage_metadata`). **Honest hero denominator:** `manual_minutes = lines_in_scope × minutes_per_line`, assumption shown on-screen (e.g. *"~10 lines/min of unfamiliar COBOL × comprehension ≈ 60% of the work"*). **Always show the raw traced counts too**, so the number stands even if a judge disputes the rate. Never a bare "X hours saved" without the math.

### 13.3 The 90-second demo choreography (rehearse cold; keep the calm fallback)
**Ambitious version (build toward this — proves generality hardest):**
1. **0–35s** overdraft guard on CBSA — full 5 cells → gated diff → **click Approve** → ledger entry.
2. **35–55s** type the interest-rate change — lands on *different* programs/paragraphs (proves no hardcoding).
3. **55–75s** `index ./carddemo`, re-run — *new graph on unseen code*.
4. **75–90s** type a vague/impossible request — honest "0 blast radius / need detail."
Also demo a **reject** and an **edit** somewhere, not just approve — that's the control story. End on the tamper-evident ledger (mutate an entry → Verify fails → points to the broken index).

**Calm fallback (always works — drop to this if a swap misbehaves live):** the single overdraft flow, Locate→Explain→Impact→Propose→(reject then edit then)Approve→Record→Verify, narrated slowly. Rehearse both; decide on the day based on how the room and the machine are behaving.

**Pre-demo setup:** server + UI running; Claude key set; a fresh session pre-created or the request pre-typed. "Old way" slide ready. If demoing Tier 3: Anvil running + contract deployed, and/or Ollama running with the model pulled. Recorded backup video queued. **No live path depends on Anvil or Ollama.** Read-only cells feel fast (pre-index, prompt-cache). No 20-second spinners.

---

## 14. TECHNICAL LANDMINE MAP (read before writing agent/checkpointer/ledger code)

Ranked by how badly each will hurt. Each has the fix. These come from a senior review of exactly this stack; treat them as load-bearing.

**L1 — Wrong corpus path.** Bank-of-Z COBOL is under `src/base/cics/cobol/`, **not** `src/base/cobol/`. CBSA (our primary) uses `src/base/cobol_src` + `src/base/cobol_copy` (**NOT** `src/base/copybook` — the v2 doc had this wrong; corrected 2026-07-02 after verifying the 2026Q1 clone). **Verify all paths on clone** before wiring M1, or discovery breaks on day one. (§10.)

**L2 — `interrupt()` re-executes the whole node on resume.** LangGraph restarts the node *from the top* on resume; any code (including an LLM call) *before* `interrupt()` runs **twice** and can produce a different diff than the human approved. **Fix: split into two nodes** — `propose` generates the diff and writes it to state (checkpointed at the node boundary, runs once); `approve` calls `interrupt()` as its **first and only** significant action.
```python
def propose_node(state):                     # side-effecting; runs once
    diff = llm_generate_diff(state)
    return {"proposed_diff": diff, "status": "awaiting_approval"}

from langgraph.types import interrupt
def approve_node(state):                      # interrupt() first; pure after
    decision = interrupt({"diff": state["proposed_diff"]})
    return {"decision": decision}
```
Never wrap `interrupt()` in try/except (swallows `GraphInterrupt`). Never call it in a `while True` validation loop (each resume replays all prior iterations → exponential re-execution); use a conditional edge to re-prompt. Keep all pre-interrupt code idempotent.

**L3 — Sync/async checkpointer mismatch.** `SqliteSaver` + `async def` endpoints → `NotImplementedError`. **Go async-everywhere:** `AsyncSqliteSaver` inside a FastAPI `lifespan`, graph compiled there (checkpointer is REQUIRED to compile a graph that uses `interrupt()`), stored on `app.state`.
```python
from contextlib import asynccontextmanager
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
@asynccontextmanager
async def lifespan(app):
    async with AsyncSqliteSaver.from_conn_string("checkpoints.sqlite") as saver:
        app.state.graph = builder.compile(checkpointer=saver)
        yield
```
`AsyncSqliteSaver` needs `aiosqlite`. Pin `langgraph-checkpoint-sqlite==3.1.0`. Don't mix sync/async — pick async-everywhere. (Acceptable alt: fully sync with `SqliteSaver(sqlite3.connect(path, check_same_thread=False))` + `def` endpoints — but do not mix.)

**L4 — `thread_id` discipline.** Cross-request resume works only if the **same `thread_id`** threads through `/cell/run` and `/cell/approve`. Mint a **fresh UUID per session** (store it in `SessionState.thread_id`); **never share a `thread_id` across sessions** — one user's approval would resume another's graph. This is also the #1 cause of "only works once / needs a restart." Config shape: `{"configurable": {"thread_id": state["thread_id"]}}`.

**L5 — Canonical JSON isn't canonical with stdlib defaults.** `json.dumps(sort_keys=True, separators=(",",":"))` breaks on floats (`repr`-emitted, non-deterministic — `0.1+0.2 → 0.30000000000000004`), datetimes (`TypeError`), and non-ASCII (escaped, not RFC 8785-compliant). **Fix:** store all numbers (fees, thresholds, rates) as **strings/Decimals**, datetimes as **ISO-8601 strings**, and hash **RFC 8785 (JCS)** bytes via the `rfc8785` PyPI lib (`rfc8785.dumps(obj)` → UTF-8 bytes). `entry_hash` excludes itself; verification re-walks every `prev_hash` link. (§8.5.)

**L6 — Merkle second-preimage (CVE-2012-2459 class).** Domain-separate leaves and internal nodes (`H(0x00‖data)` vs `H(0x01‖left‖right)`); do **not** duplicate a lonely last node (carry it up, RFC 6962 style). Cheap, high-signal detail. (§8.5.)

**L7 — Version drift between sessions.** Everyone codes against the same pins (§15). Do **not** bump LangGraph — **avoid 1.1.x** (interrupt/checkpoint regression, GitHub #7361); use **1.2.7**. Smoke-test resume-from-checkpoint early rather than assuming.

**L8 — String-parsing LLM output is fragile and a drift magnet.** Use **Claude structured outputs** (beta header `anthropic-beta: structured-outputs-2025-11-13`, `client.beta.messages.parse(...)` with a Pydantic model) or strict tool use, so every cell payload is schema-guaranteed. This guarantees *format*, not *correctness* — **still validate** the payload against `state.graph` (e.g. that every cited program/edge exists) before display. This is the concrete "not a prompt wrapper" signal.

**L9 (optional, if you add a verifier loop — Tier 3):** an evaluator/verifier that checks a proposed diff must use an **external** signal (the parsed graph; optional GnuCOBOL `-fsyntax-only` on the patched source — syntax check only, never run bank logic), not just LLM self-critique (which fails silently). Bound iterations; never `while True`.

---

## 15. Quick reference — version pins & env

**Version pins (do NOT change without lead sign-off):**
```
langgraph==1.2.7                          # NOT 1.1.x (interrupt/checkpoint regression #7361)
langgraph-checkpoint-sqlite==3.1.0        # AsyncSqliteSaver; needs aiosqlite
rfc8785                                   # RFC 8785 canonical JSON for the ledger (Trail of Bits)
web3.py 7.x                               # Tier 3 / chain only
solidity ^0.8.28                          # Tier 3 / chain only
ollama model: qwen2.5-coder:7b            # local / explain cell only (Tier 3)
anthropic-beta: structured-outputs-2025-11-13   # structured outputs header
```
Also: Anthropic Python SDK, FastAPI, uvicorn, aiosqlite, pydantic. **Confirm the structured-outputs beta header + current model support against live Anthropic docs at build time** (public beta; don't assume GA).

**Env vars:**
```
ANTHROPIC_API_KEY=...
LLM_PROVIDER=claude|ollama          # default claude
LLM_MODEL=...                       # for ollama, e.g. qwen2.5-coder:7b
OLLAMA_HOST=http://localhost:11434
CHAIN_RPC=http://localhost:8545     # Tier 3; unset → anchoring no-ops
USE_MOCK_LLM=1                      # offline end-to-end integration
```

---

## 16. Definition of "done" / what "working" means
- The worked example runs **Locate → Explain → Impact → Propose → Approve → Record → Verify**, reliably, **twice in a row, no restart**.
- A cell that gets a malformed LLM response returns `status:"error"` with a readable message and **never crashes the session** (user can re-run). Graceful error recovery is explicitly rewarded.
- No live demo path depends on Anvil or local Ollama. Read-only cells feel fast; no 20-second spinners.
- A **recorded backup video** of the full demo exists before judging.

---

## 17. FAQ & anti-patterns (read before you ask)

**Q: Can the agent just do all steps automatically and show the result?** No. Autonomy is the anti-goal. The human approval gate is the single most important feature (20% of the score). Control beats autonomy — the judges say so explicitly.

**Q: Should we run/compile the COBOL or stand up CICS?** No. Static comprehension + safe change only. The mainframe is out of scope and impossible in the time. GnuCOBOL `-fsyntax-only` on a generated diff is the *only* allowed compile, as an optional Tier-3 verifier signal — never to run bank logic.

**Q: The local model gives worse COBOL answers than Claude — ship it as default?** No. Claude is the demo path. Local is the sovereignty proof — built, in the repo, optionally shown live on the forgiving `explain` cell. Don't overclaim parity.

**Q: Put the actual code/diffs on the blockchain?** No — hashes/Merkle roots only. Code or PII on-chain creates GDPR/residency problems and is *less* credible. Hashes-only is the sophisticated choice.

**Q: "How does this scale to 10 million lines / a real bank?"** "The comprehension and dependency-tracing we automate is exactly the step that doesn't scale with humans — where weeks and specialists go. Our approach is incremental and per-change (the strangler-fig pattern the industry proved works), not big-bang (the pattern that sank TSB). Static analysis handles scale for dependency mapping; the LLM narrates per-program on demand; the human approves each bounded step. Nothing requires holding the whole estate in one context."

**Q: How is this different from Conduct / IBM watsonx Code Assistant for Z / a code-gen tool?** Three ways: (1) headline is the **human-in-the-loop control surface** (stateful gated graph, approve/edit/reject, time-travel), not autonomous translation; (2) **verifiable provenance** (tamper-evident, optionally blockchain-anchored ledger); (3) **data-sovereignty by design** (local-LLM path). And we're tuned for a *specific user* — the new-joiner engineer — not a generic assistant. Plus the deterministic verified/inferred dependency graph under the LLM.

**Q: A cell's LLM output is malformed / the agent errors mid-run?** Return `status:"error"` with a readable message; never crash the session. Bound any retry/reflection loops.

**Q: Two of my sessions want to edit the same file?** Stop — a contract is missing (§8). Add/adjust it with the lead, announce, then each session updates. Never two sessions on one file.

**Anti-patterns (never do these):**
- Building a Tier-2/3 feature before the MVP runs twice cold.
- Changing a frozen contract (schema, REST shape, hashing rule, version pin) silently.
- Two sessions editing one file; cross-lane refactors.
- Redefining a shared type locally instead of importing it.
- Keyword-matching a change request to a hardcoded program.
- Letting the LLM invent dependency edges and presenting them as fact (label `inferred`).
- Over-claiming: "local = frontier quality", "tamper-evident = tamper-proof", "we rewrite COBOL to Java" (we don't — we make *change* safe), or a speed-up number without the math.
- Executing COBOL / standing up a mainframe.
- Putting code or PII on-chain.
- Wrapping `interrupt()` in try/except; calling it in a `while True`; generating the diff in the same node that interrupts.
- Sharing a `thread_id` across sessions; mixing sync and async checkpointers.
- Hashing with naive `json.dumps` (floats/datetimes/unicode break determinism).

---

### Appendix A — Repo layout (target)
```
legacy-move/
├── BUILD_DOC.md          # SOURCE OF TRUTH: full spec + frozen contracts (§8) + landmines (§14)
├── CLAUDE.md             # operating manual + north star + landmines (agrees with this doc)
├── requirements.txt      # pinned (§15)
├── schema.py             # frozen shared schemas (Track A) — import, never redefine
├── agent/  graph.py nodes.py prompts.py router.py     # Track A (6 nodes; propose+approve split)
├── llm/    provider.py claude_provider.py ollama_provider.py factory.py   # Track A
├── analysis/ cobol.py    # THE SPINE — dependency graph, graph-shaped from day one (Track A)
├── ledger/ schema.py chain.py               # Track D (RFC 8785 canonical JSON; domain-sep Merkle)
├── chain/  contracts/LedgerAnchor.sol anchor.py   # Track D (Tier 3, no-ops if no chain)
├── server/ main.py routers.py               # Track B (async; AsyncSqliteSaver in lifespan)
├── web/                  # React (Vite)+Tailwind (Track C)
├── corpus/               # CBSA primary (verify paths on clone); CardDemo for swap
└── docs/ ON_PREM.md       # air-gapped deployment (§11)
```

### Appendix B — Where the truth lives
- **Contracts:** §8 (cell/session state, REST, LLM provider, per-cell payloads, ledger/hash rule, analysis interface).
- **Landmines:** §14. **Pins:** §15.
- **The research artifacts** (the company profile; the gap shortlist; the UK-market/stack analysis; the human-led-migration lessons; the frontier-agent/control-surface review; the generality+impact strategy; the stress-test build review) hold the sourced figures, version rationale, and demo detail — consult them for the *why*, cite them in the pitch.

### Appendix C — Evidence one-pagers (for pitch Q&A)
Baringa 2025 (50% of UK banks depend on 1–2 near-retirement staff; 16% run 1960s code; ~40% run 1970s code) · TSB 2018 (~1.9M locked out, £330M+ costs, £48.65M FCA/PRA fine) · Queensland Health (78,000 staff mis-paid, >A$1.2B, "worst failure of public administration") · IRS IMF (60+ yrs, assembly/COBOL, replacement projected ~2030) · COVID/COBOL 2020 ("it's not COBOL, it's the lost knowledge") · comprehension ~58–70% of change effort (Xia et al. IEEE TSE 2018; Minelli et al.) · £550/day UK COBOL contractor (IT Jobs Watch, Jun 2026). Full sources in the research artifacts.