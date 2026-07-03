"""fixtures.py — canonical mock data for the overdraft worked example (Claude.MD §8.4).

Single source of truth for the MockProvider (USE_MOCK_LLM=1) AND the frontend fixture.
Grounded in the REAL CBSA 2026Q1 corpus — field names and line numbers verified against
the live checkout on 2026-07-02:

  * ACCOUNT.cpy:21   ACCOUNT-OVERDRAFT-LIMIT   PIC 9(8)
  * ACCOUNT.cpy:34   ACCOUNT-AVAILABLE-BALANCE PIC S9(10)V99
  * XFRFUN.cbl:21    "* format. No checking is made on overdraft limits."
  * XFRFUN.cbl:986   COMPUTE HV-ACCOUNT-AVAIL-BAL = HV-ACCOUNT-AVAIL-BAL - COMM-AMT.  (debit side, no guard)
  * DBCRFUN.cbl:330  IF (HV-ACCOUNT-ACC-TYPE = 'MORTGAGE' ...  (blocks only MORTGAGE/LOAN, fail code 4)
  * BNK1TFN.cbl:496  EXEC CICS LINK PROGRAM('XFRFUN')  (the 3270 transfer screen invokes XFRFUN)

The MockProvider keys canned payloads off the requested structured-output schema's title
(see llm/mock_provider.py). Payload shapes here MUST match agent/prompts.py output models
and Claude.MD §8.4.
"""
from __future__ import annotations

# Relative file paths (as they appear in citations).
F_XFRFUN = "src/base/cobol_src/XFRFUN.cbl"
F_DBCRFUN = "src/base/cobol_src/DBCRFUN.cbl"
F_BNK1TFN = "src/base/cobol_src/BNK1TFN.cbl"
F_ACCOUNT = "src/base/cobol_copy/ACCOUNT.cpy"
F_PROCTRAN = "src/base/cobol_copy/PROCTRAN.cpy"

# --------------------------------------------------------------------------- #
# ROUTER — free-text change request → intent + seed symbols (NEVER a program). #
# --------------------------------------------------------------------------- #
ROUTER_OUTPUT = {
    "intent": "add-guard",
    "seed_symbols": [
        "ACCOUNT-OVERDRAFT-LIMIT",
        "ACCOUNT-AVAILABLE-BALANCE",
        "overdraft",
        "debit",
        "transfer",
    ],
}

# --------------------------------------------------------------------------- #
# LOCATE — programs/copybooks affected by the change.                         #
# --------------------------------------------------------------------------- #
LOCATE_PAYLOAD = {
    "programs": [
        {
            "program": "XFRFUN",
            "file": F_XFRFUN,
            "reason": "Performs account-to-account transfers and reduces the FROM account's "
            "balance. Its own header states \"No checking is made on overdraft limits\" — the "
            "debit side has no overdraft guard, so a compliant change must ADD one here.",
            "verified": True,
        },
        {
            "program": "DBCRFUN",
            "file": F_DBCRFUN,
            "reason": "Applies debits/credits to an account. It blocks debits only for MORTGAGE/LOAN "
            "account types (fail code 4); it does not enforce ACCOUNT-OVERDRAFT-LIMIT on ordinary debits.",
            "verified": True,
        },
        {
            "program": "ACCOUNT (copybook)",
            "file": F_ACCOUNT,
            "reason": "Defines ACCOUNT-OVERDRAFT-LIMIT and ACCOUNT-AVAILABLE-BALANCE — the two fields a "
            "compliant guard compares. Shared by every program that touches an account record.",
            "verified": True,
        },
        {
            "program": "PROCTRAN (copybook)",
            "file": F_PROCTRAN,
            "reason": "The transaction record written on each debit/transfer (PROC-TRAN-AMOUNT, "
            "PROC-TRAN-TYPE 'DEB'/'TFR'). Confirms where the money movement is journalled.",
            "verified": True,
        },
    ]
}

