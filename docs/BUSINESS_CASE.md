# Business case and pricing (frozen 10 Oct 2026)

What it would cost Razorpay to run Blindspot in production, what to charge, what merchants pay and get, and what has to be true for it to work. Every number here comes from `docs/business_model.py` (run `uv run python docs/business_model.py`). If a number in this file and the script disagree, the script wins and this file is wrong.

**Status.** The base case in section 2 is frozen. It is deliberately not stretched: it assumes better pickup than Agent Studio saw in its gated beta, and nothing more. Change it only through the change log in section 11.

**Evidence tags.** `[src]` taken from a named public source (section 10). `[derived]` computed from sourced figures. `[assumed]` our estimate, with the reason. Sources for what Razorpay people said in interviews and talks are in `docs/INTERVIEWS.md` (digest) and `docs/RAZORPAY_TRANSCRIPTS.md` (full text).

**Scope of the model.** It prices the production product, not the prototype. Everything the prototype mocks (merchant data, channels, refunds, payment links) is real in production, so it has a cost. The prototype's rules-only engine is the specification (SPEC section 21).

---

## 1. The answer in eight lines

1. Running it costs about **₹0.86 crore a year** at steady state (people ₹0.45 cr, compute ₹0.20 cr, messages and error reserve, plus 20 percent contingency). Building it in year 1 costs about **₹1.19 crore**. Both are about 0.07 percent of Razorpay's FY25 gross profit of ₹1,277 cr.
2. Direct revenue at base is **₹1.09 cr a year**: Guard ₹0.93 cr, Fix fees ₹0.16 cr. Steady net is **+₹0.23 cr**. The three-year total is **-₹1.09 cr**.
3. With an indirect benefit of ₹50 per detected incident (about one support ticket avoided for every five incidents), steady net is +₹1.01 cr and the three-year total is **+₹0.28 cr**. Payback comes in year 3.
4. So this is a **low-cost option on merchant trust and retention**, not a revenue line. Do not present it as a profit centre.
5. **Guard carries the direct revenue.** Without Guard the base loses ₹0.68 cr a year and needs 64 percent of the cohort connected. Fix fees alone cannot pay for it.
6. **Tokens do not matter.** Switching the model from Haiku to Fable moves steady net by only ₹0.13 cr. Never price on tokens.
7. The things that decide the outcome are **Guard uptake, how many merchants connect, how many merchants are in the cohort at all, and compute design.** All four are unknown until Razorpay's data or a pilot answers them.
8. Run a **6-month pilot (about ₹0.8 cr) with hard gates** (section 8). If two gates fail, keep only Watch, which costs about ₹0.46 cr a year.

---

## 2. The frozen base case

### 2.1 Scale and adoption

| Input | Base | Range tested | Tag | Basis |
|---|---|---|---|---|
| Businesses onboarded on Razorpay | 10 million | 5 to 12 million | `[src]` secondary | Retellings of Razorpay's own claim ("over 1 crore"; one site says 12 million onboarded). Razorpay's IPO filing is confidential, so no audited count is public. |
| Active share | 10% | 5 to 20% | `[assumed]` | No public figure. First number to pull from Razorpay data. |
| Share on a custom webhook integration | 50% | 20 to 60% | `[assumed]` | Plugin merchants (Shopify, WooCommerce, Wix, Magento) are handled by Razorpay's own plugins. Custom-API merchants own their webhook handler. |
| **Cohort** (Watch covers all of it) | **500,000** | | `[derived]` | 10M x 10% x 50% |
| Connected to Fix or Guard by year 3 | **8% = 40,000** | 3 to 15% | `[assumed]` | Agent Studio had about 2,000 merchants live about 7 months after its March 2026 launch, but it is early access and gated, so that is supply-limited, not a demand ceiling. Blindspot's trigger is an incident, so intent is high. 40,000 is about 8.5 percent of the 468,000 alerts the cohort receives in three years. |
| Ramp to steady state, years 1, 2, 3 | 20%, 55%, 100% | | `[assumed]` | Faster than Agent Studio's gated pace, slower than a default-on feature. |
| Incidents a year per merchant (small and mid / large) | 0.40 / 0.20 | 0.15 to 1.0 | `[derived]` | About 12 payment-path deploys a year x about 10 percent change failure (DORA 2024 bands run about 5 to 40 percent) x about 30 percent that break the webhook, plus hosting and third-party causes. Shopify treats a webhook failure rate above 0.5 percent as higher than average. |
| Detected by Watch | 80% | 50 to 95% | `[assumed]` | |
| Eligible for a Fix (access can be restored) | 70% | 40 to 90% | `[assumed]` | |
| Merchants who approve a paid Fix | 60% | 30 to 90% | `[assumed]` | Some merchants fix it themselves. |
| Merchant mix: small / mid / large | 70 / 25 / 5% | 85/10/5 to 60/35/5 | `[assumed]` | Razorpay's own examples: ₹3 lakh a month (small), ₹5 lakh enterprise threshold. |
| Customers hit per incident | 25 / 120 / 1,000 | x0.5 to x1.5 | `[assumed]` | |
| Average order value | ₹800 | ₹300 to ₹1,500 | `[assumed]` | Razorpay's own blogs use ₹1,200 as an example. |
| Complaints | 20% of affected customers | | `[assumed]` | Founders say most customers never write in. |

