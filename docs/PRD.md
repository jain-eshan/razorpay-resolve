# Blindspot v2: Product Requirements Document

| | |
|---|---|
| Product (working name) | Blindspot. The name is a placeholder and lives in one constant (`PRODUCT_NAME`). |
| Version | 2.0, 6 Oct 2026 |
| Status | Draft for Eshan's approval |
| Owner and builder | Eshan Jain (product owner). Implementation by coding agents. |
| Context | Razorpay x ISB AI PM Build Challenge, Track 2 "Recover and Grow with AI". Judges are Razorpay PMs who built RAY and Agent Studio. |
| Supersedes | The product definition in `Blind_Spot_Build_Spec.md` (v1). Anything not changed here is inherited from v1 by section number. |
| Companion files | `Blindspot_v2_Tech_Spec.md` (how it is built), `Blindspot_v2_Build_Plan.md` (who builds what, in which order) |

Evidence tags used throughout: **[dash]** observed in the Razorpay test dashboard on 6 Oct 2026. **[docs]** Razorpay docs read on 6 Oct via a summarising fetch tool. **[meta]** Meta developer docs read the same way. **[dossier]** earlier research in the dossier folder. **[assumption]** an inference about Razorpay internals. **[verify]** must be re-checked on the raw page before it appears in the note or video.

---

## 1. Summary

**One line.** Blindspot owns what happens before and after a payment, where Razorpay's own tools stop looking. It finds every customer a payment problem touched, works out whose side it was, talks to those customers to find the payment, and fixes it for all of them while the founder only approves.

**What it is.** An Agent Studio agent with RAY as its front door, for Indian merchants who are their own support team. It listens on the channels customers actually use, identifies the payment behind each complaint, groups complaints with payment signals into incidents, says whose side the fault is on with evidence, and then fixes, messages and verifies.

**Why it is worth building.** Razorpay's tools handle payments that fail while the payment is in flight. Three gaps are verified in the product today: nothing tells a merchant their webhook is failing, nothing widens from one complaint to everyone affected, and nothing talks to the merchant's customer to find the payment. The merchant's own pain is sharper still: customers who have paid, or tried to pay, are lost because nobody answers quickly.

---

## 2. Decisions locked

| # | Decision | Date |
|---|---|---|
| D1 | Name stays "Blindspot" as a placeholder. | 6 Oct |
| D2 | Track 2. Lead segment is merchants whose customers get access by webhook (test series, courses, memberships, wellness apps). The pre-payment problem applies to any online merchant. | 5-6 Oct |
| D3 | Scope is narrowed. We own post-payment and pre-payment. RAY, Vulcan, Payment Links, Subscription Recovery and Ecosystem Health own the payment in flight, and we integrate with them. We do not build failed-payment retries, fraud, routing, disputes or settlement explainers. | 6 Oct |
| D4 | Intake order: (1) Razorpay-owned entry points, (2) a dedicated payments WhatsApp number, (3) email via reply-to, alias and keyword forwarding rule, (4) Instagram and Messenger handover, (5) public mentions, private-first. | 6 Oct |
| D5 | Public posts are a doorbell, not data. We look up an identifier a person volunteers, reply publicly with nothing specific, and link a person to a payment only after they reply on a private channel. | 6 Oct |
| D6 | Customer-facing voice is co-branded: "[Merchant] payment help, with Razorpay". It says it is an AI assistant. | 6 Oct (assumed accepted) |
| D7 | The interface uses Razorpay's own system: Blade components, tokens and RazorSense, from the `razorsense-starter` repo. | 6 Oct |
| D8 | Autonomy is a dial. The default is "Suggest", with identifier questions to customers allowed from day one. | 6 Oct (assumption, confirm) |
| D9 | Two hero demonstrations: paid-no-access (proven) and cannot-reach-the-pay-page (inferred). | 6 Oct |
| D10 | The 13 Oct deadline is ignored for planning. We work professionally fast, with parallel build streams. | 6 Oct |
| D11 | Demo data is synthetic with ground truth. Real Razorpay test-mode objects are a stretch release. | 5-6 Oct |
| D12 | The business case is frozen on the base scenario in `docs/BUSINESS_CASE.md`: steady net +₹0.23 cr a year, three-year -₹1.09 cr, +₹0.28 cr with ₹50 of avoided cost per detected incident. It is not stretched. | 10 Oct |
| D13 | It is a low-cost option on merchant trust and retention, not a revenue line: about ₹0.86 cr a year to run and ₹1.19 cr to build in year 1. Go or no-go comes from the pilot gates (BUSINESS_CASE section 8). | 10 Oct |
| D14 | Three layers. Watch is free and included. Fix is 1% of value restored (minimum ₹99, cap ₹3,000), first incident free, free when the fault is Razorpay's. Guard is ₹999 or ₹2,999 a month and sells prevention and a monthly value report. | 10 Oct |
| D15 | Never price on tokens or model use. Sell outcomes, as Agent Studio does. Fees go through Razorpay's existing billing, so no billing is built. | 10 Oct |
| D16 | Production is built as skills, three tools (GraphQL, REST, workflow) and an orchestrator on Razorpay's agent stack. Money and access changes are deterministic workflow tools. The prototype stays rules only and is the specification (SPEC section 21). | 10 Oct |
| D17 | In production, refunds, recovery links and renewal links use Razorpay's existing tools and agents. Blindspot keeps detection, widening, attribution, the customer conversation and the access fix. The built demo keeps the flows it has. | 10 Oct |
| D18 | Staffing is man-hours from existing teams, not a new team: about 26 person-months in year 1 and 12 a year after, at ISB AI PM and full-stack builder pay. | 10 Oct |
| D19 | A 6-month pilot (about ₹0.8 cr) comes first. Two failed gates at month 6 means Watch only, about ₹0.46 cr a year. | 10 Oct |
| D20 | No false urgency. Outgoing messages carry no pressure wording, and a validity line ("valid for 48 hours") is allowed only when its number is the link's real expiry. Agent Studio's certification screens for dark patterns, and MediaNama named them as an open concern at launch. Enforced in the policy engine and the eval, not left to template review. | 10 Oct |
| D21 | In production, activation is the first build, and it rides Razorpay's own onboarding: the integration prompt that a merchant pastes into a coding agent carries the fulfilment acknowledgement call, and agent onboarding's website scan supplies the pay-page address for the probe. Not in the frozen base case, which keeps 8% connected. It is the main upside to test in the pilot. | 10 Oct |

