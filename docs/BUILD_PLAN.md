# Blindspot v2: Build Plan

| | |
|---|---|
| Version | 2.0, 6 Oct 2026 |
| Status | Draft for approval |
| Companion files | `Blindspot_v2_PRD.md` (what and why), `Blindspot_v2_Tech_Spec.md` (how) |
| Planning basis | The 13 Oct deadline is ignored (decision D10). Work is organised for speed through parallel streams, not for a calendar. Effort is in agent-days, a judgment estimate. |

---

## 1. Plan in one page

Seven releases, six streams, five decision gates.

| Release | Outcome | Agent-days | Gate |
|---|---|---|---|
| R0 Foundations | Repo, contracts frozen, Blade shell, one-incident world | 2 | |
| R1 Detect, widen, attribute | Hero A readable end to end: alert, list, verdict, day-0 scan | 6 | G1 |
| R2 Fix and verify | Hero A actionable: staged fix, messages, dev page, verify, close | 5 | |
| R3 Channels and conversation | Customer messages on help entry, WhatsApp, email find the payment and join the incident | 9 | G3 |
| R4 Zone 1 and depth | Hero B, investigation agent, escalation, duplicates, three-way eval | 9 | G4 |
| R5 Learning and handovers | Learning loop, Instagram handover, public handoff, renewals | 5 | |
| R6 Real rails (stretch) | Real Razorpay test-mode objects and deliveries, optional real WhatsApp | 5 | |
| R7 Submission kit | Note, video, public snapshot, build log, review, freeze | 4 | G5 |
| **Total** | | **45** | |

With four to five streams working in parallel, elapsed time is about 12 to 14 working days. [judgment]

**Capacity rule** (from your roadmap framework): plan 80 percent of effort on new build and 20 percent on upkeep (tests, deploys, docs, compliance copy). If upkeep exceeds 40 percent in any release, stop new features and pay it down.

---

## 2. Roadmap items, ordered by problem

Every item traces to a sharp problem, a verbatim customer story and a metric.

| Order | Release | Sharp problem | Verbatim story (real, from v1 section 4.2) | Strategy lever | Metric moved |
|---|---|---|---|---|---|
| 1 | R1 | Nobody notices paid-but-locked-out customers until tickets arrive | "the only reason we even notice is because someone opens a support ticket days later" | Detect before the complaint | Alert latency, silent to complained ratio |
| 2 | R2 | Fixing is manual and scary | "users were paying for orders, but the database wasn't reflecting them" | Fix everyone in one approval | Rupees made whole, founder minutes |
| 3 | R3 | Customers cannot say what happened and founders cannot chase | "Payment deducted from users, No update/webhook to us, Nothing visible on dashboard" | Find the payment from the first message | Identification rate, time to first reply |
| 4 | R4 | Customers who cannot reach the pay page vanish without a trace | "a subscription didn't go through yesterday, I didn't get alerted... and neither did my client" | Make silence visible | Rupees recovered, false alerts |
| 5 | R5 | The product repeats its own mistakes | (learning gap named in the Agent Studio research: no visible per-merchant learning loop) | Show what it learned | False alerts per week, edit rate |
| 6 | R6 | "Is this real?" | n/a | Credibility on Razorpay's own objects | Reproduced incident on test mode |
| 7 | R7 | Judges need four deliverables | n/a | Clear communication | Complete submission |

**Items cut and why.** Failed-payment retries, fraud and routing (covered by RAY, Payment Links, Vulcan). Disputes and settlement explainers (covered). Live social listening and identity matching (privacy and first-party-data principle). Mailbox-wide read access through OAuth (Google restricted scope). Cross-merchant learning (needs a legal basis). D2C extension (plugins and COD agents already there).

---

## 3. Streams

One stream per Claude Code account or session. Each owns a set of directories and may not edit another stream's files. Cross-stream changes go through the integrator.

| Stream | Owns | Responsibilities |
|---|---|---|
| **A World and eval** | `synth/`, `eval/` | Deterministic world, incidents, threads, fixtures, truth tables, eval harness, three-arm report |
| **B Detection and data** | `backend/app/{ingest,match,detect,zone1,widen,verify,attribution.py,db.py,models.py}` | Monitors, signatures, silent victims, replay eligibility, Zone 1 inference, day-0 scan |
| **C Agents and channels** | `backend/app/{channels,conversation,investigate,act,learning,llm,audit.py}` | Policy engine, adapters, conversation agent, investigation agent, actions, autonomy, escalation, learning |
| **D Web** | `web/` | Blade and RazorSense UI, every screen, snapshot mode, Playwright smoke |
| **E Rails and infra** | `merchant_mock/`, `.github/`, deploy config, R6 work | Merchant mock, CI, Vercel, Fly or Render, Razorpay test-mode integration, optional Meta and email stretch |
| **F Validation and writing** | `docs/`, outside the code tree | Founder calls, Razorpay questions, verify list, note, video script, build log |

