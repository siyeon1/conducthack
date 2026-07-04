import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/language";
import { cobol } from "@codemirror/legacy-modes/mode/cobol";
import { unifiedMergeView } from "@codemirror/merge";
import { EditorView, Decoration, ViewPlugin } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { createTwoFilesPatch } from "diff";
import { getSource } from "../api.js";
import AffectedList from "./AffectedList.jsx";
import GraphView from "./GraphView.jsx";
import { VerifiedBadge } from "./Badge.jsx";

// Level-2, code-editor view: a collapsible analysis rail (Locate/Explain/Impact) on the left, and a
// CodeMirror pane on the right. When the AI drafts a change, it's applied INTO the source and shown
// as an inline merge — accept/reject the AI's hunk in the gutter, or edit the code yourself — then
// Accept & record (attested; a human edit is recorded as its own diff via jsdiff) or Deny.
const cobolLang = StreamLanguage.define(cobol);

// "Culprit" highlighting — mark source lines that reference the data fields this change is about
// (the router's seed field names). Deterministic (parse the source), grounded in the analysis.
// shft danger tint, tuned for the light editor theme.
const culpritTheme = EditorView.baseTheme({
  ".cm-culprit-line": {
    backgroundColor: "rgba(217, 58, 86, 0.08)",
    boxShadow: "inset 3px 0 0 rgba(217, 58, 86, 0.65)",
  },
});

function buildCulpritDeco(view, tokens) {
  const builder = new RangeSetBuilder();
  const deco = Decoration.line({ class: "cm-culprit-line" });
  const doc = view.state.doc;
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const up = line.text.toUpperCase();
    if (tokens.some((t) => up.includes(t))) builder.add(line.from, line.from, deco);
  }
  return builder.finish();
}

function culpritExtension(tokens) {
  return [
    culpritTheme,
    ViewPlugin.fromClass(
      class {
        constructor(view) {
          this.decorations = buildCulpritDeco(view, tokens);
        }
        update(u) {
          if (u.docChanged) this.decorations = buildCulpritDeco(u.view, tokens);
        }
      },
      { decorations: (v) => v.decorations }
    ),
  ];
}