LOCATE_CITATIONS = [
    {"program": "XFRFUN", "file": F_XFRFUN, "lines": "19-21", "verified": True},
    {"program": "XFRFUN", "file": F_XFRFUN, "lines": "986-990", "verified": True},
    {"program": "DBCRFUN", "file": F_DBCRFUN, "lines": "321-341", "verified": True},
    {"program": "ACCOUNT", "file": F_ACCOUNT, "lines": "21", "verified": True},
    {"program": "ACCOUNT", "file": F_ACCOUNT, "lines": "34", "verified": True},
    {"program": "PROCTRAN", "file": F_PROCTRAN, "lines": "103", "verified": True},
]

# --------------------------------------------------------------------------- #
# EXPLAIN — plain-English, teaches COBOL idioms. Keyed by program.            #
# --------------------------------------------------------------------------- #
_EXPLAIN_XFRFUN = {
    "plain_english": (
        "XFRFUN moves money between two accounts. It reads both ACCOUNT records from the "
        "database, subtracts the transfer amount from the *FROM* account's available and actual "
        "balances, adds it to the *TO* account, and writes a PROCTRAN transaction record for the "
        "audit trail. Critically, it **never compares the debit against the account's overdraft "
        "limit** — the program's own header comment even says \"No checking is made on overdraft "
        "limits.\" So under FCA Consumer Duty, the compliant fix is to *add* a guard on the debit "
        "side, not to change an existing check."
    ),
    "cobol_idioms": [
        {
            "snippet": "COPY ACCOUNT.",
            "explanation": "Pulls in the shared ACCOUNT record layout at compile time — like "
            "importing a struct / shared header used across many programs. Change the copybook and "
            "every program that COPYs it sees the new shape.",
        },
        {
            "snippet": "COMPUTE HV-ACCOUNT-AVAIL-BAL = HV-ACCOUNT-AVAIL-BAL - COMM-AMT.",
            "explanation": "Recomputes the available balance in place — a plain arithmetic "
            "assignment (COMM-AMT is the transfer amount). Notice there is no IF/guard around it: "
            "the balance is reduced unconditionally.",
        },
        {
            "snippet": "EXEC CICS LINK PROGRAM('XFRFUN')",
            "explanation": "How the 3270 screen program BNK1TFN calls XFRFUN — CICS LINK is like a "
            "synchronous RPC that passes a shared COMMAREA (a struct of parameters) between programs.",
        },
        {
            "snippet": "PIC S9(10)V99",
            "explanation": "A signed fixed-point number with 2 implied decimal places — think "
            "Decimal(12,2). This is money, stored exactly, never a floating-point value.",
        },
    ],
}

_EXPLAIN_DBCRFUN = {
    "plain_english": (
        "DBCRFUN applies a single debit or credit to one account. Before a debit it checks the "
        "account TYPE: if it is a MORTGAGE or LOAN it refuses and sets fail code 4. That is the "
        "*only* guard — an ordinary current account can be debited past its overdraft limit, "
        "because ACCOUNT-OVERDRAFT-LIMIT is read but never tested."
    ),
    "cobol_idioms": [
        {
            "snippet": "IF (HV-ACCOUNT-ACC-TYPE = 'MORTGAGE' ...) ... MOVE '4' TO ...",
            "explanation": "A type-based guard: the one place DBCRFUN refuses a debit. A compliant "
            "overdraft guard would sit right alongside this, using the same fail-code pattern.",
        },
        {
            "snippet": "88 PROC-TY-DEBIT VALUE 'DEB'.",
            "explanation": "An 88-level is a named boolean condition over a field's value — like an "
            "enum member. 'DEB' marks the PROCTRAN row as a debit.",
        },
    ],
}

