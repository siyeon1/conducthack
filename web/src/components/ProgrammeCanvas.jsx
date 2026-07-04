import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  useNodesState,
  useEdgesState,
  addEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import StatusNode from "./StatusNode.jsx";
import ProgrammeLedger from "./ProgrammeLedger.jsx";
import IntegrationsPanel from "./IntegrationsPanel.jsx";
import { layoutProgramme } from "../programme.js";
import { useTypewriterPlaceholder } from "../useTypewriter.js";

// Cycled as typewriter suggestions in the change-request bar. Every one is live-verified to
// produce a good custom decomposition on the CBSA corpus — anything a viewer sees suggested
// will genuinely work if typed (the generality of the product, made discoverable).
const SUGGESTED_PROMPTS = [
  "Cap overdraft fees to comply with FCA Consumer Duty",
  "Add a daily ATM withdrawal limit check to the account debit path",
  "Require two-person approval for transfers over £10,000",
  "Add a dormant-account flag that blocks debits after 12 months of inactivity",
  "Add audit logging whenever an account interest rate is changed",
];

const nodeTypes = { stage: StatusNode };

// Verified edges (a parsed dependency exists) render solid green; inferred edges (LLM ordering,
// or a human-added link) render dashed amber + animated — the shft trust palette. Styling lives on
// the edge objects so the controlled edge state stays the single source of truth.
function styleEdge(e) {
  const verified = !!(e.data && e.data.verified);
  return {
    ...e,
    animated: !verified,
    markerEnd: { type: MarkerType.ArrowClosed, color: verified ? "#1C7C46" : "#B58318", width: 18, height: 18 },
    style: { stroke: verified ? "#1C7C46" : "#B58318", strokeWidth: 1.6, strokeDasharray: verified ? undefined : "6 5" },
    labelStyle: { fill: "#4A4652", fontSize: 10 },
    labelBgStyle: { fill: "#FCFBFF", fillOpacity: 0.92 },
    labelBgPadding: [4, 2],
    labelBgBorderRadius: 4,
  };
}