**Integrator** (Eshan, plus one session when needed): merges, owns `contracts/`, runs reviews and gates, resolves conflicts.

---

## 4. Contracts frozen in R0

Streams work in parallel only if these are stable. A change needs a pull request to `contracts/`, a version bump and an entry in `docs/CONTRACT_CHANGES.md`.

| Contract | Source | Format |
|---|---|---|
| Database schema | v1 section 14 plus Tech Spec section 5 | `contracts/schema.sql` |
| REST API | v1 section 15.1 plus Tech Spec section 15 | `contracts/openapi.json` generated from stub Pydantic models |
| Web types | Generated from the OpenAPI file | `web/src/types/api.ts` |
| Snapshot manifest | One JSON file per UI response | `contracts/snapshot_manifest.json` |
| Channel adapter and policy interface | Tech Spec section 3 | `backend/app/channels/base.py` with stubs |
| Signal, incident and verdict shapes | v1 sections 8.1, 11.5 plus Tech Spec 9 | Pydantic models |
| Template IDs and slots | v1 section 17.6 plus Tech Spec 4.4 | `backend/app/conversation/templates.py` |
| Capability flags | Tech Spec section 12 | `backend/app/config.py` |
| Seeds and ID formats | Tech Spec section 13 | `synth/config.yaml` |

---

## 5. Releases in detail

Each table lists tasks per stream. "Exit" is the test that must pass before the next release starts on that area.

### R0 Foundations (about 2 agent-days)

| Stream | Tasks |
|---|---|
| Integrator | Create the repo. Copy `razorsense-starter` into `web/`. Copy the three spec files into `docs/`. Tag `contracts-v0.1`. |
| B | Models and DDL from the contracts. Stub FastAPI app returning fixture JSON for every route in the manifest. |
| A | Generator skeleton with INC-1 only and truth tables. `make synth` is deterministic. |
| D | Blade shell, routing, snapshot loader, one incident page rendered from fixtures. |
| E | Makefile targets (`setup, synth, run, snapshot, eval, test, lint`), CI that runs `make test`, `.env.example`, the secret scan hook. |
| F | Founder call script and the Razorpay questions list (section 8). |

**Exit:** `make setup && make synth && make test` pass on a fresh clone. The web shell shows a fixture incident in snapshot mode. Contracts are tagged.

### R1 Detect, widen, attribute (about 6 agent-days)

Delivers F-01, F-02, F-07, F-16, F-30, F-32 (rows 1 to 10), F-33, F-53 (v0), F-60, F-61.

| Stream | Tasks |
|---|---|
| A | INC-1 and noise, 24 screenshots, entitlement CSV, merchant events, downtime events, complaints for INC-1. Eval for monitors and silent victims. |
| B | Webhook health change point, disabled-event handling, access reconciler, signatures, lift, event join, silent-victim queries with tiers and exclusions, attribution rows, day-0 scan. |
| C | Rule-verdict fallback only. Audit log skeleton. |
| D | RAY phone card, incident inbox, incident detail (cause banner, numbers, timeline, lift table, tabs), day-0 scan screen, How-we-know v0. |
| E | CI runs eval and fails on gate breaches. |
| F | Founder calls begin. |

**Exit (Gate G1):** onset detected within 2 buckets on INC-1. Silent-victim precision at least 0.98 in the Exact tier. Day-0 finds the seeded leak. Playwright passes on S-01, S-02, S-03, S-17. **Check K2** (does RAY already widen?) with whatever evidence is available, and record the result.

### R2 Fix and verify (about 5 agent-days)

Delivers F-34, F-35, F-36, F-37, F-40, F-50, F-51 and the settings screen.

| Stream | Tasks |
|---|---|
| B | Replay eligibility. Verification logic (state recheck and signal health). |
| C | Action plans, executor with staging and idempotency, autonomy matrix for grants and messages, message templates with merchant voice and co-branding, evidence pack builder, undo, full audit. |
| E | Merchant mock: webhook modes, entitlement endpoints, grant, health. |
| D | Fix stepper, message preview, dev handoff, verify and close with the single RazorSense moment, audit page, settings and autonomy dial. |
| A | Eval for actions: idempotency, caps, verification accuracy. |

**Exit:** Hero A runs end to end in under 90 seconds of clicking in live mode. Double approval does not double grant. Undo restores prior state. No send path exists outside the policy engine stub. Playwright passes on S-05, S-06, S-07, S-08, S-09, S-11.

### R3 Channels and conversation (about 9 agent-days)

Delivers F-10 to F-13, F-17, F-20 to F-25, F-54.

