# Submission kit (v3, draft)

**Status, 13 Oct 2026: draft for Eshan's voice edit. Not final.** Written from PRD v3, the batch 1.1, 1.2 and 1.3 build log entries, the big-brand data files (`web/public/brand/`, written by `synth/brand_world.py`) and the committed eval report. Four deliverables: the one-page note (section 1), the 90-second video (section 2, task S5, Eshan's), the working prototype (README), the AI build log (`docs/AI_BUILD_LOG.md`). Section 3 says what is still unverified. Section 4 is what Eshan has to do by hand. Section 7 says where every number comes from.

No open placeholders: the big-brand line is filled in the note, in appendix 1a and in `docs/AI_BUILD_LOG.md`, from the data file and the built pages (13 Oct, batch 1.3 merged as PR #44). It is still a draft in your voice-edit queue. The `[TO CONFIRM: the session count]` marker in the AI build log is yours.

The brief asks for "one page" and gives no word count. The 450 to 550 word limit is ours (BUILD_PLAN, from the earlier note). The note below is the page. The appendix after it is a longer version for anyone who asks and is not part of the submission.

Rerun `make eval && make snapshot` before recording, and change this file if a number moves.

---

## 1. One-page note

<!-- NOTE START -->
**Blindspot: when a payment breaks around the gateway, find everyone it hit, say whose side it is, and fix it.**

**Problem.** A payment can break before, during or after the gateway, and most customers who fail once leave without complaining. Founders find out late: "the only reason we even notice is because someone opens a support ticket days later" ([r/startups](https://www.reddit.com/r/startups/comments/1qryyp4)). Big brands know in minutes, then wait hours for the gateway's root cause in a shared Slack channel. That loop is from my previous company; I have not checked it with Razorpay or a second brand.

**Solution.** One Agent Studio agent, two ways in: a customer's complaint or a brand's own alert. Both start the same five steps: hear it, find everyone hit including the silent, say whose side with proof, fix with approval, win customers back. The lever is recovered revenue, not success rate, which routing owns.

**Track 2, item by item**
- **Signal.** Payments, orders and webhook logs plus the complaint or alert. For a made-up merchant, 85 customers paid and got no access; 17 complained, 68 never did. The alert fires 55 minutes after the deploy. For a made-up big brand, an app release hit 1,240 customers: alert at 7:52 pm, root cause in Slack at 7:58.
- **Why AI beats a rule.** Rules cover only listed problem types. On 41 made-up messy complaints they read the main issue right 85% of the time, the amount written 54%, and both issues in one message 0% of 5. A model reads those and picks checks for a failure nobody listed. The set is small and made up; no model has run on it.
- **Action and control.** Dry run, first 5, the rest: replay the webhook, grant access, refund a duplicate. Review first by default, with undo. Never revoke access or change Razorpay settings. Refunds go one at a time, ₹5,000 a day, always a person.
- **Learning.** "Useful or not" moves three settings one step a week, logged. In a six-week invented replay, false alerts fell from 6.2 to 3.2.
- **Accuracy, trust, failure.** 147 checks pass against hidden ground truth; generator and detector share assumptions, so this shows logic, not real failure rates. The assistant says it is an AI and never asks for a card number, OTP or password. Unsure cases go to a person. An issue closes only after 24 healthy hours.

**Decisions and cuts.** I took the time before and after a payment because RAY, Vulcan and Payment Links own the payment in flight. A Flipkart developer read v2 as "it finds integration errors", so v3 added the big-brand door. No model runs in the prototype: a live model step meant 8 hours and no eval the day before. Left out: fraud, disputes, settlements, plugin merchants.

**Success metrics.** North star: recovered value, verified and incremental. Leading: minutes to alert (55 in the demo), alerts marked wrong under 1 in 5. Guardrail: zero wrong refunds. Running cost is ₹0.86 cr a year, a bet on retention.

**What is real.** Merchant, customers and numbers are made up. SQL and Python produce every number; the hosted demo replays recorded answers, and the big-brand flow runs on recorded data. The model is the production design.

<!-- NOTE END -->

Word count: `sed -n '/^<!-- NOTE START -->/,/^<!-- NOTE END -->/p' docs/SUBMISSION.md | wc -w`. It counts the two marker lines and five bullet dashes, about 13 words above the real text. With the big-brand line in it reads 546, so the text is about 533. To make room for that line, three things were cut: the per-kind breakdown of the messy-complaint result (it is in appendix 1a, item 2), "pay-again links" from the list of what was left out, and "a six-month pilot has stop gates" (it is in appendix 1a, item 9). Keep the finished note at or under 550 and recount after your edit.

**Wording to check in your own voice.**
- "I have not checked it with Razorpay or a second brand": PRD section 14 lists validating the Slack loop as not done. If you have spoken to someone since, change it.
- "A Flipkart developer read v2 as 'it finds integration errors'": taken from PRD section 9 and the 12 Oct feedback. Confirm you are happy to name Flipkart in the note.
- "Review first by default, with undo": undo exists for access grants and renewals. A refund cannot be undone and the screen says so.

---

## 1a. Appendix: the Track 2 answers in full

Not part of the one-page note. For questions after the video and for the pitch. Where each figure comes from is in section 7.

**1. Signal.** Razorpay already holds payments, orders, webhook deliveries and bank downtime events. The product reads three kinds of signal: payment signals (webhook health, orders created with no attempt, a bank or method dip, paid but not served, duplicates and renewals), the customer's complaint (Hinglish included), and for big brands their own alert. On the made-up merchant Kaksha, INC-1 (a deploy breaks the webhook) hit 85 customers. 17 complained and 68 never did: 4.0 silent customers per complaint, against a kill line of 2. The alert fires 55 minutes after the deploy, with one customer affected. INC-4 (the pay page returns 404, so no payment exists) is found 5 minutes after it breaks, with 0 false alarms on 5 look-alike days.

**2. Why AI beats a rule.** PRD section 11 splits the work three ways. Rules and SQL give counts, rupee totals, thresholds, autonomy limits and refund caps, because those must be exact. Statistics give "normal" by hour and weekday. A language model reads the language, chooses which checks to run on an unfamiliar problem and writes the root cause text around numbers SQL produced. It never produces a number or moves money. Razorpay applies the same rule in its own dashboard agent (`docs/INTERVIEWS.md` section 4).

The measured part is on the Accuracy page. The rules triage was scored on 41 made-up messy complaints, labelled by what each one means:

| Kind of message | Result |
|---|---|
| All 41 | Main issue read right 85% (35 of 41) |
| Plain, 7 | 100% |
| Forwarded, 5 | 100% |
| Hinglish, 11 | 91% |
| Typos, 10 | 50% |
| Two issues in one message, 5 | Main issue right 100%, both issues found 0% (the rules return one reading) |
| Amount the customer wrote, 13 | 54% |
| Payment ID written in the message, 2 | 100% |
| Not about a payment, 5 | 0 flagged as a payment |

Three real misses: "paisa kat gya hai UPI se lekin order confirm nahi aaya" (rules read it as debited, no access; it means debited, no order), "my paymnt got deductd twise for mock test pak Rs 599" (read as debited, no access; it means charged twice), and "I was charged twice AND my premium isn't active. 1299 each time" (read as charged twice only).

Limits, stated plainly. The set is small. The build sessions wrote and labelled it, so it is not real customer text. The first draft had 40 messages and scored 78%. Two messages that two people could read two ways were removed, not relabelled, and three typo messages with none of the rules' keywords were added because the first set under-counted typos. No model has been run on the set, so how much better a model does is not measured. A model-against-rules report is a Phase 2 task (ROADMAP_V3 P2-B4). In the prototype the triage is the rules, and the hosted demo replays their recorded answers.

**3. Action.** Replay failed webhooks, grant access through the merchant's own access call, refund a duplicate payment to the original method, send a renewal link. Staged: dry run, first 5, then the rest. A merchant-side fault gets a developer page with the failing call, sample IDs and a suggested fix, because Blindspot does not edit a merchant's code. Founder effort is estimated at 4.0 minutes for a typical incident and 10.5 for the longest (INC-2, where each refund is approved one at a time on purpose). The 30 seconds per approval is an assumption, not a timing.

**4. What the merchant controls.** Three autonomy levels: Review first (the default), Approve once, Full automation. Staged runs, with undo for access grants. Never available at any level: revoking a customer's access, refunding to a different method, changing Razorpay settings, writing to the merchant's database. Refunds go one customer at a time, capped at ₹5,000 a day, and a person approves each one even on Full automation (0 refunds made by the autonomy setting in the eval). Public replies are held for the founder (0 sent without approval). Customer messages respect each channel's consent and window (0 links sent outside them).

**5. Learning.** Each alert carries "was this a real problem?". Three settings move, one step a week and within fixed bounds: how strict the order-dip alert is, how strict the complaint-spike alert is, and the default message language for customers whose language is unknown. Every change is logged with a reason and a version. On a six-week replay with invented merchant behaviour, false alerts per replay were 6.2 with no loop, 5.0 with the weekly rhythm alone and 3.2 with the loop. Both clear outages were found in every arm. The loop missed the weak outage in 1 of 5 replays (0.2 a replay), the price of stricter alerts. Nothing has learned from a real outcome. Win-back uses a 10% holdout (2 of 24 renewal links held back in the simulation), which is too few to say what a link adds.

**6. Accuracy.** 147 scored checks pass and none fail, against ground truth the product never sees: customers found exactly, owner correct, no grant that was not owed, repeat approvals change nothing, an incident closes only after 24 healthy hours. The synthetic generator and the detector share assumptions. That shows the logic works. It says nothing about how often it fails on real traffic. A pay-page finding is labelled "Inferred" and moves no money or access (0 changes in the eval). On pay-page incidents precision is 1.0 against a bar of 0.80, on one seed.

**7. Permissions and trust.** The assistant says it is an AI and never asks for a card number, OTP, UPI PIN or password (0 violations in the eval). It does not invent a deadline (0 in the eval). Customer IDs are masked in logs, conversation text is deleted after 30 days, and every action is logged with who approved it. The product reads no mailbox. Open questions, not settled: Indian rules on disclosing an AI assistant, and the grievance clock for co-branded contacts.

**8. Failure handling.** "Unknown" is a valid owner. When unsure, the assistant hands the case to a person (1.0 correct in the eval). In the big-brand design a likely root cause waits for a Razorpay support engineer's sign-off before it reaches the brand, and an alert stays "unconfirmed" until matched to Razorpay payment data. Neither is built in the engine (the console is a Won't in Phase 1; the alert endpoint is Phase 2). The demo shows both on recorded data: the alert page, and a Slack thread where the root cause is signed off at 7:59 pm by a scripted approval. An incident never closes on the fix alone. If a model is down in production, the rules answer, as they do in the prototype.

**9. Business outcome.** North star: recovered value, counted only after a check confirms it, net of customers who would have come back anyway. Leading and lagging metrics, guardrails and the metrics dropped as vanity are in PRD section 12. Pilot gates (BUSINESS_CASE section 8): at least 6% of alerted merchants connect, at least 4.5% take Guard, at least 40% of eligible incidents approved for a paid Fix, at least ₹50 of avoided cost per detected incident, fewer than 1 in 5 alerts marked wrong. About 6 months, about 200 opt-in merchants, about ₹0.8 cr. If two gates fail, keep only the free layer, about ₹0.46 cr a year. It costs ₹0.86 cr a year to run and ₹1.19 cr to build in year 1. The three-year total is -₹1.09 cr, or +₹0.28 cr with ₹50 of avoided support cost per detected incident. The case does not include big brands.

**Big-brand flow (batch 1.3, rebuilt in batch 1.5 as a second demo account).** The way in is an account picker (`/signin`): Kaksha, a small business, or Flipkart, a big brand, on the same dashboard; the avatar switches. The brand is Flipkart, in text only: no logo, no look-alike screens, and every screen says the data is made up. Flipkart's account has its own Overview, Payment issues and pages. Its open issue, FK-1, shows where the problem showed up: the customer's phone ("Payment failed" after a UPI payment Razorpay captured, because the app's server never verified it), the Sentry alert (40 events in 10 minutes, sent to Razorpay), and the root cause in the brand's Slack channel with three approvals (refund 410 duplicates, send the 830 order list, message the 830 customers; the message stays disabled until the orders are confirmed). Then the same issue page as every other incident: story strip, evidence lane, "is it just you?" from the app-version lift (every affected payment came from app 8.2), root cause "Your code" with exact confidence, three signals. The data: 1,240 customers paid by UPI from app 8.2 between 7:40 and 7:56 pm; 410 paid twice and 830 have no order; ₹15,69,060 stuck, of which ₹4,97,890 to refund and ₹10,71,170 with no order. Timeline: app 8.2 rolled out 7:40 pm, verify calls stop 7:41, errors from 7:44, alert 7:52, root cause 7:58, sign-off 7:59, rollback 8:01. The alert comes 12 minutes after the rollout and the root cause 6 minutes after the alert. What is simulated: all of it. Python scripts (`synth/j2_brand.py` and `synth/brand_world.py`, fixed seeds) write the data files, every number on every screen is read from it, and an approval changes this browser tab's state only: no refund is made and no message is sent. What is not built: the alert endpoint in the engine (Phase 2), the support engineer console (a Won't in Phase 1), and the root cause as a model-written document. The Slack loop itself, a brand waiting hours for the gateway's root cause, is from Eshan's previous company and unchecked with Razorpay (item 10 in section 3).

**Carried over from the v2 note, still true.**
- *Platform asks.* A webhook-health event with an alert to a named contact; bulk self-serve replay; order created, attempted and abandoned events; a "Need help with this payment?" button on error pages.
- *Overlap.* RAY answers the merchant and recovers a failed payment; we widen one complaint to everyone hit. Agent Studio is where this would live. Vulcan decides how a payment goes; we handle what follows. Payment Links retries; we reuse it. We could not check whether RAY already lists every affected payment, because RAY is not in our test account.
- *Evidence the problem is real.* Three founder quotes, checked against the raw posts (section 3): "The webhook fired during a deployment and the entitlement update failed silently" ([r/indiehackersindia](https://www.reddit.com/r/indiehackersindia/comments/1ro44nl)); "the only reason we even notice is because someone opens a support ticket days later" ([r/startups](https://www.reddit.com/r/startups/comments/1qryyp4)); "users were paying for orders, but the database wasn't reflecting them" ([X](https://x.com/Akashdev_k/status/2074800577486405751)). In our test account, six failed webhook deliveries left no trace on the webhook screens. Only 15 of 289 merchant posts were on this theme, so the size argument rests on Razorpay's data, not post counts.

---

## 2. 90-second video script

**Superseded.** This is the v2 script from 7 Oct. The v3 video (task S5, order in PRD section 8) is yours to write and record. It is kept only for the wording points in section 6, and its numbers match the product once the corrections in section 6 are applied.

Record the hosted demo (the guided one). Keep a small caption on screen for the whole video: "Synthetic merchant. Simulated Razorpay data." Two clean takes.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 to 0:10 | The three-zone graphic from PRD 3.2, middle row greyed | "Razorpay sees the payment while it happens. It cannot see what comes before, or what the merchant's system does after." |
| 0:10 to 0:35 | RAY alert on the home page, then the incident page for INC-1 | "Tuesday 29 September, a deploy breaks the webhook. At 3:15 the alert fires, with one customer affected. Without it, the founder finds out days later. By then 85 customers have paid and have no access. 17 complained. 68 never said a word. That is ₹56,319." |
| 0:35 to 0:55 | WhatsApp thread at `/chat-demo` beside the incident it joined | "A customer writes in Hinglish. The assistant says it is an AI, asks for the UPI reference, finds the payment, and joins the complaint to the incident. The founder approves the reply. Nobody asks for a card number or an OTP." |
| 0:55 to 1:15 | INC-4 page: the "Inferred" label, the orders chart, the evidence list | "Here Razorpay saw nothing, because no payment existed. The pay page returned a 404. Blindspot saw the page check fail and 12 customers write in, flagged it five minutes after the page broke, and says plainly that this is inferred. It moves no money." |
| 1:15 to 1:25 | Fix stepper: first 5, the rest, verify, the one RazorSense moment, then Accuracy (`/how`) | "One approval fixes 81 customers in stages. After 24 healthy hours: 81 of 81 confirmed active, ₹56,319 restored. Every number here is on the How we know page, checked against hidden ground truth." |
| 1:25 to 1:30 | Title card | "Razorpay owns the payment. Blindspot owns the before and the after." |

Do not say in the video: that a model reads the messages; that the replies take seconds (only the engine's own time is measured, under a millisecond, and a model call would add a few seconds); anything about RAY's behaviour; the Meta message prices.

---

## 3. Verify list (PRD 16.3) and the three quotes

Status of each item as of 7 Oct 2026, and what the note does about it. None is settled by this session.

| # | Item | Status | What the note does |
|---|---|---|---|
| 1 | Does a delivery log exist anywhere in the dashboard | Not found on the webhook list or details screens after six failures (6 Oct, one test payment). The 24-hour auto-disable was due about 18:41 IST on 7 Oct. At 9:12 PM IST the webhook was still "Enabled" with no banner, warning or log. Razorpay stopped retrying after 15 attempts (the last at 22.8 hours) and did not disable it. | Says only what was seen in our test account in test mode. Do not write that Razorpay disables the webhook after 24 hours as something we saw. Whether an email was sent is unchecked. |
| 2 | Meta's WhatsApp rates and coexistence for India | Not re-checked on the raw page | No rate or eligibility claim |
| 3 | RAY on WhatsApp accepts a forwarded screenshot | Not checkable, RAY is not in the test account | No claim |
| 4 | Razorpay is a Meta Tech Provider, and how RAY's number is set up | Unknown | Not claimed; stays a question to Razorpay |
| 5 | Gmail send permission, Outlook forwarding rules | Not checked | The product reads no mailbox (appendix 1a, item 7); the note makes no claim |
| 6 | Indian rules on disclosing an AI assistant and on automated messages | Not checked with anyone qualified | Note says the assistant says it is an AI; appendix 1a calls the rules an open question |
| 7 | Can Meta Business AI hand a thread to another agent | Unknown | Appears only as a platform ask in PRD 15, not in the note |
| 8 | Razorpay grievance clock for co-branded contacts | Unknown | Named as an open question in appendix 1a |
| 9 | RBI reversal timelines before dates appear in templates | The template that would state one (`T-B1`) exists, but no code path sends it, so no date reaches a customer. | No claim. Check the timelines before wiring `T-B1`. |
| 10 | Big brands get root causes from people in a shared Slack channel, hours later (v3, 12 Oct) | Only from Eshan's previous company. Not checked with Razorpay or a second brand (PRD section 14). No post or transcript mentions it. | The note says where the loop comes from and that it is unchecked |
| 11 | Razorpay publishes an MCP server for its APIs, and what Agent Studio exposes to third-party agents | Believed true, not confirmed (PRD section 10) | No claim in the note or the appendix |

**The three quotes (one in the note, three in appendix 1a) are checked** against the raw social listening files (`_dossier/SOCIAL_LISTENING/`, `reddit_posts_all.jsonl` and `x_posts_all.jsonl`, scraped 5 Oct 2026): wording matches exactly, and the links are the `url` fields in those files. The live pages were not opened (Reddit and X are blocked in the tool used here), so a post deleted since 5 Oct would not show up. The X post is from 8 Jul 2026 (@Akashdev_k, a freelancer describing a rescue job); the r/indiehackersindia post is from 8 Mar 2026; the r/startups post is the one titled "Anyone else slowly losing money because payments just break sometimes?".

One quote from the research was dropped because it would be used out of context: "Razorpay just fires a webhook and that's it? no retry, no automatic message to the customer" (r/micro_saas). The author is asking about failed UPI AutoPay debits, not a webhook that breaks after a deploy.

Kill criteria: K1 passes on the synthetic world (ratio 4.0). K4 passes on scripted threads that are friendly to the rules (1.0 against a 0.60 line), so it is not settled until real founders show real messages. K6 passes (precision 1.0 against 0.8) with one seed. K2 (does RAY already widen) and K3 (do founders accept it) have no evidence yet.

---

## 4. What Eshan has to do

**Added 13 Oct for the v3 note (S3):**

a. Read the note in section 1 and put it in your own voice. Check the three lines under "Wording to check" first. Recount the words after you edit.
b. Batch 1.3 has merged and the big-brand placeholders are filled (13 Oct), from the data file and the built pages. Read the new line in the note and the "Big-brand flow" block in appendix 1a, and put them in your own voice. If you change the line in the note, recount the words.
c. Run `make eval && make snapshot` and check that 147 pass, 41 reported-only figures and the messy-complaint figures (85%, 41 messages) are unchanged. Section 7 lists every number to recheck.
d. Decide whether to say "Flipkart" in the note. ROADMAP_V3 section 7 settled it as text only, no logo. The note names Flipkart once, as the developer who gave feedback.
e. The PRD's J1 story starts at 6:05 pm, but the product data starts INC-1 at 2:20 pm and alerts at 3:15 pm (`web/public/snapshot/incidents.json`). The note uses only "55 minutes". Fix the PRD doc or the video script so they agree with the data.
f. The PRD (sections 5 F15 and 11) says false alerts "fell from 6.2 to 3.2 a week". The eval says per six-week replay (about 0.73 a week in weeks 1 to 3 and 0.33 in weeks 4 to 6). The note uses the per-replay figure. The PRD needs the same fix.

**Still open from before:**

1. Click the three quote links once to make sure the posts are still up.
2. Check the inbox of the Razorpay test account (including Promotions and Spam) for any "webhook failing" or "webhook disabled" email, and tell the next session. The dashboard check is done (nothing shown), so this is the last part of item 1.
3. Ask Razorpay's contact the K2 question: does RAY or the agentic dashboard list every payment affected by one webhook failure?
4. Record two takes from the script, from the hosted site (https://razorpay-blindspot.vercel.app/), with the caption on.
5. Decide whether the video should show INC-3 (card renewals that failed on Razorpay's side, with the evidence pack), INC-2 (customers charged twice, with the guarded refund) and the INC-3 renewal link. All three are built and in the hosted demo. The v3 note has no room for them and mentions none by name.
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
| Where is the AI? | In the prototype there is no model: rules and SQL decide, and every number comes from SQL or Python. In production a model reads messy messages behind the same function, on Razorpay's own agent stack. Money and access changes stay deterministic, which is the same rule Razorpay applies to money in its own dashboard. The reason for a model is measured, not claimed: the rules read 85% of 41 made-up messy complaints right as the main issue, typos only 50% of 10, and both issues in one message 0% of 5 (appendix 1a, item 2). The set is small and made up, and no model has been run on it. |
| Does it overlap with Agent Studio and the dashboard? | Yes, in three places, and we say so. The dashboard already refunds duplicate payments, Cart Recovery handles dropped buyers, and Subscription Recovery handles renewals. In production we hand those off. We keep what none of them does: seeing a failing webhook, widening one complaint to everyone affected, saying whose side the fault is, and finding the payment from the customer's first message. |
| Why would a merchant pay when a developer could build it? | A developer can build a reconciliation script, a Hookdeck relay and an alert for about ₹1.3 to 1.5 lakh in the first year. They cannot see Razorpay's own delivery logs, message the customer, or restore access in stages with undo. |

**Do not say:** that a model reads the messages in the prototype; that merchants have asked for it or will pay (no founder has been asked yet); that Guard will sell (it costs 40 to 56 percent of the value it restores, so it sells on prevention, and uptake is the weakest assumption); any figure for how many Razorpay merchants have webhook failures (not public); any price as Razorpay's (Agent Studio prices are not published).

**Optional sentence for the note**, if one can be cut elsewhere: "Priced as free detection, a 1 percent fee on value restored, and an optional ₹999 a month plan; about ₹0.9 crore a year to run, so a low-cost bet on trust, to be proven in a six-month pilot."

---

## 6. Rehearsal findings for the video (10 Oct 2026)

These are for the v2 script. The wording points still apply to a v3 script that reuses the INC-1 and INC-4 numbers. The "path that fits" below does not cover the v3 Overview (batch 1.1) or the big-brand flow (batch 1.3).

An independent reviewer walked the script above, click by click, on the local build and on the hosted site (fresh browser, no cache, 1440 and 375 wide). Every number in the voice-over matches the product. These are the points to fix when you write the final script. None of them needs a code change.

**Wording that does not match the screen**
- **0:10 to 0:35.** The ₹56,319 is the 81 customers still locked out, not the 85 affected. Say "85 affected, 81 still locked out, ₹56,319 at risk".
- **0:55 to 1:15 (INC-4).** The voice-over says Blindspot "saw the page check fail and 12 customers write in, flagged it five minutes after the page broke". The page says you would have known at 20:15, before any customer wrote (the first wrote at 20:25). Better: "Blindspot saw the page check fail five minutes after the page broke, before anyone wrote in. Twelve customers later did."
- **1:15 to 1:25.** "Every number here is on the Accuracy page" is not true for 85, 17, 68, ₹56,319 or 12. The page now shows the measured ones (4.0 silent per complaint, 55 minutes to alert, 5 minutes for the pay page, 100 percent identified in 3 questions, 147 of 147 checks). Say "The measured numbers are on the Accuracy page." (The page was called How we know until 11 Oct.)
- **0:35 to 0:55.** "Beside the incident it joined" is a small `INC-1` chip on the thread, not a link and not a split screen.

**What is not in the app**
- The title card at 1:25 to 1:30. Make it in editing.
- The three-zone graphic at 0:00. The unlabelled art is on `/guides/blindspot`. The labelled Before payment and After payment groups are on Payment issues (`/incidents`), with During payment as one line under them. The 11 Oct pictures (`web/public/art`) are better for the opening: `01-overview` is the three places a payment breaks.

**Timing.** Narration is about 78 seconds at 150 words a minute, and the clicks overrun 90 seconds by 8 to 10. The 1:15 row is the densest: 33 words and about 8 clicks in 10 seconds. Trim the INC-4 hold or speed up the stepper in editing.

**State.** A full page reload (F5) restarts the demo, and in-app links keep what you did. Reload before every take. After the success surface the Payment issues list and Overview still show INC-1 as open, so go straight to Accuracy. The Ray on WhatsApp alert is near the bottom of Overview, so scroll to it. The welcome pop-up opens the first time Overview shows after a load: close it with "Look around first", or use it as the opening shot. The success surface showed ragged edges in headless Chrome: look at it in real Chrome on the recording machine.

**A path that fits (1440 wide, hosted site)**
Updated 11 Oct for the renamed pages (web/DESIGN.md section 22).
1. 0:00 full load of `/` (Overview). The welcome pop-up opens: hold on slide 1 ("Find customers who paid and got nothing") for 10 seconds, then "Look around first".
2. 0:10 scroll to Ray on WhatsApp, "View list", hold on the INC-1 headline ("85 customers paid and did not get access"), the tiles and the blue answer box.
3. 0:35 sidebar Customer complaints, "Talk to it on WhatsApp", the first message, then the "UPI ref" message, then "Approve and send".
4. 0:55 sidebar Payment issues, "About 13 customers could not pay" (INC-4): the answer box, the tiles, one scroll for the evidence, then the chart.
5. 1:08 sidebar Payment issues, INC-1, "Start the fix", then: Run the check, Plan the fix, Looks right continue, Grant the first 5, Grant the rest, Your developer ships the fix, Move the clock forward 24 hours, Check it held and close. Hold on the success surface, then sidebar Accuracy.

**Not checked by the reviewer:** real-GPU rendering of the success surface, audio pacing, Safari and Firefox.


---

## 7. Where each number comes from

`R` is `web/public/snapshot/eval/report.json` (the committed eval report; each row names the metric). Read on 13 Oct 2026. If `make eval && make snapshot` moves a figure, change it here and in section 1.

**In the one-page note**

| Number in the note | Where it comes from |
|---|---|
| 85 paid with no access, 17 complained, 68 never did | `web/public/snapshot/incidents.json`, INC-1: `affected` 85, `complained` 17, `silent` 68 |
| 55 minutes after the deploy | R `alert_latency_minutes_from_deploy` = 55.4 (INC-1 starts 29 Sep 14:20, `would_have_alerted_at` 15:15) |
| 41 made-up messy complaints | R `messy_complaints_total` = 41; the messages are in `eval/messy_complaints.json` |
| Main issue read right 85% | R `messy_main_claim_found` = 0.8537 |
| Plain 100% of 7 | R `messy_main_claim_found_clean` = 1.0 |
| Hinglish 91% of 11 | R `messy_main_claim_found_hinglish` = 0.9091 |
| Typos 50% of 10 | R `messy_main_claim_found_typo` = 0.5 |
| Amount written 54% of 13 | R `messy_amount_found` = 0.5385 |
| Both issues in one message 0% of 5 | R `messy_both_issues_found` = 0.0 |
| "No model has run on it yet" | Nothing in the repo calls a model. PRD section 11 ("no language model, decision T1") and ROADMAP_V3 P2-B4 (the model step is Phase 2) |
| 147 checks pass | R: 147 entries with `status` "pass", none "fail" (the other entries only report a figure) |
| 6.2 to 3.2 false alerts in a six-week invented replay | R `learning_false_alerts_per_replay_off` = 6.2 and `..._loop` = 3.2 |
| Three settings, one step a week | `docs/BUILD_LOG.md`, 7 Oct entry "R5 second slice"; R `learning_changes_logged_in_bounds_one_per_week` = 1.0 |
| Refunds one at a time, ₹5,000 a day, always a person | R `duplicates_refunded_within_the_daily_limit` (target text), `refunds_made_in_bulk_or_by_a_script` = 0, `refunds_made_by_the_autonomy_setting` = 0 |
| An issue closes only after 24 healthy hours | R `incident_closes_only_after_24h_healthy` = 1.0 |
| 8 hours for a live model step | PRD v3 section 13, prioritisation table (live model step, 8 hours, RICE 0.6) |
| 55 in the demo (minutes to alert) | Same as the 55 minutes above; PRD v3 section 12 metrics table |
| Alerts marked wrong under 1 in 5 | `docs/BUSINESS_CASE.md` section 8, gate G-P6 |
| Running cost ₹0.86 cr a year | `docs/BUSINESS_CASE.md` section 1, line 1 (from `docs/business_model.py`) |
| The founder quote | `docs/SUBMISSION.md` section 3 (checked against the 5 Oct social listening files) |

**Only in appendix 1a**

| Number | Where it comes from |
|---|---|
| 4.0 silent per complaint, kill line of 2 | R `silent_to_complained_ratio` = 4.0, target ">= 2 (kill criterion K1)" |
| One customer affected when the alert fires | R `customers_affected_when_alert_fires` = 1.0 |
| Pay page found 5 minutes after it breaks | R `zone1_inc4_minutes_from_start_to_alert` = 5.0 |
| 0 false alarms on 5 look-alike days | R `zone1_look_alikes_raising_an_incident` = 0.0 and `zone1_incidents_not_in_ground_truth` = 0.0; the five look-alikes are N1 to N5 (`docs/SPEC.md`, the Zone 1 negatives row in the metrics table) |
| Precision 1.0 against a bar of 0.80, one seed | R `zone1_precision` = 1.0 (K6) |
| 35 of 41 | Derived: 0.8537 x 41 = 35.0. Not a separate figure in R |
| Forwarded 100% of 5; main issue in two-in-one 100% of 5; payment ID 100% of 2; 0 of 5 non-payment messages flagged | R `messy_main_claim_found_forwarded`, `..._two_issues`, `messy_payment_id_found`, `messy_unrelated_flagged_as_payment` |
| The three misses | R `messy_miss_1` to `messy_miss_3` |
| First draft 40 messages, 78% | `docs/BUILD_LOG.md`, 12 Oct entry "v3 batch 1.2" |
| 4.0 minutes typical, 10.5 longest, 30 seconds per approval | R `founder_minutes_typical_incident_estimate` = 4.0, `founder_minutes_inc2_estimate` = 10.5 (target text names the 30 s assumption) |
| 5.0 for the weekly rhythm alone; both clear outages found; 0.2 missed per replay | R `learning_false_alerts_per_replay_baseline_only`, `learning_clear_outages_found_every_arm`, `learning_missed_outages_per_replay_loop` |
| 2 of 24 renewal links held back | R `renewal_customers_held_back` (target text) |
| 0 public replies sent without the founder; 0 links outside the window | R `public_replies_posted_without_the_founder`, `zone1_links_sent_outside_the_channel_window_or_without_permission` |
| 0 never-ask violations; 0 invented deadlines; handover 1.0 | R `never_ask_violations_in_agent_replies`, `pressure_or_invented_expiry_in_agent_replies`, `handover_to_a_person_when_needed` |
| 0 money or access changes from an inferred incident | R `zone1_money_or_access_changes_from_an_inferred_incident` |
| Text deleted after 30 days | `docs/BUILD_LOG.md`, 10 Oct entry "data retention"; PRD v3 F17 |
| Pilot gates: 6%, 4.5%, 40%, ₹50, 1 in 5 | `docs/BUSINESS_CASE.md` section 8, G-P1 to G-P6 |
| About 6 months, about 200 merchants, about ₹0.8 cr; keep Watch at about ₹0.46 cr a year | `docs/BUSINESS_CASE.md` section 1 (line 8) and section 8 |
| ₹1.19 cr to build; -₹1.09 cr over three years; +₹0.28 cr with ₹50 avoided per incident | `docs/BUSINESS_CASE.md` section 1 (lines 1 to 3) |
| 15 of 289 merchant posts on this theme | `docs/AI_BUILD_LOG.md` (tool table, Apify row); PRD v3 section 2 for the 289 |
| Six failed deliveries left no trace on the webhook screens | Section 3 of this file, item 1 |
| 1,240 customers (410 paid twice, 830 no order); alert at 7:52 pm, root cause at 7:58 pm, six minutes; 12 minutes from rollout to alert; ₹15,69,060, ₹4,97,890, ₹10,71,170 | `web/public/brand/incidents/FK-1.json` (`groups`, `money_stuck_paise`, `lane`, `previews`), written by `synth/brand_world.py` from `synth/j2_brand.py` (test: `synth/tests/test_j2_brand.py`, `web/e2e/brand.spec.ts`). Build log entries "v3 batch 1.3" and "v3 batch 1.5 T1" |

**In `docs/AI_BUILD_LOG.md`**

| Number | Where it comes from |
|---|---|
| 164 commits on main | `git rev-list --count origin/main` at ebad89f, 13 Oct |
| 46 merged pull requests | `gh pr list --state merged --limit 200` at ebad89f, 13 Oct |
| About 32,500 lines of Python and TypeScript | `git ls-files '*.py' '*.ts' '*.tsx'` (snapshot data left out), summed with `wc -l`: 32,538 |
| 627 backend tests, 260 browser tests | `uv run pytest -q` (627 passed) and `npx playwright test --list` (260). CI on main at ebad89f passed 259 of the 260; the one that timed out (INC-2 walkthrough, 60 s budget on a slow runner) passes locally in 17 s and is fixed in PR #53. All 13 Oct. Before 12 Oct there were 93 browser tests: PRD v3 section 11 |
| 147 scored checks pass | R, as above |
| 41 made-up complaints, 85%, 78% | R, and `docs/BUILD_LOG.md` as above |
| 26 sessions (10 Oct) | The previous version of the log. Not recounted |