---

## 3. The problem

### 3.1 The overarching user problem

When a customer's money and outcome disagree, nobody who can see both sides is looking, and the person who could fix it is a founder with no time.

A customer pays and gets nothing, or tries to pay and cannot reach the payment, or is charged twice. They message the merchant on WhatsApp, email or Instagram, or they message Razorpay. The merchant cannot see Razorpay's records. Razorpay cannot see the merchant's. The customer cannot say what happened. Answers arrive in days, if at all, and the customer leaves.

### 3.2 Where payments break, and who can see it

| Zone | What breaks | Razorpay sees | Merchant sees | Customer sees |
|---|---|---|---|---|
| Before Razorpay | Pay page returns 404, app crashes, checkout will not open (wrong key, domain, SDK) | Barely. Orders are created, some never get a payment attempt. | Its own side only | The symptom |
| Inside the payment | Bank or UPI failure, downtime | Fully | Nothing | The symptom |
| After the payment | Webhook fails, handler fails, duplicate capture, renewal paid but access cut, refund not received | Partly (delivery, not what the merchant did with it) | Its own side only | The symptom |

RAY, Vulcan and the downtime board already work on the middle row. Blindspot works on the first and third rows.

### 3.3 Evidence

- Anchor quotes from real founders (links in v1 section 4.2): "the only reason we even notice is because someone opens a support ticket days later"; "users were paying for orders, but the database wasn't reflecting them"; "Razorpay just fires a webhook and that's it? no retry, no automatic message to the customer". [dossier]
- Razorpay's own docs list "payment captured but not updated" as a known WooCommerce issue, and its plugin repo has a public issue where a checkout error was shown although the payment went through. [docs, search results]
- Founders report that Razorpay support is slow, and that customers are lost while they wait. Of 37 sampled @RazorpayCare replies, 32 ask the person to DM an identifier. [dossier, persona research]
- Only 15 of 289 merchant-voice Reddit posts are about silent breakage. The pattern recurs, but it is not the most-discussed theme, so the size argument rests on Razorpay's own data, not post counts. [dossier]
- Test-mode observation: after my test payment attempt, the customer's screen turned into a raw JSON error page with no way to ask for help, while the merchant dashboard showed only an unpaid payment in "Created". [dash]

### 3.4 What founders do today

Export captured payments, export the users table, compare in a spreadsheet at 1 am, hand-write a script to backfill, then message customers one by one. Support requests to Razorpay go through Help, then Technical Support, and wait.

---

## 4. What exists and where the white space is

### 4.1 Verified facts about Razorpay's current product

| Fact | Source |
|---|---|
| The webhook setup form has one optional "Alert Email" field for failures. | [dash] |
| Razorpay rejects a webhook URL whose host does not resolve, at save time. | [dash] |
| The webhook event list covers payment, order, refund, subscription, settlement, payment link, invoice, account, fund account, engage, **agent_studio.execution.\*** and **payment.downtime.\***. It has no event for webhook health and none for an order being created or attempted. | [dash] |
| Orders show Created, Attempted or Paid, with an Attempts count. A payment has a timeline (created, authorized) and shows the bank RRN, but nothing about webhook delivery. | [dash] |
| An "Ecosystem Health" board shows live bank, card network and UPI-app downtime. | [dash] |
| Payment Links promote "retry failed payments" and "email abandoned cart customers", and have Reminders and Receipts features. | [dash] |
| Webhooks retry with exponential backoff for 24 hours, then the webhook is disabled. Not reproduced in test mode: see the next rows. | [docs] |
| Replay is a support request (Help, Technical Support). It is allowed only if the webhook was enabled when the event happened, the event is under 15 days old, and it is a single event. Bulk replay is not possible. | [docs] |
| The docs say a webhook log history exists in the dashboard. After 6 failed deliveries per event (all answered 401), the webhook list and the webhook details panel showed only settings: URL, "Enabled", events, alert email. No failure count, no delivery log, no warning. If a log exists, it is not on those two screens. About 26.5 hours after the first failure (9:12 PM IST, 7 Oct) the webhook was still "Enabled" with no banner, no warning and no failure count on either screen, and no alert email was set. Whether a real-mode account or a delivery email behaves differently is not known. | [docs] vs [dash 6 Oct and 7 Oct, one real test payment] |
| Real delivery behaviour (test mode, Supabase receiver answering 401): each payment sent two events (`payment.captured` and `order.paid`). A failing event was retried 15 times in all, with each gap about double the last: attempts at 0, 9, 24, 45, 88 and 169 seconds, then 5, 9, 18, 36 and 77 minutes, then 1.4, 2.9, 5.7 and 11.4 hours. The last attempt came 22.8 hours after the first. The next gap would have been about 23 hours, past 24, and no further attempt came. Retries carry the same `x-razorpay-event-id`. User agent `Razorpay-Webhook/v1`. No `x-razorpay-signature` header unless a webhook secret is set. The payload carries the payment, its order, the method and `acquirer_data` (a card payment shows only `auth_code`). | [dash + sink, 6 to 7 Oct] |
| RAY and Agent Studio do not appear in this test account. They are early access. | [dash] |
| Vulcan covers routing, network-level fraud, cash-on-delivery risk and checkout personalisation. It decides how a payment goes, not what happens afterwards. | [dossier, Razorpay and AWS posts] |
| RAY on the dashboard can take a complaint screenshot, find the failed transaction, say why the bank declined it and suggest a payment link. | [dossier, Razorpay blog 12 Mar 2026] |
| Agent Studio agents are review-first with merchant-set limits and an audit trail, and a merchant can bring their own WhatsApp provider. | [dossier] |

