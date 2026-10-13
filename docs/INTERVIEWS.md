# What Razorpay has said publicly, and what it means for how we build

> **Naming.** The product is called Razorpay Resolve (Resolve inside the dashboard). It was developed under the working name Blindspot, and this file keeps that name in its dated history.

A digest of the interviews, talks, posts and pages we have read, written in our own words, with the tech and product calls each one supports. It exists so that decisions about the demo and about production are made with these facts in front of us, not from memory.

**Full text.** The unabridged transcripts of S1 to S5 are in **`docs/RAZORPAY_TRANSCRIPTS.md`** (about 25,000 words). Read it, not only this digest, before relying on a detail, a figure or a speaker's exact words. Search it with `grep -n -i "<word>" docs/RAZORPAY_TRANSCRIPTS.md`. The file is third-party material kept for private research in this private repository: do not publish or send it outside the team.

**How to read this digest.** Spoken sources are auto-captions with errors, so names and figures spoken aloud are marked "as spoken". This file paraphrases. The transcripts file holds the words. Tags: `[spoken]` an interview or talk, `[post]` a social post, `[page]` a Razorpay web page or doc, `[third]` a third party. Business numbers built from these facts are in `docs/BUSINESS_CASE.md`.

**Sources**

S1 to S5 are in the transcripts file under the same IDs. S6 to S9 are web pages, documents and data that we cite but do not hold as transcripts.

| ID | Source | When | Speakers | Tag |
|---|---|---|---|---|
| S1 | Harshil Mathur, LinkedIn and X post about a small AI team (screenshot from Eshan) | 10 Apr 2026 | Harshil Mathur, CEO | `[post]` |
| S2 | Signal Dialogues podcast, "how Razorpay became AI-native" | Global Fintech Fest 2026 (Oct) | Harshil Mathur, with the host | `[spoken]` |
| S3 | Global Fintech Fest 2025 panel on the new operating system of finance | Oct 2025 | Harshil Mathur, with the heads of Monzo and Revolut India and a moderator | `[spoken]` |
| S4 | FTX 26 technical talk, "AI at Razorpay" | Mar 2026 | Four engineers (names unclear in captions) | `[spoken]` |
| S5 | AIM Network "Front Page" interview with Razorpay's chief product officer, Khilan Haria | Mar 2026 (FTX 26) | Khilan Haria | `[spoken]` |
| S6 | Razorpay pages: Agent Studio launch and principles blogs, newsroom, ecommerce plugins doc | Mar to Oct 2026 | Razorpay | `[page]` |
| S7 | Razorpay pricing pages (payment gateway pricing, margins guide, enterprise pricing guide) and the RazorpayX billing doc | Feb to Oct 2026 | Razorpay | `[page]` |
| S8 | Razorpay job descriptions: AI Product Manager, Full-stack AI Builder PM; ISB pay range from Eshan | Oct 2026 | Razorpay, Eshan | `[page]` |
| S9 | Pay data: AmbitionBox, Levels.fyi, ISB placements 2026 | Oct 2026 | | `[third]` |

---

## 1. S1: the small AI team (post, 10 Apr 2026)

- Harshil set up an AI "hacker team" at Razorpay of two people a few months before the post. He says they work like "100x builders" and that with AI, people are no longer the constraint, org structure is. He is now scaling the idea.
- The hiring ask: people who have spent months deep in coding agents. The job is to review workflows, rebuild them with AI and ship fast. Perks listed: unlimited tokens on any model or tool, real problems at scale, no hierarchy, direct access across the company. Pay is described as having no ceiling and scaling with output, not title. Candidates send what they have built, not a resume. Full-time, Bangalore.
- **Use:** a two-person team is how Razorpay builds new AI products, and tokens are treated as free for that team. This is why the business case counts man-hours from a small squad, not a new department, and never prices on tokens.

## 2. S2: Signal Dialogues podcast (Harshil, Oct 2026)

