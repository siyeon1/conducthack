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
    <section className="rounded-2xl border border-slate-700/60 bg-ink-900/60 shadow-xl shadow-black/20 backdrop-blur-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700/50 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
          ⛓
        </span>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-slate-100">
            Tamper-evident ledger
          </h2>
          <p className="text-xs text-slate-400">
            SHA-256 hash-chained · RFC 8785 canonical JSON · every approval appended
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={doVerify}
            disabled={busy || !sessionId}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
          >
            Verify integrity
          </button>
          <button
            type="button"
            onClick={doTamper}
            disabled={busy || !sessionId || !list.length}
            title="Demo only: silently mutate a recorded entry to prove the chain detects it"
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
          >
            ⚠ Tamper (demo)
          </button>
        </div>
      </header>

      <div className="px-5 py-4">
        {err && (
          <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
            <span className="font-semibold">Error:</span> {err.error}
          </div>
        )}

        {verify && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
              verify.verified
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/50 bg-rose-500/15 text-rose-200"
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
          <div className="rounded-lg border border-dashed border-slate-700/60 bg-ink-950/40 px-4 py-8 text-center text-sm text-slate-500">
            No entries yet. Approve a proposal to append the first ledger entry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
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
                      className={`border-t border-slate-700/40 align-top ${
                        broken ? "bg-rose-500/10" : ""
                      }`}
                    >
                      <td className="px-2 py-2.5 font-mono text-slate-400">
                        {e.index}
                      </td>
                      <td className="max-w-[260px] px-2 py-2.5 text-slate-300">
                        {e.intent}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(e.programs || []).map((p) => (
                            <span
                              key={p}
                              className="rounded bg-slate-700/40 px-1.5 py-0.5 font-mono text-[11px] text-slate-300"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                          {e.decision}
                        </span>
                      </td>
                      <td className="max-w-[240px] px-2 py-2.5 text-[12px] italic text-slate-400">
                        {e.rationale ? (
                          `“${e.rationale}”`
                        ) : (
                          <span className="not-italic text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[12px] text-slate-400">
                        {e.approver}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-slate-500">
                        {short(e.prev_hash)}{" "}
                        <span className="text-slate-600">→</span>{" "}
                        <span className={broken ? "text-rose-300" : "text-slate-400"}>
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
