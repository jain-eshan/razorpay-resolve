# AI build log

Blindspot, Razorpay x ISB AI PM Build Challenge, Track 2. Draft written for Eshan Jain to review and put in his own voice before submitting. The full day-by-day record is `docs/BUILD_LOG.md`.

## In one paragraph

I cannot code. AI wrote all of the code. I did the product work: choosing the problem, setting scope, deciding what the product may and may not do, supplying evidence, and checking results against it. I used Claude through Claude Code, one session per piece of work, each on its own branch and merged by pull request after the checks passed. By 10 October that was 26 sessions, 96 commits, 32 merged pull requests, about 26,000 lines of code, 605 automated tests, 78 browser tests and 147 scored checks against a synthetic world. The research and spec took 5 and 6 October. Almost all of the building took 6 to 10 October.

## Tools, what for, and what they changed

| Tool | Used for | What it changed |
|---|---|---|
| Claude, through Claude Code | Research synthesis, the spec, every line of code, tests, documentation | Built the whole prototype in about five days of build time. Tests and a scored evaluation were written with the code, so each claim in the note has a check behind it |
| Claude as independent reviewer | A separate agent, with no memory of the work, reviewed screens against Razorpay's design rules (`.claude/agents/design-reviewer.md`), and on 10 October reviewed the docs, the code, a judge's view and the demo script | Found faults I would not have seen. Examples below |
| Apify | Scraping Reddit and X for founders' own words about payments that succeed and still lose the customer | Gave the three quotes in the note and the evidence the pain is real. Only 15 of 289 merchant posts were on this theme, so the size argument rests on Razorpay's data, not post counts |
| Razorpay's Blade MCP server and the Blade design system | Reading component documentation before using a component | Kept every screen in Razorpay's own components and tokens, so the prototype looks like an addition to the dashboard |
| Playwright, pytest, ruff, GitHub Actions | Browser tests at phone, tablet and desktop widths, backend tests, lint, CI on every pull request, and an alert issue when CI fails on `main` | Caught bugs before I saw them. CI runs the whole suite in about seven minutes |
| Supabase and Vercel | A webhook receiver that recorded what Razorpay really sends, and the hosted demo | The one real observation in the build: Razorpay's delivery behaviour from a real test payment |
| CodeRabbit | Automatic pull request review | A second opinion on diffs, until it reached its free limit |
| An image generation model, from briefs Claude wrote | The 18 pictures in the product (guide heroes, card pictures, the welcome pop-up), in Razorpay's own illustration style: flat isometric, Razorpay blue, one orange accent, no text | Replaced pictures the agent had drawn in code, which test viewers did not read at a glance. Briefs and the style are in `web/DESIGN.md` section 16 |
| Graphify, and a memory layer I built | A map of the code for the agents, and notes from earlier sessions so a new session does not start from nothing | Saved re-explaining the project to each of the 26 sessions |

## How AI sped the work up

- A spec, a data model and a build plan in two days, then parallel sessions building detection, conversation, fixing and screens against interfaces fixed in advance, so they did not collide.
- A synthetic world with hidden ground truth that the product never sees. Every claim is scored against it, which let me trust a result without reading the code.
- An independent reviewer after each batch. Each batch was fixed before it merged.

## Where I made the decisions

AI proposed. These were mine.

1. **The problem.** I compared four ideas (a pre-debit engine, offer and EMI recovery, international payment failures, and this one) and chose "payments that succeeded and still lost the customer", because Razorpay's own tools cover the payment in flight.
2. **Scope.** The product owns what happens before and after a payment. It does not rebuild retries, fraud, routing or disputes. I also set what it must never do: ask a customer for a password, card number or OTP, move money without an approval, or refund anywhere but the original method.
3. **Evidence over comfort.** The first spec called webhook logs undocumented and rested on six AI-simulated personas and an AI scoring panel. I had the facts corrected against Razorpay's documents and refused to quote simulated scores as real judge verdicts. I ran the 24-hour webhook test myself in Razorpay's dashboard and recorded that it did not disable the webhook, so the product labels that behaviour as documented, not observed.
4. **The prototype uses no model, on purpose.** The product should use AI. The prototype runs on rules and synthetic data, and the note says where a model goes in production: messy complaint text, free-text server errors, causes nobody listed. Razorpay's own engineers say a model reads and deterministic code moves money, and I applied that.
5. **Refund guardrails.** Original method only, one customer at a time, ₹5,000 a day, no undo. This makes a refund slower. The evaluation reports that cost (10.5 founder minutes against a target of 10) instead of hiding it.
6. **Business case.** I froze it at what the evidence supports, made detection free, and asked for a pilot with stop rules before any claim of revenue.
7. **Cuts.** For example the investigation agent, which needs a model, and a monthly report that would be wrong in a demo with no server.
8. **One branch, one pull request per batch, merged by me after CI.**
9. **Names and copy from Razorpay, after a user test.** On 11 October I showed the product to people without explaining it, and they could not tell what it was. I had every page, name and picture redone so a merchant understands it at a glance, and told the agent to take names from how Razorpay names its own products rather than invent them. A research agent read Razorpay's docs and my dashboard screenshots; the menu went from 12 items to 10 (`web/DESIGN.md` section 22).

## What AI got wrong, and how it was caught

- It built a pay-page check that passed a page where checkout does not open. A test I asked for failed on it.
- It counted founder effort with a formula. A cross-check against a real run showed it had missed one approval.
- It wrote "nothing is changed" on a screen that sends a test event. An independent reviewer caught it.
- It stored a customer's card number, CVV and OTP if the customer typed them, and its "never ask for a secret" check let through 27 of 30 new ways of asking. An independent reviewer tried to break the hard rules on 10 October and found both. Both are fixed, with tests that fail without the fix.
- It showed "Razorpay turns the webhook off" as fact after my own test showed it does not. It now says "Razorpay's docs say".
- While rewriting the copy, it put ₹56,319 next to all 85 affected customers on the INC-1 page. The amount belongs to the 81 still without access, as another page said. The independent design reviewer caught the contradiction; the customer data settled which page was right.

## What is real and what is not

Real: Razorpay's webhook behaviour, observed from a test payment. Simulated: the merchant, customers, channels, messages and every number in the evaluation. The prototype uses no language model. External services and sources used: Razorpay's documents and test mode, Supabase, Vercel, GitHub, Meta and Anthropic public documentation for the research, Reddit and X posts, and Razorpay's open-source Blade design system.
