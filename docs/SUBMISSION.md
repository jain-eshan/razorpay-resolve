# Submission kit (R7)

Drafted 7 Oct 2026 from the committed eval and snapshot. Four deliverables: the one-page note (section 1), the 90-second video script (section 2), the working prototype (README), the AI build log (`docs/BUILD_LOG.md`). Section 3 says what is still unverified. Section 4 is what Eshan has to do by hand.

Every number below is read from `eval/` output or `web/public/snapshot/`. Rerun `make eval` and `make snapshot` before recording, and change this file if a number moves.

---

## 1. One-page note

<!-- NOTE START -->
**Blindspot: Razorpay fixes payments in flight. Blindspot owns the time before and after.**

**The merchant.** A small Indian business that grants access by webhook: a test series, a course, a membership. The founder is also support. When a deploy breaks the webhook, customers pay and get nothing. In founders' words: "The webhook fired during a deployment and the entitlement update failed silently" ([r/indiehackersindia](https://www.reddit.com/r/indiehackersindia/comments/1ro44nl)); "the only reason we even notice is because someone opens a support ticket days later" ([r/startups](https://www.reddit.com/r/startups/comments/1qryyp4)); "users were paying for orders, but the database wasn't reflecting them" ([X](https://x.com/Akashdev_k/status/2074800577486405751)). In our test account, six failed deliveries left no trace on the webhook screens.

**What we built.** Four steps, one loop.
- **Detect.** Webhook health, a payments-against-access check, and before payment, a pay-page check plus orders that never get an attempt.
- **Find the payment.** The agent talks to the customer on WhatsApp, email or the help button, says it is an AI, and finds the payment from an exact identifier in three questions or fewer.
- **Say whose side.** Merchant code, Razorpay, the bank or the customer, with evidence. Inferred findings are labelled "Inferred" and never move money.
- **Fix and verify.** One approval: dry run, first 5, the rest. Undo works. The incident closes after 24 healthy hours.

**Where AI is and is not.** The prototype uses no language model. Triage, extraction, detection and attribution are rules and SQL; every number comes from SQL or Python. A model is designed in at three points behind the same interfaces (messy text, free-text server errors, unlisted causes), not built or measured.

**Proof, on a synthetic merchant with hidden ground truth.** 147 eval gates pass.
- Hero A: 85 customers paid and had no access; 17 complained, 68 never did (ratio 4.0, our kill line was 2). The alert fires 55 minutes after the deploy, with one customer affected.
- 40 scripted threads: every cooperative customer identified within three questions, no credential requests, 2 of 2 prompt injections ignored.
- Hero B: the pay-page outage found, 0 false alarms on 5 look-alike days.

The generator and detector share assumptions: this shows the logic works, not how often it fails on real traffic.

**Left out.** Retries, fraud and routing (RAY, Vulcan, Payment Links own them), disputes, settlements, mailbox access, learning across merchants.

**Platform asks.** A webhook-health event with an alert to a named contact; bulk self-serve replay; order created, attempted and abandoned events; a "Need help with this payment?" button on error pages.

**Compliance by design.** It says it is an AI, never asks for card or login details, says nothing about a payment in public, and needs consent per channel. Indian rules on AI disclosure and the grievance clock for co-branded contacts are open questions.

**Overlap.** RAY answers the merchant and recovers a failed payment; we widen one complaint to everyone hit. Agent Studio is where we would live. Vulcan decides how a payment goes; we handle what follows. Payment Links retries; we reuse it. We could not check whether RAY already lists every affected payment: it is not in our test account.

**Learning and what is real.** Founder feedback moves three settings one step a week, each change logged. Only Razorpay's webhook behaviour was observed for real. Merchant data, channels and customers are simulated.
<!-- NOTE END -->

---

## 2. 90-second video script

