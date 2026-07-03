// api.js — the single boundary between the notebook UI and the backend.
//
// USE_MOCK (VITE_USE_MOCK, default true) makes every call resolve from bundled
// fixture data so `npm run dev` renders the full 5-cell notebook with realistic
// data even with no backend running. When false, we do plain fetch() to the API
// at VITE_API_BASE per Claude.MD §8.2.
//
// Every function resolves to the same shape the real endpoints return, and throws
// an { error, detail } object on failure so the UI can show a non-crashing chip.

import {
  DEFAULT_CHANGE_REQUEST,
  ROUTER_OUTPUT,
  LOCATE_PAYLOAD,
  LOCATE_CITATIONS,
  IMPACT_PAYLOAD,
  PROPOSE_PAYLOAD,
  PROPOSED_DIFF,
  MOCK_GRAPH,
  MOCK_METRICS,
  explainFor,
  mockLedgerEntry,
  freshState,
} from "./mockState.js";

const RAW_MOCK = import.meta.env.VITE_USE_MOCK;
export const USE_MOCK = RAW_MOCK === undefined ? true : String(RAW_MOCK) !== "false";
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const clone = (o) => JSON.parse(JSON.stringify(o));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// --------------------------------------------------------------------------- //
// Real-mode fetch helper                                                      //
// --------------------------------------------------------------------------- //
async function apiFetch(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw { error: "Network error", detail: String(e && e.message ? e.message : e) };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty / non-JSON body */
  }
  if (!res.ok) {
    throw {
      error: (data && data.error) || `HTTP ${res.status}`,
      detail: data && data.detail,
    };
  }
  return data;
}

// --------------------------------------------------------------------------- //
// Mock store — per-session state + an in-memory ledger                        //
// --------------------------------------------------------------------------- //
const mockStore = new Map(); // session_id -> { state, ledger:[], tampered, tamperedIndex }

function ensure(session_id) {
  if (!mockStore.has(session_id)) {
    mockStore.set(session_id, {
      state: freshState(session_id, DEFAULT_CHANGE_REQUEST),
      ledger: [],
      tampered: false,
      tamperedIndex: undefined,
    });
  }
  return mockStore.get(session_id);
}

function cellDone(state, cell, patch) {
  state.cells[cell] = {
    cell,
    status: "done",
    summary: "",
    citations: [],
    payload: {},
    proposed_diff: null,
    ...patch,
  };
}

async function mockRunCell(session_id, cell, selected_program) {
  const store = ensure(session_id);
  const state = store.state;
  await delay(420);

  if (cell === "locate") {
    // Router (internal, pre-locate) feeds intent + seed symbols.
    state.intent = ROUTER_OUTPUT.intent;
    state.seed_symbols = clone(ROUTER_OUTPUT.seed_symbols);
    cellDone(state, "locate", {
      summary: `Found ${LOCATE_PAYLOAD.programs.length} affected programs / copybooks for intent “${ROUTER_OUTPUT.intent}”.`,
      citations: clone(LOCATE_CITATIONS),
      payload: clone(LOCATE_PAYLOAD),
    });
  } else if (cell === "explain") {
    const prog = selected_program || "XFRFUN";
    state.selected_program = prog;
    cellDone(state, "explain", {
      summary: `Plain-English walkthrough of ${prog}, teaching the COBOL idioms in play.`,
      payload: clone(explainFor(prog)),
    });
  } else if (cell === "impact") {
    state.graph = clone(MOCK_GRAPH);
    state.metrics = clone(MOCK_METRICS);
    cellDone(state, "impact", {
      summary: `Blast radius: ${MOCK_GRAPH.nodes.length} nodes, ${MOCK_GRAPH.edges.length} dependency edges.`,
      payload: clone(IMPACT_PAYLOAD),
    });
  } else if (cell === "propose") {
    // propose writes the diff; the graph pauses at `approve` → awaiting_approval.
    state.cells.propose = {
      cell: "propose",
      status: "awaiting_approval",
      summary: "Draft change ready for human review. Nothing is applied until approved.",
      citations: [],
      payload: clone(PROPOSE_PAYLOAD),
      proposed_diff: PROPOSED_DIFF,
    };
    state.cells.approve.status = "awaiting_approval";
  } else if (cell === "record") {
    // Not normally called directly; record is driven by /cell/approve.
    cellDone(state, "record", {
      summary: "Recorded to the tamper-evident ledger.",
      payload: { ledger_entry: mockLedgerEntry(session_id) },
    });
  } else {
    throw { error: "Unknown cell", detail: cell };
  }
  return { state: clone(state) };
}