### 2.2 Price

| Input | Base | Tag | Basis |
|---|---|---|---|
| Watch | Free, included | `[src]` | Razorpay's 2% fee already advertises fraud detection, routing, reporting and reconciliation. |
| Fix fee | 1% of value restored, minimum ₹99, cap ₹3,000 per incident | `[src]` precedent | Razorpay add-ons: Subscriptions 0.99%, chargeback protection +1%. Ops fees are small in rupees (RazorpayX payout ₹5 on ₹10,000). |
| Incidents that are not charged | 30% | `[assumed]` | First incident free, Razorpay-side faults free, disputed cases. |
| Guard | ₹999 a month (₹10 to 50 lakh monthly volume), ₹2,999 a month (above), 83/17 mix | `[assumed]` | Tiers follow Razorpay's own ₹5 lakh and ₹50 lakh breakpoints. DIY alternative costs about ₹8,500 to 9,800 a month (section 6). |
| Guard uptake | 6% of connected mid and large merchants | 2 to 12% | `[assumed]` | Sold right after an incident, billed through Razorpay's rails. |
| Guard paid months | 80% | 50 to 90% | `[assumed]` | Annual plan, deducted from settlement. |

### 2.3 Cost

| Input | Base | Range | Tag | Basis |
|---|---|---|---|---|
| Build squad | 1 full-stack builder, 0.5 AI PM, 1 senior engineer, 0.25 analyst, 0.1 engineering manager (2.85 FTE) | | `[derived]` | Razorpay's AI team started with 2 people and grew to 6; Vulcan took about 6 months. |
| Pay | ₹31.5 lakh cash + 20% ESOP for builder and AI PM | ₹25 to 38 lakh, ESOP 10 to 40% | `[src]` | ISB AIPM and full-stack builder band (₹25 to 38 lakh cash plus ESOP, told to us 10 Oct). Senior engineer ₹35.5 lakh, analyst ₹14.8 lakh, engineering manager ₹65 lakh (AmbitionBox, Razorpay, 8 Oct 2026). Plus 25% for benefits and tools. |
| Cost per person-month | **₹3.74 lakh** | ₹3.18 to 4.59 lakh | `[derived]` | |
| Year-1 build | 26.4 person-months (about 4,200 hours) | 15 to 50 | `[assumed]` | 7 months build, 1.5 compliance and security, 5 months run. |
| Steady run | 12 person-months a year (about 1,900 hours) | 6 to 24 | `[assumed]` | About 1 FTE across the squad. |
| Compute | ₹20 lakh a year | ₹5 lakh to ₹1 cr | `[assumed]` | One grouped batch query every 5 to 15 minutes on data Razorpay already holds. A per-merchant real-time stream would take it to the top of the range. |
| WhatsApp | ₹0.115 per utility message; 2 per affected customer, 4 per complaint | marketing class ₹0.8631 | `[src]` | Meta India rates; service replies are billable from 1 Oct 2026. |
| Model calls (for sizing only) | ₹2.79 per conversation on Sonnet | Haiku ₹0.14 to Fable ₹13.72 | `[src]` | Anthropic list prices, 4,000 tokens in and 200 out per call, 5 calls, caching on. Razorpay has said token cost is not a factor for it. |
| Error reserve | 0.2% of fixes x ₹25,000 | 0.05 to 1% | `[assumed]` | A wrong message or access change. |
| Contingency | 20% | 10 to 40% | `[assumed]` | |
| Exchange rate | ₹90 per dollar | | `[assumed]` | |

