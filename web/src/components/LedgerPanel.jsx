// LedgerPanel.jsx — the tamper-evident ledger view + integrity verification.
// Lists hash-chained entries and lets the user Verify (re-walk the chain) or
// fire a demo "Tamper" that mutates an entry so Verify then FAILS and points at
// the first broken index.
import { useState } from "react";
import { getLedger, verifyLedger, tamperLedger } from "../api.js";

const short = (h) => (h ? `${String(h).slice(0, 10)}…` : "∅ genesis");

export default function LedgerPanel({ sessionId, entries, onRefresh }) {
  const [verify, setVerify] = useState(null); // {verified, broken_at} | null
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const list = entries || [];

  async function doVerify() {
    if (!sessionId) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await verifyLedger(sessionId);
      setVerify(res);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  async function doTamper() {
    if (!sessionId) return;
    setBusy(true);
    setErr(null);
    try {
      await tamperLedger(sessionId);
      const led = await getLedger(sessionId);
      onRefresh && onRefresh(led);
      setVerify(null); // force a fresh Verify to reveal the break
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper-light shadow-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-verified-tint text-verified">
          ⛓
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-ink">
            Tamper-evident ledger
          </h2>
          <p className="text-xs text-ink-soft">
            SHA-256 hash-chained · RFC 8785 canonical JSON · every approval appended
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={doVerify}
            disabled={busy || !sessionId}
            className="rounded-lg border border-verified/40 bg-verified-tint px-3 py-1.5 text-sm font-semibold text-verified transition hover:brightness-95 disabled:opacity-40"
          >
            Verify integrity
          </button>
          <button
            type="button"
            onClick={doTamper}
            disabled={busy || !sessionId || !list.length}
            title="Demo only: silently mutate a recorded entry to prove the chain detects it"
            className="rounded-lg border border-danger/40 bg-danger-tint px-3 py-1.5 text-sm font-semibold text-[#b02138] transition hover:brightness-95 disabled:opacity-40"
          >
            ⚠ Tamper (demo)
          </button>
        </div>
      </header>

      <div className="px-5 py-4">
        {err && (
          <div className="mb-3 rounded-lg border border-danger/40 bg-danger-tint px-4 py-2 text-sm text-[#b02138]">
            <span className="font-semibold">Error:</span> {err.error}
          </div>
        )}

        {verify && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
              verify.verified
                ? "border-verified/40 bg-verified-tint text-verified"
                : "border-danger/50 bg-danger-tint text-[#b02138]"
            }`}
          >
            {verify.verified ? (
              <>
                <span className="text-lg">✓</span> Chain intact — every entry hashes
                to its recorded value and links to its predecessor.
              </>
            ) : (
              <>
                <span className="text-lg">✕</span> Integrity FAILED — chain broken at
                index&nbsp;
                <span className="font-mono font-bold">{verify.broken_at}</span>. A
                recorded entry no longer matches its hash.
              </>
            )}
          </div>
        )}

        {!list.length ? (
          <div className="rounded-lg border border-dashed border-line bg-paper px-4 py-8 text-center text-sm text-ink-mute">
            No entries yet. Approve a proposal to append the first ledger entry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-mute">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Intent</th>
                  <th className="px-2 py-2 font-medium">Programs</th>
                  <th className="px-2 py-2 font-medium">Decision</th>
                  <th className="px-2 py-2 font-medium">Justification</th>
                  <th className="px-2 py-2 font-medium">Approver</th>
                  <th className="px-2 py-2 font-medium">prev → entry hash</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e, i) => {
                  const broken = verify && !verify.verified && verify.broken_at === e.index;
                  return (
                    <tr
                      key={e.index ?? i}
                      className={`border-t border-line align-top ${
                        broken ? "bg-danger-tint" : ""
                      }`}
                    >
                      <td className="px-2 py-2.5 font-mono text-ink-soft">
                        {e.index}
                      </td>
                      <td className="max-w-[260px] px-2 py-2.5 text-ink-soft">
                        {e.intent}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(e.programs || []).map((p) => (
                            <span
                              key={p}
                              className="rounded bg-paper-dark px-1.5 py-0.5 font-mono text-[11px] text-ink-soft"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="badge b-verified">
                          {e.decision}
                        </span>
                      </td>
                      <td className="max-w-[240px] px-2 py-2.5 text-[12px] italic text-ink-soft">
                        {e.rationale ? (
                          `“${e.rationale}”`
                        ) : (
                          <span className="not-italic text-ink-mute">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[12px] text-ink-soft">
                        {e.approver}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-ink-mute">
                        {short(e.prev_hash)}{" "}
                        <span className="text-ink-mute">→</span>{" "}
                        <span className={broken ? "text-[#b02138]" : "text-ink-soft"}>
                          {short(e.entry_hash)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