| Stream | Tasks |
|---|---|
| C | Adapter base and simulators. Policy engine with window, suppression, consent, disclosure, never-ask lint, public filter. Triage and extraction (text and vision). Conversation state machine and tools. Reply drafting and the three autonomy classes for messages. Founder brief. |
| B | Exact-key lookup, fuzzy suggestions, calibration. Thread to case to incident joining. Redaction and token vault. |
| A | 40 scripted threads, screenshots, public fixtures, wrong-identifier and other-merchant cases. Eval for conversation metrics. |
| D | Case and thread view, channels and permissions screen, customer surfaces (checkout error, link page, receipt), WhatsApp chat simulation beside the live thread, email simulation. |
| E | Merchant mock `/pay-page` stub for later. |
| F | Compliance and verify-list items 5, 6, 8 started. |

**Exit (Gate G3):** identification within 3 questions on cooperative threads at least 0.85, and **K4** checked. Zero never-ask violations on the 60-case lint set and all agent outputs. Injection threads ignored. A complaint in a Hinglish thread attaches to the INC-1 incident. Playwright passes on S-04, S-12, S-13, S-14, S-15.

### R4 Zone 1 and depth (about 9 agent-days)

Delivers F-03, F-04, F-05, F-06, F-26, F-31, F-38, F-39 and the full eval.

| Stream | Tasks |
|---|---|
| A | INC-4, INC-5, N1 to N5, INC-2, INC-3, recovery behaviour model, response-body excerpt set (30 labelled). Three-arm eval report. |
| B | Order-attempt gap, complaint spike, volume dip, probe, Zone 1 inference and confidence, exclusions, attribution rows 7a, 8a, 8b, 8c, duplicate monitor, renewal anomaly (basic). |
| C | Investigation agent with the added tools, budget and trace, response-body reader, escalation to Razorpay with evidence pack, recovery link with holdout, guardrailed duplicate refund. |
| D | Incident view for inferred incidents ("Inferred" label, evidence, what we cannot see), escalation view, recovery panel, How-we-know with the three-arm view. |
| E | Merchant mock pay-page modes. |
| F | Founder call results summarised. Check K3. |

**Exit (Gate G4):** INC-4 and INC-5 detected within 2 buckets. Zero incidents from N1 to N5. Zone 1 precision at least 0.8 or **K6 invoked**. Three-arm table renders with real numbers. Hero B runs end to end. Recovery uplift reported against holdout.

### R5 Learning and handovers (about 5 agent-days)

Delivers F-08, F-14, F-15, F-52 and the learning screen.

| Stream | Tasks |
|---|---|
| C | Feedback capture, parameter store, nightly update job, bounds, weekly card generator, Instagram handover simulator, public-mention to private handoff. |
| A | Six-week replay with injected false-alarm patterns and baseline drift, and learning eval. |
| D | Learning card and history, Instagram handover simulation, public mention screen. |
| B | Renewal anomaly finish, baseline provider hook. |

**Exit:** the learning eval shows false alerts per week falling and the edit rate falling, with every parameter change logged. Handover and public handoff are correct on every fixture. Public replies contain no amounts, names or statuses.

### R6 Real rails, stretch (about 5 agent-days)

Delivers F-70, F-71.

| Stream | Tasks |
|---|---|
| E | Deploy the merchant mock publicly. Create real test-mode orders through Razorpay's API or the official MCP server. Drive test-mode checkout with Playwright through the mock bank's Success button. Point a real webhook at the deployed mock. Switch the mock to return 401. Read the real delivery behaviour. Optionally connect Meta's developer test number for one real WhatsApp thread and a controlled-domain inbound email. |
| B | Flip flags for the parts that become real. Real-data adapters for payments and orders. |
| C | Real send path for the one WhatsApp thread, behind the policy engine. |
| D | A visible "Real" or "Mock" tag per capability. |
| F | Record what the real dashboard log showed. Update the platform asks. |

**Exit:** one incident reproduced on real Razorpay test-mode objects and real webhook deliveries, with the README stating which capabilities are real and which are mocked. A failure here does not block R7.

### R7 Submission kit (about 4 agent-days)

| Stream | Tasks |
|---|---|
| F | One-page note, 90-second script, AI build log final, README. |
| D | Snapshot build, Vercel deploy, public link check in a clean browser, recording-ready seeding. |
| E | Fresh-clone run of `make synth && make eval && make snapshot`. |
| Integrator | Code review pass and QA pass on the demo flow. Freeze. |

**Exit (Gate G5):** all four deliverables exist. The verify list in the PRD (16.3) is closed or each open item is stated in the note. Two clean recorded takes. The public link works with no backend and no API key.

---

## 6. Gates

| Gate | After | Question | If it fails |
|---|---|---|---|
| G1 | R1 | Does the core work and is K2 still clear? | Reshape. If RAY already widens, pivot the pitch to the conversation and Zone 1. |
| G2 | Founder calls (continuous) | Do at least 3 of 5 founders confirm an incident, and accept forwarding or a payments number (K3)? | Reorder R3 around whichever channel they accept. |
| G3 | R3 | Does the conversation identify payments safely (K4)? | Redesign questions and lint before building Zone 1. |
| G4 | R4 | Is Zone 1 precise enough (K6)? | Hero B becomes a roadmap slide with the evidence. The product stays. |
| G5 | R7 | Is everything verified or disclosed? | Remove the claim or state the doubt. |
| G6 | Pilot, month 6 (after submission) | Do at least 6% of alerted merchants connect and at least 4.5% of eligible merchants take Guard (BUSINESS_CASE section 8)? | Stop the paid layer, keep Watch (about ₹0.46 cr a year). |