### 2.4 Not in the model

Razorpay's gross profit on recovered payments, chargeback fees avoided, merchants kept, any marketplace revenue share, GST (pass-through), support capacity for Guard's priority routing (you told us to count man-hours only), voice calls, and opportunity cost of the hours.

---

## 3. Results at base (₹ crore)

| | Steady state |
|---|---|
| Connected merchants | 40,000 |
| Detected incidents a year (whole cohort) | 156,000 |
| Fixes done a year | 5,301 |
| Value restored to merchants a year | 32.1 |
| Fix fees | 0.16 (0.5% of value restored) |
| Guard (720 merchants) | 0.93 |
| **Direct revenue** | **1.09** (3.4% of value restored) |
| People (steady) | 0.45 |
| **Total cost, with contingency** | **0.86** |
| **Net** | **+0.23** |
| Year-1 build cost, with contingency | 1.19 |

By year, direct only: **-1.10, -0.22, +0.23** (three-year -1.09). With ₹50 per detected incident of indirect benefit: **-0.95, +0.21, +1.01** (three-year +0.28). ₹100: -0.79, +0.64, +1.79 (+1.64). ₹150: -0.63, +1.07, +2.57 (+3.01).

The indirect benefit is avoided cost to Razorpay (support tickets, disputes, merchants kept). It is not revenue. ₹50 is about one avoided ticket for every five incidents at an assumed ₹250 a ticket. Razorpay's own ticket data decides it.

### 3.1 Scenarios

| Scenario | Changes from base | Steady net | Three-year | With ₹50 indirect (steady, three-year) | Cost |
|---|---|---|---|---|---|
| Cautious | 4% connected, Guard 5%, 70% paid months | -0.40 | -2.19 | +0.38, -0.83 | 0.82 |
| **Base** | frozen | **+0.23** | **-1.09** | **+1.01, +0.28** | 0.86 |
| Stretch | 12% connected, Guard 8%, 85% paid months | +1.32 | +0.80 | +2.10, +2.17 | 0.89 |
| Downside | 3% connected, Guard 2% | -0.63 | -2.60 | +0.15, -1.23 | 0.81 |

### 3.2 Pay cases

| Pay | Steady | Three-year | With ₹50 (steady, three-year) |
|---|---|---|---|
| Low (₹25 lakh, ESOP 10%) | +0.32 | -0.75 | +1.10, +0.62 |
| Mid (₹31.5 lakh, ESOP 20%) | +0.23 | -1.09 | +1.01, +0.28 |
| High (₹38 lakh, ESOP 40%) | +0.11 | -1.60 | +0.89, -0.24 |

Pay moves steady net by about ₹0.2 cr between the extremes. It is not worth more debate.

### 3.3 Break-evens (steady, direct only)

- **Connected merchants:** 6.1 percent of the cohort, about 30,700 merchants.
- **Guard uptake:** 4.5 percent of connected mid and large merchants.
- **With no Guard:** net is -0.68, and 64 percent of the cohort would have to connect. Or the indirect benefit would have to be about ₹44 per detected incident.

### 3.4 Random draws

20,000 draws, each input drawn from a triangle between its low and high range with the base as the peak. The inputs are drawn independently, so correlated bad luck (for example low adoption together with low Guard uptake) is understated. Use the scenarios above for that.