**How the company moved.**
- First uses were internal: a support assistant that drafts replies for staff to edit. The turning point was models that act as agents, first in coding.
- Harshil runs three personal agents (fitness, meeting prep, general tasks) on purpose: because the software is probabilistic, leaders must learn its failure modes themselves. He says 200 to 300 people inside Razorpay run their own agents.
- After coding sped up, the bottleneck moved to testing, deployment, review and security, so a separate team now works on engineering productivity. In AI-native repos, issues are replaced by pull requests.
- About 1,500 engineers. He says 30 to 40 percent or more of them maintain existing systems and fix bugs, and that agents will take that work, so Razorpay will hire more engineers, not fewer.
- Every employee is rated monthly on AI proficiency (levels 1 to 5, scored partly by agents). Below level 3 is not acceptable and promotion needs level 3 or above. Hiring tests it.
- The AI team reviews progress daily, not in sprints of weeks. One project slipped a week and a half and got a root-cause review.

**What they built for customers.**
- **Agent onboarding:** a merchant gives its website and agents fill the KYC form and run validations. Now the default path, about 3 minutes against 30.
- **Integration by prompt:** instead of docs and a code snippet, Razorpay gives a prompt to paste into a coding agent.
- **Agent Studio:** operational agents on top of payments, a marketplace with partners (voice from ElevenLabs, others). As spoken, "about a couple of thousand merchants live", still in beta, used daily. The most used agent is cart recovery: when a payment fails and the buyer drops off, an agent calls or messages them.
- **Packaging stance:** an SME could build agents on a general model platform, but the technical load is high. Razorpay packages it as "this is the outcome, at this cost", and the merchant does not think about the model or tokens.
- **Vulcan:** a transformer model that treats each payment as a set of fields. About 4 billion transactions and 3,000 signals each. It answers inside 28 milliseconds or the old model takes over (old model 17 to 18 ms). Live on 5 to 7 percent of volume after two months. Success rate up 4 to 8 percent on that slice (as spoken), more on a large merchant at 70 percent of traffic. Fraud head found 8x more international fraud at the same false-positive rate. Other heads: disputes and checkout personalisation. Built in about 6 months by a team that began at 2 people and is now 6, reviewed by NVIDIA and AWS architects, trained on H100s in India. Training cost is treated as sunk and running cost as small against the payoff.
- Next: Vulcan 2.0, fine-tuning for the largest customers, and Agent Studio.

**Beliefs worth planning around.**
- Token cost approaches zero, so build as if it does. Harshil says the price has fallen faster than RAM or CPU ever did.
- The customer comes to Razorpay for three things: more transactions complete, less fraud, fewer errors. Go after those.
- Run a company on four resources: people, money, time and AI.
- Elad Gil's point, which he quotes: in this era, old-school businesses are the interesting ones, because building is easy and domain knowledge is the hard part.

**Use for us.**
- Blindspot is "fewer errors" and, for Zone 1, "more transactions". Frame it that way.
- Agent Studio is gated beta, about 2,000 merchants, so that number is supply-limited and cannot be read as a demand ceiling.
- Sell outcomes, not model use.
- The AI team's pace (daily review, 2 to 6 people) is the benchmark for our squad estimate.

## 3. S3: Global Fintech Fest 2025 panel

- India's public rails (UPI, Aadhaar, CKYC, account aggregator, ONDC) let private companies build on top and stay interoperable. Customers own their data, which the data protection law will enforce.
- Who owns the customer will come down to who the customer trusts and loves. Razorpay's primary internal goal is NPS, not revenue. About 80 percent of the merchants it onboards each month come organically.
- Finance should disappear into the point of purchase, with underwriting, KYC and fraud checks in the background. AI speeds all three.
- **Use:** trust is the metric. Charging merchants to see a gap in Razorpay's own tooling is a risk to NPS, which is why Watch is free. Consent and data ownership match our policy engine and retention rules.

## 4. S4: FTX 26 technical talk, "AI at Razorpay" (Mar 2026)