---

## 7. Parallel work protocol

- One repo. `main` is protected. Each stream works on `stream/<letter>-<name>` and merges by pull request at the end of each release.
- Contract changes only through `contracts/`, with a notice in `docs/CONTRACT_CHANGES.md`. A stream that needs a contract change stops and asks the integrator.
- CI runs `make test` and the eval gates. A pull request with a failing gate does not merge.
- Every session starts by reading `docs/PRD.md`, `docs/SPEC.md`, this plan and `docs/BUILD_LOG.md`, and ends by appending its log entry.
- Each account uses its own Anthropic key with a spend cap. Keys go in `.env` only. They are never pasted into chat or committed.
- Ask the integrator before touching shared files such as `Makefile`, `config.py` or `db.py`.

---

## 8. Validation track (stream F, runs the whole time)

| # | Task | Owner | Done when |
|---|---|---|---|
| V1 | Complete one test payment (link, Netbanking, PNB, Success on the mock bank) so the webhook fires, then read the webhook log in the dashboard | Eshan | Log contents recorded: response code and body shown or not |
| V2 | Five founder calls. Script: last incident, how found, who fixed it, what they would pay with, would they forward complaints or accept a payments number, what they would not hand over. Source from the authors of the anchor posts and similar founders. | Eshan, F | Notes saved. K3 evaluated. |
| V3 | Razorpay questions, any PM or contact | Eshan | Answers or labelled unknowns in the note |
| V4 | Close or disclose the verify list in PRD 16.3 | F | Each item has a status |
| V5 | Clean the test account: delete the test webhook, cancel the ₹10 link | Eshan or integrator | Done |
| V6 | Collect only real, linkable quotes for the note | F | List of URLs |

**Razorpay questions (V3).**
1. Does RAY or the agentic dashboard list all payments affected by a merchant webhook failure, or only flag it?
2. What does the dashboard webhook log show, and is there a log API?
3. Is there a webhook-health event, and who receives the disable email?
4. Are order created, attempted or abandoned available as events, and is checkout init failure telemetry kept per merchant?
5. Can an Agent Studio agent call a merchant's own endpoint after approval, and run a conversation channel?
6. Is Razorpay a Meta Tech Provider, how is RAY's WhatsApp number set up, and could a merchant onboard a payments number from the dashboard?
7. Does a customer's contact through a co-branded entry point start Razorpay's grievance clock?
8. Can an authorised agent search payments by RRN or UTR?
9. How do payer grievances link to payment IDs today and what share are merchant-side?

---

## 9. Accounts and setup checklist

| Item | Who | When |
|---|---|---|
| GitHub repository `blindspot` | Eshan | R0 |
| Anthropic API key per account with a spend cap | Eshan | R0 |
| Vercel project for the web snapshot | Eshan | R1 |
| Fly.io or Render for the merchant mock | Eshan or E | R6 |
| Razorpay test account (exists), plus test keys stored in `.env` locally | Eshan | R6 |
| Meta developer account for a test WhatsApp number | Eshan | R6, optional |
| Inbound email provider and a controlled domain | Eshan | R6, optional |

Never share the Razorpay key secret or any token in chat. When R6 starts, I will show where to place keys in a local file.

---

## 10. Risks to the plan and cut order

| Risk | Response |
|---|---|
| Streams drift apart | Contracts first. Weekly integration merge. Gates. |
| Conversation work grows | The question cap and the lint are fixed. Anything beyond is roadmap. |
| LLM flakiness | Cached outputs and scripted replies. No live model calls in recordings. |
| R6 is slow because the dashboard and checkout lag | R6 is a stretch and not on the critical path. |
| Verify-list items turn out wrong | G5 removes or states each claim. |
| Founder calls do not happen | Keep going. The build does not depend on them, but the note's evidence section will say so. |

**Cut order if behind.** R6, then R5 (keep a minimal learning card), then the pay-URL probe (F-06), then INC-3, then duplicates and refunds, then the Instagram simulation.

**Never cut.** Ground truth and the eval, the approval flow and the autonomy matrix, the silent-victim tiers, the policy engine and the never-ask lint, and the "Inferred" label.

---

## 11. Submission plan

**One-page note outline (450 to 550 words).**
1. Title and one line: Razorpay's tools fix payments in flight, Blindspot owns before and after.
2. Merchant and problem, with three real quotes and the support gap.
3. What we built, in four bullets: detect, find the payment by talking to the customer, say whose side, fix and verify.
4. Where the AI is and is not.
5. Proof: three numbers from the eval (silent to complained ratio, identification rate, Zone 1 false alarms).
6. What we left out and why.
7. Platform asks (top four).
8. Compliance by design, two sentences.
9. Overlap table with RAY, Agent Studio, Vulcan, Payment Links.
10. How the system learns, one sentence, and what is real versus mocked.

