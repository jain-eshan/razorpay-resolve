# Contract changes

A change to anything under `contracts/`, to `backend/app/schemas.py`, `backend/app/channels/base.py`, the template IDs and slots in
`backend/app/conversation/templates.py`, the capability flags in `backend/app/config.py` or `synth/config.yaml` needs a pull request that
updates `contracts/` (run `make contracts`), bumps the version below and adds an entry here. Streams do not edit these files directly.

## contracts-v0.12 (10 Oct 2026, Guard release check)

Additive only. Existing paths, models and fields are unchanged. All 161 earlier eval metrics have the same value and status as `main` (compared by name); 6 are added (4 for the release check, 2 for the no-false-urgency check, which is not a contract change).
- New route `GET /api/guard/release-check` (no parameters): `ReleaseCheck` with `ReleaseStep`. Read only. It sends the merchant's webhook one signed test event (a simulation in the prototype) and reads the pay page, and returns five steps in two groups with `pass`, `fail` or `skipped`, what was seen, what it means and the next step, a `safe_to_release` flag and the line a release script would run. Nothing is stored and nothing is written (a test counts database changes).
- No new action type and nothing that changes the merchant's records.
- Merchant mock (not part of the frozen `/api` contract): the pay page now reports `checkout_opens`, and `webhook_test_event` answers with a fulfilment acknowledgement.
- `contracts/snapshot_manifest.json` gains `guard/release-check.json`. `web/src/types/api.ts` is regenerated.

## contracts-v0.11 (10 Oct 2026, during R4, J6 access without payment)

Additive only. Existing paths, models and fields are unchanged. Every earlier eval metric has the same value and status (151 compared with `main`); the shares in INC-1's and INC-3's "what they have in common" tables moved because the world has 23 more UPI renewals (see the build log).
- New route `GET /api/leakage` (every parameter optional, none needed): `LeakageReport` with `LeakageRow`, `LeakageStep` and `LeakageLeftOut`. Read only. It is computed from the data at the demo clock's time, so a failure that is inside the merchant's grace rule moves into the report when the rule runs out. Nothing is stored and nothing is written.
- No new action type and no route that changes access: J6 is a report, and no revoke exists (a test and an eval gate check that no action type is named like one).
- `contracts/truth_schema.sql` gains `truth_leakage` (eval only, never read by the app). `synth/config.yaml` gains a `leakage` block and the world gains `synth/leakage.py`, applied last with its own random stream. The merchant's grace rule is the existing `grace_hours_after_failed_renewal` (48).
- `contracts/snapshot_manifest.json` gains `leakage.json`.

## contracts-v0.10 (9 Oct 2026, during R4, the renewal link for INC-3)

Additive only. No path, model or field changed, and `make contracts` produces no diff in `contracts/`.
- New template `T-G2` (category `service_promotional`, slots `amount`, `first_name`, `hours`, `plan`, English and Hinglish): the renewal link, sent after Razorpay has fixed the card problem. It is the link `T-G1` promised.
- `synth/config.yaml` gains `inc3.recovery` (`pay_with_link` 0.60, `pay_without_link` 0.15, `max_delay_hours` 36): how simulated customers behave after a link, written into the existing `sim.recovery` setting. Nothing in the generated world moved (every table compared before and after, except that setting).
- `recovery_link` can now be planned on INC-3 (a `G` incident) as well as on Zone 1 incidents. The action type, routes and `ActionSummary` counts are the same. For INC-3 an item is the failed payment id (like grants and messages), and the offer is keyed by the customer.

## contracts-v0.9 (9 Oct 2026, during R4, INC-2 and the guarded refund)

