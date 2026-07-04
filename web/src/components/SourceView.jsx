import { useEffect, useState } from "react";
import { getSource } from "../api.js";

// Slide-over source viewer — opens the raw COBOL for a program/copybook so the engineer can
// actually READ the code the agent is narrating. Opened by clicking a blast-radius graph node.
export default function SourceView({ name, onClose }) {
  const [src, setSrc] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!name) return;
    let alive = true;
    setSrc(null);
    setErr(null);
    getSource(name)
      .then((s) => alive && setSrc(s))
      .catch((e) => alive && setErr(e));
    return () => {
      alive = false;
    };
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [name, onClose]);

  if (!name) return null;
  const lines = src ? String(src.text || "").replace(/\n$/, "").split("\n") : [];

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-ink/40" />
      <div
        className="flex h-full w-full max-w-3xl flex-col border-l border-line bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-line bg-paper px-4 py-3">
          <span className="font-mono text-sm font-semibold text-ink">{name}</span>
          {src && (
            <span className="font-mono text-[11px] text-ink-mute">
              {src.file} · {src.n_lines} lines
            </span>
          )}
          <span className="ml-auto rounded-full border border-verified/30 bg-verified-tint px-2 py-0.5 text-[11px] font-medium text-verified">
            ✓ source · parsed
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-ink-soft transition hover:bg-paper-dark hover:text-ink"
            aria-label="Close source"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-auto bg-white">
          {err ? (
            <div className="p-4 text-sm text-danger">
              Could not load source: {err.error || String(err)}
            </div>
          ) : !src ? (
            <div className="p-4 text-sm text-ink-mute">Loading source…</div>
          ) : (
            <pre className="min-w-full font-mono text-[12px] leading-relaxed">
              {lines.map((ln, i) => (
                <div key={i} className="flex hover:bg-paper">
                  <span className="w-12 shrink-0 select-none pr-3 text-right text-ink-mute">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre pr-4 text-ink-soft">{ln || " "}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