**90-second video.**

| Time | Screen | Voice-over idea |
|---|---|---|
| 0:00 to 0:10 | Three-zone graphic | "Razorpay sees the payment. It can't see before it or after it." |
| 0:10 to 0:35 | Hero A: alert on RAY, then a Hinglish complaint, incident page, list | "Tuesday 2:52 pm, one customer affected. Friday a complaint. 40 customers paid and have no access. 31 never complained." |
| 0:35 to 0:55 | WhatsApp thread finds the payment from the UPI ref | "The customer is answered in seconds, and the founder never types." |
| 0:55 to 1:15 | Hero B: complaints with no payments, orders dip, inferred incident, recovery link | "Razorpay saw nothing here. Blindspot inferred it and says so." |
| 1:15 to 1:25 | Fix, verify, the single joyful surface, eval numbers | "38 of 38 confirmed active. Every number here is in the eval." |
| 1:25 to 1:30 | Close | One line. |

**AI build log.** `docs/BUILD_LOG.md`, one entry per stream per day: goal, key prompts, what was rejected and why, bugs found by tests or eval, metrics, time spent, decisions. Do not reconstruct afterwards. Include the research phase: the persona and critique panels, the dossier reading, the dashboard and Meta documentation checks, and the decisions in PRD section 2.

---

## 12. Kickoff prompts

Paste the matching prompt to each session. Each assumes the repo exists and the docs are in `docs/`.

**Integrator, R0**
```
You are the integrator for "blindspot" (working name), a Razorpay x ISB AI PM Build Challenge Track 2 product.
Read docs/PRD.md, docs/SPEC.md (the v2 tech spec), docs/BUILD_PLAN.md and docs/V1_SPEC.md sections 0.4, 14, 15, 16.
Do R0 only: scaffold the repo as in SPEC section 19; copy razorsense-starter into web/ (keep .npmrc and CLAUDE.md rules); write contracts/ (schema.sql, openapi.json from stub Pydantic models, snapshot_manifest.json); stub the FastAPI app with fixture JSON for every route; add Makefile, CI, .env.example, a secret-scan hook; tag contracts-v0.1.
Non-negotiables are SPEC section 0. Do not build features. Append docs/BUILD_LOG.md.
```

**Stream A, world and eval**
```
You are stream A (world and eval) on "blindspot". Read docs/PRD.md, docs/SPEC.md sections 13 and 14, docs/BUILD_PLAN.md section 5, and docs/V1_SPEC.md section 16.
Own synth/ and eval/ only. Build the deterministic generator (seed 20261006) and truth.db, then the eval harness. Release order: R1 (INC-1, noise, screenshots, entitlement CSV), R3 (40 threads, public fixtures), R4 (INC-4, INC-5, N1 to N5, INC-2, INC-3, three-arm eval), R5 (six-week learning replay).
Pipeline code must never read truth.db. Every number in fixtures must be computed, not typed. No em dashes. Log in docs/BUILD_LOG.md.
```

**Stream B, detection and data**
```
You are stream B (detection and data) on "blindspot". Read docs/PRD.md sections 4, 6, SPEC sections 5 to 9, and docs/V1_SPEC.md sections 10.5, 10.6, 11.4, 11.6, 11.7.
Own backend/app/{ingest,match,detect,zone1,widen,verify,attribution.py,db.py,models.py}. R1: webhook health, access reconciler, signatures, lift, event join, silent victims with tiers and exclusions, attribution rows, day-0 scan. R2: replay eligibility, verification. R3: exact-key lookup, fuzzy suggestions, redaction, thread to incident join. R4: order gap, complaint spike, volume dip, probe, Zone 1 inference.
Numbers come from SQL or Python only. Inferred incidents never trigger money actions. Tests per area as in SPEC section 20.
```

**Stream C, agents and channels**
```
You are stream C (agents and channels) on "blindspot". Read docs/PRD.md sections 7, 8, 11, SPEC sections 3, 4, 9, 10, 11, and docs/V1_SPEC.md sections 11.5, 12.
Own backend/app/{channels,conversation,investigate,act,learning,llm,audit.py}. R2: actions, executor, autonomy, templates, evidence packs. R3: adapters, policy engine, triage, state machine, lint, replies. R4: investigation agent, body reader, escalation, recovery link, refunds. R5: learning and handovers.
Every send goes through the policy engine. The assistant discloses it is an AI on the first message and never asks for credentials. The conversation model has no tool that moves money or access. Cache all model outputs for tests.
```