### 4.2 Overlap map and our stance

| Existing | Covers | Our relationship |
|---|---|---|
| RAY | Merchant Q and A, failed-payment links, settlement nudges, conversion diagnostics | Front door. RAY sends our alerts and collects approvals. |
| Agent Studio | About 17 agents for recovery, mandates, disputes, cart, KYC, settlement | We ship as one agent inside it, using its guardrails, audit and `agent_studio.execution.*` events. |
| Dashboard | Payments, orders, downtime board, webhook setup | We add an incident view and a "what your system did" lane on the payment timeline. |
| Vulcan | Pre-payment decisions | No overlap now. Later, an expected-volume baseline per merchant cohort (internal ask). |
| Payment Links, Subscription Recovery, IRP | Retries and recovery of failed payments and renewals | Reuse for our recovery step. We never rebuild retries. |
| Ecosystem Health and downtime events | Bank-side outages | Used as attribution evidence. |
| Meta Business AI (WhatsApp Business app, India, May 2026) | General customer questions, leads, appointments | It may answer a "paisa kat gaya" message with a generic reply and no payment data. We position as the payments specialist and ask for a handover rule. [meta, Meta newsroom] |

### 4.3 The white spaces, ranked

| # | White space | Evidence | Strength |
|---|---|---|---|
| W1 | Post-payment breakage and finding every affected customer | No webhook-health event, one optional alert email, replay by ticket only, single event, never for events sent while the webhook was off | Strong |
| W2 | Talking to the merchant's customer to find the payment | RAY talks to merchants. Razorpay Care does it by hand. No agent does it. | Medium to strong |
| W3 | Cannot-reach-the-page failures | Orders are visible and attempts are counted, but nothing alerts on orders with no attempts or on complaint spikes with no payments. Whether RAY covers this is unchecked. | Medium, inferred |
| W4 | Evidence-ready escalation to Razorpay | Support is a ticket form. Founders report slow replies. | Medium |

---

## 5. Users

| User | Who | Job to be done | Surface |
|---|---|---|---|
| Founder (primary) | Solo or two-person merchant, also support | When money and access disagree, find everyone and fix it in one pass without hours of chasing | RAY on WhatsApp, incident screen |
| Developer | In-house or freelance | Get proof and a fix, not a verdict | Dev handoff page |
| Ops lead | Larger merchant (up to 15 people) | Know cohort size and MRR at risk fast | Incident screen, outreach panel |
| Payer (customer) | Often Tier 2, Hinglish | Know within a minute whether I must do anything | WhatsApp, email, Instagram, help button |
| Razorpay support and grievance | Internal | Get a case with the payment found and evidence attached | Evidence pack, escalation record |

Personas P1 to P6 and their findings stay as in v1 section 5. They are mostly simulated, and only real quotes may appear in the note.

---

## 6. Product definition

### 6.1 Principles

1. **Whose side first.** Every card leads with the owner and the evidence.
2. **Rules detect, AI judges.** Detection, counts, selection and money movement are rules and queries. AI reads messy language and screenshots, reads merchant error text, converses, and drafts.
3. **Silence is evidence, but labelled as inference.** If volume should exist and does not, say so, show the evidence, and never move money on it.
4. **Start with zero permission.** Each extra access has to save visible work.
5. **Private first.** Identifiers are looked up wherever they arrive. Nothing about a person is linked or disclosed in public.
6. **The founder approves what costs money or reverses badly.** Everything else is a dial.
7. **Integrate before building.** If RAY, Payment Links or Ecosystem Health does it, we call it.
8. **Say what is mocked.** Every proposed or simulated capability carries a visible tag.

### 6.2 Core objects

Signal, Complaint (any inbound message), Thread (a conversation on one channel), Case (a complaint matched or not to a payment), Incident (a group of payments or complaints with one cause and one verdict, with a zone), Affected payment (tiered), Verdict, Action, Escalation, Learning event. Definitions are in v1 section 8.1 and extended in the tech spec.

### 6.3 The loop

1. **Listen** on connected channels, Razorpay-owned entry points, pasted or forwarded complaints, and Razorpay data monitors.
2. **Triage.** Is it a payment problem? Which claim? Which language? Drop anything else immediately.
3. **Identify.** If no identifier, the conversation agent asks up to three safe questions on the same channel.
4. **Look up** the payment by exact identifier in that merchant's records.
5. **Join** it with the order, webhook delivery, merchant access state, downtime and merchant events.
6. **Group** complaints and payment signals into one incident. For after-payment failures, widen to silent victims. For before-payment failures, estimate lost orders and list customers who tried and did not pay.
7. **Attribute** the cause to merchant code, merchant setup, Razorpay, bank, customer or unknown, with evidence and confidence, and labelled "inferred" in the before-payment zone.
8. **Resolve** with approval: grant access, hand the developer a page, message customers, send the merchant's own payment link to people who could not pay.
9. **Verify** against the merchant's records and close only when confirmed.
10. **Learn** from outcomes and show the founder what changed.

### 6.4 Failure coverage matrix

| Failure | Zone | How Blindspot detects it | Confidence | Action |
|---|---|---|---|---|
| Pay page 404 or app crash | Before | Complaints with no payment match rise above baseline, orders created fall below the same-hour baseline, optional pay-URL probe fails | Likely (inferred) | Alert developer with evidence, recover customers with the merchant's link after the fix |
| Checkout will not open (wrong key, domain) | Before | Orders created, no attempts, rate far above normal abandonment, plus API error counts [assumption] | Medium to high | Alert developer, same recovery |
| Bank or UPI failure | During | Razorpay data and downtime events | High | Attribute only. RAY and Payment Links recover. |
| Money debited, payment failed or pending | During | Failed or late-authorised payments, bank reversal timeline | High | Reply with the reference and reversal date |
| Paid, webhook failed, no access | After | Webhook health change point, disabled event, access reconciler | High | Hero A: grant, message, verify |
| Paid, webhook fine, handler failed | After | Access state missing after a 2xx | High with access data | Same |
| Charged twice | After | Duplicate captures within seconds, same contact and amount | High | Guardrailed refund to the original method |
| Refund not received | After | Refund record and reference | High | Reply in the right bank reference format |
| Renewal paid but access cut, or Razorpay-side renewal failure | After | Subscription events against access | High | Grace extension, evidence to Razorpay |

