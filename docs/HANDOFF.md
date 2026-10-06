# Handoff: where Blindspot stands (6 Oct 2026, R3 built on a branch)

Read this first in a new chat, then `docs/PRD.md`. Everything below is true as of the last commit on branch `blindspot`.

## 1. What this is

Blindspot (working name) is Eshan Jain's entry for the Razorpay x ISB AI PM Build Challenge, Track 2 "Recover and Grow with AI". It is an agent for small Indian merchants that owns what happens before and after a payment, where Razorpay's own tools (RAY, Agent Studio, Vulcan, Payment Links) stop looking: it finds every customer a payment problem touched, talks to them to find the payment, says whose side the fault is on, and fixes it with the founder approving. Eshan is a non-technical product manager. Explain things plainly, ask before outward-facing actions, no em dashes, no filler phrases.

## 2. State of the build

| Release | Status |
|---|---|
| R0 foundations (repo, frozen contracts, stub API, Blade shell) | Done, tag `contracts-v0.1` |
| R1 detect, widen, attribute (Hero A on a synthetic world) | Done, contracts v0.2 |
| R2 fix and verify (grant in stages, messages, undo, verify and close, audit, settings, autonomy dial) | Done, contracts v0.3. Merged to `blindspot` as PR #2, CI green. |
| R3 channels and conversation (no model yet: rules and scripted threads) | Built on branch `claude/r3-channels-conversation`, contracts v0.4, not yet merged |
| R4 Zone 1 (cannot reach the pay page), investigation agent, three-way eval | Not started |
| R5 learning loop, handovers | Not started |
| R6 real rails (stretch) | Not started |
| R7 submission kit | Not started |

Plan, sizing and kickoff prompts for every stream: `docs/BUILD_PLAN.md`.

### What R1 delivers (all verified)
- `synth/world.py`: deterministic 14-day world for the fictional merchant Kaksha, seed 20261006, INC-1 injected, ground truth in a separate database.
- `backend/app`: webhook-health monitor, access reconciler, silent-victim search with tiers and exclusion reasons, replay eligibility, attribution (10 rows), rule-based verdict, evidence pack, pipeline, read layer.
- API serves real output with `BS_SOURCE=pipeline`, placeholder data otherwise.
- `eval/run_eval.py`: 11 gates against hidden ground truth. All pass.
- Web: RAY phone, incident inbox, incident page, day-0 scan, "How we know". Blade and RazorSense.
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

### R3 limits (read before quoting any R3 number)
- **No model is used yet.** Triage and extraction are rules. They read English and Hinglish in Latin script. Devanagari is only recognised as a language, so the rules call it "other" and a person sees it. A model-based extractor goes behind `extract()` with the same output shape. Needs an Anthropic key with a spend cap, and then the three-arm comparison (rules, agent, no signal) that the eval report does not have yet.
- **The scripted threads are friendly to the rules.** They are generated from templates close to the patterns the extractor knows, so 1.0 is optimistic. K4 is not settled until real founders show real messages.
- **Screenshots are simulated:** a script supplies the text a screenshot reader would return (`context.screenshot_text`). No image is read.
- **Fuzzy matching is weak by design:** on generated complaints the true payment is in the top 3 suggestions 72 percent of the time, top 1 only 45 percent, and no threshold reaches 95 percent precision, so it never decides anything.
- **Retention is stored, not enforced:** consents record 30 days, but nothing purges threads or attachments yet.
- **Public mentions, Instagram and Messenger** (R5) have no adapter. A public thread gets a held draft that the public filter blocks.
- **Not measured:** time to first useful reply under 60 seconds, cost per resolved case.
- **The conversation dial is per channel** (Channels screen). The Settings dial is global and governs grants and incident messages.
- The first read of `/api/channels` seeds the channel and consent rows (a read that writes). Fine for the prototype.

### Results on the synthetic world
1 incident found, 0 false. 85 affected: 17 complained, 68 silent (ratio 4.0; kill criterion K1 needs 2). 81 actionable, 2 fixed by hand, 2 refunded, 4 in the "server said OK but granted nothing" group (all found). Alert fires 55 minutes after the deploy with 1 customer affected. Replay: 38 events replayable by a support ticket one at a time, 43 not replayable at all. The scores are near perfect because the world is clean and generator and detector share assumptions. Harder negatives arrive in R3 and R4.

## 3. Repo map

```
docs/        PRD.md  SPEC.md  BUILD_PLAN.md  V1_SPEC.md  BUILD_LOG.md  CONTRACT_CHANGES.md  HANDOFF.md
contracts/   schema.sql  truth_schema.sql  openapi.json  snapshot_manifest.json   (frozen, generated)
backend/app/ schemas.py (models)  fixtures.py (placeholders)  main.py (API)  service.py (read layer)  pipeline.py
             detect/ widen/ investigate/ match/ act/ (executor, autonomy, messages)  merchant_mock.py  audit.py
             channels/ (base.py, policy.py)  conversation/templates.py  attribution.py  config.py
synth/       config.yaml  world.py  generate.py        eval/ run_eval.py
web/         the RazorSense starter, moved here with history. Read web/CLAUDE.md and web/DESIGN.md.
merchant_mock/supabase/rzp-sink.ts   source of the deployed webhook receiver
scripts/     gen_contracts.py  snapshot.py  run_pipeline.py  secret_scan.sh
```

Commands: `make setup | synth | pipeline | snapshot | eval | test | e2e | lint | contracts | run-web | run-api`.