Record the hosted demo (the guided one). Keep a small caption on screen for the whole video: "Synthetic merchant. Simulated Razorpay data." Two clean takes.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 to 0:10 | The three-zone graphic from PRD 3.2, middle row greyed | "Razorpay sees the payment while it happens. It cannot see what comes before, or what the merchant's system does after." |
| 0:10 to 0:35 | RAY alert on the home page, then the incident page for INC-1 | "Tuesday 29 September, a deploy breaks the webhook. At 3:15 the alert fires, with one customer affected. Without it, the founder finds out days later. By then 85 customers have paid and have no access. 17 complained. 68 never said a word. That is ₹56,319." |
| 0:35 to 0:55 | WhatsApp thread at `/chat-demo` beside the incident it joined | "A customer writes in Hinglish. The assistant says it is an AI, asks for the UPI reference, finds the payment, and joins the complaint to the incident. The founder approves the reply. Nobody asks for a card number or an OTP." |
| 0:55 to 1:15 | INC-4 page: the "Inferred" label, the orders chart, the evidence list | "Here Razorpay saw nothing, because no payment existed. The pay page returned a 404. Blindspot saw the page check fail and 12 customers write in, flagged it five minutes after the page broke, and says plainly that this is inferred. It moves no money." |
| 1:15 to 1:25 | Fix stepper: first 5, the rest, verify, the one RazorSense moment, then `/how` | "One approval fixes 81 customers in stages. After 24 healthy hours: 81 of 81 confirmed active, ₹56,319 restored. Every number here is on the How we know page, checked against hidden ground truth." |
| 1:25 to 1:30 | Title card | "Razorpay owns the payment. Blindspot owns the before and the after." |

Do not say in the video: that a model reads the messages; that the replies take seconds (response time is not measured); anything about RAY's behaviour; the Meta message prices.

---

## 3. Verify list (PRD 16.3) and the three quotes

Status of each item as of 7 Oct 2026, and what the note does about it. None is settled by this session.

| # | Item | Status | What the note does |
|---|---|---|---|
| 1 | Does a delivery log exist anywhere in the dashboard | Not found on the webhook list or details screens after six failures (6 Oct, one test payment). The 24-hour auto-disable was due about 18:41 IST on 7 Oct. At 9:12 PM IST the webhook was still "Enabled" with no banner, warning or log. Razorpay stopped retrying after 15 attempts (the last at 22.8 hours) and did not disable it. | Says only what was seen in our test account in test mode. Do not write that Razorpay disables the webhook after 24 hours as something we saw. Whether an email was sent is unchecked. |
| 2 | Meta's WhatsApp rates and coexistence for India | Not re-checked on the raw page | No rate or eligibility claim |
| 3 | RAY on WhatsApp accepts a forwarded screenshot | Not checkable, RAY is not in the test account | No claim |
| 4 | Razorpay is a Meta Tech Provider, and how RAY's number is set up | Unknown | Not claimed; stays a question to Razorpay |
| 5 | Gmail send permission, Outlook forwarding rules | Not checked | The product reads no mailbox; the note lists "reading a mailbox" as left out |
| 6 | Indian rules on disclosing an AI assistant and on automated messages | Not checked with anyone qualified | Note says disclosure is by design and the rules are an open question |
| 7 | Can Meta Business AI hand a thread to another agent | Unknown | Appears only as a platform ask in PRD 15, not in the note |
| 8 | Razorpay grievance clock for co-branded contacts | Unknown | Named as an open question |
| 9 | RBI reversal timelines before dates appear in templates | The template that would state one (`T-B1`) exists, but no code path sends it, so no date reaches a customer. | No claim. Check the timelines before wiring `T-B1`. |

**The three quotes in the note are checked** against the raw social listening files (`_dossier/SOCIAL_LISTENING/`, `reddit_posts_all.jsonl` and `x_posts_all.jsonl`, scraped 5 Oct 2026): wording matches exactly, and the links are the `url` fields in those files. The live pages were not opened (Reddit and X are blocked in the tool used here), so a post deleted since 5 Oct would not show up. The X post is from 8 Jul 2026 (@Akashdev_k, a freelancer describing a rescue job); the r/indiehackersindia post is from 8 Mar 2026; the r/startups post is the one titled "Anyone else slowly losing money because payments just break sometimes?".

One quote from the research was dropped because it would be used out of context: "Razorpay just fires a webhook and that's it? no retry, no automatic message to the customer" (r/micro_saas). The author is asking about failed UPI AutoPay debits, not a webhook that breaks after a deploy.

Kill criteria: K1 passes on the synthetic world (ratio 4.0). K4 passes on scripted threads that are friendly to the rules (1.0 against a 0.60 line), so it is not settled until real founders show real messages. K6 passes (precision 1.0 against 0.8) with one seed. K2 (does RAY already widen) and K3 (do founders accept it) have no evidence yet.