| Indirect benefit per detected incident | Chance steady net is positive | Chance three-year is positive | Median steady | Three-year P10 / P50 / P90 |
|---|---|---|---|---|
| ₹0 | 30% | 5% | -0.34 | -4.08 / -2.52 / -0.65 |
| ₹50 | 72% | 27% | +0.46 | -3.02 / -1.14 / +1.48 |
| ₹100 | 90% | 54% | +1.24 | -2.18 / +0.22 / +3.88 |
| ₹150 | 96% | 72% | +2.01 | -1.42 / +1.55 / +6.38 |

**Read this before quoting the base.** The base sits above the middle of its own ranges: the median of the random draws is a steady net of about -₹0.34 cr on direct revenue. We chose the base because the gated Agent Studio number is an unfair anchor, not because it is the most likely outcome.

---

## 4. Sensitivity

### 4.1 What moves steady net (₹ crore, base +0.23)

| Input (low / high tested) | At low | At high |
|---|---|---|
| Guard uptake (2% / 12%) | -0.38 | +1.15 |
| Active merchant share (5% / 20%) | -0.27 | +1.25 |
| Connected share (3% / 15%) | -0.40 | +1.12 |
| Compute (₹5 lakh / ₹1 cr) | +0.41 | -0.73 |
| Guard price (x0.5 / x1.5) | -0.23 | +0.70 |
| Small-merchant share (85% / 60%) | -0.26 | +0.56 |
| Custom-webhook share (20% / 60%) | -0.37 | +0.44 |
| Staff time (6 / 24 person-months) | +0.50 | -0.30 |
| Onboarded base (5M / 12M) | -0.27 | +0.44 |
| Guard paid months (50% / 90%) | -0.11 | +0.35 |
| Contingency (10% / 40%) | +0.31 | +0.09 |
| Fix fee rate (0.5% / 2%) | +0.17 | +0.37 |
| Pay per person-month (₹3.18 / 4.59 lakh) | +0.32 | +0.11 |

Barely matter (each moves it by about ₹0.2 cr or less): order value, incident rate, detection rate, eligibility, paid-fix approval, free-incident share, customers per incident, error reserve, WhatsApp message class.

Model tier: Haiku +0.26, Sonnet +0.23, Fable +0.13.

### 4.2 Pricing sensitivity

**Fix price** (fees, steady net): 1% with minimum ₹99 and cap ₹3,000 gives 0.16 and +0.23. Cap ₹5,000: 0.18, +0.25. 0.5%: 0.10, +0.17. 2%: 0.30, +0.37. Free: 0.00, +0.07. First two incidents free: 0.07, +0.14.

Going free costs only ₹0.16 cr a year, so the Fix fee is an NPS and positioning decision, not a revenue one.

**If demand falls as the Fix fee rises** (fee revenue, 1% = 1.00; columns are fees of 0.5%, 1%, 2%, 3%, 5%):

| Demand sensitivity | 0.5% | 1% | 2% | 3% | 5% |
|---|---|---|---|---|---|
| Low (0.5) | 0.82 | 1.00 | 1.30 | 1.54 | 1.50 |
| Medium (1.0) | 0.97 | 1.00 | 0.92 | 0.89 | 0.67 |
| High (1.5) | 0.97 | 1.00 | 0.65 | 0.51 | 0.30 |

1 percent is the safe choice: it is the best fee, or within 0.03 of it, when demand is medium or high, and gives up at most about 35 percent of fee revenue when demand is low. Fee revenue is small either way.

**Guard price** (Guard revenue, base price = 1.00; columns are price x0.5, x0.75, x1, x1.5, x2):

| Demand sensitivity | x0.5 | x0.75 | x1 | x1.5 | x2 |
|---|---|---|---|---|---|
| Low (0.5) | 0.71 | 0.87 | 1.00 | 1.22 | 1.41 |
| Medium (1.0) | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| High (1.5) | 1.41 | 1.15 | 1.00 | 0.82 | 0.71 |

If demand is medium, price does not change Guard revenue, and a lower price connects more merchants (more coverage, more indirect benefit). That is the reason to test ₹499 for mid-size merchants in the pilot.

---

## 5. The offer

### 5.1 Three layers