**Agentic dashboard.**
- Two demos. First, a duplicate payment: the merchant says a customer paid ₹37 twice, the agent finds both payments by amount, phone number and time, proposes a refund for the duplicate, and the merchant clicks to confirm. Money always needs explicit merchant instruction. The first payment is untouched. Second, bulk payment links: the agent notices the amount is missing, shows a generated form to collect it, then creates the links in parallel.
- The interface is generated: the agent returns a JSON schema in Razorpay's Blade design system, streamed to the browser and rendered by an open-source Blade generative-UI SDK. Text, tables, charts, buttons and forms are all blocks.

**Back end.**
- No hand-written business code for the dashboard back end. Claude skills describe scenarios, steps, validations, tools and how to talk to the user. An orchestrator does three things: match the user's intent to a skill, run the model and tools, manage the conversation.
- **Three tools only**, because many tools raise hallucination: a GraphQL tool (90 percent of dashboard queries already go through GraphQL), a REST tool for the rest (the exact API is written into the skill), and workflow tools built in n8n for anything that moves money or where the agent must not decide, since even a 1 percent chance of losing a merchant's money is unacceptable.

**Speed.**
- Three model calls each took 3 to 4 seconds. They cut latency by putting predictable interface blocks into the parent skill ("mostly generative", about 70 percent of requests look alike), by pre-warming agents with aggressive prompt caching (time to first token down 80 percent), and by streaming end to end with on-the-fly repair of partial JSON, skeleton loaders and suspended blocks. That let them use Sonnet in real time.

**How they got here.**
- Coding agents for all engineers from Sept 2023, MCP servers in 2024, skills from late 2025. 132 skills in a little over two months, almost two a day. They expect shipping to be 90 percent autonomous within months.
- A migration demo showed a swarm of sub-agents moving a legacy module in minutes instead of 6 to 8 weeks, with a deterministic parser, work split so each sub-agent has its own full context, and a human approval step before anything destructive.
- Principles: use the model to reason and deterministic tools to parse; do not give one agent 700 functions in one prompt; design for agents, not modules.

**Use for us.**
- Our "rules decide, model reads" design is the same rule Razorpay applies to money.
- Our staged executor (dry run, first 5, the rest, undo, verify) maps to a workflow tool.
- Our screens are already Blade, so they map to generative-UI blocks.
- The duplicate-refund flow we built (INC-2) already exists in the dashboard as a merchant-triggered action. What we add is proactive detection and the app-version cause.
- Payment links exist as a tool. Our recovery links should call it.

## 5. S5: Chief product officer interview (Mar 2026)

- Razorpay calls Agent Studio "intelligence on demand". The hard part was the plumbing: giving agents context and allowed actions in a way that is traceable, explainable and, where needed, human-in-the-loop.
- Seeded with about 8 to 9 first-party agents and 2 partner agents. A builder day on 9 May for customers to build agents live in 24 hours. He expects hundreds of thousands of agents in the marketplace within a year.
- Many jobs to be done were not happening at all before AI (for example calling every buyer who abandons a cart). So the competition for these agents is not a person doing it today, it is nothing.
- He expects merchant economics to stay the same; what changes is where buyers discover and buy.
- Agentic checkout will become invisible and intent-led, while discovery-led commerce stays.
- Razorpay operates in about 5 geographies and sees these products as built in India for export.
- **Use:** "pre-payment and post-payment needs closely tied to payments infrastructure" is the exact space of Blindspot. Because the alternative is usually nothing, the price has to be small and outcome-based. There is no budget line to displace.
- **Pitch line (10 Oct):** he says Razorpay's largest customers have account managers who stand between them and Razorpay, and that agents now give the smallest merchant an experience at par with the largest. Blindspot is the account manager's first job for a merchant who has none: noticing that a webhook is failing and telling Razorpay with evidence.

## 6. S6: Razorpay pages on Agent Studio