_EXPLAIN_GENERIC = {
    "plain_english": (
        "This program participates in the account/transaction estate. Select XFRFUN or DBCRFUN to "
        "see the debit path where the overdraft guard is missing."
    ),
    "cobol_idioms": [
        {
            "snippet": "COPY <NAME>.",
            "explanation": "Includes a shared record layout — like importing a struct/header shared "
            "across programs.",
        }
    ],
}

_EXPLAIN_BY_PROGRAM = {
    "XFRFUN": _EXPLAIN_XFRFUN,
    "DBCRFUN": _EXPLAIN_DBCRFUN,
}


def explain_for(program: str | None) -> dict:
    """Return the canned explain payload for a program (default XFRFUN — the demo focus)."""
    if not program:
        return _EXPLAIN_XFRFUN
    return _EXPLAIN_BY_PROGRAM.get(program.upper(), _EXPLAIN_GENERIC)


# --------------------------------------------------------------------------- #
# IMPACT — narration of the blast radius (the graph itself is deterministic). #
# --------------------------------------------------------------------------- #
IMPACT_PAYLOAD = {
    "affected": [
        {
            "program": "XFRFUN",
            "relationship": "Edit site — add the overdraft guard on the debit (FROM) side, before "
            "the available balance is recomputed at line 986.",
            "risk": "high",
        },
        {
            "program": "DBCRFUN",
            "relationship": "Edit site — add the overdraft guard on ordinary debits, alongside the "
            "existing MORTGAGE/LOAN block.",
            "risk": "high",
        },
        {
            "program": "BNK1TFN",
            "relationship": "Caller (EXEC CICS LINK to XFRFUN) — surfaces the new failure path to the "
            "user; may need a new on-screen message. Its return-code handling already exists.",
            "risk": "medium",
        },
        {
            "program": "ACCOUNT (copybook)",
            "relationship": "Shared record — the guard reads ACCOUNT-OVERDRAFT-LIMIT & "
            "ACCOUNT-AVAILABLE-BALANCE. No layout change required.",
            "risk": "low",
        },
        {
            "program": "INQACC / UPDACC / CREACC",
            "relationship": "Also COPY the ACCOUNT record but do not debit — unaffected by the guard. "
            "Listed to show the shared blast radius of the ACCOUNT copybook.",
            "risk": "low",
        },
    ]
}

# --------------------------------------------------------------------------- #
# PROPOSE — the proposed diff (grounded on the real XFRFUN debit site).       #
# --------------------------------------------------------------------------- #
PROPOSED_DIFF = """\
--- a/src/base/cobol_src/XFRFUN.cbl
+++ b/src/base/cobol_src/XFRFUN.cbl
@@ -982,7 +982,17 @@
      *
      *    If the SQLCODE is OK then update the row on ACCOUNT for
      *    the FROM account.
      *
+      *    FCA Consumer Duty: enforce the account overdraft limit on the
+      *    debit (FROM) side before the available balance is reduced.
+      *    Mirrors the existing MORTGAGE/LOAN guard pattern in DBCRFUN.
+           IF HV-ACCOUNT-AVAIL-BAL - COMM-AMT
+                < (0 - HV-ACCOUNT-OVERDRAFT-LIM)
+              MOVE 'N' TO COMM-SUCCESS
+              MOVE 'O' TO COMM-FAIL-CODE
+              GO TO UADF999
+           END-IF
+
           COMPUTE HV-ACCOUNT-AVAIL-BAL =
           HV-ACCOUNT-AVAIL-BAL - COMM-AMT.

"""

PROPOSE_PAYLOAD = {
    "explanation": (
        "Adds a single overdraft guard on the debit (FROM) side of XFRFUN. Before the available "
        "balance is recomputed, the transfer is rejected if it would push the balance below the "
        "negative of ACCOUNT-OVERDRAFT-LIMIT, setting the commarea fail code the caller (BNK1TFN) "
        "already handles. The change is minimal and localized, introduces no copybook or interface "
        "changes, and mirrors the existing MORTGAGE/LOAN guard already present in DBCRFUN. This is a "
        "PROPOSAL — nothing is applied until you approve it."
    )
}

