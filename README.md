# Legacy Move — AI Change Cockpit for Legacy COBOL

A human-in-the-loop agent that lets a *new-joiner engineer* safely make a business-driven
change to a legacy COBOL banking system: it **locates** every affected program/copybook,
**explains** each in plain English, maps the **impact** (blast radius), **proposes** the exact
edit as a reviewable diff, and **records** every approved step to a tamper-evident ledger —
executing only what the human approves.

> Worked example: *"Cap / add a compliant guard on overdraft fees to comply with FCA Consumer
> Duty."* On the CBSA corpus the overdraft limit lives on the ACCOUNT record but is **not
> enforced** on the transfer/debit path (`XFRFUN`/`DBCRFUN`), so the honest fix is to ADD a
> guard — the tool reasons about the *absence* of logic.

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
