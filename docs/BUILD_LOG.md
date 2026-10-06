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
