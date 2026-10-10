# Handoff: where Blindspot stands (10 Oct 2026: R0 to R5 on `main` except the items marked "not started" below; R7 submission kit, INC-3, INC-2 with the guarded refund, the INC-3 renewal link and data retention are merged as PRs #16, #19, #25, #26 and #27; the J6 report, the no-false-urgency check, the Guard release check and the roadmap batch as #29, #33 and #34)

Read this first in a new chat, then `docs/PRD.md`. Everything below is true as of the last commit on `main`.

## 0. Start a new chat here (5 minutes)

0. **Before anything else:** `gh issue list --label ci-failure --state open`. If CI is red on `main` there is an issue (opened by `.github/workflows/ci-alert.yml`). Fix it first, before any new work. Rules are in the root `CLAUDE.md`.
1. Read this file, then `docs/BUILD_LOG.md` (what happened and what broke), then `docs/BUILD_PLAN.md` section 5 for the next release. Before any decision about pricing, scope cuts or production design, read `docs/BUSINESS_CASE.md` (frozen numbers) and `docs/INTERVIEWS.md` (what Razorpay has said, and the tech calls it supports). The unabridged transcripts behind it are in `docs/RAZORPAY_TRANSCRIPTS.md`; read the full text before relying on a detail.
2. `make setup` once. Then `make test`, `make eval`, `make e2e` should all pass on a clean checkout (about 3 minutes on a laptop, about 7 on CI).
3. Run it: `make run-api` (fresh synthetic world, API on 8000) and `make run-web` with `VITE_MODE=live`. Without `VITE_MODE=live` the web shows the guided demo from the committed snapshot.
4. Eshan is non-technical. Explain plainly, ask before commit, push, delete or anything outward-facing, no em dashes. Work on a short-lived branch cut from current `origin/main`, open a PR, and merge once CI passes (Eshan merged PR #6 himself; GitHub auto-merge is switched off for this repo, so merging is a manual click or `gh pr merge --merge`).
5. Eshan uses git worktrees (one folder per chat). Read section 3b before you start, in particular: run `git fetch` first and cut your branch from `origin/main`, then `cd web && npm ci`.
6. Checks you can trust: every eval gate is in `eval/report.md`. Read the caveats there and in "R3 limits" below before quoting a number.

## 1. What this is

Blindspot (working name) is Eshan Jain's entry for the Razorpay x ISB AI PM Build Challenge, Track 2 "Recover and Grow with AI". It is an agent for small Indian merchants that owns what happens before and after a payment, where Razorpay's own tools (RAY, Agent Studio, Vulcan, Payment Links) stop looking: it finds every customer a payment problem touched, talks to them to find the payment, says whose side the fault is on, and fixes it with the founder approving. Eshan is a non-technical product manager. Explain things plainly, ask before outward-facing actions, no em dashes, no filler phrases.

## 2. State of the build

| Release | Status |
|---|---|
| R0 foundations (repo, frozen contracts, stub API, Blade shell) | Done, tag `contracts-v0.1` |
| R1 detect, widen, attribute (Hero A on a synthetic world) | Done, contracts v0.2 |
| R2 fix and verify (grant in stages, messages, undo, verify and close, audit, settings, autonomy dial) | Done, contracts v0.3. Merged as PR #2, CI green. |
| R3 channels and conversation (no model yet: rules and scripted threads) | Done, contracts v0.4. Merged as PR #3. |
| Guided demo (hosted site plays the whole journey with no server) | Done. Merged as PR #4. |
| Dashboard-aligned frontend (Blade TopNav and SideNav, header-band panels, sticky timeline) | Done. Merged as PR #5. |
| UX review and one-branch cleanup (7 Oct, section 2b) | Done. Merged as PR #6. `main` is now the only branch. |
| R4 first slice: Zone 1, Hero B (cannot reach the pay page), no model | Done, contracts v0.5. Merged as PR #8. Section 2c. |
| R4 rest: escalation to Razorpay | Done with INC-3, contracts v0.8. Merged as PR #19. Section 2f. |
| R4 rest: investigation agent, three-way eval | Cut from the competition build (no model, decision T1). Revisit after the pilot |
| R4 rest: duplicate-charge monitor and guarded refund (INC-2, F-03, F-39) | Done, contracts v0.9. Merged as PR #25. Section 2g. |
| R4 rest: renewal link for INC-3 | Done, contracts v0.10. Merged as PR #26. Section 2h. |
| Data retention enforced (F-54) | Done, no contract change. Merged as PR #27. Section 2i. |
| R4 rest: J6 access without payment, a read-only report | Done, contracts v0.11. Merged as PR #29. Section 2j. |
| No false urgency in every outgoing message (F-55, PRD D20) | Done, no contract change. Merged as PR #33. Section 2k. |
| Guard release check (F-81 test ping and F-82 pre-deploy check, one screen) | Done, contracts v0.12. Merged as PR #33. Section 2l. |
| Roadmap reassessment and the batch it ranked (the three missing PRD metrics, Connect by prompt, Blade charts, thread crash fix) | Done, no contract change. Merged as PR #34. Section 2m, ranking in BUILD_PLAN section 14. |
| Final audit by four independent reviewers, the fixes, and the AI build log (`docs/AI_BUILD_LOG.md`) | Done, no contract change. In review. Section 2n. |
| R5 first slice: handovers (Instagram and Messenger control passing, public posts to private) | Done, contracts v0.6. Merged as PR #9. Section 2d. |
| R5 second slice: learning loop, weekly card, screen S-18 (no model) | Done, contracts v0.7. Merged as PR #15. Section 2e. |
| R5 rest: renewal anomaly (F-08, INC-3) | Done, contracts v0.8. Merged as PR #19. Section 2f. |
| R6 real rails (stretch) | Not started |
| R7 submission kit | Merged as PR #16: `docs/SUBMISSION.md` with note (545 words), 90-second script, verify-list status. Eshan still has to check, record and submit (its section 4). |

Plan, sizing and kickoff prompts for every stream: `docs/BUILD_PLAN.md`.

### What R1 delivers (all verified)
- `synth/world.py`: deterministic 14-day world for the fictional merchant Kaksha, seed 20261006, INC-1 injected, ground truth in a separate database.
- `backend/app`: webhook-health monitor, access reconciler, silent-victim search with tiers and exclusion reasons, replay eligibility, attribution (10 rows), rule-based verdict, evidence pack, pipeline, read layer.
- API serves real output with `BS_SOURCE=pipeline`, placeholder data otherwise.
- `eval/run_eval.py`: 11 gates against hidden ground truth. All pass.
- Web: RAY phone, incident inbox, incident page, day-0 scan, "How we know". Blade and RazorSense. The whole app now follows the dashboard's own composition (Blade `TopNav` and `SideNav`, header-band `Panel` cards, a sticky timeline, `Table`); the measured values and Blade gotchas are in `web/DESIGN.md` section 13.
- Tests: 24 backend, 5 Playwright (uses installed Chrome), lint, secret scan.

### What R2 delivers (all verified)
- `backend/app/merchant_mock.py`: the merchant's side (access check, grant, undo, webhook mode, health). No revoke exists.
- `backend/app/act/`: `executor.py` (plan, dry run, first 5, rest, idempotency key per customer, undo, verify and close), `autonomy.py` (the matrix and settings), `messages.py` (templates only, numbers from slots, Indian grouping).
- `backend/app/channels/policy.py`: the only place a message can be written. A test enforces that.
- `backend/app/audit.py`: every approval, action, verification and blocked send.
- Web: fix stepper and message preview on the incident page, one RazorSense moment on close, developer handoff (`/incidents/:id/dev`, JSON and CSV), `/audit`, `/settings` with the autonomy dial and permission ladder.
- Tests: 71 backend (47 new, including two clicks at once), 10 Playwright (5 are the live fix flow, Hero A in about 4 seconds of automated clicking), 23 eval gates (11 new: no grant outside ground truth, repeat approvals change nothing, undo restores records, cap, verification accuracy, 24 h rule, messages).
- Bugs the tests caught: the number check broke when an amount sat inside a 12-digit UPI ref; customers disappeared from the incident after being restored; after Undo there was no button to plan again.

### What R3 delivers (all verified, with the limits below)
- `backend/app/ingest/`: redaction and token vault (`redact.py`), a deterministic time resolver ("kal raat 10 baje", 31 phrases tested) (`timeparse.py`), rule-based triage and extraction in English and Hinglish with injection and threat detection (`extract.py`).
- `backend/app/match/lookup.py`: exact keys decide (payment id, order id, UPI ref, receipt, contact plus amount within 48 h). A fuzzy scorer with an isotonic calibrator only suggests, for the founder's brief.
- `backend/app/conversation/`: `machine.py` (state machine, three questions at most, handoff brief, silent-customer nudge once, thread resolved when its incident closes), `lint.py` (never-ask lint, 60-case set), two new templates.
- `backend/app/channels/`: `policy.py` is now the full engine (suppression, consent, 24 h window, AI disclosure, never-ask lint, number-from-slot, public filter, rate limit, autonomy per channel). `sim.py` has the help-button, WhatsApp and email simulators.
- Web: Conversations (`/threads`), Case (`/cases/:id`, S-04), Channels (S-12), help-button demo (S-13), WhatsApp both sides (S-14), email (S-15).
- Eval: 40 scripted threads (`synth/threads.py`, truth in `truth_threads`) and 16 new gates. Identification within 3 questions on cooperative threads 1.0 (K4 needs 0.60), zero wrong-payment disclosures, zero never-ask violations, 2 of 2 injections ignored, every handover correct.
- Tests: 250 (backend, synth), 19 Playwright (7 snapshot, 7 conversation, 5 fix flow), 39 eval gates.
- Bugs the eval and e2e caught that unit tests did not: token vault key collided across complaints (identification fell to 31 percent); the extractor re-used an old identifier after a correction; a time phrase in the middle of a sentence was never read; the nudge treated a same-instant reply as an answer; the per-channel dial did nothing until the policy engine read it.

### Guided demo (hosted site, no server)
The hosted site (https://razorpay-blindspot.vercel.app/, on Vercel, Root Directory `web`, no env vars) runs the whole journey in the browser. `scripts/demo_script.py` records frames from the real engine on a copy of the synthetic world (grant stages, undo from two points, messages in both languages, verify, close, five conversations) into `web/public/snapshot/demo.json`. `web/src/lib/demo.ts` replays them: it only picks the next frame, and adds no text of its own except error messages that mirror the server's. Customers pick suggested messages instead of typing, because nothing can read free text without a server. A full page reload starts the demo over. `make snapshot` rebuilds it, and the snapshot is committed (`web/public/snapshot/`) because Vercel has no Python. `web/vercel.json` rewrites deep links to `index.html`. Tests: `web/e2e/demo.spec.ts` (6, no server) and `backend/tests/test_demo.py` (7).

### R3 limits (read before quoting any R3 number)
- **No model is used yet.** Triage and extraction are rules. They read English and Hinglish in Latin script. Devanagari is only recognised as a language, so the rules call it "other" and a person sees it. A model-based extractor goes behind `extract()` with the same output shape. Needs an Anthropic key with a spend cap, and then the three-arm comparison (rules, agent, no signal) that the eval report does not have yet.
- **The scripted threads are friendly to the rules.** They are generated from templates close to the patterns the extractor knows, so 1.0 is optimistic. K4 is not settled until real founders show real messages.
- **Screenshots are simulated:** a script supplies the text a screenshot reader would return (`context.screenshot_text`). No image is read.
- **Fuzzy matching is weak by design:** on generated complaints the true payment is in the top 3 suggestions 66.5 percent of the time, top 1 only 36 percent (`eval/report.md`, 10 Oct), and no threshold reaches 95 percent precision, so it never decides anything.
- **Retention** is enforced for the transcript and the saved identifiers (section 2i). Raw attachments are never stored, so there is nothing to purge for them.
- **Public mentions, Instagram and Messenger** (R5) have no adapter. A public thread gets a held draft that the public filter blocks.
- **Measured on 10 Oct (section 2m):** the engine's own time to first reply and the message cost per resolved case. **Not measured:** how long a person takes to read and approve.
- **The conversation dial is per channel** (Channels screen). The Settings dial is global and governs grants and incident messages.
- The first read of `/api/channels` seeds the channel and consent rows (a read that writes). Fine for the prototype.

### R4 first slice: Hero B, 7 Oct 2026 (section 2c)
Merged as PR #8. Full account in `docs/BUILD_LOG.md`, contract notes in `docs/CONTRACT_CHANGES.md` (v0.5).
- **What it does:** finds customers who could not reach the pay page, says plainly that it is inferred (Razorpay saw nothing), shows the evidence with points, estimates lost orders, and offers recovery links in stages. INC-4 (pay page 404 after a route rename, still broken at the snapshot) and INC-5 (key rotated, checkout will not open). Five look-alikes (quiet night, ordinary dip, course questions, bank outage, a sale) raise nothing.
- **Code:** `backend/app/zone1/` (baselines, volume dip, inference, verdict, recovery, read layer), `backend/app/detect/` (probe, order gap, complaint spike), `synth/zone1.py`, executor action `recovery_link`, attribution rows 81 to 83, merchant mock pay page (`/merchant-mock/page-mode`), live routing of a "page not found" message to the open incident. Web: `routes/Zone1View.tsx`, `components/Zone1Fix.tsx`, `components/OrdersChart.tsx`, both heroes on the RAY page. Demo frames: `scripts/demo_script.py` (`record_zone1`) and `web/src/lib/demo.ts`.
- **Recovery rules:** the founder approves every stage at every autonomy level. Blocked until the pay page has answered normally for 2 hours (checkout incidents: 3 orders with payment attempts since) and messaging is on. Only customers who can be messaged now: WhatsApp inside 24 hours, email; not Instagram (no adapter), not people who never wrote. 10 percent held back by a hash. One link each. Cannot be unsent. Inferred incidents never move money or access.
- **Results (one seed):** both incidents found, onset within 4.5 minutes, 0 of 5 look-alikes raised, precision and recall 1.0, INC-4 flagged 5 minutes after the deploy with the pay-page check on, lost-order estimate within 30 percent. Simulated recovery: 4 of 7 paid within 48 hours (not a result).
- **Deviations from the spec, on purpose:** INC-4 is Thu 1 Oct and still broken (so WhatsApp windows are open), monitors scaled to 1.5 to 4.5 orders an hour, Zone 1 ids start at INC-4.
- **Limits:** the monitors' windows were set after looking at this world. Eight customers cannot measure what a link adds. A customer who writes in live joins the incident but not the recovery list. INC-5 has no interactive demo (read-only in the hosted demo). The probe cannot see a checkout that will not open, which is why the order gap monitor exists. No model.
- **Tests:** 296 backend and synth, 29 browser tests, 64 eval checks (55 gates pass, 9 reported figures).

### R5 first slice: handovers, 7 Oct 2026 (section 2d)
Merged as PR #9. Full account in `docs/BUILD_LOG.md`, contract notes in `docs/CONTRACT_CHANGES.md` (v0.6).
- **Instagram and Messenger:** `backend/app/conversation/handover.py`. The Meta inbox passes a thread only for a payment message or a message that needs a person, and takes it back when the conversation ends or needs a person. Window rules in `channels/policy.py` and `channels/sim.py`. Screen `/ig-demo`.
- **Public posts:** one generic reply (`T-PUB`) held for the founder, nothing looked up, nothing stored as a case, real posts watched only, threats to a person, then the private message carries on. Screen `/public-demo`. Scripts in `synth/handovers.py`, checks in `eval/handovers.py`.
- **Limits:** everything is simulated, no real Meta or X connection. The real anchor posts are the three from the research that name a payment problem. Instagram and Messenger consent is granted in the seed, not by the founder.

### R5 second slice: the learning loop, 7 Oct 2026 (section 2e)
Merged as PR #15. Full account in `docs/BUILD_LOG.md`, contract notes in `docs/CONTRACT_CHANGES.md` (v0.7).
- **What it does:** the founder says "this was a false alarm" on an incident, or "I missed something" on the Learning screen. The weekly review (button "Review this week now", also safe to press twice) moves a setting one step: the order-dip and complaint-spike monitors get stricter after a false alarm and looser after a miss; the default message language follows the higher reply rate. A setting changes once a week, inside a fixed ladder, with a reason and a version, and each change is an audit line.
- **Code:** `backend/app/learning/` (params, loop), thresholds as arguments on `volume.find` and `complaint_spike.find`, `Orders(ewma=True)` baseline, `synth/replay.py`, `eval/learning.py`. Web: `routes/Learning.tsx`, `components/FeedbackPanel.tsx`, demo frames from `record_learning` in `scripts/demo_script.py`.
- **Results (invented data):** false alerts per six-week replay 6.2 with no learning, 5.0 weekly baseline only, 3.2 with the loop; one weak outage missed in 1 of 5 replays. Quote these as "works as designed on a simulation", never as a result about real merchants.
- **Limits:** no live source yet for customer replies and founder edits (needs real channels, R6), so message-language learning runs only in the replay and tests. Calibrator refit and body-reader examples are not built. The review runs when asked, not on a timer. A changed threshold applies from the next pipeline run. The hosted demo takes one piece of feedback and cannot report a missed incident.
- **Not run:** the `fix` and `talk` live browser specs (ports were busy; CI runs them). The `design-reviewer` agent was not started as an agent; its mechanical checks were run by hand (see the build log).

### INC-3 and the escalation to Razorpay, 7 Oct 2026 (section 2f)
Merged as PR #19. Full account in `docs/BUILD_LOG.md`, contract notes in `docs/CONTRACT_CHANGES.md` (v0.8).
- **What it does:** card renewals fail inside Razorpay's gateway for seven hours (27 failed, UPI AutoPay in the same hours fine, nothing changed on the merchant's side). Blindspot puts it on Razorpay's side by elimination, says it is medium confidence and what it cannot see, keeps access on for the 24 customers who have not paid again (a 3 day grace extension, staged, undoable until they are told), tells them in a template message, and drafts an evidence pack the founder approves before it goes to Razorpay (simulated). Verify closes it when every record shows access and card renewals work again.
- **Code:** `synth/renewals.py`, `backend/app/detect/renewal.py`, `backend/app/renewal/` (build, read), `backend/app/act/escalate.py`, `merchant_mock.extend_grace`, T-G1 slots in `act/messages.py`. Web: `routes/RenewalView.tsx`, `components/RenewalFix.tsx`, `components/RenewalChart.tsx`, an INC-3 pair on the RAY page. Demo frames: `record_renewal` in `scripts/demo_script.py` and the `c3` state in `web/src/lib/demo.ts`.
- **Results (invented data):** found with 0 minutes onset error, alert 85 minutes after onset (it needs 5 failed renewals in a row), fix precision and recall 1.0, 3 of 3 complaints joined, 0 customers who paid again touched. 24 INC-3 and escalation checks, 23 gates pass. Quote as "works as designed on a simulation".
- **Limits:** one seed, and the world was built with the monitor in view. Razorpay-side is by elimination (medium confidence). The escalation is a mock: nothing leaves and no reply comes. Not built: the recovery link for failed renewals once Razorpay says it is fixed (with the 10% holdout), collecting the renewals, the "failed but access still on" report. Only one renewal incident can exist (the id is reserved). The hosted demo tells customers only after access is on for all of them.
- **Dates:** the window is Tue 29 Sep, not Thu 1 Oct as in SPEC 13.2, because Thu falls inside the INC-1 outage.
- **Found on the way, fixed later:** at 375px opened directly, no button on the incident pages was exposed to the accessibility tree (PRs #21 and #22, 8 Oct). Still open: Hero A's fix panel has the language control overflow at 375px that INC-3's panel no longer has.

### INC-2, customers charged twice, and the guarded refund, 9 Oct 2026 (section 2g)
Merged as PR #25. Full account in `docs/BUILD_LOG.md`, contract notes in `docs/CONTRACT_CHANGES.md` (v0.9).
- **What it does:** finds customers who were charged twice for the same plan seconds apart, all from one Android release (android-3.4.1, Sat 26 Sep 10:00), says it is the merchant's app and not the webhook (both charges reached the server and both orders got access), leaves out look-alikes with the reason, and lets the founder refund each second charge to the original payment method. Result in the world: 15 double charges (Rs 4,985), 4 complaints, 3 two-seat purchases and 2 failed second attempts left out.
- **The refund rules, each with a test and an eval gate (`backend/app/act/refund.py`, `act/executor.py`):** only a confirmed duplicate in the Exact tier, in full, to the original method (the `refunds` table has no destination column); a person approves every refund, one customer at a time (the whole-list stages are refused, a non-person approver gets 403, the autonomy setting never runs one); a daily limit (`daily_refund_cap_paise`, default Rs 5,000, resets with the demo day) refuses the refund that would pass it; one refund per payment (executor check, engine check and the table's primary key); no undo. The bank reference (RRN for UPI and netbanking, ARN for cards) appears when the demo clock passes 2, 24 or 72 hours after the refund. A customer is told (`T-E1`) only once it exists, and customers whose reference arrives later are added with one more approval.
- **Code:** `synth/duplicates.py`, `backend/app/detect/duplicate.py`, `backend/app/duplicates/` (build, read), `backend/app/act/refund.py`, `merchant_mock` app controls, executor `approve_row`, `messages` refund slots. Web: `routes/DuplicateView.tsx`, `components/DuplicateFix.tsx`, `components/DuplicateChart.tsx`, a fourth chat on the RAY page. Demo frames: `record_duplicates` in `scripts/demo_script.py` and the `dp` state in `web/src/lib/demo.ts`.
- **Close:** every refund recorded and the developer's fixed release out for 24 demo hours (`/merchant-mock/app-mode`). Refunds alone do not close it.
- **Results (invented data, one seed):** 15 of 15 found, 0 look-alikes in the refund list, 4 of 4 complaints joined (whether they name the first or the second charge), alert after the 3rd double charge. 25 new eval gates, 123 pass, none fail. Six guardrails were broken on purpose and each was caught. Quote as "works as designed on a simulation".
- **Limits:** the hosted demo refunds in the order shown (a frame per combination would not fit) and moves the clock only after all 15 are refunded; the live version has neither limit. A two-seat purchase for the same person would be treated as a duplicate (Blindspot cannot ask the app). Only the first run of a duplicate pattern becomes INC-2. Refund processing times are invented. No real Razorpay refund call exists: it is a mock (R6).
- **World changes to know about:** INC-2 adds 40 orders and relabels 83 existing android orders to the new version. Its times are kept to 13:00 to 17:00 and away from every other incident, because INC-4's and INC-5's baselines are measured over evening and overnight hours: with other hours INC-4's lost-order estimate moved from 13 to 14 and, with orders inside its outage, from 13 to 8. INC-1's "what they have in common" shares and INC-4's average order value moved slightly. The amount reader learned "599 do baar kat gaye".

### The renewal link for INC-3, 9 Oct 2026 (section 2h)
Merged as PR #26. Full account in `docs/BUILD_LOG.md`, contract notes in `docs/CONTRACT_CHANGES.md` (v0.10).
- **What it does:** `T-G1` promised each of the 24 customers one renewal link once it is fixed. `recovery_link` now runs on INC-3: one link (`T-G2`) each to customers who were sent `T-G1` and have not paid since, only after card renewals work again, 10 percent held back by a hash (2 of 24) to measure what the link adds, every stage approved by the founder at every autonomy level, never unsent. Verify reports who renewed against the held-back group; a half-sent run keeps the incident open.
- **Code:** `act/executor.py` (`_do_renewal_link`, `_record_offer`, `_nobody_renewal`), `renewal/read.py` (`link_candidates`, `recovery_block`, `told`, `paid_since`, verify line), `synth/renewals.py` (simulated behaviour), `eval/run_eval.py` (7 gates, 3 reported figures). Web: two steps in `components/RenewalFix.tsx`. Demo frames: `record_renewal` in `scripts/demo_script.py`, `c3.l` and `c3.lh` in `web/src/lib/demo.ts`.
- **Results (invented data):** 22 links, 12 of 22 renewed after 48 demo hours (Rs 3,588), 0 of 2 held back. Too few customers to say what the link adds. Eval 130 pass, 0 fail.
- **Limits:** simulated customers, no real payment link (a mock, R6). Hosted demo sends links once everyone has been told and moves the clock only after. Customers who never got `T-G1` get no link. Not built: the "failed but access still on" report (J6).
- **Trap:** never run `eval.run_eval` twice on the same database before `make snapshot`. The match calibration shifts and 26 unrelated case files change. Use `make snapshot` (it rebuilds first).

### Data retention, 10 Oct 2026 (section 2i)
Merged as PR #27. Full account in `docs/BUILD_LOG.md`. No contract change and no screen change: the Channels screen already says "Kept for 30 days", and this makes that true.
- **What it does:** `backend/app/conversation/retention.py`. When the demo clock moves (`POST /api/clock/advance`), a sweep finds conversations with no activity for the channel's retention period (the days the founder granted, 30 by default) and removes the transcript text and the real identifiers behind the tokens (`token_vault`: phone, email, UPI handle, bank reference). A conversation still marked open is set to "resolved", so a customer who writes again starts a new one. One line goes in the audit log (kind `policy`) with the counts. Running it twice changes nothing.
- **What it keeps on purpose:** the redacted complaint text (the pipeline rebuilds every case from it, so removing it would move incident numbers; tested against a control copy that is never swept), the case, each message's template id and send decision, and the audit log.
- **What it skips:** a conversation whose incident is not closed (the founder needs the evidence), and one with a reply waiting for approval (approving it would send the removed text). Both are tested.
- **Limits:** it runs when the demo clock moves, not on a real timer. Redacted complaint text stays indefinitely. Disconnecting a channel still only stops processing and deletes nothing. The hosted demo never reaches 30 days, so it does not show this. Found while writing the tests and not caused by this change: after `pipeline.run` on a database that has live conversations, a live thread points at a case id that no longer exists and the thread page errors. The API starts on a fresh world, so normal use does not hit it. Fixed on 10 Oct 2026 (section 2m).

### J6, access without payment, 10 Oct 2026 (section 2j)
Merged as PR #29. Full account in `docs/BUILD_LOG.md`, contract notes in `docs/CONTRACT_CHANGES.md` (v0.11).
- **What it does:** a read-only report (side nav "Access report", `/access`, `GET /api/leakage`) of customers whose UPI AutoPay renewal failed on their side (not enough money in the account) and who still have access after the merchant's own grace rule (48 hours, `merchants.grace_hours_after_failed_renewal`). It shows the count, the unpaid renewals added up, the longest overrun, the list, the customers still inside the rule (each joins the report when its rule runs out, so it moves with the demo clock), how it checked (a four step funnel), what it left out and why, and what it cannot see. **Report only: no button, nothing written, no action that removes access** (a test and an eval gate check this).
- **Code:** `synth/leakage.py` (the world, applied last, own random stream), `backend/app/leakage.py` (the report), `eval/run_eval.py` (10 J6 checks), `backend/tests/test_leakage.py` (12). Web: `routes/Leakage.tsx`, a nav item, `smoke.spec.ts` S-19. The hosted demo reads the snapshot file `leakage.json` (a plain GET, no replay frames).
- **Left out on purpose:** customers who paid again, customers whose access the merchant already cut (the rule working), bank-side failures (the customer owes nothing), and card subscribers (INC-3's extension keeps cards on for a different reason).
- **Results (invented data, one seed):** 9 of 9 found, precision and recall 1.0, 0 look-alikes listed, the 4 customers inside the rule shown apart and moving in after 48 demo hours. Rs 2,691 unpaid, longest 9 days 20 hours over. Eval 138 pass, 0 fail, 23 reported figures. Quote as "works as designed on a simulation".
- **Side effect to know:** the world has 23 more UPI renewals, so INC-3's "what they have in common" table now compares against a bigger renewal base (cards 45 percent to 30 percent of renewals, lift 2.2 to 3.4) and gained a true row (every failure was `GATEWAY_ERROR`). INC-1's comparison shares moved by under 1.5 points. No headline number of any incident moved.
- **Limits:** one seed, and the world was built with the report in view. It cannot tell a leak from access the merchant extended on purpose (stated on the page). Only UPI AutoPay (the spec's case). It reads the access records as exported at 10:30, not live. No contact with the customer, no nudge, no CSV export.

### No false urgency, 10 Oct 2026 (section 2k)
Merged as PR #33. Full account in `docs/BUILD_LOG.md`. No contract change, no screen change.
- **What it does:** `urgency_violations` in `backend/app/conversation/lint.py`, called from both send paths in `backend/app/channels/policy.py` (`check` for incident messages such as the renewal link, `check_thread` for chats). Pressure wording ("hurry", "last chance", "2 hours left", "or you will lose", Hinglish "jaldi karein", "warna", "sirf aaj") is always refused. A validity line ("valid for 48 hours", "renew within 24 hours") is refused unless the template takes the link's validity as its `hours` slot. A refused chat reply is held as a draft with the reason; a refused incident message raises like any other blocked send.
- **Why:** Agent Studio's certification screens for dark patterns (INTERVIEWS S6), and `T-G2` and `T-Z1R` state "valid for 48 hours" from a constant (`recovery.LINK_HOURS`) that nothing in the mock enforces. In production that number must be the real `expire_by` of the payment link.
- **Results:** no shipped template trips it. 20 pressure texts blocked and 13 calm texts pass, checked through both send paths, and the incident-path calls and the chat-path call were each removed once to see their tests go red. Eval 140 pass, 0 fail (two new gates: agent replies, and every sent renewal link). Backend 471 tests.
- **Limits:** it is a pattern list, so a new way of pushing a customer will pass until it is added. It reads English and Hinglish in Latin script only. It does not check that a sent link really expires (the mock link never does).

### Guard release check, 10 Oct 2026 (section 2l)
Merged as PR #33. Full account in `docs/BUILD_LOG.md`, contract notes in `docs/CONTRACT_CHANGES.md` (v0.12).
- **What it does:** a screen (`/release-check`, side nav "Release check") and `GET /api/guard/release-check` that a merchant runs before shipping. It sends the merchant's webhook one signed test event and opens the pay page, then shows five steps: the webhook answers, accepts a signed event and sends a fulfilment acknowledgement; the pay page opens and checkout opens. Each is Passed, Failed or Not tried (an earlier step failed). A failure says what was seen, what it means for a customer and what to do. The verdict is "Safe to release" only when all five pass. It also shows the one line a release script would run (`curl ... | jq -e '.safe_to_release'`), tagged as a proposed API. Read only: a test counts database changes.
- **Why:** it is the one part of Guard the prototype lacked (INTERVIEWS P13, PRD F-81 and F-82). It also sees what the old pay-page probe cannot: a page that loads while checkout will not open (a wrong or rotated key).
- **Code:** `backend/app/guard.py`, `merchant_mock.webhook_test_event` and `checkout_opens`, schemas `ReleaseCheck` and `ReleaseStep`, `backend/tests/test_guard.py` (13). Web: `routes/ReleaseCheck.tsx`, a nav item, `record_guard` in `scripts/demo_script.py` and the four recorded answers in `lib/demo.ts` (picked by whether the user has fixed the webhook and the pay page).
- **Also in this batch:** the link expiry is real in the simulation (`recovery.due`): a customer who would pay after 48 hours has not paid, so "valid for 48 hours" is true. No number moved, because every simulated payer pays within 36 hours.
- **Results (invented data):** all 12 combinations of webhook mode and pay-page mode give the right verdict and fail the right step, and no broken state is ever marked safe. Eval 144 pass, 0 fail, 23 reported. Backend 485 tests. Browser: snapshot suite 75, live suites 15.
- **Limits:** the merchant is simulated, so nothing here has touched a real endpoint. One event type (a payment capture). It does not run on a schedule or from a pipeline. The hosted demo shows four recorded states, so a webhook left on `ack_then_fail` or a `key_mismatch` page shows only in the live app and the tests.

### Roadmap reassessment and its batch, 10 Oct 2026 (section 2m)
Merged as PR #34. The ranked list and the cuts are in `docs/BUILD_PLAN.md` section 14 (read it before starting new work: it says what is cut and why). Full account of the build in `docs/BUILD_LOG.md`. No contract change.
- **The three PRD metrics that had no number** now do (`eval/founder_effort.py`, `eval/conversation.py`, a row on "How we know"): founder minutes for the typical incident 4.0 (approvals counted from the engine's own plans at an assumed 30 seconds each, checked against a real INC-1 run), cost per resolved case ₹0.07 (messages only, no model), median engine time to first reply under a millisecond. **Finding to carry:** INC-2 is 10.5 founder minutes against a target of 10, because each refund is approved one customer at a time. Kept on purpose. The honest answer is to say so, not to batch refunds.
- **Connect by prompt** (`/connect`, `routes/Connect.tsx`, `lib/connectPrompt.ts`, PRD F-83): the prompt a merchant pastes into a coding agent. Six rules, each closing a failure the product finds. A proposal: the acknowledgement route in the prompt is a placeholder. A test checks the prompt carries no key or secret and that the copy button copies exactly the text shown.
- **Blade charts:** `OrdersChart` and `RenewalChart` replace the hand-drawn bars. No hand-drawn chart is left.
- **KTLO:** a live conversation named its case with a random id, and a pipeline rebuild recreated cases as `cs_<complaint id>`, so the thread page crashed (`backend/app/conversation/machine.py`). It now uses the same id.
- **Cut on 10 Oct** (BUILD_PLAN 14.3): the investigation agent and three-arm evaluation from the competition build, learning-loop extras, Devanagari rules, scheduled release checks, and the D2C, helpdesk-app, consent-bridge, live-listening and grievance-matching items. **Dropped from this batch:** the Guard value report, because the hosted demo cannot keep it in step with what the user fixes.
- **Results:** eval 147 pass, 0 fail (all earlier metrics unchanged). Backend 486 tests. Browser: snapshot suite 77.
- **Limits:** the minutes rest on a 30 second assumption nobody timed. The reply time is engine only. Connect by prompt has not been tried on a real coding agent: nobody has run the prompt and watched an agent produce a correct handler yet, which is the first thing to do with R6.

### Final audit and fixes, 10 Oct 2026 (section 2n)
In review. Full account in `docs/BUILD_LOG.md`. No contract change. Read `docs/AI_BUILD_LOG.md` too: it is the submission's AI build log.
- **Why:** Eshan shared the official brief (see `memory/project_buildathon_brief.md` in his notes: five judging dimensions, Track 2 asks, four deliverables). Four independent reviewers then audited the product: the docs for stale or contradictory claims, the product against the brief as a strict judge, a rehearsal of the 90-second script, and the code against the hard rules.
- **Decision kept:** the prototype has no model. The brief asks the note to say why AI is necessary and what it does better than a rule. The answer has to come from the production design and from where the rules visibly stop, not from a model in the prototype.
- **Fixed in code (each with a test that fails without the fix, 605 backend tests, 78 snapshot browser tests and 15 live ones now):** an approval must be `merchant:<name>` with a name (an empty name, "system" and the like were accepted); the never-ask lint now runs on incident messages too and reads clause by clause (27 of 30 new phrasings used to slip through, none do now); the pressure-wording lint is wider (13 of 15 slipped); typed founder replies cannot state a rupee amount that is not in the customer's record; a card number, CVV, OTP, PIN, password, Aadhaar or PAN a customer volunteers is removed before anything is stored; "STOP" and "mat bhejo" now write a suppression that blocks chat replies and incident messages to that customer (the PRD promised it and no code did it); a time without a zone no longer breaks the clock, and the clock is capped and does not move when a step fails; one customer tapping a button three times is not a duplicate-charge incident; refund text keeps paise and an unknown payment method cannot break the clock; a message the rules cannot read but that mentions money goes to the founder instead of being dropped in silence; `.env.*` is ignored.
- **Fixed in the product's words:** INC-1 said "Razorpay turns the webhook off". Eshan's own 24-hour test showed it does not. It now says "Razorpay's docs say it turns the webhook off" and that the step is documented, not observed.
- **Fixed after the rehearsal reviewer:** the demo customer now sends a 12-digit UPI reference, hidden identifiers show in words and never as a raw `[RRN_1]` token (`plainTokens` in `lib/format.ts`), the chart marker says when the alert fires, and "How we know" shows the hero numbers. The video findings that are for Eshan to apply are in `docs/SUBMISSION.md` section 6.
- **Fixed in the docs:** about 30 stale or false claims across the README, PRD, SPEC, plan, handoff, business case and digest (statuses still "in review", test and eval counts, model claims in sections that describe production, a wrong customer count in the business case, old file names).
- **Measured and unchanged:** all 177 eval metrics have the same value and status as before (147 pass, 0 fail, 30 reported).
- **Known limits, left as they are and written in the README:** no sign-in, the merchant stand-in in the same app, a receiver that records any POST, retention keeping some message text, autopilot sending a bulk message without a pause after the first five (the PRD matrix allows it, the default is "Suggest"), a per-calendar-day refund limit.
- **Still open:** the note, the video and Eshan's own checks (SUBMISSION section 4), K2 and K3. The reviewer's suggestion to show, on "How we know", where the rules stop on messy input (Devanagari, slang, unlisted server errors) as the gap a production model fills is not built.

### UX review, 7 Oct 2026 (PR #6)
Eshan asked for a designer's review of the whole web app. Method: Playwright with the installed Chrome at 1440 and 390 wide (full-resolution screenshots, computed styles, overflow, text size and contrast checks on 13 routes), because the in-app browser shrinks screenshots.

Fixed:
- **Brand.** The top bar says Razorpay (mark and name, links home). Blindspot is the "BLINDSPOT" section of the side nav, like any Razorpay product. Blade has only the Razorpay mark, not the wordmark, so the name is plain text beside it.
- **Top bar and avatar.** The app had no `box-sizing: border-box`, which Blade assumes. The top bar was 16px wider than the window, which clipped the avatar and scrolled the page sideways. Fixed once in `web/index.html`.
- **Side nav.** Links were wrapped in `SideNavLevel` (adds a 56px left margin, so a 72px dead gutter) and the nav was `position: fixed` with `height: 100%` plus a 56px top offset, so it ran off the bottom and hid Settings. Now links sit directly in `SideNavBody` and the nav uses `position="relative"` beside the content.
- **Panels.** The grey header band painted over Blade's inner card ring, so cards had no top edge. The band now has its own border.
- **Smaller things.** Alerts full width and the synthetic-data notice is one slim grey line; badges 12px, not 10px; incident table cut to four columns; evidence labels readable and stacked on phones; stat cards 2 columns on phones; empty incident zones collapse; demo links are buttons; channel names read as names; read-only Settings shows values as text; no snake_case labels and no `make run-api` text in the UI; Channels has its own icon.

Not changed, and why:
- 32px page titles match what the real dashboard uses (`web/DESIGN.md` section 13). 11px timeline timestamps, heading levels (h3 straight to h6) and the React "Cannot update a component while rendering" warning from `Table` all come from Blade.
- The live-API tests (`fix`, `talk`) were not run in this review. The live-mode branches of Settings and Channels are untested after the change. CI runs them.

Open design questions for Eshan: RAY ("RAY on WhatsApp", a centred phone mock) is still the landing page and the only centred screen; Incidents may suit better. The avatar does nothing when clicked. Moving all five Razorpay "product tabs" into the top bar was considered and rejected, because fake tabs would be dead links.

### Results on the synthetic world
1 incident found, 0 false. 85 affected: 17 complained, 68 silent (ratio 4.0; kill criterion K1 needs 2). 81 actionable, 2 fixed by hand, 2 refunded, 4 in the "server said OK but granted nothing" group (all found). Alert fires 55 minutes after the deploy with 1 customer affected. Replay: 38 events replayable by a support ticket one at a time, 43 not replayable at all. The scores are near perfect because the world is clean and generator and detector share assumptions. Harder negatives arrive in R3 and R4.

## 3. Repo map

```
docs/        PRD.md  SPEC.md  BUILD_PLAN.md  V1_SPEC.md  BUILD_LOG.md  CONTRACT_CHANGES.md  HANDOFF.md  BUSINESS_CASE.md  INTERVIEWS.md  RAZORPAY_TRANSCRIPTS.md  SUBMISSION.md  business_model.py
contracts/   schema.sql  truth_schema.sql  openapi.json  snapshot_manifest.json   (frozen, generated)
backend/app/ schemas.py (models)  fixtures.py (placeholders)  main.py (API)  service.py (read layer)  pipeline.py  db.py  clock.py
             detect/  widen/  investigate/ (rule verdict)  attribution.py  config.py
             ingest/ (redact, timeparse, extract)  match/ (keys, lookup)
             act/ (executor, autonomy, messages)  merchant_mock.py  audit.py
             channels/ (base, policy, sim)  conversation/ (machine, lint, templates)
             zone1/ (baselines, volume, inference, verdict, recovery, read, build)  detect/ (webhook, access, probe, order_gap, complaint_spike)
             learning/ (params: settings, bounds, versions; loop: feedback, weekly review, card)
synth/       config.yaml  world.py  zone1.py (INC-4, INC-5, five look-alikes)  generate.py  messages.py  threads.py (40 scripted threads)  replay.py (six invented weeks for the learning eval)
eval/        run_eval.py  calibrate.py  conversation.py  handovers.py  learning.py
web/         the RazorSense starter, moved here with history. Read web/CLAUDE.md and web/DESIGN.md.
             src/lib/ (api.ts, demo.ts replay layer, live.ts polling)  src/routes/  src/components/  e2e/ (smoke, talk, fix, demo)
             public/snapshot/ (committed: what the hosted site reads)  vercel.json
merchant_mock/supabase/rzp-sink.ts   source of the deployed webhook receiver
scripts/     gen_contracts.py  snapshot.py  demo_script.py  run_pipeline.py  secret_scan.sh
```

Commands: `make setup | synth | pipeline | snapshot | eval | test | e2e | lint | contracts | run-web | run-api`. `make snapshot` rebuilds `web/public/snapshot/` (including `demo.json`); commit the result when the data or the engine changes, because Vercel has no Python.

Branches: `main` is the one branch and holds the product (R0 to R3, the guided demo, the dashboard-aligned frontend, the UX review fixes). Each change is a short-lived branch merged by PR once CI passes. Vercel deploys `main`, so https://razorpay-blindspot.vercel.app/ always shows the latest merge. The address was `razorsense-starter.vercel.app` until 9 Oct 2026 and now returns 404. The starter's files moved into `web/` with `git mv`, so history is kept.

## 3b. Branches and worktrees (decided 7 Oct 2026)

**One long-lived branch: `main`.** There is no `blindspot` branch any more (merged and deleted on 7 Oct, along with the merged `claude/*` branches). The duplicate-R2 branch `claude/docs-review-build-d91b5a` was deleted at Eshan's request; its last commit was `d96b591` and can be recovered with `git branch recovered d96b591` while Git still has it.

**Worktrees work fine with this.** A worktree is a second folder on disk with its own branch checked out, sharing the same repository. Git will not check one branch out in two folders, and the main folder (`/Users/eshan/Desktop/claude/razorsense-starter`) keeps `main`, so every other worktree must use its own short-lived branch. Rules:
1. `git fetch origin` first, then cut the branch from `origin/main`. On 7 Oct a worktree was cut from a stale `main` (R1 only, because the product then lived on `blindspot`) and showed none of the side nav the work was about. With one branch that cannot happen again, as long as the branch comes from a fresh `origin/main`.
2. A new worktree has no `node_modules` and no Python env. Run `make setup` and `cd web && npm ci`.
3. Ports are shared across worktrees: web 5173 (dev) and 5174 (live e2e), API 8000. Two worktrees running the dev server or `make e2e` at the same time will collide.
4. Git-ignored generated files are per folder, not shared (for example an old `web/public/snapshot/` left behind on a stale branch blocked a pull on 7 Oct; it is now committed on `main`).
5. When the PR is merged, delete the remote branch, then remove the folder: `git worktree remove <folder>` and `git branch -d <branch>`. Do not leave old worktrees around.
6. Still present on 7 Oct: this session's folder (`.claude/worktrees/blindspot-ux-review-4e2739`) and two older ones (`delete-blindspot-folder-723851` on `claude/guided-demo`, `docs-review-build-d91b5a` on `claude/dashboard-aligned-frontend`). All their work is merged. They can be removed once no chat is using them.

**Tooling gotcha.** The Blade MCP docs tool (`get_blade_component_docs`) refuses to run until `create_blade_cursor_rules` has written Cursor rule files into the repo. Do not do that. Read the component source instead: `web/node_modules/@razorpay/blade/build/lib/web/development/components/<Name>/`.

## 4. Decisions made (full log: PRD section 2)

Scope is post-payment and pre-payment failures only. RAY, Vulcan, Payment Links, Subscription Recovery and the Ecosystem Health board are integrated with, not rebuilt. Two demo heroes: paid-no-access (Hero A, proven, built) and cannot-reach-the-pay-page (Hero B, inferred, R4). A conversation agent talks to the merchant's customers, co-branded "[Merchant] payment help, powered by Razorpay", always says it is an AI. Intake order: Razorpay-owned help entry points, a dedicated payments WhatsApp number, email (reply-to, alias, keyword forwarding rule), Instagram and Messenger handover, public posts private-first. Autonomy dial defaults to "Suggest". The 13 Oct deadline is ignored. UI follows Razorpay's Blade and RazorSense. Name "Blindspot" is a placeholder in one constant. The hosted demo replays recorded frames of the real engine instead of calling a model or a server. No model is integrated before submission unless Eshan changes this; if one is added it goes behind `extract()` and an open model (Ollama, Groq free tier) is acceptable because his Claude plan has no API.

Eshan confirmed on 6 Oct 2026 the two earlier assumptions: the co-branded customer voice ("[Merchant] payment help, powered by Razorpay") and the "Suggest" autonomy default.

## 4b. Business case and interview-driven decisions (10 Oct 2026)

Full detail: `docs/BUSINESS_CASE.md` (numbers are regenerated by `uv run python docs/business_model.py`), `docs/INTERVIEWS.md` (digest and calls) and `docs/RAZORPAY_TRANSCRIPTS.md` (the full transcripts of the five interviews and talks). PRD decisions D12 to D19, kill criteria K7 and K8, SPEC section 21, BUILD_PLAN section 13 and SUBMISSION section 5 repeat the parts that belong to them. No code, contract or screen changed.

- **Frozen base case:** 500,000 merchants in the cohort, 8% connected by year 3, Guard uptake 6%. Steady net +₹0.23 cr a year, three-year total -₹1.09 cr, +₹0.28 cr if each detected incident avoids ₹50 of Razorpay cost. Break-even: 6.1% connected or 4.5% Guard uptake. The base sits above the middle of its own range (the random-draw median is about -₹0.34 cr steady), so treat it as the plan to go for, not the likely outcome.
- **What it is:** a low-cost option on trust and retention (about ₹0.86 cr a year to run, ₹1.19 cr to build in year 1). Not a revenue line. Tokens are about 3% of cost.
- **Three layers:** Watch (free, a platform feature), Fix (1% of value restored, min ₹99, cap ₹3,000, first incident free, free when Razorpay's side), Guard (₹999 or ₹2,999 a month, sold on prevention and a monthly report). Billing rides Razorpay's existing rails.
- **No model in the competition build.** Production plan: skills, three tools and workflows on Razorpay's agent stack, with a small model behind `extract()`. Money and access are deterministic workflow tools.
- **Production hands off** refunds, recovery links and renewal links to Razorpay's existing tools and agents. The demo keeps the flows it has.
- **Next after submission:** the six-month pilot and its gates (BUSINESS_CASE section 8), starting with the five internal queries Razorpay can answer from its own data.
- **Open:** whether Watch is default-on or gated, Agent Studio's real pricing, and Guard uptake (the weakest assumption).

## 5. Verified facts about Razorpay (6 Oct 2026)

From the test dashboard and one real captured test payment:
- Webhook form has one optional alert email. Razorpay rejects a webhook URL whose host does not resolve.
- Each captured payment sends two events (`payment.captured`, `order.paid`). Retries of a failing event at about 0, 9, 24, 45, 88 and 169 seconds, same `x-razorpay-event-id`, user agent `Razorpay-Webhook/v1`, no signature header unless a secret is set.
- After six failed deliveries the webhook list and details panel show nothing about failures. The docs claim a log exists. Not found in the UI.
- Orders show Created, Attempted or Paid with an Attempts count. An Ecosystem Health board shows live bank and UPI outages. The event list has no webhook-health event and no order-created or order-attempted event, but has `payment.downtime.*` and `agent_studio.execution.*`.
- Replay is a support ticket, single event, under 15 days old, only if the webhook was enabled when the event happened. No bulk.
- Editing a webhook URL in the dashboard fails with "the json request could not be decoded". Create a new webhook instead.
- Test mode: netbanking and wallet payments through payment links stalled at the mock bank step; a card payment worked. UPI payment links are not supported in test mode. The dashboard is slow and its UI lags behind clicks, so wait and re-check.
- RAY and Agent Studio do not appear in this test account (early access).

From Meta and Google docs (via a summarising tool, re-check raw pages before quoting): WhatsApp partners onboard merchants through Embedded Signup with `whatsapp_business_management` and `whatsapp_business_messaging`; coexistence lets one number run the Business app and the API; free-form replies only within 24 hours; per-message charges for service replies from 1 Oct 2026 (about ₹0.115 to ₹0.145 in India with 1,000 free per number per month, third-party sources); Instagram and Messenger have a handover protocol, a 24-hour window and a 7-day Human Agent tag; reading Gmail through the API is a restricted scope needing an annual security assessment. Meta's own Business AI is live in India since May 2026.

The full verify list is PRD section 16.3.

## 6. External state (nothing here is in git)

**Razorpay test account** (belongs to a family member of Eshan; do not echo its personal details): test mode only.
- Webhook A, enabled: `https://rjejpxwlfljkydjnjjrd.supabase.co/functions/v1/rzp-sink-55356a50`, events `payment.captured` and `order.paid`.
- Webhook B, disabled, not deleted: `https://httpbin.org/status/401`.
- One ₹10 payment link, three stuck payments in "Created", one captured payment `pay_TkdMqOEdflH4H9`.
- Nothing was deleted from this account. Eshan has not answered the cleanup question.

**Supabase project `rjejpxwlfljkydjnjjrd`** (empty before this work): tables `blindspot_webhook_mode` and `blindspot_webhook_log` (row security on, no policies), Edge Function `rzp-sink-55356a50` (JWT check off, because Razorpay cannot send a JWT; the unguessable name is the only protection). Mode is set with SQL: `update public.blindspot_webhook_mode set mode = '401' where id = 1;` (modes: ok, 401, 500, ack_then_fail). Currently `401`. The log keeps the last 500 deliveries. Source is in `merchant_mock/supabase/rzp-sink.ts`.

**Experiment result (7 Oct 2026, 9:12 PM IST):** Razorpay did not disable webhook A. It retried each event 15 times, the last at 22.8 hours, then stopped. The webhook still shows "Enabled" with no banner, warning, failure count or log. No alert email is set, so no email was sent to check. Recorded in PRD 4.1 and 16.3. Still open: whether this is test mode only. The sink is still in `401` mode; set it back to `ok` when no longer needed.

**Old duplicate folder:** `/Users/eshan/Desktop/claude/blindspot` was deleted on 6 Oct 2026 at Eshan's request. It held an R0-stage copy with no commits and nothing this repo lacked.

**No accounts needed for the demo.** Vercel is live. A model key (Anthropic or an open-model host) is only needed if a model arm is added. Fly or Render, a Meta developer account and an inbound email provider only at R6.

## 6b. Pending (as of the end of 7 Oct 2026)

**Pull requests:** as of 10 Oct 2026 PRs #16 to #34 are merged, including the J6 report (#29) and the design pass (#30). Old remote branches and worktrees from merged work are still around (section 3b rule 5): `git branch -r` still shows many old `claude/*` branches and `git worktree list` many old folders. Nothing was deleted without Eshan's say-so. CodeRabbit has hit its free review limit on this repo and offers paid reviews ($0.25 a file). Not switched on, Eshan's call.

**Phone-width accessibility task: fixed.** "No button exposed at 375px" was the phone menu hiding the whole page from assistive technology. Merged as PRs #21 and #22 on 8 Oct (a custom Drawer replaced Blade's phone SideNav; focus stays in the menu 10 of 10 runs). Details in `docs/BUILD_LOG.md`. Traps (5) in section 9 below is therefore only about how Playwright loads the page.

Needs Eshan:
- **Decide the next slice** (section 7).
- **The submission to-do list** is in `docs/SUBMISSION.md` section 4: click the three quote links, ask Razorpay the K2 question (does RAY already list every payment hit by one webhook failure), record two takes, run `make eval && make snapshot` and check the hosted link in a clean browser.
- **A decision on the webhook story.** The 7 Oct experiment (PRD 4.1) showed that in a test-mode account Razorpay retried each event for 22.8 hours and then stopped, and did not disable the webhook, with no banner, warning or log. The synthetic world and the INC-1 screen still say "Razorpay turned the webhook off after 24 hours" (the docs claim it, `synth/config.yaml` `webhooks.disable_after_hours`, attribution row 4). Nothing in the note makes that claim. Decide whether the product should keep the docs' behaviour, soften the screen text, or model what was observed. Whether live mode differs is unknown.
- **Five founder calls (V2, kill criterion K3):** none done. Script in `docs/BUILD_PLAN.md` section 8.
- **Razorpay questions (V3, nine of them):** no answers yet.
- **Test account cleanup (V5):** the disabled `httpbin` webhook and the ₹10 payment link are still there. Nothing is deleted until Eshan says so. The Supabase sink is still in `401` mode.
- **A free model, only if the investigation agent is revived after the pilot (it is cut from the competition build):** his Claude plan has no API, so Ollama locally or Groq's free tier (needs him to make a free account and key).
- **Two UX questions:** is RAY (the WhatsApp page) still the right landing page, and should the avatar do something when clicked.
- **Vercel:** live at https://razorpay-blindspot.vercel.app/ (renamed from razorsense-starter.vercel.app on 9 Oct 2026, which no longer answers). Root Directory `web`, no env vars. Check that the production branch is `main`. Deep links such as `/incidents/INC-3` work (`web/vercel.json` rewrites them).

Needs the next session:
- **Contract tags:** only `contracts-v0.1` is tagged. v0.2 to v0.12 are not. Tag after Eshan agrees.
- **Hero A's language control overflows at 375px** (the label "Each customer's language" wraps out of its box in `components/FixPanel.tsx`). INC-3's panel uses "Auto" instead.
- **Deferred from R1:** the 24 synthetic screenshots (R3 simulated screenshot text instead; real images need a vision model).
- **Demo state is in memory** (clock offset, webhook fix). A restart gives a fresh world.
- **Bundle is 1.3 MB** (Blade). Code-split later.
- **Not built from the roadmap:** the investigation agent and three-way eval (cut, T1), R6 (not required by the brief).

## 7. Next steps

Order of work, with what each needs:
1. **Start clean.** Fix any `ci-failure` issue first (section 0), `git fetch`, cut a branch from `origin/main`, `make setup`, `cd web && npm ci`. `gh pr list` should be empty.
2. **Pick the next slice** (one PR per slice):
   - **INC-2 is built and merged** (section 2g). Left over from it: refunds that the bank rejects (`failed`) have no path yet, the refund-not-received conversation (`T-F1`) is not wired to a real refund record, and a real Razorpay test-mode refund waits for R6 (`RZP_REFUNDS_TEST_MODE` is still off).
   - **The investigation agent and the three-way eval (rules, agent, no signal).** Cut from the competition build (T1); this is the production design. Needs the model decision above. Goes behind the existing interfaces (`ingest/extract.py` for reading messy text, `investigate/` for causes nobody listed, a response-body reader for free-text server errors). `AgentTrace` already has `model_id` and `rule_based`. Cache every model output for tests (BUILD_PLAN section 10). The hosted demo stays on recorded frames.
   - **The "failed but access still on" report (V1_SPEC J6):** built (section 2j).
3. **Finish R7.** Decide whether the note and the video should mention INC-3 (the note is 545 words of a 450 to 550 limit, so something has to go), then the items in `docs/SUBMISSION.md` section 4.
4. **Validation track runs alongside:** founder calls, Razorpay questions, the webhook decision above, the PRD 16.3 verify list (statuses are in `docs/SUBMISSION.md` section 3). The founder calls now also ask: how often did a customer pay and get nothing in the last year, what would you pay, what do you use today (these replace the incident-rate and Guard-price assumptions).
5. **Business track (after submission):** the pilot and gates in `docs/BUSINESS_CASE.md` section 8, and the queued item in BUILD_PLAN section 13 (the fee preview, price card and receipt, F-80). Not started. The no-false-urgency check and the access-check rename are built.

**Recipe for a new after-the-payment incident** (what INC-3 touched, in order). Follow it and the new incident cannot silently break the existing ones:
1. World: a new `synth/<name>.py` with its own random stream (`seed + n`), applied last in `synth/generate.py`, a block in `synth/config.yaml`, truth rows in `truth.db`. Never change `synth/world.py`'s draws or earlier numbers move.
2. Monitor in `backend/app/detect/`, incident build and read layer in a new `backend/app/<name>/` package, a call in `backend/app/pipeline.py` before Zone 1 (ids: INC-1 webhook, INC-2 charged twice, INC-3 renewals, Zone 1 from INC-4).
3. `backend/app/service.py` dispatches on `mismatch_type` (renewals are `G`, Zone 1 is `Z1`); `act/executor.py` dispatches verify the same way.
4. **Everywhere that picks "the first incident of a zone" must be checked:** `eval/run_eval.py` (now picks INC-1 by name), `web/src/routes/Ray.tsx` (now picks INC-1 by name), and the tests that count incidents.
5. Contracts: `make contracts` and an entry in `docs/CONTRACT_CHANGES.md`. A new GET route needs every parameter optional, or `scripts/snapshot.py` fails (it calls every GET route with no arguments).
6. Hosted demo: a `record_*` function in `scripts/demo_script.py`, a state block and branches in `web/src/lib/demo.ts` (ids like `act_3_grant` must be matched before the Hero A pattern), then `make snapshot` and commit `web/public/snapshot/`.
7. Web: a view in `web/src/routes/`, the dispatch in `Incident.tsx`, the route in `web/e2e/layout.spec.ts`, a hosted-demo walkthrough in `demo.spec.ts` and a live one in `fix.spec.ts`.
8. Prove the tests can fail: break the thing on purpose and see the test catch it (INC-3 did this for four rules).

## 8. Working agreements

- Contracts are frozen. Change them only via `make contracts` plus an entry in `docs/CONTRACT_CHANGES.md` (currently v0.12).
- Every number on screen comes from SQL or Python. The pipeline must never read `truth.db` (a test enforces it).
- Ask Eshan before: commit, push, delete, create accounts, send anything outward, or change his Razorpay account beyond test objects he has allowed.
- Keys go in `.env` only. Razorpay keys must be `rzp_test_`.
- Files stay few. Answer in chat by default. Explain without jargon.
- Eshan merges, or names the pull request to merge. Open the PR, switch Auto-fix on, report, and ask before merging. He merged PR #19 himself.
- Quote every result as "works as designed on a simulation". The world is invented and the generator and detector share assumptions.

## 9. Known loose ends

- Web bundle is 1.2 MB (Blade). Code-split later.
- Starlette prints a deprecation warning about `httpx` in tests.
- `make e2e` needs Google Chrome installed (CI's ubuntu runner has it). CI runs `make test`, `make e2e`, `make eval` and `make lint`; PRs #1 to #6 passed.
- Spec numbers such as "40 affected, 9 complained" in the PRD and RAY mockups are illustrative. The generator computes the real ones.
- Guided demo: a full page reload starts it over; customers pick suggested messages; writing your own reply, taking a conversation over, channels and settings changes are live-only. If the engine or data changes, run `make snapshot` and commit `web/public/snapshot/`.
- The demo clock and the merchant's webhook fix are simulated and live in process memory and two `settings` keys. Restarting the API (`make run-api`) gives a fresh world; running only `make pipeline` on a world that already has grants does not reset them.
- `make e2e` now starts the API on port 8000 (fresh world) and a live web on 5174, so both ports must be free.
- Event re-sending is in the autonomy matrix but has no executor yet. Recovery links (Zone 1), grace extensions (INC-3) and refunds (INC-2) do.
- Zone 1 incidents are INC-4 and INC-5 in pipeline mode. INC-3 is the Razorpay-side renewal incident and INC-2 the charged-twice incident (both built).
- The parallel R2 branch (`claude/docs-review-build-d91b5a`) was deleted on 7 Oct 2026 at Eshan's request. It duplicated PR #2. Last commit `d96b591`.
- Traps hit while building INC-3: (1) port 5173 is shared by every chat, so run browser tests from a throwaway Playwright config on another port (write it, run it, delete it); (2) the live specs in `web/e2e/fix.spec.ts` share one world and run in order, and the autonomy test sets Autopilot for everything after it, so put new live tests before it; (3) `sed -i` on macOS needs an empty string argument, use Python for edits; (4) a shell variable holding several file names is not split in zsh, so list the files out; (5) Playwright's `getByRole` cannot find buttons at 375px opened directly (see 6b), load wide and resize; (6) `make run-api` rebuilds the world each start, so the live suites begin fresh, but `data/world.db` is changed by any test run against it.
