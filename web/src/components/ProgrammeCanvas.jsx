import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import StatusNode from "./StatusNode.jsx";
import { layoutProgramme } from "../programme.js";

const nodeTypes = { stage: StatusNode };

// Level-1 — the Change Programme canvas. A change request is decomposed (live, or the canned
// fallback) into a DAG; each node's status is shown, and clicking a node opens its Level-2
// cockpit. Editing the plan (add/reorder/approve) arrives in Stage 3.
export default function ProgrammeCanvas({
  programme,
  statuses = {},
  onOpenNode,
  onGenerate,
  generating = false,
  planError = null,
}) {
  const [req, setReq] = useState(programme.title || "");
  const { nodes, edges } = useMemo(() => layoutProgramme(programme, statuses), [programme, statuses]);

  const total = programme.nodes.length;
  const done = programme.nodes.filter((n) => (statuses[n.id] || "pending") === "done").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const rfEdges = edges.map((e) => ({
    ...e,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#64748b", width: 18, height: 18 },
    style: { stroke: "#475569", strokeWidth: 1.5 },
    labelStyle: { fill: "#94a3b8", fontSize: 10 },
    labelBgStyle: { fill: "#0f172a", fillOpacity: 0.85 },
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 4,
  }));

  const submit = () => {
    if (onGenerate && req.trim() && !generating) onGenerate(req);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <header className="mb-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-lg shadow-lg shadow-indigo-900/40">
              🛰️
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-100">
                Legacy Move
                <span className="ml-2 text-slate-400">— Change Programme</span>
              </h1>
              <p className="text-xs text-slate-400">
                A big compliance change, broken into reviewable sub-changes you approve one at a time.
              </p>
            </div>
          </div>
        </div>

        {/* Change request input + progress */}
        <div className="rounded-2xl border border-slate-700/60 bg-ink-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Business change request
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={req}
              onChange={(e) => setReq(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Describe a compliance / behaviour change in plain English…"
              disabled={generating}
              className="flex-1 rounded-lg border border-slate-600/60 bg-ink-950/70 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={submit}
              disabled={generating || !req.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Decomposing…
                </>
              ) : (
                <>✦ Generate plan</>
              )}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {programme.source === "llm" && (
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                ✦ generated live
              </span>
            )}
            {programme.source === "fallback" && (
              <span
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
                title={programme.detail || "live decomposition unavailable"}
              >
                fallback plan · live decomposition unavailable
              </span>
            )}
            {programme.subtitle && <span className="text-xs text-slate-400">{programme.subtitle}</span>}
          </div>

          {planError && (
            <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              Could not generate a plan: {planError.error || String(planError)}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-300">
              <span className="text-emerald-300">{done}</span> of {total} stages done
            </span>
          </div>
        </div>
      </header>

      {/* DAG canvas */}
      <div className="relative h-[600px] overflow-hidden rounded-2xl border border-slate-700/60 bg-ink-950/40 shadow-inner">
        <ReactFlow
          // Remount per plan: React Flow's fitView only runs on initial mount, so a newly
          // generated plan would otherwise render unfitted (and unmeasured). Keying on the plan
          // identity + shape forces a fresh measure + fitView whenever the decomposition changes.
          key={`${programme.id}:${programme.nodes.length}:${programme.source || "seed"}`}
          nodes={nodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onOpenNode && onOpenNode(node.id)}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          minZoom={0.3}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="#1e293b" gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
        {generating && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/50 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-ink-900/90 px-4 py-2 text-sm text-slate-200">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500/50 border-t-slate-200" />
              Decomposing the change into a plan…
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">
        Click any stage to open its cockpit — Locate → Explain → Impact → Propose → Record, scoped to that sub-change.
      </p>
    </div>
  );
}
