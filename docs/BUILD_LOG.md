# Build log

One entry per stream per day: goal, key prompts, what was rejected and why, bugs found by tests or eval, metrics, time spent, decisions.

## 6 Oct 2026, R0 (integrator)

Goal: scaffold the repo, freeze contracts, stub API, Blade shell, one incident rendered from fixtures.

What I asked the coding agent to do: build R0 from `docs/BUILD_PLAN.md` section 5 using the specs in `docs/`.

What it produced:
- Repo layout from `docs/SPEC.md` section 19. `contracts/schema.sql` extracted by script from the spec SQL blocks (no retyping), and loaded into SQLite as a test.
- `backend/app/schemas.py` (typed API models), `fixtures.py` (placeholder data typed against the models), `main.py` (44 stub paths), `scripts/gen_contracts.py` (writes `contracts/openapi.json` and `snapshot_manifest.json`), `scripts/snapshot.py`.
- `backend/app/channels/base.py` (adapter and policy interfaces), `conversation/templates.py` (15 templates, English and Hinglish, extracted from the v1 table), `config.py` (capability flags, honest defaults).
- `web/`: razorsense-starter copied in, React Router added, types generated from the OpenAPI file, incident inbox and incident page reading the snapshot.
- Makefile, CI workflow, `.env.example`, secret-scan hook, deterministic generator skeleton, eval skeleton.

What I rejected or changed, and why:
- The first snapshot build failed because INC-4 had no RAY card, trace or evidence pack. Hero B needs all three, so the fixtures were completed instead of skipping INC-4 in the manifest.
- `/health` leaked into the snapshot manifest. Excluded from the contract.
- The starter's own notes say it has an `.npmrc` with `legacy-peer-deps=true`. It did not. Added.

Bugs found by tests: none after the above. 12 backend tests pass, including a drift test that fails if the stub API differs from the frozen `contracts/openapi.json`.

Decisions: the repo lives at `/Users/eshan/Desktop/claude/blindspot`. R0 data is placeholder only and labelled so in the UI.

## 6 Oct 2026, repo move and webhook sink (integrator)

- R0 scaffold moved from `/Users/eshan/Desktop/claude/blindspot` into this existing folder, which is now a clone of `github.com/jain-eshan/razorsense-starter`. Work is on branch `blindspot`. `main` is untouched. The starter files moved into `web/` with `git mv`, so their history is kept. I had been wrong that the starter had no `.npmrc`: the local copy had dropped `.npmrc`, `.mcp.json` and `.claude/launch.json`. Restored. Launch config now runs the dev server from `web/`.
- Supabase project `rjejpxwlfljkydjnjjrd` (was empty). Added tables `blindspot_webhook_mode` and `blindspot_webhook_log` (RLS on, no policies) and Edge Function `rzp-sink-55356a50` (JWT verification off because Razorpay cannot send a JWT). Source: `merchant_mock/supabase/rzp-sink.ts`. It logs every delivery and answers by mode: ok, 401, 500, ack_then_fail. Mode is set with SQL. Currently `401`. Self-tested in ok and 401 modes, test rows removed.
- Razorpay test account: new webhook to the sink, events `payment.captured` and `order.paid`. The earlier `httpbin` webhook is disabled, not deleted.
- Razorpay dashboard bug: editing a webhook's URL fails with "the json request could not be decoded". Workaround is to create a new webhook.
- Test payments still do not capture through payment links in test mode (netbanking and wallet stall at the mock bank step). Card flow to be tried next.

## 6 Oct 2026, R1 detect, widen, attribute (integrator, all streams)

Goal: Hero A readable end to end. Alert, list of affected customers, whose-side verdict, day-0 scan, evaluation.

What was built:
- `synth/world.py`: 14 days of synthetic traffic for the fictional merchant, the INC-1 failure injected, ground truth in a separate database. Webhook retry offsets calibrated on a real test payment (0, 9, 24, 45, 88, 169 seconds). Two events per payment, as on real Razorpay.
- `backend/app`: webhook-health monitor (event-count based, alerts on a first event whose first two attempts both returned HTTP errors), access reconciler, silent-victim search with tiers and exclusion reasons, replay eligibility from Razorpay's documented limits, attribution (all ten rows, unit tested), rule-based verdict and trace, evidence pack, read layer, pipeline runner.
- API serves real output when `BS_SOURCE=pipeline`, placeholder data otherwise. Contract v0.2 (additive: `GET /api/scan/day0`).
- `eval/run_eval.py`: 11 gates against hidden ground truth, fails the build on a breach.
- Web: RAY phone, incident inbox by zone, incident page (numbers, timeline, evidence, replay limits, tier switch, sample timelines), day-0 scan, "How we know". Playwright smoke tests use the installed Chrome.

Results on the synthetic world (seed 20261006): 1 incident found, 0 false. 85 customers affected: 17 complained, 68 silent (ratio 4.0, kill criterion K1 needs 2). 2 already fixed by hand, 2 refunded, 81 actionable, 4 of them in the "server said OK but granted nothing" group (found, recall 1.0). Alert would have fired 55 minutes after the deploy, with 1 customer affected. Replay: 38 events replayable by a support ticket one at a time, 43 not replayable at all. Cause and owner correct (rule 1, merchant code, linked to the deploy).

Findings and decisions:
- First version waited for two failing events and alerted 2h33m after the deploy because afternoon traffic is thin. Changed to alert on one strongly bad event.
- The spec's illustrative numbers (40 affected, 9 complained) were never meant as targets. The generator computes them from the traffic parameters, which are in `synth/config.yaml`.
- The scores are near perfect because the world is clean and the generator and detector share assumptions. Harder negatives arrive in R3 and R4. The report says so.
- Ruff: C408 and UP031 allowed on purpose (dict(...) rows, SQL placeholder joins).

Deferred from the R1 plan: the 24 synthetic screenshots (first used by extraction in R3), the Vercel deploy (needs your account), complaint matching beyond exact keys (R3).

Bugs found by tests or eval: the first alert latency above; a test fixture that tried to set an attribute on a plain SQLite connection.

## 6 Oct 2026, R2 fix and verify (integrator, all streams)

Goal: Hero A runs end to end: plan, dry run, first 5, rest, message, verify, close, with approval, autonomy, undo and an audit trail.

What was built: see `docs/HANDOFF.md` section 2. Contract v0.3 is additive (`Settings.autonomy`, `Action.next_stage`, `Action.blocked_reason`). The merchant mock is mounted at `/merchant-mock` and is not in the frozen API contract.

Decisions:
- One plan per incident and type, with the idempotency key `sha256(incident, type, payment)` on a UNIQUE column. Asking again returns the same plan; a second click on a finished stage is ignored and logged. The write lock is taken before the stage runs, so two clicks at once grant once (tested with four threads).
- Autonomy: Suggest needs a tap for every stage. Assist needs the dry run approved once, then the first 5 and the rest run by themselves and stop on any failure. Autopilot runs by itself within the cap. Messages need the founder on Suggest and Assist.
- A message says "access is active", so it can only be planned for customers whose grant was confirmed against their records. One message per customer per incident.
- Undo is refused once customers have been told, and refuses to overwrite a record the merchant changed after the grant.
- Closing needs every Exact-tier customer confirmed and the webhook healthy for 24 simulated hours (the clock is a demo control).

Rejected: the Blade docs tool, because it wants to write Cursor rule files into the repo first. Props were read from the installed types instead, as the starter's rules say.

Bugs found by tests, e2e or the live page:
- Number check: replacing the amount first cut a short number out of a 12-digit UPI ref and flagged a valid message. Now longest value first.
- Restored customers dropped out of the incident (85 became 81), because the 4 "server said OK" customers were only found while they lacked access. They now stay, as "restored by Blindspot".
- The API's CORS only allowed port 5173, so a second web on 5174 could not read it.
- After Undo the panel said "plan again" with no button.
- Reloading a closed incident re-logged the same verification every time. Now logged only when the result changes.
- Stale "Look at 5" timelines after the fix.

Metrics: 71 backend tests, 10 Playwright tests, 23 eval gates, all passing. Hero A in about 4 seconds of automated clicking (limit 90).

Deferred: refunds, recovery links, event re-sending (no executor); the full policy engine (R3); real WhatsApp or email sending (R6).

## 6 Oct 2026, R3 channels and conversation (integrator, all streams)

Goal: a customer can write on a help button, WhatsApp or email and the agent finds the payment, says what the record shows, and hands over safely. No model yet.

What was built: see `docs/HANDOFF.md` section 2 (R3). Contract v0.4 is additive (two templates, three message classes in the autonomy matrix).

Decisions:
- Exact identifiers decide. Fuzzy suggestions go only to the founder's brief. The fuzzy scorer is weak (top 3 recall 0.72), which supports that rule.
- Identifiers become tokens before anything reads the text. The vault stores them per complaint (`complaint_id:[RRN_1]`).
- Replies go out only through `channels/policy.py`, in the order the spec gives. A reply that fails any check is stored as a held draft with every reason shown. The AI disclosure is added to the first agent message by wrapping it in T-DISC.
- Not-a-payment messages are not stored. A counter is kept. Injections, threats, requests for a person and money decisions (refunds, duplicate charges) go to the founder at once, with a brief.
- The conversation dial is per channel. A reply on Suggest is held for approval, so the customer sees nothing until the founder approves it.
- A message that came from a help button for a known payment is read as a payment claim even if it only says "access nahi mila".
- The Blade docs tool was skipped again for the same reason as in R2.

Bugs found by the eval and e2e (unit tests passed with all of these present):
- Token vault: the `token` column is a global key, so a second complaint's `[RRN_1]` was ignored and its identifier was lost. Identification within 3 questions was 31 percent. Now 100 percent on the scripts.
- Extraction took the first identifier in the whole vault, so a corrected reference was ignored.
- A time phrase after other words ("bhai 299 deduct hua kal raat 10 baje") was never extracted: the pattern also matched the empty string at position 0.
- An amount pattern matched a bare comma and crashed.
- "login nahi ho raha" was read as a failed payment.
- The nudge never fired because the customer's last message and our question had the same simulated timestamp.
- The phone simulation mapped typed text onto old messages when the server continued an earlier thread.
- The per-channel autonomy dial was stored but never read.

Metrics: 250 backend and synth tests, 19 Playwright tests, 39 eval gates. Identification within 3 questions 1.0, wrong-payment disclosures 0, never-ask violations 0, injections ignored 2 of 2.

Deferred: model-based extraction and the three-arm eval, real screenshot reading, retention purge, Instagram, Messenger and public mentions (R5), response-time and cost metrics.

## 6 Oct 2026, guided demo mode (integrator, web)

Goal: the hosted site could not show the product moving (every interactive screen said "live demo only"). Make Hero A and the conversations playable with no server, without hand-writing any demo text.

Decision: record, then replay. `scripts/demo_script.py` runs the real engine on a copy of the world and saves each step's response as a frame (210 KB). `web/src/lib/demo.ts` answers the same calls the screens already make (`get` and `send`), so the screens barely changed. The page's own numbers (Exact group, at risk, status) are derived from the recorded action items, so they move as you click.

Limits stated in the UI: customers choose from suggested messages; writing your own reply, taking a conversation over, channels and settings changes are live-only; a reload starts over.

Also fixed: the committed snapshot made seeded consent ids random on every rebuild (noisy diffs); they are stable now.

Metrics: 6 no-server Playwright tests (full Hero A with undo, stage order, two conversation scenarios, help button, email, messaging gate), 7 recording tests. Totals now: 253 backend and synth tests, 25 Playwright tests, 39 eval gates.

## 6 Oct 2026, dashboard-aligned frontend (integrator)

Goal: make the web app follow how the Razorpay dashboard itself is built, using the logged-in test dashboard as the reference.

How: Eshan signed in to the Claude browser pane (Aside is not installed, and the gstack headless browser starts with no logins). Read-only: home, Transactions, one payment detail, Webhooks. I measured computed styles and kept screenshots out of the repo because they show account details.

Finding: the dashboard's modern pages are Blade, so our tokens already matched (`web/DESIGN.md` sections 5 to 7). The gap was composition: a flat light page with text links, against a black top bar, a side nav, header-band cards, a summary card, a Details plus Timeline layout and tables. Measured values are in `web/DESIGN.md` section 13.

Built: Blade `TopNav` and `SideNav` shell with a synthetic-data banner and all existing routes; `Panel`, `Crumbs`, `Stat` (with icons); the incident page as summary card, stat cards, main column and a sticky `StepGroup` timeline; the fix steps, settings and developer page as `Panel` cards; Blade `Table` for affected customers, incidents, audit log, scan and eval checks. Phone width: the side nav becomes a drawer and info rows stack. No behaviour, API or copy changed, and every Playwright test passes unchanged.

Process note: this work was first built on a branch cut from `main`, which only had R1. It included its own R2 (`claude/docs-review-build-d91b5a`, kept on GitHub for comparison) that duplicated PR #2. After finding that, only the redesign was ported onto `blindspot`. The two R2 versions found the same cohort bug independently (customers we fixed must stay in the incident).

Bugs found by looking: Blade `Card` rejects non-`CardBody` children (blank page); `InfoItemValue` rendered plain strings in the browser's default serif; the side nav overlays content and needed offsets; `SideNavLink as` receives `to`, so a plain anchor had no `href` and the nav links were not links; Blade `TableRow onClick` did not navigate.

## 7 Oct 2026, UX review and one branch (integrator)

Goal: review the web app as a UI/UX designer would, fix what was wrong, and stop keeping a separate `blindspot` branch.

Found by measuring the live pages (Playwright at 1440 and 390 wide, plus computed styles): the top bar was 16px wider than the window because the app had no `box-sizing: border-box`, which clipped the avatar and made the page scroll sideways; the side nav had a 72px dead gutter (links wrapped in `SideNavLevel`) and ran 56px past the bottom of the window, hiding Settings; card header bands painted over Blade's inner card ring so panels had no top edge; alerts were 584px wide next to 1072px cards; the affected-customers table and the phone layout of Evidence were cramped; badges were 10px; some raw snake_case labels and two "make run-api" instructions showed in the UI.

Changed: top bar says Razorpay (Blindspot is the "BLINDSPOT" section of the side nav); the fixes above; unique nav icons; empty incident zones collapse to a header; demo links are buttons; the read-only Settings shows values as text. Left alone because they come from Blade: 11px timeline timestamps, heading levels, the Table console warning.

Branches: `blindspot` merged into `main`, which is now the only long-lived branch. Checks: typecheck, lint, 13 snapshot browser tests pass.