**Stream D, web**
```
You are stream D (web) on "blindspot". Read docs/PRD.md section 12, SPEC section 16, and web/DESIGN.md and web/CLAUDE.md.
Own web/. Build the screens in SPEC section 16 with Blade and RazorSense only, in snapshot mode first and live mode second. Before using a Blade component not yet used in the repo, read its docs through the Blade MCP tools. Blue only for actions, green only for the agent, at most one RazorSense surface per screen with a static fallback, reduced motion respected, amounts as Indian-grouped rupees, sentence case.
Generate types from contracts/openapi.json. Add Playwright smoke tests for every starred screen.
```

**Stream E, rails and infra**
```
You are stream E (rails and infra) on "blindspot". Read SPEC sections 2, 12, 18, 20 and BUILD_PLAN sections 5 (R2, R6) and 9.
Own merchant_mock/, .github/, deploy config. R2: merchant mock with webhook modes, entitlement, grant, health. R4: /pay-page modes. R6: deploy the mock publicly; create real Razorpay test-mode orders; drive test checkout with Playwright through the mock bank; point a real webhook at the mock; switch it to 401; record real behaviour. Keys live only in .env. Test keys only (rzp_test_). Never log secrets.
```

**Stream F, validation and writing**
```
You are stream F (validation and writing) on "blindspot". Read docs/PRD.md sections 3, 4, 16, 17 and BUILD_PLAN sections 8 and 11.
Keep the verify list and the evidence log current. Draft the founder call script, the Razorpay questions, the one-page note, the 90-second script and the AI build log. Cite only real, linkable quotes in the note. Label simulated material. No em dashes, no filler phrases.
```

---

## 13. After submission: production cuts, pilot and gates (10 Oct 2026)

Added from the business case (`docs/BUSINESS_CASE.md`) and the Razorpay interviews (digest in `docs/INTERVIEWS.md`, full transcripts in `docs/RAZORPAY_TRANSCRIPTS.md`). No release above changes. The prototype is the specification for what follows.

**Cut or hand off in production.** Refunds, recovery links and renewal links go to Razorpay's existing tools and agents. The investigation agent waits for pilot data. Instagram, Messenger and public-post handovers have no real integration and wait. Voice is out. The learning loop stays minimal.

**Keep and build first.** In this order: the fulfilment acknowledgement and plugin and event-tool signals (activation is the largest driver of the case); Watch as a platform feature; Fix as an Agent Studio agent; Guard's prevention checks (a test ping to the webhook endpoint, a pay-page check, a pre-deploy check). Guard has no edge over do-it-yourself tooling without the prevention checks, and the prototype does not have the test ping or the pre-deploy check.

**Squad.** One full-stack builder, half an AI PM, one senior engineer, a quarter of an analyst, a tenth of an engineering manager. About 26 person-months in year 1 (build 7 months, compliance and security 1.5, run 5), then about 12 a year.

**Pilot (about 6 months, about ₹0.8 cr).**

| Months | Work | Exit |
|---|---|---|
| 0 to 2 | Pull the five internal queries. Watch on webhook health and the order gap for 200 opt-in merchants, fulfilment acknowledgement, daily review. | Measured incident rate and the first alert-to-connect numbers |
| 2 to 5 | Fix as an agent (staged access fix, messages, customer conversation on the existing WhatsApp connector), fee preview and receipt, first-incident-free. | Paid-fix approval rate |
| 4 to 6 | Guard offered after an incident, with prevention checks and the monthly report. Test ₹499 for mid-size merchants. | Guard uptake |

**Gates and kill:** BUSINESS_CASE section 8 and PRD K7 and K8. Two failed gates at month 6 means Watch only.

**Activation paths (added 10 Oct 2026, from the full transcripts).** Activation is the largest driver of the case, so the first production work is how a merchant connects, and Razorpay's own onboarding is the cheapest route: (1) the integration prompt a merchant pastes into a coding agent includes the fulfilment acknowledgement call, so a new merchant is connected on day one; (2) agent onboarding's website scan gives the pay-page address, so the pay-page check needs no setup; (3) plugin merchants need nothing; (4) event tools merchants already run (Sentry alerts, analytics events). Measure the connected share per path in the pilot. None of this is in the frozen base case, so it is upside to prove, not a number to quote.

**Guard's prevention checks come first within Guard.** Harshil Mathur says coding agents moved the bottleneck from writing code to testing and deploying, and Razorpay's own integration path now produces merchants whose handler an agent wrote. More releases means more broken webhooks, which is the input behind the incident rate. The test ping (F-81) and the pre-deploy check (F-82) are what a do-it-yourself script cannot copy cheaply, so they lead the Guard work.

**Backlog from the interviews.** Built 10 Oct 2026: the no-false-urgency check (F-55, D20), which refuses pressure wording on every outgoing message and an expiry that is not the link's real one (stream C, no contract change), and the link expiry itself made real in the simulation; the Guard release check (F-81 and F-82 as one screen and `GET /api/guard/release-check`, contracts v0.12) against a simulated merchant; and the fulfilment acknowledgement wording in the merchant mock (T8). Still not started: the price card, fee preview and receipt (F-80, stream D, post-submission by decision T6), and everything that needs a real merchant endpoint (R6).

