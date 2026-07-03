import { useEffect, useMemo, useState } from "react";
import Cell from "./components/Cell.jsx";
import { VerifiedBadge } from "./components/Badge.jsx";
import DiffView from "./components/DiffView.jsx";
import GraphView from "./components/GraphView.jsx";
import LedgerPanel from "./components/LedgerPanel.jsx";
import SourceView from "./components/SourceView.jsx";
import AffectedList from "./components/AffectedList.jsx";
import {
  USE_MOCK,
  createSession,
  runCell,
  approveCell,
  getLedger,
} from "./api.js";
import { DEFAULT_CHANGE_REQUEST } from "./mockState.js";

// ------------------------------------------------------------------ //
// Tiny rich-text renderer: **bold**, *italic*, preserved line breaks. //
// ------------------------------------------------------------------ //
function RichText({ text }) {
  if (!text) return null;
  const lines = String(text).split("\n");
  const fmt = (line, keyBase) => {
    const out = [];
    const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let last = 0;
    let m;
    let i = 0;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) out.push(line.slice(last, m.index));
      if (m[1])
        out.push(
          <strong key={`${keyBase}-b${i}`} className="font-semibold text-slate-100">
            {m[1]}
          </strong>
        );
      else
        out.push(
          <em key={`${keyBase}-i${i}`} className="text-slate-200 not-italic underline decoration-slate-600 underline-offset-2">
            {m[2]}
          </em>
        );
      last = re.lastIndex;
      i += 1;
    }
    if (last < line.length) out.push(line.slice(last));
    return out;
  };
  return (
    <>
      {lines.map((line, idx) => (
        <span key={idx}>
          {fmt(line, idx)}
          {idx < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

const EMPTY_CELL = { status: "pending", payload: {}, citations: [] };

export default function App() {
  const [changeRequest, setChangeRequest] = useState(DEFAULT_CHANGE_REQUEST);
  const [sessionId, setSessionId] = useState(null);
  const [state, setState] = useState(null);
  const [running, setRunning] = useState({}); // cell -> bool
  const [errors, setErrors] = useState({}); // cell -> {error, detail}
  const [selectedProgram, setSelectedProgram] = useState("XFRFUN");
  const [sourceOpen, setSourceOpen] = useState(null); // program/copybook to view, or null

  // Propose gate local UI
  const [editing, setEditing] = useState(false);
  const [editedDiff, setEditedDiff] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [rationale, setRationale] = useState(""); // required justification, hashed into the ledger

  // Ledger
  const [ledger, setLedger] = useState({ entries: [], verified: true });

  const cell = (name) => (state && state.cells && state.cells[name]) || EMPTY_CELL;

  // Auto-create a session on first load so the notebook is ready to demo.
  useEffect(() => {
    handleNewSession(DEFAULT_CHANGE_REQUEST);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewSession(cr) {
    setErrors({});
    setRunning({});
    setEditing(false);
    setLedger({ entries: [], verified: true });
    try {
      const { session_id, state: st } = await createSession(cr ?? changeRequest);
      setSessionId(session_id);
      setState(st);
      setSelectedProgram("XFRFUN");
    } catch (e) {
      setErrors({ session: e });
    }
  }

  async function handleRun(name, extra) {
    if (!sessionId) return;
    setRunning((r) => ({ ...r, [name]: true }));
    setErrors((e) => ({ ...e, [name]: null }));
    try {
      const { state: st } = await runCell(sessionId, name, extra);
      setState(st);
    } catch (e) {
      setErrors((er) => ({ ...er, [name]: e }));
    } finally {
      setRunning((r) => ({ ...r, [name]: false }));
    }
  }

  async function refreshLedger() {
    if (!sessionId) return;
    try {
      const led = await getLedger(sessionId);
      setLedger(led);
    } catch {
      /* leave prior ledger; LedgerPanel shows its own errors on verify */
    }
  }

  async function handleDecision(decision) {
    if (!sessionId) return;
    // Attested approval: a state-changing decision must carry the human's reasoning.
    if (decision !== "reject" && !rationale.trim()) {
      setErrors((e) => ({
        ...e,
        propose: { error: "A justification is required to approve or edit this change." },
      }));
      return;
    }
    setGateBusy(true);
    setErrors((e) => ({ ...e, propose: null }));
    try {
      const { state: st } = await approveCell(
        sessionId,
        decision,
        decision === "edit" ? editedDiff : undefined,
        decision === "reject" ? undefined : rationale.trim()
      );
      setState(st);
      setEditing(false);
      if (decision !== "reject") {
        setRationale("");
        await refreshLedger();
      }
    } catch (e) {
      setErrors((er) => ({ ...er, propose: e }));
    } finally {
      setGateBusy(false);
    }
  }

  const status = (name) =>
    running[name] ? "running" : cell(name).status || "pending";

  // Explain program options from the locate result (fallback to the demo pair).
  const programOptions = useMemo(() => {
    const progs = cell("locate").payload && cell("locate").payload.programs;
    const names =
      progs && progs.length
        ? progs.map((p) => p.program)
        : ["XFRFUN", "DBCRFUN"];
    return Array.from(new Set(names));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const proposeCell = cell("propose");
  const gateOpen = proposeCell.status === "awaiting_approval";
  const recordEntry =
    cell("record").payload && cell("record").payload.ledger_entry;
  const metrics = (state && state.metrics) || {};
  const hasMetrics = metrics && Object.keys(metrics).length > 0;

  return (
    <div className="mx-auto min-h-full max-w-5xl px-4 pb-20 pt-6 sm:px-6">
      {/* ---------------- Header ---------------- */}
      <header className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-lg shadow-lg shadow-indigo-900/40">
              🛰️
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                Legacy Move
                <span className="ml-2 text-slate-400">— Change Cockpit</span>
              </h1>
              <p className="text-xs text-slate-400">
                Comprehend, map, and safely change legacy COBOL — with a human in
                control of every step.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300"
              title="Placeholder — flips on when the local (Ollama) provider is active"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Running locally — your code never leaves this machine
            </span>
            {USE_MOCK && (
              <span className="rounded-full border border-slate-600/50 bg-slate-700/30 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                mock data
              </span>
            )}
          </div>
        </div>

        {/* Change request bar */}
        <div className="rounded-2xl border border-slate-700/60 bg-ink-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
            Business change request
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={changeRequest}
              onChange={(e) => setChangeRequest(e.target.value)}
              placeholder="Describe the change in plain English…"
              className="flex-1 rounded-lg border border-slate-600/60 bg-ink-950/70 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNewSession();
              }}
            />
            <button
              type="button"
              onClick={() => handleNewSession()}
              className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-ink-900 transition hover:bg-white"
            >
              New session
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>
              Session:{" "}
              <span className="font-mono text-slate-400">
                {sessionId || "—"}
              </span>
            </span>
            {state && state.intent && (
              <span>
                Intent:{" "}
                <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-indigo-300">
                  {state.intent}
                </span>
              </span>
            )}
            {state && state.seed_symbols && state.seed_symbols.length > 0 && (
              <span className="flex flex-wrap items-center gap-1">
                Seed symbols:
                {state.seed_symbols.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </span>
            )}
          </div>
          {errors.session && (
            <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              Could not start session: {errors.session.error}
            </div>
          )}
        </div>

        {/* Metrics hero strip (Tier-2 counters) */}
        {hasMetrics && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Programs traced", metrics.programs_traced],
              ["Paragraphs", metrics.paragraphs_traced],
              ["Lines in scope", metrics.lines_in_scope],
              ["Dependencies", metrics.dependencies_found],
              ["Copybooks", metrics.copybooks_resolved],
              [
                "Wall-clock",
                metrics.wall_clock_seconds != null
                  ? `${metrics.wall_clock_seconds}s`
                  : undefined,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-700/50 bg-ink-900/50 px-3 py-2 text-center"
              >
                <div className="text-lg font-bold text-slate-100">
                  {value != null ? value : "—"}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}
      </header>

      {/* ---------------- Notebook cells ---------------- */}
      <div className="space-y-5">
        {/* 1 — LOCATE */}
        <Cell
          index={1}
          title="Locate"
          subtitle="Find every program & copybook the change touches"
          status={status("locate")}
          running={running.locate}
          disabled={!sessionId}
          onRun={() => handleRun("locate")}
          error={errors.locate}
        >
          {cell("locate").payload && cell("locate").payload.programs ? (
            <div className="space-y-4">
              {(() => {
                const progs = cell("locate").payload.programs || [];
                const g = progs.filter((p) => p.grounded).length;
                return g > 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] px-3 py-2 text-[13px] text-emerald-200">
                    <span className="text-base leading-none">✓</span>
                    <span>
                      <span className="font-semibold">
                        {g} of {progs.length}
                      </span>{" "}
                      grounded in the field index —
                      <span className="text-emerald-300/90">
                        {" "}
                        deterministically parsed from the COBOL, not inferred by the model.
                      </span>
                    </span>
                  </div>
                ) : null;
              })()}
              <ul className="space-y-2">
                {cell("locate").payload.programs.map((p, i) => (
                  <li
                    key={i}
                    className="animate-fade-in rounded-lg border border-slate-700/50 bg-ink-950/40 p-3"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-100">
                        {p.program}
                      </span>
                      <VerifiedBadge verified={p.verified} />
                      <span className="ml-auto font-mono text-[11px] text-slate-500">
                        {p.file}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">{p.reason}</p>
                  </li>
                ))}
              </ul>

              {cell("locate").citations && cell("locate").citations.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Source citations
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {cell("locate").citations.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-700/50 bg-ink-950/40 px-2 py-1 font-mono text-[11px] text-slate-400"
                      >
                        {c.program}
                        {c.lines ? `:${c.lines}` : ""}
                        <VerifiedBadge verified={c.verified} />
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Placeholder text="Run to locate affected programs and copybooks." />
          )}
        </Cell>

        {/* 2 — EXPLAIN */}
        <Cell
          index={2}
          title="Explain"
          subtitle="Plain-English walkthrough that teaches the COBOL idioms"
          status={status("explain")}
          running={running.explain}
          disabled={!sessionId}
          onRun={() => handleRun("explain", selectedProgram)}
          error={errors.explain}
          headerExtra={
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="rounded-lg border border-slate-600/60 bg-ink-950/70 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500/70"
              title="Program to explain"
            >
              {programOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          }
        >
          {cell("explain").payload && cell("explain").payload.plain_english ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-700/40 bg-ink-950/30 p-4 text-sm leading-relaxed text-slate-300">
                <RichText text={cell("explain").payload.plain_english} />
              </div>

              {cell("explain").payload.cobol_idioms &&
                cell("explain").payload.cobol_idioms.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <span className="text-indigo-400">◆</span> COBOL idioms in
                      play
                    </h4>
                    <div className="space-y-2.5">
                      {cell("explain").payload.cobol_idioms.map((idi, i) => (
                        <div
                          key={i}
                          className="animate-fade-in grid gap-2 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.04] p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
                        >
                          <div className="overflow-x-auto rounded-md border border-slate-700/60 bg-ink-950/80 p-2.5">
                            <code className="whitespace-pre font-mono text-[12.5px] text-emerald-300">
                              {idi.snippet}
                            </code>
                          </div>
                          <p className="text-sm text-slate-400">
                            {idi.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          ) : (
            <Placeholder text="Pick a program and run to get a new-joiner-friendly explanation." />
          )}
        </Cell>

        {/* 3 — IMPACT */}
        <Cell
          index={3}
          title="Impact"
          subtitle="Map the blast radius — what else depends on this & could break"
          status={status("impact")}
          running={running.impact}
          disabled={!sessionId}
          onRun={() => handleRun("impact")}
          error={errors.impact}
        >
          {cell("impact").payload && cell("impact").payload.affected ? (
            <div className="space-y-5">
              <AffectedList affected={cell("impact").payload.affected} />

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Blast-radius dependency graph
                </h4>
                <GraphView
                  graph={state && state.graph}
                  highlight={["XFRFUN", "DBCRFUN"]}
                  onNodeClick={(name) => setSourceOpen(name)}
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  Click any node to read its source.
                </p>
              </div>
            </div>
          ) : (
            <Placeholder text="Run to render the dependency graph and risk table." />
          )}
        </Cell>

        {/* 4 — PROPOSE (the human gate) */}
        <Cell
          index={4}
          title="Propose"
          subtitle="Draft the specific change — approval required before anything is recorded"
          status={status("propose")}
          running={running.propose}
          disabled={!sessionId}
          gated
          runLabel={gateOpen ? "Re-draft" : "Run"}
          onRun={() => {
            setEditing(false);
            handleRun("propose");
          }}
          error={errors.propose}
        >
          {proposeCell.proposed_diff || proposeCell.status === "approved" ? (
            <div className="space-y-4">
              {proposeCell.payload && proposeCell.payload.explanation && (
                <div className="rounded-lg border border-slate-700/40 bg-ink-950/30 p-3.5 text-sm leading-relaxed text-slate-300">
                  <RichText text={proposeCell.payload.explanation} />
                </div>
              )}

              {editing ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                    Edit the diff before approving
                  </label>
                  <textarea
                    value={editedDiff}
                    onChange={(e) => setEditedDiff(e.target.value)}
                    spellCheck={false}
                    className="h-64 w-full resize-y rounded-lg border border-slate-600/60 bg-ink-950/80 p-3 font-mono text-[12.5px] text-slate-200 outline-none focus:border-indigo-500/70"
                  />
                </div>
              ) : (
                <DiffView diff={proposeCell.proposed_diff} />
              )}

              {/* THE CONTROL SURFACE — hard human gate */}
              {gateOpen && (
                <div className="animate-fade-in rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                    <span className="text-lg">✋</span> Human approval required
                    <span className="ml-1 font-normal text-amber-200/70">
                      — the agent will not apply or record this change on its own.
                    </span>
                  </div>

                  <div className="mb-3">
                    <label className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-amber-200/80">
                      Justification <span className="text-rose-300">*</span>
                      <span className="font-normal normal-case tracking-normal text-amber-200/50">
                        — recorded verbatim in the ledger and hash-chained with the diff
                      </span>
                    </label>
                    <textarea
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      placeholder="Why is this change correct and safe to apply? e.g. mirrors the existing MORTGAGE/LOAN guard; localized to the debit side; no copybook or interface change."
                      className="h-20 w-full resize-y rounded-lg border border-amber-500/30 bg-ink-950/70 p-2.5 text-[13px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/70"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!editing ? (
                      <>
                        <button
                          type="button"
                          disabled={gateBusy || !rationale.trim()}
                          title={!rationale.trim() ? "Enter a justification to approve" : undefined}
                          onClick={() => handleDecision("approve")}
                          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ✓ Approve
                        </button>
                        <button
                          type="button"
                          disabled={gateBusy}
                          onClick={() => {
                            setEditedDiff(proposeCell.proposed_diff || "");
                            setEditing(true);
                          }}
                          className="rounded-lg border border-slate-500/60 bg-slate-700/40 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-600/50 disabled:opacity-40"
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          disabled={gateBusy}
                          onClick={() => handleDecision("reject")}
                          className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-5 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
                        >
                          ✕ Reject
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={gateBusy || !rationale.trim()}
                          title={!rationale.trim() ? "Enter a justification to approve" : undefined}
                          onClick={() => handleDecision("edit")}
                          className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ✓ Approve edited diff
                        </button>
                        <button
                          type="button"
                          disabled={gateBusy}
                          onClick={() => setEditing(false)}
                          className="rounded-lg border border-slate-500/60 bg-slate-700/40 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-600/50 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {gateBusy && (
                      <span className="flex items-center gap-2 text-sm text-slate-400">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500/50 border-t-slate-200" />
                        Recording decision…
                      </span>
                    )}
                  </div>
                </div>
              )}

              {proposeCell.status === "approved" && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  ✓ Proposal approved and recorded. See the Record cell and ledger
                  below.
                </div>
              )}
              {proposeCell.status === "rejected" && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  ✕ Proposal rejected — nothing was applied. Re-run Propose to draft
                  a different change.
                </div>
              )}
            </div>
          ) : (
            <Placeholder text="Run to draft the minimal change as a reviewable diff (nothing is applied yet)." />
          )}
        </Cell>

        {/* 5 — RECORD */}
        <Cell
          index={5}
          title="Record"
          subtitle="Write the approved step to the tamper-evident ledger"
          status={status("record")}
          disabled
          error={errors.record}
        >
          {recordEntry ? (
            <div className="animate-fade-in space-y-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-200">
                  <span>⛓</span> Ledger entry #{recordEntry.index} appended
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  <Field label="Decision" value={recordEntry.decision} mono />
                  <Field label="Approver" value={recordEntry.approver} mono />
                  <Field
                    label="Programs"
                    value={(recordEntry.programs || []).join(", ")}
                    mono
                  />
                  <Field label="Timestamp" value={recordEntry.timestamp} mono />
                  <Field
                    label="Diff hash"
                    value={recordEntry.diff_hash}
                    mono
                    truncate
                  />
                  <Field
                    label="Entry hash"
                    value={recordEntry.entry_hash}
                    mono
                    truncate
                  />
                </dl>
                {recordEntry.rationale && (
                  <div className="mt-3 border-t border-emerald-500/20 pt-3">
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-emerald-200/70">
                      Justification (hash-chained)
                    </div>
                    <p className="text-[13px] italic leading-relaxed text-slate-300">
                      “{recordEntry.rationale}”
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Placeholder text="Approve a proposal to record it here. This cell writes only on approval." />
          )}
        </Cell>

        {/* Ledger panel */}
        <LedgerPanel
          sessionId={sessionId}
          entries={ledger.entries}
          onRefresh={(led) => setLedger(led)}
        />
      </div>

      <footer className="mt-10 text-center text-xs text-slate-600">
        Legacy Move · read-only cells run freely · the state-changing step is gated
        behind explicit human approval · every approved change is provable.
      </footer>

      <SourceView name={sourceOpen} onClose={() => setSourceOpen(null)} />
    </div>
  );
}

function Placeholder({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700/60 bg-ink-950/30 px-4 py-8 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function Field({ label, value, mono, truncate }) {
  return (
    <div className={truncate ? "min-w-0" : ""}>
      <dt className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd
        className={`text-slate-300 ${mono ? "font-mono text-[12.5px]" : ""} ${
          truncate ? "truncate" : ""
        }`}
        title={truncate ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
