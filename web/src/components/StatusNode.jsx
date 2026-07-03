import { Handle, Position } from "@xyflow/react";

// Custom React Flow node for a Level-1 sub-change. Border colour + badge encode status
// (Airflow border-colour convention + Linear status tokens). Click is handled by the canvas.
const STYLES = {
  pending: { ring: "border-slate-600/70", dot: "bg-slate-500", label: "Pending", tint: "text-slate-400" },
  in_progress: { ring: "border-sky-500/80 shadow-sky-900/30", dot: "bg-sky-400 animate-pulse", label: "In progress", tint: "text-sky-300" },
  awaiting_approval: { ring: "border-amber-500/80 shadow-amber-900/30", dot: "bg-amber-400 animate-pulse", label: "Awaiting approval", tint: "text-amber-300" },
  done: { ring: "border-emerald-500/80 shadow-emerald-900/30", dot: "bg-emerald-400", label: "Done", tint: "text-emerald-300" },
  blocked: { ring: "border-rose-500/80", dot: "bg-rose-400", label: "Blocked", tint: "text-rose-300" },
};

export default function StatusNode({ data }) {
  const s = STYLES[data.status] || STYLES.pending;
  return (
    <div
      className={`w-[248px] cursor-pointer rounded-xl border-2 ${s.ring} bg-ink-900/95 px-3 py-2.5 shadow-lg transition hover:brightness-110`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-slate-500 !bg-slate-700" />
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
        <span className="flex-1 text-[13px] font-semibold leading-snug text-slate-100">
          {data.label}
        </span>
        {data.status === "done" && <span className="text-sm text-emerald-400">✓</span>}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className={`text-[10px] font-medium uppercase tracking-wider ${s.tint}`}>{s.label}</span>
        {data.editSites && data.editSites.length > 0 && (
          <span className="truncate font-mono text-[10px] text-slate-500">
            {data.editSites.join(" · ")}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-slate-500 !bg-slate-700" />
    </div>
  );
}
