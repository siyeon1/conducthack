import { useCallback, useState } from "react";
import ProgrammeCanvas from "./components/ProgrammeCanvas.jsx";
import StageCockpit from "./components/StageCockpit.jsx";
import { FCA_PROGRAMME } from "./programme.js";
import { generatePlan } from "./api.js";

// Two-level shell: Level-1 Change Programme canvas (the decomposition DAG) ⇄ Level-2 Stage cockpit
// (the existing 5-cell flow, scoped to one sub-change). The shell owns the programme, which node is
// open, and each node's status; the cockpit owns its own session and reports its status back up.
export default function App() {
  const [programme, setProgramme] = useState(FCA_PROGRAMME);
  const [statuses, setStatuses] = useState({}); // nodeId -> "pending"|"in_progress"|"awaiting_approval"|"done"
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [planError, setPlanError] = useState(null);

  const activeNode = programme.nodes.find((n) => n.id === activeNodeId) || null;

  const setNodeStatus = useCallback((id, status) => {
    setStatuses((prev) => {
      // A fresh cockpit remount reports "pending" first — never regress a stage that's already done.
      if (prev[id] === "done" && status !== "done") return prev;
      if (prev[id] === status) return prev;
      return { ...prev, [id]: status };
    });
  }, []);

  const handleGenerate = useCallback(async (cr) => {
    const req = (cr || "").trim();
    if (!req) return;
    setGenerating(true);
    setPlanError(null);
    try {
      const prog = await generatePlan(req);
      if (prog && Array.isArray(prog.nodes) && prog.nodes.length) {
        setProgramme(prog);
        setStatuses({}); // a new plan starts fresh
        setActiveNodeId(null);
      } else {
        setPlanError({ error: "Planner returned an empty plan." });
      }
    } catch (e) {
      setPlanError(e);
    } finally {
      setGenerating(false);
    }
  }, []);

  if (activeNode) {
    return (
      <StageCockpit
        key={activeNode.id}
        node={activeNode}
        onBack={() => setActiveNodeId(null)}
        onStatusChange={(status) => setNodeStatus(activeNode.id, status)}
      />
    );
  }

  return (
    <ProgrammeCanvas
      programme={programme}
      statuses={statuses}
      onOpenNode={(id) => setActiveNodeId(id)}
      onGenerate={handleGenerate}
      generating={generating}
      planError={planError}
    />
  );
}
