// DiffView.jsx — renders a unified diff: added lines green, removed red,
// hunk headers brand, context muted. Monospace, scrolls inside its own box.
export default function DiffView({ diff }) {
  const lines = (diff || "").replace(/\n$/, "").split("\n");

  const classify = (line) => {
    if (line.startsWith("+++") || line.startsWith("---"))
      return "text-ink-mute";
    if (line.startsWith("@@"))
      return "bg-brand-50 text-brand-700";
    if (line.startsWith("+"))
      return "bg-verified-tint text-verified";
    if (line.startsWith("-"))
      return "bg-danger-tint text-[#b02138]";
    return "text-ink-soft";
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line bg-paper px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-mute">
          unified diff · proposal
        </span>
        <span className="rounded border border-inferred/30 bg-inferred-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8a6410]">
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