### 6.5 Scope tiers

**Must (the demo fails without these)**
- Synthetic world with ground truth for Hero A and Hero B and a noise set
- Webhook health monitor, access reconciler, day-0 scan
- Order-attempt gap monitor and complaint-spike detector (Hero B)
- Silent-victim search with tiers, exclusions and replay eligibility
- Whose-side verdict with evidence
- Conversation agent on the Razorpay-owned help entry point and a dedicated payments WhatsApp number (simulated), with window and policy checks
- Email intake (reply-to, alias, keyword rule) (simulated inbox)
- Fix flow: dry run, first 5, rest, verify, close. Dev handoff page. Message preview.
- Autonomy dial, audit log, consent and permissions screen
- Eval harness and a "How we know" page with a rule-versus-agent comparison

**Should**
- Investigation agent over typed tools, with rule fallback (cut from the competition build 10 Oct 2026: BUILD_PLAN section 14)
- Escalation to Razorpay with an evidence pack
- Duplicate-charge incident, Razorpay-side renewal incident
- Instagram and Messenger handover (simulated), public mention handoff (simulated)
- Learning loop and "what I learned this week" card
- Pay-URL probe

**Could**
- Real Razorpay test-mode payments and real webhook deliveries
- One real WhatsApp conversation through Meta's developer test number [verify]
- Real inbound email forwarding to a controlled domain

**Won't (v1)**
- Failed-payment retries, fraud, routing, disputes, settlement explainers (covered elsewhere)
- Matching public posts to payment records without a private opt-in
- Reading a merchant's whole mailbox through OAuth (Google restricted scope)
- Revoking access, applying code, refunds to any destination but the original
- Cross-merchant learning (roadmap, needs its own legal basis)

---

## 7. Channels and intake

### 7.1 The lanes

| Lane | What it is | Merchant setup | Payment ID attached? |
|---|---|---|---|
| 1. Razorpay-owned entry points | A "Need help with this payment?" button on checkout error and timeout states, payment link pages and receipts, plus a reply-to inbox on receipt emails | None | Yes |
| 2. Dedicated payments WhatsApp number | A number for payment questions, onboarded through Meta's Embedded Signup with Razorpay as partner. Merchant owns it and can revoke. | One consent flow | No, collected in chat |
| 3. Merchant email | Keyword forwarding rule from support@, a separate payments@ alias, plus a reply-to on receipts | One rule or alias, optional DNS records for authenticated replies | Sometimes |
| 4. Instagram and Messenger | The merchant's main inbox or Meta's agent hands payment threads to us and takes them back | Meta connection with app review | No |
| 5. Public mentions | A reply invites the person to continue privately | None | Only if volunteered |
| 0. Forward or paste | The founder forwards a message to RAY or pastes it | None | Sometimes |

### 7.2 Channel constraints (all [meta] or Google docs unless marked)

| Channel | Constraint that shapes the design |
|---|---|
| WhatsApp partner access | Requires Razorpay to be a Meta Tech Provider with advanced access to `whatsapp_business_management` and `whatsapp_business_messaging`. Default onboarding limit is 10 new merchants per rolling 7 days, and above 200 per week needs Meta Business Partner status. |
| WhatsApp coexistence | A merchant can keep the WhatsApp Business app and also connect the API on the same number (app version 2.24.17 or newer). History syncs up to 180 days, and app messages are echoed to us. It exposes every chat on that number, so we prefer a dedicated payments number. |
| WhatsApp reply window | Free-form replies within 24 hours of the customer's message. After that, approved templates only. |
| WhatsApp pricing | From 1 Oct 2026, service messages are charged per message. Third-party sources give about ₹0.115 to ₹0.145 per message in India with 1,000 free per number per month. A complaint of about 8 messages costs about ₹1. [verify rates] |
| Instagram and Messenger | Professional account, `instagram_manage_messages` and related permissions, Advanced Access before use with the public, 24-hour window, 7-day Human Agent tag, Handover Protocol (pass, take and release thread control) |
| Automated chats | Meta's docs require disclosure that a person is talking to an automated service "when required by applicable law". We disclose always. |
| Gmail | Filter-based forwarding needs a verified forwarding address. Reading mail through the API (`gmail.readonly`) is a restricted scope needing verification and an annual third-party security assessment. We avoid it. |

### 7.3 Permission ladder for a connection

| Step | Merchant action | We can read | Who sends replies |
|---|---|---|---|
| 0 | Forward or paste | Only what is forwarded | Founder, with a prefilled WhatsApp link or copy |
| 1 | Add an alias or forwarding rule | Only mail the rule forwards | Founder approves each reply |
| 2 | Connect a channel through a consent screen | Only payment-related messages on that channel | Agent drafts, founder approves, except safe identification messages |
| 3 | Turn on assisted replies | Same | Agent replies within the autonomy dial |

### 7.4 Consent and data handling

- A plain-language consent screen, in the style of Agent Studio's review step: what we read, what we can do, where approval is needed.
- Only messages that look payment-related are processed. Everything else is dropped at once and not stored.
- Identifiers are tokenised before any model reads them. Retention has a limit and a one-click disconnect.
- Anyone who says no is suppressed for good.
- Data roles: merchant data (Razorpay as processor) and Razorpay data (Razorpay as fiduciary). A contact made through a Razorpay-owned entry point may start Razorpay's grievance clock. This is an open compliance question. [verify]

### 7.5 Public posts

- A post that carries an identifier can be looked up in that merchant's records, as Razorpay Care does today.
- The public reply says nothing specific. It invites the person to continue on a private channel.
- No amounts, names or statuses in public. No fuzzy guessing of who wrote a post.
- The handle is linked to a payment only after the person replies privately, and that reply is the opt-in.
- Live listening uses licensed APIs only. The prototype uses synthetic posts and labelled real anchor posts as fixtures.

