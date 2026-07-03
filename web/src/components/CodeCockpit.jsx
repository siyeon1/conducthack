import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { cobol } from "@codemirror/legacy-modes/mode/cobol";
import { getSource } from "../api.js";
import DiffView from "./DiffView.jsx";
import AffectedList from "./AffectedList.jsx";
import { VerifiedBadge } from "./Badge.jsx";

// Level-2, code-editor view: a collapsible analysis rail (Locate/Explain/Impact) on the left, and a
// CodeMirror source pane on the right where the AI's proposed change is reviewed and accepted /
// denied / edited (Stage B upgrades the review from a diff to an inline merge editor). Reuses the
// cockpit's session/cell/attested-approval logic via `ctx`.
const cobolLang = StreamLanguage.define(cobol);

const DOT = {
  pending: "bg-slate-500",
  running: "bg-sky-400 animate-pulse",
  done: "bg-emerald-400",
  error: "bg-rose-400",
  awaiting_approval: "bg-amber-400 animate-pulse",
};

function programFromDiff(diff) {
  if (!diff) return null;
  const m = /\+\+\+\s+b\/(\S+)/.exec(diff) || /---\s+a\/(\S+)/.exec(diff);
  if (!m) return null;
  return (m[1].split("/").pop() || "").replace(/\.(cbl|cob|cpy)$/i, "").toUpperCase() || null;
}

