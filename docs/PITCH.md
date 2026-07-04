# Legacy Move — Pitch Kit (House of Lords final)

All figures below are regulator-sourced and verifiable. The folklore COBOL stats
(220bn/800bn lines, "43% of banking") are deliberately absent — they trace to vendor
decks and a 2017 Reuters graphic; a judge who Googles them will find that out.

---

## The 90-second pitch (open with TSB, not COBOL)

> In 2018, a British bank changed its computer system. Two million people lost access
> to their money. The bank lost £330 million, the CEO resigned, and the regulators
> fined it £48.65 million — **and fined the CIO personally** under the Senior Managers
> regime.
>
> The regulator then studied over a million technology changes at UK financial firms
> and found that **one in four high-severity incidents is caused by a failed change** —
> and that **over 90% of firms still depend on legacy technology**.
>
> So the most dangerous thing a bank does is *change its own code* — sixty-year-old
> COBOL that the people who wrote it are retiring from, and the people replacing them
> were never taught.
>
> **Legacy Move makes the change itself safe.** You type the business change in plain
> English — "cap overdraft fees to comply with Consumer Duty." The system reads the
> real code — parsed, not guessed — and breaks the change into small, ordered steps on
> one screen. Every dependency is labelled **verified** against the source, or merely
> **inferred** by the AI. Nothing runs until a named engineer approves the plan.
>
> For each step, the cockpit shows the code, explains it in plain English, maps the
> blast radius, and drafts the smallest possible edit — which the engineer accepts,
> rejects, or rewrites by hand, then **signs with a typed justification** that is
> sealed into a tamper-evident ledger. Watch — *[tamper demo]* — if anyone edits
> history, verification fails. Visibly. Immediately.
>
> Every audit trail you've ever seen is a promise. **This one is a proof.**

### The signature line (for this room)

> "You restore a listed building under consent: survey first, small documented
> alterations, a named person approving each one, everything in the register.
> **We built listed-building consent for the code that runs Britain's banks.**"

(Consent = the approval gate · the register = the hash-chained ledger · the
conservation officer = the engineer. The Lords sit in a Grade I listed building
currently under the Restoration & Renewal programme — this analogy is theirs.)

---

## Demo beats (in order)

1. **Landing page** (10s) — the £48.65m / 1-in-4 / 90%+ stat strip.
2. **Type the change → Generate plan** — the DAG appears; point at one **verified**
   edge and one **inferred** edge: "the AI proposes; the parser grades it."
3. **Edit the plan** (drag/rename/delete) → **Approve plan** — "nothing ran until now."
   The Slack kickoff notification lands (open 🔌 Integrations or a real channel).
4. **Open a stage** → the code cockpit: culprit lines highlighted, Explain teaching one
   COBOL idiom (5 seconds — the emotional beat for this audience), the AI's diff inline,
   accept/edit/deny.
5. **Approve with a typed justification** → the ledger receipt hits the channel.
6. **The tamper moment** (the peak): "Every audit trail you've seen is a promise. Watch
   what happens when someone edits history in ours." → Tamper → Verify FAILS red →
   🚨 the Slack alarm fires.
7. Close on the audit trail + **Senior Manager evidence pack** export.

---

## Top-5 Q&A — 15-second spoken answers

**1. "So the AI writes code into a live banking system?"**
> No — there is no deploy button in this product. It reads code and proposes a diff; a
> named engineer edits and approves it with a typed justification that's
> cryptographically chained. Nothing is ever applied automatically. Control is the
> product.

**2. "How is this not a thin wrapper over Claude?"**
> Unplug Claude and the product still stands: a deterministic COBOL parser builds the
> dependency graph, every AI claim is tagged verified or inferred against it, and
> approvals go into a hash-chained ledger. Unplug the parser and it's a chatbot. The AI
> is our least trusted component — and the UI says so.

**3. "Who is liable when an AI-suggested change breaks payments?"**
> Exactly where the law puts it: the firm and its senior managers under SM&CR. When
> TSB's migration failed, regulators fined the bank £48 million — and the CIO
> personally — for failure of control and evidence. We don't move liability; we make
> accountability provable: named approver, typed rationale, tamper-evident ledger.

**4. "COBOL engineers are retiring — does this replace them?"**
> It's succession, not replacement. The average COBOL engineer is near retirement and
> universities stopped teaching it. This teaches COBOL idioms to the next generation,
> gives them the veteran's mental map of dependencies, and still requires a human to
> write, sign, and justify every change.