// Level-1 — the Change Programme canvas. A generated/seed plan opens in DRAFT: the engineer can
// drag, rename, add, delete, and re-link sub-changes (cycle-prevented), then APPROVE to lock the
// structure and unlock execution (clicking a node opens its Level-2 cockpit).
export default function ProgrammeCanvas({
  programme,
  statuses = {},
  approved = false,
  ledger = [],
  library = [],
  onOpenNode,
  onGenerate,
  generating = false,
  planError = null,
  onApprove,
  onReopen,
  onSave,
  onLoad,
  onDeleteSaved,
}) {
  // Starts EMPTY (not pre-filled with the seed title) so the typewriter suggestions are visible.
  const [req, setReq] = useState("");
  const [reqFocused, setReqFocused] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  // Typewriter suggestions cycle while the bar is empty and unfocused; on focus they stop and
  // freeze into a static "Press Tab for: …" hint (Tab accepts, typing dismisses).
  const { placeholder: animatedPlaceholder, suggestion } = useTypewriterPlaceholder(SUGGESTED_PROMPTS, {
    active: !reqFocused && !req && !generating,
    fallback: "",
  });
  const reqPlaceholder = !req
    ? reqFocused && suggestion
      ? `Press Tab for: “${suggestion}” — or type your own`
      : animatedPlaceholder || "Describe a compliance / behaviour change in plain English…"
    : "";
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState(null);

  // Re-seed the canvas from the plan whenever the plan itself changes (new generation / approve).
  useEffect(() => {
    const { nodes: n, edges: e } = layoutProgramme(programme, statuses);
    setNodes(n);
    setEdges(e.map(styleEdge));
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programme]);

  // Recolor nodes as statuses change during execution — WITHOUT re-laying-out (preserve positions).
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: statuses[n.id] || "pending" } })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses]);

  // Block any connection that would create a cycle (keep the plan a DAG) or a self-loop.
  const isValidConnection = useCallback(
    (conn) => {
      if (!conn.source || !conn.target || conn.source === conn.target) return false;
      const adj = {};
      edges.forEach((e) => (adj[e.source] = adj[e.source] || []).push(e.target));
      const stack = [conn.target];
      const seen = new Set();
      while (stack.length) {
        const x = stack.pop();
        if (x === conn.source) return false; // target already reaches source → cycle
        if (seen.has(x)) continue;
        seen.add(x);
        (adj[x] || []).forEach((t) => stack.push(t));
      }
      return true;
    },
    [edges]
  );

  const onConnect = useCallback(
    (conn) =>
      setEdges((eds) =>
        addEdge(
          styleEdge({ ...conn, id: `e-${conn.source}-${conn.target}-${eds.length}`, label: "depends on", data: { verified: false } }),
          eds
        )
      ),
    [setEdges]
  );

  const onNodeClick = useCallback(
    (_, node) => {
      if (approved) onOpenNode && onOpenNode(node.id);
      else setSelectedId(node.id);
    },
    [approved, onOpenNode]
  );

  const addStage = () => {
    const id = `stage-${nodes.length + 1}-${Math.round(nodes.reduce((a, n) => a + (n.position?.x || 0), 7) % 9973)}`;
    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      {
        id,
        type: "stage",
        position: { x: 40, y: 40 + nds.length * 8 },
        selected: true,
        data: { label: "New sub-change", status: "pending", editSites: [], changeRequest: "Describe this sub-change…" },
      },
    ]);
    setSelectedId(id);
  };

  const updateSelected = (patch) =>
    setNodes((nds) => nds.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n)));

  const deleteSelected = () => {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };

  const approve = () => {
    const pnodes = nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      change_request: n.data.changeRequest,
      edit_sites: n.data.editSites || [],
      position: n.position,
    }));
    const pedges = edges.map((e) => ({
      source: e.source,
      target: e.target,
      reason: e.label || "",
      verified: !!(e.data && e.data.verified),
    }));
    onApprove && onApprove({ ...programme, nodes: pnodes, edges: pedges });
  };

  // Keyboard: ⌘/Ctrl+Enter approves the plan while in draft (Linear-style speed).
  useEffect(() => {
    if (approved) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && nodes.length) {
        e.preventDefault();
        approve();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approved, nodes, edges]);

  const total = nodes.length;
  const done = nodes.filter((n) => (n.data.status || "pending") === "done").length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const selectedNode = nodes.find((n) => n.id === selectedId) || null;

  const submit = () => {
    if (onGenerate && req.trim() && !generating) onGenerate(req);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <header className="mb-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-lg text-white shadow-card">
              🛰️
            </div>
            <div>
              <h1 className="flex items-baseline gap-2 tracking-tight">
                <span className="wordmark text-2xl text-brand-500">shft</span>
                <span className="text-sm font-medium text-ink-soft">Change Programme</span>
              </h1>
              <p className="text-xs text-ink-soft">
                A big compliance change, broken into reviewable sub-changes you approve one at a time.
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowIntegrations((v) => !v);
                setShowLibrary(false);
              }}
              title="Workflow integrations — Slack notifications, outbox, roadmap"
              className="rounded-lg border border-line bg-paper-light px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-paper-dark"
            >
              🔌 Integrations
            </button>
            <button
              type="button"
              onClick={onSave}
              title="Save this programme (plan + progress) to your library"
              className="rounded-lg border border-line bg-paper-light px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-paper-dark"
            >
              💾 Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLibrary((v) => !v);
                setShowIntegrations(false);
              }}
              className="rounded-lg border border-line bg-paper-light px-3 py-1.5 text-sm font-medium text-ink-soft transition hover:bg-paper-dark"
            >
              📚 Library{library.length ? ` (${library.length})` : ""}
            </button>
            {showLibrary && (
              <div className="absolute right-0 top-11 z-20 w-80 rounded-xl border border-line bg-paper-light p-2 shadow-pop">
                {library.length === 0 ? (
                  <div className="px-2 py-3 text-center text-xs text-ink-mute">
                    No saved programmes yet. “Save” keeps the current plan + progress + audit trail.
                  </div>
                ) : (
                  <ul className="max-h-72 space-y-1 overflow-y-auto">
                    {library.map((it) => (
                      <li key={it.savedAt} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper">
                        <button
                          type="button"
                          onClick={() => {
                            onLoad && onLoad(it);
                            setShowLibrary(false);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-sm text-ink">{it.title}</div>
                          <div className="text-[10px] text-ink-mute">
                            {it.source === "llm" ? "generated" : it.source === "fallback" ? "fallback" : "seed"} ·{" "}
                            {new Date(it.savedAt).toLocaleString()}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSaved && onDeleteSaved(it.savedAt)}
                          title="Delete"
                          className="rounded px-1.5 text-ink-mute transition hover:text-danger"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <IntegrationsPanel open={showIntegrations} onClose={() => setShowIntegrations(false)} />
          </div>
        </div>

        {/* Change request input */}
        <div className="rounded-2xl border border-line bg-paper-light p-4 shadow-card">
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-ink-mute">
            Business change request
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={req}
              onChange={(e) => setReq(e.target.value)}
              onFocus={() => setReqFocused(true)}
              onBlur={() => setReqFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                // Tab-to-accept: only while the bar is empty — with content, Tab keeps its
                // normal focus-move behaviour (accessibility).
                if (e.key === "Tab" && !req.trim() && suggestion) {
                  e.preventDefault();
                  setReq(suggestion);
                }
              }}
              placeholder={reqPlaceholder}
              disabled={generating}
              className="flex-1 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder-ink-mute outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={submit}
              disabled={generating || !req.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
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
              <span className="rounded-full border border-brand-400/30 bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                ✦ generated live
              </span>
            )}
            {programme.source === "fallback" && (
              <span
                className="rounded-full border border-inferred/30 bg-inferred-tint px-2 py-0.5 text-[11px] font-medium text-[#8a6410]"
                title={programme.detail || "live decomposition unavailable"}
              >
                fallback plan · live decomposition unavailable
              </span>
            )}
            {programme.subtitle && <span className="text-xs text-ink-soft">{programme.subtitle}</span>}
          </div>
          {planError && (
            <div className="mt-2 rounded-lg border border-danger/40 bg-danger-tint px-3 py-2 text-sm text-[#b02138]">
              Could not generate a plan: {planError.error || String(planError)}
            </div>
          )}
        </div>
      </header>

      {/* Control bar — plan gate + progress */}
      <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper-light px-4 py-2.5">
        {!approved ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/40 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
              ✎ Draft
            </span>
            <span className="text-xs text-ink-soft">
              Inspect &amp; amend — drag to arrange, drag handle-to-handle to link, click a stage to edit, ⌫ to delete.
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={addStage}
                className="rounded-lg border border-line bg-paper-light px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-paper-dark"
              >
                + Add stage
              </button>
              <button
                type="button"
                onClick={approve}
                disabled={nodes.length === 0}
                className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700 disabled:opacity-40"
              >
                ✓ Approve plan
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-verified/40 bg-verified-tint px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-verified">
              ✓ Approved
            </span>
            <span className="text-xs text-ink-soft">Click a stage to open its cockpit and work the sub-change.</span>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-paper-dark">
                  <div
                    className="h-full rounded-full bg-verified transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-ink-soft">
                  <span className="text-verified">{done}</span> of {total} done
                </span>
              </div>
              <button
                type="button"
                onClick={() => onReopen && onReopen()}
                className="rounded-lg border border-line bg-paper-light px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-paper-dark"
              >
                ✎ Edit plan
              </button>
            </div>
          </>
        )}
      </div>

      {/* DAG canvas */}
      <div className="relative h-[600px] overflow-hidden rounded-2xl border border-line bg-paper shadow-inner">
        <ReactFlow
          key={`${programme.id}:${programme.source || "seed"}`}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedId(null)}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable={!approved}
          nodesConnectable={!approved}
          elementsSelectable
          deleteKeyCode={approved ? null : ["Backspace", "Delete"]}
          minZoom={0.3}
          proOptions={{ hideAttribution: false }}
        >
          <Background color="#E6DBEE" gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {/* Edge legend */}
        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-line bg-paper-light/90 px-2.5 py-1.5 text-[10px] text-ink-soft backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-verified" /> verified dependency (parsed)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 border-t border-dashed border-inferred" /> inferred (LLM / manual)
          </span>
        </div>

        {/* Edit panel (draft, node selected) */}
        {!approved && selectedNode && (
          <div className="absolute right-3 top-3 w-72 rounded-xl border border-line bg-paper-light p-3 shadow-pop">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">Edit stage</span>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded px-1.5 text-ink-mute hover:text-ink-soft"
              >
                ✕
              </button>
            </div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-mute">Label</label>
            <input
              value={selectedNode.data.label}
              onChange={(e) => updateSelected({ label: e.target.value })}
              className="mb-2 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
            />
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-mute">Change request</label>
            <textarea
              value={selectedNode.data.changeRequest}
              onChange={(e) => updateSelected({ changeRequest: e.target.value })}
              className="mb-2 h-24 w-full resize-y rounded-md border border-line bg-white px-2 py-1.5 text-[13px] leading-relaxed text-ink outline-none focus:border-brand-400"
            />
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-mute">
              Edit sites (comma-separated)
            </label>
            <input
              value={(selectedNode.data.editSites || []).join(", ")}
              onChange={(e) =>
                updateSelected({ editSites: e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) })
              }
              className="mb-3 w-full rounded-md border border-line bg-white px-2 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-brand-400"
            />
            <button
              type="button"
              onClick={deleteSelected}
              className="w-full rounded-md border border-danger/50 bg-danger-tint px-2 py-1.5 text-sm font-medium text-[#b02138] transition hover:bg-[#f7c2cb]"
            >
              ⌫ Delete stage
            </button>
          </div>
        )}

        {generating && (
          <div className="absolute inset-0 flex items-center justify-center bg-paper/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-paper-light px-4 py-2 text-sm text-ink-soft shadow-card">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-500" />
              Decomposing the change into a plan…
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-mute">
        {approved
          ? "Approved — click any stage to open its cockpit (Locate → Explain → Impact → Propose → Record)."
          : "Draft — nothing runs until you approve. Amend the decomposition, then Approve plan (⌘/Ctrl+Enter) to lock it and begin."}
      </p>

      <ProgrammeLedger entries={ledger} title={programme.title} />
    </div>
  );
}