Additive only. Existing paths and models are unchanged. The headline numbers of Hero A, Hero B, INC-3 and the conversation gates are unchanged (checked against the eval before and after); the shares and averages that are measured against a baseline of ordinary orders moved slightly, because INC-2 adds 40 ordinary-looking orders to the world.
- New routes: `GET /api/incidents/{incident_id}/refunds` (the refund screen: `RefundBoard` with `RefundRow`s, the daily limit and what is spent today; an empty board for any incident that has no refunds) and `POST /api/actions/{action_id}/items/{payment_id}/approve` (body `ApproveRowRequest { approver }`: approve and run one customer's refund). New models `RefundRow`, `RefundBoard`, `ApproveRowRequest`. The snapshot manifest gains `incidents/{id}/refunds.json`.
- `ActionType` already listed `refund` and the matrix already had `refund: per_row_web` at every level. `ACTION_CLASS` now includes it, so a refund can be planned and run. `MismatchType` already had `E`: INC-2 is the first incident to use it.
- The approval is per customer on purpose. The whole-list stages (`first_5`, `rest`) are refused for a refund with 409, an approver that is not a person is refused with 403, and the autonomy setting never runs a refund at any level.
- Refunds go to the original payment method in full. The `refunds` table (v0.1) has no destination column and nothing adds one. A refund Blindspot makes is `source: make_good`. It cannot be undone: revert returns 409.
- Template `T-E1` (in the contracts since v0.1, never sent) is now sent, with the refund id and the bank reference (RRN for UPI and netbanking, ARN for cards). A customer is told only once the refund has that reference.
- `/merchant-mock/app-health` and `/merchant-mock/app-mode` (the developer ships the fix for the double tap) are mounted with the rest of the mock. Not part of `/api`, not in `openapi.json`. The mock keeps its state in two `settings` keys (`mock.app_mode`, `mock.app_fixed_since`).
- `synth/config.yaml` gains an `inc2` block and the generator adds the app release `me_app_341` (android-3.4.1, Sat 26 Sep 10:00). It adds 40 orders (15 double taps, 3 two-seat purchases, 2 reversing pairs) and relabels 83 existing android orders to the new version. No earlier random draw changes.
- No change to `contracts/schema.sql`.
- Reading side: the amount reader now understands "599 do baar kat gaye" (a number followed by "twice"), which the new complaints use.

## contracts-v0.8 (7 Oct 2026, during R4 and R5, INC-3 and the escalation to Razorpay)

Additive only. Existing paths and models are unchanged; every Hero A, Hero B and conversation number is unchanged (checked against the eval before and after).
- New routes: `GET /api/escalations` (list, optional `incident_id`) and `POST /api/escalations/{id}/send` (the founder's approval, body `SendEscalationRequest { approver }`). `POST /api/escalations` and `GET /api/escalations/{id}` now do real work with `BS_SOURCE=pipeline` (they were placeholders). The snapshot manifest gains `escalations.json`.
- `Escalation.updated_at` (optional). New model `SendEscalationRequest`. No SQL change: `escalations` was in v0.1.
- A drafted pack is `status: drafted` and nothing leaves until the send call. Only an incident Blindspot has put on Razorpay's side (`owner: razorpay`, mismatch type `G`) can be escalated to Razorpay; any other is refused with 409. The pack holds payment ids, counts, error codes, hours and what was ruled out, never a customer's name, email, phone or message.
- INC-3, the first Razorpay-owned incident. It is an `after` incident with `mismatch_type: G`, `inferred: false`, owner `razorpay` by attribution rule 8, confidence medium. `GET /api/incidents/INC-3` and its members, sample, trace, RAY card, evidence pack and replay read through `backend/app/renewal/read.py` because there is no webhook run to read. A "member" is a failed renewal (`payment_id` is the failed payment). `RayCard.buttons` for it are `See what failed` and `Send to Razorpay`.
- The action type `grant` also covers INC-3: for a failed renewal it is a grace extension (access on for 3 days from now, never shortens access, undoable until the customers are told). The message template `T-G1` (already in v0.1) is now sent, one per customer whose access is confirmed. No new action type.
- The day-0 scan counts customers who paid and have no access; renewals that never succeeded are added to the headline as a separate sentence and not to the customer count.
- `synth/config.yaml` gains an `inc3` block (its own random stream, applied last, so no earlier number moves). Dates differ from SPEC 13.2 (Thu 1 Oct): the window is Tue 29 Sep 02:10 to 09:30, before the INC-1 deploy, because Thu 1 Oct falls inside the INC-1 outage and would turn ordinary renewals into INC-1 victims. Any ordinary card renewal inside the window is turned into a failure too (an outage does not skip customers).
- Eval: 23 INC-3 and escalation gates and one reported figure. The eval now picks Hero A by name (`INC-1`) instead of "the earliest incident after the payment", and scores INC-3's complaints separately (they name a failed payment, which the exact-key matcher does not look up by design).

## contracts-v0.7 (7 Oct 2026, during R5, learning loop)

Additive only. Existing paths and models are unchanged; every Hero A and Hero B number is unchanged (the hour-of-week baseline needs 3 weeks of history and the world has 2).
- New routes: `POST /api/learning/run` (the weekly review, run now; response `LearningWeekly`) and `GET /api/learning/replay` (the six-week replay table; new models `LearningReplay` and `ReplayRow`). The snapshot manifest gains `learning/replay.json`.
- `POST /api/feedback`, `GET /api/learning/weekly` and `GET /api/learning/params` now do real work with `BS_SOURCE=pipeline` (they were placeholders). A feedback event is a `feedback_events` row and an audit entry. A setting change is a `learning_params` row and an audit entry. No SQL change: both tables were in v0.1.
- Settings that can change (`learning_params.key`): `order_dip_p_threshold` and `complaint_spike_p_threshold` (a ladder of six values from 0.001 to 0.05, one rung at a time) and `message_variant` (`en` or `hi_latn`, only after 20 sends each and a 5 point lead). One change per setting per 7 days. Defaults are 0.01, 0.01 and `en`; version 0 is the default and has no row.
- `FeedbackRequest.payload` may carry `monitors` (evidence kinds `order_volume_dip` or `complaint_spike`) and `variant`. For `false_alarm` on an incident the server fills `monitors` from the incident's evidence. `missed_incident` must name a monitor.
- Monitors take their threshold as an argument (`volume.find(..., max_p)`, `complaint_spike.find(..., max_p)`). `Orders(db, ewma=True)` uses the hour-of-week EWMA baseline (alpha 0.3) once there are 3 earlier weeks, otherwise the old pooled one. The pipeline reads both from the database.
- `synth/replay.py` is a separate six-week order stream (own random numbers). `synth/config.yaml` is untouched. Eval writes `eval/learning_replay.json` (git-ignored, like `eval/report.json`).
- Not built from SPEC 11.2: the match calibrator refit (too few confirmed matches to refit) and the body-reader examples (need a model).

## contracts-v0.6 (7 Oct 2026, during R5, handovers)

Additive only. No API path, request or response model changed: `contracts/openapi.json` is identical (the handover operation keeps its id and summary).
- One template in `backend/app/conversation/templates.py`: `T-PUB` (the one generic public reply, with a private link). English and Hinglish, category `service`, slots `link` and `merchant`. It says it is an AI in its own words, so the public path skips the usual greeting wrapper.
- Three adapters in `backend/app/channels/sim.py`: `ig_dm`, `fb_dm` (24 hour window for the assistant, 7 days for a person with the Human Agent tag) and `public_mention`. Policy gains two rules: after 24 hours on Instagram and Messenger only a person may reply, and in public only `T-PUB` as a `public_reply`.
- `POST /api/handovers` now does real work with `BS_SOURCE=pipeline`: `pass` and `release` for Instagram and Messenger threads. A pass or release is a row in `handovers` and a plain line in the thread (sender role `system`, never sent to anyone).
- Instagram, Messenger and public mentions start connected with consent in a fresh world (they were disconnected).
- `data/handover_scripts.json` (7 Instagram and Messenger customers, 12 public posts: 6 name a payment, 2 do not, 1 threat, 3 real anchor posts from the research labelled `real_public_post`) and `truth_threads` rows with ids `h01` to `h07`, `p01` to `p12` and `pNN_dm` for private follow-ups. No SQL contract change.
- Thread `handover_state` is used: `with_blindspot`, `released`, `stayed_with_inbox`, `public_invited`, `public_flagged`, `observed_only`, `moved_private`, `from_public`.

## contracts-v0.5 (7 Oct 2026, during R4, Hero B)

Additive only. No API path, request or response model changed: `contracts/openapi.json` is identical.
- `synth/config.yaml` gains a `zone1` section (two incidents, five look-alikes that must not alert, probe settings, simulated recovery behaviour) and two merchant events (`me_key_rotate`, `me_deploy_282`). Seed and ids are unchanged, and every Hero A number is unchanged (85 affected, 81 to fix, 17 complaints).
- `contracts/truth_schema.sql` gains `truth_zone1_members` (who could not pay in each Zone 1 incident, and who got through another way). `truth_zone1` and `truth_complaints` are now filled for Zone 1.
- `Extraction.claim` (in `ingest/extract.py`, not in the API) gains `page_error` and `checkout_not_opening`. They are read only when the message has no debit words, so Hero A messages read exactly as before.
- `autonomy.ACTION_CLASS` gains `recovery_link`. Its row in the autonomy matrix already existed: the founder approves every stage at every level.
- Attribution rows 8a, 8b and 8c are stored as the integers 81, 82 and 83, because `owner_rule_id` is an integer. A bank outage that explains a complaint cluster uses the existing row 7.
- The routes that were placeholders in v0.1 now serve real output with `BS_SOURCE=pipeline`: `POST /api/probes/run`, `GET /api/clusters`, and `POST /api/incidents/{id}/actions` with `action_type: recovery_link`. `POST /api/clock/advance` also settles simulated recovery payments and ignores an extra `incident` field that the hosted demo sends.
- `/merchant-mock` gains `GET /pay-page` (the probe target), `GET /page-health` and `POST /page-mode`. It is not part of `/api`.
- Incident numbers: Zone 1 incidents start at INC-4. INC-2 and INC-3 stay reserved for the after-the-payment incidents of the spec that are not built.
- Where Zone 1 reuses a column for something else (there is no payment): `incident_members.payment_id` and `action_items.payment_id` hold the customer's id, and `recovery_offers.id` is `ro:<incident>:<customer>`. Nothing else reads those columns as payment ids for a Zone 1 incident.

## contracts-v0.4 (6 Oct 2026, during R3)

Additive only.
- Two templates in `backend/app/conversation/templates.py`: `T-ACK` (payment found, merchant side is being fixed) and `T-OK` (payment found, access is active). Both have English and Hinglish and are category `service`.
- `autonomy.MATRIX` gains the message classes `disclosure_or_question` (auto at every level), `status_reply` (founder on Suggest, auto on Assist and Autopilot) and `public_reply` (founder always).
- No API path or model changed. `BS_SOURCE=pipeline` now also serves threads, inbound, reply, handoff, channels, consents and cases from the real state machine. The pipeline creates one case per complaint.
- `data/threads.json` (40 scripted conversations) and `truth_threads` rows come from `python -m synth.generate`. No change to the SQL contract.
- The token vault's `token` column is a global primary key, so each complaint's tokens are stored as `<complaint_id>:[RRN_1]`.

## contracts-v0.3 (6 Oct 2026, during R2)

Additive only. No path, required field or type changed.
- `Settings.autonomy` (`suggest` | `assist` | `autopilot_reversible`, default `suggest`): the autonomy dial. It is stored in `settings`; the per-channel dial in `channels.autonomy_level` arrives with channels in R3.
- `Action.next_stage` (the stage waiting for approval, or null) and `Action.blocked_reason` (why approving is refused right now: bulk cap, messaging off).
- `/merchant-mock/*` (health, entitlement check and grant, webhook mode, test webhook) is mounted on the same server but is not part of `/api` and not in `openapi.json`. It stands in for the merchant's own system until R6.
- No change to `contracts/schema.sql`: actions, action items, messages, audit log and settings were already in v0.1. The mock keeps its webhook state in two `settings` keys (`mock.webhook_mode`, `mock.webhook_ok_since`).
- `BS_SOURCE=pipeline` now also serves real actions, verify, audit, settings, message preview and clock. The default is still placeholder data.

## contracts-v0.2 (6 Oct 2026, during R1)

Additive only.
- Added `GET /api/scan/day0` (latest day-0 scan result). The static snapshot build cannot call `POST /api/scan/day0`, so the web reads this route. The POST stays.
- Snapshot manifest gains `scan/day0.json`.
- `BS_SOURCE=pipeline` environment switch: the API serves real pipeline output where it exists (R1: incidents, members, sample, trace, RAY card, evidence pack, replay, day-0 scan, eval report). The default remains placeholder data so tests and fresh clones work. No model or path changed.

## contracts-v0.1 (6 Oct 2026)

Initial freeze at the end of R0.
- `contracts/schema.sql`: v1 section 14 plus v2 section 5.
- `contracts/truth_schema.sql`: v1 truth tables plus v2 truth tables.
- `contracts/openapi.json`: 44 API paths generated from the stub API and `schemas.py`.
- `contracts/snapshot_manifest.json`: 32 snapshot files the web build loads.
- Channel adapter and policy interfaces: `backend/app/channels/base.py`.
- Templates (15) with IDs and slots: `backend/app/conversation/templates.py`.
- Capability flags: `backend/app/config.py`.
- Seeds and ID formats: `synth/config.yaml`.

R0 data is placeholder data from `backend/app/fixtures.py`. The stub API returns it so every stream can build against real shapes.
