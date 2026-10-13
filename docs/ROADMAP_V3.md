# Blindspot v3: build roadmap

Written 12 Oct 2026. The product is defined in the PRD v3 doc (Claude Docs: https://claude.ai/code/artifact/31e2f39b-bdfc-43ff-a448-4e41d74e7432). This file is the build order. The PRD decides what; this file decides in which order and how it is checked. Where they disagree on what, the PRD wins; flag the conflict to Eshan.

How to use it: take the next unticked task in your batch, top to bottom. Each task names its files, its owner stream (BUILD_PLAN section 3) and when it is done. Tick it in the same PR that does it.

---

## 0. Time box

| Phase | Window | What it is for |
|---|---|---|
| Phase 1: submission | Build on 12 Oct; note, video and checks on 13 Oct; submit by 9 pm (closes 11:59 pm IST) | The prototype, the 90-second video, the product note and the AI build log. Four batches, one PR each. No changes after submitting. |
| Phase 2: pitch | 14 Oct to the in-person pitch (shortlist by 16 Oct) | Only if shortlisted. First confirm whether the prototype link may change after submission; if not, Phase 2 is shown as a separate pitch build. |
| Phase 3: after the pilot decision | After the challenge | Production pieces that need partners, real accounts or a privacy review. |

---

## 0a. Where Phase 1 stands, 13 Oct (the day of submission)

Batches 1.1, 1.2, 1.3 and 1.4 part a are merged. What is left is the kit and the checks. Submit by 9 pm; the portal closes at 11:59 pm IST and nothing changes after.

| Task | Who | State | What it needs |
|---|---|---|---|
| CI green on `main` | Claude, Eshan merges | `main` has been red since 12 Oct (issue #45). Fix is PR #47. | Merge #47 once its CI is green, before any deploy. Check `gh issue list --label ci-failure --state open` is empty. |
| S3 note, S4 AI build log | Eshan | Drafts are complete. The big-brand lines are filled from `web/public/brand/j2.json`. The note is 546 words by the count in `docs/SUBMISSION.md` (limit 550). | Put both in your own voice. Check the three lines under "Wording to check". Recount after editing. Fill `[TO CONFIRM: the session count]` in the AI build log. |
| S5 video, 90 seconds | Eshan, with Claude drafting | **No v3 script is written.** `docs/SUBMISSION.md` section 2 is the v2 script and says so. | A script in the PRD section 8 order (J1, J2, the dashboard), numbers read from the pages, caption "Synthetic merchant. Simulated Razorpay data." Record from the hosted demo. |
| S6 final QA | Claude | Not started. | Every route at 375, 768 and 1440px, a full test run, the hosted demo showing batch 1.3 and the CI fix, a smoke test of https://razorpay-blindspot.vercel.app in a clean browser. |
| S7 submit | Eshan | Not started. | The four deliverables: note, video, prototype link and README, AI build log. |

Eshan's by-hand items (quote links, Razorpay test-account inbox, the K2 question, the test-object cleanup) are in `docs/SUBMISSION.md` section 4. None blocks submitting.

---

## 1. Checks and balances (every task, no exceptions)

**Session start**
- [ ] `gh issue list --label ci-failure --state open`. If one is open, fix it first and tell Eshan in one line (root CLAUDE.md).
- [ ] `gh issue list --state open`; mention other open issues, do not start them.
- [ ] Read this file, the PRD v3 sections the batch names, `web/CLAUDE.md`, `web/DESIGN.md` sections 14 to 22.
- [ ] `graphify query "<question>"` before searching the repo broadly; read the real file before editing.

**Branch**
- [ ] `git fetch`, cut a short-lived branch from `origin/main`, then `make setup` and `cd web && npm ci`.
- [ ] Stay in your stream's directories. Shared files (`Makefile`, `config.py`, `db.py`) need Eshan's yes.
- [ ] Contracts are frozen: `contracts/`, `backend/app/schemas.py`, `backend/app/channels/base.py`, template IDs and slots, capability flags, `synth/config.yaml`. A change goes only through `make contracts` and an entry in `docs/CONTRACT_CHANGES.md`. If a task needs one and does not say so, stop and ask.

**While building**
- [ ] Numbers come from SQL or Python, never from a model and never typed into a screen.
- [ ] Nothing moves money or messages customers in bulk without the approval the autonomy setting requires. The assistant never asks for credentials.
- [ ] Blade components and tokens only; read a new component's docs first (Blade MCP or its source in `node_modules`). No hex, no pixel padding.
- [ ] Blue acts, green thinks: one blue primary button per view or card; AI green only for Ray and AI output.
- [ ] Every screen has loading (`PageSkeleton`), empty and error states.
- [ ] Anything simulated says so on screen ("Demo data").
- [ ] No em dashes in code, copy or docs. Names follow DESIGN.md section 22.
- [ ] No secrets in the repo. Razorpay keys are `rzp_test_` only, in `.env`.

**Before the PR**
- [ ] `make test`, `make lint`, `make eval`, and in `web/`: `npx tsc -b`, `npx oxlint`, `CI=1 npx playwright test`.
- [ ] New routes added to `e2e/layout.spec.ts` (375, 768, 1440px; no errors, no sideways overflow).
- [ ] DESIGN.md section 19 checklist, item by item, and **section 23 (build checks) in full**: composition, stability (nothing changes size because of its data), edge cases, the journey around the screen, tests that can fail. Write what was found in the build log.
- [ ] Entry in `docs/BUILD_LOG.md`. For `web/` work it ends with `Design review:` and the result.
- [ ] Run the `design-reviewer` agent (`.claude/agents/design-reviewer.md`) with the entry and the diff. Fix every finding or write why not. Run it again. Open the PR only on pass, or pass with notes listed in the entry. Never write "passed" for a review that did not run.

**PR**
- [ ] `gh pr create`, then bind the PR to the session and switch Auto-fix on (`set_monitor` with `auto_fix` and `address_comments`). No auto-merge unless Eshan asks.
- [ ] Merge only when CI is green and Eshan says so. Delete the branch, remove the worktree.

---

## 2. UX rules for every v3 screen

Screen names in the UI follow DESIGN.md section 22, so they differ from the words in this file: the Home is "Overview", the incidents list is "Payment issues" (route `/incidents`), and an incident is a "payment issue".

1. **The story is the spine.** Every issue reads as five steps: Hear, Find all, Whose side, Fix, Win back. The home shows the totals; the incident page opens with the five steps and their numbers.
2. **Lead with the number.** A headline says what happened to customers and how many ("85 students paid but got no test access"); amounts in rupees with Indian grouping.
3. **Razorpay's own patterns.** Home follows the dashboard home (cards, date range, detail). Setup follows the Subscriptions "Get started" card (steps visible, stepper, button bottom right). Incident severity follows Ecosystem Health (summary strip, coloured status). Lists follow Ray's urgency groups (labelled dividers).
4. **Page header carries the page actions** (`PageHeader` `actions` slot, top right): "Take a tour", "Reset setup", the date range.
5. **One primary action per card.** Approvals show the amount and the count before the button.
6. **No real brand assets** for Flipkart, Sentry or Slack: names in text only, generic look, no logos. The store is named Flipkart (Eshan's call, 12 Oct: a demo, not for production, shown to the Razorpay team).
7. **Phone width works.** Grids stack, the side nav becomes the drawer, charts stay readable at 375px.

---

## 3. Phase 1: submission build

Every task carries its MoSCoW call from the scoring in PRD v3 section 13 (RICE on the judge's horizon: reach is video, note and prototype; impact is the judging dimensions). Build the Musts first, then Shoulds in this order, then Coulds. Won'ts are listed so nobody builds them; the note names them as deliberate cuts.

**Order for 12 Oct (build day):** H1 and H6, H7 and H8, H2 to H5, I1, I4, A1, I6 (markers only), then J1 to J6 and J8, then I3, S1, S2. **Order for 13 Oct (kit day):** S3 and S4 are drafted and the README is refreshed. What is left is S5, S6, S7 (section 0a).

### Batch 1.1 Home dashboard and setup (PR 1, stream D, no contract change)

PRD: F1, F1a, wireframe 1, section 9 UI fixes 1 to 5.

- [x] **H1 Header and no tinted panel.** Remove the `surface.background.primary.subtle` hero panel. `PageHeader` with title, and in `actions`: "Take a tour" and "Reset setup" as links, the date range on the right. Files: `web/src/routes/Home.tsx`. Done when: no tinted panel on Home; actions sit top right at 1440px and wrap under the title at 375px.
- [x] **H2 Date range.** Blade `Dropdown` with Today, Last 7 days, Last 30 days, This month (custom range via Blade `DatePicker` is a should). Keep it in the URL (`?range=7d`) so it survives reload. Done when: changing it changes the cards, chart and list together.
- [x] **H3 Four cards.** Computed in the browser from the incident summaries the API already returns (`IncidentSummary`: `status`, `affected`, `fixed`, `at_risk_paise`, `onset_at`). Cards: open issues (status not closed), customers hit (sum of `affected`), money stuck (sum of `at_risk_paise` on open issues), customers made whole (sum of `fixed`). Rupees recovered needs a new field, so it waits for P2-C1. Reuse `components/Stat.tsx`. Done when: a test checks each card equals the sum from the snapshot data.
- [x] **H4 One chart.** New `components/IssuesChart.tsx` on Blade `ChartBar`, stacked by day of `onset_at`. "Show": value (`at_risk_paise`) or volume (`affected`). "Group by": cause (`mismatch_type`, named with `headline()` from `lib/format.ts`) or whose side (`owner`). Method and region come in Phase 2. Done when: both toggles work and the legend uses DESIGN 22 names.
- [x] **H5 Issue list.** Open and recent issues in range, sorted by `at_risk_paise`, each row: headline, owner badge, amount, chevron to `/incidents/:id`. Reuse the row pattern in `routes/Incidents.tsx`.
- [x] **H6 Ask Ray bar.** Keep the existing `ChatInput` and its answers, as a slim bar under the header; suggestion chips get leading icons (Ray home pattern). Answers stay about the selected range where the data allows.
- [x] **H7 Setup card.** Shown while `setupDone() < SETUP_STEPS`: Blade `StepGroup` (horizontal) listing all three steps with ticks for done ones, primary button bottom right. When done: one line, "Setup complete" with "Review". Files: `Home.tsx`, `lib/setup.ts`.
- [x] **H8 Reset setup.** Add `resetSetup()` in `lib/setup.ts` (clears saved setup and the welcome flag). The header link asks once (Blade `Modal`), then resets. Done when: after reset the card shows 0 of 3 and the welcome tour is due.
- [x] **H9 Tests.** Playwright: range switch, toggles, reset. Update snapshot tests.
- [x] **H10 Build log and design review**, as in section 1.

MoSCoW for this batch: everything Must (first screen, named feedback from a Razorpay PM and a Flipkart developer), except the custom date range in H2 (Could) and chip icons in H6 (Should).

### Batch 1.2 Incident page and charts (PR 2, stream D, no contract change)

PRD: F5, F6, F7, F7a, F9, wireframe 3, section 9 UI fix 6, chart feedback.

- [x] **I1 Story strip.** New `components/StoryStrip.tsx` at the top of `Incident.tsx`, `DuplicateView.tsx`, `RenewalView.tsx`, `Zone1View.tsx`: Hear (`complained`), Find all (`affected`, `silent`), Whose side (`owner`, confidence), Fix (`fixed` of `affected`), Win back (messages sent, from `actions`). The current step is highlighted.
- [x] **I2 Summary strip.** Three `Stat` cards (customers hit, money stuck, never wrote in) and the owner badge in the header.
- [x] **I3 Evidence lane.** Restyle `components/Lane.tsx` to wireframe 3: one row per source, a dashed line at onset, labels beside marks, time axis below. Read what `Lane` gets today before changing it.
- [x] **I4 "Is it just you?" panel.** Render the existing `lift` rows (`IncidentDetail.lift`; the backend already computes method, card network, error code, app version and response class) as up to three plain sentences, strongest first (sorting exists at `Incident.tsx:56`), e.g. "All affected payments got a 4xx answer, against 0.4% normally." Cross-merchant lines come in Phase 2.
- [x] **I5 Root cause and actions.** Two cards side by side (stack on phone): root cause (cause, fix, owner) and actions (existing `FixPanel` and `StartFix`, one blue button).
- [x] **I6 Chart pass.** Audit `TimelineChart`, `OrdersChart`, `DuplicateChart`, `RenewalChart`, then: onset and fix marked with `ChartReferenceLine`, a shaded normal range where a baseline exists, one consistent palette from DESIGN.md colour, axis labels with units, rupee tooltips with Indian grouping, at most four gridlines, legend names in plain words. Before and after screenshots go in the build log.
- [ ] **I7 Incidents list.** Group by state with labelled dividers (Open, Fixing, Closed), money at stake on each row. Won't in Phase 1 (RICE 0.1).
- [x] **A1 "Where rules fail" card (Must, RICE 2.4).** The answer to Track 2's "why AI beats a rule", with evidence instead of a claim. Stream A: add a labelled set of messy payment complaints (Hinglish, typos, forwarded text, no ID, two issues in one message) to `eval/`, marked synthetic, and score the current rules triage on it (what it extracts right, what it misses). Stream D: show the result on the Accuracy page (`routes/How.tsx`) as one card: the hit rate, three real misses, and "this is where the agent goes in production". Numbers come from the eval run, never typed. Done when: `make eval` prints the figure and the card reads it.
- [x] **I8 Tests, build log, design review.** PR #39. Two independent reviews fixed; a third was stopped to save cost (see the build log).

MoSCoW for this batch: I1, I2, I4, I5, A1 Must; I3 Should; I6 markers Should, the rest of I6 Could; I7 Won't.

### Batch 1.3 Big-brand flow, J2 (PR 3, streams A and D)

PRD: J2, F4, F12, F13, wireframes 2 and 3, section 8. Built 12 Oct. The store brand is Flipkart, in text only (open question answered, section 7).

- [x] **J1 Brand name** in one constant (`web/src/lib/demo.ts` or a new `lib/brand.ts`).
- [x] **J2 Data from Python.** New `synth/j2_brand.py`, fixed seed, writes `web/public/brand/j2.json` (not `snapshot/`: `make snapshot` empties that folder on every run, so the file would be deleted in CI): 1,240 UPI payments captured from app 8.2 after 7:40 pm, 410 paid twice, 830 left with no order; timeline events (rollout 7:40, verify calls stop 7:41, errors from 7:44, alert 7:52, RCA 7:58, sign-off 7:59, rollback 8:01); lift rows (app version 8.2 against its normal share). A test asserts the counts. New files only; if `synth/config.yaml` must change, stop and run the contracts process.
- [x] **J3 Store, one screen (Could)** `/demo/store`, outside the Razorpay shell: the pay result screen only, with a "Ship app 8.2" switch. After the switch, paying shows "Payment failed" although the payment is captured. Labelled "Demo store". The full four-screen store is a Won't (RICE 0.1).
- [x] **J4 Alert screen** `/demo/alert`: a generic monitoring view that names Sentry in text, "PaymentVerificationError, 40 events in 10 minutes", status "Forwarded to Razorpay". No Sentry logo.
- [x] **J5 Slack thread** `/demo/slack`: wireframe 2 in a generic chat look. The buttons (refund 410, send 830 order list, open evidence) change local state only and show "Approved by" lines.
- [x] **J6 Brand incident page** (`/demo/incident`, inside the Razorpay shell): batch 1.2's layout fed from `j2.json` (story strip, evidence lane with brand lanes, "Is it just you?" from the app-version lift, root cause, actions behind approval). Local state only, labelled demo.
- [ ] **J7 Support engineer console** `/console`: RCAs waiting for sign-off (J2 plus existing incidents), a detail with approve, edit or take over. Won't in Phase 1 (RICE 0.1); Phase 2.

MoSCoW for this batch: J1, J2, J4, J5, J6, J8 Should (the only big-brand proof, but the Slack loop is unvalidated, confidence 50%); J3 Could; J7 Won't.
- [x] **J8 One path for the video.** Store, then alert, then Slack, then incident, each with a "Next" link and a short demo guide.
- [x] **J9 Tests (new routes in `layout.spec.ts`), build log, design review.**

### Batch 1.4 Story and submission kit (PR 4, streams D and F)

PRD: sections 1, 4, 8, 11, 12.

- [x] **S1 "How Blindspot works"** `/how-it-works`: the two journeys as two lanes of five steps, and the engine (two ways in, five steps, four outputs) built from Blade boxes, like `SetupScene`. Linked from the Home header.
- [x] **S2 Copy pass** on Home, setup and guides: the one-line pitch from PRD section 1, DESIGN 22 names.
- [x] **S3 Product note** (`docs/SUBMISSION.md`): problem, solution, decisions and what was left out, success metrics (PRD section 12), and each Track 2 item (signal, why AI beats a rule, the action, what the merchant controls, learning, accuracy, permissions, failure handling, outcome). Draft, complete (the big-brand line is filled), with Eshan's voice edit still open.
- [x] **S4 AI build log** (`docs/AI_BUILD_LOG.md`): the v3 decisions, which tool did what, where Eshan decided. Draft, complete (the big-brand block is filled), with Eshan's review and the session count still open.
- [ ] **S5 Video**, 90 seconds, PRD section 8 order. Every number on screen matches the script.
- [ ] **S6 Final QA:** all routes at 375, 768 and 1440px; full test run; deploy; smoke test https://razorpay-blindspot.vercel.app.
- [ ] **S7 Submit** by 9 pm on 13 Oct.

### Batch 1.5 Two accounts and the product review (13 Oct, Eshan's review of the whole product)

Eshan reviewed every screen on 13 Oct and asked for the product to be evaluated as a product owner would. Decisions: two demo accounts (Kaksha, small business; Flipkart, enterprise) on one dashboard, with every page built for each; customer names stay masked; "Unpaid access" keeps its own page (an ongoing balance, not an incident with a cause and a fix) but is renamed and counted on Overview; build everything, freeze later. One PR per item below, each cut from the foundation branch.

- [x] **T0 CI fix** (#46, `Fixes #45`): two lines that wrapped on CI's fonts, the RazorSense rule measured as one surface.
- [x] **T1 Foundation, two accounts.** `lib/account.ts`, the account picker (`/signin`), the avatar account menu, menus per account, `Mine` for the other account's pages, brand data (`synth/brand_world.py`: FK-1 open, FK-2 Razorpay's side closed, FK-3 charged twice closed, five alerts) read at the engine's API paths, the Overview, Payment issues and issue page for the brand (with "Where it showed up": phone, Sentry alert, Slack thread). The four standalone demo screens are gone; their links land on FK-1.
- [x] **T2 Kaksha fixes from the review.** Welcome slide 2 copy (no "it"); Accuracy: labels regular, numbers bold, card text full width; "What Blindspot cannot see" once per page as one block; chart marks: no empty label pill, marks named for what happened ("Pay page broke", "Alert"); INC-4 fix flow: "Send a link to pay again", a locked step says why ("Fix your pay page first") instead of looking dead; "put right" never counts customers who paid on their own; one "Send to your developer" per page; no raw customer IDs (`cust_o0130`) on screen.
- [x] **T3 How it works becomes Blindspot's landing page.** Hero with the isometric pictures, the two accounts as the two journeys (both built, each opening its account), the engine, and "Why an AI agent" (the "where rules fail" evidence, moved here from Accuracy and rewritten to lead with the point). Accuracy keeps the scores.
- [x] **T4 The brand account's own pages.** Alerts (what Sentry, Datadog, PagerDuty and Razorpay sent, and what became of each: matched, dropped, no impact), Integration (alert door and Slack), Connectors, Settings (approval limits, who signs off), Audit trail. Each joins the brand menu and its Overview Explore cards.
- [x] **T5 Evidence lane and live markers.** The lane redesigned (row icons, softer bars, callouts, time of day); a radar pulse on what is live (the current step, an open issue), still for reduced motion.
- [x] **T6 Unpaid renewals.** Rename "Unpaid access" to "Unpaid renewals", one line on how it differs from a payment issue, its amount on Overview, explain the "access runs to" date.
- [x] **T7 WhatsApp demo as a guided scenario.** Who you are on each side, steps, and a result after each message.

### Cut order if Phase 1 runs late

Cut first: J3 store, the custom date picker in H2, I3 evidence lane restyle, I6 markers, J4 alert screen (show the alert inside the Slack thread instead). Never cut: H1, H3 to H5, H7, H8, I1, I4, A1, S1 to S7. If J2 data cannot be finished, drop the whole J2 batch and say in the note that big brands are the next segment.

---

## 4. Phase 2: pitch build (only if shortlisted)

- [ ] **P2-C1 Contracts v0.13** (integrator; v0.12 is the current version): owner gains `shared` (network, provider or platform); `IncidentSummary` gains `recovered_paise`; new `GET /summary` (range, group by) and `POST /inbound/alert`. `make contracts`, entry in `CONTRACT_CHANGES.md`.
- [ ] **P2-B1 Alert door** (stream C): signed endpoint, Sentry payload mapping, payment filter, grouping, match to payments, "unconfirmed" until matched.
- [ ] **P2-B2 Cross-merchant cuts 2 and 7** (streams A and B): a synthetic multi-merchant world with one shared cloud outage incident, so the product can say "Not you".
- [ ] **P2-B3 Summary endpoint** (stream B); Home switches from browser sums to `/summary` and gains method grouping and rupees recovered.
- [ ] **P2-B4 One live model step** (stream C): reading complaints and alerts into structured fields, rules as the fallback when no key. Labelled messages (Hinglish included) in `eval/`; a rules-against-model report; safety evals (no credentials, no false urgency, numbers match SQL). Pick the model with the `claude-api` skill at the time.
- [ ] **P2-B5 RCA document** (stream C): a fixed template filled from SQL, posted to the Slack view and the console.
- [ ] **P2-B6 Pay-again links**, only if Eshan approves the F10 decision.
- [ ] **P2-W1 Console** on real data (stream D).
- [ ] **P2-F1 Pitch deck and Q&A prep** (stream F).

---

## 5. Phase 3: after the pilot decision

Helpdesk connector (Freshdesk first), PostHog or Amplitude as an alert source, a real Slack app, packaging as an Agent Studio agent, Vulcan baselines, cuts 5 and 6 after the data is verified, a privacy review for cross-merchant counts, plugin merchants if the 10 Oct cut is reversed, AI support bot partnerships, real Razorpay rails and a real WhatsApp number.

---

## 6. What changes and what is new

| Area | Change in the current product | Build new |
|---|---|---|
| Home | Overview becomes a dashboard; setup steps visible; tour and reset in header | Date range, issues chart |
| Incident page | Header, stats, evidence lane, actions restyled | Story strip, "Is it just you?" panel |
| Charts | Markers, normal band, palette, labels, tooltips | None |
| Big brand | None | Store, alert screen, Slack thread, brand incident, console, J2 data |
| Story | Copy pass | How it works page |
| Backend | None in Phase 1 | Phase 2: alert door, summary, shared owner, cross-merchant cuts, model step |

---

## 7. Open questions that block tasks

| Question | Blocks | Who |
|---|---|---|
| ~~Store brand name~~ Answered 12 Oct: use Flipkart's real name, in text only (no logo). It is a demo and not for production | J1 to J8 | Eshan |
| May the prototype change after submission? | Phase 2 plan | Eshan, from the brief or the organisers |
| Pay-again links (F10) | P2-B6 | Eshan |
| Does Razorpay keep payer location or network at checkout? | Cut 5 | Ask a Razorpay PM |
| Does plugin version show on API calls? | Cut 6 | Ask a Razorpay PM |
