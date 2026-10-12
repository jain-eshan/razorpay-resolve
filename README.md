# Blindspot (working name)

Razorpay x ISB AI PM Build Challenge, Track 2. An agent for small Indian merchants (in this prototype rules and SQL decide, and a model is the production design) that owns what happens before and after a payment, where Razorpay's own tools stop looking. It finds every customer a payment problem touched, talks to them to find the payment, says whose side the fault is on, and fixes it with the founder approving.

Read `docs/PRD_V3.md` and `docs/ROADMAP_V3.md` first (v3, 12 Oct: two ways in for small merchants and big brands, the home dashboard, and the build order). Where v3 is silent, `docs/PRD.md`, then `docs/SPEC.md` and `docs/BUILD_PLAN.md`. `docs/V1_SPEC.md` applies where the v2 docs are silent. A new session starts at `docs/HANDOFF.md`. What broke and why is in `docs/BUILD_LOG.md`. The submission note and video script are in `docs/SUBMISSION.md`, and the AI build log in `docs/AI_BUILD_LOG.md`.

## Try it in two minutes

Hosted demo, no install: https://razorpay-blindspot.vercel.app/

Or run it yourself:

```
make setup
make run-web      # http://localhost:5173
```

No server is needed. The hosted demo replays frames recorded from the real engine on a synthetic merchant (Kaksha, fictional). A page reload starts it over.

Page names follow Razorpay's own (`web/DESIGN.md` section 22): Overview, Payment issues, Customer complaints, Unpaid access, Integration, Connectors, Settings, Alert tuning, Audit trail, Accuracy. The first check (`/scan`) ends Setup.

