# Blindspot (working name)

Razorpay x ISB AI PM Build Challenge, Track 2. An agent for small Indian merchants that owns what happens before and after a payment, where Razorpay's own tools stop looking. It finds every customer a payment problem touched, talks to them to find the payment, says whose side the fault is on, and fixes it with the founder approving.

Read `docs/PRD.md` first, then `docs/SPEC.md` and `docs/BUILD_PLAN.md`. `docs/V1_SPEC.md` applies where the v2 docs are silent. A new session starts at `docs/HANDOFF.md`. What broke and why is in `docs/BUILD_LOG.md`. The submission note and video script are in `docs/SUBMISSION.md`.

## Try it in two minutes

```
make setup
make run-web      # http://localhost:5173
```

No server is needed. The hosted demo replays frames recorded from the real engine on a synthetic merchant (Kaksha, fictional). A page reload starts it over.

| Open | What you see |
|---|---|
| `/` (RAY) | Both stories as a WhatsApp alert: customers who paid and have no access (Hero A), and customers who could not reach the pay page (Hero B). |
| Hero A, `INC-1` | A webhook broke after a deploy. 85 customers affected, 68 never complained. Fix them in stages (dry run, first 5, the rest), message them, undo, verify, close. |
| Hero B, `INC-4` | Razorpay saw nothing, because no payment existed. Blindspot infers it from orders, a pay-page check and complaints, says it is inferred, shows the evidence, and offers recovery links with a few customers held back to measure the effect. |
| `/chat-demo`, `/email-demo`, `/help-demo/receipt` | A customer talks to the agent. It says it is an AI, finds the payment from an exact identifier, and holds its reply for the founder. |
| `/ig-demo` | Instagram: the Meta inbox passes a payment thread to Blindspot and takes it back. |
| `/public-demo` | A public post gets one generic reply with a private link, held for the founder. Nothing about a payment is said in public. |
| Razorpay side, `INC-3` | Card renewals failed inside Razorpay's gateway while UPI AutoPay was fine and nothing changed on the merchant's side. Blindspot says it is Razorpay's, how sure it is and what it cannot see, keeps customers' access on for 3 days, tells them, and drafts an evidence pack that only goes (simulated) when the founder approves. |
| `/learning` | What the product changed about itself this week and why. On an incident, press "This was a false alarm", then "Review this week now": the alerts that raised it get one step stricter, with a reason, a version and an audit line. A simulated six-week table shows whether it helps. |
| `/how` | Every eval check against hidden ground truth. |

## Commands

```
make setup        # python deps, web deps, git hooks
make synth        # create data/world.db and data/truth.db (synthetic world, seed 20261006)
make pipeline     # run detection on the world and save incidents
make snapshot     # eval, then write web/public/snapshot/ (data and the demo recording) from the real engine. Commit the result.
make run-web      # http://localhost:5173  (guided demo from the snapshot, no backend needed)
make run-api      # http://localhost:8000  (set VITE_MODE=live to use it)
make test         # backend tests, web typecheck and build, secret scan
make e2e          # Playwright tests (uses your installed Chrome)
make eval         # compare the pipeline with hidden ground truth; fails on a missed gate
make contracts    # regenerate openapi.json, snapshot manifest and web types after a contract change
make lint         # ruff and oxlint
```

The web app has two modes. Without `VITE_MODE=live` it plays the demo from `web/public/snapshot/`. With `VITE_MODE=live` it talks to the API on port 8000. If the engine or the data changes, run `make snapshot` and commit `web/public/snapshot/`, because the hosted site has no Python.

## Status

| Release | State |
|---|---|
| R0 to R3: foundations, detect and attribute, fix and verify, channels and conversation | Done, on `main` |
| Guided demo, dashboard-aligned web shell, UX review | Done, on `main` |
| R4 first slice: Hero B, customers who cannot reach the pay page (no model) | Done, on `main`. Contracts v0.5 |
| R5 first slice: handovers (Instagram, Messenger, public posts) | Done, on `main`. Contracts v0.6 |
| R5 second slice: learning loop, weekly card, Learning screen (no model) | Done, on `main`. Contracts v0.7 |
| R7 submission kit: one-page note, 90-second script, verify-list status (`docs/SUBMISSION.md`) | Merged (PR #16). Needs Eshan's checks and two recorded takes |
| R4 and R5 rest, INC-3: card renewals that failed in Razorpay's gateway, and the evidence pack to Razorpay (no model) | Done, on `main` (PR #19). Contracts v0.8 |
| R4 rest: investigation agent and three-way eval (need a model), duplicate charges and the guarded refund (INC-2), R6 | Not started |

Contract changes are logged in `docs/CONTRACT_CHANGES.md` (currently v0.8). The plan for every release is in `docs/BUILD_PLAN.md`.

## What is real and what is simulated

No model is used anywhere. Triage, extraction, detection and attribution are rules and SQL, and every number on screen comes from SQL or Python.

Simulated: all Razorpay data, all channels (WhatsApp, email, help button, Instagram, Messenger, public posts), every customer conversation, screenshots (a script supplies the text a reader would return), the merchant's own system, the customers' behaviour after a recovery link, and the six-week learning replay (invented weeks, a scripted founder, invented reply and edit rates). The synthetic world is clean and the generator and detector share assumptions, so near-perfect eval scores show the logic works, not how often it would be wrong on real traffic. The caveats are at the top of `eval/report.md` and in `docs/HANDOFF.md`.

Proposed Razorpay capabilities that do not exist today are listed in `backend/app/config.py` (`PROPOSED`) and in PRD section 15.

## Rules that hold everywhere

- Numbers come from SQL or Python, never from a model.
- Nothing moves money or sends bulk messages without the approval the autonomy setting requires. Recovery links always need the founder.
- The assistant says it is an AI, never asks a customer for credentials, and never discusses a payment in public.
- Contracts (`contracts/`, `backend/app/schemas.py`, template ids and slots, `synth/config.yaml`) change only through `make contracts` and an entry in `docs/CONTRACT_CHANGES.md`.
- No secrets in the repo. Razorpay keys are `rzp_test_` only, in `.env`.
