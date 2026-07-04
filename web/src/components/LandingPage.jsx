import { Fragment, useEffect, useRef, useState } from "react";

// LandingPage.jsx — the shft product site (brand kit v1.0, §08 "Brand in action" shape),
// polished to commercial grade: one confident dark hero with a single Shift-Purple glow +
// blueprint grid, a deliberate paper → tint → one-more-dark-band cadence, scroll-reveal,
// premium layered cards, and an honest "built against" trust strip. Restraint is the signal:
// purple does all the accent work; coral is spent only on the human-approval moment.
const STATS = [
  { big: "£48.65m", label: "TSB fine for a failed change", source: "FCA & PRA, 2022–23" },
  { big: "1 in 4", label: "incidents caused by change", source: "FCA · 1m+ changes reviewed" },
  { big: "90%+", label: "firms still on legacy tech", source: "FCA, 2021" },
];

const PRINCIPLES = [
  {
    n: "01",
    k: "Parse, don't infer",
    d: "A deterministic parser builds the dependency graph. The AI proposes; the parser grades every claim verified or inferred.",
  },
  {
    n: "02",
    k: "Control beats autonomy",
    d: "There is no deploy button. A named engineer edits, approves and signs every change with a typed justification.",
  },
  {
    n: "03",
    k: "A promise becomes a proof",
    d: "Each approval is hash-chained into a tamper-evident ledger. Edit the history and verification fails — visibly, immediately.",
  },
];

const REG_MAP = [
  { reg: "FCA Consumer Duty", demand: "Boards must evidence good customer outcomes.", us: "The demo change is a genuine Consumer Duty remediation — and the ledger is the board-ready evidence." },
  { reg: "SM&CR", demand: "Named senior individuals are personally accountable for change.", us: "Every approval carries a named person and a typed rationale, sealed in a tamper-evident chain." },
  { reg: "Operational resilience (PS21/3)", demand: "Firms must map the technology under important business services — in force since 31 March 2025.", us: "The parsed dependency graph and blast-radius stage are that mapping, at code level." },
  { reg: "EU AI Act, Article 14", demand: "High-risk AI must be designed for effective human oversight.", us: "Nothing executes without approval; every AI claim is labelled verified or inferred so the human can calibrate trust." },
];