| Open | What you see |
|---|---|
| `/` (Overview) | A welcome pop-up, what Blindspot is and what is wrong right now, Ray, the pages, then both stories as a WhatsApp alert: customers who paid and have no access (Hero A), and customers who could not reach the pay page (Hero B). |
| Hero A, `INC-1` | A webhook broke after a deploy. 85 customers affected, 68 never complained. Fix them in stages (dry run, first 5, the rest), message them, undo, verify, close. |
| Hero B, `INC-4` | Razorpay saw nothing, because no payment existed. Blindspot infers it from orders, a pay-page check and complaints, says it is inferred, shows the evidence, and offers recovery links with a few customers held back to measure the effect. |
| `/chat-demo`, `/email-demo`, `/help-demo/receipt` | A customer talks to the agent. It says it is an AI, finds the payment from an exact identifier, and holds its reply for the founder. |
| `/ig-demo` | Instagram: the Meta inbox passes a payment thread to Blindspot and takes it back. |
| `/public-demo` | A public post gets one generic reply with a private link, held for the founder. Nothing about a payment is said in public. |
| Razorpay side, `INC-3` | Card renewals failed inside Razorpay's gateway while UPI AutoPay was fine and nothing changed on the merchant's side. Blindspot says it is Razorpay's, how sure it is and what it cannot see, keeps customers' access on for 3 days, tells them, and drafts an evidence pack that only goes (simulated) when the founder approves. |
| `INC-2` | Customers charged twice after an Android release: the merchant's app, not the webhook. Look-alikes are left out with the reason. The founder refunds each second charge to the original method, one customer at a time, under a daily limit, with no undo. |
| `/access` | Unpaid access. A list, not an action: customers whose UPI renewal failed on their side and who still have access past the merchant's own rule. |
| `/release-check` | Integration, step 2, the go-live check before a release: a test event to the merchant's webhook and a pay-page check, with what each failure means and what to do. The merchant is simulated. |
| `/connect` | Integration, step 1 (Build with AI; was Connect by prompt): the text a merchant pastes into a coding agent to wire the webhook and the fulfilment acknowledgement. A proposal. |
| `/learning` | Alert tuning: what the product changed about its alerts this week and why. On an incident, press "This was a false alarm", then "Review this week now": the alerts that raised it get one step stricter, with a reason, a version and an audit line. A simulated six-week table shows whether it helps. |
| `/how` | Accuracy: every eval check against hidden ground truth, and what a fix asks of a founder and what it costs. |

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
| R4 rest, INC-2: customers charged twice after an app release, and the guarded refund (one customer at a time, original method only, daily limit, no undo) (no model) | Done, on `main` (PR #25). Contracts v0.9 |
| R4 rest, renewal link for INC-3 | Done, on `main` (PR #26). Contracts v0.10 |
| Data retention enforced (F-54) | Done, on `main` (PR #27) |
| R4 rest, J6 access report (`/access`) | Done, on `main` (PR #29). Contracts v0.11 |
| No false urgency on every outgoing message; Guard release check (`/release-check`) | Done, on `main` (PR #33). Contracts v0.12 |
| Roadmap reassessment (`docs/BUILD_PLAN.md` section 14); the three measured PRD metrics; Connect by prompt (`/connect`); Blade charts; thread-crash fix | Done, on `main` (PR #34) |
| Investigation agent and three-way eval | Cut from the competition build (no model in the prototype, decision T1). The model is the production design |
| R6 real Razorpay test-mode rails | Not started. The brief does not require them |

Contract changes are logged in `docs/CONTRACT_CHANGES.md` (currently v0.12). The plan for every release is in `docs/BUILD_PLAN.md`.

## What is real and what is simulated

No model is used anywhere in the prototype, on purpose. Triage, extraction, detection and attribution are rules and SQL, and every number on screen comes from SQL or Python. In production a model reads the things rules cannot (messy complaint text, free-text server errors, causes nobody listed) behind the same interfaces, and deterministic code still moves money and access. The prototype shows where it plugs in and does not claim to measure it.

Simulated: all Razorpay data, all channels (WhatsApp, email, help button, Instagram, Messenger, public posts), every customer conversation, screenshots (a script supplies the text a reader would return), the merchant's own system, the customers' behaviour after a recovery link, and the six-week learning replay (invented weeks, a scripted founder, invented reply and edit rates). The synthetic world is clean and the generator and detector share assumptions, so near-perfect eval scores show the logic works, not how often it would be wrong on real traffic. The caveats are at the top of `eval/report.md` and in `docs/HANDOFF.md`.

Proposed Razorpay capabilities that do not exist today are listed in `backend/app/config.py` (`PROPOSED`) and in PRD section 15.

## Known limits of the prototype

These are choices for a synthetic-data prototype, found by an independent code review on 10 Oct 2026. None would be acceptable in production.

- **No sign-in.** The approver is a name sent with the request. The API only accepts `merchant:<name>` (a name, never empty) or the autonomy setting acting for the founder. Production uses Razorpay's own dashboard session.
- **The merchant stand-in lives in the same app** (`/merchant-mock`), and a customer's context (such as a payment id) on `/api/inbound` is taken as given. Production signs it.
- **The webhook receiver on Supabase records any POST** to it. It exists to observe what Razorpay really sends.
- **Retention keeps** the redacted complaint text, each sent message's body (first name, amount, bank reference) and a short hash of the customer's handle. The conversation transcript and the real identifiers behind the tokens are removed.
- **At the autopilot setting**, an incident message goes to everyone in the plan (up to 100) without a pause after the first five. That is what the autonomy matrix in the PRD says, and the default is "Suggest".
- **The refund limit** is per calendar day, not rolling.
- **Typed founder replies** are checked for secrets, pressure wording and amounts that are not in the customer's record, but they are the founder's own words and are not otherwise limited.
- **The model is not here.** Messages the rules cannot read (Devanagari, heavy slang, an unlisted server error) are handled as "not a payment" or handed to the founder. That gap is the production model's job and is not measured in the prototype.


## Rules that hold everywhere

- Numbers come from SQL or Python, never from a model.
- Nothing moves money or sends bulk messages without the approval the autonomy setting requires. Recovery links always need the founder.
- The assistant says it is an AI, never asks a customer for credentials, and never discusses a payment in public.
- Contracts (`contracts/`, `backend/app/schemas.py`, template ids and slots, `synth/config.yaml`) change only through `make contracts` and an entry in `docs/CONTRACT_CHANGES.md`.
- No secrets in the repo. Razorpay keys are `rzp_test_` only, in `.env`.
