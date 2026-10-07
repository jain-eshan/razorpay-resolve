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

Checks: 334 backend and synth tests, 25 snapshot browser tests (2 new, layout at three widths includes `/learning`), eval 75 gates pass and 14 figures. The live-API browser specs (`fix`, `talk`) were not run: another worktree held ports 5173, 5174 and 8000. The `design-reviewer` agent was not run: it lives on `main`, and the app would not merge `main` into this branch until the repo origin is confirmed.
