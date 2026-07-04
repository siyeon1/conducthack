// Badge.jsx — small status/provenance chips shared across cells (shft trust palette).

// Provenance badge: green "✓ verified" (parsed) vs amber "~ inferred" (LLM guess).
// This single honesty signal scores under both "technical execution" and "control".
export function VerifiedBadge({ verified }) {
  return verified ? (
    <span className="badge b-verified">
      <span aria-hidden>✓</span> verified
    </span>
  ) : (
    <span className="badge b-inferred">
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
    <span className="badge b-verified">
      <span aria-hidden>✓</span> in graph
    </span>
  ) : (
    <span
      className="badge b-inferred"
      title="Named by the model but not present in the deterministic dependency graph"
    >
      <span aria-hidden>~</span> narrated
    </span>
  );
}

const RISK_STYLES = {
  high: "border-danger/40 bg-danger-tint text-[#b02138]",
  medium: "border-inferred/40 bg-inferred-tint text-[#8a6410]",
  low: "border-line bg-paper-dark text-ink-soft",
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
  pending: "border-line bg-paper-dark text-ink-mute",
  running: "border-brand-400/40 bg-brand-50 text-brand-700",
  awaiting_approval: "border-coral-400/50 bg-coral-tint text-magenta-700",
  approved: "border-verified/40 bg-verified-tint text-verified",
  rejected: "border-danger/40 bg-danger-tint text-[#b02138]",
  done: "border-verified/40 bg-verified-tint text-verified",
  error: "border-danger/50 bg-danger-tint text-[#b02138]",
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
