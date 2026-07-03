// Cell.jsx — one reviewable step in the change plan. A card with a numbered
// title, a subtitle, a status chip, a Run button, and a result pane.
import { StatusChip } from "./Badge.jsx";

export default function Cell({
  index,
  title,
  subtitle,
  status,
  gated = false,
  disabled = false,
  running = false,
  runLabel = "Run",
  onRun,
  headerExtra,
  error,
  children,
}) {
  return (
    <section
      className={`rounded-2xl border bg-ink-900/60 shadow-xl shadow-black/20 backdrop-blur-sm transition-colors ${
        gated
          ? "border-amber-500/30 ring-1 ring-amber-500/10"
          : "border-slate-700/60"
      }`}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700/50 px-5 py-4">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
            gated
              ? "bg-amber-500/15 text-amber-300"
              : "bg-indigo-500/15 text-indigo-300"
          }`}
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-100">
              {title}
            </h2>
            {gated && (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Human gate
              </span>
            )}
          </div>
          {subtitle && (
            <p className="truncate text-xs text-slate-400">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {headerExtra}
          <StatusChip status={status} />
          {onRun && (
            <button
              type="button"
              onClick={onRun}
              disabled={disabled || running}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Running
                </>
              ) : (
                <>
                  <span aria-hidden>▷</span> {runLabel}
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <div className="px-5 py-4">
        {error ? (
          <div className="animate-fade-in rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="font-semibold">Error:</span> {error.error || "Something went wrong"}
            {error.detail && (
              <div className="mt-1 font-mono text-xs text-rose-300/80">
                {String(error.detail)}
              </div>
            )}
            <div className="mt-1 text-xs text-rose-300/70">
              The session is intact — you can re-run this step.
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