---

## 14. Roadmap reassessment (10 Oct 2026)

Eshan asked for an exhaustive check of what is left, ranked, with the low-value items cut. Method: the Problem-Ordered Roadmap rule (an item needs a sharp problem, a verbatim story, a strategy lever and a metric, and an item without them is cut) plus RICE to rank and MoSCoW to decide. The inventory comes from the PRD feature table (section 10), HANDOFF section 2, the BUILD_LOG open lists and SUBMISSION section 4. State on `main` after PR #33.

### 14.1 State of the whole plan

| Area | State |
|---|---|
| R0 to R5 (detect, fix, channels, conversation, Zone 1, learning, handovers) | Built, simulated merchant, rules only. 144 eval gates pass, 485 backend tests. |
| Incidents in the world | INC-1 (Hero A), INC-2 duplicates and guarded refund, INC-3 Razorpay-side renewals with escalation and renewal link, INC-4 and INC-5 (Hero B), J6 access report. |
| Guard | Release check built (F-81, F-82). Value report not built. |
| R7 submission kit | Note, script and verify list written. Eshan still has to check, record and submit. The note is at 545 of 550 words and shows only Heroes A and B. |
| Not built, needs a model | Investigation agent (F-31), three-arm evaluation (F-53 part), a real extractor for Devanagari and screenshots. |
| Not built, needs Eshan's accounts | R6 real Razorpay test-mode rails (F-70), one real WhatsApp thread (F-71). |
| Not built, held by decision T6 until after submission | Price card, fee preview, receipt, value ledger with cost (F-80). |
| PRD section 13 metrics not yet measured | Median time to first useful reply, cost per resolved case, founder minutes per incident (the north star). |
| Known leftovers | Thread page crash after a pipeline rebuild; `OrdersChart` and `RenewalChart` hand-drawn instead of Blade charts (DESIGN.md 21); help bubble and email and Instagram previews not drawn as the apps (DESIGN.md 16, 21); dark mode never checked; stale "130 gates" in SUBMISSION. |

### 14.2 Scoring

RICE with scales set for this project. **Reach**: 3 is in the note or the 90 second video or on both heroes, 2 is a nav screen a judge will click, 1 is an edge screen or back-end proof, 0.5 is invisible. **Impact**: 3 moves the biggest driver of the business case or removes a high severity risk, 2 closes a gap a judge can check, 1 supports a claim or is polish, 0.5 is nice to have. **Confidence**: how sure I am it ships as scoped with what exists. **Effort**: agent-days, where one day is about one batch item (the release check took about 1.5). Score is Reach x Impact x Confidence / Effort.

| # | Item | R | I | C | E | Score | MoSCoW | Call |
|---|---|---|---|---|---|---|---|---|
| 1 | Measure the three missing PRD metrics (first reply time, cost per case, founder minutes per incident) and show them on "How we know" | 3 | 2 | 0.8 | 1.5 | 3.2 | Must | Built 10 Oct |
| 2 | Connect by prompt: the text a merchant pastes into a coding agent to wire the webhook and the fulfilment acknowledgement, checked by the release check | 2 | 3 | 0.7 | 1.5 | 2.8 | Must | Built 10 Oct |
| 3 | Orders and renewals charts as Blade charts (Hero B is in the video) | 3 | 1 | 0.7 | 1.5 | 1.4 | Should | Built 10 Oct |
| 4 | Price card, fee preview, receipt | 2 | 2 | 0.6 | 2 | 1.2 | Should | Held by T6, first after submission |
| 5 | Guard monthly value report (no prices) | 2 | 1 | 0.5 | 1.5 | 0.7 | Should | Next. Rescored 10 Oct (confidence 0.8 to 0.5): the hosted demo has no server, so the report would stay at its snapshot values while the user fixes incidents, and read "restored: 0" after a fix. It needs the demo to compute from its own state first |
| 6 | Fix the thread page crash after a rebuild (KTLO) | 0.5 | 2 | 0.9 | 0.5 | 0.9 | KTLO | Built 10 Oct |
| 7 | R6 real rails and one real WhatsApp thread | 3 | 3 | 0.4 | 5 | 0.7 | Should | Blocked on Eshan: test keys and accounts |
| 8 | Release check for more event types (refund, subscription) | 1 | 1 | 0.7 | 1.5 | 0.5 | Could | Pilot |
| 9 | Dark mode check | 1 | 0.5 | 0.6 | 1 | 0.3 | Could | Later, cheap |
| 10 | Scheduled or pipeline-triggered release check | 0.5 | 1 | 0.6 | 1 | 0.3 | Could | Pilot, cannot be shown |
| 11 | Help bubble, email and Instagram previews drawn as the apps | 1 | 0.5 | 0.8 | 1.5 | 0.3 | Could | Cut for now: not in the script |
| 12 | Rules reading Devanagari | 1 | 1 | 0.5 | 2 | 0.25 | Won't (now) | The model does this in production |
| 13 | Investigation agent and three-arm evaluation | 2 | 2 | 0.3 | 5 | 0.24 | Won't (now) | Cut from the competition build (T1). Revisit after the pilot shows what the rules cannot explain |
| 14 | Learning: live feedback sources, timer, calibrator refit | 0.5 | 0.5 | 0.5 | 3 | 0.04 | Won't | Cut |