| | Watch | Fix | Guard |
|---|---|---|---|
| For | Every merchant on a custom webhook integration | Any merchant that connects its access data | Mid and large merchants, founder-run, who cannot afford a silent failure |
| Price | Free, in the 2% fee | 1% of value restored (min ₹99, cap ₹3,000), first incident free, free when the fault is Razorpay's | ₹999 a month (₹10 to 50 lakh monthly volume), ₹2,999 (above), custom beyond, annual plan, +18% GST |
| Owner | Payments platform and dashboard | Agent Studio (first-party agent) | Agent Studio |
| What it does | Webhook health, orders that never get a payment attempt, payment dips, an estimate of customers affected and rupees at risk, an evidence pack for Razorpay | Checks payments against access, widens one complaint to everyone affected, says whose side the fault is, restores access in stages (dry run, first 5, the rest) with undo, messages customers, finds the payment when a customer writes in, verifies and closes | Everything in Fix with no per-incident fee, plus prevention (a test ping to the webhook endpoint, a pay-page check, a pre-deploy check you can call before a release), a monthly value report, priority routing of Razorpay-side faults with the evidence pack, a developer handoff page, more than one approver, higher caps |
| Needs a model | No | No in the prototype; a model reads messy text in production | Same as Fix |

Included in Guard: up to 2,000 customer messages a month (about ₹230 of cost to Razorpay). More are charged at cost. Not promised: recovery of customers who will not pay, or a response time on Razorpay-side fixes (that would need dedicated support capacity).

### 5.2 How a merchant sees value and cost

- **Before:** a price card in the dashboard before anything is switched on, as Agent Studio does. For Guard, a calculator on the merchant's own last 12 months of webhook and order data, which Razorpay already holds. It shows how many payments fell inside a failing window and what that cost.
- **At approval:** a fee preview, for example "85 customers, ₹56,319 restored x 1% = ₹563, plus about ₹10 of messages, charged to your next settlement." The founder approves knowing the price.
- **After:** a receipt: "85 of 85 confirmed active, ₹56,319 restored, found in 55 minutes, you paid ₹573." If a fix is undone, the fee reverses, as payout fees do.
- **Always:** a monthly cap, a per-incident cap, a message budget, and an alert at 80 percent of any of them. A monthly value ledger: incidents caught, customers made whole, rupees restored, hours saved, what it cost.
- **Trial:** the first incident free, and a 30-day Guard trial with a credit limit, mirroring Agent Studio's trial.
- **Billing:** no build. Razorpay already deducts fees at source, collects other fees daily as a line in the statement, issues a monthly invoice on the 1st, offers a reconciliation report, and has a "free" fee type and fee reversals.

### 5.3 What a merchant pays against what it gets, per year at base

| Merchant | Incident value | Fix fee per incident | Expected incidents | Expected fee | Expected value restored | Guard cost | Guard as share of restored |
|---|---|---|---|---|---|---|---|
| Small (₹3 lakh a month) | ₹20,000 | ₹200 | 0.22 | ₹45 | ₹4,480 | none | none |
| Mid | ₹96,000 | ₹960 | 0.22 | ₹215 | ₹21,504 | ₹11,988 | **56%** |
| Large | ₹8,00,000 | ₹3,000 | 0.11 | ₹336 | ₹89,600 | ₹35,988 | **40%** |

Fix costs about 0.5 percent of value restored. Guard costs far more than the expected value it restores, so it cannot be sold on restored rupees. It sells on prevention, peace of mind, and avoiding the 1 am spreadsheet. That is the reason uptake is set at only 6 percent, and it is the weakest assumption in the case.

---

## 6. The do-it-yourself alternative

A small team with an engineer can build a rough version in days.

| Piece | Cost |
|---|---|
| Scheduled script that compares Razorpay's payments API with the merchant's own database and alerts Slack | about 3 engineer-days to build, 4 days a year to maintain |
| Hookdeck in front of the webhook endpoint (retries and replay) | $39 a month (Team plan) |
| Sentry for handler errors | $26 a month (Team plan, annual) |
| Uptime monitor | Better Stack has a free tier |
| Engineer day (₹15 to 22 lakh CTC, loaded) | ₹8,000 to 12,000 |

