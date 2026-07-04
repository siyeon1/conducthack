# shft — Engineering roadmap

Compiled from this build's feedback plus a five-dimension research pass, written from one
stance: **the engineer is in control; the app is an enabler and an accelerator, never an
autopilot.**

Effort `S/M/L`, impact `high/med/low`, `R` = raised this session (extend it), `N` = new.

---

## North star

The target user is a software engineer with judgment and authority who is *new to this legacy
estate*. shft earns its keep two ways:

- **Enabler** — it hands the engineer comprehension and dependency analysis that would
  otherwise take weeks: read the code, trace every caller/copybook, learn the idioms.
- **Accelerator** — it collapses that work from weeks to seconds.

The engineer directs and decides at every state-changing step; the AI is leverage. Every change
below is judged by one test: **does it increase the engineer's control, understanding,
confidence, or throughput while keeping them the decision-maker?**

The critique that started this — *"the app almost runs itself; the user only clicks buttons"* —
is the roadmap's organizing tension. The fix is not fewer AI features; it's replacing **Run**
clicks with **decisions only a human can make**.

---

## Where we are

- MVP runs end-to-end **twice cold on real `claude-sonnet-5`** (Locate → Explain → Impact →
  Propose[gate] → Approve → Record → Verify → Tamper). The "MVP is sacred" gate is **passed**,
  so Tier-2 and the enhancements below are unblocked.
- Shipped: real-LLM output hardening (coerce + dedup every nested payload), T2.1 (verified CICS
  `LINK`/`XCTL` edges + a deterministic 01–49/77 + PIC field index that maps a field to its
  defining copybook with no LLM), the L8 "in graph" provenance badge.
- 4 commits pushed to `github.com/siyeon1/conducthack`.

---

## Fix-first findings (currently wrong or missing)

Research surfaced defects that matter *before* polish:

1. **The graph is blind to real CICS dispatch.** `analysis/cobol.py::_PROGRAM_RE` only matches
   `PROGRAM('LITERAL')`, but CBSA links via a data-name — `EXEC CICS LINK PROGRAM(WS-ABEND-PGM)`
   where `01 WS-ABEND-PGM PIC X(8) VALUE 'ABNDPROC'`. Every program's LINK to `ABNDPROC` and any
   dynamic dispatch is a **missing edge**; the blast radius looks clean because the parser can't
   see the calls. → *Control the honesty of the map first.* `scale · M/high`
2. **CardDemo won't load.** `analysis/corpus.py` hard-assumes CBSA's `cobol_src`/`cobol_copy`;
   CardDemo's `app/**/cbl` + `app/**/cpy` layout returns an **empty corpus**, so the T2.3
   "index ./carddemo → new graph on unseen code" demo beat is impossible today. `scale · M/high`
3. **You can't see the source.** The full COBOL is in memory (`SourceUnit.text`) but there is no
   endpoint or pane to read it — the UI shows only LLM prose, a risk list, and a diff.
   `comprehension · M/high`
4. **Locate drifts run-to-run** on real Claude because it is fed the raw flat inventory, not the
   deterministic field index / graph it already computes. `scale · M/high`
5. **Reject-with-reason is claimed but not wired** — reject sends no reason and re-drafts blind.
   `control · M/high`

---

## 1 · Control — the engineer directs

| Change | E | I | R/N |
|---|---|---|---|
| **Attested approval** — required typed justification, hash-chained into the ledger | M | high | R |
| **Time-travel** — rewind & re-run from any checkpoint (`aget_state_history` already exists) | L | high | R |
| **Reject-with-reason** that re-steers the next Propose draft | M | high | R |
| **Author-the-router** — edit `intent` + `seed_symbols` before Locate runs | M | high | R |
| Keyboard gate (A/E/R) + ⌘K command palette | M | med | N |
| Branch alternatives — two Propose drafts from one checkpoint, pick a winner | L | med | N |
| Adjudicate verified/inferred claims at the gate | M | med | R |