async function mockApprove(session_id, decision, edited_diff) {
  const store = ensure(session_id);
  const state = store.state;
  await delay(360);

  if (decision === "reject") {
    // Return the propose cell to a re-runnable state.
    state.cells.propose = {
      cell: "propose",
      status: "rejected",
      summary: "Proposal rejected. Re-run Propose to draft a different change.",
      citations: [],
      payload: {},
      proposed_diff: null,
    };
    state.cells.approve.status = "rejected";
    state.cells.record.status = "pending";
    return { state: clone(state) };
  }

  // approve | edit → advance to record.
  const finalDiff = decision === "edit" && edited_diff ? edited_diff : PROPOSED_DIFF;
  state.cells.propose.status = "approved";
  state.cells.propose.proposed_diff = finalDiff;
  state.cells.approve.status = "approved";

  const entry = mockLedgerEntry(session_id, decision);
  entry.index = store.ledger.length;
  entry.prev_hash = store.ledger.length
    ? store.ledger[store.ledger.length - 1].entry_hash
    : "";
  store.ledger.push(entry);
  state.ledger_head = entry.entry_hash;

  cellDone(state, "record", {
    summary: `Change recorded to the ledger (decision: ${decision}).`,
    payload: { ledger_entry: clone(entry) },
  });
  return { state: clone(state) };
}

// --------------------------------------------------------------------------- //
// Public API                                                                  //
// --------------------------------------------------------------------------- //
export async function createSession(change_request) {
  if (USE_MOCK) {
    const session_id = `sess-${Math.random().toString(36).slice(2, 8)}`;
    mockStore.set(session_id, {
      state: freshState(session_id, change_request || DEFAULT_CHANGE_REQUEST),
      ledger: [],
      tampered: false,
      tamperedIndex: undefined,
    });
    await delay(250);
    return { session_id, state: clone(mockStore.get(session_id).state) };
  }
  return apiFetch("/session", { method: "POST", body: { change_request } });
}

export async function runCell(session_id, cell, selected_program) {
  if (USE_MOCK) return mockRunCell(session_id, cell, selected_program);
  const body = { session_id, cell };
  if (selected_program) body.selected_program = selected_program;
  return apiFetch("/cell/run", { method: "POST", body });
}

export async function approveCell(session_id, decision, edited_diff) {
  if (USE_MOCK) return mockApprove(session_id, decision, edited_diff);
  const body = { session_id, decision };
  if (decision === "edit") body.edited_diff = edited_diff;
  return apiFetch("/cell/approve", { method: "POST", body });
}

export async function getLedger(session_id) {
  if (USE_MOCK) {
    const store = ensure(session_id);
    await delay(180);
    return { entries: clone(store.ledger), verified: !store.tampered };
  }
  return apiFetch(`/ledger?session_id=${encodeURIComponent(session_id)}`);
}

export async function verifyLedger(session_id) {
  if (USE_MOCK) {
    const store = ensure(session_id);
    await delay(300);
    if (store.tampered) return { verified: false, broken_at: store.tamperedIndex ?? 0 };
    return { verified: true };
  }
  return apiFetch("/ledger/verify", { method: "POST", body: { session_id } });
}

export async function tamperLedger(session_id) {
  if (USE_MOCK) {
    const store = ensure(session_id);
    await delay(160);
    if (store.ledger.length) {
      const idx = store.ledger.length - 1;
      // Silently mutate a recorded field — the hash no longer matches.
      store.ledger[idx].intent = store.ledger[idx].intent + "  [ALTERED]";
      store.tampered = true;
      store.tamperedIndex = idx;
    }
    return { ok: true };
  }
  return apiFetch("/ledger/tamper", { method: "POST", body: { session_id } });
}