### 14.3 What is cut, and why

- **Investigation agent, three-arm evaluation (F-31, part of F-53).** No model in the competition build (T1), no key, and the production plan waits for pilot data. Showing it with scripted replies would be the "looks like a chatbot" risk in section 16.
- **Learning loop extras.** A live source for customer replies and founder edits needs real channels (R6). A timer and a calibrator refit cannot be shown in a hosted demo. The weekly card and the replay stay.
- **Rules for Devanagari, a real screenshot reader.** Both are the model's job in production and a rule version would be worse than none.
- **Help bubble and app-style email and Instagram previews.** Polish on screens the video does not show.
- **Scheduled release checks.** Real in a pilot, invisible in a demo.
- **PRD section 18, "beyond v1".** Cut: D2C extension, helpdesk sidebar apps, consent bridge, live public-mention listening (privacy), grievance matching for Razorpay's own desk. Keep for after the pilot: entitlement connector library (it is the activation path), cross-merchant early warning (needs its own legal basis), Vulcan baselines (internal).

### 14.4 This batch (80 percent new build, 20 percent KTLO)

New build, in score order: items 1, 2, 3, then 5 if there is room. KTLO: item 6. Halt rule: KTLO is well under 40 percent.

| Item | Sharp problem | Verbatim story | Strategy lever | Success metric |
|---|---|---|---|---|
| 1 | The numbers look invented, and the north star (founder minutes) has no number | PRD risk table: "Numbers look invented", High | Credibility with the evaluator | Every PRD section 13 metric has a measured or labelled value on "How we know" |
| 2 | A merchant with no signal finds out from a ticket days later, and the case needs them connected | "the only reason we even notice is because someone opens a support ticket days later" | Activation, the largest driver of the case | Share of alerted merchants connected (pilot gate G-P1, at least 6 percent) |
| 3 | Hero B is about silence, and the chart that shows the silence is a hand-drawn bar set | "a subscription didn't go through yesterday, I didn't get alerted... and neither did my client" | Make silence visible | The Hero B screen reads as a Razorpay dashboard chart, with no design review finding |
| 5 | Guard is sold on prevention and a monthly report, and there is no report | "users were paying for orders, but the database wasn't reflecting them" | Guard uptake | Guard uptake gate G-P2, at least 4.5 percent |

### 14.5 Decisions for Eshan, not for a build

1. **Refresh the note and the video?** Both show Heroes A and B only. Since they were written the product gained INC-2, INC-3 (with the escalation and the renewal link), the access report, the release check and the urgency rule. The note has 5 words to spare. A swap, not an addition, is needed.
2. **R6 keys.** Real rails are the strongest answer to "is this real" and the one item blocked on you. It needs a Razorpay test key pair in `.env` (never in chat) and a deployed merchant mock.
3. **K2 and K3.** The question to Razorpay (does RAY or the agentic dashboard already list every affected payment) and the founder calls are still open and decide whether the whole bet stands.
4. **Housekeeping.** Old remote branches and worktrees from merged work.

### 14.6 What this batch did (10 Oct 2026)

Built in score order: items 1, 2, 3, then the KTLO item 6. Item 5 was dropped from the batch after a second look (see its row). KTLO was 1 of 5 items, well under the 40 percent line.

1. **The three missing PRD metrics** (`eval/founder_effort.py`, `eval/conversation.py`, a new row on "How we know"). Founder time for the typical incident is 4 minutes (counted as approvals from the engine's own plans, 30 seconds each assumed, the count checked against a real run). **Finding:** INC-2 comes to 10.5 minutes, over the 10 minute target, because every refund is approved one customer at a time on purpose. The choice is to keep the guardrail and say so, not to batch refunds. Cost per resolved case is ₹0.07 in messages. First reply takes under a millisecond of engine time.
2. **Connect by prompt** (`/connect`, PRD F-83). The prompt carries six rules, each one closing a failure the product finds. A test checks it carries no key or secret and that the copy button copies exactly the text shown.
3. **Orders and renewals charts** are Blade charts. Nothing in the app is hand-drawn any more.
4. **KTLO:** the thread page no longer crashes after a pipeline rebuild. Root cause: a live conversation named its case with a random id and a rebuild recreated cases under a different one.

Open for Eshan (from 14.5): refresh the note and video, the R6 keys, K2 and K3, and the stale "130 eval gates" in `docs/SUBMISSION.md` (it is now 147, the same number of words).

