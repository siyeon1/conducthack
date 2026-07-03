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
      <div className="flex-1 bg-black/50" />
      <div
        className="flex h-full w-full max-w-3xl flex-col border-l border-slate-700/60 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-slate-700/50 bg-ink-900/60 px-4 py-3">
          <span className="font-mono text-sm font-semibold text-slate-100">{name}</span>
          {src && (
            <span className="font-mono text-[11px] text-slate-500">
              {src.file} · {src.n_lines} lines
            </span>
          )}
          <span className="ml-auto rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
            ✓ source · parsed
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close source"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-auto bg-ink-950">
          {err ? (
            <div className="p-4 text-sm text-rose-300">
              Could not load source: {err.error || String(err)}
            </div>
          ) : !src ? (
            <div className="p-4 text-sm text-slate-500">Loading source…</div>
          ) : (
            <pre className="min-w-full font-mono text-[12px] leading-relaxed">
              {lines.map((ln, i) => (
                <div key={i} className="flex hover:bg-slate-800/40">
                  <span className="w-12 shrink-0 select-none pr-3 text-right text-slate-600">
                    {i + 1}
                  </span>
                  <span className="whitespace-pre pr-4 text-slate-300">{ln || " "}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
