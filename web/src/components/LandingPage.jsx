// LandingPage.jsx — the pitch page, set in the shft brand system (brand kit v1.0):
// dark hero (the kit's one confident dark section) → regulator-sourced proof strip →
// plain-English steps → human-in-control → provable-not-promised → why-not-a-chatbot →
// regulatory map → the signature line. Copy anchored in FCA/PRA figures only.
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
    <div className="min-h-full">
      {/* ---------- HERO — the one confident dark section ---------- */}
      <header className="bg-hero text-white">
        <div className="mx-auto max-w-5xl px-5 pb-16 pt-14 sm:px-8">
          <div className="mb-10 flex items-center justify-between">
            <span className="wordmark text-3xl text-brand-400">shft</span>
            <span className="badge b-brand">✦ governed change · not autonomous AI</span>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h1 className="font-sans text-4xl font-extrabold leading-[1.05] tracking-display sm:text-5xl">
                Change the code that runs banks — and prove you did it right.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
                Plain-English in. A verified, human-approved, tamper-evident change out. Every claim graded
                against the real source.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={onEnter} className="btn btn-primary">
                  See the proof →
                </button>
                <span className="text-xs text-white/40">
                  Live demo on IBM&rsquo;s own sample banking system (CBSA).
                </span>
              </div>
            </div>

            {/* Mini ledger proof card (the kit's hero visual) */}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 font-mono text-[12.5px]">
              <div className="mb-3 flex items-center justify-between">
                <span className="badge b-verified">✓ Verified · parsed</span>
                <span className="text-white/40">ledger · entry #4</span>
              </div>
              {[
                ["intent", "cap overdraft fee · XFRFUN"],
                ["approver", "engineer@bank"],
                ["rationale", "mirrors MORTGAGE/LOAN guard"],
                ["entry_hash", "a1b2c3d4e5f6…"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-t border-white/10 py-1.5">
                  <span className="text-white/40">{k}</span>
                  <span className="truncate text-white/85">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24 sm:px-8">
        {/* ---------- STAT STRIP ---------- */}
        <section className="-mt-8 mb-16 grid gap-3 sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.big} className="rounded-xl border border-line bg-paper-light p-5 text-center shadow-card">
              <div className="font-sans text-3xl font-extrabold tracking-display text-brand-500">{s.big}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{s.text}</p>
              <p className="eyebrow mt-3 text-ink-mute">{s.source}</p>
            </div>
          ))}
        </section>

        {/* ---------- HOW IT WORKS ---------- */}
        <section className="mb-16">
          <h2 className="mb-6 text-center font-sans text-2xl font-bold tracking-tight text-ink">How it works</h2>
          <div className="space-y-4">
            <Step n="1" title="Say what needs to change, in plain English.">
              &ldquo;Cap overdraft fees to comply with Consumer Duty.&rdquo; shft reads the actual source code —
              sixty years of it — and breaks the request into a handful of small, ordered steps you can see on
              one screen. Every connection between steps is labelled: <b className="text-verified">verified</b>{" "}
              against the real code, or merely <b className="text-[#8A6410]">suggested</b> by the AI. You always
              know which is which.
            </Step>
            <Step n="2" title="Approve the plan before anything happens.">
              The plan opens as a draft. An engineer can rename, re-order or delete any step. Nothing — nothing —
              executes until they click Approve. <i className="text-ink">The machine proposes; the person disposes.</i>
            </Step>
            <Step n="3" title="Make each change with your hands on the controls.">
              For every step, the cockpit shows exactly which lines are involved, explains the old code in plain
              English, maps the blast radius — every program the change could touch — and drafts the smallest
              possible edit. The engineer accepts it, rejects it, or rewrites it by hand. Then they sign their
              reason.
            </Step>
          </div>
        </section>

        {/* ---------- HUMAN IN CONTROL ---------- */}
        <section className="mb-16 rounded-2xl border border-line bg-paper-light p-7 shadow-card">
          <h2 className="font-sans text-xl font-bold text-ink">&ldquo;The AI never touches the code. People do.&rdquo;</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            There is <b className="text-ink">no deploy button</b> in this product. It reads code and proposes; a
            named engineer edits, accepts or rejects. Every claim the AI makes is labelled{" "}
            <span className="badge b-verified">✓ Verified · parsed</span> — checked against the real, parsed
            structure of the code — or <span className="badge b-inferred">~ Inferred · LLM</span> — its best
            guess, flagged as such. Engineers trust the machine exactly as much as it deserves, and no more.
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            The UK chose to govern AI through human accountability. Europe wrote human oversight into law.{" "}
            <b className="text-ink">We built both into the software</b>: the person who approves a change is
            named, their reasoning is recorded, and they could defend every decision to their regulator tomorrow
            morning.
          </p>
        </section>

        {/* ---------- PROVABLE ---------- */}
        <section className="mb-16 rounded-2xl border border-verified/30 bg-verified-tint/60 p-7">
          <h2 className="font-sans text-xl font-bold text-verified">
            &ldquo;An audit trail you can test, not just read.&rdquo;
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Every approval — the change, the person, the reason, the timestamp — is sealed into a cryptographic
            chain, each record locked to the one before it. Alter a single word of the history and verification
            fails, visibly, immediately. Most audit trails are promises.{" "}
            <b className="text-verified">This one is a proof.</b> For a Senior Manager who is personally
            accountable under UK law, that is the difference between &ldquo;we believe we took reasonable
            steps&rdquo; and <b className="text-verified">&ldquo;here is the evidence that we did.&rdquo;</b>
          </p>
        </section>

        {/* ---------- WHY NOT A CHATBOT ---------- */}
        <section className="mb-16">
          <h2 className="mb-2 text-center font-sans text-2xl font-bold tracking-tight text-ink">
            &ldquo;A chatbot gives you an answer. We give you evidence.&rdquo;
          </h2>
          <p className="mx-auto mb-6 max-w-2xl text-center text-sm text-ink-soft">
            Why not just buy the team an AI subscription? Because a subscription gives every engineer a brilliant
            intern — <b className="text-ink">shft gives the bank a governed change process with proof.</b>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <FactCard big="19.7%" text="of dependencies suggested by code LLMs are hallucinated — invented names asserted with full confidence." source="USENIX Security 2025, 576k samples" />
            <FactCard big="45%" text="of the time, LLMs chose the insecure implementation of a coding task. Newer models were no better." source="Veracode GenAI report, 2025" />
            <FactCard big="10.27%" text="GPT-4's score on COBOL programming tasks — versus 67% on Python. General AI does not know COBOL." source="COBOLEval, 2024" />
          </div>
          <blockquote className="mx-auto mt-6 max-w-2xl rounded-xl border border-line bg-paper-light p-5 text-[14px] leading-relaxed text-ink-soft shadow-card">
            GitHub&rsquo;s own documentation: the Copilot Enterprise audit log{" "}
            <i>&ldquo;does not include client session data, such as the prompts a user sends&rdquo;</i> — retained
            180 days.
            <span className="mt-2 block font-semibold text-ink">
              When the regulator asks why the overdraft logic changed, a licence log is not an answer. A
              hash-chained record of who approved what, why, and on what verified evidence — is.
            </span>
          </blockquote>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-ink-soft">
            Every funded competitor sells the <i>exit</i> from COBOL — the multi-year migration most firms start
            and never finish. <b className="text-ink">A shift, not a rewrite</b>: shft is for the decades in
            between — changing the code you keep. Safely. In place.
          </p>
        </section>

        {/* ---------- REGULATORY MAP ---------- */}
        <section className="mb-16">
          <h2 className="mb-5 text-center font-sans text-2xl font-bold tracking-tight text-ink">
            Built for the rules banks already live under
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line shadow-card">
            {REG_MAP.map((r, i) => (
              <div key={r.reg} className={`grid gap-1 p-4 sm:grid-cols-[210px_1fr] ${i % 2 ? "bg-paper" : "bg-paper-light"}`}>
                <div className="text-sm font-semibold text-brand-700">{r.reg}</div>
                <div>
                  <p className="text-[13px] text-ink-mute">{r.demand}</p>
                  <p className="mt-0.5 text-[13px] text-ink-soft">→ {r.us}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- SIGNATURE LINE ---------- */}
        <section className="mb-16 text-center">
          <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-ink-soft">
            &ldquo;You restore a listed building under consent: survey first, small documented alterations, a
            named person approving each one, everything in the register.
          </p>
          <p className="mx-auto mt-2 max-w-2xl font-sans text-lg font-extrabold leading-relaxed tracking-tight text-ink">
            We built listed-building consent for the code that runs Britain&rsquo;s banks.&rdquo;
          </p>
        </section>

        {/* ---------- CLOSING CTA ---------- */}
        <section className="text-center">
          <h2 className="font-sans text-xl font-bold text-ink">
            The banks that run Britain were built to last. Help them change safely.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">
            Watch a real sixty-year-old banking system get a real regulatory change — planned, approved, applied
            and sealed into the record.
          </p>
          <button type="button" onClick={onEnter} className="btn btn-primary mt-6">
            See the proof →
          </button>
          <p className="mt-10 text-[11px] text-ink-mute">
            <span className="wordmark text-ink-soft">shft</span> · a shift, not a rewrite · built at the UK AI
            Agent Hack × Conduct.AI · demo corpus: IBM&rsquo;s CICS Banking Sample Application · proposal-only by
            design — no write access to source or production.
          </p>
        </section>
      </main>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-line bg-paper-light p-5 shadow-card">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 font-sans text-base font-bold text-brand-700">
        {n}
      </div>
      <div>
        <h3 className="font-sans text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

function FactCard({ big, text, source }) {
  return (
    <div className="rounded-xl border border-line bg-paper-light p-5 text-center shadow-card">
      <div className="font-sans text-2xl font-extrabold tracking-display text-magenta-700">{big}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{text}</p>
      <p className="eyebrow mt-3 text-ink-mute">{source}</p>
    </div>
  );
}