---

## 4. What Eshan has to do

1. Click the three quote links once to make sure the posts are still up.
2. Check the inbox of the Razorpay test account (including Promotions and Spam) for any "webhook failing" or "webhook disabled" email, and tell the next session. The dashboard check is done (nothing shown), so this is the last part of item 1.
3. Ask Razorpay's contact the K2 question: does RAY or the agentic dashboard list every payment affected by one webhook failure?
4. Record two takes from the script, from the hosted site (https://razorpay-blindspot.vercel.app/), with the caption on.
5. Decide whether the note and the video should mention INC-3 (card renewals that failed on Razorpay's side, with the evidence pack). It is built and in the hosted demo, but the note is at 545 of 550 words and the script does not show it. The same goes for INC-2 (customers charged twice, with the guarded refund) and the INC-3 renewal link, both built since. Only the gate count was kept current (147 on 10 Oct).
6. Run `make eval && make snapshot`, commit if anything moved, and check the hosted link (https://razorpay-blindspot.vercel.app/) in a clean browser window with no server running. The old address, razorsense-starter.vercel.app, no longer answers, so make sure nothing you wrote down still uses it.
7. Remove the test objects (V5) only if you want them gone: the disabled `httpbin` webhook and the ₹10 payment link.

---

## 5. Business case: answers for questions after the video

Not in the note (it is at the word limit). Full numbers and the model: `docs/BUSINESS_CASE.md`. Everything here is a plan on assumptions, not a result: the prototype has no real merchants and no model. Say so first.

| If asked | Answer |
|---|---|
| What does it cost Razorpay? | About ₹0.86 crore a year to run and ₹1.19 crore to build in year 1, with a team of about three working part of the time. That is about 0.07 percent of FY25 gross profit. Model calls are about 3 percent of the cost. |
| What do you charge? | Watch (detection and alerts) is free and part of the 2% fee. Fix is 1% of the value restored, the first incident free, and free when the fault is Razorpay's. Guard is ₹999 or ₹2,999 a month and adds prevention checks and a monthly report. It all goes through Razorpay's existing billing. |
| Is it a profit centre? | No. At the base case direct revenue is about ₹1.1 crore a year against about ₹0.9 crore of cost, and the three-year total is slightly negative. It becomes clearly positive if each detected incident saves Razorpay about ₹50 of support or dispute cost, which Razorpay's own data can confirm. It is a bet on merchant trust. |
| What would make you stop? | A six-month pilot with gates: at least 6 percent of alerted merchants connect and at least 4.5 percent take Guard. If two gates fail, keep only the free detection layer, about ₹0.46 crore a year. |
| Why not charge for tokens or use a bigger model? | Model calls are about 3 percent of cost, and Razorpay already sells outcomes, not model use. |
| Where is the AI? | In the prototype there is no model: rules and SQL decide, and every number comes from SQL or Python. In production a model reads messy messages behind the same function, on Razorpay's own agent stack. Money and access changes stay deterministic, which is the same rule Razorpay applies to money in its own dashboard. |
| Does it overlap with Agent Studio and the dashboard? | Yes, in three places, and we say so. The dashboard already refunds duplicate payments, Cart Recovery handles dropped buyers, and Subscription Recovery handles renewals. In production we hand those off. We keep what none of them does: seeing a failing webhook, widening one complaint to everyone affected, saying whose side the fault is, and finding the payment from the customer's first message. |
| Why would a merchant pay when a developer could build it? | A developer can build a reconciliation script, a Hookdeck relay and an alert for about ₹1.3 to 1.5 lakh in the first year. They cannot see Razorpay's own delivery logs, message the customer, or restore access in stages with undo. |

**Do not say:** that a model reads the messages in the prototype; that merchants have asked for it or will pay (no founder has been asked yet); that Guard will sell (it costs 40 to 56 percent of the value it restores, so it sells on prevention, and uptake is the weakest assumption); any figure for how many Razorpay merchants have webhook failures (not public); any price as Razorpay's (Agent Studio prices are not published).

**Optional sentence for the note**, if one can be cut elsewhere: "Priced as free detection, a 1 percent fee on value restored, and an optional ₹999 a month plan; about ₹0.9 crore a year to run, so a low-cost bet on trust, to be proven in a six-month pilot."