export default function LandingPage({ onEnter }) {
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);

  // Sticky-nav state — frosted/condensed once the page scrolls past most of the hero.
  // A scroll check (not IntersectionObserver) so it's robust and works in preview contexts.
  useEffect(() => {
    const onScroll = () => {
      const heroH = heroRef.current ? heroRef.current.offsetHeight : 480;
      setScrolled(window.scrollY > heroH - 72);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Scroll-reveal — add .is-in once an element is within ~92% of the viewport height.
  // A rect/scroll check (not IntersectionObserver) so it's robust everywhere: content is never
  // left permanently hidden, and it works in non-compositing preview contexts. Reveal-once;
  // CSS renders the final state under prefers-reduced-motion regardless.
  useEffect(() => {
    let pending = Array.from(document.querySelectorAll(".reveal"));
    let safety;
    const cleanup = () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      clearTimeout(safety);
    };
    const reveal = () => {
      const h = window.innerHeight || document.documentElement.clientHeight;
      pending = pending.filter((el) => {
        if (el.getBoundingClientRect().top < h * 0.92) {
          el.classList.add("is-in");
          return false;
        }
        return true;
      });
      if (!pending.length) cleanup();
    };
    // capture:true so a scroll on any inner container still triggers the check.
    const onScroll = () => window.requestAnimationFrame(reveal);
    reveal(); // reveal whatever is in view on mount
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    // Safety net — if scroll events never arrive, content is still never left hidden.
    safety = setTimeout(() => {
      pending.forEach((el) => el.classList.add("is-in"));
      pending = [];
      cleanup();
    }, 4000);
    return cleanup;
  }, []);

  const navLink = `link-underline ${scrolled ? "text-ink-soft hover:text-ink" : "text-white/70 hover:text-white"}`;

  return (
    <div className="min-h-full">
      {/* ---------- NAV ---------- */}
      <nav
        className={`sticky top-0 z-40 transition-all duration-enter ease-brand ${
          scrolled ? "border-b border-line bg-paper-light/75 shadow-card backdrop-blur-xl" : "bg-hero"
        }`}
      >
        <div className={`mx-auto flex max-w-6xl items-center gap-6 px-5 transition-all duration-enter ease-brand sm:px-8 ${scrolled ? "py-2.5" : "py-4"}`}>
          <span className={`wordmark text-2xl ${scrolled ? "text-brand-500" : "text-brand-400"}`}>shft</span>
          <div className="ml-3 hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#product" className={navLink}>Product</a>
            <a href="#proof" className={navLink}>Proof</a>
            <a href="#pricing" className={navLink}>Pricing</a>
          </div>
          <button type="button" onClick={onEnter} className="btn btn-primary ml-auto" style={{ padding: "8px 15px", fontSize: 13 }}>
            See the proof
          </button>
        </div>
      </nav>

      {/* ---------- HERO (the one dark band + the one glow) ---------- */}
      <header ref={heroRef} className="hero-grid hero-glow relative overflow-hidden bg-hero text-white">
        <span className="grain-dark" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 pb-28 pt-14 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="eyebrow mb-5 text-brand-400">Governed change · not autonomous AI</p>
              <h1 className="display-1 text-gradient-light font-sans">
                Change the code that runs banks — and prove you did it right.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
                Plain-English in. A verified, human-approved, tamper-evident change out. Every claim graded
                against the real source.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <button type="button" onClick={onEnter} className="btn btn-primary">
                  See the proof →
                </button>
              </div>
              <div className="eyebrow mt-7 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-white/40">
                <span>Fintech</span>
                <span className="text-white/20">·</span>
                <span>RegTech</span>
                <span className="text-white/20">·</span>
                <span>Developer tooling</span>
              </div>
            </div>

            {/* Ledger proof card — framed as a real product artifact (app chrome + the reserved glow). */}
            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-pop backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                </span>
                <span className="ml-1 font-mono text-[11px] text-white/40">shft · cockpit</span>
                <span className="badge b-verified ml-auto">✓ Verified · parsed</span>
              </div>
              <div className="p-4 font-mono text-[12.5px]">
                <div className="mb-2 flex items-center justify-between text-white/40">
                  <span>tamper-evident ledger</span>
                  <span>entry #4</span>
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
        </div>
      </header>

      {/* ---------- CREDIBILITY BAND (stats overlap the hero + honest "built against" strip) ---------- */}
      <section className="bg-paper">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="relative z-10 -mt-20 grid gap-3 sm:grid-cols-3">
            {STATS.map((s, i) => (
              <div
                key={s.big}
                className="reveal card-premium card-lift rounded-xl border border-line bg-paper-light p-5 text-center"
                style={{ "--reveal-delay": `${i * 70}ms` }}
              >
                <div className="font-sans text-3xl font-extrabold tracking-display text-brand-500">{s.big}</div>
                <p className="mt-2 text-[13.5px] font-medium leading-snug text-ink">{s.label}</p>
                <p className="eyebrow mt-2 text-ink-mute">{s.source}</p>
              </div>
            ))}
          </div>

          <div className="reveal mt-12 border-t border-line pt-6">
            <p className="eyebrow mb-3 text-center text-ink-mute">Built against</p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {REG_MAP.map((r, i) => (
                <Fragment key={r.reg}>
                  {i > 0 && <span className="text-line" aria-hidden>·</span>}
                  <span className="font-mono text-[12px] text-ink-mute/80 transition-colors hover:text-ink">
                    {r.reg}
                  </span>
                </Fragment>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-ink-mute">
              Demo corpus: IBM CBSA · every figure FCA/PRA/paper-sourced
            </p>
          </div>
        </div>
      </section>

      {/* ---------- PRINCIPLES (id=product) — bento, on a faint brand tint ---------- */}
      <section id="product" className="scroll-mt-24 border-y border-line bg-brand-50/40 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="reveal eyebrow text-center text-brand-500">The idea</p>
          <h2 className="reveal display-2 mt-2 text-center font-sans text-ink">Change, made provable.</h2>
          <p className="reveal mx-auto mt-3 max-w-2xl text-center text-[15px] leading-relaxed text-ink-soft">
            A shift, not a rewrite. shft governs change in the COBOL banks are keeping — it doesn&rsquo;t migrate
            it away.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {/* 01 — the anchor cell */}
            <div className="reveal card-premium card-lift rounded-2xl border border-line bg-paper-light p-6 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-xl">
                  <div className="eyebrow text-brand-400">{PRINCIPLES[0].n}</div>
                  <h3 className="mt-2 font-sans text-xl font-bold text-ink">{PRINCIPLES[0].k}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{PRINCIPLES[0].d}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <span className="badge b-verified">✓ Verified · parsed</span>
                  <span className="badge b-inferred">~ Inferred · LLM</span>
                </div>
              </div>
            </div>
            {PRINCIPLES.slice(1).map((p, i) => (
              <div
                key={p.n}
                className="reveal card-premium card-lift rounded-2xl border border-line bg-paper-light p-6"
                style={{ "--reveal-delay": `${(i + 1) * 70}ms` }}
              >
                <div className="eyebrow text-brand-400">{p.n}</div>
                <h3 className="mt-2 font-sans text-lg font-bold text-ink">{p.k}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS + mid-page CTA ---------- */}
      <section className="bg-paper py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <h2 className="reveal display-2 mb-8 text-center font-sans text-ink">How it works</h2>
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
          <div className="reveal mt-10 text-center">
            <button type="button" onClick={onEnter} className="btn btn-primary">
              See a real COBOL change reviewed end-to-end →
            </button>
          </div>
        </div>
      </section>

      {/* ---------- HUMAN IN CONTROL — the one extra dark band (coral earns its place: the human gate) ---------- */}
      <section className="hero-grid relative overflow-hidden bg-hero py-20 text-white sm:py-28">
        <span className="grain-dark" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-coral-400/40 bg-coral-400/10 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-coral-400">
            ✋ Human-gated
          </span>
          <h2 className="reveal mt-4 font-sans text-2xl font-bold tracking-tight text-white sm:text-3xl">
            &ldquo;The AI never touches the code. People do.&rdquo;
          </h2>
          <p className="reveal mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70">
            There is <b className="text-white">no deploy button</b> in this product. It reads code and proposes; a
            named engineer edits, accepts or rejects. Every claim the AI makes is labelled{" "}
            <span className="badge b-verified">✓ Verified · parsed</span> — checked against the real, parsed
            structure of the code — or <span className="badge b-inferred">~ Inferred · LLM</span> — its best
            guess, flagged as such. Engineers trust the machine exactly as much as it deserves, and no more.
          </p>
          <p className="reveal mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70">
            The UK chose to govern AI through human accountability. Europe wrote human oversight into law.{" "}
            <b className="text-white">We built both into the software</b>: the person who approves a change is
            named, their reasoning is recorded, and they could defend every decision to their regulator tomorrow
            morning.
          </p>
        </div>
      </section>

      {/* ---------- PROVABLE (id=proof) ---------- */}
      <section id="proof" className="scroll-mt-24 bg-paper py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="reveal card-premium rounded-2xl border border-verified/30 bg-verified-tint/60 p-7">
            <span className="badge b-danger">✕ Tamper detected</span>
            <h2 className="mt-3 font-sans text-xl font-bold text-verified sm:text-2xl">
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
          </div>
        </div>
      </section>

      {/* ---------- WHY NOT A CHATBOT ---------- */}
      <section className="border-y border-line bg-brand-50/40 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <h2 className="reveal display-2 mb-2 text-center font-sans text-ink">
            &ldquo;A chatbot gives you an answer. We give you evidence.&rdquo;
          </h2>
          <p className="reveal mx-auto mb-8 max-w-2xl text-center text-sm text-ink-soft">
            Why not just buy the team an AI subscription? Because a subscription gives every engineer a brilliant
            intern — <b className="text-ink">shft gives the bank a governed change process with proof.</b>
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <FactCard i={0} big="19.7%" text="of dependencies suggested by code LLMs are hallucinated — invented names asserted with full confidence." source="USENIX Security 2025, 576k samples" />
            <FactCard i={1} big="45%" text="of the time, LLMs chose the insecure implementation of a coding task. Newer models were no better." source="Veracode GenAI report, 2025" />
            <FactCard i={2} big="10.27%" text="GPT-4's score on COBOL programming tasks — versus 67% on Python. General AI does not know COBOL." source="COBOLEval, 2024" />
          </div>
          <blockquote className="reveal card-premium mx-auto mt-6 max-w-2xl rounded-xl border border-line bg-paper-light p-5 text-[14px] leading-relaxed text-ink-soft">
            GitHub&rsquo;s own documentation: the Copilot Enterprise audit log{" "}
            <i>&ldquo;does not include client session data, such as the prompts a user sends&rdquo;</i> — retained
            180 days.
            <span className="mt-2 block font-semibold text-ink">
              When the regulator asks why the overdraft logic changed, a licence log is not an answer. A
              hash-chained record of who approved what, why, and on what verified evidence — is.
            </span>
          </blockquote>
        </div>
      </section>

      {/* ---------- REGULATORY MAP ---------- */}
      <section className="bg-paper py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <h2 className="reveal display-2 mb-6 text-center font-sans text-ink">
            Built for the rules banks already live under
          </h2>
          <div className="reveal card-premium overflow-hidden rounded-2xl border border-line">
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
        </div>
      </section>

      {/* ---------- SIGNATURE LINE ---------- */}
      <section className="bg-paper pb-24 text-center">
        <div className="reveal mx-auto max-w-2xl px-5 sm:px-8">
          <p className="text-lg font-medium leading-relaxed text-ink-soft">
            &ldquo;You restore a listed building under consent: survey first, small documented alterations, a
            named person approving each one, everything in the register.
          </p>
          <p className="mt-2 font-sans text-lg font-extrabold leading-relaxed tracking-tight text-ink">
            We built listed-building consent for the code that runs Britain&rsquo;s banks.&rdquo;
          </p>
        </div>
      </section>

      {/* ---------- GET ACCESS (id=pricing) ---------- */}
      <section id="pricing" className="scroll-mt-24 bg-paper pb-24">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="reveal card-premium rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center">
            <p className="eyebrow text-brand-500">Get access</p>
            <h2 className="mt-2 font-sans text-2xl font-extrabold tracking-tight text-ink">
              Runs in your environment. Talk to us.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
              Parsing, the dependency graph and the ledger stay local; the model runs in your own cloud or under
              a zero-retention agreement. See the proof, then let&rsquo;s map it to your estate.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={onEnter} className="btn btn-primary">
                See the proof →
              </button>
            </div>
            <div className="mt-5 flex justify-center">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-mute">
                <span className="text-verified">✓</span> Parsing &amp; ledger stay local · zero-retention model
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-line bg-paper-light">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <div className="grid gap-8 sm:grid-cols-[1.6fr_1fr_1fr]">
            <div>
              <span className="wordmark text-2xl text-brand-500">shft</span>
              <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-ink-soft">
                The governed way to change legacy code. A shift, not a rewrite.
              </p>
            </div>
            <div>
              <div className="eyebrow mb-3 text-ink-mute">Product</div>
              <ul className="space-y-2 text-sm text-ink-soft">
                <li><a href="#product" className="link-underline hover:text-ink">How it works</a></li>
                <li><a href="#proof" className="link-underline hover:text-ink">Proof</a></li>
                <li><a href="#pricing" className="link-underline hover:text-ink">Get access</a></li>
              </ul>
            </div>
            <div>
              <div className="eyebrow mb-3 text-ink-mute">Built at</div>
              <ul className="space-y-2 text-sm text-ink-soft">
                <li>UK AI Agent Hack × Conduct.AI</li>
                <li>Demo corpus: IBM CBSA</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[11px] text-ink-mute">
            <span>© 2026 shft · proposal-only by design — no write access to source or production.</span>
            <span className="eyebrow text-brand-400">parse, don&rsquo;t infer</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="reveal card-premium card-lift flex gap-4 rounded-2xl border border-line bg-paper-light p-5">
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

function FactCard({ big, text, source, i = 0 }) {
  return (
    <div
      className="reveal card-premium card-lift rounded-xl border border-line bg-paper-light p-5 text-center"
      style={{ "--reveal-delay": `${i * 70}ms` }}
    >
      <div className="font-sans text-2xl font-extrabold tracking-display text-magenta-700">{big}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{text}</p>
      <p className="eyebrow mt-3 text-ink-mute">{source}</p>
    </div>
  );
}
