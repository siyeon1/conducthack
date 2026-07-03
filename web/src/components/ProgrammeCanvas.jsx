import { useMemo } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import StatusNode from "./StatusNode.jsx";
import { layoutProgramme } from "../programme.js";
import { USE_MOCK } from "../api.js";

const nodeTypes = { stage: StatusNode };

// Level-1 — the Change Programme canvas. Renders the decomposition DAG with per-node status;
// clicking a node opens its Level-2 cockpit. Editing (add/reorder/approve) arrives in Stage 3.
export default function ProgrammeCanvas({ programme, statuses = {}, onOpenNode }) {
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
          {USE_MOCK && (
            <span className="rounded-full border border-slate-600/50 bg-slate-700/30 px-2.5 py-1 text-[11px] font-medium text-slate-400">
              mock data
            </span>
          )}
        </div>

        {/* Change + progress */}
        <div className="rounded-2xl border border-slate-700/60 bg-ink-900/60 p-4 shadow-xl shadow-black/20 backdrop-blur-sm">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Business change request
          </div>
          <p className="text-sm font-semibold text-slate-100">{programme.title}</p>
          {programme.subtitle && <p className="mt-0.5 text-xs text-slate-400">{programme.subtitle}</p>}
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
      <div className="h-[600px] overflow-hidden rounded-2xl border border-slate-700/60 bg-ink-950/40 shadow-inner">
        <ReactFlow
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
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">
        Click any stage to open its cockpit — Locate → Explain → Impact → Propose → Record, scoped to that sub-change.
      </p>
    </div>
  );
}