Year 1: about ₹1.3 to 1.5 lakh. Run rate: about ₹8,500 to 9,800 a month.

What DIY cannot copy: Razorpay's own delivery logs and a verdict on whose side the fault is; messaging the customer and finding the payment; a staged fix with undo and verification; an evidence pack Razorpay accepts without a ticket round trip.

Willingness to pay: teams with engineers cap near ₹9,000 to 10,000 a month, so Guard at ₹999 to ₹2,999 is 10 to 30 percent of that. Founders with no engineer cannot DIY, and their price is capped by the value restored, which the 1 percent fee keeps small. The best moment to sell is right after an incident. The cost of DIY is focus, not money: about three days is under 2 percent of an engineer-year, and most teams do not build it until after the first loss.

---

## 7. Decisions

| # | Decision | Reason |
|---|---|---|
| B1 | Freeze the base case in section 2. | You asked for it, and a moving base makes every conversation start over. |
| B2 | Present it as a low-cost option on trust and retention, not a revenue line. | Direct revenue is about the cost of running it. |
| B3 | Watch is free and part of the 2% fee. | Razorpay already sells reconciliation inside the fee. Charging to see a gap in its own tooling would cost NPS, which Razorpay's CEO has said is its main internal goal. |
| B4 | Fix is 1% of value restored, minimum ₹99, cap ₹3,000, first incident free, free when the fault is Razorpay's. Fully free is the fallback if the business team prefers NPS (costs ₹0.16 cr a year). | It matches Razorpay's own add-on pricing. |
| B5 | Guard is ₹999 or ₹2,999 a month, annual first, sold on prevention and the monthly report. Test ₹499 for mid-size merchants in the pilot. | Price barely moves revenue at medium demand, and coverage matters more. |
| B6 | Never price on tokens or model use. | Razorpay sells the outcome and says merchants should not think about the model. Model calls are about 3 percent of total cost at base. |
| B7 | Fees ride Razorpay's existing billing. | It already deducts, invoices, reconciles and reverses. |
| B8 | In production, refunds, recovery links and renewal links use Razorpay's existing tools and agents. Blindspot keeps detection, widening, attribution, the customer conversation and the access fix. The built demo keeps the flows it has. | The dashboard already refunds duplicates by chat, Cart Recovery is the most used agent, and Subscription Recovery covers renewals. |
| B9 | Staff it with man-hours from existing teams: 26.4 person-months in year 1, 12 a year after. | A small AI team is how Razorpay builds. |
| B10 | The fault verdict is a billing decision, so it needs an appeal path and an audit line. | We cannot bill someone for Razorpay's own failure. |
| B11 | Pilot first, with the gates in section 8. | The base is above the middle of its own range. |
| B12 | Outbound messages must pass a no-false-urgency check. | Agent Studio's certification screens for dark patterns. A template with a real expiry is fine, a made-up one is not. |

---

## 8. Pilot and gates

**Pilot.** About 6 months, Watch and Fix for about 200 opt-in merchants (including mid-size ones), Guard offered to those who have had an incident. About 17 person-months, about **₹0.8 cr** with contingency. Pull the five internal queries below in the first two weeks.

**Gates at month 6.**

| Gate | Pass | What it protects |
|---|---|---|
| G-P1 Connected | At least 6% of merchants that received an alert have connected their access data | Adoption, the largest driver |
| G-P2 Guard | At least 4.5% of eligible merchants take Guard (the break-even) | The only direct revenue that matters |
| G-P3 Fix approval | At least 40% of eligible incidents are approved for a paid Fix | The fee base |
| G-P4 Incident rate | At least 0.2 qualifying incidents per cohort merchant a year in Razorpay's webhook logs | The size of the problem |
| G-P5 Indirect benefit | At least ₹50 of avoided cost per detected incident (tickets, disputes) | The case for the free layer |
| G-P6 Alerts stay on | Fewer than 1 in 5 alerts marked wrong, and fewer than 5% of merchants switch alerts off | Trust |

Two or more gates failed: stop the paid layer and keep Watch (about **₹0.46 cr a year**). Revisit the base if P4 or P5 comes in far from the assumptions.

