// programme.js — Level-1 "Change Programme" data + dagre auto-layout.
//
// A big compliance change is decomposed into a DAG of dependent sub-changes. For Stage 1 this
// is a HARD-CODED plan (the demo safety net); Stage 2 swaps in a validated, LLM-generated plan
// of the same shape. Each node carries its own scoped `change_request` — clicking it opens the
// existing 5-cell cockpit (Level-2) for that sub-change.
import dagre from "@dagrejs/dagre";

export const FCA_PROGRAMME = {
  id: "prog-fca-overdraft",
  title: "Cap overdraft fees to comply with FCA Consumer Duty",
  subtitle:
    "One compliance change, decomposed into small, dependent, individually-reviewable sub-changes.",
  nodes: [
    {
      id: "acct-field",
      label: "Add fee-cap field to ACCOUNT copybook",
      change_request:
        "Add an overdraft fee-cap field/constant to the ACCOUNT copybook so the debit programs can enforce a maximum overdraft fee.",
      edit_sites: ["ACCOUNT"],
    },
    {
      id: "xfrfun-guard",
      label: "Guard the debit path in XFRFUN",
      change_request:
        "Cap / add a compliant guard on overdraft fees on the debit (FROM) side of XFRFUN before the available balance is reduced, to comply with FCA Consumer Duty.",
      edit_sites: ["XFRFUN"],
    },
    {
      id: "dbcrfun-guard",
      label: "Guard ordinary debits in DBCRFUN",
      change_request:
        "Enforce the overdraft fee cap on ordinary debits in DBCRFUN, alongside the existing MORTGAGE/LOAN guard, to comply with FCA Consumer Duty.",
      edit_sites: ["DBCRFUN"],
    },
    {
      id: "proctran-audit",
      label: "Record capped fee in PROCTRAN audit trail",
      change_request:
        "Record the capped overdraft fee and its reason code in the PROCTRAN transaction / audit record.",
      edit_sites: ["PROCTRAN"],
    },
    {
      id: "bnk1tfn-screen",
      label: "Surface the fail path in the BNK1TFN screen",
      change_request:
        "Surface the new overdraft-cap failure path to the user in the BNK1TFN 3270 transfer screen.",
      edit_sites: ["BNK1TFN"],
    },
  ],
  edges: [
    { source: "acct-field", target: "xfrfun-guard", reason: "XFRFUN reads ACCOUNT-OVERDRAFT-LIMIT", verified: true },
    { source: "acct-field", target: "dbcrfun-guard", reason: "DBCRFUN reads the same ACCOUNT field", verified: true },
    { source: "xfrfun-guard", target: "proctran-audit", reason: "guard outcome is journalled to PROCTRAN", verified: true },
    { source: "dbcrfun-guard", target: "proctran-audit", reason: "guard outcome is journalled to PROCTRAN", verified: true },
    { source: "xfrfun-guard", target: "bnk1tfn-screen", reason: "BNK1TFN LINKs XFRFUN and surfaces its result", verified: true },
  ],
};

const NODE_W = 248;
const NODE_H = 76;

// Run dagre over the plan and return React-Flow-shaped nodes/edges. React Flow ships no layout,
// and the plan carries no coordinates, so we compute them here. Re-run whenever the plan changes.
export function layoutProgramme(programme, statuses = {}, direction = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 48, ranksep: 90, marginx: 16, marginy: 16 });

  programme.nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  programme.edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const nodes = programme.nodes.map((n) => {
    const p = g.node(n.id);
    return {
      id: n.id,
      type: "stage",
      // dagre anchors at the node CENTER; React Flow anchors at the TOP-LEFT.
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
      data: {
        label: n.label,
        status: statuses[n.id] || "pending",
        editSites: n.edit_sites || [],
      },
    };
  });

  const edges = programme.edges.map((e, i) => ({
    id: `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    label: e.reason,
    data: { verified: e.verified },
  }));

  return { nodes, edges };
}