---

## 8. The conversation agent

### 8.1 Rules

1. First message discloses: "I'm [Merchant]'s payment help assistant, powered by Razorpay. I'm an AI."
2. Mirrors the customer's language (English, Hinglish, Hindi).
3. Asks at most three questions, in this order: UPI reference or payment ID, then time, amount and app or method, then a screenshot.
4. Never asks for an OTP, PIN, CVV, full card number, a payment to verify, an app install or a call.
5. Looks up only by exact identifier. A fuzzy match is shown to the founder as a suggestion, never used to act or disclose.
6. Quotes numbers only from records, through templates. The bank reference is given in the format the customer's bank asks for (UPI 12 digits, card ARN 23 digits).
7. Hands over to the founder for money, access decisions, abuse, chargeback or legal threats, prompt-injection attempts, or after three failed identification attempts.
8. Respects channel windows and templates, and the suppression list.

### 8.2 Example, WhatsApp, payments number

> Customer: paisa kat gaya premium nahi mila
> Agent: Hi, I'm Kaksha's payment help assistant, powered by Razorpay. I'm an AI. Sorry about this. Please send the 12-digit UPI ref from your bank or UPI app. I'll never ask for your OTP or PIN.
> Customer: 424712347862
> Agent: Found it. Your ₹599 payment on 29 Sep was received. Your Test Series was not switched on because of a problem on Kaksha's side. It affects other students too and the team is fixing it today. I'll message you here as soon as it's active. UPI ref: 424712347862.

The founder sees the same thread, the incident it joined, and one button to approve the fix.

### 8.3 Example, public mention to private

> Public post tagging Kaksha: "paid 599 yesterday, nothing. UTR 424712347862"
> Public reply: "Sorry about this. We can help. Please message our payment help here: [link]. We never ask for OTP or PIN."
> The person messages on the dedicated number. The conversation continues as in 8.2, and only now is the handle linked to the payment.

---

## 9. Journeys

| ID | Journey | Steps (short) | Release |
|---|---|---|---|
| J1 | **Hero A.** Paid, no access (signal first) | Deploy breaks the webhook. Monitor fires about 30 minutes later. RAY alerts the developer first. Friday, one complaint arrives. Case attaches to the incident. Founder reviews list. Fix in stages. Verify. Close. | R1 to R3 |
| J2 | **Hero B.** Cannot reach the pay page | Complaints cluster across channels with no matching payments. Orders created drop. Probe fails. Blindspot raises an inferred incident, alerts the developer. After the fix, offers the merchant's own link to customers who could not pay. | R4 |
| J3 | Customer help from a Razorpay-owned entry point | Payment fails or the customer dismisses checkout. Taps "Need help". Agent has the payment ID, finds the cause, replies in under a minute. | R3 |
| J4 | Customer on the dedicated WhatsApp number | See 8.2 | R3 |
| J5 | Email complaint | Keyword rule forwards mail. Agent triages, replies in thread through the merchant's authenticated domain with founder approval. | R3 |
| J6 | Instagram DM handover | Merchant's inbox passes a payment thread. Agent resolves and releases it back. | R5 |
| J7 | Public mention to private | See 8.3 | R5 |
| J8 | Escalation to Razorpay | Cause is Razorpay-side. Agent files an evidence pack with payment IDs, error buckets and reference, and tracks the ticket. | R4 |
| J9 | Day-0 scan | On first connect, "I found 11 customers in the last 30 days who paid and have no access". | R1 |
| J10 | Duplicate charge | 15 pairs within seconds. Guardrailed refund to the original method, one row at a time. | R4 |

---

## 10. Features

IDs are used in the build plan. Release codes are defined in `Blindspot_v2_Build_Plan.md`. Acceptance criteria for each live in the tech spec.

| ID | Feature | Priority | Release |
|---|---|---|---|
| F-01 | Webhook health monitor (change point, disabled event) | M | R1 |
| F-02 | Access reconciler (payment against access state) | M | R1 |
| F-03 | Duplicate capture monitor | S | R4 |
| F-04 | Order-attempt gap monitor | M | R4 |
| F-05 | Complaint-spike detector with unmatched share | M | R4 |
| F-06 | Pay-URL probe | S | R4 |
| F-07 | Day-0 scan | M | R1 |
| F-08 | Razorpay-side renewal anomaly | S | R5 |
| F-10 | Channel adapter framework with window and policy engine | M | R3 |
| F-11 | Razorpay-owned help entry points (checkout, link page, receipt, reply-to) | M | R3 |
| F-12 | Dedicated payments WhatsApp number (simulated, optional real test) | M | R3 |
| F-13 | Email intake: reply-to, alias, keyword rule, authenticated replies | M | R3 |
| F-14 | Instagram and Messenger handover (simulated) | S | R5 |
| F-15 | Public mention to private handoff (simulated) | S | R5 |
| F-16 | Forward, paste and CSV intake | M | R1 |
| F-17 | Channels and permissions screen (consent, scopes, disconnect) | M | R3 |
| F-20 | Triage and extraction (text, screenshot, Hinglish) | M | R3 |
| F-21 | Conversation agent (state machine, three questions, safety) | M | R3 |
| F-22 | Exact-identifier lookup, fuzzy as suggestion only | M | R3 |
| F-23 | Case view: customer says, Razorpay says, merchant says | M | R3 |
| F-24 | Reply drafting and sending with window and policy checks | M | R3 |
| F-25 | Escalation to founder with a one-screen brief | M | R3 |
| F-26 | Escalation to Razorpay with evidence pack | S | R4 |
| F-30 | Signatures, grouping, lift, event join | M | R1 |
| F-31 | Investigation agent over typed tools, with rule fallback | S | Cut from the competition build (no model, T1). Revisit after the pilot |
| F-32 | Attribution table with evidence, including inferred rows | M | R1, R4 |
| F-33 | Silent-victim search with tiers and exclusions | M | R1 |
| F-34 | Replay eligibility per affected event | M | R2 |
| F-35 | Fix: grant via the merchant's hook, staged | M | R2 |
| F-36 | Developer handoff page | M | R2 |
| F-37 | Message preview, templates, co-branded voice | M | R2 |
| F-38 | Recovery link for customers who could not pay | S | R4 |
| F-39 | Guardrailed duplicate refund | S | R4 |
| F-40 | Verify and close | M | R2 |
| F-50 | Autonomy dial and permission ladder | M | R2 |
| F-51 | Audit log | M | R2 |
| F-52 | Learning loop and "what I learned" card | S | R5 |
| F-53 | Eval harness and "How we know" page | M | R1 onward |
| F-54 | Redaction, retention, suppression | M | R3 |
| F-55 | No-false-urgency check on every outgoing message (D20) | S | R4 rest, built 10 Oct |
| F-60 | RAY phone card (simulated) | M | R1 |
| F-61 | Incident inbox and incident detail | M | R1 |
| F-70 | Real Razorpay test-mode rails | C | R6 |
| F-71 | One real WhatsApp conversation | C | R6 |
| F-80 | Price card before connecting, fee preview before approving a fix, receipt after, monthly value ledger (BUSINESS_CASE 5.2) | P | Pilot |
| F-81 | Guard test ping: a signed test event sent to the merchant's webhook endpoint that checks the handler answers, accepts it and sends a fulfilment acknowledgement | P | Pilot. Prototype built 10 Oct as the Release check screen (merchant simulated) |
| F-82 | Guard pre-deploy check a merchant can call before a release: the test ping and a pay-page check (opens, and checkout opens) in one call that returns safe or hold | P | Pilot. Prototype built 10 Oct, same screen and `GET /api/guard/release-check` |
| F-83 | Connect by prompt: the text a merchant pastes into a coding agent to wire the webhook and the fulfilment acknowledgement, checked afterwards by the release check | M | Built 10 Oct as the `/connect` page (proposal, no real endpoint) |

