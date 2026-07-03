// DiffView.jsx — renders a unified diff: added lines green, removed red,
// hunk headers indigo, context muted. Monospace, scrolls inside its own box.
export default function DiffView({ diff }) {
  const lines = (diff || "").replace(/\n$/, "").split("\n");

  const classify = (line) => {
    if (line.startsWith("+++") || line.startsWith("---"))
      return "text-slate-500";
    if (line.startsWith("@@"))
      return "bg-indigo-500/10 text-indigo-300";
    if (line.startsWith("+"))
      return "bg-emerald-500/10 text-emerald-300";
    if (line.startsWith("-"))
      return "bg-rose-500/10 text-rose-300";
    return "text-slate-400";
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700/60 bg-ink-950/80">
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-ink-900/60 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
          unified diff · proposal
        </span>
        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          not yet applied
        </span>
      </div>
      <div className="overflow-x-auto">
        <pre className="min-w-full font-mono text-[12.5px] leading-relaxed">
          {lines.map((line, i) => (
            <div
              key={i}
              className={`whitespace-pre px-3 ${classify(line)}`}
            >
              {line || " "}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
