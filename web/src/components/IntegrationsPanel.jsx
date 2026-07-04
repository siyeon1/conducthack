import { useEffect, useState } from "react";
import { getIntegrations } from "../api.js";

// "Works with your current workflow" — the integrations surface. Slack is live (app incoming
// webhook, configured via SLACK_WEBHOOK_URL); the outbox shows every event with an HONEST delivery
// status ("delivered" vs "queued — no webhook configured"). The rest are roadmap tiles.
const EVENT_ICON = {
  "plan.approved": "✅",
  "stage.awaiting_approval": "✋",
  "change.recorded": "⛓",
  "ledger.verify_failed": "🚨",
};

const ROADMAP = [
  { name: "Jira", note: "a linked ticket per sub-change — the plan lands where work is tracked" },
  { name: "ServiceNow", note: "a change request per programme, blast radius attached as affected CIs" },
  { name: "GitHub", note: "a PR per approved stage, ledger hash + rationale in the description" },
  { name: "Email digest", note: "daily programme summary for second-line risk & auditors" },
  { name: "MS Teams", note: "via Power Automate workflows (classic webhooks retired)" },
];

export default function IntegrationsPanel({ open, onClose }) {
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    const load = () =>
      getIntegrations()
        .then((s) => alive && (setStatus(s), setErr(null)))
        .catch((e) => alive && setErr(e));
    load();
    const iv = setInterval(load, 4000); // keep the outbox live while open
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [open]);

  if (!open) return null;
  const connected = !!(status && status.slack && status.slack.connected);
  const outbox = (status && status.outbox) || [];

  return (
    <div className="absolute right-0 top-11 z-20 w-[380px] rounded-xl border border-line bg-paper-light p-3 shadow-pop">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">Integrations</span>
        <button type="button" onClick={onClose} className="rounded px-1.5 text-ink-mute hover:text-ink-soft">
          ✕
        </button>
      </div>

      {/* Slack */}
      <div className="mb-2 rounded-lg border border-line bg-paper p-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-verified" : "bg-ink-mute"}`} />
          <span className="text-sm font-semibold text-ink">Slack</span>
          <span className="text-[11px] text-ink-mute">incoming webhook</span>
          <span
            className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              connected
                ? "border-verified/40 bg-verified-tint text-verified"
                : "border-line bg-paper-dark text-ink-mute"
            }`}
          >
            {connected ? "connected" : "not configured"}
          </span>
        </div>
        {!connected && (
          <p className="mt-1.5 text-[11px] text-ink-mute">
            Set <code className="rounded bg-paper-dark px-1 font-mono">SLACK_WEBHOOK_URL</code> in the server .env and
            restart — events below deliver to your channel.
          </p>
        )}
        <p className="mt-1.5 border-t border-line pt-1.5 text-[11px] italic text-ink-soft">
          No approve button in chat — by design. Approval requires a typed, hash-chained justification in the cockpit.
          Notification is cheap; accountability is not.
        </p>
      </div>

      {/* Outbox */}
      <div className="mb-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-mute">
          Event outbox {err ? "(status unavailable)" : ""}
        </div>
        {outbox.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-2 py-3 text-center text-[11px] text-ink-mute">
            No events yet — approve a plan or record a change and it will appear here.
          </p>
        ) : (
          <ul className="max-h-44 space-y-1 overflow-y-auto">
            {outbox.map((e, i) => (
              <li key={i} className="rounded-lg border border-line bg-paper px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-[12px] text-ink">
                  <span>{EVENT_ICON[e.event] || "•"}</span>
                  <span className="min-w-0 flex-1 truncate">{e.text}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-ink-mute">
                  <span className={/delivered/.test(e.status) ? "text-verified" : /failed/.test(e.status) ? "text-danger" : ""}>
                    {e.status}
                  </span>
                  <span className="font-mono">{String(e.at || "").slice(11, 19)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Roadmap */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-mute">Roadmap</div>
        <ul className="space-y-1">
          {ROADMAP.map((r) => (
            <li key={r.name} className="flex items-baseline gap-2 rounded-lg px-2 py-1 opacity-70">
              <span className="w-20 shrink-0 text-[12px] font-semibold text-ink-soft">{r.name}</span>
              <span className="text-[11px] text-ink-mute">{r.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