# --------------------------------------------------------------------------- #
# PLAN — decomposition of the overdraft change into a DAG of sub-changes.      #
# Doubles as the Stage-2 fallback (returned when live decomposition fails).    #
# --------------------------------------------------------------------------- #
PLAN_PAYLOAD = {
    "nodes": [
        {
            "id": "acct-field",
            "label": "Add fee-cap field to ACCOUNT copybook",
            "change_request": "Add an overdraft fee-cap field/constant to the ACCOUNT copybook so the "
            "debit programs can enforce a maximum overdraft fee.",
            "edit_sites": ["ACCOUNT"],
        },
        {
            "id": "xfrfun-guard",
            "label": "Guard the debit path in XFRFUN",
            "change_request": "Cap / add a compliant guard on overdraft fees on the debit (FROM) side of "
            "XFRFUN before the available balance is reduced, to comply with FCA Consumer Duty.",
            "edit_sites": ["XFRFUN"],
        },
        {
            "id": "dbcrfun-guard",
            "label": "Guard ordinary debits in DBCRFUN",
            "change_request": "Enforce the overdraft fee cap on ordinary debits in DBCRFUN, alongside the "
            "existing MORTGAGE/LOAN guard, to comply with FCA Consumer Duty.",
            "edit_sites": ["DBCRFUN"],
        },
        {
            "id": "proctran-audit",
            "label": "Record capped fee in PROCTRAN audit trail",
            "change_request": "Record the capped overdraft fee and its reason code in the PROCTRAN "
            "transaction / audit record.",
            "edit_sites": ["PROCTRAN"],
        },
        {
            "id": "bnk1tfn-screen",
            "label": "Surface the fail path in the BNK1TFN screen",
            "change_request": "Surface the new overdraft-cap failure path to the user in the BNK1TFN 3270 "
            "transfer screen.",
            "edit_sites": ["BNK1TFN"],
        },
    ],
    "edges": [
        {"source": "acct-field", "target": "xfrfun-guard", "reason": "XFRFUN reads ACCOUNT-OVERDRAFT-LIMIT"},
        {"source": "acct-field", "target": "dbcrfun-guard", "reason": "DBCRFUN reads the same ACCOUNT field"},
        {"source": "xfrfun-guard", "target": "proctran-audit", "reason": "guard outcome is journalled to PROCTRAN"},
        {"source": "dbcrfun-guard", "target": "proctran-audit", "reason": "guard outcome is journalled to PROCTRAN"},
        {"source": "xfrfun-guard", "target": "bnk1tfn-screen", "reason": "BNK1TFN LINKs XFRFUN and surfaces its result"},
    ],
}

FALLBACK_PROGRAMME = {
    "id": "prog-fca-overdraft",
    "title": "Cap overdraft fees to comply with FCA Consumer Duty",
    "subtitle": "One compliance change, decomposed into small, dependent, individually-reviewable sub-changes.",
    "nodes": PLAN_PAYLOAD["nodes"],
    "edges": PLAN_PAYLOAD["edges"],
}

# --------------------------------------------------------------------------- #
# Schema-title → canned payload (used by MockProvider).                       #
# ExplainPayload is resolved per-program via explain_for().                   #
# --------------------------------------------------------------------------- #
MOCK_BY_SCHEMA = {
    "RouterOutput": ROUTER_OUTPUT,
    "LocatePayload": LOCATE_PAYLOAD,
    "ImpactPayload": IMPACT_PAYLOAD,
    "ProposePayload": PROPOSE_PAYLOAD,
    "PlanPayload": PLAN_PAYLOAD,
    # "ExplainPayload" handled specially (needs the selected program).
}

# Seed programs whose neighbourhood defines the overdraft blast-radius subgraph.
BLAST_RADIUS_SEEDS = ["XFRFUN", "DBCRFUN"]
