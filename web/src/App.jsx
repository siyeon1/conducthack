import { useCallback, useMemo, useState } from "react";
import LandingPage from "./components/LandingPage.jsx";
import ProgrammeCanvas from "./components/ProgrammeCanvas.jsx";
import StageCockpit from "./components/StageCockpit.jsx";
import { FCA_PROGRAMME } from "./programme.js";
import { generatePlan, notifyPlanApproved } from "./api.js";
import { listLibrary, saveToLibrary, deleteFromLibrary } from "./library.js";

// Two-level shell: Level-1 Change Programme canvas (the decomposition DAG) ⇄ Level-2 Stage cockpit
// (the existing 5-cell flow, scoped to one sub-change). The plan is a DRAFT until approved; only an
// approved plan unlocks execution. The shell owns the programme, whether it's approved, which node
// is open, each node's status, the programme-level audit trail, and the saved-programme library.
export default function App() {
  const [entered, setEntered] = useState(false); // landing page → cockpit
  const [programme, setProgramme] = useState(FCA_PROGRAMME);
  const [approved, setApproved] = useState(false); // the plan gate: draft → approved
  const [statuses, setStatuses] = useState({}); // nodeId -> "pending"|"in_progress"|"awaiting_approval"|"done"
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [ledger, setLedger] = useState({}); // nodeId -> recorded hash-chained entry
  const [library, setLibrary] = useState(() => listLibrary());

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
        setStatuses({}); // a new plan starts fresh…
        setApproved(false); // …and unapproved (draft)
        setLedger({}); // …with an empty audit trail
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

  // Approve locks the (possibly edited) structure and unlocks execution.
  const handleApprove = useCallback((editedProgramme) => {
    setProgramme(editedProgramme);
    setApproved(true);
    // Workflow hook (fire-and-forget): the kickoff lands in the team's channel.
    const edges = editedProgramme.edges || [];
    notifyPlanApproved({
      title: editedProgramme.title || "",
      stages: (editedProgramme.nodes || []).length,
      verified_edges: edges.filter((e) => e.verified).length,
      inferred_edges: edges.filter((e) => !e.verified).length,
    });
  }, []);

  const handleReopen = useCallback(() => {
    setApproved(false);
    setActiveNodeId(null);
  }, []);

  // ---- library ----
  const handleSave = useCallback(() => {
    const item = {
      savedAt: Date.now(),
      title: programme.title,
      source: programme.source,
      programme,
      statuses,
      approved,
      ledger,
    };
    setLibrary(saveToLibrary(item));
  }, [programme, statuses, approved, ledger]);

  const handleLoad = useCallback((item) => {
    if (!item || !item.programme) return;
    setProgramme(item.programme);
    setStatuses(item.statuses || {});
    setApproved(!!item.approved);
    setLedger(item.ledger || {});
    setActiveNodeId(null);
  }, []);

  const handleDeleteSaved = useCallback((savedAt) => {
    setLibrary(deleteFromLibrary(savedAt));
  }, []);

  // Ordered programme audit trail (plan order), only the recorded stages.
  const ledgerEntries = useMemo(
    () => programme.nodes.map((n) => ledger[n.id]).filter(Boolean),
    [programme, ledger]
  );

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} />;
  }

  // Only an approved plan can open a cockpit.
  if (activeNode && approved) {
    return (
      <StageCockpit
        key={activeNode.id}
        node={activeNode}
        onBack={() => setActiveNodeId(null)}
        onStatusChange={(status) => setNodeStatus(activeNode.id, status)}
        onRecorded={(entry) =>
          setLedger((prev) => ({ ...prev, [activeNode.id]: { nodeId: activeNode.id, label: activeNode.label, entry } }))
        }
      />
    );
  }

  return (
    <ProgrammeCanvas
      programme={programme}
      statuses={statuses}
      approved={approved}
      ledger={ledgerEntries}
      library={library}
      onOpenNode={(id) => setActiveNodeId(id)}
      onGenerate={handleGenerate}
      generating={generating}
      planError={planError}
      onApprove={handleApprove}
      onReopen={handleReopen}
      onSave={handleSave}
      onLoad={handleLoad}
      onDeleteSaved={handleDeleteSaved}
    />
  );
}