const DOT = {
  pending: "bg-ink-mute",
  running: "bg-brand-400 animate-pulse",
  done: "bg-verified",
  error: "bg-danger",
  awaiting_approval: "bg-coral-400 animate-pulse",
  approved: "bg-verified",
  rejected: "bg-danger",
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
    <div className="rounded-xl border border-line bg-paper-light">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="flex h-5 w-5 items-center justify-center rounded bg-paper-dark text-[11px] text-ink-soft">{n}</span>
        <span className="flex-1 text-sm font-semibold text-ink">{title}</span>
        {canRun && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            className="rounded-md border border-line px-2 py-0.5 text-[11px] text-ink-soft transition hover:bg-paper-dark"
          >
            {running ? "…" : statusValue === "done" ? "Re-run" : "Run"}
          </span>
        )}
        <span className={`text-[11px] text-ink-mute transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </button>
      {open && <div className="border-t border-line px-3 py-3">{children}</div>}
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
  const [showCulprits, setShowCulprits] = useState(true);

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

  // Culprit tokens = distinctive concept words from the router's seed field names. We use the WORDS
  // (OVERDRAFT, DORMANT, …), not the full field name, because programs reference fields via
  // abbreviated host variables (HV-ACCOUNT-OVERDRAFT-LIM) — the concept word survives, the full name
  // does not. Ubiquitous words are dropped so the highlight stays meaningful.
  const culpritTokens = useMemo(() => {
    const seeds = (state && state.seed_symbols) || [];
    const stop = new Set(["ACCOUNT", "RECORD", "FIELD", "VALUE", "STATUS", "AMOUNT", "NUMBER", "TRANSACTION"]);
    // Don't highlight program names (they're not data-field culprits).
    const progs = new Set([...(node.edit_sites || []), fileProgram].map((p) => String(p).toUpperCase()));
    const ok = (w) => w.length >= 6 && !stop.has(w) && !progs.has(w);
    const toks = new Set();
    for (const s of seeds) {
      const up = String(s).toUpperCase().trim();
      if (up.includes(" ") || progs.has(up)) continue; // skip business phrases + program names
      if (up.includes("-")) {
        toks.add(up); // the full field name (matches in copybooks)
        for (const w of up.split("-")) if (ok(w)) toks.add(w);
      } else if (ok(up)) {
        toks.add(up);
      }
    }
    return Array.from(toks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state && state.seed_symbols ? state.seed_symbols.join("|") : "", fileProgram]);

  const culpritExt = useMemo(
    () => (showCulprits && culpritTokens.length ? culpritExtension(culpritTokens) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showCulprits, culpritTokens.join("|")]
  );

  const baseExt = useMemo(() => [cobolLang, ...culpritExt], [culpritExt]);

  const mergeExtensions = useMemo(
    () => (built ? [...baseExt, unifiedMergeView({ original: built.original })] : baseExt),
    [built, baseExt]
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
                  <button type="button" onClick={() => onOpenSource(p.program)} className="font-mono font-semibold text-ink-soft hover:text-brand-500">
                    {p.program}
                  </button>
                  <VerifiedBadge verified={p.verified} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-mute">Run to locate affected programs & copybooks.</p>
          )}
        </Step>

        <Step n={2} title="Explain" statusValue={status("explain")} running={running.explain} canRun onRun={() => handleRun("explain", selectedProgram)} open={open === "explain"} onToggle={() => toggle("explain")}>
          <select
            value={selectedProgram}
            onChange={(e) => setSelectedProgram(e.target.value)}
            className="mb-2 w-full rounded-md border border-line bg-white px-2 py-1 text-xs text-ink outline-none focus:border-brand-400"
          >
            {programOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {explain.payload && explain.payload.plain_english ? (
            <p className="line-clamp-[8] text-[13px] leading-relaxed text-ink-soft">{explain.payload.plain_english}</p>
          ) : (
            <p className="text-xs text-ink-mute">Pick a program and run for a plain-English walkthrough.</p>
          )}
        </Step>

        <Step n={3} title="Impact" statusValue={status("impact")} running={running.impact} canRun onRun={() => handleRun("impact")} open={open === "impact"} onToggle={() => toggle("impact")}>
          {impact.payload && impact.payload.affected ? (
            <>
              <p className="mb-2 text-xs text-ink-mute">
                Blast radius: {(state && state.graph && state.graph.nodes && state.graph.nodes.length) || 0} nodes ·{" "}
                {(state && state.graph && state.graph.edges && state.graph.edges.length) || 0} edges
              </p>
              {state && state.graph && state.graph.nodes && state.graph.nodes.length > 0 && (
                <div className="mb-2">
                  <GraphView
                    graph={state.graph}
                    highlight={node.edit_sites || []}
                    onNodeClick={(n) => onOpenSource(n)}
                  />
                  <p className="mt-1 text-[10px] text-ink-mute">
                    scroll → · click a node to read its source · full size in the Notebook view
                  </p>
                </div>
              )}
              <AffectedList affected={impact.payload.affected} />
            </>
          ) : (
            <p className="text-xs text-ink-mute">Run to map the blast radius.</p>
          )}
        </Step>

        <Step n={4} title="Propose" statusValue={status("propose")} running={running.propose} canRun onRun={() => handleRun("propose")} open={open === "propose"} onToggle={() => toggle("propose")}>
          {proposeCell.status === "approved" ? (
            <p className="text-[13px] text-verified">✓ Accepted and recorded.</p>
          ) : proposeCell.status === "rejected" ? (
            <p className="text-[13px] text-danger">✕ Denied — nothing was applied. Re-run to draft a different change.</p>
          ) : gateOpen ? (
            <>
              {proposeCell.payload && proposeCell.payload.explanation && (
                <p className="mb-2 line-clamp-4 text-[13px] leading-relaxed text-ink-soft">
                  {proposeCell.payload.explanation}
                </p>
              )}
              <p className="text-[13px] text-magenta-700">
                ✦ Suggestion drafted — <b>review it inline in the editor →</b> accept the hunk, edit the
                code, or deny. Recording requires a typed justification.
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-mute">
              Drafts the minimal change for this file — you review it in the editor pane before anything
              is recorded.
            </p>
          )}
        </Step>

        <Step n={5} title="Record" statusValue={status("record")} running={false} canRun={false} open={open === "record"} onToggle={() => toggle("record")}>
          {recordEntry ? (
            <div className="space-y-1.5 text-[13px]">
              <div className="flex items-center gap-2 font-semibold text-verified">
                <span>⛓</span> Recorded — tamper-evident
              </div>
              <div className="text-ink-soft">
                Decision: <span className="font-mono text-ink">{recordEntry.decision}</span> · Approver:{" "}
                <span className="font-mono text-ink">{recordEntry.approver}</span>
              </div>
              <div className="truncate font-mono text-[11px] text-ink-mute" title={recordEntry.entry_hash}>
                entry {String(recordEntry.entry_hash).slice(0, 18)}…
              </div>
              {recordEntry.rationale && <p className="italic text-ink-soft">“{recordEntry.rationale}”</p>}
            </div>
          ) : (
            <p className="text-xs text-ink-mute">
              Writes the approved change to the tamper-evident ledger. Writes only on approval.
            </p>
          )}
        </Step>

      </aside>

      {/* RIGHT — code editor */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <header className="flex items-center gap-2 border-b border-line bg-paper px-4 py-2.5">
          <span>📄</span>
          <span className="font-mono text-sm font-semibold text-ink">{fileLabel}</span>
          {src && <span className="font-mono text-[11px] text-ink-mute">{src.n_lines} lines</span>}
          {built && !approvedDone && (
            <span className="rounded-full border border-inferred/30 bg-inferred-tint px-2 py-0.5 text-[11px] font-medium text-[#8a6410]">
              ✦ AI suggestion — review inline
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {culpritTokens.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCulprits((v) => !v)}
                title={`Highlight lines referencing: ${culpritTokens.join(", ")}`}
                className={`rounded-md border px-2 py-1 text-[11px] transition ${showCulprits ? "border-danger/50 bg-danger-tint text-[#b02138]" : "border-line text-ink-soft hover:bg-paper-dark"}`}
              >
                ⚠ Culprits
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenSource(fileProgram)}
              className="rounded-md border border-line px-2 py-1 text-[11px] text-ink-soft transition hover:bg-paper-dark"
            >
              View full file
            </button>
          </div>
        </header>

        <div className="h-[440px] overflow-hidden">
          {srcErr ? (
            <div className="p-4 text-sm text-danger">Could not load source for {fileProgram}.</div>
          ) : !src ? (
            <div className="p-4 text-sm text-ink-mute">Loading {fileProgram}…</div>
          ) : built && !approvedDone ? (
            // Inline merge: AI change applied into the file; accept/reject in the gutter or edit freely.
            <CodeMirror
              key={`merge:${fileProgram}:${(proposeCell.proposed_diff || "").length}`}
              value={built.modified}
              theme="light"
              height="440px"
              extensions={mergeExtensions}
              onChange={(val) => setEditorDoc(val)}
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }}
            />
          ) : (
            <CodeMirror
              key={`src:${fileProgram}:${proposeCell.status}`}
              value={approvedDone && built ? built.modified : src.text || ""}
              theme="light"
              height="440px"
              extensions={baseExt}
              editable={false}
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }}
            />
          )}
        </div>

        {showCulprits && culpritTokens.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-t border-line bg-danger-tint/40 px-4 py-1.5 text-[11px] text-[#b02138]">
            <span>⚠ Culprit lines reference</span>
            {culpritTokens.map((t) => (
              <code key={t} className="rounded bg-danger-tint px-1 font-mono text-[#b02138]">
                {t}
              </code>
            ))}
            <span>— the fields this change concerns.</span>
          </div>
        )}

        {/* AI suggestion action / attested gate */}
        <footer className="border-t border-line bg-paper px-4 py-3">
          {!hasSuggestion ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={running.propose}
                onClick={() => handleRun("propose")}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700 disabled:opacity-40"
              >
                {running.propose ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Drafting…
                  </>
                ) : (
                  <>✦ Generate AI suggestion</>
                )}
              </button>
              <span className="text-xs text-ink-mute">Drafts the minimal change for this file — you review it before anything is recorded.</span>
            </div>
          ) : approvedDone ? (
            <div className="rounded-lg border border-verified/40 bg-verified-tint px-3 py-2 text-sm text-verified">
              ✓ Accepted and recorded to the tamper-evident ledger.
            </div>
          ) : (
            <div className="space-y-3">
              {proposeCell.payload && proposeCell.payload.explanation && (
                <p className="text-[13px] leading-relaxed text-ink-soft">{proposeCell.payload.explanation}</p>
              )}
              {built && built.region && (
                <p className="text-[11px] text-[#8a6410]">
                  Showing the changed region (couldn't anchor it in the file) — accept/edit works the same.
                </p>
              )}
              <div className="rounded-xl border border-coral-400/40 bg-coral-tint p-3">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-magenta-700">
                  Justification <span className="text-danger">*</span> — hash-chained into the ledger
                </label>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="Why is this change correct and safe to apply?"
                  className="mb-2 h-16 w-full resize-y rounded-lg border border-coral-400/30 bg-white p-2 text-[13px] leading-relaxed text-ink outline-none placeholder:text-ink-mute focus:border-coral-400"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={gateBusy || !rationale.trim()}
                    onClick={acceptRecord}
                    className="rounded-lg bg-verified px-4 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ✓ Accept &amp; record
                  </button>
                  <button
                    type="button"
                    disabled={gateBusy}
                    onClick={() => handleDecision("reject")}
                    className="rounded-lg border border-danger/50 bg-danger-tint px-4 py-1.5 text-sm font-semibold text-[#b02138] transition hover:brightness-95 disabled:opacity-40"
                  >
                    ✕ Deny
                  </button>
                  <span className="text-[11px] text-ink-mute">Edit the code above, or accept the AI hunk in the gutter, then record.</span>
                </div>
                {note && <p className="mt-2 text-[12px] text-[#8a6410]">{note}</p>}
              </div>
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}
