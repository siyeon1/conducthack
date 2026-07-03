// mockState.js — offline fixture data for the overdraft worked example.
// Translated from the repo's fixtures.py (Claude.MD §8.4). Shapes mirror schema.py
// (SessionState / CellResult / Citation / GraphEdge) exactly. NEVER hit the network
// here; api.js decides mock vs. real.

// --- relative file paths (as they appear in citations) --------------------- //
const F_XFRFUN = "src/base/cobol_src/XFRFUN.cbl";
const F_DBCRFUN = "src/base/cobol_src/DBCRFUN.cbl";
const F_ACCOUNT = "src/base/cobol_copy/ACCOUNT.cpy";
const F_PROCTRAN = "src/base/cobol_copy/PROCTRAN.cpy";

export const DEFAULT_CHANGE_REQUEST =
  "Cap / add a compliant guard on overdraft fees to comply with FCA Consumer Duty";

// --- ROUTER (internal, pre-Locate) ----------------------------------------- //
export const ROUTER_OUTPUT = {
  intent: "add-guard",
  seed_symbols: [
    "ACCOUNT-OVERDRAFT-LIMIT",
    "ACCOUNT-AVAILABLE-BALANCE",
    "overdraft",
    "debit",
    "transfer",
  ],
};

// --- LOCATE ---------------------------------------------------------------- //
export const LOCATE_PAYLOAD = {
  programs: [
    {
      program: "XFRFUN",
      file: F_XFRFUN,
      reason:
        'Performs account-to-account transfers and reduces the FROM account\'s balance. Its own header states "No checking is made on overdraft limits" — the debit side has no overdraft guard, so a compliant change must ADD one here.',
      verified: true,
    },
    {
      program: "DBCRFUN",
      file: F_DBCRFUN,
      reason:
        "Applies debits/credits to an account. It blocks debits only for MORTGAGE/LOAN account types (fail code 4); it does not enforce ACCOUNT-OVERDRAFT-LIMIT on ordinary debits.",
      verified: true,
    },
    {
      program: "ACCOUNT (copybook)",
      file: F_ACCOUNT,
      reason:
        "Defines ACCOUNT-OVERDRAFT-LIMIT and ACCOUNT-AVAILABLE-BALANCE — the two fields a compliant guard compares. Shared by every program that touches an account record.",
      verified: true,
    },
    {
      program: "PROCTRAN (copybook)",
      file: F_PROCTRAN,
      reason:
        "The transaction record written on each debit/transfer (PROC-TRAN-AMOUNT, PROC-TRAN-TYPE 'DEB'/'TFR'). Confirms where the money movement is journalled.",
      verified: true,
    },
  ],
};

export const LOCATE_CITATIONS = [
  { program: "XFRFUN", file: F_XFRFUN, lines: "19-21", verified: true },
  { program: "XFRFUN", file: F_XFRFUN, lines: "986-990", verified: true },
  { program: "DBCRFUN", file: F_DBCRFUN, lines: "321-341", verified: true },
  { program: "ACCOUNT", file: F_ACCOUNT, lines: "21", verified: true },
  { program: "ACCOUNT", file: F_ACCOUNT, lines: "34", verified: true },
  { program: "PROCTRAN", file: F_PROCTRAN, lines: "103", verified: true },
];

// --- EXPLAIN (keyed by program; default XFRFUN) ---------------------------- //
const EXPLAIN_XFRFUN = {
  plain_english:
    'XFRFUN moves money between two accounts. It reads both ACCOUNT records from the database, subtracts the transfer amount from the *FROM* account\'s available and actual balances, adds it to the *TO* account, and writes a PROCTRAN transaction record for the audit trail. Critically, it **never compares the debit against the account\'s overdraft limit** — the program\'s own header comment even says "No checking is made on overdraft limits." So under FCA Consumer Duty, the compliant fix is to *add* a guard on the debit side, not to change an existing check.',
  cobol_idioms: [
    {
      snippet: "COPY ACCOUNT.",
      explanation:
        "Pulls in the shared ACCOUNT record layout at compile time — like importing a struct / shared header used across many programs. Change the copybook and every program that COPYs it sees the new shape.",
    },
    {
      snippet: "COMPUTE HV-ACCOUNT-AVAIL-BAL = HV-ACCOUNT-AVAIL-BAL - COMM-AMT.",
      explanation:
        "Recomputes the available balance in place — a plain arithmetic assignment (COMM-AMT is the transfer amount). Notice there is no IF/guard around it: the balance is reduced unconditionally.",
    },
    {
      snippet: "EXEC CICS LINK PROGRAM('XFRFUN')",
      explanation:
        "How the 3270 screen program BNK1TFN calls XFRFUN — CICS LINK is like a synchronous RPC that passes a shared COMMAREA (a struct of parameters) between programs.",
    },
    {
      snippet: "PIC S9(10)V99",
      explanation:
        "A signed fixed-point number with 2 implied decimal places — think Decimal(12,2). This is money, stored exactly, never a floating-point value.",
    },
  ],
};