- Built on Anthropic's Claude Agent SDK, early access with a sign-up form, free 30-day trial with a credit limit for early partners.
- Principles: the merchant defines what an agent can see and do; review-first mode holds work for approval; no agent takes an irreversible action without explicit approval, and large transfers need double confirmation; agents do not set prices or invent discounts; data comes from the merchant's own connected systems (Shopify, Shiprocket, Tally, QuickBooks by one-time sign-in; Razorpay data, WhatsApp, SMS, email, ElevenLabs and Shiprocket pre-enabled); every action passes a platform validation layer (compliance, amounts, personal data, scope); consent is checked before every call or message and opt-outs are permanent; no dark patterns (false urgency, confirm-shaming, bait and switch, drip pricing, subscription traps); pricing is shown before install and is per agent (usage, subscription or outcome), with communication costs on top; agents are certified before listing and monitored after; the agent provider is accountable for logic and outcomes while Razorpay enforces platform limits; agents run inside Razorpay's infrastructure and inherit its SOC 2, PCI DSS and data protection compliance.
- New connectors take about a week to build. Merchants can bring their own WhatsApp provider.
- Razorpay has official plugins for Shopify, WooCommerce, Wix and Magento. Others use the API.
- Razorpay's FY25: revenue ₹3,783 cr, gross profit ₹1,277 cr, a loss from the cost of moving its home base to India.
- **Use:** our policy engine, autonomy dial, consent rules, audit log and template lint are the same shape as these principles. Add the no-false-urgency check (section 9 below).

## 7. S7: pricing pages and billing doc