Branches: `main` is the untouched starter (commit 614bacf). `blindspot` holds the product and is open as PR #1 (https://github.com/jain-eshan/razorsense-starter/pull/1). Each release is a branch off `blindspot` merged by PR (R2 was PR #2). The starter's files moved into `web/` with `git mv`, so history is kept.

## 4. Decisions made (full log: PRD section 2)

Scope is post-payment and pre-payment failures only. RAY, Vulcan, Payment Links, Subscription Recovery and the Ecosystem Health board are integrated with, not rebuilt. Two demo heroes: paid-no-access (Hero A, proven, built) and cannot-reach-the-pay-page (Hero B, inferred, R4). A conversation agent talks to the merchant's customers, co-branded "[Merchant] payment help, powered by Razorpay", always says it is an AI. Intake order: Razorpay-owned help entry points, a dedicated payments WhatsApp number, email (reply-to, alias, keyword forwarding rule), Instagram and Messenger handover, public posts private-first. Autonomy dial defaults to "Suggest". The 13 Oct deadline is ignored. UI follows Razorpay's Blade and RazorSense. Name "Blindspot" is a placeholder in one constant.

Eshan confirmed on 6 Oct 2026 the two earlier assumptions: the co-branded customer voice ("[Merchant] payment help, powered by Razorpay") and the "Suggest" autonomy default.

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

**Open experiment:** Razorpay should disable webhook A about 24 hours after the first failure (around 18:41 IST on 7 Oct 2026). Ask Eshan what the dashboard shows then (banner, warning, email) and record it in PRD 4.1 and 16.3. No alert email is set, so nobody was told of the failure.

**Old duplicate folder:** `/Users/eshan/Desktop/claude/blindspot` was deleted on 6 Oct 2026 at Eshan's request. It held an R0-stage copy with no commits and nothing this repo lacked.

**No accounts needed yet.** First Anthropic API key needed at R3. Vercel at the snapshot deploy. Fly or Render, Meta developer and an inbound email provider only at R6.

## 6b. Pending (as of 6 Oct 2026, after the R2 merge)

Needs Eshan:
- **Webhook experiment, around 18:41 IST on 7 Oct:** Razorpay should disable webhook A about 24 hours after its first failure. Look at the dashboard and tell the next session what it shows (banner, warning, email). Record it in PRD 4.1 and 16.3.
- **Five founder calls (V2, kill criterion K3):** none done. Script is in `docs/BUILD_PLAN.md` section 8. If fewer than 3 of 5 confirm a paid-but-not-fulfilled incident, the plan is to pivot to international-failure diagnosis.
- **Razorpay questions (V3, nine of them) and the two for Prane:** does RAY already list every payment affected by one webhook failure (kill criterion K2), and could Razorpay expose a bulk replay or delivery-log API for a prototype. No answers yet.
- **Test account cleanup (V5):** the disabled `httpbin` webhook and the ₹10 payment link are still there. Nothing is deleted until Eshan says so.
- **Anthropic API key with a spend cap:** R3 was built without one (rules and scripted threads). It is needed from R4 for the agent arm and to try live triage.
- **Vercel project for the snapshot deploy:** needs Eshan's account. The static snapshot is ready to deploy.

Needs the next session:
- **Contract tags:** only `contracts-v0.1` is tagged. v0.2 and v0.3 are not. Tag after Eshan agrees.
- **Verify list (PRD 16.3, V4):** items still without a status.
- **No executor yet for** refunds, recovery links and event re-sending, although the autonomy matrix lists them (refunds and recovery links belong to R4).
- **Deferred from R1:** the 24 synthetic screenshots (R3 simulated screenshot text instead; real images need a vision model).
- **Demo state is in memory** (clock offset, webhook fix). A restart gives a fresh world.
- **Bundle is 1.3 MB** (Blade). Code-split later.

## 7. Next steps

1. **Review and merge R3**, then **R4 Zone 1 and depth** (`docs/BUILD_PLAN.md` section 5): cannot-reach-the-page inference, the investigation agent, the three-way eval. The Anthropic key is needed here, for the agent arm.
2. Before R3, Eshan should run the five founder calls (build plan V2) and answer the Razorpay questions (V3).
3. Items still to verify are listed in PRD 16.3.

## 8. Working agreements

- Contracts are frozen. Change them only via `make contracts` plus an entry in `docs/CONTRACT_CHANGES.md` (currently v0.2).
- Every number on screen comes from SQL or Python. The pipeline must never read `truth.db` (a test enforces it).
- Ask Eshan before: commit, push, delete, create accounts, send anything outward, or change his Razorpay account beyond test objects he has allowed.
- Keys go in `.env` only. Razorpay keys must be `rzp_test_`.
- Files stay few. Answer in chat by default. Explain without jargon.

## 9. Known loose ends

- Web bundle is 1.2 MB (Blade). Code-split later.
- Starlette prints a deprecation warning about `httpx` in tests.
- `make e2e` needs Google Chrome installed (CI's ubuntu runner has it). The first GitHub CI run (PR #1) passed.
- Spec numbers such as "40 affected, 9 complained" in the PRD and RAY mockups are illustrative. The generator computes the real ones.
- The demo clock and the merchant's webhook fix are simulated and live in process memory and two `settings` keys. Restarting the API (`make run-api`) gives a fresh world; running only `make pipeline` on a world that already has grants does not reset them.
- `make e2e` now starts the API on port 8000 (fresh world) and a live web on 5174, so both ports must be free.
- Refunds, recovery links and event re-sending are in the autonomy matrix but have no executor yet.
- Fixture incident INC-4 (cannot-reach-the-page) exists only as placeholder data and is not served in pipeline mode.
