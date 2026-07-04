// Programme-level audit trail — aggregates the per-sub-change ledger entries recorded across the
// whole change programme. Each entry is hash-chained and carries the engineer's typed justification,
// so the decomposition + these entries together are the "documented, meaningful human oversight"
// audit trail that regulated change (EU AI Act Art. 14 / NIST RMF) requires.
const short = (h) => (h ? `${String(h).slice(0, 10)}…` : "—");

// One-click "Senior Manager evidence pack": the full programme audit trail as JSON —
// stage, decision, verbatim rationale, programs, and the complete hash-chain fields —
// the artifact an SM&CR-accountable individual holds up as their "reasonable steps" file.
function exportEvidencePack(title, entries) {
  const pack = {
    kind: "legacy-move-evidence-pack",
    programme: title || "",
    exported_at: new Date().toISOString(),
    note: "Each entry is hash-chained (RFC-8785 canonical JSON, SHA-256). Recompute canonical_entry_hash over the hashed fields to verify; any alteration breaks the chain.",
    sub_changes: entries.map(({ nodeId, label, entry }) => ({ stage_id: nodeId, stage: label, entry })),
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "legacy-move-evidence-pack.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ProgrammeLedger({ entries = [], title = "" }) {
  if (!entries.length) return null;
  return (
    <section className="mt-5 rounded-2xl border border-slate-700/60 bg-ink-900/60 shadow-xl shadow-black/20">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700/50 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">⛓</span>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-100">Change programme audit trail</h2>
          <p className="text-xs text-slate-400">
            Every approved sub-change is hash-chained and carries the engineer's justification —
            documented, meaningful human oversight, not a rubber stamp.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
          {entries.length} sub-change{entries.length === 1 ? "" : "s"} recorded
        </span>
        <button
          type="button"
          onClick={() => exportEvidencePack(title, entries)}
          title="Download the full programme audit trail — named approvers, verbatim justifications, hash chain — as a verifiable JSON evidence pack"
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
        >
          ⬇ Senior Manager evidence pack
        </button>
      </header>
      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-2 py-2 font-medium">Stage</th>
              <th className="px-2 py-2 font-medium">Decision</th>
              <th className="px-2 py-2 font-medium">Justification</th>
              <th className="px-2 py-2 font-medium">Programs</th>
              <th className="px-2 py-2 font-medium">Entry hash</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(({ nodeId, label, entry }, i) => (
              <tr key={nodeId || i} className="border-t border-slate-700/40 align-top">
                <td className="max-w-[190px] px-2 py-2.5 font-medium text-slate-200">{label}</td>
                <td className="px-2 py-2.5">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                    {entry.decision}
                  </span>
                </td>
                <td className="max-w-[260px] px-2 py-2.5 text-[12px] italic text-slate-400">
                  {entry.rationale ? `“${entry.rationale}”` : <span className="not-italic text-slate-600">—</span>}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {(entry.programs || []).map((p) => (
                      <span key={p} className="rounded bg-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-2.5 font-mono text-[11px] text-slate-400" title={entry.entry_hash}>
                  {short(entry.entry_hash)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
