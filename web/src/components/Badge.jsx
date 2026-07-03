// Badge.jsx — small status/provenance chips shared across cells.

// Provenance badge: green "✓ verified" (parsed) vs amber "~ inferred" (LLM guess).
// This single honesty signal scores under both "technical execution" and "control".
export function VerifiedBadge({ verified }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
      <span aria-hidden>✓</span> verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
      <span aria-hidden>~</span> inferred
    </span>
  );
}

// Impact-cell provenance: is this narrated program actually a node in the deterministic
// blast-radius subgraph (L8), or did the LLM name something outside it? Renders nothing
// when the flag is absent (a backend that omits it degrades gracefully).
export function InGraphBadge({ inGraph }) {
  if (inGraph === undefined || inGraph === null) return null;
  return inGraph ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
      <span aria-hidden>✓</span> in graph
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
      title="Named by the model but not present in the deterministic dependency graph"
    >
      <span aria-hidden>~</span> narrated
    </span>
  );
}

const RISK_STYLES = {
  high: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  low: "border-slate-500/40 bg-slate-500/10 text-slate-300",
};

export function RiskBadge({ risk }) {
  const key = String(risk || "low").toLowerCase();
  const cls = RISK_STYLES[key] || RISK_STYLES.low;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {key} risk
    </span>
  );
}

const STATUS_STYLES = {
  pending: "border-slate-600/50 bg-slate-700/30 text-slate-400",
  running: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  awaiting_approval: "border-amber-500/50 bg-amber-500/15 text-amber-200",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  rejected: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  error: "border-rose-500/50 bg-rose-500/15 text-rose-200",
};

const STATUS_LABELS = {
  pending: "Pending",
  running: "Running…",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  done: "Done",
  error: "Error",
};

export function StatusChip({ status }) {
  const key = status || "pending";
  const cls = STATUS_STYLES[key] || STATUS_STYLES.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
    >
      {key === "running" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {STATUS_LABELS[key] || key}
    </span>
  );
}
