// LandingPage.jsx — the pitch page shown before the cockpit. Written for a lay audience
// (the hackathon finals present at the House of Lords): analogy-first, regulator-sourced
// numbers only, problem → stakes → solution → proof. All stats are cited inline; the
// folklore COBOL numbers (220bn/800bn lines etc.) are deliberately absent.
const STATS = [
  {
    big: "£48.65m",
    text: "the fine when one UK bank's system change went wrong. The CEO resigned. The CIO was fined personally.",
    source: "FCA & PRA, 2022–23 (TSB)",
  },
  {
    big: "1 in 4",
    text: "high-severity incidents at UK financial firms are caused by failed technology changes.",
    source: "FCA review of 1m+ production changes, 2021",
  },
  {
    big: "90%+",
    text: "of UK financial firms still depend on legacy technology to serve customers.",
    source: "FCA, 2021",
  },
];

const REG_MAP = [
  {
    reg: "FCA Consumer Duty",
    demand: "Boards must evidence good customer outcomes.",
    us: "The demo change is a genuine Consumer Duty remediation — and the ledger is the board-ready evidence.",
  },
  {
    reg: "SM&CR",
    demand: "Named senior individuals are personally accountable for change.",
    us: "Every approval carries a named person and a typed rationale, sealed in a tamper-evident chain.",
  },
  {
    reg: "Operational resilience (PS21/3)",
    demand: "Firms must map the technology under important business services — in force since 31 March 2025.",
    us: "The parsed dependency graph and blast-radius stage are that mapping, at code level.",
  },
  {
    reg: "EU AI Act, Article 14",
    demand: "High-risk AI must be designed for effective human oversight.",
    us: "Nothing executes without approval; every AI claim is labelled verified or inferred so the human can calibrate trust.",
  },
];

