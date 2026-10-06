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