**5. "Why you and not IBM?"**
> IBM's Code Assistant helps you rewrite COBOL into Java — migration tooling, sold with
> the mainframe. We govern change in the COBOL you're keeping: plan approval,
> verified-versus-inferred evidence, an audit trail a regulator can check. Different
> job — and we demo it on IBM's own sample bank.

---

## "Why not just buy the team Copilot seats?"

| Dimension | LLM subscription | Legacy Move |
|---|---|---|
| Dependency truth | Inferred from context; 19.7% of suggested dependencies hallucinated (USENIX Sec. 2025) | COPY/CALL edges parsed deterministically; every edge tagged verified vs inferred |
| Planning | Freeform chat, different every time, no shared artifact | Editable, cycle-checked DAG — a durable, reviewable plan |
| Approval workflow | None — "approval" is pressing Tab | Draft → approve gate; typed rationale per stage; accept/edit/deny at the diff |
| Audit evidence | GitHub's own docs: the Copilot audit log "does not include client session data" (180-day retention) | RFC-8785 + SHA-256 hash chain + Merkle root; tamper → verification fails, demonstrably |
| Reproducibility | Temperature-0 output isn't bit-reproducible in production serving | Re-parse the same source → the identical graph. That's what makes evidence |
| Regulator fit | SOC 2 / SSO — controls about the *vendor* | The evidence artifact PS21/3 and SM&CR actually demand |

**Punchline:** *"A subscription gives every engineer a brilliant intern. Legacy Move
gives the bank a governed change process with proof."*

**Supporting stats (citable):** Veracode 2025 — LLMs chose the insecure implementation
45% of the time, newer models no better · Stanford (CCS 2023) — AI-assisted coders
write less secure code *and* trust it more · COBOLEval — GPT-4 solved 10.27% of COBOL
tasks vs 67% Python, under half compiled.

**Honest counter-cases (keep credibility):** for pure comprehension/onboarding chat, a
subscription is excellent and cheaper — our Explain cell runs on the same models. A
bank with rigorous CAB + PR review already has *a* change record; our edge is the
*linkage* — rationale → parsed evidence → diff — in one verifiable artifact. And we use
the same LLMs underneath: the claim is never "our model is smarter," it's "our harness
makes the model's claims checkable and its changes governed."

---

## The Conduct alignment (say to judges)

Conduct's platform "ingests custom code, configuration, and dependencies, and builds
one operating layer linking each step of a business process to the code that
implements it" — for SAP estates. **That is our worldview applied to COBOL banking:
parse, don't infer — plus a regulator-grade evidence layer on top.** And on workflow:
notifications flow to Slack, but approval deliberately stays in the cockpit — GitHub
lets you approve deployments from chat; we inverted that, because an approval here
requires a typed justification that gets hash-chained. Notification is cheap;
accountability is not.

---

## Never say / always say

- **Never** "the AI modernises COBOL automatically" — this room (post-TSB, post-Post
  Office Horizon) is primed to distrust automation that overrules humans. "Control
  beats autonomy" is the product, not an apology.
- **Never** "your code never leaves the machine" unqualified — parsing and the ledger
  are local; Explain/Propose send code snippets to the Claude API (in-VPC/zero-retention
  deployment is a config choice; say "roadmap", not "today").
- **Never** the folklore stats. **Always** TSB (£48.65m + personal CIO fine), the FCA's
  1-in-4, the 31 March 2025 operational-resilience deadline: *"every UK bank in this
  room is now legally required to evidence control of change to important business
  services. Today that evidence is Jira tickets and memory. We built the evidence
  layer."*

## Key sources

- FCA press release: TSB fined £48.65m (Dec 2022) · Bank of England: PRA fines former
  TSB CIO (Apr 2023)
- FCA "Implementing Technology Change" multi-firm review (Feb 2021) — 1m+ changes
- FCA PS21/3 / PRA SS1/21 operational resilience (deadline 31 Mar 2025)
- GitHub Docs: Copilot audit-log scope · USENIX Security 2025 (arXiv 2406.10279) ·
  Veracode 2025 GenAI Code Security Report · Stanford CCS 2023 (arXiv 2211.03622) ·
  COBOLEval (bloop.ai, 2024)