export default function LandingPage({ onEnter }) {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-16 sm:px-8">
      {/* ---------- HERO ---------- */}
      <header className="mb-14 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-2xl shadow-xl shadow-indigo-900/40">
          🛰️
        </div>
        <h1 className="mx-auto max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl">
          You can&rsquo;t close a bank to fix it.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          Britain&rsquo;s banks run on code written before the moon landing. <span className="font-semibold text-slate-100">Legacy Move</span>{" "}
          lets engineers change it safely while the bank keeps running — AI does the reading,{" "}
          <span className="font-semibold text-slate-100">a named human signs every change</span>.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onEnter}
            className="rounded-xl bg-indigo-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400"
          >
            Enter the cockpit →
          </button>
          <span className="text-xs text-slate-500">Live demo on IBM&rsquo;s own sample banking system (CBSA).</span>
        </div>
      </header>

      {/* ---------- STAT STRIP ---------- */}
      <section className="mb-14 grid gap-3 sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.big} className="rounded-2xl border border-slate-700/60 bg-ink-900/60 p-5 text-center shadow-xl shadow-black/20">
            <div className="text-3xl font-bold text-slate-50">{s.big}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{s.text}</p>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">{s.source}</p>
          </div>
        ))}
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="mb-14">
        <h2 className="mb-6 text-center text-2xl font-bold text-slate-100">How it works</h2>
        <div className="space-y-4">
          <Step n="1" title="Say what needs to change, in plain English.">
            &ldquo;Cap overdraft fees to comply with Consumer Duty.&rdquo; Legacy Move reads the actual source code — sixty years of it
            — and breaks the request into a handful of small, ordered steps you can see on one screen. Every connection between
            steps is labelled: <b className="text-emerald-300">verified</b> against the real code, or merely{" "}
            <b className="text-amber-300">suggested</b> by the AI. You always know which is which.
          </Step>
          <Step n="2" title="Approve the plan before anything happens.">
            The plan opens as a draft. An engineer can rename, re-order or delete any step. Nothing — nothing — executes until they
            click Approve. <i className="text-slate-200">The machine proposes; the person disposes.</i>
          </Step>
          <Step n="3" title="Make each change with your hands on the controls.">
            For every step, the cockpit shows exactly which lines are involved, explains the old code in plain English, maps the
            blast radius — every program the change could touch — and drafts the smallest possible edit. The engineer accepts it,
            rejects it, or rewrites it by hand. Then they sign their reason.
          </Step>
        </div>
      </section>

      {/* ---------- HUMAN IN CONTROL ---------- */}
      <section className="mb-14 rounded-2xl border border-slate-700/60 bg-ink-900/60 p-7 shadow-xl shadow-black/20">
        <h2 className="text-xl font-bold text-slate-100">&ldquo;The AI never touches the code. People do.&rdquo;</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
          There is <b className="text-slate-100">no deploy button</b> in this product. It reads code and proposes; a named engineer
          edits, accepts or rejects. Every claim the AI makes is labelled <b className="text-emerald-300">verified</b> — checked
          against the real, parsed structure of the code — or <b className="text-amber-300">inferred</b> — its best guess, flagged
          as such. Engineers trust the machine exactly as much as it deserves, and no more.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
          The UK chose to govern AI through human accountability. Europe wrote human oversight into law.{" "}
          <b className="text-slate-100">We built both into the software</b>: the person who approves a change is named, their
          reasoning is recorded, and they could defend every decision to their regulator tomorrow morning.
        </p>
      </section>

      {/* ---------- PROVABLE ---------- */}
      <section className="mb-14 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] p-7">
        <h2 className="text-xl font-bold text-emerald-200">&ldquo;An audit trail you can test, not just read.&rdquo;</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
          Every approval — the change, the person, the reason, the timestamp — is sealed into a cryptographic chain, each record
          locked to the one before it. Alter a single word of the history and verification fails, visibly, immediately. Most audit
          trails are promises. <b className="text-emerald-200">This one is a proof.</b> For a Senior Manager who is personally
          accountable under UK law, that is the difference between &ldquo;we believe we took reasonable steps&rdquo; and{" "}
          <b className="text-emerald-200">&ldquo;here is the evidence that we did.&rdquo;</b>
        </p>
      </section>

      {/* ---------- WHY NOT A CHATBOT ---------- */}
      <section className="mb-14">
        <h2 className="mb-2 text-center text-2xl font-bold text-slate-100">&ldquo;A chatbot gives you an answer. We give you evidence.&rdquo;</h2>
        <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-slate-400">
          Why not just buy the team an AI subscription? Because a subscription gives every engineer a brilliant intern —{" "}
          <b className="text-slate-200">Legacy Move gives the bank a governed change process with proof.</b>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <FactCard big="19.7%" text="of dependencies suggested by code LLMs are hallucinated — invented names asserted with full confidence." source="USENIX Security 2025, 576k samples" />
          <FactCard big="45%" text="of the time, LLMs chose the insecure implementation of a coding task. Newer models were no better." source="Veracode GenAI report, 2025" />
          <FactCard big="10.27%" text="GPT-4's score on COBOL programming tasks — versus 67% on Python. General AI does not know COBOL." source="COBOLEval, 2024" />
        </div>
        <blockquote className="mx-auto mt-6 max-w-2xl rounded-xl border border-slate-700/60 bg-ink-950/50 p-5 text-[14px] leading-relaxed text-slate-300">
          GitHub&rsquo;s own documentation: the Copilot Enterprise audit log{" "}
          <i>&ldquo;does not include client session data, such as the prompts a user sends&rdquo;</i> — retained 180 days.
          <span className="mt-2 block font-semibold text-slate-100">
            When the regulator asks why the overdraft logic changed, a licence log is not an answer. A hash-chained record of who
            approved what, why, and on what verified evidence — is.
          </span>
        </blockquote>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-slate-400">
          Every funded competitor sells the <i>exit</i> from COBOL — the multi-year migration that most firms start and never
          finish. Legacy Move is for the decades in between: <b className="text-slate-200">changing the code you keep. Safely. In place.</b>
        </p>
      </section>

      {/* ---------- REGULATORY MAP ---------- */}
      <section className="mb-14">
        <h2 className="mb-5 text-center text-2xl font-bold text-slate-100">Built for the rules banks already live under</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-700/60">
          {REG_MAP.map((r, i) => (
            <div key={r.reg} className={`grid gap-1 p-4 sm:grid-cols-[200px_1fr] ${i % 2 ? "bg-ink-900/40" : "bg-ink-950/40"}`}>
              <div className="text-sm font-semibold text-indigo-300">{r.reg}</div>
              <div>
                <p className="text-[13px] text-slate-400">{r.demand}</p>
                <p className="mt-0.5 text-[13px] text-slate-200">→ {r.us}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- SIGNATURE LINE ---------- */}
      <section className="mb-14 text-center">
        <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-slate-200">
          &ldquo;You restore a listed building under consent: survey first, small documented alterations, a named person approving
          each one, everything in the register.
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-lg font-bold leading-relaxed text-slate-50">
          We built listed-building consent for the code that runs Britain&rsquo;s banks.&rdquo;
        </p>
      </section>

      {/* ---------- CLOSING CTA ---------- */}
      <section className="text-center">
        <h2 className="text-xl font-bold text-slate-100">The banks that run Britain were built to last. Help them change safely.</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          Watch a real sixty-year-old banking system get a real regulatory change — planned, approved, applied and sealed into the
          record.
        </p>
        <button
          type="button"
          onClick={onEnter}
          className="mt-6 rounded-xl bg-indigo-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400"
        >
          Enter the cockpit →
        </button>
        <p className="mt-8 text-[11px] text-slate-600">
          Built at the UK AI Agent Hack × Conduct.AI · demo corpus: IBM&rsquo;s CICS Banking Sample Application ·
          proposal-only by design — Legacy Move has no write access to source or production.
        </p>
      </section>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-slate-700/60 bg-ink-900/50 p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-base font-bold text-indigo-300">
        {n}
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-400">{children}</p>
      </div>
    </div>
  );
}

function FactCard({ big, text, source }) {
  return (
    <div className="rounded-2xl border border-slate-700/60 bg-ink-900/50 p-5 text-center">
      <div className="text-2xl font-bold text-rose-300">{big}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{text}</p>
      <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">{source}</p>
    </div>
  );
}
