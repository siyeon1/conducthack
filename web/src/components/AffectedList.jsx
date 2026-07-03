import { useState } from "react";
import { RiskBadge, InGraphBadge } from "./Badge.jsx";

// Impact "affected components" list, grouped by risk and collapsible. The high-risk edit sites
// (usually 1–2) stay expanded; the long low-risk tail (shared copybooks etc.) collapses behind a
// one-line disclosure so the cell no longer needs endless scrolling. Answers the UX note that the
// Impact list was too long on screen.
const RISK_ORDER = ["high", "medium", "low"];
const RISK_META = {
  high: { label: "High risk", accent: "border-l-rose-500/70", tint: "text-rose-300" },
  medium: { label: "Medium risk", accent: "border-l-amber-500/70", tint: "text-amber-300" },
  low: { label: "Low risk", accent: "border-l-slate-500/60", tint: "text-slate-400" },
  other: { label: "Unclassified", accent: "border-l-slate-600/50", tint: "text-slate-400" },
};

function riskKey(r) {
  const k = String(r || "").toLowerCase();
  return RISK_ORDER.includes(k) ? k : "other";
}

function Row({ a }) {
  return (
    <li className="animate-fade-in flex flex-col gap-1 rounded-lg border border-slate-700/50 bg-ink-950/40 p-3 sm:flex-row sm:items-start sm:gap-3">
      <div className="flex flex-wrap items-center gap-2 sm:w-56 sm:shrink-0">
        <span className="font-mono text-sm font-semibold text-slate-100">{a.program}</span>
        <RiskBadge risk={a.risk} />
        <InGraphBadge inGraph={a.in_graph} />
      </div>
      <p className="text-sm text-slate-400">{a.relationship}</p>
    </li>
  );
}

function Group({ rk, items, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = RISK_META[rk];
  return (
    <div className={`rounded-lg border-l-2 ${meta.accent} pl-2.5`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 py-1.5 text-left"
      >
        <span className={`text-[11px] text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}>
          ▸
        </span>
        <span className={`text-xs font-semibold uppercase tracking-wider ${meta.tint}`}>
          {meta.label}
        </span>
        <span className="rounded-full bg-slate-700/50 px-1.5 py-0.5 text-[11px] font-medium text-slate-300">
          {items.length}
        </span>
        {!open && (
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500">
            {items.map((a) => a.program).join(" · ")}
          </span>
        )}
      </button>
      {open && (
        <ul className="space-y-2 pb-2">
          {items.map((a, i) => (
            <Row key={i} a={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AffectedList({ affected }) {
  const items = affected || [];
  const groups = {};
  for (const a of items) {
    const k = riskKey(a.risk);
    (groups[k] = groups[k] || []).push(a);
  }
  const order = [...RISK_ORDER, "other"].filter((k) => groups[k] && groups[k].length);
  const highCount = (groups.high || []).length;

  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">
        <span className="font-semibold text-slate-300">{items.length}</span> components in the blast
        radius
        {highCount ? (
          <>
            {" · "}
            <span className="font-semibold text-rose-300">{highCount}</span> high-risk edit{" "}
            {highCount === 1 ? "site" : "sites"} shown first
          </>
        ) : null}
      </p>
      {order.map((rk) => (
        <Group key={rk} rk={rk} items={groups[rk]} defaultOpen={rk === "high"} />
      ))}
    </div>
  );
}