**Top move — attested approval.** Approval today records a click and a hardcoded
`engineer@bank`. Require a short justification that is stored *and* added to `HASHED_FIELDS`, so
the tamper-evident ledger contains human reasoning only a person could write. Pair with
**author-the-router** so the engineer steers the first, highest-leverage decision (where the
blast radius is widest), and **reject-with-reason** so "no" carries a "because" that conditions
the redraft. **Time-travel** is the sleeper: the checkpointer already snapshots every step;
exposing `aget_state_history` turns the linear notebook into a directable one for near-zero cost.

---

## 2 · Comprehension — the enabler

| Change | E | I | R/N |
|---|---|---|---|
| **Source viewer** — `GET /source/{name}` + a read-only monospace pane | M | high | R |
| **Line-anchored idioms** — click an Explain snippet to jump to its exact source line | M | high | R |
| **Clickable graph nodes** → go-to-definition / Explain | S | high | R |
| **Field inspector** — expose `build_field_index`: seed symbol → defining copybook + PIC, no LLM | M | high | R |
| Callers/callees xref drawer for any program (full graph) | M | med | N |
| "Why is this affected?" — deterministic dependency path on each Impact row | M | med | N |
| COBOL idiom glossary — hover tooltips on `PIC`/`COMP-3`/`PERFORM`/`88`-level everywhere | S | med | N |
| Estate overview map — whole-corpus mini-graph, hubs sized by fan-in | M | med | N |

**Top move — source viewer + clickable nodes.** These two unlock the code-editor concept: the
COBOL is already in memory, so a `/source` endpoint + a `<pre>` pane is small, and making
`GraphView` nodes clickable (`onNodeClick`) turns the map into navigation — click a program →
Explain it, click a copybook → open it at its `01/05` definitions. The **field inspector** is the
purest expression of "not a prompt wrapper": `ACCOUNT-OVERDRAFT-LIMIT → ACCOUNT.cpy (PIC 9(8))`,
parsed, badged verified. The **"why affected" path trace** replaces "the model says so" with the
actual edge chain (`DBCRFUN → COPY ACCOUNT ← COPY XFRFUN`) via a BFS over the subgraph — no LLM.

---

## 3 · Acceleration — the accelerator

| Change | E | I | R/N |
|---|---|---|---|
| **SSE token streaming** end-to-end (provider → node → `/cell/run` → React) | L | high | R |
| **Prompt caching** of the corpus inventory + program source across cells | M | high | N |
| **Parallel read cells** — run locate/explain/impact concurrently | M | high | N |
| Reusable change templates (pre-seed intent + seeds + edit site) | M | med | R |
| Session history + reuse (persist the session index; state is already on disk) | M | med | N |
| **Metrics hero counter** — surface `last_usage` (tokens, latency, cache reads) | S | med | R |
| Power-user keyboard flow for the whole pipeline | S | low | N |

**Top move — caching + parallel + the metric.** Prompt caching puts a `cache_control` breakpoint
on the stable corpus/source prefix so the 2nd–Nth cell and every re-draft pay ~0.1× input cost.
The three read-only cells are independent LLM calls run serially today — fan them out with
`asyncio.gather` after a one-time router prime, turning a 3-round-trip wait into ~1. Then the
**hero counter** reads the `_last_usage` the provider already records (nothing consumes it yet)
to make "weeks → seconds" a live, defensible number — and the instrumentation to prove the other
two levers worked. **Streaming** is the biggest *perceived*-speed win (watch the diff draft
line-by-line instead of a spinner) but it's the largest lift.

---

## 4 · Trust, verifiability & audit — the engineer proves it

| Change | E | I | R/N |
|---|---|---|---|
| **GnuCOBOL `-fsyntax-only` verifier** node between Propose and Approve | M | high | R |
| **Hash the provenance** — commit graph fingerprint + verified/inferred counts into the ledger | M | high | R |
| **Signed audit export** — portable, self-verifying change report for the auditor | M | high | N |
| Impact-on-tests — pull BANKDATA / data-writers into the blast radius as a distinct edge kind | M | med | N |
| On-chain Anvil Merkle anchoring (externalise the chain head) | L | med | R |
| Reproducibility manifest — pin corpus + model + prompt fingerprints into each entry | S | med | N |
| Persist the engineer's verified/inferred adjudication into the citation + ledger | M | med | R |

