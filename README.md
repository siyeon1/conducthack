# shft — AI Change Cockpit for Legacy COBOL

A human-in-the-loop agent that lets a *new-joiner engineer* safely make a business-driven
change to a legacy COBOL banking system: it **locates** every affected program/copybook,
**explains** each in plain English, maps the **impact** (blast radius), **proposes** the exact
edit as a reviewable diff, and **records** every approved step to a tamper-evident ledger —
executing only what the human approves.

> Worked example: *"Cap / add a compliant guard on overdraft fees to comply with FCA Consumer
> Duty."* On the CBSA corpus the overdraft limit lives on the ACCOUNT record but is **not
> enforced** on the transfer/debit path (`XFRFUN`/`DBCRFUN`), so the honest fix is to ADD a
> guard — the tool reasons about the *absence* of logic.

## See it work

Plain-English change in. A **verified, human-approved, tamper-evident** change out — the AI proposes, a human approves, and the ledger proves it.

<p align="center">
  <img src="docs/media/loop-2c-prove.gif" width="820" alt="shft's tamper-evident ledger: an approval is recorded, then a tampered entry makes integrity verification fail, in red">
</p>

**What the demo shows**

1. Type a change in plain English → shft decomposes it into a small, ordered plan, every dependency graded **verified** (parsed from the source) or **inferred** (the AI's guess).
2. Nothing runs until a named engineer **approves the plan**.
3. For each sub-change the cockpit **locates** every affected program, **explains** the COBOL, and maps the **blast radius** — grounded in the parsed code, with the culprit lines highlighted.
4. The AI drafts the edit **inline as a diff**; a human types a justification and **signs** (the coral gate).
5. Every approval is **hash-chained** into a tamper-evident ledger — alter the history and verification **fails, visibly**.

### The change lifecycle

<table>
<tr>
<td width="50%" valign="top">
<b>1 · Describe → decompose</b><br>
<sub>Type the change in plain English; watch it become a verified, editable dependency plan.</sub><br><br>
<img src="docs/media/loop-1-describe.gif" width="100%" alt="Typing a change request, generating a dependency DAG, editing a node, and approving the plan">
</td>
<td width="50%" valign="top">
<b>2a · Understand</b><br>
<sub>Locate the affected programs, explain the COBOL idioms, map the blast radius — grounded in parsed source.</sub><br><br>
<img src="docs/media/loop-2a-understand.gif" width="100%" alt="Running Locate, Explain and Impact in the stage cockpit">
</td>
</tr>
<tr>
<td width="50%" valign="top">
<b>2b · Change, human-gated</b><br>
<sub>The AI drafts the smallest edit inline; a named engineer types a reason and signs.</sub><br><br>
<img src="docs/media/loop-2b-change.gif" width="100%" alt="The AI change shown as an inline diff, then approved with a typed justification at the coral human gate">
</td>
<td width="50%" valign="top">
<b>2c · Prove it</b><br>
<sub>Every approval is hash-chained; tamper with the history and verification fails, in red.</sub><br><br>
<img src="docs/media/loop-2c-prove.gif" width="100%" alt="The tamper-evident ledger failing verification after a tampered entry">
</td>
</tr>
<tr>
<td width="50%" valign="top">
<b>3 · The trail</b><br>
<sub>Programme progress, the hash-chained audit trail, your saved library, and the integrations it plugs into.</sub><br><br>
<img src="docs/media/loop-3-trail.gif" width="100%" alt="The programme audit trail, saved library, and integrations panel">
</td>
<td width="50%" valign="top"></td>
</tr>
</table>

<sub>The clips above are muted, autoplaying GIFs. Full-resolution MP4s of each are in <a href="docs/media/"><code>docs/media/</code></a> — for a click-to-play inline player, drag an MP4 into a GitHub comment/issue and paste the generated <code>user-attachments</code> URL (GitHub strips autoplay from committed <code>&lt;video&gt;</code> tags, which is why the loops above are GIFs). Recorded against the bundled mock provider — deterministic, no backend required.</sub>

See **`Claude.MD`** for the full spec, frozen contracts (§8), and landmine map (§14).

## Status — Phase 0 complete (mock end-to-end, twice-cold)

The whole flow runs end-to-end on the **mock provider** (`USE_MOCK_LLM=1`, no API key), twice
in a row with no restart: `Locate → Explain → Impact → Propose ─[human gate]─ Approve → Record →
Verify`, including the interrupt/resume round-trip and ledger tamper-detection. Swapping in a
Claude API key (`USE_MOCK_LLM=0`, `ANTHROPIC_API_KEY=…`) lights up the real LLM with zero code
changes (the whole point of the provider abstraction).

## Architecture

```
Plain-English change request
   │
   ▼  [router]  free-text → intent + seed symbols   (never keyword→program)
   ▼  [DETERMINISTIC COBOL GRAPH]  analysis/cobol.py — parsed COPY/CALL edges, verified|inferred
   ▼  6 graph nodes (LangGraph + AsyncSqliteSaver checkpointer):
        locate → explain → impact → propose ─[interrupt]─ approve → record
                                     (propose+approve split so the diff is generated once, L2)
   ▼  tamper-evident ledger (RFC 8785 canonical JSON, SHA-256 hash chain, domain-sep Merkle)
```

| Dir | Track | What |
|---|---|---|
| `schema.py`, `agent/`, `llm/`, `analysis/` | A | frozen contract, 6-node graph, provider abstraction, dependency-graph spine |
| `server/` | B | async FastAPI, graph compiled in `lifespan`, `§8.2` endpoints |
| `web/` | C | Vite + React + Tailwind notebook (5 cells, verified/inferred badges, approval gate, ledger) |
| `ledger/`, `chain/` | D | hash-chain ledger + verify + tamper; on-chain anchor (Tier 3, stub) |

## Run it

```bash
# 0) once: create the venv + deps, fetch the corpus
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt      # (Windows path; use .venv/bin on *nix)
bash scripts/fetch_corpus.sh                                  # CBSA tag 2026Q1 → corpus/cbsa

# 1) backend (mock — no key needed)
USE_MOCK_LLM=1 .venv/Scripts/python -m uvicorn server.main:app --port 8000
#    real Claude instead:  USE_MOCK_LLM=0 ANTHROPIC_API_KEY=... LLM_MODEL=claude-sonnet-5 uvicorn server.main:app ...

# 2) frontend
cd web && npm install && npm run dev            # http://localhost:5173  (mock data by default)
#    to drive the LIVE backend:  set VITE_USE_MOCK=false in web/.env, then npm run dev
```

Quick backend self-test (drives the whole flow over HTTP, twice):

```bash
.venv/Scripts/python scripts/drive.py 2
```

## Corpus

IBM CBSA (`cicsdev/cics-banking-sample-application-cbsa`, tag **2026Q1**, EPL-2.0):
29 programs in `src/base/cobol_src/`, 37 copybooks in `src/base/cobol_copy/`. The COBOL is
**never executed** — static comprehension only.