Priority P means pilot build after submission (BUSINESS_CASE section 8). The prototype has F-81 and F-82 as one screen against a simulated merchant, and none of F-80. Guard has no edge over do-it-yourself tooling without F-81 and F-82, so they come first in the pilot (BUILD_PLAN section 13). Not in the prototype: a check against a real merchant endpoint, a trigger from a real release pipeline, and the check on event types other than a payment capture.

---

## 11. Autonomy and guardrails

| Setting | Customer conversations | Payments and access |
|---|---|---|
| **Suggest** (default) | Agent runs identification questions and acknowledgements alone. Status and fix replies are drafted for the founder to send with one tap. | Every action needs approval. |
| **Assist** | Factual status replies from records go out alone. Bulk messages need approval. | Access grants need one approval per incident. |
| **Autopilot, reversible only** | Status replies and incident messages go out within limits. | Access grants to the Exact tier within a cap run alone and are undoable. Refunds, recovery links and bulk outreach still ask. |

Never available at any setting: revoke access, refund to anywhere but the original method, change Razorpay settings, write to the merchant's database, apply code, message someone who opted out.

Other guardrails inherited from v1 section 12: staged execution (dry run, first 5, rest), idempotency keys, caps, per-row refund approval on the web only, number-from-tool only, prompt-injection controls, "Mock" and "Proposed API" tags.

New guardrails: window and template enforcement per channel, disclosure on first message, suppression, retention and disconnect, "inferred" labelling that blocks money movement, holdout only on outreach and never on fixes, and no pressure wording or invented expiry on any outgoing message (D20).

---

## 12. Experience and design language

**Interface system.** Razorpay's Blade components and tokens with RazorSense, in the `razorsense-starter` repo (`@razorpay/blade` 12.127.0, React 18, Vite). Before using a component not yet used in the repo, read its docs through the Blade MCP server.