**Top move — external verifier + provenance in the ledger.** A `cobc -fsyntax-only` node
(the one compile the spec allows — never runs bank logic; no-ops if `cobc` is absent) lands a
hard non-LLM fact at the gate: "an external compiler confirms the patched source still parses."
Then extend `LedgerEntry` + `HASHED_FIELDS` with a `graph_hash` and the verified/inferred split,
so an auditor replaying entry #N can prove *what dependency evidence the engineer saw and how
much was statically proven*. The **signed audit export** serves the secondary user the spec names
(the compliance officer) with a file that re-verifies offline, forever.

---

## 5 · Scale, robustness & engineering — demo → real estate

| Change | E | I | R/N |
|---|---|---|---|
| **Resolve variable `PROGRAM(...)` targets** (data-name → VALUE literal) so CICS edges stop vanishing | M | high | R |
| **Multi-line EXEC + quoted `COPY`** handling in the extractor | S | high | R |
| **Corpus layout descriptors** so CardDemo actually loads | M | high | R |
| **Locate-variance reduction** — ground the Locate prompt in the field index + graph candidates | M | high | R |
| Structured-outputs root fix (`output_config.format`) to retire the per-cell coercion tax | M | med | R |
| Persist ledger/checkpoint paths explicitly + an automated twice-cold-restart test | M | med | N |
| PERFORM / paragraph-level extraction (feeds `paragraphs_traced` + within-program impact) | L | med | R |

**Top move — make the graph tell the truth.** Fixing variable-`PROGRAM()` resolution +
multi-line `EXEC`/quoted-`COPY` closes the accuracy gap (finding #1) and is what makes the
CardDemo swap parse; the **corpus descriptors** make CardDemo load at all (finding #2). Grounding
**Locate** in the deterministic field index kills the run-to-run drift seen on real Claude and
makes the first cell reproducible. These are the credibility of the whole generality axis.

---

## Recommended sequencing

The MVP gate is passed, so this is about ROI, not permission. Ordered to answer this session's
critiques and strengthen the demo.

**Now** — highest ROI, low risk, directly answers "it runs itself" + "the graph is illegible":
- Attested approval `[control]` — button-click → recorded decision.
- Source viewer + clickable graph nodes `[comprehension]` — makes the code-editor real.
- Fix variable-`PROGRAM()` + multi-line EXEC/quoted-COPY `[scale]` — honest graph.
- Locate grounding `[scale]` — reproducible first cell.
- Prompt caching + metrics hero counter `[acceleration]` — the "weeks → seconds" number.
- Graph declutter (ego/focus, collapse copybooks, drop labels) + collapse-by-risk impact list `[UX]`.

**Next** — deepen control + comprehension + the audit story:
- Author-the-router + reject-re-steers `[control]`.
- Field inspector + line-anchored idioms + "why affected" path `[comprehension]`.
- Parallel read cells `[acceleration]`.
- GnuCOBOL verifier + provenance-in-ledger + signed audit export `[trust]`.
- Corpus descriptors → land the CardDemo swap (T2.3) `[scale]`; then change types #2/#3 (T2.2).

**Later** — bigger lifts, none in the critical demo path:
- SSE streaming; time-travel + branch alternatives; PERFORM/paragraph; on-chain anchoring;
  structured-outputs root fix.

---

## Open decisions

- **Demo vs. depth** — the "Now" list is ~a day and transforms the feel; how much before the
  pitch vs. after?
- **Code-editor depth** — lightweight `<pre>` source pane (small, ships now) vs. Monaco with a
  real diff editor + decorations (heavier, the fuller vision).
- **Streaming** — worth the lift for perceived speed, or is caching + parallel enough?
- **Structured-outputs root fix** — adopt `output_config.format` (retires the coercion tax) vs.
  keep the per-cell coercion (works today, zero risk).
- **On-chain anchoring** — build the Tier-3 sovereignty/anchor story, or keep it documented?