**Five internal queries.**
1. How many merchants have a webhook configured and active.
2. How many had a 30-minute-or-longer window where delivery success fell below 90 percent in the last 12 months.
3. How many captured payments fell inside those windows.
4. How many support tickets were tagged "payment captured, order not updated", and the cost per ticket.
5. How many merchants left after such a window.

**Rollout is a business decision.** A gated release of a few thousand merchants puts the case in the Cautious row. Ask whether Blindspot is default-on for Watch and offered at the moment of an incident, or held in early access like Agent Studio.

---

## 9. Risks the model does not capture well

- **Guard uptake** rests on a feeling, not data. It is the weakest assumption.
- **The funnel above the cohort** (active share, custom-webhook share) is unsourced.
- **Compute** flips the result if the design needs a real-time stream per merchant.
- **Liability.** A wrong access change or refund costs more than the reserve if it happens often. Refunds stay approve-only, one at a time, with a daily cap.
- **Overlap.** Agent Studio and the dashboard will keep adding agents. Anything we build that they already do is waste.
- **Fault attribution.** Razorpay judging its own fault is a conflict of interest, so the verdict needs evidence and an appeal.
- **Policy shifts** from Meta (message classes, billing in rupees from 2027) and Indian rules on AI disclosure.

---

## 10. Sources

Razorpay pricing: https://razorpay.com/pricing/ ; https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/ ; the margins guide and the enterprise pricing guide (blog, Apr and May 2026); the RazorpayX billing doc (`razorpay.com/docs/x`). Agent Studio: the launch blog (12 Mar 2026) and the principles blog (30 Mar 2026). Razorpay FY25: Business Standard, 16 Oct 2025 (revenue ₹3,783 cr, gross profit ₹1,277 cr). Plugins: `razorpay.com/docs/payments/payment-gateway/ecommerce-plugins`. Salaries: AmbitionBox Razorpay page (updated 8 Oct 2026) and Levels.fyi; ISB placements 2026 (average ₹37.29 lakh, via secondary summaries) and the AIPM and full-stack builder compensation range told to us on 10 Oct. Model prices: Anthropic's model pages. WhatsApp: Meta's pricing page and a secondary rate summary. Competitor pricing: Intercom, Zendesk and Salesforce pricing pages and a vendor comparison (the Intercom page is Intercom's own). DORA bands: 2024 report via secondary summaries. DIY tools: Hookdeck, Sentry and Better Stack pricing pages.

Most statements by Razorpay people come from talks and interviews: the digest is `docs/INTERVIEWS.md` and the **full transcripts are in `docs/RAZORPAY_TRANSCRIPTS.md`**. The figures in this file that rest on them: Agent Studio's "about a couple of thousand merchants live" and "still in beta" (S2), the small AI team and "unlimited tokens" (S1, S2), token cost approaching zero (S2), Razorpay's money rule for workflows (S4), NPS as the primary internal goal and about 80 percent of new merchants coming organically (S3), and the agents already in Agent Studio (S2, S5).

---

## 11. Change log

| Date | Change |
|---|---|
| 10 Oct 2026 | Frozen. Base: 8% connected, Guard 6%, 80% paid months, ISB squad pay (₹3.74 lakh per person-month). |
| 10 Oct 2026 | Reviewed against the full transcripts and a search for Agent Studio pricing and news. No input changed and no unfreeze trigger fired. Activation through Razorpay's integration prompt and agent onboarding is recorded in `docs/INTERVIEWS.md` section 10 as unpriced upside to the connected share, not as a new base. |
| 10 Oct 2026 | Correction to earlier chat figures: Guard costs 56% (mid) and 40% (large) of expected value restored, not 45% and 32%, because the earlier figures left out the 80% detection rate. The pilot cost is about ₹0.8 cr, not ₹0.5 cr, and the Guard uptake gate is 4.5%, not 4%. |

Unfreeze triggers: Razorpay data answers any of the five queries; a gate in section 8 reads out; Razorpay publishes Agent Studio pricing; the rollout decision in section 8 is made.