function Step({ n, title, statusValue, running, canRun, onRun, open, onToggle, children }) {
  const dot = running ? DOT.running : DOT[statusValue] || DOT.pending;
  return (
    <div className="rounded-xl border border-slate-700/60 bg-ink-900/50">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-700/50 text-[11px] text-slate-300">{n}</span>
        <span className="flex-1 text-sm font-semibold text-slate-100">{title}</span>
        {canRun && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            className="rounded-md border border-slate-600/60 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700/50"
          >
            {running ? "…" : statusValue === "done" ? "Re-run" : "Run"}
          </span>
        )}
        <span className={`text-[11px] text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </button>
      {open && <div className="border-t border-slate-700/50 px-3 py-3">{children}</div>}
    </div>
  );
}

export default function CodeCockpit({ ctx, onOpenSource }) {
  const {
    node,
    state,
    cell,
    status,
    running,
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
  } = ctx;

  const [open, setOpen] = useState("locate");
  const [src, setSrc] = useState(null);
  const [srcErr, setSrcErr] = useState(null);

  const fileProgram =
    programFromDiff(proposeCell.proposed_diff) || (node.edit_sites && node.edit_sites[0]) || selectedProgram || "XFRFUN";

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setSrcErr(null);
    getSource(fileProgram)
      .then((s) => alive && setSrc(s))
      .catch((e) => alive && setSrcErr(e));
    return () => {
      alive = false;
    };
  }, [fileProgram]);

  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const locate = cell("locate");
  const explain = cell("explain");
  const impact = cell("impact");
  const hasSuggestion = proposeCell.proposed_diff || proposeCell.status === "approved";

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* LEFT — analysis rail */}
      <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-[360px]">
        <Step n={1} title="Locate" statusValue={status("locate")} running={running.locate} canRun onRun={() => handleRun("locate")} open={open === "locate"} onToggle={() => toggle("locate")}>
          {locate.payload && locate.payload.programs ? (
            <ul className="space-y-1.5">
              {locate.payload.programs.slice(0, 8).map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px]">
                  <button type="button" onClick={() => onOpenSource(p.program)} className="font-mono font-semibold text-slate-200 hover:text-indigo-300">
                    {p.program}
                  </button>
                  <VerifiedBadge verified={p.verified} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Run to locate affected programs & copybooks.</p>
          )}
        </Step>

        <Step n={2} title="Explain" statusValue={status("explain")} running={running.explain} canRun onRun={() => handleRun("explain", selectedProgram)} open={open === "explain"} onToggle={() => toggle("explain")}>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="mb-2 w-full rounded-md border border-slate-600/60 bg-ink-950/70 px-2 py-1 text-xs text-slate-200 outline-none focus:border-indigo-500/70"
          >
            {programOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {explain.payload && explain.payload.plain_english ? (
            <p className="line-clamp-[8] text-[13px] leading-relaxed text-slate-400">{explain.payload.plain_english}</p>
          ) : (
            <p className="text-xs text-slate-500">Pick a program and run for a plain-English walkthrough.</p>
          )}
        </Step>

        <Step n={3} title="Impact" statusValue={status("impact")} running={running.impact} canRun onRun={() => handleRun("impact")} open={open === "impact"} onToggle={() => toggle("impact")}>
          {impact.payload && impact.payload.affected ? (
            <>
              <p className="mb-2 text-xs text-slate-500">
                Blast radius: {(state && state.graph && state.graph.nodes && state.graph.nodes.length) || 0} nodes ·{" "}
                {(state && state.graph && state.graph.edges && state.graph.edges.length) || 0} edges
              </p>
              <AffectedList affected={impact.payload.affected} />
            </>
          ) : (
            <p className="text-xs text-slate-500">Run to map the blast radius.</p>
          )}
        </Step>

        {recordEntry && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2.5 text-[13px]">
            <div className="flex items-center gap-2 font-semibold text-emerald-200">
              <span>⛓</span> Recorded to the ledger
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-slate-400" title={recordEntry.entry_hash}>
              entry {String(recordEntry.entry_hash).slice(0, 18)}…
            </div>
          </div>
        )}
      </aside>

      {/* RIGHT — code editor */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-ink-950/60">
        <header className="flex items-center gap-2 border-b border-slate-700/50 bg-ink-900/70 px-4 py-2.5">
          <span>📄</span>
          <span className="font-mono text-sm font-semibold text-slate-100">{(src && src.file) || fileProgram}</span>
          {src && <span className="font-mono text-[11px] text-slate-500">{src.n_lines} lines</span>}
          <button
            type="button"
            onClick={() => onOpenSource(fileProgram)}
            className="ml-auto rounded-md border border-slate-600/60 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-700/50"
          >
            View full file
          </button>
        </header>

        <div className="h-[440px] overflow-hidden">
          {srcErr ? (
            <div className="p-4 text-sm text-rose-300">Could not load source for {fileProgram}.</div>
          ) : !src ? (
            <div className="p-4 text-sm text-slate-500">Loading {fileProgram}…</div>
          ) : (
            <CodeMirror
              value={src.text || ""}
              theme="dark"
              height="440px"
              extensions={[cobolLang]}
              editable={false}
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }}
            />
          )}
        </div>

        {/* AI suggestion + attested gate */}
        <footer className="border-t border-slate-700/50 bg-ink-900/70 px-4 py-3">
          {!hasSuggestion ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={running.propose}
                onClick={() => handleRun("propose")}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:opacity-40"
              >
                {running.propose ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Drafting…
                  </>
                ) : (
                  <>✦ Generate AI suggestion</>
                )}
              </button>
              <span className="text-xs text-slate-500">Drafts the minimal change for this file — you review it before anything is recorded.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {proposeCell.payload && proposeCell.payload.explanation && (
                <p className="text-[13px] leading-relaxed text-slate-400">{proposeCell.payload.explanation}</p>
              )}

              {editing ? (
                <textarea
                  value={editedDiff}
                  onChange={(e) => setEditedDiff(e.target.value)}
                  spellCheck={false}
                  className="h-52 w-full resize-y rounded-lg border border-slate-600/60 bg-ink-950/80 p-3 font-mono text-[12.5px] text-slate-200 outline-none focus:border-indigo-500/70"
                />
              ) : (
                <DiffView diff={proposeCell.proposed_diff} />
              )}

              {gateOpen && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-amber-200/80">
                    Justification <span className="text-rose-300">*</span> — hash-chained into the ledger
                  </label>
                  <textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Why is this change correct and safe to apply?"
                    className="mb-2 h-16 w-full resize-y rounded-lg border border-amber-500/30 bg-ink-950/70 p-2 text-[13px] leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/70"
                  />
                  <div className="flex flex-wrap gap-2">
                    {!editing ? (
                      <>
                        <button
                          type="button"
                          disabled={gateBusy || !rationale.trim()}
                          onClick={() => handleDecision("approve")}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ✓ Accept &amp; record
                        </button>
                        <button
                          type="button"
                          disabled={gateBusy}
                          onClick={() => {
                            setEditedDiff(proposeCell.proposed_diff || "");
                            setEditing(true);
                          }}
                          className="rounded-lg border border-slate-500/60 bg-slate-700/40 px-4 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-600/50 disabled:opacity-40"
                        >
                          ✎ Edit
                        </button>
                        <button
                          type="button"
                          disabled={gateBusy}
                          onClick={() => handleDecision("reject")}
                          className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-1.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
                        >
                          ✕ Deny
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={gateBusy || !rationale.trim()}
                          onClick={() => handleDecision("edit")}
                          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ✓ Accept edited &amp; record
                        </button>
                        <button
                          type="button"
                          disabled={gateBusy}
                          onClick={() => setEditing(false)}
                          className="rounded-lg border border-slate-500/60 bg-slate-700/40 px-4 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-600/50"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {proposeCell.status === "approved" && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  ✓ Accepted and recorded to the tamper-evident ledger.
                </div>
              )}
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}
