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
      className={`rounded-2xl border bg-paper-light shadow-card transition-colors ${
        gated
          ? "border-coral-400/40 ring-1 ring-coral-400/10"
          : "border-line"
      }`}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
            gated
              ? "bg-coral-tint text-magenta-700"
              : "bg-brand-50 text-brand-700"
          }`}
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-ink">
              {title}
            </h2>
            {gated && (
              <span className="rounded border border-coral-400/40 bg-coral-tint px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-magenta-700">
                Human gate
              </span>
            )}
          </div>
          {subtitle && (
            <p className="truncate text-xs text-ink-soft">{subtitle}</p>
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
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
          <div className="animate-fade-in rounded-lg border border-danger/40 bg-danger-tint px-4 py-3 text-sm text-[#b02138]">
            <span className="font-semibold">Error:</span> {error.error || "Something went wrong"}
            {error.detail && (
              <div className="mt-1 font-mono text-xs text-danger">
                {String(error.detail)}
              </div>
            )}
            <div className="mt-1 text-xs text-danger">
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
