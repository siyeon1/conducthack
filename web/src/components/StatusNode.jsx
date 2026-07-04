import { Handle, Position } from "@xyflow/react";

// Custom React Flow node for a Level-1 sub-change. Border colour + badge encode status.
// shft trust palette: in-progress = brand purple, awaiting = Signal Coral (the human-gate
// moment), done = verified green, blocked = danger. Click is handled by the canvas.
const STYLES = {
  pending: { ring: "border-line", dot: "bg-ink-mute", label: "Pending", tint: "text-ink-mute", icon: "" },
  in_progress: { ring: "border-brand-400 shadow-card", dot: "bg-brand-400 animate-pulse", label: "In progress", tint: "text-brand-700", icon: "" },
  awaiting_approval: { ring: "border-coral-400 shadow-card", dot: "bg-coral-400 animate-pulse", label: "Awaiting approval", tint: "text-magenta-700", icon: "✋" },
  done: { ring: "border-verified shadow-card", dot: "bg-verified", label: "Done", tint: "text-verified", icon: "✓" },
  blocked: { ring: "border-danger", dot: "bg-danger", label: "Blocked", tint: "text-danger", icon: "⚠" },
};

export default function StatusNode({ data }) {
  const s = STYLES[data.status] || STYLES.pending;
  return (
    <div
      className={`w-[248px] cursor-pointer rounded-xl border-2 ${s.ring} bg-paper-light px-3 py-2.5 shadow-card transition hover:-translate-y-px hover:shadow-pop`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-line !bg-paper-dark" />
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
        <span className="flex-1 text-[13px] font-semibold leading-snug text-ink">
          {data.label}
        </span>
        {s.icon && <span className={`text-sm ${s.tint}`}>{s.icon}</span>}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider ${s.tint}`}>{s.label}</span>
        {data.editSites && data.editSites.length > 0 && (
          <span className="truncate font-mono text-[10px] text-ink-mute">
            {data.editSites.join(" · ")}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-line !bg-paper-dark" />
    </div>
  );
}
