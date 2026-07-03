import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { cobol } from "@codemirror/legacy-modes/mode/cobol";
import { unifiedMergeView } from "@codemirror/merge";
import { createTwoFilesPatch } from "diff";
import { getSource } from "../api.js";
import AffectedList from "./AffectedList.jsx";
import { VerifiedBadge } from "./Badge.jsx";

// Level-2, code-editor view: a collapsible analysis rail (Locate/Explain/Impact) on the left, and a
// CodeMirror pane on the right. When the AI drafts a change, it's applied INTO the source and shown
// as an inline merge — accept/reject the AI's hunk in the gutter, or edit the code yourself — then
// Accept & record (attested; a human edit is recorded as its own diff via jsdiff) or Deny.
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

// Split the first hunk of a unified diff into its old block (context+removed) and new block
// (context+added), preserving each line verbatim (leading columns matter in COBOL).
function splitDiffBlocks(diff) {
  const dl = String(diff || "").split("\n");
  const h = dl.findIndex((l) => l.startsWith("@@"));
  if (h < 0) return null;
  const oldB = [];
  const newB = [];
  for (let i = h + 1; i < dl.length; i++) {
    const l = dl[i];
    if (l.startsWith("@@")) break;
    if (l.startsWith("+++") || l.startsWith("---")) continue;
    const c = l[0];
    const body = l.slice(1);
    if (c === "+") newB.push(body);
    else if (c === "-") oldB.push(body);
    else {
      // context (leading space) or a stray blank line
      oldB.push(body);
      newB.push(body);
    }
  }
  return { oldBlock: oldB, newBlock: newB };
}

// Find where `block` occurs consecutively in `lines` (trim-compared, tolerant of column shifts).
function findBlock(lines, block) {
  if (!block.length) return -1;
  for (let i = 0; i + block.length <= lines.length; i++) {
    let ok = true;
    for (let j = 0; j < block.length; j++) {
      if ((lines[i + j] || "").trim() !== (block[j] || "").trim()) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

// Apply the diff into the full source → the modified file, or null if it can't be placed confidently.
function buildModified(sourceText, diff) {
  const blocks = splitDiffBlocks(diff);
  if (!blocks || !blocks.oldBlock.length) return null;
  const src = sourceText.split("\n");
  const idx = findBlock(src, blocks.oldBlock);
  if (idx < 0) return null;
  return [...src.slice(0, idx), ...blocks.newBlock, ...src.slice(idx + blocks.oldBlock.length)].join("\n");
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
    gateBusy,
    rationale,
    setRationale,
    handleDecision,
    recordEntry,
  } = ctx;

  const [open, setOpen] = useState("locate");
  const [src, setSrc] = useState(null);
  const [srcErr, setSrcErr] = useState(null);
  const [editorDoc, setEditorDoc] = useState(null);
  const [note, setNote] = useState(null);

  const fileProgram =
    programFromDiff(proposeCell.proposed_diff) || (node.edit_sites && node.edit_sites[0]) || selectedProgram || "XFRFUN";
  const fileLabel = (src && src.file) || fileProgram;

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

  // Build the AI-modified file (or the changed region as a fallback) for the merge view.
  const built = useMemo(() => {
    if (!src || !proposeCell.proposed_diff) return null;
    const full = buildModified(src.text || "", proposeCell.proposed_diff);
    if (full != null) return { original: src.text || "", modified: full, region: false };
    const b = splitDiffBlocks(proposeCell.proposed_diff);
    if (b) return { original: b.oldBlock.join("\n"), modified: b.newBlock.join("\n"), region: true };
    return null;
  }, [src, proposeCell.proposed_diff]);

  useEffect(() => {
    setEditorDoc(built ? built.modified : null);
    setNote(null);
  }, [built]);

  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const locate = cell("locate");
  const explain = cell("explain");
  const impact = cell("impact");

  const hasSuggestion = !!proposeCell.proposed_diff || proposeCell.status === "approved";
  const approvedDone = proposeCell.status === "approved";

  const mergeExtensions = useMemo(
    () => (built ? [cobolLang, unifiedMergeView({ original: built.original })] : [cobolLang]),
    [built]
  );

  function acceptRecord() {
    if (!built) return;
    const finalDoc = editorDoc != null ? editorDoc : built.modified;
    if (finalDoc === built.original) {
      setNote("Nothing to record — the change was reverted. Edit the code, or Deny.");
      return;
    }
    if (finalDoc === built.modified) {
      handleDecision("approve"); // accepted the AI's suggestion as-is → records the AI diff
      return;
    }
    // The human edited the code → record THEIR diff (original → their content).
    const patch = createTwoFilesPatch(fileLabel, fileLabel, built.original + "\n", finalDoc + "\n", "", "");
    handleDecision("edit", patch);
  }

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
          <span className="font-mono text-sm font-semibold text-slate-100">{fileLabel}</span>
          {src && <span className="font-mono text-[11px] text-slate-500">{src.n_lines} lines</span>}
          {built && !approvedDone && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
              ✦ AI suggestion — review inline
            </span>
          )}
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
          ) : built && !approvedDone ? (
            // Inline merge: AI change applied into the file; accept/reject in the gutter or edit freely.
            <CodeMirror
              key={`merge:${fileProgram}:${(proposeCell.proposed_diff || "").length}`}
              value={built.modified}
              theme="dark"
              height="440px"
              extensions={mergeExtensions}
              onChange={(val) => setEditorDoc(val)}
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }}
            />
          ) : (
            <CodeMirror
              key={`src:${fileProgram}:${proposeCell.status}`}
              value={approvedDone && built ? built.modified : src.text || ""}
              theme="dark"
              height="440px"
              extensions={[cobolLang]}
              editable={false}
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }}
            />
          )}
        </div>

        {/* AI suggestion action / attested gate */}
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
          ) : approvedDone ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              ✓ Accepted and recorded to the tamper-evident ledger.
            </div>
          ) : (
            <div className="space-y-3">
              {proposeCell.payload && proposeCell.payload.explanation && (
                <p className="text-[13px] leading-relaxed text-slate-400">{proposeCell.payload.explanation}</p>
              )}
              {built && built.region && (
                <p className="text-[11px] text-amber-300/80">
                  Showing the changed region (couldn't anchor it in the file) — accept/edit works the same.
                </p>
              )}
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={gateBusy || !rationale.trim()}
                    onClick={acceptRecord}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ✓ Accept &amp; record
                  </button>
                  <button
                    type="button"
                    disabled={gateBusy}
                    onClick={() => handleDecision("reject")}
                    className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-1.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
                  >
                    ✕ Deny
                  </button>
                  <span className="text-[11px] text-slate-500">Edit the code above, or accept the AI hunk in the gutter, then record.</span>
                </div>
                {note && <p className="mt-2 text-[12px] text-amber-300">{note}</p>}
              </div>
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}
