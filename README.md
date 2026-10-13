# Blindspot

**When a payment breaks around the payment gateway, find every customer it hit, say whose side the fault is on, and fix it with the merchant's approval.**

Blindspot is a working prototype built for the Razorpay x ISB AI PM Build Challenge, Track 2 ("Recover and Grow with AI"). It is a product idea shown as a working demo, built by a product manager (Eshan Jain) with AI coding tools. It is not affiliated with Razorpay. "Blindspot" is a working name.

> **Status: closed, 13 October 2026.** The build is finished and frozen. No further product changes are planned. This repository is kept as the record of what was built, how it was checked, and why. Everything in it runs on made-up data.

**Live demo, no install:** https://razorpay-blindspot.vercel.app/

## The problem

A payment can break before, during or after the gateway. Most customers who fail once leave without complaining, so a founder learns about it days later, if at all. Razorpay's own tools cover the payment while it is in flight. Blindspot covers what happens around it: orders created with no payment attempt, customers who paid and got nothing, double charges, failed renewals, and webhooks that stopped arriving.

For one incident the product does five things: hear it, find everyone it hit (including customers who never wrote in), say whose side the fault is on and show the proof, fix it with approval, and win the customers back. The number it cares about is recovered revenue, not payment success rate, because routing owns success rate.

## Two ways in, two demo accounts

Blindspot is one dashboard, set up two ways. Open `/signin` (or the landing page `/how-it-works`) and pick an account. You can switch from the avatar at any time.

| Account | Who it is | How Blindspot hears about a problem | Where the answer lands |
|---|---|---|---|
| **Kaksha** (made up) | A small online business | A customer's complaint on WhatsApp, Instagram, email or a help button | Ray, the assistant, on the founder's WhatsApp |
| **Flipkart** (a big brand, name used as text only) | A large shopping app | The brand's own alert tools (Sentry, Datadog, PagerDuty) | The brand's Slack channel, with approvals in the thread |

Every screen says the data is made up. There are no logos, no password field, and nothing to type.

### What is in each account

**Kaksha, a small business.** Five issues, each a different cause and owner:

| Issue | What happened | Whose side |
|---|---|---|
| `INC-1` | A deploy broke the webhook. 85 customers paid and got no access; 17 complained and 68 never did. | Merchant's code |
| `INC-2` | 15 customers were charged twice after an Android release. Refunds go one customer at a time, to the original method, under a daily limit, with no undo. | Merchant's code |
| `INC-3` | Card renewals failed inside Razorpay's gateway while UPI AutoPay was fine. Blindspot says it is Razorpay's, how sure it is and what it cannot see, keeps access on for 3 days, and drafts an evidence pack that goes (simulated) only on approval. | Razorpay |
| `INC-4` | The pay page returned 404 after a release, so no payment existed for Razorpay to see. Blindspot infers it from orders, a pay-page check and complaints, and says it is inferred. | Merchant's code |
| `INC-5` | Checkout would not open after the Razorpay key changed. | Merchant's setup |