const EXPLAIN_DBCRFUN = {
  plain_english:
    "DBCRFUN applies a single debit or credit to one account. Before a debit it checks the account TYPE: if it is a MORTGAGE or LOAN it refuses and sets fail code 4. That is the *only* guard — an ordinary current account can be debited past its overdraft limit, because ACCOUNT-OVERDRAFT-LIMIT is read but never tested.",
  cobol_idioms: [
    {
      snippet: "IF (HV-ACCOUNT-ACC-TYPE = 'MORTGAGE' ...) ... MOVE '4' TO ...",
      explanation:
        "A type-based guard: the one place DBCRFUN refuses a debit. A compliant overdraft guard would sit right alongside this, using the same fail-code pattern.",
    },
    {
      snippet: "88 PROC-TY-DEBIT VALUE 'DEB'.",
      explanation:
        "An 88-level is a named boolean condition over a field's value — like an enum member. 'DEB' marks the PROCTRAN row as a debit.",
    },
  ],
};

const EXPLAIN_GENERIC = {
  plain_english:
    "This program participates in the account/transaction estate. Select XFRFUN or DBCRFUN to see the debit path where the overdraft guard is missing.",
  cobol_idioms: [
    {
      snippet: "COPY <NAME>.",
      explanation:
        "Includes a shared record layout — like importing a struct/header shared across programs.",
    },
  ],
};

const EXPLAIN_BY_PROGRAM = {
  XFRFUN: EXPLAIN_XFRFUN,
  DBCRFUN: EXPLAIN_DBCRFUN,
};

export function explainFor(program) {
  if (!program) return EXPLAIN_XFRFUN;
  const key = String(program).toUpperCase().replace(/\s*\(COPYBOOK\)/, "").trim();
  return EXPLAIN_BY_PROGRAM[key] || EXPLAIN_GENERIC;
}

// --- IMPACT ---------------------------------------------------------------- //
export const IMPACT_PAYLOAD = {
  affected: [
    {
      program: "XFRFUN",
      relationship:
        "Edit site — add the overdraft guard on the debit (FROM) side, before the available balance is recomputed at line 986.",
      risk: "high",
      in_graph: true,
    },
    {
      program: "DBCRFUN",
      relationship:
        "Edit site — add the overdraft guard on ordinary debits, alongside the existing MORTGAGE/LOAN block.",
      risk: "high",
      in_graph: true,
    },
    {
      program: "BNK1TFN",
      relationship:
        "Caller (EXEC CICS LINK to XFRFUN) — surfaces the new failure path to the user; may need a new on-screen message. Its return-code handling already exists.",
      risk: "medium",
      in_graph: true,
    },
    {
      program: "ACCOUNT (copybook)",
      relationship:
        "Shared record — the guard reads ACCOUNT-OVERDRAFT-LIMIT & ACCOUNT-AVAILABLE-BALANCE. No layout change required.",
      risk: "low",
      in_graph: true,
    },
    {
      program: "INQACC / UPDACC / CREACC",
      relationship:
        "Also COPY the ACCOUNT record but do not debit — unaffected by the guard. Listed to show the shared blast radius of the ACCOUNT copybook.",
      risk: "low",
      in_graph: true,
    },
  ],
};

