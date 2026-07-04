// GraphView.jsx — the blast-radius dependency graph, hand-rolled as a tidy SVG
// (no heavy graph lib). Nodes are laid out in three tiers (callers → programs →
// records/copybooks). Solid green = verified (parsed) edge; dashed gold = inferred.
// Edge kind is on hover (labels dropped for legibility); edges off the edit site are
// dimmed. Nodes are clickable via onNodeClick(name, role). shft trust palette.

const NODE_W = 132;
const NODE_H = 46;
const GAP_X = 26;
const ROW_GAP_Y = 88;
const PAD_X = 28;
const PAD_Y = 26;

// shft trust palette (hex, for the SVG). Verified green, inferred gold, danger red, brand purple.
const C = {
  verified: "#1C7C46",
  inferred: "#B58318",
  danger: "#D93A56",
  brand: "#9400D3",
  neutral: "#9A96A3",
};

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-line bg-paper px-4 py-10 text-center text-sm text-ink-mute">
      Run Impact to map the blast radius.
    </div>
  );
}

export default function GraphView({ graph, highlight = [], onNodeClick }) {
  const nodes = (graph && graph.nodes) || [];
  const edges = (graph && graph.edges) || [];
  if (!nodes.length) return <EmptyState />;

  const hi = new Set(highlight.map((h) => String(h).toUpperCase()));
  const focused = hi.size > 0;
  const froms = new Set(edges.map((e) => e.frm));
  const tos = new Set(edges.map((e) => e.to));

  const roleOf = (n) => {
    const isFrom = froms.has(n);
    const isTo = tos.has(n);
    if (isFrom && !isTo) return "caller";
    if (isTo && !isFrom) return "record";
    return "program";
  };

  const rows = [[], [], []]; // callers, programs, records
  const rowIndex = { caller: 0, program: 1, record: 2 };
  for (const n of nodes) rows[rowIndex[roleOf(n)]].push(n);

  const rowWidth = (list) =>
    list.length ? list.length * NODE_W + (list.length - 1) * GAP_X : 0;
  const totalWidth = Math.max(...rows.map(rowWidth), NODE_W) + PAD_X * 2;
  const totalHeight = rows.length * NODE_H + (rows.length - 1) * ROW_GAP_Y + PAD_Y * 2;

  // Position each node.
  const pos = {};
  rows.forEach((list, r) => {
    const w = rowWidth(list);
    const startX = PAD_X + (totalWidth - PAD_X * 2 - w) / 2;
    const y = PAD_Y + r * (NODE_H + ROW_GAP_Y);
    list.forEach((n, i) => {
      const x = startX + i * (NODE_W + GAP_X);
      pos[n] = { x, y, cx: x + NODE_W / 2, cy: y + NODE_H / 2 };
    });
  });

  const nodeStyle = (n) => {
    const role = roleOf(n);
    if (hi.has(String(n).toUpperCase()))
      return { fill: "rgba(217,58,86,0.12)", stroke: C.danger, text: "#b02138", tag: "edit site" };
    if (role === "caller")
      return { fill: "rgba(148,0,211,0.10)", stroke: C.brand, text: "#6D00A0", tag: "caller" };
    if (role === "record")
      return { fill: "rgba(28,124,70,0.10)", stroke: C.verified, text: "#176437", tag: "copybook" };
    return { fill: "rgba(154,150,163,0.10)", stroke: C.neutral, text: "#4A4652", tag: "program" };
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[11px] text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <svg width="26" height="8">
            <line x1="0" y1="4" x2="26" y2="4" stroke={C.verified} strokeWidth="2" />
          </svg>
          verified edge
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="26" height="8">
            <line
              x1="0"
              y1="4"
              x2="26"
              y2="4"
              stroke={C.inferred}
              strokeWidth="2"
              strokeDasharray="5 4"
            />
          </svg>
          inferred edge
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-verified bg-verified-tint" />
          copybook / record
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-danger bg-danger-tint" />
          edit site
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-paper p-2">
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="min-w-full"
          role="img"
          aria-label="Dependency blast-radius graph"
        >
          <defs>
            <marker
              id="arrow-verified"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={C.verified} />
            </marker>
            <marker
              id="arrow-inferred"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={C.inferred} />
            </marker>
          </defs>

          {/* edges first (under nodes). Kind labels dropped for legibility — kind is on the
              hover title; edges not touching an edit site are dimmed to focus the blast path. */}
          {edges.map((e, i) => {
            const a = pos[e.frm];
            const b = pos[e.to];
            if (!a || !b) return null;
            const x1 = a.cx;
            const y1 = a.y + (b.cy > a.cy ? NODE_H : 0);
            const x2 = b.cx;
            const y2 = b.y + (b.cy > a.cy ? 0 : NODE_H);
            const color = e.verified ? C.verified : C.inferred;
            const focusEdge = !focused || hi.has(e.frm) || hi.has(e.to);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={focusEdge ? 1.7 : 1.1}
                strokeDasharray={e.verified ? "0" : "5 4"}
                markerEnd={`url(#arrow-${e.verified ? "verified" : "inferred"})`}
                opacity={focusEdge ? 0.85 : 0.18}
              >
                <title>{`${e.frm} —${e.kind}→ ${e.to}${e.verified ? "" : " (inferred)"}`}</title>
              </line>
            );
          })}

          {/* nodes */}
          {nodes.map((n) => {
            const p = pos[n];
            if (!p) return null;
            const s = nodeStyle(n);
            return (
              <g
                key={n}
                onClick={onNodeClick ? () => onNodeClick(n, roleOf(n)) : undefined}
                style={{ cursor: onNodeClick ? "pointer" : "default" }}
              >
                <title>{onNodeClick ? `Open ${n}` : n}</title>
                <rect
                  x={p.x}
                  y={p.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={10}
                  fill={s.fill}
                  stroke={s.stroke}
                  strokeWidth="1.4"
                />
                <text
                  x={p.cx}
                  y={p.y + 20}
                  textAnchor="middle"
                  fontSize="13"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="600"
                  fill={s.text}
                >
                  {n}
                </text>
                <text
                  x={p.cx}
                  y={p.y + 35}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="ui-sans-serif, system-ui"
                  fill={s.stroke}
                  opacity="0.9"
                >
                  {s.tag}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