Around the issues: a dashboard (date range, four cards, a chart, open issues ranked by money at stake, an Ask Ray bar), Unpaid renewals (customers whose UPI renewal failed on their side and who still have access past the merchant's own rule), Alert tuning (what the product changed about its own alerts this week and why), a pre-release check, a "build with AI" prompt for wiring the webhook, and demos of a customer talking to the agent on WhatsApp, email, a help button, Instagram and public posts.

**Flipkart, a big brand.** Seven issues, from different places:

| Issue | What happened | Whose side |
|---|---|---|
| `FK-1` | App release 8.2 showed "Payment failed" for UPI payments Razorpay had captured. 1,240 customers; 410 paid twice and 830 had no order. The root cause reached Slack 6 minutes after the alert; three approvals. | Brand's code |
| `FK-2` | Razorpay delayed the brand's webhooks for 75 minutes. Closed, fix free. | Razorpay |
| `FK-3` | Double charges on iOS 6.4. Refunded. Closed. | Brand's code |
| `FK-4` | HDFC Bank debited 412 customers and never confirmed, so their orders sat on hold. | The bank |
| `FK-5` | A slow webhook made two orders for 318 payments. | Brand's code |
| `FK-6` | A blank card pay screen on iOS app 8.3. This happens before payment, so every number says "About". | Brand's code |
| `FK-7` | 640 coupon orders were charged the full price. | Brand's code |

The brand account also has its own Alerts (what each alert tool sent and what became of it), Integration, Connectors, Settings and Audit trail pages. Each issue page shows where the problem showed up: the customer's phone, the alert as Sentry sent it, and the Slack thread.

## What is real and what is simulated

**No AI model runs in the prototype, on purpose.** Triage, reading complaints, detection and attribution are rules and SQL. Every number on screen comes from SQL or Python and never from a model. In production a model would read what rules cannot (messy complaint text, free-text server errors, causes nobody listed) behind the same interfaces, while ordinary code still moves money and access. The prototype shows where the model plugs in and does not claim to measure it.

The one place the repo measures why a model is needed is the "Why an AI agent" section on the landing page. On 41 made-up messy complaints (Hinglish, typos, forwarded text, two problems in one message) the rules read the main issue right 85% of the time, and caught both problems in a two-problem message 0 of 5 times. That set is small and invented, and no model has been run on it.

**Simulated:** all Razorpay data, every channel (WhatsApp, email, help button, Instagram, Messenger, public posts), every customer conversation, the merchant's own system, customer behaviour after a recovery link, the big brand's alert door and Slack, and the six-week learning replay.

**Real:** the detection and attribution engine, the fix-and-verify logic, the safety rules below, and one observation of Razorpay's actual webhook behaviour from a test payment.

**Read the scores with care.** The synthetic world is clean, and the generator and the detector share assumptions, so near-perfect scores show the logic works. They do not show how often it would be wrong on real traffic.

## What was checked (13 October 2026)

| Check | Result |
|---|---|
| Eval against hidden ground truth (`make eval`) | 147 checks pass, 41 are reported only, 0 fail |
| Backend tests (`make test`) | 627 collected |
| Browser tests (Playwright, `make e2e`) | 260 test cases, at phone, tablet and desktop widths |
| Lint and type check | clean |
| History on `main` | 164 commits, 46 merged pull requests, about 32,500 lines of Python and TypeScript (tests included) |

Every merged pull request passed CI. Screens were reviewed against Razorpay's own design rules (`web/DESIGN.md`) by an independent reviewer agent before merge. The review notes, including what was not checked (dark mode, screen readers), are in `docs/BUILD_LOG.md`.

## Run it yourself

You need Python 3.12+ with [uv](https://docs.astral.sh/uv/), and Node 20+.

```
make setup        # python deps, web deps, git hooks
make run-web      # http://localhost:5173
```

That plays the guided demo from a recorded snapshot of the real engine. It needs no server, and a page reload starts it over. To run the engine live, start `make run-api` (port 8000) and open the web app with `VITE_MODE=live`.

Other commands:

```
make synth        # create the synthetic world (data/world.db) and its hidden ground truth (data/truth.db), seed 20261006
make pipeline     # run detection on the world and save the incidents
make snapshot     # eval, then write web/public/snapshot/ from the real engine (the hosted site has no Python, so commit the result)
make test         # backend tests, web typecheck and build, secret scan
make e2e          # Playwright browser tests (uses your installed Chrome)
make eval         # compare the pipeline with hidden ground truth; fails on a missed gate
make contracts    # regenerate openapi.json, the snapshot manifest and web types after a contract change
make lint         # ruff and oxlint
```

## Where things are

| Folder | What is in it |
|---|---|
| `backend/` | The engine (FastAPI): detection, attribution, conversation, fixing, verification, learning, the safety rules |
| `web/` | The dashboard (React, Vite, Razorpay's Blade design system). `web/DESIGN.md` is the design guide, `web/CLAUDE.md` the build rules |
| `synth/` | The made-up world: merchants, customers, payments, and the incidents planted in it with known answers |
| `eval/` | The scored checks against that hidden truth, and the 41 messy complaints |
| `contracts/` | The frozen API and data contracts (changes are logged in `docs/CONTRACT_CHANGES.md`, currently v0.12) |
| `merchant_mock/`, `scripts/` | A stand-in for the merchant's own system, and the snapshot and contract scripts |
| `docs/` | Product, plan, build record. See below |

## Reading the docs

| If you want to know | Read |
|---|---|
| What the product is and why | `docs/PRD_V3.md` (the product as it ended up), then `docs/PRD.md` where v3 is silent |
| The one-page pitch, the answers to the brief, where every figure comes from | `docs/SUBMISSION.md` |
| How AI was used to build it, and where the human made the calls | `docs/AI_BUILD_LOG.md` |
| What was built, in what order, what broke and how it was found | `docs/BUILD_LOG.md` |
| The build order and its checks | `docs/ROADMAP_V3.md`, `docs/BUILD_PLAN.md` |
| How the engine and data are specified | `docs/SPEC.md`, `docs/V1_SPEC.md` |
| The business case, with its arithmetic | `docs/BUSINESS_CASE.md` (regenerated by `docs/business_model.py`) |
| Where the build ended and what a pilot would need | `docs/HANDOFF.md` |
| Every eval check and its caveats | `eval/report.md` (made by `make eval`) |

## Rules the product keeps

- Numbers come from SQL or Python, never from a model.
- Nothing moves money or sends bulk messages without the approval the autonomy setting requires. Recovery links always need the founder.
- Refunds go to the original method, one customer at a time, under a daily limit, with no undo.
- The assistant says it is an AI, never asks a customer for a card number, OTP or password, and never discusses a payment in public.
- Outgoing messages never use false urgency.
- An issue closes only after 24 healthy hours.

## Known limits of the prototype

These are choices for a made-up-data prototype. None would be acceptable in production.

- **No real sign-in.** The account picker is a demo switch, and the approver is a name sent with the request. Production would use Razorpay's own dashboard session.
- **The merchant's system is a stand-in in the same app** (`/merchant-mock`), and a customer's context on `/api/inbound` is taken as given. Production would sign it.
- **The webhook receiver on Supabase records any POST** sent to it. It exists to observe what Razorpay really sends.
- **At the autopilot setting**, an incident message goes to everyone in the plan (up to 100) after the first five without a pause. The default is "Suggest".
- **The refund limit is per calendar day**, not rolling.
- **Retention keeps** the redacted complaint text, each message body, and a short hash of the customer's handle. Transcripts and real identifiers are removed.
- **The model is not here.** Messages the rules cannot read (Devanagari, heavy slang, an unlisted server error) are treated as "not a payment" or handed to the founder. That gap is the production model's job and is not measured.
- **The big brand's alert door is simulated.** Taking alerts straight from Sentry, Datadog or PagerDuty was the next build and was not made. Its Integration page shows a placeholder address on a made-up host.
- **Customer names are masked**, and Blindspot proposes some Razorpay capabilities that do not exist today. They are listed in `backend/app/config.py` (`PROPOSED`) and in PRD section 15.

## Credits

Built with Claude (Claude Code) for all code, tests and docs, with the product decisions, scope and evidence set by Eshan Jain. UI is built on Razorpay's open-source [Blade](https://github.com/razorpay/blade) design system (MIT). Razorpay, RazorSense and Flipkart are trademarks of their owners; they appear here as text to describe the scenario and no logo is used except Razorpay's in the demo header. No secrets are in the repo; Razorpay keys are `rzp_test_` only and live in `.env`.