**Colour and state rules (from the starter's design guide).**
- Blue only on things the person does (Approve, Send).
- Green only for the agent and its thinking.
- Calm: scanning, all clear. Caution: open merchant-side incident, a warm tint. Regret: only when the cause is Razorpay's, to own it. Joyful: incident verified and closed, with the single RazorSense surface of the product.
- Amounts as ₹ with Indian grouping. Numbers first. Sentence case. Errors name the cause and the next step.
- Respect reduced motion. Static fallback behind every RazorSense surface.

**Screens** (full list and routes in the tech spec): RAY phone card, incident inbox, incident detail, case and thread view, fix stepper, message preview, developer handoff, verify, audit, "How we know it works", settings and autonomy, channels and permissions, customer help entry (checkout error, link page), customer chat (WhatsApp simulation), email thread, Instagram handover simulation, day-0 scan, learning card. Demo-critical screens are marked there.

**Copy rules.** Inherit the never-say and never-ask lists from v1 section 17.7. Add: never say "Razorpay" is the sender of a message that is merchant-branded. Co-branded messages say "powered by Razorpay". No links in silent-victim messages. Always "We never ask for your OTP or PIN."

---

## 13. Metrics and learning

**North star.** Rupees made whole (customers who paid and now have what they paid for) plus rupees recovered (customers who could not pay and then paid), per incident, with founder minutes per incident at 10 or fewer.

| Layer | Metric | Prototype target |
|---|---|---|
| Speed | Alert latency from onset (Hero A) | Within 2 buckets of true onset |
| Speed | Median time to first useful customer reply | Under 60 seconds |
| Reach | Silent victims fixed per incident, silent to complained ratio | Reported. Kill if below 2. |
| Identification | Share of cooperative simulated customers resolved within 3 questions | 85 percent or more |
| Quality | Silent-victim precision, Exact tier | 0.98 or more |
| Quality | Never-ask violations and wrong refunds | 0 |
| Quality | False alerts per merchant per month (Zone 1 negatives) | At most 1 |
| Outcome | Recovered revenue against a 10 percent outreach holdout | Reported |
| Cost | Cost per resolved case in ₹ (model plus messages) | Reported |
| Learning | False-alert rate over simulated weeks, edit rate on drafted replies | Falling |

**How the system learns.** It records feedback events: the founder marks a verdict wrong, edits or sends a draft, a customer replies or goes silent, a recovery link is paid. A nightly job updates per-merchant baselines, alert thresholds and template choices within bounds. Every change is versioned with a reason, and the founder sees a weekly card: "this week I learned...". This is tuning, not model retraining, and the note says so.

**Measured on 10 Oct 2026** (`eval/founder_effort.py`, `eval/conversation.py`, shown on "How we know"): founder time for the typical incident 4 minutes against the target of 10, counted as approvals from the engine's own plans at 30 seconds each, which is an assumption and not a timing; the longest, INC-2, is 10.5 minutes because each refund is approved one customer at a time on purpose. Cost per resolved case ₹0.07 in messages, with no model (the business case sizes a model at about ₹2.79). Engine time to first reply under a millisecond median, without network or model.

**Three-way evaluation.** Fixed rules only, the agent, and a no-signal case where the agent only ties the rules. The agent's wins are in messy language, free-text server errors and unseen causes. It ties on a plain 5xx after a deploy. The page shows both.

---

## 14. Business case for Razorpay

1. **Merchant retention.** Switching follows unexplained failures and support loops. A merchant whose problem was found and fixed has a reason to stay.
2. **Support and grievance deflection.** The sampled Care replies show most contacts only ask for an identifier. An agent that finds the payment from the first message removes that round trip.
3. **Chargebacks and refunds avoided**, and captured revenue kept.
4. **Payer trust in the Razorpay name**, which appears on the bank SMS and gets blamed for the merchant's bug.
5. **Parity and lead.** Cashfree has batch webhook resend and Cashfree Relay is live. This closes the gap and goes further.
6. **Monetisation.** Priced in `docs/BUSINESS_CASE.md`: Watch free, Fix at 1% of value restored, Guard from ₹999 a month, all billed through Razorpay's existing rails. Direct revenue at the frozen base is ₹1.09 cr a year against ₹0.86 cr to run, so this is an option on trust, not a profit line.

Sizing is the formula in v1 section 21.2 with every input a placeholder for Razorpay's data. The one query that sizes it: what share of captured payments for digital-access merchants have a failed or late webhook? The five queries that replace the unsourced inputs are listed in BUSINESS_CASE section 8.

**Frozen numbers** (BUSINESS_CASE section 2, regenerated by `docs/business_model.py`):

| | Base |
|---|---|
| Cohort (custom-webhook merchants, assumed) | 500,000 |
| Connected by year 3 | 8%, 40,000 |
| Guard uptake | 6% of connected mid and large merchants |
| Steady net, direct revenue only | +₹0.23 cr a year |
| Three-year total, direct only | -₹1.09 cr |
| Three-year total with ₹50 avoided cost per detected incident | +₹0.28 cr |
| Break-even | 6.1% connected, or 4.5% Guard uptake |

Scenarios (Cautious, Stretch, Downside), the sensitivity tables and the pilot gates are in the same file. Tokens are about 3 percent of cost, so model choice is not a business question. What Razorpay's own people have said (digest `docs/INTERVIEWS.md`, full transcripts `docs/RAZORPAY_TRANSCRIPTS.md`) is the evidence behind D15 to D18.

---

## 15. Platform asks (shown as "Proposed" in the product)

1. A webhook-health event, and an alert to a named technical contact on WhatsApp, not only an optional email.
2. A per-endpoint delivery log API with response code and body excerpt (the dashboard already has a log view [docs]).
3. Bulk, self-serve replay, including events sent while the webhook was off.
4. Order lifecycle events: created, attempted, abandoned.
5. Checkout failure telemetry per merchant (init errors, load failures).
6. A "Need help with this payment?" call to action on checkout error states, payment link pages and receipts, with payment context, and a reply-to inbox on receipts.
7. Meta Tech Provider onboarding for a merchant's payments number inside the dashboard, with a coexistence option.
8. An Agent Studio connector type for a merchant access-state endpoint, and one for conversations.
9. Payment search by RRN or UTR for an authorised agent.
10. A handover contract between Meta Business AI and a payments agent.
11. Integration metadata (plugin or SDK version) per payment.
12. Vulcan expected-volume baselines per cohort, internal and later.

---

## 16. Risks, kill criteria, open questions

### 16.1 Risks

| Risk | Severity | Mitigation |
|---|---|---|
| "RAY already does this" in the first 15 seconds | Critical | One-line pitch names the three zones. Overlap table in the note. Check kill criterion K2 early. |
| Breadth looks like "does everything" | High | Two heroes only in the video. Everything else in the note. Cut order in the build plan. |
| Looks like a chatbot | High | Goal-bound resolver with typed tools, ending in a fix. Show the thread beside the incident it joined. |
| Zone 1 inference is wrong | High | Always labelled inferred, with evidence, no money movement, and a negative-scenario test. |
| Numbers look invented | High | Ground truth, seeded generator, eval printout, "How we know" page |
| Meta, Google or Indian rules block a channel design | Medium | Prototype simulates. Verify list below. Fallback is forward and paste. |
| Meta Business AI answers first with a generic reply | Medium | Position as the payments specialist and ask for a handover rule |
| Co-branded intake creates dual obligations | Medium | Compliance question raised in the note, not claimed solved |
| Message cost surprises | Low | Cost per resolved case reported, about ₹1 per complaint on the cited rates |
| Adoption is slower than the base case (only 3 to 4 percent connect) | High | Pilot gates G-P1 and G-P2. Watch-only fallback costs about ₹0.46 cr a year. Ask whether Watch is default-on or gated. |
| Guard does not sell (it costs 40 to 56 percent of the value it restores) | High | Sell prevention and the monthly report, not restored rupees. Annual plan. Test ₹499 for mid-size merchants. |
| The indirect benefit (tickets, disputes, merchants kept) is not proven | High | Pull the five queries in BUSINESS_CASE section 8 in the first two weeks. |
| It duplicates what Agent Studio and the dashboard already do (refunds, cart recovery, renewals) | Medium | Hand off to those tools in production. Keep detection, widening, attribution, conversation and the access fix. |
| Charging for a gap in Razorpay's own tooling hurts NPS | Medium | Watch is free. Free when the fault is Razorpay's. Fix can go free for ₹0.16 cr a year. |

### 16.2 Kill criteria

| # | Drop or reshape if |
|---|---|
| K1 | The silent to complained ratio is under about 2 in a realistic simulated cohort |
| K2 | RAY or the agentic dashboard already lists all affected payments for an integration failure (check early) |
| K3 | Three of five real founders say they would not forward or connect, or already run a reconciliation job |
| K4 | Fewer than 60 percent of cooperative simulated customers are identified within 3 questions |
| K5 | Delivery logs cannot separate a merchant-side failure from a Razorpay-side one |
| K6 | The Zone 1 inference has precision under 0.8 or more than one false alarm per merchant-month on negative scenarios. Then Hero B moves to the roadmap with the evidence. |
| K7 | At month 6 of the pilot, fewer than 6 percent of alerted merchants have connected, or fewer than 4.5 percent of eligible merchants buy Guard. Then the paid layer stops and Watch stays (BUSINESS_CASE section 8). |
| K8 | Razorpay's webhook logs show fewer than 0.2 qualifying incidents per cohort merchant a year, or avoided cost per detected incident is clearly under ₹50. Then the base case does not hold and the case is reopened. |

### 16.3 Verify before it appears in the note or video

1. Whether a delivery log exists anywhere in the dashboard. Not found on the webhook list or details panel after failures (6 Oct), and still none after the 24-hour mark (7 Oct, 9:12 PM IST). Razorpay did not disable the webhook: retries stopped after the 15th attempt at 22.8 hours and the webhook stayed "Enabled", with no banner or warning on the dashboard. Still unchecked: whether any email reached the account's inbox, and whether a live-mode account disables it. Until then the note and video must not say the webhook "is disabled after 24 hours" as something we saw.
2. Meta's current WhatsApp rate table, the free allowance, and coexistence eligibility for Indian numbers.
3. Whether RAY on WhatsApp accepts a forwarded screenshot.
4. Whether Razorpay is already a Meta Tech Provider, and how RAY's number is set up.
5. Whether Gmail send permission is sensitive or restricted, and Outlook's forwarding rules.
6. Indian rules on disclosing an AI assistant and on automated messages.
7. Whether Meta Business AI can hand a thread to another agent.
8. The Razorpay grievance clock for contacts made through a co-branded entry point.
9. RBI reversal timelines per method before dates appear in templates.

### 16.4 Assumptions

A1 Razorpay logs per-attempt webhook outcomes internally (the dashboard shows a log view). A2 Merchants will give a CSV or a read-only access endpoint. A3 Razorpay has checkout telemetry that could be exposed. A4 Razorpay can search payments by RRN or UTR internally. A5 Merchants will accept a dedicated payments number. A6 Customers will answer an AI assistant's three questions.

---

## 17. Submission kit mapping

| Deliverable | Content |
|---|---|
| One-page note (450 to 550 words) | Line: Razorpay's tools fix payments in flight, Blindspot owns before and after. Merchant and problem with three real quotes. What we built. Where AI is and is not. Proof: three eval numbers. What we left out. Platform asks. Compliance paragraph. Overlap table. |
| 90-second video | 0:00 to 0:12 the three-zone problem. 0:12 to 0:40 Hero A, alert first then the complaint, cohort and fix. 0:40 to 1:10 Hero B and the conversation finding the payment. 1:10 to 1:25 verify and the eval numbers. 1:25 to 1:30 close. |
| Working prototype | Public static link from the snapshot build, plus a live local mode |
| AI build log | Daily entries from `docs/BUILD_LOG.md`: prompts, what was rejected and why, bugs found by eval, metrics |
| Business case (backup for questions, not in the note) | `docs/BUSINESS_CASE.md`, with answers to likely questions in `docs/SUBMISSION.md` section 5 |

---

## 18. Roadmap beyond v1

Shadow onboarding for every new merchant, an entitlement connector library (Supabase, Firebase, Django, Laravel, WooCommerce), helpdesk sidebar apps, live replay with Razorpay, grievance matching and routing for Razorpay's own desk, cross-merchant early warning (k-anonymous, 5 or more merchants, never an automatic risk action), Vulcan baselines, live public-mention listening on licensed APIs, a consent bridge, more mismatch types, and a D2C extension. Details are in v1 section 24. **Cut on 10 Oct 2026** (BUILD_PLAN section 14.3): the D2C extension, helpdesk sidebar apps, the consent bridge, live public-mention listening and grievance matching for Razorpay's own desk. Kept for after the pilot: the entitlement connector library (it is the activation path), cross-merchant early warning (needs its own legal basis) and Vulcan baselines (internal).

**Production cuts and order** (from the Razorpay interviews, `docs/INTERVIEWS.md`): in production, refunds, recovery links and renewal links are handed to Razorpay's existing tools and agents, and the investigation agent waits until the pilot shows how many incidents the rules cannot explain. The order is activation first (the fulfilment acknowledgement, plugin signals, event-tool receivers), then Watch, then Fix, then Guard's prevention checks. Pilot and gates: `docs/BUSINESS_CASE.md` section 8.

**Activation rides Razorpay's own onboarding** (D21, from the full transcripts, `docs/INTERVIEWS.md` section 10). Razorpay now onboards by agent (a website scan fills the KYC form, about 3 minutes against 30) and integrates by prompt (a prompt pasted into a coding agent replaces the docs and the code snippet). Both are the cheapest place to attach Blindspot: the prompt can include the fulfilment acknowledgement call, and the scanned website gives the pay-page address the probe needs. A merchant who integrates by prompt has a handler an agent wrote, and coding agents raise how often merchants deploy, which is the input behind the incident rate (our inference from the transcripts, not a Razorpay figure). Neither is in the frozen base case.
