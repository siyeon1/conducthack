import { useEffect, useMemo, useState } from "react";
import Cell from "./Cell.jsx";
import { VerifiedBadge } from "./Badge.jsx";
import DiffView from "./DiffView.jsx";
import GraphView from "./GraphView.jsx";
import LedgerPanel from "./LedgerPanel.jsx";
import SourceView from "./SourceView.jsx";
import AffectedList from "./AffectedList.jsx";
import CodeCockpit from "./CodeCockpit.jsx";
import { USE_MOCK, createSession, runCell, approveCell, getLedger } from "../api.js";

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
          <strong key={`${keyBase}-b${i}`} className="font-semibold text-ink">
            {m[1]}
          </strong>
        );
      else
        out.push(
          <em key={`${keyBase}-i${i}`} className="text-ink not-italic underline decoration-line underline-offset-2">
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

// Level-2 — the Stage cockpit. The 5-cell flow (Locate → Explain → Impact → Propose → Record)
// scoped to a single sub-change from the Level-1 DAG. Manages its own session; reports derived
// status up so the Level-1 node lights as work progresses. Mounted keyed by node id (fresh per node).
export default function StageCockpit({ node, onBack, onStatusChange, onRecorded }) {
  const [sessionId, setSessionId] = useState(null);
  const [state, setState] = useState(null);
  const [running, setRunning] = useState({}); // cell -> bool
  const [errors, setErrors] = useState({}); // cell -> {error, detail}
  const [selectedProgram, setSelectedProgram] = useState(
    (node.edit_sites && node.edit_sites[0]) || "XFRFUN"
  );
  const [sourceOpen, setSourceOpen] = useState(null); // program/copybook to view, or null
  const [view, setView] = useState("code"); // "notebook" | "code" — Level-2 view mode

  // Propose gate local UI
  const [editing, setEditing] = useState(false);
  const [editedDiff, setEditedDiff] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [rationale, setRationale] = useState(""); // required justification, hashed into the ledger

  // Ledger
  const [ledger, setLedger] = useState({ entries: [], verified: true });

  const cell = (name) => (state && state.cells && state.cells[name]) || EMPTY_CELL;

  // Create a session scoped to THIS node's sub-change on mount (component is keyed by node id).
  useEffect(() => {
    handleNewSession(node.change_request);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewSession(cr) {
    setErrors({});
    setRunning({});
    setEditing(false);
    setLedger({ entries: [], verified: true });
    try {
      const { session_id, state: st } = await createSession(cr ?? node.change_request);
      setSessionId(session_id);
      setState(st);
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

  async function handleDecision(decision, overrideDiff) {
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
      const diffForEdit = overrideDiff != null ? overrideDiff : editedDiff;
      const { state: st } = await approveCell(
        sessionId,
        decision,
        decision === "edit" ? diffForEdit : undefined,
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

  const status = (name) => (running[name] ? "running" : cell(name).status || "pending");

  // Explain program options from the locate result (fallback to this node's edit sites).
  const programOptions = useMemo(() => {
    const progs = cell("locate").payload && cell("locate").payload.programs;
    const names =
      progs && progs.length
        ? progs.map((p) => p.program)
        : (node.edit_sites && node.edit_sites.length ? node.edit_sites : ["XFRFUN", "DBCRFUN"]);
    return Array.from(new Set(names));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const proposeCell = cell("propose");
  const gateOpen = proposeCell.status === "awaiting_approval";
  const recordEntry = cell("record").payload && cell("record").payload.ledger_entry;
  const metrics = (state && state.metrics) || {};
  const hasMetrics = metrics && Object.keys(metrics).length > 0;

  // Derive this node's Level-1 status and lift it up whenever it changes.
  const anyStarted =
    state && state.cells && Object.values(state.cells).some((c) => c && c.status && c.status !== "pending");
  const derivedStatus = recordEntry
    ? "done"
    : gateOpen
    ? "awaiting_approval"
    : anyStarted
    ? "in_progress"
    : "pending";
  useEffect(() => {
    if (onStatusChange) onStatusChange(derivedStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedStatus]);

  // Lift the recorded, hash-chained ledger entry up to the programme-level audit trail.
  useEffect(() => {
    if (recordEntry && onRecorded) onRecorded(recordEntry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordEntry && recordEntry.entry_hash]);

  const codeCtx = {
    node,
    state,
    cell,
    status,
    running,
    errors,
    handleRun,
    selectedProgram,
    setSelectedProgram,
    programOptions,
    proposeCell,
    gateOpen,
    editing,
    setEditing,
    editedDiff,
    setEditedDiff,
    gateBusy,
    rationale,
    setRationale,
    handleDecision,
    recordEntry,
  };

  return (
    <div className={`mx-auto min-h-full px-4 pb-20 pt-6 sm:px-6 ${view === "code" ? "max-w-[1400px]" : "max-w-5xl"}`}>
      {/* ---------------- Scoped stage header ---------------- */}
      <header className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-paper-light px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-paper-dark"
          >
            ← Back to programme
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-line bg-paper p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setView("code")}
                className={`rounded-md px-2.5 py-1 transition ${view === "code" ? "bg-paper-dark text-ink" : "text-ink-soft hover:text-ink"}`}
              >
                ⌨ Code editor
              </button>
              <button
                type="button"
                onClick={() => setView("notebook")}
                className={`rounded-md px-2.5 py-1 transition ${view === "notebook" ? "bg-paper-dark text-ink" : "text-ink-soft hover:text-ink"}`}
              >
                Notebook
              </button>
            </div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-verified/30 bg-verified-tint px-2.5 py-1 text-[11px] font-medium text-verified"
              title="Parsing, the dependency graph, and the ledger run locally. Explain/Propose send code snippets to the Claude API (in-VPC / zero-retention deployment is a config choice, not a code change)."
            >
              <span className="h-1.5 w-1.5 rounded-full bg-verified" />
              Proposal-only — nothing is ever applied automatically
            </span>
            {USE_MOCK && (
              <span className="rounded-full border border-line bg-paper-dark px-2.5 py-1 text-[11px] font-medium text-ink-mute">
                mock data
              </span>
            )}
          </div>
        </div>

        {/* Scoped sub-change context */}
        <div className="rounded-2xl border border-line bg-paper-light p-4 shadow-card">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-brand-700">
            <span>◆ Sub-change</span>
            {node.edit_sites && node.edit_sites.length > 0 && (
              <span className="font-mono text-ink-mute">{node.edit_sites.join(" · ")}</span>
            )}
          </div>
          <h1 className="text-lg font-bold tracking-tight text-ink">{node.label}</h1>
          <p className="mt-1 text-sm text-ink-soft">{node.change_request}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-mute">
            <span>
              Session: <span className="font-mono text-ink-soft">{sessionId || "—"}</span>
            </span>
            {state && state.intent && (
              <span>
                Intent:{" "}
                <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-brand-700">
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
                    className="rounded bg-paper-dark px-1.5 py-0.5 font-mono text-[11px] text-ink-soft"
                  >
                    {s}
                  </span>
                ))}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleNewSession(node.change_request)}
              className="ml-auto rounded-md border border-line px-2 py-0.5 text-ink-soft transition hover:bg-paper-dark hover:text-ink"
            >
              ↻ Re-run stage
            </button>
          </div>
          {errors.session && (
            <div className="mt-2 rounded-lg border border-danger/40 bg-danger-tint px-3 py-2 text-sm text-[#b02138]">
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
                metrics.wall_clock_seconds != null ? `${metrics.wall_clock_seconds}s` : undefined,
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-line bg-paper-light px-3 py-2 text-center"
              >
                <div className="text-lg font-bold text-ink">{value != null ? value : "—"}</div>
                <div className="text-[10px] uppercase tracking-wider text-ink-mute">{label}</div>
              </div>
            ))}
          </div>
        )}
      </header>

      {view === "code" && <CodeCockpit ctx={codeCtx} onOpenSource={setSourceOpen} />}

      {view === "notebook" && (
      <>
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
                  <div className="flex items-start gap-2 rounded-lg border border-verified/30 bg-verified-tint px-3 py-2 text-[13px] text-verified">
                    <span className="text-base leading-none">✓</span>
                    <span>
                      <span className="font-semibold">
                        {g} of {progs.length}
                      </span>{" "}
                      grounded in the field index —
                      <span className="text-verified">
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
                    className="animate-fade-in rounded-lg border border-line bg-paper p-3"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-ink">
                        {p.program}
                      </span>
                      <VerifiedBadge verified={p.verified} />
                      <span className="ml-auto font-mono text-[11px] text-ink-mute">{p.file}</span>
                    </div>
                    <p className="text-sm text-ink-soft">{p.reason}</p>
                  </li>
                ))}
              </ul>

              {cell("locate").citations && cell("locate").citations.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-mute">
                    Source citations
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {cell("locate").citations.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1 font-mono text-[11px] text-ink-soft"
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
              className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
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
              <div className="rounded-lg border border-line bg-paper p-4 text-sm leading-relaxed text-ink-soft">
                <RichText text={cell("explain").payload.plain_english} />
              </div>

              {cell("explain").payload.cobol_idioms &&
                cell("explain").payload.cobol_idioms.length > 0 && (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">
                      <span className="text-brand-500">◆</span> COBOL idioms in play
                    </h4>
                    <div className="space-y-2.5">
                      {cell("explain").payload.cobol_idioms.map((idi, i) => (
                        <div
                          key={i}
                          className="animate-fade-in grid gap-2 rounded-lg border border-brand-400/20 bg-brand-50 p-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
                        >
                          <div className="overflow-x-auto rounded-md border border-line bg-white p-2.5">
                            <code className="whitespace-pre font-mono text-[12.5px] text-ink">
                              {idi.snippet}
                            </code>
                          </div>
                          <p className="text-sm text-ink-soft">{idi.explanation}</p>
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
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">
                  Blast-radius dependency graph
                </h4>
                <GraphView
                  graph={state && state.graph}
                  highlight={node.edit_sites || ["XFRFUN", "DBCRFUN"]}
                  onNodeClick={(name) => setSourceOpen(name)}
                />
                <p className="mt-2 text-[11px] text-ink-mute">Click any node to read its source.</p>
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
                <div className="rounded-lg border border-line bg-paper p-3.5 text-sm leading-relaxed text-ink-soft">
                  <RichText text={proposeCell.payload.explanation} />
                </div>
              )}

              {editing ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-soft">
                    Edit the diff before approving
                  </label>
                  <textarea
                    value={editedDiff}
                    onChange={(e) => setEditedDiff(e.target.value)}
                    spellCheck={false}
                    className="h-64 w-full resize-y rounded-lg border border-line bg-white p-3 font-mono text-[12.5px] text-ink outline-none focus:border-brand-400"
                  />
                </div>
              ) : (
                <DiffView diff={proposeCell.proposed_diff} />
              )}

              {/* THE CONTROL SURFACE — hard human gate (Signal Coral) */}
              {gateOpen && (
                <div className="animate-fade-in rounded-xl border border-coral-400/40 bg-coral-tint p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-magenta-700">
                    <span className="text-lg">✋</span> Human approval required
                    <span className="ml-1 font-normal text-magenta-700/70">
                      — the agent will not apply or record this change on its own.
                    </span>
                  </div>

                  <div className="mb-3">
                    <label className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-magenta-700/80">
                      Justification <span className="text-danger">*</span>
                      <span className="font-normal normal-case tracking-normal text-magenta-700/50">
                        — recorded verbatim in the ledger and hash-chained with the diff
                      </span>
                    </label>
                    <textarea
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      placeholder="Why is this change correct and safe to apply? e.g. mirrors the existing MORTGAGE/LOAN guard; localized to the debit side; no copybook or interface change."
                      className="h-20 w-full resize-y rounded-lg border border-coral-400/30 bg-white p-2.5 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-mute focus:border-coral-400"
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
                          className="rounded-lg bg-verified px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
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
                          className="rounded-lg border border-line bg-paper-light px-5 py-2 text-sm font-semibold text-ink transition hover:bg-paper-dark disabled:opacity-40"
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          disabled={gateBusy}
                          onClick={() => handleDecision("reject")}
                          className="rounded-lg border border-danger/50 bg-danger-tint px-5 py-2 text-sm font-semibold text-[#b02138] transition hover:brightness-95 disabled:opacity-40"
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
                          className="rounded-lg bg-verified px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ✓ Approve edited diff
                        </button>
                        <button
                          type="button"
                          disabled={gateBusy}
                          onClick={() => setEditing(false)}
                          className="rounded-lg border border-line bg-paper-light px-5 py-2 text-sm font-semibold text-ink transition hover:bg-paper-dark disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {gateBusy && (
                      <span className="flex items-center gap-2 text-sm text-ink-soft">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-500" />
                        Recording decision…
                      </span>
                    )}
                  </div>
                </div>
              )}

              {proposeCell.status === "approved" && (
                <div className="rounded-lg border border-verified/40 bg-verified-tint px-4 py-3 text-sm text-verified">
                  ✓ Proposal approved and recorded. See the Record cell and ledger below.
                </div>
              )}
              {proposeCell.status === "rejected" && (
                <div className="rounded-lg border border-danger/40 bg-danger-tint px-4 py-3 text-sm text-[#b02138]">
                  ✕ Proposal rejected — nothing was applied. Re-run Propose to draft a different change.
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
              <div className="rounded-lg border border-verified/30 bg-verified-tint p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-verified">
                  <span>⛓</span> Ledger entry #{recordEntry.index} appended
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  <Field label="Decision" value={recordEntry.decision} mono />
                  <Field label="Approver" value={recordEntry.approver} mono />
                  <Field label="Programs" value={(recordEntry.programs || []).join(", ")} mono />
                  <Field label="Timestamp" value={recordEntry.timestamp} mono />
                  <Field label="Diff hash" value={recordEntry.diff_hash} mono truncate />
                  <Field label="Entry hash" value={recordEntry.entry_hash} mono truncate />
                </dl>
                {recordEntry.rationale && (
                  <div className="mt-3 border-t border-verified/20 pt-3">
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-verified">
                      Justification (hash-chained)
                    </div>
                    <p className="text-[13px] italic leading-relaxed text-ink-soft">
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
        <LedgerPanel sessionId={sessionId} entries={ledger.entries} onRefresh={(led) => setLedger(led)} />
      </div>

      <footer className="mt-10 text-center text-xs text-ink-mute">
        shft · read-only cells run freely · the state-changing step is gated behind explicit
        human approval · every approved change is provable.
      </footer>
      </>
      )}

      <SourceView name={sourceOpen} onClose={() => setSourceOpen(null)} />
    </div>
  );
}

function Placeholder({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-paper px-4 py-8 text-center text-sm text-ink-mute">
      {text}
    </div>
  );
}

function Field({ label, value, mono, truncate }) {
  return (
    <div className={truncate ? "min-w-0" : ""}>
      <dt className="text-[11px] uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd
        className={`text-ink-soft ${mono ? "font-mono text-[12.5px]" : ""} ${truncate ? "truncate" : ""}`}
        title={truncate ? value : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