After the merge (PR #6): deleted `blindspot` and the merged `claude/*` branches on GitHub, then `claude/docs-review-build-d91b5a` (duplicate R2, last commit `d96b591`) at Eshan's request. Eshan's main folder moved to `main`. Worktree rules are in `docs/HANDOFF.md` section 3b.

## 7 Oct 2026, handoff after the UX review (docs only, PR #7)

Written on 10 Oct from the pull request, so the log covers every merge. PR #7 merged at 08:04 UTC, after #6. Before this, the UX review entry above held only its last paragraph about it.

What changed, docs only:
- `docs/HANDOFF.md`:
  - The state table now says PRs #2 to #6 are merged.
  - A summary of the 7 Oct UX review: what was wrong, what was fixed, what was left alone and why, and the open design questions.
  - A new section 3b on branches and worktrees.
  - Refreshed next steps and loose ends.
- `CLAUDE.md`: a short branches-and-worktrees rule, so every new chat sees it first.
- `web/CLAUDE.md`: the Blade docs tool (`get_blade_component_docs`) writes Cursor rule files into the repo before it answers, so read the component source in `node_modules` instead.
- `docs/BUILD_LOG.md`: the line on the branch cleanup (the last paragraph of the UX review entry).

Checks: none needed, docs only. CI on `main` failed after this merge. The cause was the Hero A time limit, not this change (see "CI investigation and failure alert" below).

## 7 Oct 2026, R4 first slice: Hero B without a model (integrator)

Goal: build the "customer cannot reach the pay page" story end to end with rules and SQL only: detect it, say it is inferred, show the evidence, offer recovery links with a holdout, verify, close. The investigation agent, the three-way eval, escalation to Razorpay, duplicates and refunds are not in this slice.

Built:
- World (`synth/zone1.py`, applied after the Hero A world with its own random stream, so no Hero A number moved): INC-4 (ad links return 404 after a route rename, still broken at the snapshot, 10 orders never created, 14 customers wrote in), INC-5 (key rotated, checkout will not open, 12 orders nobody could pay for), five look-alikes that must not alert (N1 quiet night, N2 ordinary dip, N3 course questions, N4 bank outage with real failed payments, N5 a sale), a pay-page check every 5 minutes with a rare single failure, and simulated customer behaviour after a link (labelled synthetic).
- Monitors: pay-URL probe (two failed checks in a row), order-attempt gap, order volume dip, complaint spike with the "has this person any payment of their own" test that routes a cluster to Zone 1, the bank or the customers.
- Inference with the SPEC weights and confidence, a rule-based verdict and trace, attribution rows 81 to 83, incidents INC-4 (high, merchant code) and INC-5 (medium, merchant setup).
- Recovery link action: founder approves every stage at every level, blocked until the fix has held for 2 hours and messaging is on, only to customers who can be messaged now (WhatsApp inside 24 hours, email, not Instagram, not people who never wrote), 10 percent held back by a hash, one link per customer, cannot be unsent.
- Live conversation: a customer who writes "page not found" while the incident is open is told it is the merchant's side and joins the incident, without being asked for a payment that does not exist.
- Web: Hero B incident page (evidence with points, orders chart against normal, who can be messaged and why not, fix steps, results), the RAY page gets both heroes, and the hosted demo plays the whole of Hero B from frames recorded from the engine.

Decisions and deviations from SPEC 13 and 6.2 (each one stated so a reader can check it):
- INC-4 is on Thu 1 Oct 20:08 and still broken at the snapshot, not Thu 24 Sep to 22:05. Recovery needs the customer's WhatsApp window open, and a week-old incident would have none.
- The SPEC thresholds assume about 10 orders an hour. This merchant gets 1.5 to 4.5. Order gap: 90 minute window, at least 5 orders, p below 0.001 (stricter than SPEC). Volume dip: 150 minute window. A baseline needs 6 comparable days.
- Incident ids: Zone 1 starts at INC-4, the one with more evidence first.
- No model. Everything on the page is a count from SQL or Python.

What the tests and eval caught, which a read-through had not:
- First version of the order gap found nothing: 8 orders in 90 minutes cannot make two consecutive qualifying checks at 1.5 orders an hour. The ad campaign in the world now sends 11 extra orders.
- With 4 comparable days the volume baseline was noisy enough to flag an ordinary Friday evening as a dip. Six days fixes it.
- Walking back to find where unpaid orders began stopped at the window edge, so INC-5's onset was 48 minutes late. It now walks the whole order history (4 minutes off).
- Eval gates for exact-key matching counted complaints with no payment at all. They now count only complaints about a payment.
- `main.py` already had a function named `recovery`, which hid the module; a database backup of a connection with an unsaved change never finishes; five older tests assumed every complaint was Hero A's.

Metrics (one seed, so rough): INC-4 and INC-5 found, onset error 4.5 minutes at worst, cause and owner right, 0 of 5 look-alikes raised an incident, 0 false incidents, precision 1.0 and recall 1.0 (K6 needs 0.8), lost-order estimate worst error 0.30, INC-4 flagged 5 minutes after the deploy with the pay-page check on. Recovery on simulated customers: 4 of 7 paid within 48 hours, about ₹3,096 (not a result). Tests: 296 backend and synth, 29 browser tests, 64 eval checks (55 gates pass, 9 are reported figures).

Deferred: investigation agent and three-way eval, escalation to Razorpay (no Razorpay-owned incident exists here), duplicates, refunds, Instagram, a live recipient list for customers who write in after the incident was opened, a recovery holdout big enough to measure (8 customers cannot), any real traffic.

## 7 Oct 2026, R5 first slice: handovers (integrator)

Goal: Instagram and Messenger the way Meta documents it (the merchant's inbox passes a thread to Blindspot and takes it back), and public posts that move to a private message, with the rules that keep Blindspot from saying anything about a payment in public.

Built:
- Instagram and Messenger: the inbox passes a thread only when the message is about a payment or needs a person. Everything else stays with the inbox: nothing said, nothing kept. Control is kept while a fix is awaited and given back when the thread resolves, is answered from the record, or needs a person (with the brief). Each pass and release is a `handovers` row and a plain line in the thread. Meta's window: the assistant until 24 hours after the customer's last message, a person with the Human Agent tag until 7 days.
- Public posts: at most one generic reply (`T-PUB`) with a private link, no amount, name or status, always held for the founder. Nothing in the post is looked up and no case is made: the post's identifiers are tokens that cannot be turned back. A threat goes to a person and nothing is posted. Real posts from the research are watched and never answered. When the customer writes privately, the public thread closes and the private one carries on, with the move recorded.
- Screens: Instagram (`/ig-demo`, S-16) and a public post screen (`/public-demo`), both in the hosted demo from recorded frames. The thread view shows who had control as plain lines.
- Eval: 14 handover checks, all pass.

What the checks caught:
- The Hinglish public reply did not say it was an AI in the words the policy looks for, so the founder could not approve it. Only the approval path found it (the draft had been written, never sent). The eval now approves every public reply.
- A public threat with no payment word was ignored as "not about a payment". Threats now go to a person before the payment test.
- Five older tests assumed Instagram, Messenger and public mentions were switched off, and that a public post was drafted and blocked for numbers.

Metrics: 318 backend and synth tests, 13 snapshot browser tests in the demo spec, 14 handover eval checks.

Deferred to the next R5 slice: the learning loop (feedback, bounded parameters, weekly card, six-week replay) and the Razorpay-side renewal anomaly (F-08).


## 7 Oct 2026, R5 second slice: the learning loop (integrator)

Goal: the system tunes itself from what the founder tells it, within fixed limits, with every change visible. No model.

Built:
- `backend/app/learning/`: `params.py` (three settings, hard bounds, one change a week, versions) and `loop.py` (feedback capture, the weekly review, the plain-language card). Settings: order-dip and complaint-spike alert strictness (a ladder of six values from 1 in 20 to 1 in 1,000, one rung per change) and the default message language for customers whose language is unknown (English or Hinglish, only after 20 sends each and a 5 point lead).
- Monitors take their threshold as an argument; the pipeline reads the learned values. `Orders(ewma=True)` adds the hour-of-week baseline (alpha 0.3) once there are 3 weeks of history. The 14-day world has 2, so no Hero A or Hero B number moved.
- API: `POST /api/feedback`, `GET /api/learning/weekly`, `GET /api/learning/params` are real; new `POST /api/learning/run` and `GET /api/learning/replay`. Contracts v0.7.
- Web: screen S-18 (`/learning`: this week's changes, what is in force, version history, the simulated six-week table), a "Was this a real problem?" panel on every incident, and two "I missed something" buttons. The hosted demo replays recorded frames of the real engine.
- Eval: `synth/replay.py` (six invented weeks: weekly drift, a harmless Wednesday dip, irregular slow days, three real outages) and `eval/learning.py` (three arms: no learning, weekly baseline only, full loop; 5 replays, averaged).

Result (invented data, simulated founder): false alerts per replay 6.2 with no learning, 5.0 with only the weekly baseline, 3.2 with the loop. Weeks 4 to 6 average 0.33 false alerts a week against 0.73 in weeks 1 to 3. Both clear outages are found in every replay. The loop misses the weak Saturday outage in 1 of 5 replays (0.2 per replay), which is the price of stricter alerts. Hinglish is chosen in 5 of 5 replays, and the edit rate falls by 10 points. The last two are mechanical: the replay's reply and edit rates are invented.

Decisions and deviations:
- Ladder of six values, not a free number, so "within bounds" is checkable and a change is explainable as "1 in 100 to 1 in 200".
- A false alarm counts only for the monitors that raised that incident; the pay-page probe and order-gap monitors are not tunable (they catch rare, severe things).
- Feedback is counted only since the setting last changed, so one false alarm cannot move a setting twice.
- One replay is mostly luck (an alert or two a week), so the eval averages 5. Baseline-only is its own arm so the report shows which part does the work: for a recurring harmless dip the baseline does it; the threshold helps with irregular slow days.
- Not built from SPEC 11.2: calibrator refit (too few confirmed matches) and body-reader examples (need a model). Reply and edit events have no live source until real channels exist (R6), so message-language learning only has data in the replay and in tests.

What the first draft got wrong, caught by running it: one replay gave 2 false alerts in six weeks, so "falling" was luck (added slow days and 5 replays); the first eval took 70 seconds because `Orders.between` scanned every order (now a binary search, 1 second, same results).

Checks: 334 backend and synth tests, 25 snapshot browser tests (2 new, layout at three widths includes `/learning`), eval 75 gates pass and 14 figures. The live-API browser specs (`fix`, `talk`) were not run: another worktree held ports 5173, 5174 and 8000. Design review: the `design-reviewer` agent could not be started as an agent in this session, so I ran its mechanical checks by hand on `Learning.tsx` and `FeedbackPanel.tsx` after merging `main` (no hex colours, inline styles, raw tags, fixed widths or `repeat(N, 1fr)`; no em dashes in the diff; types and lint clean; all 43 snapshot browser tests pass, including layout at 375, 768 and 1440px for `/learning`). I looked at the Learning screen at 390 and 1440px and the feedback panel at 390px. Not looked at: tablet width by eye, dark mode, the feedback panel at 1440px beyond the passing test.

## 7 Oct 2026, web design consistency (design stream)

Goal: make the web app look and behave like an addition to the live Razorpay dashboard, and write the rules down so later work follows them.

What I asked the coding agent to do: copy the production top bar and side nav (Blindspot as a product tab, production items greyed and inert), add the Ray home, product guides in the Smart Collect format and a first-run setup in the layout of Razorpay's merchant onboarding, make the fix flows read like Razorpay's own agents (from Eshan's screen recordings of the Agentic Business Banking demo), apply one page header and responsive fixes everywhere, and document it. PR 10.

What it produced:
- `components/Shell.tsx`, `PageHeader.tsx`, `AgentAnswer.tsx`, `RayAnswers.tsx`; routes `Home`, `GuidePage`, `Setup`; `lib/guides.ts`, `lib/setup.ts`.
- `FixPanel.tsx` and `Zone1Fix.tsx` now run as turns: one blue button per step, the founder's choice as a bubble, an Analyzing state, next steps on close. Logic and button text unchanged.
- Tables got column minimums and grids use `minmax(0, 1fr)`, so nothing crushes or spills on a phone. Demo layouts fill the width.
- `web/DESIGN.md` sections 14 to 20 (shell, templates, guides, agent journey, source of truth, checklist, philosophy). `e2e/layout.spec.ts` opens every screen at 375, 768 and 1440px.

What I rejected or changed, and why:
- A pasted style file (Dodger Blue `#0d94fb`, Muli, 4px corners) was not used. Production and Blade ship `#1364F1`, Inter and TASA, 8 and 12px. Recorded in DESIGN.md section 18.
- Blade's `TabNav` crashes in a fresh browser when it unmounts overflowing tabs, so every tab is always rendered.
- The OTP step and the feedback row from the banking demo were left out. Our equivalent of the OTP is the staged approval, and a row of controls that do nothing would mislead.
- Ray's chat on the home is a router plus read-only answers, not a model.

Bugs found by tests or review:
- A layout test found a 60px sideways overflow on INC-4 and INC-5 at tablet width (plain `1fr` columns). Fixed across the app.
- CI failed on PR 10 after merge: the layout test (one test visiting 20 screens) and the long Hero A walkthrough both passed the 30 s limit on a slower runner. Fixed in a follow-up: 60 s limit and one test per screen and width.

Metrics: 80 snapshot browser tests pass (20 existing, 60 layout). Types and lint clean. The two live-API specs (`fix`, `talk`) were not run.

Design review: not run through the `design-reviewer` agent, which did not exist when this work was built. I audited by hand (code scan for colours, raw HTML, fixed widths; screens looked at in a browser at pane width and 1440px; not looked at: chat, help and email demos, thread and case detail, How we know; dark mode not checked). The agent runs from the next entry that touches `web/`.

Decisions: Blindspot is a top-bar tab beside Payments (Eshan). Production links are greyed and not clickable (Eshan). Ray home sits on top of the Blindspot home (Eshan). The design philosophy is DESIGN.md section 20.

## 7 Oct 2026, CI investigation and failure alert (integrator)

Goal: find out why CI on `main` failed after four merges in a row (#7 to #10), fix it, and make sure a failure after a merge gets noticed and fixed before new work.

What I looked at: the failing step in every red run (all `make e2e`), the full log of each, and the failing test in each.

Findings:
- Hero A (the demo walkthrough in `e2e/demo.spec.ts`) failed in four runs, each time at a different line (44, 47, 48, 50) and each time with "Test timeout of 30000ms exceeded". The line is just where the 30 s clock ran out. So it is a time limit, not a race or a logic bug.
- Measured with Chrome's CPU throttling: Hero A takes 6 s at normal speed, 26 s at 4 times slower, 50 s at 8 times slower. CI is about 5 times slower than a laptop, so the test sat on the 30 s edge and failed whenever the runner was busy. The #7 run was a docs-only merge, so this started before the design work.
- A production build is about twice as fast as the dev server (4 s against 6 s, and 24 s against 50 s at 8 times slower).
- The layout test I added in the design work made it worse: one test visiting 20 screens in a single 30 s test.
- One different failure, in the live-API Hero A (`fix.spec.ts`, run for #9): two `canvas` elements where the rule allows one. It did not reproduce locally, even at 6 times slower (the count went 0 then 1). One failure in six CI runs, so I treat it as a transient overlap while the success card mounts. The assertion now waits for the steady state and names the check if it ever fails again.

What changed:
- `playwright.config.ts`: 60 s test limit (PR 11), and CI now serves a production build for the snapshot tests instead of the dev server. `reuseExistingServer` is off on CI.
- `e2e/layout.spec.ts`: one small test per screen and width (PR 11).
- `e2e/fix.spec.ts`: canvas count uses `expect.poll`.
- `.github/workflows/ci-alert.yml`: when CI finishes on `main`, a red run opens an issue labelled `ci-failure` (or comments on the open one) with the commit, the failed step and the run link, and a green run closes it. It runs from the default branch, so it works from the merge of this change. The issue-body queries were tested against a real failed run.
- `CLAUDE.md`, `docs/HANDOFF.md`, `web/CLAUDE.md`: every session checks `gh issue list --label ci-failure --state open` first and fixes it before any other work.

Result: after PR 11, CI on `main` is green for the first time since #6. Locally, `CI=1 npx playwright test` passes all 92 tests (80 snapshot, 7 talk, 5 live) in 1.2 minutes. CI itself still takes 8 to 9 minutes, mostly setup, tests and eval; not looked at further.

What I rejected: raising the limit alone (it would only move the edge); retrying failed tests (it hides real flakes).

Not done: the alert reaches a person and any session that reads the issue, but nothing wakes a running session. A scheduled checker is still an option.

Design review: not applicable. No screen changed (test config, CI and docs only).

## 7 Oct 2026, CI speed (integrator)

Goal: find out why CI still took 8 to 9 minutes after the timeout fix, and cut it.

What I measured (completed runs of PR 11 and PR 12):
- Of a 7.5 to 9 minute job, `make e2e` was 430 to 480 s. Setup, snapshot, pytest, eval and lint together were about 50 s.
- Inside e2e the servers are ready in about 11 s. Then 92 tests ran one after another on a single worker, because GitHub's free runner for a private repo has 2 CPUs and Playwright uses half of them by default.
- With one worker and a production build, on my laptop: 115 s of test time, of which the 60 layout tests were 67 s (58%). Each one loaded a page and waited for the network to go quiet, three times per screen.
- With PR 12's production build the e2e step went from 430 to 480 s down to 234 to 304 s. The same commit ran twice (push and pull_request) with 234 s and 304 s, so run-to-run spread is about 30%.
- `ci.yml` ran on `push` and `pull_request`, so every commit on a branch with an open PR ran the whole job twice.

What changed:
- `e2e/layout.spec.ts`: one test per screen (20), which loads the screen once and resizes through 375, 768 and 1440 px, instead of 60 page loads. To check it still catches problems I put the old INC-4 overflow back; the test failed with the same message as before (+60 px at 768), then I restored the file.
- `ci.yml`: runs once per PR (`pull_request`) and once on `main` after a merge (`push`). A newer commit on a PR cancels the older run; runs on `main` are never cancelled so the failure alert always gets a result. npm is cached.
- `playwright.config.ts`: 2 workers on CI. The live projects still run one after the other.

Result on my laptop in CI mode: 52 tests (was 92, same coverage) in 50 s with 2 workers, against 122 s before. The real CI time is measured on the pull request for this change; see the PR for the number.

Not done: `make test` builds the web app once and the e2e step builds it again (about 10 s on CI each); skipping that needs a Makefile change that I left alone.

Design review: not applicable. No screen changed.

## 7 Oct 2026, R7 submission kit (integrator)

Goal: write the deliverables the judges receive, from the committed eval and snapshot, and be honest about what is still unverified.

Built: `docs/SUBMISSION.md` with the one-page note (545 words), the 90-second video script, the status of every item on the verify list (PRD 16.3), and a list of what only Eshan can do. README and HANDOFF status tables brought up to date (the learning loop had merged as PR #15 but both still called it open).

How the numbers were produced: reran `make eval` (75 gates pass, 14 reported figures, 0 fail) and read Hero A and Hero B figures from `web/public/snapshot/`. The sample numbers in `docs/BUILD_PLAN.md` section 11 ("40 customers", "38 of 38") are illustrative and were replaced by the real ones: 85 affected, 17 complained, 68 silent, ₹56,319, 81 of 81 confirmed active after 24 healthy hours, alert 55 minutes after the deploy.

What checking caught:
- One of the three planned quotes was out of context. "Razorpay just fires a webhook and that's it? no retry..." (r/micro_saas) is about failed UPI AutoPay debits, not a deploy breaking a webhook. Replaced with an r/indiehackersindia post that is exactly the deploy case. All three quotes were matched word for word against the raw files in `_dossier/SOCIAL_LISTENING/`. The live pages were not opened (Reddit and X are blocked in the browser tool).
- A first draft said "all 40 threads identified within three questions". The metric covers cooperative threads only, so the note says that.
- The first draft was 572 words; trimmed to 545.
- Verify item 9 (reversal timelines): template `T-B1` states a bank reversal date, but no code path sends it, so no date reaches a customer. Check the RBI timelines before it is wired.

Not done: item 1 of the verify list (the 24-hour webhook disable, due about 18:41 IST on 7 Oct) needs Eshan to look at the dashboard. Nothing in `web/` changed, so no design review was needed. No recording was made.

## 7 Oct 2026, graphify code map (tooling, PR #18)

Written on 10 Oct from the pull request; PR #18 merged at 17:50 UTC with no log entry because it changed no application code.

Goal: let a session ask a map of the repo where a thing lives, in place of searching files broadly.

What changed:
- `.gitignore`: ignores the generated `graphify-out/` (about 15 MB).
- `.githooks/post-commit` (new): refreshes the code graph in the background after each commit. It needs no model and takes about 3 seconds. It never blocks or fails a commit, and does nothing when graphify is not installed.
- `CLAUDE.md`: a "Code map" paragraph. It points sessions to `graphify query`, `graphify path`, `graphify affected` and `graphify-out/GRAPH_REPORT.md`, and says to read the real file before editing.

Decisions:
- The hook is a file in `.githooks`, because this repo sets `core.hooksPath` there. `graphify hook install` refuses that path and writes to the default hooks folder, which git ignores here, so the stock install would never run.
- `graphify claude install` was not used, because its hook fires on every Bash, Read and Glob call.

Checks:
- The hook returns in 0.003 s and exits 0 with or without graphify.
- `graphify update` kept all 241 doc nodes (1,751 nodes in total), and `affected`, `path` and `query` gave sensible answers.
- About 6.7 times fewer tokens per question than reading the whole corpus. Secret scan clean.
- Not run: `make test` and the web tests (no code changed).

Note: git reads hooks from the main checkout's `.githooks`, so the hook went live only once the main checkout pulled this merge. A new worktree has no `graphify-out/` until `graphify update .` runs (root `CLAUDE.md`).

## 7 Oct 2026, R4 and R5 rest: INC-3 and the escalation to Razorpay (integrator)

Goal: the one incident where the fault is Razorpay's, and the evidence pack that goes with it. A burst of card renewals fails inside Razorpay's gateway, the merchant's access job cuts access, and nobody on the merchant's side did anything wrong. No model.

Built:
- World (`synth/renewals.py`, own random stream, applied last so no earlier number moves): 27 card mandate renewals fail with one gateway error between Tue 29 Sep 02:10 and 09:29, 11 UPI AutoPay renewals in the same hours go through, card renewals work again at 10:12, three customers pay again on their own, three write in. Truth rows for all of it.
- Monitor (`detect/renewal.py`): a run of at least 5 failed renewals in a row on one method whose chance under the normal failure rate is under 1 in 1,000. It says "Razorpay" only when nothing else explains it: no change on the merchant's side in the 2 hours before, no bank outage over the hours, one error code on at least 80% of the run, at least 2 card networks, and the other method fine. Otherwise attribution moves off Razorpay (tested for each).
- Incident (`renewal/build.py`, `renewal/read.py`): INC-3, owner Razorpay by attribution row 8, confidence medium, 6 pieces of evidence with points, three things Blindspot cannot see, a rule-based trace. Members are the 27 failed renewals; 24 get the fix and 3 are left out with the reason "Paid since".
- The fix reuses the staged executor: a "grant" on a failed renewal is a grace extension (access on for 3 days from now, never shortens access, undoable until the customers are told). The message template `T-G1`, in the contracts since v0.1 and never sent, is now sent to customers whose access is confirmed. Verify closes the incident only when everyone's record shows access and at least 3 card renewals have gone through since the last failure.
- Escalation (`act/escalate.py`): draft, then the founder's approval sends. The pack holds payment ids, counts, error codes, hours, what was ruled out and what was already tried, and never a customer's name, email or phone. Only a Razorpay-owned incident can be escalated.
- Web: `RenewalView`, `RenewalFix`, `RenewalChart`, an INC-3 pair on the RAY page, hosted-demo frames recorded from the engine (`record_renewal`), contracts v0.8.

Result (invented data, one seed): found with 0 minutes onset error, 0 false renewal incidents, fix precision and recall 1.0, all 3 complaints joined to the incident, the alert would fire 85 minutes after onset (it needs 5 failures in a row). 24 INC-3 and escalation checks: 23 gates pass, 1 reported figure. Whole eval: 98 gates pass, 15 reported figures, none fail (was 75 and 14). Hero A, Hero B and conversation numbers are unchanged.

What the checks caught, which a read-through had not:
- The first world found 19 of 26 failures: an ordinary card renewal inside the window had gone through, which splits the run. In a real outage it would have failed too, so any card renewal in the window now fails (27 in all, not the 26 configured).
- Hero A was picked as "the earliest incident after the payment" in the eval and as "the first incident after the payment" on the RAY page. INC-3 is earlier on the same day, so both would have silently shown the wrong story. Both now pick INC-1 by name.
- `extraction_amount_exact` fell to 0.94 (gate 0.95) because INC-3's complaint texts gave no amount. Real customers say it; the texts now do.
- My first scoring of INC-3's complaints used the truth label "G", which Hero A's renewal complaints also carry. It would have dropped them from the exact-key gates without any failure. It now selects by the failed payment a complaint names.
- After 5 of 24 were extended, verify said "19 still show no access. Run the plan again", which is wrong for customers not reached yet. It now says they are waiting for the next step.
- The message step reused the access step's button names ("Keep access on for the first 5"). Separate labels now.
- At 375px the language control's first option wrapped out of its box. Shortened to "Auto" in this panel. The same control in Hero A's panel has the same problem and was left alone.
- The live browser test failed because an earlier test in the file switches the global autonomy to Autopilot, and then the extension runs by itself. Test order, not product.
- Mutation check on the new tests: leaving nobody out, letting the pack leak names, letting a grace shorten access, and ignoring renewals in verify were each introduced on purpose; each was caught (my first leak mutation was not a real leak and was redone).

Decisions and deviations:
- The window is Tue 29 Sep, not Thu 1 Oct as in SPEC 13.2: Thu falls inside the INC-1 outage and would turn ordinary renewals into INC-1 victims.
- Attribution to Razorpay is by elimination, so confidence is medium and the screen says what Blindspot cannot see. No threshold was tuned on the result: the 5-in-a-row and 1-in-1,000 settings were chosen before looking, but the world was built with the monitor in view, so quote this as "works as designed on a simulation".
- Only the first run becomes INC-3 (the id is reserved). A second renewal incident would need its own number.
- INC-3 has no "Was this a real problem?" panel: its monitor is not one the learning loop tunes, and a button that does nothing would mislead.
- The hosted demo tells customers only after access is on for all of them; the live version can do it in steps.

Not built: the recovery link for failed renewals once Razorpay says it is fixed (with the 10% holdout), collecting the renewals themselves, the "failed but access still on" report (J6), duplicate charges and the guarded refund (INC-2), the investigation agent. The submission note (`docs/SUBMISSION.md`) mentions INC-3 only through the gate count.

Checks: 363 backend and synth tests (was 334), 46 snapshot browser tests (was 43; 2 new walkthroughs and INC-3 in the layout test), 13 live browser tests including a new INC-3 flow (the `fix` and `talk` specs ran this time), eval as above, types and lint clean, secret scan clean, no em dashes in new files.

Design review: the `design-reviewer` agent could not be started as an agent in this session, so I ran its checks by hand. Mechanical: types, lint, no hex colours, no inline styles, no raw tags, no `repeat(N, 1fr)`, fixed widths only on an icon tile and legend swatches, no em dashes, INC-3 added to the layout test (375, 768 and 1440 px, no sideways overflow). Looked at: INC-3 at 1440 and 375 px, the fix panel after working through it at 1440 and 375 px, the RAY home at 1440 px. Found and fixed: the language control at 375 px. Not looked at by eye: INC-3 at 768 px (the layout test passes), dark mode, the RAY WhatsApp section (asserted by the browser test, not seen), the Incidents list row for INC-3. Found and not fixed: at 375 px opened directly, no button on the incident pages (Hero A, Hero B, INC-3) is exposed to the accessibility tree; handed off as a separate task.

## 7 Oct 2026, handoff for the next chat (docs only, PR #20)

Written on 10 Oct from the pull request; PR #20 merged at 18:18 UTC. PR #19 (INC-3) had merged before its last documentation commit landed, so `main` had INC-3 without the updated handoff. This closed that gap.

What changed, docs only:
- `docs/HANDOFF.md`, sections 6b and 7 rewritten for the end of 7 Oct:
  - what needs Eshan, and what the next session needs
  - the three candidate next slices, with what each requires
  - a step-by-step recipe for adding a new incident without breaking Hero A or Hero B
  - the traps hit that session

  Its status tables now say PRs #16 and #19 are merged.
- `README.md`, `web/CLAUDE.md`: status rows and a guide to the INC-3 screens.
- `docs/SUBMISSION.md`: the to-do list gains "decide whether the note and the video mention INC-3".

Open items it recorded for Eshan:
- The real against modelled webhook disable. The test-mode experiment showed no disable, while the synthetic world still has Razorpay turning the webhook off after 24 hours.
- The free-model decision for the investigation agent.
- The accessibility task then running in a separate session, which became PRs #21 and #22.

## 7 Oct 2026, 24-hour webhook experiment (integrator)

Closed the experiment that had been open since 6 Oct. Eshan checked the Razorpay test dashboard at 9:12 PM IST: webhook A (the Supabase sink) was still "Enabled", with no banner, warning, failure count or delivery log on the list or the details panel. I read the sink's own log with SQL (read-only): 30 deliveries, two events, 15 attempts each, from 18:41:03 IST on 6 Oct to 17:27:07 IST on 7 Oct (22.8 hours). Each gap was about double the last. The next gap would have been about 23 hours, past the 24-hour limit, and no further attempt came. The sink was still in `401` mode throughout, so the failure never stopped.

Changed: `docs/PRD.md` (4.1 retry schedule and dashboard rows, 16.3 item 1), `docs/HANDOFF.md` (experiment marked done, pending item removed), `docs/SUBMISSION.md` (verify-list row 1 and the to-do list).

What this does and does not show: in a test-mode account, Razorpay stopped retrying and did not disable the webhook, and the dashboard said nothing. It does not show what a live-mode account does, and it does not show whether an email was sent (no alert email was set on the webhook). The note and video must not say "Razorpay disables the webhook after 24 hours" as something we saw. `docs/SPEC.md` INC-1 (a simulated incident that says "disabled after 24 hours") follows the docs claim and was left alone; it is a scenario, not a claim about what we observed.

Not done: the inbox check for a Razorpay email. Nothing in `web/` changed, so no design review was needed.

## 7 Oct 2026, phone-width page hidden from assistive technology (web)

Goal: find out why `getByRole('button', { name: 'Test hook' })` (and the INC-4 and INC-3 buttons) found nothing on an incident page loaded straight at 375px, while `getByText` found the same labels and a screenshot showed them.

Cause: real, not a test artefact. At phone width Blade's `SideNav` renders the menu as two `Drawer`s. The second is created with `isLazy: false`, so it stays mounted while the menu is closed, and its focus manager sets `aria-hidden="true"` on `#root` (and `overflow: hidden` on `<body>`). The whole page was hidden from screen readers and from role queries. A page loaded at 1440px and then resized was fine because the drawers did not exist when the hiding is applied.

What changed:
- `web/src/components/Shell.tsx`: on a phone (Blade's `useBreakpoint`, device type `mobile`) the `SideNav` is mounted only while the menu is open. Tablet and desktop are unchanged. Production nav items are untouched (still greyed and inert).
- `web/e2e/layout.spec.ts`: one new test loads INC-1 at 375px (not resized), finds `Test hook` by role, checks `#root` is not `aria-hidden`, opens the menu, goes to Conversations, and checks the drawer is gone and the page is exposed again. With the fix reverted it fails at the `Test hook` lookup.
- `web/CLAUDE.md`: a Known quirks entry for the workaround (DESIGN.md section 20, rule 6).

Checks: 44 snapshot tests pass on port 5190 (not the shared 5173), `npx tsc -b` and `npx oxlint` clean.

Known and not fixed: while the menu is open, the two drawers each mark the other `aria-hidden`, so the open menu is invisible to assistive technology. This is in Blade and was true before this change. A fix means replacing Blade's mobile `SideNav` with one `Drawer` of our own. Side effect of the fix: the menu now disappears at once when closed instead of sliding out, because it is unmounted. The new test clicks the menu entry by text for the same reason.

Not checked: INC-3 and INC-4 were not loaded at 375px (same shell, same cause, one test on INC-1). No screen reader was used; "exposed" means Playwright's accessibility-tree queries.

Design review: the `design-reviewer` agent was not available in this session, so I ran its checks by hand from `.claude/agents/design-reviewer.md`. A (mechanical): `tsc -b` and `oxlint` clean; no hex colours, no `repeat(N, 1fr)`, no raw elements and no em dashes in the changed lines; the one fixed width in `Shell.tsx` (the 360px search field) is not in the diff; no new routes. B (structure): every production item is still present and inert; the menu button still opens the drawer below the `m` breakpoint (section 14); no page, button or agent flow changed. C (content): no copy changed. D (looked at INC-1 in Chrome at 375, 768 and 1440px): the phone shows the menu button and no side nav, tablet and desktop show the full side nav, the open phone drawer looks as before, no page errors. One finding, the missing `web/CLAUDE.md` note, was fixed. Verdict: pass with notes. The notes are the two items under "Known and not fixed", and a human has not seen the instant close.
## 8 Oct 2026, phone menu hid the whole page from assistive technology (web)

Goal: at 375px `#root` carried `aria-hidden="true"` and `data-floating-ui-inert=""` on every route, so a screen reader saw nothing and Playwright's `getByRole('button')` found 0. The R4 entry above noted it and handed it off. Found the cause, fixed it, added tests.

Overlap: the entry above (PR 21) fixed the closed-page half of this while this change was in review. It mounts `SideNav` on phones only while the menu is open. This change replaces that with one Drawer, which also fixes the two things that entry lists as known and not fixed: the open menu being invisible to assistive technology, and the menu vanishing at once instead of sliding out. Merged with it: its `Test hook` test is kept, its `Shell.tsx` change (the `useBreakpoint` condition) is gone, and its comment and `web/CLAUDE.md` note were rewritten to match.

Cause: Blade's `SideNav`, given `onDismiss`, switches to phone mode below the `m` breakpoint and renders two modal `Drawer`s. The second one (for second-level menus, which we do not use) is created with `isLazy: false`, so it is mounted even while the menu is closed. A mounted Drawer always renders floating-ui's `FloatingFocusManager`, and that marks everything outside its own portal `aria-hidden`. That is `#root`. At 1440px SideNav takes its desktop branch and none of this mounts, which is why only phones were affected and why it was page-independent. Reproduced before touching code (`#root` hidden before any click, and still hidden after the menu was opened and closed).

What I rejected:
- Passing `onDismiss` only while the menu is open, plus a timer for the exit animation. It fixed the closed page but not the open menu: with SideNav's two stacked drawers, each hides the other's portal, so the open menu was not in the accessibility tree either (`getByRole('dialog')` found nothing), and Tab escaped the menu. Measured over repeated runs: focus stayed in the menu in 0 to 2 of 5 runs, with the original code and with this change. Not committed.

What shipped (`web/src/components/Shell.tsx`):
- SideNav is now the desktop nav only (no `onDismiss`, hidden below `m` as before).
- The phone menu is one Blade `Drawer` around the same nav items, which are built once and used in both places. A Drawer mounts only while open, so nothing is mounted when the menu is closed, there is one focus manager, and the dialog is in the accessibility tree and named "Main menu". Measured: focus stayed in the menu in 10 of 10 runs.
- Blade hides the line after a section title (`show-when-collapsed`) with a rule on SideNav's own phone container. The Drawer is outside it, so a four-line wrapper carries the same rule. Blade's `Box` drops `className`, so the wrapper is a plain element with `display: contents`.
- Every production item is still in the menu, greyed and not a link. No item was added, removed or made clickable.

Tests (`web/e2e/layout.spec.ts`), each written first and run red on the old code: at 375px the closed page is not `aria-hidden` and its buttons are found by role; the same line is in the layout loop, so it covers all 22 routes; when the window is widened past the phone layout the open menu closes and the page comes back; the open menu is a named dialog that hides the page, keeps focus inside through 14 Tab and 14 Shift+Tab presses, shows the production items as non-links, and on Escape gives the page back.

Checks: `tsc -b` and `oxlint` clean. Snapshot suite run the way CI does it (`CI=1`, production build) on port 5199 through a throwaway config, because 5173 was held by another worktree: all pass. The `talk` and `live` projects were not run; nothing they cover changed.

Also: widening the window past `m` while the phone menu is open closes it, as SideNav's own phone mode did (the first version of this change lost that; the reviewer caught it, and a test now covers it). The `show-when-collapsed` rule also hides the short "+11" button, not only the lines after section titles. `web/CLAUDE.md` now says why the phone menu is a plain Drawer.

Not changed, found on the way: the nav is built twice in the page while the phone menu is open (the desktop copy is `display: none`), which is harmless. Inert nav items compute `cursor: pointer` rather than the `not-allowed` DESIGN.md section 14 asks for; identical on main, left alone.

Design review: the `design-reviewer` agent is not registered in this session, so I ran its checklist (`.claude/agents/design-reviewer.md`) through a separate general-purpose agent that had not seen my work, and it did not edit anything. Verdict: pass with notes. It ran types and lint, the hardcoded-value, fixed-width, grid and em dash searches (nothing found), and the snapshot suite on a production build (48 passed). It compared the branch with a temporary checkout of main: the closed page at 375, 768 and 1440px and the open phone menu at 375px are pixel-identical except a 1px animation strip; all 18 production items are present and inert in the desktop nav and the phone menu, and clicking one does nothing. Escape and Close both close the menu and return focus to "Open menu". Findings, all fixed or answered above: the widening regression (fixed, tested), no `web/CLAUDE.md` note (added), an incomplete code comment (fixed), and the older cursor note. Not checked by the reviewer: the `talk` and `live` projects, a real screen reader (VoiceOver or NVDA), a real phone, browsers other than Chrome, dark mode, the Drawer animation under reduced motion; it read the 375px screenshots but compared 768 and 1440px by pixel difference only.

## 7 Oct 2026, product guides for people who have never heard of Blindspot (web)

Goal: someone who uses Razorpay and meets Blindspot inside the dashboard should understand what it is for, why to use it and how to use it, in Razorpay's own guide format.

Built: finished the half-built guides from the `docs-guides-review` tab (never committed there; copied here, original untouched). Every guide now has three slides: what it is (hero, one paragraph, figures from the data), why (three cards), how to use it (three numbered steps, from the Subscriptions "Get started" strip). Each of the eight guides has its own isometric scene drawn in code (`components/iso.tsx` kit, `IsoScenes.tsx`), replacing screenshots that were never made and showed as broken images. New "Take the tour" welcome card on the Ray home. It always shows (Eshan's call: a judge should be able to take the tour again and again). The overview guide, which no page linked to, is now in Explore. Settings, Learning and How we know got a "How it works" button. Guide routes are in `e2e/layout.spec.ts`; `e2e/guides.spec.ts` walks the tour.

Second pass after Eshan's review of the screens: cards and steps had an icon over a lot of empty height, the arrows touched the card edge, and Setup's two cards did not match. Setup got selectable cards (channels with Blade's own icons, autonomy levels), two large figures for the scan, equal-height cards, a picture in the left card and a short note under the choices. All three slides are one height (548px) from 1024px up.

Third pass after Eshan's review ("it should look like an extension of the current product, not a vibe-coded one"): the shell used Blade's single-colour glyph beside plain text instead of the real logo; the logo is now the official blue and white lockup (`public/razorpay-logo.svg`). The top bar items were 8px low on a phone (Blade's `TopNavBrand` and `TopNavActions` only centre when the search field shows); measured, fixed, and guarded by `e2e/shell.spec.ts`. Guide cards are rebuilt in the shape of the dashboard home's "Ready-to-use products" cards: white card, inset light panel, flat outlined picture (`FlatArt.tsx`, 19 pictures), chip, title, text. The hero is on a static mint-to-blue wash built from Blade tokens (the RazorSense surface painted white over it), clipped to the card's corner, with the shadow ovals that were cut off removed.

Found by a full pass at 375, 768, 1024 and 1440px, not by eye on one screen: code comments printing as text in the welcome card (now a test); the welcome card and the guides cramped to unreadable columns at 768px (columns now start at 1024px); the Ray hero heading wrapping beside its icon at 768px.

Design review, run before the PR (a general-purpose agent following `.claude/agents/design-reviewer.md`, because the `design-reviewer` agent type is not registered in this session; it reviewed and did not edit). First verdict: pass with notes. Real screenshots at 375, 768, 1024 and 1440px, `tsc`, `oxlint` and the mechanical greps ran clean. Findings and what was done:
1. Guide columns cramped at 1024px (about 780px of content beside the side nav). Fixed: columns and the carousel start at 1280px; below that one slide shows at a time, one column.
2. Top bar cut Payroll in half and hid More at 768px. Fixed: the tab strip shows from 1024px.
3. Big empty band on slide 1 on phone and tablet (equal slide heights). Fixed by the single-slide mode above; a test covers it.
4. Hero scenes small in the panel; the black cube too heavy. Fixed: tighter frames and less padding, and the sealed box is slate. Not fixed: some empty space above and below remains, because an isometric platform is wide and short.
5. Overview guide shown twice on Home (welcome card and an Explore card). Fixed: the Explore card is filtered out again; DESIGN.md sections 15 and 16 now list the welcome card.
6. Two blue buttons close together on Home (Take the tour, Start setup). Left as is: each is its own card (section 15) and the tour is how a newcomer finds the product. Eshan can demote one.
7. Setup on a phone put the question about 560px down. Fixed: below 1024px the stepper card is replaced by a "Step 1 of 3: Channels" line. Not fixed: pending steps show a near-black dot; Blade's `StepItemIndicator` only has semantic colours and "neutral" is its own pending look.
8. Small items fixed: the Blindspot guide's "85 customers" now says "in the first incident" (Setup and the scan say 81 for the last 30 days); the Channels step says which three to start with; the step 3 note no longer says "your choices" where there are none; Explore cards got the divider row of Agent Studio's cards; Home's grid uses `minmax`; indentation. Left: the avatar shape and the dimmer activity and bell icons, which are Shell choices from before this work.
Not checked by the review: the snapshot suite (taken from my run), dark mode, a real GPU, a real phone or screen reader, browsers other than Chrome, the live-mode screens.

The re-review the repo asks for after fixing was NOT run: it was started once, hit a usage limit, was started again, and was stopped at Eshan's request to save tokens. So the verdict above is the first review's (pass with notes), and the fixes were checked by me only: real screenshots at 375, 768, 1024 and 1440px, measured slide heights and top bar centring, `tsc`, `oxlint` (0 warnings), `npm run build` and the snapshot suite (66 passed). Nobody independent has looked at the fixed version.

Decisions (Eshan): three slides rather than Razorpay's two; isometric drawings rather than product screens; a welcome card on the home. An image model was offered for the art and declined: code-drawn scenes follow Blade tokens and dark mode and do not go stale.

What checking caught: the first drawing of Incidents hid everything behind its base tile (tiles now always draw first), and Autonomy's blocks sat behind the steps they stand on. Both found by looking at the scenes at full size. Copy was checked against the screens: setup steps, fix stages, channel list (Instagram and Messenger are in the snapshot) and the three-question rule (SPEC).

Checks: `tsc -b`, `oxlint` (0 warnings), `npm run build`, snapshot suite passed (see the final run below) (three failed once under heavy machine load, load average 22, and passed on their own), no hex colours and no em dashes in `web/`.

Design review: run by hand from `.claude/agents/design-reviewer.md` (the agent was not available in this session). Section A ran clean, with two justified notes: the soft wash behind the heroes is an inline gradient (`GuideHero.tsx`, `Home.tsx`) because Blade has no gradient prop, and the 24px accent line and 40px step circle are fixed sizes for marks. B and C read through. D: real screenshots of every guide slide at 1440px, of a sample at 1024, 768 and 375px, and of Home and Setup at 1440, 768 and 375px. Dark mode was not looked at. The animated RazorSense surface was not seen on a real GPU. Figures on guides come from the snapshot, so on the hosted demo they are static.

Not done: the other tab (`docs-guides-review-e96552`) still holds the same uncommitted files and should be closed or reset so they do not conflict.

## 8 Oct 2026, web (playful layer, from the Razorpay Engage launch video)

Goal: Eshan shared a 64 second recording of Razorpay Engage (ads inside ChatGPT, launched that week) and asked what it teaches about structure, what should go, and how Blindspot can be more playful while still reading as part of the dashboard. Decision (Eshan): take the structure and a little of the play, keep the dashboard shell; message previews must look exactly like the real app; flag it if an image model is needed (it was not).

What I did: watched the recording frame by frame (no audio track, so everything came from on-screen text) and wrote the comparison in chat. Built the first pass Eshan approved:
1. Day-0 scan (`routes/Scan.tsx`): the first visit in a session plays a six line checklist with real counts, then the result as a hero with the figure counting up, numbered "What to do next" cards (why it matters, whose side), one dark banner ("Start with the biggest"), and a "How this scan works" fold-out. Repeat visits skip the replay; "Run it again" plays it again. It says it is a replay of the saved result.
2. WhatsApp drawn as WhatsApp (`components/WhatsAppChat.tsx`, palette in `lib/whatsapp.ts`): used in the fix flow's message step (two phones, the other templates as text), Ray's alerts to the founder (three chats with tappable quick-reply buttons) and the customer side of the WhatsApp demo.
3. The fix flow's finished steps turn into a green tick (`Approved`: "Dry run approved", "Access on for N", "Sent to N customers"), and the message step opens with "Nothing is sent without your approval" and a guardrail line.
4. Playful touches kept small: an italic serif accent on one phrase of a hero heading (`Accent.tsx`, Instrument Serif), the count-up figure, a soft wash, the Ray glyph turning on the active checklist line. DESIGN.md section 21 sets the limits.
5. Trimmed: the INC-4 notice is one sentence; the scan page lost its table and four-line alert.

Rejected: a score out of 100 like Engage's (no data produces it); Engage's own page chrome; confetti; Instagram and email previews (not built, noted in section 21).

Bugs found by looking and testing: the check mark was green on green (fixed); the WhatsApp frame pushed `/chat-demo` 34px sideways at 375px because its grid column was `1fr` (now `minmax(0, 1fr)`); I had shortened "From Kaksha payment help, powered by Razorpay" and a test caught it; two blue buttons on the scan result (now one); the Accordion stops at 800px (swapped for a Collapsible).

Not done, second pass (agreed order): show the real evidence with the key phrase highlighted and a "How we checked" fold-out on the incident page; "Why this matters / Whose side" tags on the fix steps; Home still stacks a welcome card, a setup card and Explore cards before real content (left alone, Eshan's call); email and Instagram previews.

Checks: `tsc -b`, `oxlint` and `npm run build` clean; snapshot suite 66 passed; live suite (talk, fix) 13 passed; no hex colours in `.tsx` (the WhatsApp palette is in `lib/whatsapp.ts`), no em dashes.

Design review: run by hand from `.claude/agents/design-reviewer.md` (the agent was not available in this session). Section A ran clean, with these justified notes: `WhatsAppChat.tsx` uses raw elements and inline styles because it copies Meta's look (DESIGN.md section 21), and the scan hero's wash is an inline gradient as on Home. B and C read through; the scan result has one blue button. D: real screenshots of the scan (running and result) at 1440 and 375px, the fix flow's message step at 1440px, Ray's WhatsApp chats at 1440 and 768px, and `/chat-demo` at 375px. Not looked at: the scan at 768px, the fix flow at 375 and 768px, dark mode, a real phone. Not independent: no second reviewer ran.

Second pass, same day, after Eshan's review of the first: the scan checklist now plays on every visit, not only the first (so the demo can be tried again and again); WhatsApp chats are compact (header and messages only, no input bar or call icons) because the full phone was too large, they use Eshan's real WhatsApp wallpaper image and the Razorpay mark as Ray's profile picture; "What your server did" is a Blade bar chart with axes, legend and hover tooltips instead of hand-drawn bars; Channels now lets you Disconnect and shows an Undo in the demo (browser tab only). Found by looking: the new chart paints nothing in the app's embedded browser pane (it pauses animation frames) but renders correctly in real Chrome, so it was checked there. Not done: `OrdersChart` and `RenewalChart` are still hand-drawn. Checks: `tsc`, `oxlint` clean, snapshot suite 66 passed, live suite 13 passed. Design review by hand again; looked at the chart, Ray's chats and the wallpaper at 1440px in Chrome. Not looked at: Channels at 375 and 768px, dark mode.

## 9 Oct 2026, R4 rest: INC-2, customers charged twice, and the guarded refund (integrator)

Goal: the roadmap's next unblocked item and the first action that returns money. Customers charged twice after an Android release, found, explained, and refunded one customer at a time under rules that cannot be switched off. No model. The choice of slice was mine from the handoff (the other open items need a model account or real rails).

Built:
- World (`synth/duplicates.py`, own random stream, applied last): release android-3.4.1 on Sat 26 Sep 10:00, 15 double-tap pairs (same person, plan and amount, 3 to 90 seconds apart, Rs 4,985 in all), 3 two-seat purchases (a friend's seat, two fulfilled orders) and 2 pairs whose second attempt failed after the bank debited it, 4 complaints (two name the first charge, two the second). 83 existing android orders are relabelled to the new version as adoption; none are added.
- Monitor (`detect/duplicate.py`): same contact and amount under 2 minutes, then sorted by the two orders: duplicate (same person and plan), two seat, second failed, already refunded. An incident needs 3 duplicates from one app version. A release before the first one and none on other versions makes it the merchant's code (attribution row 6); otherwise it is "unknown" (tested).
- Incident (`duplicates/build.py`, `read.py`): INC-2, owner merchant code, confidence high, 6 pieces of evidence, three things Blindspot cannot see, the 5 look-alikes saved as left-out rows with the reason, complaints joined whichever charge they name.
- Refund (`act/refund.py`, executor `approve_row`): the rules in HANDOFF 2g. One person, one customer, one click each; whole-list stages refused; the autonomy setting never runs one; daily limit; one refund per payment; no undo; bank reference after 2, 24 or 72 demo hours. `T-E1` goes out only with the reference. Close needs every refund recorded and the developer's fixed release out for 24 hours.
- Web: `DuplicateView`, `DuplicateFix`, `DuplicateChart` (Blade chart), a fourth chat on the RAY page, hosted-demo frames recorded from the engine (`record_duplicates`), contracts v0.9.

Result (invented data, one seed): 15 of 15 found, onset at the first double charge, alert after the 3rd (146 minutes later), 0 look-alikes in the refund list, 4 of 4 complaints joined. 25 new gates, whole eval 123 pass, 18 reported figures, 0 fail (was 98 and 15). Every Hero A, Hero B, INC-3 and conversation headline is where it was.

What the checks caught, which a read-through had not:
- My first world put orders inside INC-4's outage (Fri morning) and its lost-order estimate fell from 13 to 8. A new incident must not rewrite an older one's story. Then the afternoon-and-evening orders still moved it from 13 to 14, because Zone 1 compares against a baseline of ordinary orders by hour. The double taps now sit between 13:00 and 17:00 and INC-4 and INC-5 are back on 13 and their committed numbers (only INC-4's average order value, about Rs 20, and INC-1's baseline shares moved).
- A first world had every android-3.4.1 order be a double tap, so the evidence read "15 of 34 orders". Adoption is now modelled (relabel, no new orders): "15 of 117".
- The amount reader missed "599 do baar kat gaye" and `extraction_amount_exact` fell to 0.96. It now reads a number followed by "twice" (new test).
- Two of my own gates could not fail (one value was a constant, one expression was meaningless). Rewritten. Then six guardrails were broken on purpose: daily limit removed, tier check removed, anyone may approve, repeat refunds allowed, close without waiting for the fix, message before the bank reference. Five show up as FAIL lines. The repeat refund is stopped in three places, and with two removed the table's primary key crashed the eval, so it is caught by a non-zero exit, not by a FAIL line. My first repeat-refund gate hid behind the daily limit; it now lifts the limit so only that rule is tested.
- The new eval figure "duplicate silent to complained ratio" collided with an existing browser test that finds "silent to complained ratio" by text. Renamed.
- A pipeline rerun after refunds would have turned refunded pairs into "already refunded" look-alikes and lost the incident. A refund Blindspot made keeps the pair a duplicate (test).

Decisions and deviations:
- The hosted demo refunds in the order shown and moves the clock only after all 15 are refunded: a frame per combination of customers would not fit. The live screen has neither limit.
- Refunds close nothing by themselves: the incident closes only after the developer's fix has held 24 hours, because refunding while the app still double charges only makes more work.
- Default cap stays Rs 5,000 and the world owes Rs 4,985, so the demo finishes in one day. The cap is exercised in the eval and the live browser test with a lower limit.
- Refund processing times (2, 24, 72 hours) are invented. There is no real Razorpay refund call (R6).
- The submission note's word count is unchanged: only its gate count was updated (98 to 123). It does not mention INC-2. Eshan's call.

Not built: refunds the bank rejects, the refund-not-received conversation wired to a refund record (`T-F1`), a real test-mode refund, the investigation agent, the recovery link for failed renewals.

Checks: 397 backend tests (was 363), 83 browser tests (4 new: two hosted walkthroughs, one live flow with the daily limit, one layout route), lint, types, secret scan, no em dashes.

Design review: the `design-reviewer` agent is not registered in this session, so its mechanical checks were run by hand (types, lint, no hex, no inline styles, no raw tags, no em dashes, grids use `minmax(0, 1fr)`, the one fixed width is the 56px icon tile) and an independent general-purpose agent did checks B to D from `.claude/agents/design-reviewer.md` in Chrome at 375, 768 and 1440px. Verdict: pass with notes, no blocker. Fixed from its report: the echo bubble said "Looks right, continue" before that was pressed (now echoes "Plan the refunds" first); "Refunded" and "15 refunds made" counted refunds still pending at the bank (now "Refunds started"); the line "Each Refund button sends that customer's refund now. It cannot be undone." now sits above the rows; two typed claims removed ("the first complaint came later", "gets one course"); the payment id was clipped in the first table column at 375px (wider minimum); the fourth RAY chat wrapped to a second row at 1440px (now one row of four). Not fixed, and why: the title breaks inside "android-3.4.1" at 375px and the chart's y-axis skips 18 at 375px (both cosmetic, both Blade's behaviour); the 2, 24 and 72 hour processing times and the 24 hour fix hold are typed in the screen copy and match `act/refund.py` and `merchant_mock.py` by hand; a second "are you sure" click on each Refund button was suggested and not built, because the list approval and the warning at the button already stand in front of it (Eshan's call). Not looked at by the reviewer or by me: dark mode, reduced motion, the evidence page for INC-2 (`/incidents/INC-2/dev`) by eye, the live Refund buttons in any order by eye (the live browser test covers them). After the fixes: INC-2 browser tests and the layout test for `/` and INC-2 re-run and pass; the full suite re-run below.

## 9 Oct 2026, R4 rest: the renewal link for INC-3 (integrator)

Goal: finish INC-3. `T-G1` tells 24 customers "we will send one renewal link once it is fixed". This sends it, once Razorpay's card renewals work again, and measures what it did. Eshan picked this slice from three options. No model, no new account.

Built:
- Template `T-G2` (contracts v0.10) and the INC-3 simulated customer behaviour (`synth/renewals.py`, drawn after every earlier draw in INC-3's own stream; the world was compared table by table before and after, only the `sim.recovery` setting differs).
- Engine: `recovery_link` now plans and runs on INC-3 (`act/executor.py`, `renewal/read.py`). Who gets one: customers whose `T-G1` message was sent, who have not paid since, one each. Gate: card renewals have worked again (the same signal the incident already closes on). Held back: 10 percent by a hash (2 of 24). Goes through the policy engine like every other message; a customer who paid in the meantime is refused at send time. Verify counts who renewed and compares with the held-back group, and an incident with a half-sent link run stays open.
- Hosted demo: frames recorded from the engine (`record_renewal`), replay in `web/src/lib/demo.ts`, two new steps on `RenewalFix` ("Send the renewal links, in stages", "What the customers did" with a button that moves the demo clock 48 hours).

Result (invented data, one seed): 22 links sent, 2 held back, 12 of 22 simulated customers renewed after 48 demo hours (Rs 3,588), 0 of 2 held back. Too few to say what the link adds, and it says so. 7 new gates, whole eval 130 pass, 0 fail. Quote as "works as designed on a simulation".

What the checks caught:
- My first test for "paid again in the meantime" passed for the wrong reason: the customer it picked was one of the two held back, who are never messaged.
- Of five rules broken on purpose, two mutations survived at first. One was written badly (it changed nothing). One guarded a case that cannot happen (a second link plan), so I replaced it with a real one: a customer listed twice would crash the plan on a duplicate key; now they appear once, with a test.
- `tsc --noEmit` passed and `tsc -b` (what the build runs) did not: verify frames were typed `unknown`.
- Running the eval twice on the same database changes the match calibration and rewrites 26 unrelated case snapshots. `make snapshot` end to end does not.

Decisions and deviations:
- The link goes only after `T-G1` was sent, so nobody gets a link without the explanation, and the promise in the message is kept for exactly the people it was made to.
- No "Razorpay says it is fixed" button: the data already says it (3 card renewals since the last failure), so a mock button would have been a second source of truth.
- Hosted demo limits: links go out after everyone has been told (the live version does it in steps), and the clock moves only after all links are sent.
- The "failed but access still on" report (J6) is not built. It is a separate slice.

Checks: 412 backend tests (was 397), 69 hosted-demo browser tests and 15 live ones pass, lint, `tsc -b`, `npm run build`, no em dashes in changed files.

Design review: the `design-reviewer` agent is not offered in this session, so its checks were run by hand. Mechanical: `tsc -b`, oxlint, no hex colours, inline styles, raw tags, fixed widths or `repeat(N, 1fr)` in the diff, no em dashes. Looked at: the new steps at 375, 768 and 1440 px by screenshot, which were tall element captures with the sticky top bar over them, so layout was judged by the no-sideways-overflow check at all three widths and by reading the text. Not looked at by eye: 768 px, dark mode, the phone width after the clock moves.

Address change (10 Oct 2026): Eshan renamed the Vercel domain. The hosted demo is now https://razorpay-blindspot.vercel.app/ and razorsense-starter.vercel.app returns 404. Checked: the new address and a deep link (`/incidents/INC-3`) answer 200. Updated in `README.md`, `docs/HANDOFF.md` (three places) and `docs/SUBMISSION.md` (two places). No code, CI file or config held the old address.

## 10 Oct 2026, data retention (integrator)

Goal: make "Kept for 30 days" on the Channels screen true. F-54 (redaction, retention, suppression) is a Must feature, and the handoff listed retention as "stored, not enforced". No model, no new account, no screen or contract change. Chosen after reading all of `docs/`: the other open items need a model account (investigation agent, three-way eval) or real rails (R6), so they wait for Eshan.

Built (`backend/app/conversation/retention.py`, one hook in `main.advance_clock`):
- A sweep, run whenever the demo clock moves. A conversation with no activity for the retention period of its channel (the latest consent's `retention_days`, 30 if none) loses its transcript text and its `token_vault` rows (the real phone, email, UPI handle and bank reference). One audit line (kind `policy`) with the counts. Idempotent.
- Kept: redacted complaint text, case, each message's template id and policy decision, the audit log.
- Skipped: conversations on an incident that is not closed, and conversations with a reply waiting for approval.
- A conversation still marked open is set to "resolved", so a returning customer starts a new one.

Decisions:
- Complaint text is not blanked. The pipeline rebuilds every case, extraction and match from `complaints.raw_text`, so blanking it would change which customers count as having complained. Live conversations already store only the redacted text there, so the sensitive part is the vault. The cost is that redacted text stays forever: stated in the handoff, not hidden.
- Raw attachments (SPEC 3.4 says 7 days): none exist in this build (screenshots are simulated text), so there is nothing to purge and no rule was written for them.
- It runs on the clock move, not a timer, because the demo clock is the only time source the engine has.

What checks caught:
- First run of the "no number moves" test failed for two reasons that were mine: a pipeline rebuild reopens every incident (the sweep correctly skipped it), and my baseline compared a hand-set flag against a rebuilt one. The test is now a control experiment: copy the database, sweep one copy, rebuild both, compare incident members and cases.
- A rebuild also leaves a live thread pointing at a case id that no longer exists, so the thread page crashes. Pre-existing and independent of this change (it happens without a sweep). Not fixed here; written in the handoff.
- Six rules broken on purpose, each caught by a test: ignore open incidents, ignore pending drafts, keep the vault, ignore the granted period, leave the thread open, keep the transcript.

Result: 8 new tests, backend 420 pass, web build, lint and secret scan clean. No eval gate added: retention is policy behaviour with no ground truth to score against.

Not built: a real timer, deleting redacted complaint text (needs the pipeline to stop rebuilding from it), a "delete this customer's data" action, retention shown anywhere except the one line on Channels. Not touched: `web/`, so no design review.


## 10 Oct 2026, handoff and submission note synced with main (docs only, PR #28)

Written on 10 Oct from the pull request; PR #28 merged at 08:04 UTC. These stale statements were found while reading all of `docs/` against `main`.

What changed, docs only:
- `docs/HANDOFF.md`:
  - Data retention is merged (PR #27), not in review.
  - The contract tags line says v0.2 to v0.10.
  - The open-PR paragraph and the phone accessibility task are closed (PRs #21, #22).
  - It notes the old remote branches and worktrees that still exist (not deleted).
- `docs/SUBMISSION.md`:
  - The note said 123 eval gates; `make eval` then gave 130 pass, 0 fail.
  - Item 5 also says INC-2 and the renewal link are built and not in the note.

Checks: `make test` (420 passed, build, secret scan clean), `make eval` (130 pass, 0 fail, 21 reported). No code or contract change.

Later the same day: PR #29 (J6) added 8 gates, so `make eval` gives 138 pass, 0 fail, 23 reported. `docs/HANDOFF.md` says 138, while `docs/SUBMISSION.md` still says 130 (line 24, and "130 on 10 Oct" in item 5). Not changed here; it is Eshan's note. See the open items at the end of this log.

## 10 Oct 2026, business case, pricing and interview digest (docs only)

Placed above the J6 entry on purpose: another open pull request (design pass batch 1) appends at the end of this file, and a second append there would be a merge conflict. Move it to the end whenever convenient.

Goal: price the product for production, not the demo, and put what Razorpay's own people have said into the repo, so product and tech decisions are made with it. Eshan asked for the base case to be frozen, not stretched, with every scenario and sensitivity recorded and the decisions written into the product docs.

Built:
- `docs/business_model.py`: one seeded, standard-library script that produces every figure in the business case (frozen base, four scenarios, pay cases, break-evens, a tornado over 22 inputs, pricing and demand sensitivity, 20,000 random draws, a merchant's view). It passes `ruff` and runs in a few seconds.
- `docs/BUSINESS_CASE.md`: the frozen assumptions with a source tag on each, results, sensitivity, the three-layer offer, how a merchant sees value and cost, the do-it-yourself alternative, decisions B1 to B12, the pilot and its gates, the five internal queries, and a change log.
- `docs/RAZORPAY_TRANSCRIPTS.md`: the unabridged transcripts of five interviews and talks (about 25,000 words, from the text Eshan pasted, with a header that says how to use it and that they are third-party material for private research). It exists so other sessions read what was said, not a summary. Plain Markdown so any agent can read it directly (a first version was a Word file; Eshan asked for Markdown). The repository is private; do not publish it. The only edits to the captions are paragraph breaks and 15 em dashes turned into a spaced hyphen, to follow the no-em-dash rule.
- `docs/INTERVIEWS.md`: a digest in our own words of nine sources (a post, three interviews and talks, Razorpay pages, pricing pages, the RazorpayX billing doc, the job descriptions, pay data), with the calls each supports for the demo (T1 to T8) and for production (P1 to P10).
- Existing docs: PRD decisions D12 to D19, risks, kill criteria K7 and K8, section 14 and 17 and 18; SPEC section 21 (prototype to production mapping); BUILD_PLAN gate G6 and section 13; HANDOFF section 4b, read-first and next steps; SUBMISSION section 5 (questions after the video); root `CLAUDE.md` read-first line.

How the number changed, and what I got wrong on the way (all in the change log of the business case):
- The first production model assumed every detected incident became a paid fix and that Guard customers paid for 12 months. Adding a detection rate, a paid-fix approval rate and 80 percent paid months cut fee revenue from 0.72 to 0.33 and Guard from 1.81 to 1.27 (₹ cr).
- Agent Studio's "couple of thousand merchants live" cut the first connected-merchant assumption from 75,000 to 20,000. Eshan pointed out it is a gated early-access product, so the frozen base is 40,000, still far below the first guess.
- The team cost fell from ₹1.8 cr to about ₹0.4 cr a year when the dedicated team became man-hours of a small squad (Harshil Mathur's post describes a two-person AI team), then rose a little with ISB pay (₹25 to 38 lakh cash plus ESOP).
- A chat figure was wrong: Guard costs 56 percent (mid-size) and 40 percent (large) of the value it restores, not 45 and 32, because the earlier figure left out the detection rate. The pilot is about ₹0.8 cr, not ₹0.5 cr.

Decisions: the case is a low-cost option on trust, not a revenue line (three-year total -₹1.09 cr on direct revenue, +₹0.28 cr with ₹50 of avoided cost per incident). Watch is free, Fix is 1 percent of value restored, Guard is ₹999 or ₹2,999 a month. Production hands refunds, recovery links and renewal links to existing Razorpay tools. No model in the competition build.

Not done: no code, contract, screen or snapshot changed. Items queued in BUILD_PLAN section 13 (no-false-urgency template check, fee preview and receipt, rename of the access check in the mock) are not started. Sources that were blocked (LinkedIn, The Ken podcast, the Agent Studio page) are listed in INTERVIEWS section 9.4. The model is a planning tool on assumed inputs: the funnel above the cohort and Guard uptake have no public source.

Checks: `ruff check docs/business_model.py`, the script run twice with the same output, every figure in `BUSINESS_CASE.md` compared with the output, no em dashes in any changed file, the transcripts file read back (ten distinctive phrases and all five endings present), and a trial merge of this branch against the open design pull request (no conflicts). Not touched: `web/`, so no design review. Not checked: the transcripts file against the original recordings (it is the captions as pasted, errors included).

## 10 Oct 2026, R4 rest: J6, access without payment (integrator)

Goal: the last after-the-payment journey in the spec that needed neither a model nor a new account. V1_SPEC J6: UPI renewals failed for insufficient funds, but access stayed on past the merchant's grace rule. Report only, no revoke. I chose it from the handoff's list (the investigation agent needs a model, R6 needs accounts). It is the mirror of Hero A: there customers paid and have no access, here they have access and have not paid.

Built:
- World (`synth/leakage.py`, own random stream, applied last): 23 UPI AutoPay renewals. 9 failed for insufficient funds more than 48 hours before the snapshot and still have access (the report), 5 failed and were cut when the rule ran out (correct), 3 failed and paid again on their own, 4 failed in the last 48 hours (inside the rule), 2 failed on the bank's side with access on. Truth in a new `truth_leakage` table. Failures are drawn in office hours between 20 and 26 Sep and 1 to 2 Oct, clear of INC-3's UPI control hours and of every Zone 1 evening window.
- Report (`backend/app/leakage.py`): one read-only function over payments, subscriptions and the access records, at the demo clock's time. The rule is the merchant's own `grace_hours_after_failed_renewal`. It is not an incident (no id, no row in `incidents`), so no incident number moved. Inside-rule customers join the report when the rule runs out (after 48 demo hours it lists 13).
- API and screen: `GET /api/leakage` (contracts v0.11), `routes/Leakage.tsx` at `/access`, side nav "Access report". A plain GET, so the hosted demo reads a snapshot file and needed no replay frames. No button, nothing written, no action that removes access.

Result (invented data, one seed): 9 of 9 found, precision and recall 1.0, 0 look-alikes listed, 4 inside-rule customers shown apart. Rs 2,691 unpaid, longest 9 days 20 hours over. Eval 138 pass, 0 fail, 23 reported (was 130 and 21). Backend 433 tests (was 420), snapshot browser suite 71, live suites 15.

What the checks caught:
- The config had `inside_grace` twice (a time window and a count), so the second silently replaced the first and the generator crashed. Renamed the window `inside_window`.
- The first run of every new test passed, which proves nothing. Six deliberate breaks of the report (ignore a later payment, include cards, blame bank-side failures, ignore whether access is on, hard-code 48 hours, count inside-rule customers as leaks) were each caught by a test, and one of them also turned two eval gates red. Reading the report writes nothing is checked by SQLite's `total_changes`.
- I first claimed "the eval is unchanged" from the counts alone. `eval/report.*` is git-ignored, so that was not proof. I built `origin/main` in a scratch folder and compared all 151 old metrics by name: identical value and status, 10 added.
- A second look at the page on a phone found the "9 found" and "Will cross" badges cut to "9..." and "Will...", and the stat cards squeezed into two columns. Badges removed (the title says it), one column on phones.
- The independent review found "6 days 24 hours" (rounding after the day split), a "nothing to press" test that could not fail (the app has no `main` landmark, so the count was always 0; now matched by button name and shown to fail when a "Send message" button is added), "Rs" in the headline against the rupee sign everywhere else, and a funnel where one customer vanished between 25 and 19 (bank-side failures with access cut were not counted; now every step is accounted for, with a test).

Side effects to know (computed data, not typed text):
- The world has 23 more UPI renewals, so INC-3's "what they have in common" table compares against a bigger renewal base: cards fall from 45 to 30 percent of renewals (lift 2.2 to 3.4) and a true row appears (every failure was `GATEWAY_ERROR`, 100 percent against 15). INC-1's comparison shares moved by under 1.5 points. "874 access records" is now 897. Fuzzy match scores on cases moved in the third decimal (suggestions only, no metric moved). No headline number of any incident changed. `demo.json` also changed in generated ids on every rebuild.

Decisions:
- Scope is customer-side failures only (the spec says insufficient funds). Bank or Razorpay-side failures are counted as left out, never as leaks.
- Named "Access without payment" on screen, because the Day-0 scan already uses "leaked" for the opposite case (paid, no access).
- No CSV export, no nudge to the customer, no grace rule edit. A report with no action was the brief.

Not built or not checked: the report cannot tell a leak from access the merchant extended on purpose (the page says so), only UPI AutoPay is covered, the access records are the 10:30 export and not live, the empty state (zero customers) and the error state were read from code and not seen, dark mode, a real screen reader. The existing grey nav items show `cursor: pointer` and not `not-allowed` (found by the reviewer, same on `main`, left alone).

Checks: `make test` (433 backend tests, build, secret scan), `make eval`, `tsc -b`, `oxlint`, snapshot suite 71, live suites 15 (run with `CI=1`), no em dashes in the changed files.

Design review: the `design-reviewer` agent type is not registered in this session, so a general-purpose agent that had not seen my work followed `.claude/agents/design-reviewer.md` and edited nothing. Verdict: pass with notes. It ran types, lint and the mechanical searches (hex, inline styles, raw tags, fixed widths, `repeat(`, em dashes: clean), checked the page against section 15's list template, confirmed no primary button and that every production nav item stays inert, and looked at 375, 768 and 1440px in Chrome (no sideways overflow, no console errors). Seven findings, all fixed or answered above except two it left optional: the tables scroll sideways inside their box on phones (allowed by the layout rule, and "Your rule" now comes before "Renewal failed" so the key column shows first), and the nav cursor. It could not check: the live API route, the empty and error states, dark mode, screen reader and tab order, or the numbers against the database (the tests and eval do that). Not independent after the fixes: I re-checked the hours text, the funnel and the test by running them, and nobody re-read the final page.

## 10 Oct 2026, design pass: the review, the plan and how it shipped (web, PR #30)

Goal: Eshan asked for a sweep of every page and journey from a small merchant's point of view, as a visual and product designer would. He named four things: a Setup picture that moves, shorter WhatsApp previews on the home, the Channels layout (empty right side, Disconnect stacked under the text), and the loading state. He asked for every other page to be checked the same way, against Blade and Razorpay's look.

How the review was done:
- Every route was opened at 1440px, and Home, Setup, Channels and Incidents at 375px. The tool was Playwright from `web/node_modules`, with screenshots in the session scratchpad, not the repo.
- Pages scroll inside an inner element, not the window, so a "full page" screenshot showed only the first screen. The viewport was grown to the height of the page container for each shot.
- The Playwright version in `package-lock.json` wanted Chromium headless shell build 1243, which was not installed. It was installed with `npx playwright install chromium` (the e2e tests need it too).
- Rules read first: `web/CLAUDE.md` and `web/DESIGN.md` sections 6 to 8, 13 to 21.

What the review found, page by page, and which batch took it:
- Every page: a bare "Loading" word in the corner (batch 1). Long pages with the main action at the bottom (batch 2). Walls of numbers where a summary or a chart would do (batches 2 and 3). A dead "Upload file" in Ray's chat box (batch 1).
- Ray home: four full WhatsApp chats, against DESIGN.md's own "at most two side by side" (batch 1). Explore cards with an empty band and an orphan card (batch 3). Explore far too long on a phone (batch 3).
- Setup: a static picture, the same on every step, and a blank band above the heading on step 1 (batch 1).
- Incidents list: cut-off titles, a three-line "Started" column, no summary, an unexplained "0 found", figures off screen on a phone (batch 2).
- Incident pages: INC-1's stat cards laid out unlike the other three; evidence as a list of percentages; a bold, heavy customer table; "Change it" in the browser's default link style; the fix 4,000px down (batch 2).
- Channels: nine full-width cards repeating the same lines, and Disconnect stacked under the content (batch 1).
- Conversations: demo buttons that read like filters, complaint rows as cards (batch 3).
- Audit log: a one-line empty state (batch 3).
- How we know: 161 rows with no summary (batch 3). Learning: the six-week result as a table (batch 3).
- WhatsApp demo: the founder's half empty until the first message (batch 3).
- Fonts, spacing and icons were already on Blade tokens and Blade icons throughout. The one gap was channel icons missing from Channels and Conversations (batches 1 and 3).

Left as they were (looked at, no change needed or out of scope): the guide pages, the Day-0 scan page, Settings, the Developer evidence page, the case page, the help, email, Instagram and public-post demos, INC-1's "Can Razorpay replay these?" and "Look at 5 before acting" panels, and Setup's own unselected-choice circle (hand-drawn, older than this work). Also untouched: `OrdersChart` and `RenewalChart` (still hand-drawn, already noted in DESIGN.md section 21), the help bubble (DESIGN.md section 16, not built), and the email and Instagram previews (still plain cards).

How it shipped:
- Batch 1 was built, reviewed, committed and opened as PR #30 with Auto-fix on. The branch was cut from an older `main`. Updating it with `git reset` or `git merge --ff-only` was refused by the session's permission check, so the app's sync tool merged `main` instead. The first sync conflicted only in this file (both sides appended an entry); both were kept, main's first. Main had also added the Access without payment report (PR #29), which got the loading skeleton too.
- Eshan then asked to build all three batches and ship them together in PR #30. Batches 2 and 3 were built on a local branch stacked on batch 1, committed one per batch, and fast-forwarded onto #30's branch. Four files were changed by both batches: this log, `web/DESIGN.md`, `web/CLAUDE.md` and `web/e2e/smoke.spec.ts`. They were split so that each commit holds only its own batch's lines. A second sync brought in main's docs-only PR #31 with no conflict.
- Bots on #30: the Vercel preview deployed, and CodeRabbit started a review. Neither had findings when this was written.
- Each batch went through the design reviewer: batch 1 failed, then passed with notes; batches 2 and 3 passed with notes. Every finding was fixed or is written down in the batch entry. The `design-reviewer` agent type is not offered in this session, so each time a general-purpose agent was given `.claude/agents/design-reviewer.md` and told to edit nothing.

Not checked anywhere in this pass: dark mode, and reduced motion by eye (the code paths were read, and each new animation has a still version).

## 10 Oct 2026, design pass batch 1: loading, Ray on WhatsApp, Channels, Setup pictures (web)

Goal: the first of three design batches from Eshan's end-to-end review as a small merchant. This batch covers what he named: the loading state, the WhatsApp previews on the home, the Channels layout and the Setup picture.

Built:
- `components/PageSkeleton.tsx`: Blade `Skeleton` shapes for a title, a row of figures and a card. Every page that showed a bare "Loading" word now shows it: Channels, Case, Dev, the three incident views, How we know, Settings, Conversations, Incidents, Audit log, Day-0 scan, and the Access without payment report that came in from main. On Incidents and Audit log it also stops "0 found" and "0 entries" from flashing up before the data arrives. Learning's weekly line loads as a one-line skeleton.
- `Analyzing` (`components/AgentAnswer.tsx`) now turns the Ray glyph as DESIGN.md section 8 describes (480ms, emphasized easing, pause, repeat), still for reduced motion. Ray's home answers use it in place of "Looking at your incidents" and "Scanning".
- Ray on WhatsApp (`routes/Ray.tsx`): was four full chats side by side, 700 to 800px tall each. Now the four problems are cards you can pick, each with one line of figures read from the ray card ("85 customers · ₹56,319 at risk"). Beside them is one short clip: the first heads-up only, with its two buttons. Eshan picked the switcher over a 2x2 grid. Heading changed from "RAY" to "Ray", as everywhere else.
- Ray chat box: Blade's default "Upload file" did nothing, so it is hidden (`hideFileUpload`).
- Channels: two groups instead of nine full-width cards. "Where customers write to you" (six cards, two columns) and "Ways you bring complaints in" (three small cards with one line each). Each card has the channel's Blade icon in a tile and the badges under the name, with Disconnect (or Undo) at the top right at every width. The consent list follows, and "Kept for 30 days" sits as a footer under a divider. Each group heading says how many are on. "Forward from RAY" became "Forward from Ray".
- Setup (`components/SetupScene.tsx`): the static network picture is replaced by a moving scene per step that follows the choice on the right:
  - Channels: the ticked channels send messages to Ray, and an unticked one goes grey and dashed.
  - Autonomy: Suggest stops each step at a "you" checkpoint that pulses, Assist shows one green tick and lets steps through, and Autopilot draws a dashed limit with the checkpoint off.
  - First scan: a line sweeps the customers and the stuck ones turn orange.

  Blade icons and tokens only. Still for reduced motion.
- Setup's right card: the empty 20px row kept for Back is now one row on every step with Back (once there is a step to go back to) and "Step 1 of 3: Channels", so the heading still does not move and there is no blank band.
- Docs: DESIGN.md sections 15, 16 and 21, and web/CLAUDE.md files list.

Tests: four browser tests read the full home chats (the second message, "Your pay page is not answering", and so on). They now pick the problem first and check the shorter clip. The smoke test checks the figure line beside the clip in place of the cause line.

Checks: `tsc -b`, oxlint, `npm run build`, no hex colours outside the WhatsApp files, 69 hosted-demo browser tests and 15 live ones pass.

Design review: the `design-reviewer` agent is not offered in this session, so a general-purpose agent ran its file (`.claude/agents/design-reviewer.md`) on the diff. First verdict was fail, with two content findings:
- The Assist picture showed steps running straight to customers, while Assist still needs the founder for messages.
- "13 orders lost" read as exact for an inferred incident.

Five low ones came with them: a bordered Box in place of a Card, "Ray reads and replies" on Channels, a scene that looped forever, a hand-drawn radio circle, and the clip below the picker on phones. All seven are fixed. Second verdict: pass with notes. Taken: the picker column now fills the clip's height. Left as is: the Autonomy scene plays for about 10s per choice (three short plays, then it rests). Not checked: dark mode, reduced motion by eye (code paths read only), live-mode Channels by eye (the 15 live tests pass), skeletons on every page by eye.

Files: new `components/PageSkeleton.tsx` and `components/SetupScene.tsx`. Changed: `components/AgentAnswer.tsx` (`Analyzing`), `components/RayAnswers.tsx` and `lib/format.ts` ("Forward from Ray"). Routes: `Audit`, `Case`, `Channels`, `Dev`, `DuplicateView`, `Home` (`hideFileUpload`), `How`, `Incident`, `Incidents`, `Learning`, `Leakage` (after the sync), `Ray`, `RenewalView`, `Scan`, `Settings`, `Setup`, `Threads` and `Zone1View`. Tests: `e2e/demo.spec.ts` (Hero B, INC-3 and INC-2 walkthroughs pick their problem on the home first), `e2e/smoke.spec.ts` (S-01). Docs: `web/DESIGN.md`, `web/CLAUDE.md`, this log.

Noticed along the way:
- Blade's `ChatInput` has a `hideFileUpload` prop; the upload link is on by default.
- A Blade `Card` with `onClick` puts an invisible button over the whole card. Playwright refuses to click the title text under it, and the button itself reads as not visible, so tests click the title with `force: true`.
- The Setup scene restarts when a choice changes (the drawing is keyed on the choice), plays three times, then rests on its last frame.

Not in this batch (batches 2 and 3, listed for Eshan): incident pages (stat row, a "Start the fix" button on the timeline, evidence as bars, a lighter customer table, a summary on the incident list, phone cards for it), How we know summary, a Learning chart, a Conversations table, the Audit log empty state, the WhatsApp demo layout, and the Explore cards.

## 10 Oct 2026, design pass batch 2: incident pages (web)

Goal: the second design batch from Eshan's review. On the incident pages the fix sat at the bottom of a 4,000px page, INC-1's figures were laid out unlike the other three views, the evidence was a wall of percentages, and the list cut titles off and hid its figures on a phone. Built on top of batch 1 (PR #30).

Built:
- `components/StartFix.tsx`: "Start the fix" (or "See how it was fixed" once closed) at the bottom of every incident's Timeline. It is the detail template's one call to action and scrolls down to the fix steps. It is shown from `l`, where the Timeline stays in view beside the content. Below that the Timeline sits under the fix steps, so the button sits under the stat row instead.
- INC-1: the full-width "Affected" card and three uneven ones are now four across, as on INC-2 to INC-5. `Stat` fills its grid cell, so every stat row is one height even when a hint wraps.
- INC-1 evidence: each pattern is a pair of Blade `ProgressBar`s, orange for the share of affected payments and grey for the share normally, with the figures under them, biggest gap first. Four are shown, then "Show all 9".
- INC-1 customers table: "What happened" is no longer bold, so 85 rows of long text read lighter.
- Fix panel: "Change it" is Blade's `Link`, not the browser's default underlined one.
- Incidents list:
  - Three stat cards added up from the rows: open incidents, at risk, customers affected. The hint says how many of the customers are estimated, from inferred incidents.
  - The empty "Inside the payment" group now says why: bank and UPI failures are on Razorpay's own dashboard (the Incidents guide says the same).
  - "Could have known" shows only the time when it is the same day.
  - Titles wrap in place of being cut off. Blade's `Link` is `max-content` on purpose, so the title is the router's link around Blade `Text`, as the Explore cards do. This is noted in web/CLAUDE.md.
  - Below `l` (phones and tablets) each incident is a card with its figures, in place of a table that pushed Affected and At risk off the screen.
- Docs: DESIGN.md section 15 (list and detail templates) and the Link quirk in web/CLAUDE.md.

Files: new `components/StartFix.tsx`. Changed: `components/Stat.tsx` (fills its cell, icon does not shrink), `components/FixPanel.tsx` (Blade `Link`), and routes `Incident`, `Zone1View`, `DuplicateView`, `RenewalView` and `Incidents`. Tests: `e2e/smoke.spec.ts` (one new test). Docs: `web/DESIGN.md` section 15, `web/CLAUDE.md`, this log.

Noticed along the way:
- INC-2 to INC-5 already had four stat cards across. Only INC-1 was different.
- INC-1's first card keeps the label "Affected", because smoke test S-03 checks that Complained plus Silent equals Affected. "paid, no access" went into the hint.
- Playwright's `getByText(...).first()` picks the first match even when it is hidden. The phone cards come after the table in the page, so a desktop test finds the table row.
- The evidence sort (biggest gap first) is a presentation choice; the figures are the engine's.

Tests: a new smoke test covers the stat cards, the empty-group note, and "Start the fix" bringing "Fix it" into view.

Checks: `tsc -b`, oxlint, `npm run build`, and all 87 browser tests (72 hosted-demo, 15 live) pass.

Design review: a general-purpose agent ran `.claude/agents/design-reviewer.md` on the diff, since the agent itself is not offered in this session. Verdict: pass with notes. Six notes, all taken:
- The table only becomes cards below `l`, not `m`, because at 768px it still cut the figures off.
- Below `l` there is a "Start the fix" button under the stat row.
- Stat icons no longer shrink.
- The list's stat cards stack below `l`.
- The evidence legend says "dark grey", which is what Blade's neutral bar draws.
- "At risk" says how much of it is estimated, as the customer count does.

Not checked: dark mode, reduced motion, INC-2 to INC-5 by eye at 375 and 768, the expanded "Show all" state by eye, live mode by eye.

## 10 Oct 2026, design pass batch 3: proof pages, demos and Explore (web)

Goal: the third design batch from Eshan's review: the pages that prove the product works, the demo entry points, and the Explore cards. Built on top of batches 1 and 2. All three go up together.

Built:
- How we know: opens with "138 of 138 scored checks pass" as a heading in a card, then four checks a founder would ask about, as stat cards in plain words:
  - stuck customers the Day-0 scan found (81 of 81)
  - customers named who were really affected (100%)
  - access given to someone not owed it (0)
  - replies that asked for a password, card or OTP (0)

  Every value and target is read from the report; only the labels are ours. The 161-row table is behind "Show all 161 checks".
- Learning: the six-week table is a Blade line chart with a line each for no learning (grey, dashed), weekly baseline (gold) and with learning (green). The lines are straight (`type="linear"`), because Blade's default curve drew values between weeks that are not in the data. The totals stay under the chart.
- Conversations:
  - The five demo buttons, which read like filters, are now "Try it as a customer": a card each with the channel's icon and one line. WhatsApp, the fullest demo, is wider so the rows come out even.
  - The 55 complaint cards are a Blade table, ten to a page, with a count line ("55 complaints, 24 matched to a payment"). Each row's link is the time it came in, so the link names that complaint. Below `l` each complaint is a card, ten at a time with "Show 10 more".
  - Complaint summaries carry no message text, so the table cannot show the customer's first words without fetching all 55 cases. Not done.
- Audit log: when the log is empty, a Blade `EmptyState` with the flat "approve" picture, a line on what lands here, and "Open incidents".
- WhatsApp demo: the founder's half of the page was one muted line until the first message. It now holds an `EmptyState` card saying what will appear there.
- Explore cards (home):
  - Each card has a one-line summary (a new `summary` in `lib/guides.ts`, written to fit and to be true today) and an "Open guide" footer, in place of a lone chevron.
  - The grid is four across from `xl`. The first card (Incidents) spans a full row below `xl` and half a row from `xl`, so no row has a gap.
  - On phones the sentence is hidden to keep the list short.
- Docs: DESIGN.md sections 15 and 21, and the EmptyState size quirk in web/CLAUDE.md.

Files: routes `How`, `Learning`, `Threads`, `Audit`, `ChatDemo` and `Home` (the Explore section), and `lib/guides.ts` (an optional `summary` on each guide). Tests: `e2e/smoke.spec.ts` (S-10), `e2e/talk.spec.ts` (the exact "Complaints" lookup). Docs: `web/DESIGN.md` sections 15 and 21, `web/CLAUDE.md`, this log.

Noticed along the way:
- The eval report has 161 checks: 138 scored and 23 reported, not scored. `docs/SUBMISSION.md` still says 130 gates (see the open items below).
- Blade's `ChartLine` draws a smooth curve by default, which makes up values between weeks. `type="linear"` draws straight lines.
- Blade's `EmptyState` limits its picture to 60, 90, 120 or 160px square by size. The `xlarge` size also makes the title display-sized, too big for a card, so both empty states use `large`.
- The Audit log is empty in the hosted demo until you act. Approving a step adds lines (`lib/demo.ts`), so the empty state's "approve a step of its fix to see the first entry" is true.
- The four headline checks on How we know were picked because a founder would ask them. The wording is ours; every value and target comes from `eval/report.json`.

Tests: the How we know smoke test checks the score line, then opens "Show all" before reading a row. A live test looked up "Complaints", which now also matches the count line, so it asks for the exact word.

Checks: `tsc -b`, oxlint, `npm run build`, and all 87 browser tests (72 hosted-demo, 15 live) pass.

Design review: a general-purpose agent ran `.claude/agents/design-reviewer.md` on the batch 3 files. Verdict: pass with notes. All seven notes are taken:
- The complaints table cut columns at 375 and 768 and every link read "WhatsApp payments number". It now shows cards below `l`, and each link is the time the complaint came in.
- Explore sentences were cut mid-word, so each guide got a short summary.
- Learning's week labels ran together on a phone, so they are "W1" to "W6" under a "Week" axis title.
- Learning's subtitle says the three lines match until week 3.
- How we know's "gates pass" badge repeated the heading, so it is now a plain count.
- A failing check shows a warning icon, not a red tick.
- "Day-0" in a stat label no longer breaks at the hyphen.

Not checked: dark mode, reduced motion, the Audit log with entries in it, the WhatsApp demo after a message by eye, complaint pages 2 to 6, live mode by eye.

## Open items, as of 10 Oct 2026 (after the design pass)

Collected while writing this log up in full. Nothing here was changed without being asked.
- `docs/SUBMISSION.md` says "130 eval gates pass" (line 24, and item 5). `make eval` now gives 138 pass, 0 fail, 23 reported, since J6 (PR #29). `docs/HANDOFF.md` already says 138. It is Eshan's note and near its word limit, so it was left for him.
- `OrdersChart` and `RenewalChart` are still hand-drawn bars; DESIGN.md section 21 says they should move to Blade charts.
- The help bubble (DESIGN.md section 16) is not built.
- The email and Instagram message previews are plain cards, not drawn as the app (DESIGN.md section 21).
- Dark mode has not been checked on any page.
- The thread page crashes after a pipeline rebuild leaves a thread pointing at a case id that no longer exists (data retention entry above). Not fixed.
- Old remote branches and worktrees still exist (PR #28 noted this). This session's worktree and its stacked branch `claude/design-batch-2-incidents` go once PR #30 merges.

## 10 Oct 2026, review against the full transcripts, and the no-false-urgency check (integrator)

Goal: Eshan asked whether the design trends, business updates, pricing and what Razorpay's founder, chief product officer and tech team said change the PRD or the roadmap, and to change them only if they do, then keep building.

Method: read the PRD, build plan, business case, interview digest, handoff and the last build log entries, then read all five transcripts in full (S1 to S5, about 25,000 words) instead of relying on the digest, read `web/DESIGN.md` section 17, merged the design pass from `main` (PR #30), and searched for Agent Studio pricing and Razorpay news.

Findings (full table in `docs/INTERVIEWS.md` section 10):
- Most of it was already absorbed by the earlier 10 Oct docs pass (D12 to D19, the production cuts, T1 to T8, P1 to P10). Pricing, the business case numbers, the design guide and the release plan stay as they are. Razorpay has published no Agent Studio price, and no unfreeze trigger fired.
- Three real gaps, now fixed: the no-false-urgency rule (B12, S6) was in the business case and the backlog but not in the PRD or the code; Guard's prevention checks (test ping, pre-deploy check) and the price card, fee preview and receipt had no feature rows; and the transcripts show a cheap activation path (the integration prompt and agent onboarding's website scan) that the digest listed but never tied to the case's largest driver. Recorded as D20, D21, F-55, F-80 to F-82 and P11 to P13, with the activation path marked as unpriced upside.
- One finding in code: `T-G2` and `T-Z1R` tell customers a link is "valid for 48 hours". The 48 is a constant (`recovery.LINK_HOURS`), stored nowhere and enforced nowhere in the mock, so the message states an expiry the prototype does not have.

Built (the one backlog item the review made worth doing now, T7): `urgency_violations` in `conversation/lint.py`, wired into `channels/policy.py` at both send paths. Pressure wording is always refused. A validity statement is allowed only when the template takes `hours` as a slot. Files: `backend/app/conversation/lint.py`, `backend/app/channels/policy.py`, `backend/tests/test_policy.py`, `backend/tests/test_handover.py`, `eval/conversation.py`, `eval/run_eval.py`.

What the checks caught:
- My first test used "Renew within 24 hours" as the invented expiry, and the lint did not flag it, because the pattern only knew "valid for". Widened to an instruction followed by "within N hours", with calm controls ("we will send you the link within 2 hours", "your bank will reverse it within 3 days") so it does not catch promises and facts.
- The chat-path test then failed on "Send the UPI ref within 2 hours" (no "send" in the verb list). Added the verbs, limited to an instruction to the customer (sentence start, "please", "must", after a comma).
- My first attempt to break the code on purpose did nothing: macOS `sed -i` rejected the command, so the tests passed on unbroken code. Redone with a script. Removing both incident-path calls turned two tests red, and removing only the chat-path call turned the third red. Restored each time.
- A stray copy of `policy.py` went to `/tmp` by mistake and was deleted.

Checks: `uv run pytest` 471 passed; `uv run ruff check .` clean; `make eval` 140 pass, 0 fail, 23 reported (was 138 and 23, so the two new gates); `./scripts/secret_scan.sh` clean; `npm ci` and `npm run build` in `web/` succeed. No em dashes in the changed files. Not run: the Playwright suites (nothing in `web/` or the snapshot changed; CI runs them).

Not touched: `web/` and `contracts/`, so no design review and no contract entry. The snapshot is unchanged because no output of the engine moved.

Not done, on purpose: the fee preview, receipt and price card (T6, after submission); the Guard test ping and pre-deploy check (pilot work, they need a real merchant endpoint); the investigation agent (needs a model and, per the production cuts, pilot data); R6 (needs Eshan's Razorpay test keys and accounts).

## 10 Oct 2026, Guard release check, link expiry made real, fulfilment acknowledgement (integrator)

Goal: Eshan asked for a bigger batch, merged in one pull request. The piece chosen is Guard's prevention check, because the business case sells Guard on it (PRD F-81 test ping, F-82 pre-deploy check, INTERVIEWS P13) and the prototype had neither. It sits in the same pull request as the no-false-urgency check above.

Built:
- `backend/app/guard.py` and `GET /api/guard/release-check` (contracts v0.12): five steps (the webhook answers, accepts a signed event, sends a fulfilment acknowledgement; the pay page opens, checkout opens), each pass, fail or skipped, with what was seen, what it means and the next step. Safe only when all five pass. Read only.
- Merchant mock: `webhook_test_event` (status plus a fulfilment acknowledgement, which is the T8 wording) and `checkout_opens` on the pay page.
- Link expiry made real in the simulation (`recovery.due`): a customer who would pay after the 48 hours the message promises has not paid. No number moved: the latest simulated payment is at 35.8 hours.
- Web: `routes/ReleaseCheck.tsx`, a side nav item, four recorded demo answers (`record_guard`, picked by whether the user has fixed the webhook and the pay page), `useGet` now also returns `busy`.
- Tests and gates: `backend/tests/test_guard.py` (13), one test in `test_zone1.py`, 4 eval gates (all 12 combinations of webhook mode and pay page mode give the right verdict and fail the right step; no broken state is marked safe; reading writes nothing), 3 browser tests.

What the checks caught:
- The first run of the pay-page test failed: the mock's "wrong key" page has the checkout script present and checkout dead, and my check passed it. The existing pay-page probe has the same blind spot (the handoff already says so). Fixed by adding `checkout_opens` to the mock and using it in the release check. The old probe is unchanged.
- I removed the acknowledgement check, then the checkout check, then made the check write a row: each turned tests red, so the tests do guard those. One of my own assertions had an operator-precedence slip that would have let it pass too easily; fixed.
- Independent design review, first pass: pass with notes. Fixed: the banner said "nothing is changed" although a real check runs the merchant's handler; the button gave no feedback while running (and a double click would send two test events); "now" was false for a recorded 2 Oct time; "Passed" beside "It answered 401" read as a contradiction; "Guard" was never explained; DESIGN.md section 14 missed the nav item; two lines ran wider than 720px; the headline card repeated the Verdict stat. Not fixed: heading levels skip from h4 to h6 and a date is a heading, because both come from the shared `Stat` and `Panel` (the Access report has the same pattern), so it is a follow-up for the shared parts; and the step lists are plain boxes, because Blade's `Box` has no `role` prop.
- My `role` attributes failed the type check, so the site build failed and the browser tests ran against the previous build. I only saw it because I read the type output instead of the last line. Removed, rebuilt, re-ran. Also my first `busy` flag set state inside an effect and added a lint warning; it is now derived from what was fetched.
- `data/world.db` was left with the webhook fixed after my live browser run (it is a scratch file; `make synth` resets it). It made one of my own checks look wrong until I looked at it.

Checks: `uv run pytest` 485 passed; `make lint` clean; `make eval` 144 pass, 0 fail, 23 reported, and all 161 metrics that `main` has are identical by name (6 added); `make test` including `npm run build` and the secret scan; `tsc -b` and oxlint clean; snapshot browser suite 75 of 75 on a production build; live suites (`talk`, `fix`) 15 of 15 against the real API; the page at 375, 768 and 1440px with no sideways overflow. Run on a throwaway config and free ports (5190, 5174, 8000), because 5173 belonged to another chat. No em dashes in the changed files.

Design review: an independent general-purpose agent followed `.claude/agents/design-reviewer.md` (the `design-reviewer` agent type is not registered in this session) and edited nothing. First pass: pass with notes, fixed as listed above. Second pass after the fixes: pass. It ran types, lint and the mechanical searches (clean), the layout, smoke and demo tests, the page at 375, 768 and 1440px (no overflow, clean console), and spot-checked `/access`, `/incidents`, `/scan` and `/audit` after the `useGet` change. It could not check: live mode and the real API, the other three recorded states in a browser, the phone menu and keyboard focus order, a screen reader, dark mode, and whether the loading spinner is visible (in the hosted build the button is disabled for a few milliseconds only, because the answer is already in memory). It saw one Recharts "width(-1) and height(-1)" warning on `/incidents/INC-1`, which I did not compare with `main`; this batch does not touch that page. The remaining notes (heading levels in the shared `Stat` and `Panel`, no `role="list"`) are listed above as not fixed.

Not done, on purpose: the price card, fee preview and receipt (T6, after submission); a check against a real merchant endpoint, on a schedule or from a release pipeline (R6 and the pilot); event types other than a payment capture; a role-based list for the step rows.

## 10 Oct 2026, roadmap reassessment and the batch it ranked (integrator)

Goal: Eshan asked for an exhaustive check of what is left, a ranking with a framework, the low-value items cut, and the top items built. Method: the Problem-Ordered Roadmap rule (every item needs a sharp problem, a verbatim story, a lever and a metric) with RICE to rank and MoSCoW to decide, scales set for this project and written down in `docs/BUILD_PLAN.md` section 14. The inventory came from the PRD feature table, the handoff, the open lists in this log and the submission checklist. PR #33 was merged first (CI green, the `test` job 7 minutes), and this batch is cut from the merged `main`.

Decisions (details and scores in BUILD_PLAN 14):
- Cut from the competition build: the investigation agent and three-arm evaluation (no model, T1), learning-loop extras, Devanagari rules, scheduled release checks, help bubble and app-style previews, and five items from the PRD "beyond v1" list. Held: fee preview, price card, receipt (T6, after submission). Blocked on Eshan: R6 real rails.
- Built, in score order: the three PRD metrics that had no number (3.2), Connect by prompt (2.8), Blade charts for Hero B and INC-3 (1.4), and the KTLO thread crash (0.9).
- Dropped from the batch after a second look: the Guard value report. In the hosted demo it would stay at its snapshot values while the user fixes incidents, so it would say "restored: 0" after a fix. Confidence 0.8 to 0.5, score 1.1 to 0.7.

What the checks caught:
- **The founder-effort count was wrong the first time.** I wrote a formula (3 approvals per staged action, one per refund row, one verify click) and added a check against a real INC-1 run through the executor and the audit log. The real run logged one more approval than the formula: switching messaging on, which the founder must do before any message goes out. The formula now counts it. Without the cross-check the number would have been wrong and looked right.
- **That correction put INC-2 over the target** (10.5 minutes against 10). I did not loosen the 30 second assumption to hide it. The gate is the median incident (4.0 minutes), each incident is reported, and INC-2 says why it is over: refunds are approved one customer at a time on purpose.
- The new metrics are honest about what they are. The reply time is wall clock of the engine alone (under a millisecond), the cost is messages only because no model runs, and the 30 seconds per approval is labelled an assumption nobody timed.
- A page test failed because Blade's `Box` takes `testID`, not `data-testid`; the test was right and my page was wrong.
- On a phone the copy button wrapped to three lines and the code sat in a grey box inside a grey box. Fixed, then looked at again.
- The first screenshot of the new Hero B chart had no "normal for that hour" line. The data was fine: the dashed line was still animating in. The axis labels also collided at 1440px, so the ticks are spaced for about five labels.
- The KTLO crash had a one-line cause: `machine.py` named a live conversation's case `cs_<random>` while the rebuild recreates cases as `cs_<complaint id>`. A test reproduced the crash first (`NoneType is not subscriptable`), then the id was made to match.

Checks: `uv run pytest` 486 passed; `make lint` clean; `make eval` 147 pass, 0 fail, 30 reported, and all 167 metrics that `main` has are identical by name (10 added); `tsc -b` and oxlint clean; `npm run build`; snapshot browser suite 77 of 77 on a production build; live suites 15 of 15 against the real API; the new pages at 375 and 1440px with no sideways overflow. Run on a throwaway config and free ports (5190, 5174, 8000), because 5173 belongs to another chat. No em dashes in the changed files.

Design review: the same independent general-purpose agent followed `.claude/agents/design-reviewer.md` on the new and changed screens (`/connect`, `/how`, the INC-3, INC-4 and INC-5 charts) and edited nothing. Verdict: pass with notes, no blockers. It ran types, lint, the mechanical searches and the snapshot suite (77, the same as mine), and looked at the pages at 375, 768 and 1440px. Fixed from its notes: the chart `aria-label` was dead code, because Blade's `Box` does not pass it through and its charts take no accessible name, so each chart is now named in the line under it; the prompt did not say what `{BLINDSPOT_API}` is and sent `access_granted_at` for a test that granted nothing; the founder-time card did not state its 30 second assumption on the card; the subtitle claimed the plan had set a target for cost, which it had not; a typed "4 customers" and a pointer to nowhere in the "what each rule closes" list; the Copied state never reset. Not fixed: the phone legend takes half the chart box (Blade's own layout), the Copied change is not announced to a screen reader, and the cost uses a local money helper because `rupees()` rounds to whole rupees (commented). It could not check: chart hover tooltips, the copy button in a non-test browser, `/how` at 768px, INC-5 beyond its numbers, live mode, screen reader output, and whether the prompt works in a real coding agent. The Recharts "width(-1)" console warning appears on every chart page, including INC-1 before this branch.

Not done, on purpose: the Guard value report; anything that needs a model; anything that needs Eshan's keys. Not verified: that a real coding agent turns the Connect prompt into a correct handler. That is the first test to run once there is a real endpoint (R6). The reply-time number moves between runs (it is a stopwatch), so `eval/report.json` in the snapshot will show a new value each time it is rebuilt; the gate is under 60 seconds, so it is not flaky.

