# AI build log: Razorpay Resolve

Eshan Jain · Razorpay x ISB AI PM Build Challenge, Track 2 · 13 Oct 2026
[Live prototype](https://razorpay-blindspot.vercel.app/) · [Repository](https://github.com/jain-eshan/razorsense-starter) · [Day-by-day build record](BUILD_LOG.md)

The product was called Blindspot while it was being built and was renamed Resolve on 13 October. Older files and the prototype's web address still use the working name.

## Summary

I cannot code. AI wrote all of the code, the tests and the first draft of every document. My job was the product work: picking the problem, deciding what the product may and may not do, supplying evidence, and checking every result before I accepted it.

What came out in 16 days (28 Sep to 13 Oct), with about 35 Claude Code sessions:

| | |
|---|---|
| History on `main` | About 185 commits, 55 merged pull requests |
| Code | About 32,000 lines of Python and TypeScript, tests included |
| Checks | 627 backend tests, 260 browser tests at phone, tablet and desktop widths, 147 scored checks against a synthetic world with a hidden answer key |
| Product | Two demo accounts (a small merchant and a big brand) inside a Razorpay-style dashboard, a WhatsApp demo, an alert-to-Slack demo, 18 illustrations |

The rest of this log follows the five things the form asks for: tools, workflow and prompts, an output I rejected, who did what, and limitations.

## 1. AI tools and models used

| Tool or model | What I used it for | What it changed |
|---|---|---|
| **Claude Code** with Claude Sonnet 5.5 and Claude Opus 5.5 (the commit trailers record 74 and 24 commits) | Research synthesis, the PRD and spec, every line of code, tests, docs, and separate review sessions | Built the whole prototype in about a week of build time. Tests were written with the code, so each claim in the note has a check behind it |
| **Claude as a separate reviewer agent** (`.claude/agents/design-reviewer.md`) | A fresh agent with no memory of the build reviewed each batch of screens against Razorpay's design rules and our checklist | Failed screens I would have shipped. Examples in section 3 |
| **Claude Docs** | The PRD v3, where I comment and edit. The repo holds an export the build sessions read | One source for the product that both I and the coding sessions work from |
| **ChatGPT and Codex** (exact models not recorded) | A second opinion on research and decisions, a full product review on 13 Oct, and drafts of these submission documents | A different model family caught gaps Claude missed, for example that "approve" and "confirm the root cause" were being treated as one step |
| **Two NVIDIA Nemotron-family models, run locally through Bionic** | A rough comparison with ChatGPT and Claude on the kind of reading the product needs | Slower and less complete in my setup, sometimes garbled. One input to the decision to keep a live model out of the prototype (section 4) |
| **Google Gemini (Nano Banana)** | The 18 product illustrations, from briefs Claude wrote in Razorpay's own illustration style | Replaced pictures the agent had drawn in code, which test viewers could not read at a glance |
| **Apify** | Scraping Reddit and X for merchants' own words about payments (about $3 to $4) | The founder quotes in the note. Only 15 of 289 merchant posts matched this exact theme, so I used them to understand the failure, not to size the market |
| **Razorpay Blade and its MCP server** | Reading component docs before using a component | Every screen uses Razorpay's own components and tokens, so the prototype looks like part of the dashboard |
| **CodeRabbit** | Automatic pull request review | A second reader on every diff until the free allowance ran out |
| **Graphify, and a memory layer I built** | A map of the code for the agents, and notes carried between sessions | A new session did not start from nothing, which saved re-explaining the project about 35 times |
| **pytest, Playwright, ruff, GitHub Actions** | Backend and browser tests, lint, CI on every pull request, and an issue opened automatically when CI fails on `main` | Bugs were caught before I saw them. CI runs the full suite in about seven minutes |
| **Supabase and Vercel** | A real webhook receiver for Razorpay test mode, and the hosted demo | The one real observation in the build (section 3) |

## 2. Key prompts, workflow and agent setup

### How the work was set up

- **One rule file every session reads** (`CLAUDE.md`). It holds the hard rules (numbers come from SQL or Python, never from a model; nothing moves money or messages customers in bulk without approval; the assistant never asks for credentials), which documents to read first, and the workflow below.
- **Frozen contracts.** The data shapes, API and message templates were fixed before building, so parallel sessions could build detection, conversations, fixes and screens without breaking each other. Changing one needs a logged entry in `docs/CONTRACT_CHANGES.md`.
- **One chat, one branch, one pull request.** Each session works in its own copy of the repo, merges only after CI passes, and deletes the branch. If CI fails on `main`, an issue opens automatically, and the next session fixes it before anything else.
- **A synthetic world with a hidden answer key.** A Python generator creates a merchant, customers, payments and planted failures, plus look-alike cases that should not be flagged. The product never sees the answer key. The 147 scored checks compare what the product found with what was planted. This let me trust a result without reading the code.
- **Build checks, then a separate reviewer, before every web pull request.** The building session measures each screen at 375, 768 and 1440 px and tries the edge cases. A reviewer agent then checks it against the design rules. The pull request goes up only on a pass, and the build log records what the reviewer could not check.
- **A written record.** Every piece of work adds an entry to `docs/BUILD_LOG.md`: what was built, what was decided, what the review found and what was fixed.

### The process, by date

| Date | What happened |
|---|---|
| 28 Sep | Brief received |
| 30 Sep | A simulated leadership council of AI agents (CEO, CPO, CTO, CFO, CRO, risk, AI lead, red team) debated ideas and chose **First Charge**, a pre-debit stage for UPI AutoPay trials |
| 2 Oct | Two rounds of AI problem search. A second-opinion review checked First Charge against Razorpay's docs and said do not build it (section 3) |
| 2 to 4 Oct | Questions drafted for a Razorpay PM and four ISB contacts. No replies by 4 Oct, so I decoupled the build from interviews |
| 5 Oct | Social listening on Reddit and X: 1,749 posts and 2,075 tweets collected, 289 merchant posts and 120 merchant complaints kept. An idea scoreboard rated nine options |
| 6 Oct | Picked the problem, wrote the spec and build plan, set up the repo, started building |
| 6 to 10 Oct | Detection, conversations, fixes, the learning loop, the screens. A real webhook test on Razorpay test mode. On 10 Oct four independent reviewers audited docs, code, a judge's view and the demo |
| 11 Oct | Showed the product to people without explaining it. They could not tell what it was. Every page, name and picture was redone |
| 12 Oct | Restated the product as v3 (two ways in, one engine) after feedback from a Flipkart developer and a Razorpay PM. Built the dashboard home, the issue page and the big-brand demo |
| 13 Oct | Two demo accounts, more big-brand issues, the rename to Resolve, final docs |

### Prompts I actually used

These are quoted from the session records, trimmed with "..." but not reworded.

**Finding the gap in the idea (6 Oct)**
> "The initial idea was that we'll do social listening, look for issues which the users have sent to the brands on WhatsApp, email, and on social channels ... Am I missing something out because I cannot see it in your product brief?"

This led to the question that shaped the product: what about the customers who never complain?

**Matching Razorpay's real product (6 Oct)**
> "go through the logged in razorpay dashboard to understand how their design language is and build the frontend accordingly in line with it"

**The workflow, set once and repeated every batch (7 Oct)**
> "Yes, go through the same pipeline as always: 1. Add it to the build. 2. Run a design review. 3. Document everything. 4. Open the PR and switch auto-fix on"

**Questioning the build, not just directing it (10 Oct)**
> "Given that we're building this just as an MVP for the competition ..., do we really think I should integrate the LLM agents or the models, or can we simulate that as well?"

**Rejecting a screen on the journey, not the bug (12 Oct)**
> "When I open just the Ray, the UI is breaking with the text box being, I think, opaque ... Also, when the chatbot is open, why is everything in the left nav bar going away? How will the user navigate back to the earlier page? Look at all the edge cases. Don't just go blindly from the UI references. Behave like a product designer and stitch the journey properly"

### The reviewer agent's brief (excerpt)

> "You are the design reviewer for Resolve, a product that must look like an addition to the live Razorpay dashboard. You review. You do not edit files."
>
> "Tests: for each new test, ask whether it could fail. Say if you could not prove it."

The full brief is in `.claude/agents/design-reviewer.md`. It runs mechanical checks first (type check, lint, hard-coded colours, fixed widths), then structure, content and a look at three screen widths.

## 3. AI outputs I rejected or corrected

### The main one: the AI council's first pick

On 30 September a council of AI agents, each playing a leadership role, chose **First Charge**: a product that contacts UPI AutoPay trial users before their first paid debit and offers to move the date, pause or lower the plan. The memo was confident and well argued. It had an uplift model, a holdout group and guardrails.

I asked for a second opinion that checked every claim against Razorpay's own documentation. It found that the core actions do not exist:

- Subscriptions authorised by UPI or eMandate cannot be updated, so "lower plan" and "move my date" are not possible.
- Pausing a subscription before its first charge cancels it.
- Razorpay already ships trial reminders and pre-debit notices, and lists "Renewal Shield" as coming soon.

What was left was "keep or stop", which is not a product. I dropped it.

**Why it mattered:** the council was persuasive because it was internally consistent, not because it was true. Since then every product claim has been checked against Razorpay's docs, and the note names the nearest Razorpay products and how Resolve differs. The parts that were sound (no model in the money path, a rule as the baseline to beat, guardrails in code) carried over into Resolve.

### Others, smaller

| What AI produced | How it was caught | What changed |
|---|---|---|
| Copy saying Razorpay turns off a failing webhook, as fact | I ran a 24-hour test in Razorpay test mode with a receiver on Supabase. Retries stopped; the webhook stayed on | The product now says "Razorpay's docs say", and separates what was observed from what is documented |
| ₹56,319 shown next to all 85 affected customers | The reviewer agent saw another page tie it to the 81 still without access | Customer records decide: 85 affected, 81 still waiting, 2 given access by hand, 2 refunded |
| A "never ask for a password" check that let through 27 of 30 new ways of asking, and storage that kept a card number, CVV or OTP if a customer typed one | An adversarial reviewer tried to break the hard rules on 10 Oct | Both fixed, with tests I confirmed fail when the fix is removed |
| An overlapping chat box the agent called "a preview artefact" | I opened the page in my own browser and it was real | A test that scrolls a long thread, and a written checklist for every screen (`web/DESIGN.md` section 23) |
| Tests that could not fail, because they measured the wrong element or matched nothing | The reviewer's "could this test fail?" question | New rule: break the code on purpose and watch the test go red before trusting it |
| A first "where rules fail" score of 78% on 40 messages | A review found two messages two people could read two ways | Removed, not relabelled to suit the rules. Three typo messages added. Now 85% on 41, and the log says the number moved because the test set changed, not the product |
| A big-brand closing message that claimed something not built, and demo screens with no way out | The reviewer failed the first pass with four major faults | Fixed before merge |

## 4. What AI did, and what I decided

| AI did | I decided |
|---|---|
| Generated and scored ideas, ran the simulated council, read Razorpay's docs | Which problem to solve, and which ideas to drop: First Charge (the rails do not support it), international payment failures (I could not study the regulatory side well enough in time), onboarding (no clear new fix beyond work already underway) |
| Wrote the PRD, spec and build plan drafts | Scope: the time before and after a payment, not the payment in flight. No fraud, routing, disputes or settlements |
| Wrote every line of code and every test | What the product must never do: ask for credentials, move money without approval, refund anywhere but the original method |
| Built the synthetic world and the evaluation | That every number comes from SQL or Python, never from a model, and that every simulated figure says so |
| Reviewed its own work through separate agents | When a review was good enough, and when to stop one to save cost (one review on 12 Oct was stopped, and the log says so instead of "passed") |
| Drafted copy and illustration briefs | Names and copy follow Razorpay's own conventions, after a user test where people could not tell what the product was |
| Proposed the v2 product | The v3 restatement: two ways in, one engine, after feedback from a Flipkart developer and a Razorpay PM |
| Proposed adding a live model call | No live model in the prototype (below) |

### Why the prototype has no live model

I tried the reading task in ChatGPT, Claude and two local Nemotron models. ChatGPT and Claude gave fuller, cleaner answers. A live Claude call would have meant a paid API, a new dependency and about eight hours of work the day before a deadline with no changes allowed after, and no time to evaluate it. A model call with no evaluation is a claim, not evidence. So I kept the prototype on rules and measured where rules fail instead.

The design for production:

| Job | Done by | Why |
|---|---|---|
| Read messy complaints, Hinglish, unfamiliar errors, two problems in one message | A language model, which can say "unsure" and hand over to a person | Wording varies beyond any keyword list |
| Match payments, pick affected customers, calculate amounts | Code | These need a traceable answer |
| Approve and carry out refunds or access changes | Policy checks and the merchant's approval | A plausible answer is not permission |

### Other decisions that cost something

- **Refund guardrails make refunds slower.** One at a time, original method, ₹5,000 a day, no undo. The evaluation estimates 10.5 founder minutes for the duplicate-charge incident against a target of 10, assuming 30 seconds per approval. I kept the guardrails and reported the miss.
- **Learning has a price.** Stricter alert settings cut false alerts from 6.2 to 3.2 per six-week run but missed a weak outage in 1 run of 5. Reporting only "fewer alerts" would hide that.
- **Metrics I will not track:** alerts sent, messages sent, customers contacted, conversations handled. Each goes up when the product is noisy, and none says whether money came back.
- **Flipkart's name, text only.** No logo, no look-alike screens, every screen says the data is made up.

## 5. Known limitations, risks and how the work was checked

### What is real and what is simulated

**Real:** Razorpay's webhook behaviour, observed from a test-mode payment. The founder posts on Reddit and X. Feedback from a Flipkart developer, a Razorpay PM and the people in the 11 Oct user test.

**Simulated:** the merchants, customers, payments, complaints, alerts, Slack thread, approvals, learning results and every number in the evaluation. The hosted demo replays recorded answers from the real engine. In the big-brand demo, an approval changes only that browser tab. No real customer was refunded, messaged or given access.

### How the work was checked

- 147 scored checks against a hidden answer key: who was missed, who was wrongly included, whether repeating an approval acts twice, whether a forbidden action is blocked, whether an issue closes only after it is verified.
- 627 backend and 260 browser tests, run by CI on every pull request.
- Tests proven able to fail: for the safety fixes, the code was broken on purpose and the tests went red.
- Separate reviewer agents on every web batch, and four independent audits on 10 Oct.
- My own review in a real browser, and a user test with people who had not seen the product.

### Limitations and risks

- **The evaluation is circular.** The generator and the detector were written from the same assumptions. The checks prove the logic, not real-world accuracy.
- **"Why AI" is not yet proven.** The 41 messy complaints show where rules fail. No model has been scored on them.
- **The big-brand Slack loop is unvalidated.** It comes from my previous company. No Razorpay transcript or public post mentions it.
- **Thin merchant evidence.** No formal merchant interviews; the early outreach (2 to 4 Oct) got no replies, and later feedback came from two conversations, not a study. Earlier personas were partly AI-simulated and are treated as hypotheses.
- **Not built:** the live alert endpoint, the Razorpay support engineer's console, comparison across merchants, live channel integrations, and approvals tied to real logins.
- **Production would need:** signed integrations, verified customer identity, WhatsApp policy checks, a model evaluation with monitoring, and authenticated approvals.

### What I would test next

Replay real, redacted incidents from 3 to 5 consenting merchants in shadow mode. Score rules against a model on their real complaints. Then pilot approved recovery against their current workflow and measure verified recovered order value, time to recovery, handling minutes, false alerts and wrong actions. Separately, check the Slack root-cause loop with one brand and one Razorpay support engineer.

The question for that pilot: does Resolve help a merchant put more affected customers right, sooner and with less effort, without new mistakes?

---

This log contains no keys, credentials, customer data or private transcripts. The quoted prompts are my own messages.