// The deterministic blast-radius subgraph written into state.graph.
export const MOCK_GRAPH = {
  nodes: [
    "BNK1TFN",
    "XFRFUN",
    "DBCRFUN",
    "INQACC",
    "UPDACC",
    "CREACC",
    "ACCOUNT",
    "PROCTRAN",
  ],
  edges: [
    { frm: "BNK1TFN", to: "XFRFUN", kind: "CALL", verified: true },
    { frm: "XFRFUN", to: "ACCOUNT", kind: "COPY", verified: true },
    { frm: "XFRFUN", to: "PROCTRAN", kind: "COPY", verified: true },
    { frm: "DBCRFUN", to: "ACCOUNT", kind: "COPY", verified: true },
    { frm: "DBCRFUN", to: "PROCTRAN", kind: "COPY", verified: true },
    { frm: "XFRFUN", to: "PROCTRAN", kind: "WRITES", verified: false },
    { frm: "INQACC", to: "ACCOUNT", kind: "COPY", verified: true },
    { frm: "UPDACC", to: "ACCOUNT", kind: "COPY", verified: true },
    { frm: "CREACC", to: "ACCOUNT", kind: "COPY", verified: true },
  ],
};

// --- PROPOSE --------------------------------------------------------------- //
export const PROPOSED_DIFF = `--- a/src/base/cobol_src/XFRFUN.cbl
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
`;

export const PROPOSE_PAYLOAD = {
  explanation:
    "Adds a single overdraft guard on the debit (FROM) side of XFRFUN. Before the available balance is recomputed, the transfer is rejected if it would push the balance below the negative of ACCOUNT-OVERDRAFT-LIMIT, setting the commarea fail code the caller (BNK1TFN) already handles. The change is minimal and localized, introduces no copybook or interface changes, and mirrors the existing MORTGAGE/LOAN guard already present in DBCRFUN. This is a PROPOSAL — nothing is applied until you approve it.",
};

// --- METRICS (Tier-2 hero counters; harmless to show now) ------------------ //
export const MOCK_METRICS = {
  programs_traced: 8,
  paragraphs_traced: 34,
  lines_in_scope: 1180,
  dependencies_found: 9,
  copybooks_resolved: "36/37",
  wall_clock_seconds: 27.4,
  tokens: 18240,
  cost_gbp: 0.11,
};

// --- LEDGER ---------------------------------------------------------------- //
// A representative approved entry (hashes are illustrative in mock mode).
export function mockLedgerEntry(session_id, decision = "approve", rationale = "") {
  return {
    index: 0,
    session_id,
    timestamp: new Date().toISOString(),
    intent: DEFAULT_CHANGE_REQUEST,
    programs: ["XFRFUN", "DBCRFUN"],
    explanation_hash:
      "9f2b6c1d4a7e0f38b5c9d2e1a4f7061c8b3d5e2f9a1c4b7d0e3f6a9c2b5d8e10",
    diff_hash:
      "3c7a1e904d2f6b8a5c1d0e7f4a2b9c6d8e3f1a0b7c4d9e2f6a3b8c5d1e0f7a94",
    decision,
    approver: "engineer@bank",
    rationale:
      rationale ||
      "Guard mirrors the existing MORTGAGE/LOAN pattern; localized to the debit side; no copybook or interface change.",
    prev_hash: "",
    entry_hash:
      "a1b2c3d4e5f60718293a4b5c6d7e8f9012a3b4c5d6e7f8091a2b3c4d5e6f7081",
  };
}

// --- Fresh SessionState (schema.py::new_session_state mirror) --------------- //
function newCellResult(cell) {
  return {
    cell,
    status: "pending",
    summary: "",
    citations: [],
    payload: {},
    proposed_diff: null,
  };
}

const GRAPH_NODES = ["locate", "explain", "impact", "propose", "approve", "record"];

export function freshState(session_id, change_request) {
  const cells = {};
  for (const c of GRAPH_NODES) cells[c] = newCellResult(c);
  return {
    session_id,
    thread_id: `thread-${session_id}`,
    change_request: change_request || DEFAULT_CHANGE_REQUEST,
    intent: null,
    seed_symbols: [],
    selected_program: null,
    cells,
    graph: { nodes: [], edges: [] },
    metrics: {},
    ledger_head: null,
  };
}