- Standard platform fee is 2 percent plus 18 percent GST on most domestic methods, including UPI (where the fee is Razorpay's, not a bank charge). It covers payment processing, fraud detection, routing, reporting, reconciliation and settlement management. No setup fee, no annual fee.
- Higher: EMI, cardless EMI, pay later, corporate and Amex or Diners cards at 3 percent; debit EMI 1 percent; credit card on UPI 2.15 percent; international cards 3 percent with optional chargeback protection of 1 percent more; international bank transfers 1 percent. Subscriptions add 0.99 percent on top of the method fee.
- New merchants who activate on or after 1 July 2026 pay no platform fee for 90 days or ₹5 lakh of volume, whichever comes first, plus a ₹199 KYC fee.
- Custom pricing starts above ₹5 lakh a month; at ₹1 crore a month and up, card rates are negotiable to about 1.4 to 1.6 percent.
- Razorpay sells value as revenue captured versus lost: a 1 percent gain in success rate on ₹50 lakh a month is ₹50,000; an 8 percent failure rate on 10,000 payments at ₹1,200 costs about ₹9.6 lakh.
- Billing doc (RazorpayX): a payout of ₹10,000 costs ₹5 plus ₹0.90 tax. Current-account fees are collected once a day and show up as a line in the statement, with a monthly invoice on the 1st and a reconciliation report. A "free payout" fee type exists, and fees reverse with the payout.
- **Use:** add-ons at about 1 percent and small flat operational fees are Razorpay's pattern, so Fix is 1 percent. Billing rails exist, so we build none. Use the revenue-versus-lost framing in the pitch.

## 8. S8 and S9: roles and pay

- AI Product Manager role: owns products end to end, uses AI where it adds value, can "tell problems that need AI from those that do not". Full-stack AI Builder PM: builds internal tools and agentic workflows with no-code and low-code tools (Replit, Lovable, Cursor), productionises prototypes with engineering, works with compliance, risk and legal, and reports into the product leadership.
- Compensation for both at ISB: ₹25 to 38 lakh cash plus ESOP (from Eshan). Class of 2026 average ₹37.29 lakh. Razorpay product managers: ₹33 to 37 lakh (3 to 8 years), ₹38.5 to 44.7 lakh (second grade). Senior engineers ₹34 to 37 lakh.
- **Use:** the squad that would build Blindspot is exactly this profile, at about ₹3.74 lakh a person-month fully loaded.

---

## 9. Calls these facts support

### 9.1 For the demo build (to 13 Oct)

| # | Call | Evidence | Status |
|---|---|---|---|
| T1 | No model in the competition build. The prototype is rules and SQL. Say plainly that production adds a model behind `extract()` on Razorpay's own agent stack. | S2, S4: tokens treated as free, rules for money | Decided |
| T2 | Lead with "a model reads, deterministic code decides and moves money". It is Razorpay's own rule. | S4 | Say it in Q&A |
| T3 | Keep the prototype's Python as the specification. Do not rebuild it as skills for the demo. | S4 | Decided |
| T4 | Keep the built flows (refund, recovery links, renewal link) in the demo, and label them as flows that production hands to existing tools. | S4, S5, S2 | Decided |
| T5 | Use Blade only, as built. | S4 | Already true |
| T6 | Do not add fee previews or receipts to the demo before submission. Post-submission backlog. | BUSINESS_CASE 5.2 | Backlog |
| T7 | Add a no-false-urgency check to the template lint, starting with the `T-G2` renewal link, which carries an expiry slot. A real expiry is allowed, an invented one is not. | S6 principle 6 | Built 10 Oct 2026 (PRD D20, F-55). The "48 hours" in `T-G2` and `T-Z1R` is a constant that nothing enforces in the mock, so the check allows a validity line only when its number is the template's `hours` slot, the link's real expiry in production. |
| T8 | Keep the connection point in the mock named for what it is in production: a fulfilment acknowledgement the merchant sends when it grants access. | BUSINESS_CASE 2.1 | Done 10 Oct 2026 in the merchant mock and on the Release check screen. The Fix step still says "access hook", because that is the path Blindspot grants access through, which is a different thing. |

### 9.2 For production

| # | Call | Evidence |
|---|---|---|
| P1 | Build as skills plus three tools (GraphQL, REST, workflow), with an orchestrator. Money and access changes are workflow tools. | S4 |
| P2 | Watch is a platform feature (owner: payments platform and dashboard teams). Fix and Guard are a first-party Agent Studio agent. | S2, S5 |
| P3 | Hand refunds, recovery links and renewal links to existing tools and agents. Keep detection, widening, attribution, the customer conversation and the access fix. | S2, S4, S5 |
| P4 | Three connection paths: plugin merchants need nothing; custom merchants send a fulfilment acknowledgement; event tools merchants already run (Sentry alerts, analytics events) feed signals. A new connector takes about a week. | S6 |
| P5 | Detect with scheduled grouped queries on data Razorpay already holds, not a per-merchant real-time stream. | BUSINESS_CASE 4.1 |
| P6 | Show price before install, show the fee before approving a fix, send a receipt after. Charge through existing billing. | S6, S7 |
| P7 | Generate the interface as Blade blocks: incident card, timeline table, fix stepper with confirm buttons. Use streaming and caching if a model is added. | S4 |
| P8 | Prepare for agent certification: logic, data scope, actions, compliance and message patterns are reviewed before listing. Our SPEC and policy engine are the starting pack. | S6 |
| P9 | Keep the pilot team to 2 to 3 people with a daily review. | S1, S2 |
| P10 | Watch's free layer should be reviewed against NPS, the primary internal goal. | S3 |
| P11 | (Built as a prototype page on 10 Oct 2026: `/connect`, PRD F-83.) Attach activation to Razorpay's integration prompt: the prompt a merchant pastes into a coding agent includes the fulfilment acknowledgement call. Connection is the largest driver of the case, and this is a merchant who is connected on day one at no effort. | S2 (integration by prompt) |
| P12 | Take the pay-page address from agent onboarding's website scan, so the pay-page check needs no setup. | S2 (agent onboarding) |
| P13 | Build Guard's test ping and pre-deploy check first. Harshil says coding agents moved the bottleneck to testing and deployment, and that repos now fill with agent-written pull requests. Merchants who integrate by prompt run agent-written handlers and release more often, which is the input behind the incident rate. | S2 |

### 9.3 Still unknown

- Agent Studio and RAY prices (none published; asked for in the pilot).
- How many merchants the builder day on 9 May added, and whether Agent Studio is still gated.
- Razorpay's active-merchant count (IPO filing is confidential).
- Support cost per ticket and the tagged ticket count.
- Whether RAY or the agentic dashboard already lists every payment affected by one failing webhook (kill criterion K2).

### 9.4 Worth getting if you can

The Ken's Zero Shot podcast with Harshil (paywalled), the Agent Studio launch videos on YouTube, a screenshot of Agent Studio's price card from an early-access account, and any statement from the 9 May builder day.

---

## 10. Review of the full transcripts and public news (10 Oct 2026)

Done by reading S1 to S5 in full (`docs/RAZORPAY_TRANSCRIPTS.md`), then checking the PRD, the build plan, the business case and the design guide against them, and searching for Agent Studio pricing and Razorpay news dated after the 10 Oct freeze.

**What changed**

| Change | Where | Why |
|---|---|---|
| D20 and F-55: no false urgency, built | PRD, BUILD_PLAN 13, `backend/app/conversation/lint.py` | S6 principle 6 and B12 were written down but never reached the PRD or the code. Found that `T-G2` and `T-Z1R` state a 48 hour validity that nothing in the mock enforces. |
| D21, P11, P12: activation through the integration prompt and agent onboarding | PRD D21 and section 18, BUILD_PLAN 13 | S2 describes both flows and the digest listed them without connecting them to the case's largest driver. Not priced: the base case keeps 8% connected. |
| P13, F-81, F-82: prevention checks first within Guard | PRD section 10, BUILD_PLAN 13 | Guard carries ₹0.93 cr of the ₹1.09 cr direct revenue and has no edge over a do-it-yourself script without them. The prototype now has both, as the Release check screen (built 10 Oct 2026). |
| F-80: price card, fee preview, receipt, value ledger now have a feature row | PRD section 10 | BUSINESS_CASE 5.2 described them and the PRD had no row. Still post-submission (T6). |
| Pitch line from S5 | S5 use | The account manager framing is the plainest way to say who Blindspot is for. Eshan decides whether it goes in the note. |

**What did not change, and why**

- **Pricing.** Razorpay has published no Agent Studio price. Its launch blog says each agent shows its price before install (usage, subscription or outcome), and the CPO told MediaNama the price depends on the agent after the 30 day trial. MediaNama also named dark patterns and price discrimination as open concerns. All of that matches Watch free, Fix at 1 percent with a first incident free, and Guard by subscription. No unfreeze trigger in BUSINESS_CASE section 11 has fired.
- **Business case numbers.** Nothing in the transcripts or the news moves an input. The activation upside is recorded as unpriced.
- **Design.** The "chat plus screens" pattern in the FTX talk (an agent proposes the action, asks for a missing input with a generated form, puts a button on anything that moves money, then summarises and says what it did not touch) is the pattern already written as `web/DESIGN.md` section 17 from Razorpay's own agents, and our incident pages already follow it. Loading skeletons came in with PR #30. No design change.
- **Release plan.** R0 to R7 stay as they are. The investigation agent still waits for a model and pilot data. R6 still needs Eshan's accounts.
- **Fee preview and receipt in the demo** stay out until after submission (T6). The reason holds: the Fix fee is an assumption, and showing a price in a demo for judges who run Agent Studio invites a pricing argument the pilot should settle first.

**Sources for the pricing check:** [Razorpay Agent Studio principles](https://razorpay.com/blog/razorpay-agent-studio-principles-guardrails-and-merchant-control/), [MediaNama on the CPO and pricing](https://www.medianama.com/2026/03/223-razorpay-chief-product-officer-ai-agent-studio-pricing-compliance-concerns/), [MediaNama on dark patterns](https://www.medianama.com/2026/03/223-razorpay-launches-ai-agent-studio-questions-loom-dark-patterns-price-discrimination/). No Razorpay news dated 3 to 10 Oct 2026 turned up in the search tool, which does not prove there is none.
