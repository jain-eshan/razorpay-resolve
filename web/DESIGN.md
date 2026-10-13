# RazorSense: Razorpay's design language

> **Building anything in `web/`? Read section 20 (design philosophy) first, then sections 14 to 19.** They say how we decide, and they win over anything else in this file when two rules seem to disagree.

The reference for everything we build in this project. Researched 2026-09-29 from the public RazorSense page, razorpay.com, and the source of Blade (Razorpay's open-source design system, `@razorpay/blade` v12.127.0, commit `2ad7317`).

Confidence labels used below:
- **[source]** read directly from Blade code or a Razorpay page
- **[observed]** measured on the live razorpay.com / RazorSense pages
- **[inferred]** our reading of the evidence; Razorpay hasn't said it

---

## 1. The idea

RazorSense is Razorpay's design language "for the humans in the AI era" [source]. Launched March 2026 alongside Razorpay's agentic platform (FTX'26). Its claim is that every interaction carries an emotion, so colour, form, shape and motion should respond to what the person is going through, "like a companion present in every action you take and every doubt you have" [source].

It has two parts:

| Part | Razorpay's metaphor | What it is in practice |
|---|---|---|
| **The Glyph** | "the body", the atomic core | All geometry comes from the Razorpay logo. The logo's strokes lean at ~75°; every RazorSense flute preset tilts 15° off vertical, the same angle. [source + inferred angle match] |
| **The Flutes** | "the brain", the thinking, conversing engine | A fluted-glass surface (slanted glass slits refracting a moving gradient) that changes colour and motion with context. Built in WebGL as Blade's `RazorSense` component. [source] |

Under RazorSense sits **Blade**, the full design system (tokens, 90+ components, web + iOS + Android). In the code, the RazorSense layer is called **"Blade Spark"**. RazorSense is the expressive layer; Blade is the everyday grammar.

---

## 2. Principles

These are our working rules, distilled from Razorpay's stated philosophy and from how Blade actually behaves.

1. **The glyph is the geometry.** Slants, cuts and angles come from the logo: 75° strokes, 15° tilt. Don't invent new angles or decorative shapes.
2. **Every state has a feeling.** Map each product state to one of four emotions (Calm, Joyful, Caution, Regret, section 3) and let colour, motion and copy agree with it.
3. **Blue acts, green thinks.** Azure blue (`#1364F1`) is for the things a person does: buttons, links, selection. Green/mint (`#009E5C`, `#01C171`) is for the intelligence: Ray's icon, the thinking sparkle, streaming text, reasoning steps, success light. Keep them apart. [inferred from consistent source usage]
4. **Alive only where it matters.** The fluted-glass surface is reserved for branded moments: success, AI loading, login, hero. Blade's own docs say not to use it for button feedback or simple transitions [source]. A dashboard that pulses everywhere feels anxious, not alive.
5. **A companion, not a command line.** The product anticipates. RAY's example nudge: "Your ₹94,600 settles Wednesday. Tuesday is a bank holiday. Settle today?" [source]. Surface the next useful action before being asked, then let the human confirm.
6. **Fewest taps to money.** From checkout: prefill, reuse saved instruments, default to UPI, warn about bank downtime before failure, hide risk checks from good users [source].
7. **Errors own the next step.** Razorpay's error catalogue names who caused it (customer, business, gateway, Razorpay) and what to do next, and blames no one [source].
8. **What you see in Figma is what you get in code.** Never hardcode a value that a token covers [source: Blade usage guide].

---

## 3. The four emotional states

Shown as a toggle on the RazorSense page. The emotion names aren't in the code; the matching gradient maps are (Default, Razorpay Green, Warning, Error in Blade's gradient editor). The mapping to product moments is [inferred].

| State | Use it for | What it looks like [observed] | Colours (gradient map) [source] | Motion | Copy tone |
|---|---|---|---|---|---|
| **Calm** | Idle, default, AI thinking, loading, onboarding | Diagonal blue flutes, soft light moving through them | `#8a8fa8 → #1535cc → #2255ff → #55bbff → #88ffcc → #ddfff4 → #ffffff` | Slow continuous drift; Ray glyph turns 90° per beat | Plain, reassuring, present tense |
| **Joyful** | Payment success, money received, task done, activation | Mint-teal light bursting up from the bottom centre | Razorpay Green: `#01C171 → #4FE19E → #4EF8E8 → #AEF4D4` | One upward burst, then settle (`circleSlideUp`) | Warm, short, celebratory ("You're officially in!") |
| **Caution** | Risk, pending review, low balance, irreversible action ahead | Warm peach wash, flutes faint | Warning: `#cc7700 → #ffaa00 → #ffdd99`; UI tint cider `#FFE7D6` / `#FFC9A3` | Slowed, gentle | Specific about the risk and the choice |
| **Regret** | Failure, declined payment, something went wrong on our side | Flat dusty rose, almost no movement | Error: `#cc0000 → #ff3333 → #ffbbbb`; UI tint crimson `#FBE6E4` / `#F6C1BC` | Stillness. It stops performing. | Owns it, names the cause, gives one next action |

Regret is the least obvious one. It isn't "error red, shake the form". The page shows it as the quietest state: the interface slows down and apologises [inferred].

---

## 4. Brand marks

**Razorpay logo mark** (`RazorpayIcon`, viewBox 0 0 24 24, evenodd) [source]
```
M9.71749 12.3339L10.7149 8.66299L21 2L15.4844 22.5753L11.6926 22.5722L15.4262 8.64209L9.71749 12.3339ZM3 22.5756L4.57044 16.7193L13.9519 10.6624L10.7718 22.5756H3Z
```

**Ray glyph** (`RayIcon`, viewBox 0 0 24 24). Razorpay's AI assistant. Used as the agent avatar, the loader (rotates 90° per beat), and the mask for the green fluid gradient [source]
```
M3 3H7.5H9.74999L12 12L14.25 3H16.5H21V7.5V9.75L12 12L21 14.25V16.5V21H16.5H14.25L12 12L9.74999 21H7.5H3V16.5V14.25L12 12L3 9.75V7.5V3Z
```

**Three blues exist. Use the right one.**
| Hex | Where | Use in our product? |
|---|---|---|
| `#1364F1` azure.500 | Blade product UI primary [source] | **Yes**, all UI |
| `#305EFF` | Marketing site buttons [observed] | Only for marketing pages |
| `#3395FF` + navy `#192839` | Logo artwork [source] | Only inside the logo |

---

## 5. Colour

Naming pattern [source]: `{category}.{property}.{colour}.{emphasis}`, e.g. `surface.text.gray.muted`, `interactive.background.primary.highlighted`, `feedback.border.negative.subtle`.
- Categories: surface, interactive, feedback, overlay, popup, data
- Text emphasis: normal > subtle > muted > disabled
- Interactive states: default / highlighted (hover) / disabled / faded / fadedHighlighted

### Key semantic tokens (light / dark) [source]

| Token | Light | Dark |
|---|---|---|
| surface.background.gray.moderate (page) | `#F7F7F7` | `#131415` |
| surface.background.gray.intense (cards) | `#FFFFFF` | `#1F2123` |
| surface.background.gray.subtle | `#F7F7F7` | `#1B1C1D` |
| surface.border.gray.normal | `#C8CDD0` | `#73787D` |
| surface.border.gray.subtle | `#DEE1E3` | `#3B3D40` |
| surface.text.gray.normal | `#050505` | `#FFFFFF` |
| surface.text.gray.subtle | `#292F32` | `#AEB0B2` |
| surface.text.gray.muted | `#616D75` | `#808589` |
| interactive.background.primary default / hover | `#1364F1` / `#0E54CD` | `#4287FF` / `#1364F1` |
| interactive.text.primary.normal (links) | `#0E54CD` | `#75AAFF` |
| AI green, `surface.icon.onSea.onSubtle` | `#009E5C` | `#49D08C` |

### Feedback [source]
| | Solid (intense bg) | Text on light | Subtle bg |
|---|---|---|---|
| positive | `#008F47` | `#00753B` | `#008F47` @ 9% |
| negative | `#D01E11` | `#D01E11` | `#D01E11` @ 9% |
| notice | `#E05E00` | `#C75300` | `#E05E00` @ 9% |
| information | `#008BD1` | `#0070A8` | `#008BD1` @ 9% |
| neutral | `#292F32` | `#292F32` | `#434B51` @ 9% |

Subtle borders use the same hue at 18%. Blade builds tints with alpha, not lighter solid colours.

### Palette ramps (50 → 1000) [source]
- **azure** (primary): `#F5F9FF #D6E5FF #A8C8FF #75AAFF #4287FF #1364F1 #0E54CD #0A44A9 #073688 #052761 #021331`
- **forest** (AI green): `#EBFAF3 #DBF5E8 #B6ECD1 #92E3BA #49D08C #00BD6E #009E5C #008A50 #006B3E #005230 #003821`
- **emerald** (positive): `#E6F4ED #CEE9DB #9CD3B8 #6BBD94 #3AA670 #009954 #008F47 #00753B #005C2E #004724 #00381C`
- **crimson** (negative): `#FDF3F2 #FBE6E4 #F6C1BC #F0968E #E86559 #DF3E30 #D01E11 #AA180E #8D150C #7A100B #620F09`
- **cider** (notice): `#FFF6F0 #FFE7D6 #FFC9A3 #FFA66B #FF8742 #F56D19 #E05E00 #C75300 #AD4800 #8F3C00 #6B2D00`
- **sapphire** (info): `#E7F7FD #CCEBFA #9DD8F6 #6AC6F1 #3BB4ED #00A1E6 #008BD1 #0070A8 #005B85 #004161 #002D42`
- **blueGrayLight** (neutrals, 0 → 1300): `#FFFFFF #F7F7F7 #F7F7F7 #DEE1E3 #C8CDD0 #AFB6BB #96A0A6 #7B878E #616D75 #4F585F #434B51 #373E43 #292F32 #191D1F #050505`
- Chart categorical: azure, emerald, crimson, cider, sapphire, orchid `#8F62F9`, magenta `#D147AA`, topaz `#BD8A00`

Merchant white-labelling: Blade's `createTheme({ brandColor })` generates an 11-step ramp from any colour and swaps only the primary tokens. Text on brand flips black/white for contrast [source].

---

## 6. Typography

| Role | Font | Notes |
|---|---|---|
| Headings, display | **TASA Orbiter** (web) / TASA Orbiter Display (native) | Geometric sans, free on Google Fonts, variable 400–800 |
| Body, UI | **Inter** | Marketing pages use Inter Tight [observed] |
| Code | Menlo, SF Mono, monospace | |

**Scale** (token: size / line-height px, desktop → mobile) [source]
| Token | Desktop | Mobile | Used by |
|---|---|---|---|
| 25 | 10/13 | 10/13 | body xsmall |
| 75 | 12/17 | 12/17 | body small, button small |
| 100 | 14/20 | 14/20 | **body medium (default)** |
| 200 | 16/24 | 16/24 | body large, button large |
| 300 | 18/24 | 16/22 | Heading small |
| 400 | 20/26 | 18/24 | Heading medium |
| 500 | 24/32 | 20/26 | Heading large |
| 600 | 32/38 | 24/32 | Heading xlarge |
| 700 | 40/46 | 32/38 | Heading 2xlarge |
| 800–1100 | 48/56, 56/64, 64/70, 72/78 | 34–40 | Display small → xlarge |

- Weights: 400, 500, 600 (headings default to semibold 600), 700.
- Letter spacing: body −1.3%; body large −3.3%; display −1.3% when medium/regular weight.
- Hero headings may carry one italic serif phrase (section 21).
- The RazorSense page itself sets huge headlines in TASA Orbiter **regular 400 at −4% tracking** (88px / −3.52px; 48px / −1.92px) in near-black `#131313` [observed]. That's the "expressive" register: light weight, tight, large. Product UI stays at semibold, 0 tracking.

---

## 7. Space, shape, depth

- **Spacing** (token → px) [source]: 1=2, 2=4, 3=8, 4=12, 5=16, 6=20, 7=24, 8=32, 9=40, 10=48, 11=56. Base unit 4, with 2 for fine adjustments. Card padding default is spacing.7 (24px).
- **Radius** [source]: 2xsmall 2, xsmall 4, small 8, medium 12, large 16, xlarge 20, 2xlarge 24, max 9999. Buttons 8 (large button 12). Cards 12. Chat input and chat bubbles 16. (Blade's MCP docs list an older, smaller scale. Trust the source values here.)
- **Border widths**: 0.5, 1, 1.5, 2.
- **Elevation** (light) [source]:
  - lowRaised `0 2px 4px 0 rgba(41,47,50,.06)`
  - midRaised `0 16px 12px 0 rgba(41,47,50,.06)`
  - highRaised `0 8px 24px -4px rgba(41,47,50,.06)`
  - Shadows are barely there. Depth comes from 1px borders and inner highlights more than drop shadows.
- **Card surface** (the Spark look) [source]: `0 6px 32px 4px hsla(205,8%,71%,.06)` + inset 1px hairline + a white top highlight, with a subtle white→`#F7F7F7` gradient at the top and bottom edges.
- **Backdrop blur**: 4 / 8 / 12px.
- **Breakpoints** (min-width): xs 320, s 480, m 768 (desktop starts here), l 1024, xl 1200. Mobile-first.

---

## 8. Motion

Blade's motion RFC: "If two balls thrown up with the same force come back down in the same manner, why should two buttons on a UI react differently" [source]. Motion is systematic: every animation is a duration token + easing token + optional delay.

**Durations** (ms): 2xquick 80 · xquick 160 · quick 200 · moderate 280 · xmoderate 360 · gentle 480 · xgentle 640 · 2xgentle 960
**Delays** (ms): 80 · 160 · 280 · 480 · 960 · long 2000 · xlong 3000 · 2xlong 5000

**Easings** [source]
| Name | Curve | For |
|---|---|---|
| entrance | `cubic-bezier(0, 0, 0.2, 1)` | things appearing (modals, dropdowns) |
| exit | `cubic-bezier(0.17, 0, 1, 1)` | things leaving |
| standard | `cubic-bezier(0.3, 0, 0.2, 1)` | morphs, shimmer, general |
| emphasized | `cubic-bezier(0.5, 0, 0, 1)` | hover, Ray rotation, rolling text |
| overshoot | `cubic-bezier(0.5, 0, 0.3, 1.5)` | toasts |
| shake | `cubic-bezier(1, 0.5, 0, 0.5)` | error shake |

**Presets**: Fade (opacity, 160ms) · Move (fade + 16px rise, 360ms in / 200ms out) · Scale (1.05 up / 0.98 down, 280ms) · Elevate (to lowRaised, 280ms) · Stagger (80ms between children). Button press scales content to 0.95.

**Signature RazorSense motions** [source]
- **Ray thinking**: glyph rotates 90°, 480ms, emphasized easing, 480ms pause, repeat.
- **Rolling text** (cycling "Checking settlements…" style status lines): new line rises 16px with a 4px blur clearing, 360ms emphasized, every 3s. Text carries a green shimmer.
- **Shimmer** on the active reasoning step: a light band sweeps across the text, 960ms standard, 480ms pause.
- **Streaming AI text**: each word fades in from green `#48D08C` with 2px blur to the normal text colour, 300ms.
- **Insight reveal** (AI-generated cards and tables): a green conic "gradient ring" travels around the card border (1s loop, cyan `hsl(180 85% 65%)` → green `hsl(145 75% 45%)`), fades out after ~1s over 3s; content wipes in diagonally at 135°.
- **Button loading**: three dots, 1.2s loop, 150ms stagger, dots rest at 42% opacity.
- **Skeleton**: pulses between gray.default and gray.highlighted, 960ms.

**Live pulse** (ours, 13 Oct 2026, Eshan asked for the timeline dots to move "like a radar"): `components/Pulse.tsx`. A ring grows from the marker of what is live now and fades out (scale 1 to 2.2, opacity 0.55 to 0, two 2xgentle beats with entrance easing, then an xgentle rest), and repeats. It goes on the story strip's "now" step, the Timeline's last step while it is still to do, and the end of a lane stretch with no end yet: one per area, never on a finished step. `LiveStepIndicator` is Blade's `StepItemIndicator` with the ring, for a `StepItem` marker. Reduced motion shows a still, faint ring at 1.5 times the marker, so what is live still shows. It is the one thing allowed to keep moving while the merchant reads (section 21), because it is small, slow and says "still happening".

**Our rule** (Blade doesn't enforce this everywhere): honour `prefers-reduced-motion`. Replace motion with instant state changes and show a static pose.

---

## 9. Components

Build with Blade components where possible. Key specs:

**Button** [source]
- Variants: primary / secondary / tertiary. Colours: primary, white, positive, negative. No tertiary + positive/negative.
- Heights: xsmall 28, small 32, medium 36, large 48. Horizontal padding 8/8/12/16. Radius 8 (large: 12).
- Primary has a subtle "3D" look from stacked inset shadows: a darker line at the bottom edge, a faint white highlight at the top. Secondary: 1px gray border + faint inner shadow.
- Loading = three-dot loader, not a spinner.

**Card** [source]
- Always white (`gray.intense`), radius 12, padding 24, Spark surface shadow (section 7). Selected = 2px primary ring. Header / Body / Footer slots.

**Chat input** ("Ask Ray anything related to Razorpay") [source]
- One rounded box (radius 16, highRaised shadow): textarea up to 200px tall, "+ Upload file" link bottom-left, round primary submit bottom-right that turns into a Stop button while generating. Caret is AI green. Ghost suggestions cycle every 4s; Tab accepts.
- Submit disabled when empty or while a file is uploading.

**Chat message** [source]
- Your messages: right-aligned, white bubble, radius 16, padding 16, very light shadow. Ray's messages: left-aligned, no bubble, Ray glyph in AI green as the avatar. Footer actions (copy, thumbs) only on Ray's messages.

**Thinking state = reasoning traces** [source, name mapping inferred]
- A vertical list of steps. Done: small 6px green dot. Active: spinning green 4-point sparkle + shimmering label. Pending: faded dot. Connector lines turn green as steps complete.

**Insights = AI-generated cards/tables** [source, name mapping inferred]
- Rendered from the model's JSON through Blade GenUI (text, chart, table, card, badge, amount…). Enter with the gradient ring + diagonal wipe. Spacing: 8px heading→text, 24px between blocks.

**Skeleton loader**: match the final content's exact size; mark the parent `aria-busy`; never mix with spinners.

**Progress bar**: linear or circular (24/48/72px). Colours come from feedback tokens. Indeterminate only for linear.

**Success state** [source]: `circleSlideUp` RazorSense animation, then the heading and details stagger in (fade + rise 20px, 0.5s).

**RazorSense surface** [source]: WebGL, web-only, needs `preloadRazorSenseAssets()`. Presets: `default`, `zoomed` (badge close-up), `bottomWave` (decorative strip), `rippleWave` (Ray loading), `circleSlideUp` (success). Dark mode switches automatically. Falls back to static on weak GPUs.

---

## 10. Voice and tone

Razorpay's design team writes for **three personas** [source: Razorpay.Design, "Copy Reimagined", Oct 2025]:
- **Merchant** reviewing settlements: calm, exact, numbers first
- **Buyer** racing through checkout: short, zero friction
- **Admin** configuring: precise, complete, no hand-holding

They run copy through an internal tool (ToneBlade) that rates it and rewrites it per persona. Their stance: "users experience your product through words."

| Register | Sounds like | Real examples [source] |
|---|---|---|
| Marketing | Confident, punchy, numbers, title case | "India's All-in-One Finance Platform" · "Turn every chat into a checkout" |
| Developer | Plain, precise, code first | "built for developers by developers" · "Take me to the Code" |
| Docs | Task first, prerequisites up front | "Before you proceed:" · "Follow these integration steps:" |
| AI companion (RAY) | Proactive, specific, one question at a time | "Your ₹94,600 settles Wednesday. Tuesday is a bank holiday. Settle today?" |
| Errors | Cause + next action, no blame | "The customer has entered an incorrect OTP" → retry with the correct OTP |

**Indian context**
- Rupee amounts use lakh/crore grouping: ₹1,50,000, ₹50L, ₹2.4 Cr.
- UPI is the default payment language (UPI ID, AutoPay, Turbo UPI).
- GST, TDS, COD and RTO are everyday vocabulary for merchants.
- Product copy is English. Indian languages appear as localisation (checkout supports Hindi, Marathi, Gujarati, Tamil, Telugu). RAY accepts Hindi voice notes. No Hinglish found in product UI.

**Writing rules for this project**
- Lead with the number or the outcome.
- One action per message.
- Say who needs to act (you, your customer, the bank, us).
- Don't write "Oops" or "Something went wrong" without a cause and a next step.
- Sentence case in product UI. Title case only for marketing headlines.

---

## 11. Product context

**Razorpay**: founded 2014 (Harshil Mathur, Shashank Kumar), Bengaluru. RBI-authorised payment aggregator. Serves millions of businesses (its own pages say 5M+; press reports ~12M). FY25 revenue ₹3,783 cr. IPO filing in progress (June 2026). Stated goal: become "a financial operating system for businesses".

**Suite** (as the site groups it)
- **Build AI native**: Agentic Payments, Agent Studio (built on Anthropic's Claude Agent SDK), Payments for AI builders, Agentic Business Banking
- **Accept payments**: Gateway, Links, Pages, Button, QR, POS, Subscriptions, UPI AutoPay, Smart Collect, Invoices, Optimizer, International, Magic Checkout, Turbo UPI, Instant Settlements
- **RazorpayX**: Payouts, Current Account, Escrow, Payroll, Tax payments, Corporate cards
- **Capital**: Line of credit, lending
- **Other**: Rize (for founders), Curlec (Malaysia), Singapore, US

**AI timeline**
- Oct 2025: agentic payments in ChatGPT (with NPCI)
- Mar 2026: Agentic Experience Platform, Agent Studio and RazorSense
- Aug 2026: Vulcan, a payments foundation model
- Sep 2026: RAY on WhatsApp, an AI account manager that works in English and Hindi

**Users**: developers, SMB founders, D2C brands, finance and ops teams, enterprises, CAs.

**Pains Razorpay names itself**: manual reconciliation, failed payments and subscription churn, chargeback deadlines, cart abandonment, RTO losses on COD, no CFO for cash-flow forecasting, slow onboarding. **Public complaints**: settlement holds, KYC rejections, slow support. Trust around held money is an open gap.

**Checkout principles**
- Overlay, never redirect
- Prefill and autofill
- OTP auto-read
- Saved cards and UPI IDs shared across the network
- UPI intent first
- Show bank downtime before the payment fails
- Retry suggests the next best method
- Risk checks invisible to good users (COD only for low-risk shoppers)
- Merchant brand plus a Razorpay trust badge

---

## 12. How we build

1. **Use Blade.** This repo runs `@razorpay/blade` directly (`BladeProvider` + `bladeTheme`, see `src/main.tsx`). Razorpay's rules for AI coding tools, served through the Blade MCP server in `.mcp.json`:
   - Fetch the component docs first.
   - Use Blade components only.
   - Lay out with `Box`, using `spacing.N` tokens for spacing.
   - Pass minimal props.
2. **Emotional states in code.** `src/razorsense.ts` holds the four states as Blade gradient maps. Pass one to `<RazorSense gradientMapCanvas={...} />`. Regret sets `paused`.
3. **Check every screen against this list**
   - Is blue only on things you can act on?
   - Is green only on AI or success?
   - Does each state map to Calm / Joyful / Caution / Regret?
   - Is the RazorSense surface used at most once per screen, on a moment that deserves it?
   - Are all values tokens?
   - Is reduced motion handled?
   - Do errors name the cause and the next step?
   - Are amounts in ₹ with Indian grouping?

---

## Sources
- https://razorpay.com/razorsense/ · https://razorpay.com/ · https://razorpay.com/about/
- https://github.com/razorpay/blade (tokens: `packages/blade/src/tokens/`; Spark: `src/components/Spark/`; AI rules: `packages/blade-mcp/knowledgebase/`)
- https://razorpay.com/blog/razorpay-agentic-platform/
- https://razorpay.com/blog/meet-ray-your-always-on-ai-account-manager-now-live-on-whatsapp
- https://razorpay.com/foundation-model/
- https://www.figma.com/customers/razorpay-boosting-design-system-adoption-and-collaboration/
- https://medium.com/razorpay-design/copy-reimagined-how-i-built-a-figma-plugin-to-write-contextual-ux-copy-e59918c0da41
- https://razorpay.com/docs/errors/payments/ · https://razorpay.com/docs/payments/payment-gateway/features/ · https://razorpay.com/magic/
- https://www.businesstoday.in/latest/corporate/story/idea-is-to-evolve-razorpay-beyond-a-payments-provider-into-a-financial-operating-system-for-businesses-says-harshil-mathur-520358-2026-03-12

---

## 13. How the live dashboard composes pages (observed 6 Oct 2026)

Read from the logged-in test-mode dashboard (home, Transactions, a payment detail page). Values are computed styles, so they are [observed]. The modern pages are built on Blade, so the tokens in sections 5 to 7 hold. What this adds is composition. The Webhooks settings page still uses an older style (2px radius, a different blue) and is not a model.

**Shell.** A 56px black top bar (Blade `TopNav`, default variant) with the logo, product tabs, a search field and an avatar. A left side nav (Blade `SideNav`, 240px, 264px from `xl`) under it: 40px items, 8px radius, 12px side padding, 2px vertical margin, icon plus label, active item a grey fill (`#434B51` at 9%). A 10px/500 uppercase section label above groups. Page content sits on `#F7F7F7`, cards on white. A single settings item and a mode switch live at the bottom of the nav.

**Page anatomy (payment detail).** A blue "Go back" link or a breadcrumb. One summary card: a 56px tinted status tile, the headline, a pill tag. Under it, two columns: a Details card (label left, value right, thin dividers) and a Timeline card with a vertical list of dated steps, green when done and orange when pending, and one call to action at the bottom.

**List anatomy (Transactions).** A row of small stat cards (title 14/600 with an info icon, big value, one muted line), then tabs, filter chips, and a table.

**Measured values.**
| Thing | Value |
|---|---|
| Body text | Inter 14/20, `#58666E` |
| Card title in a header band | 18/600, `#050505`, band `#F7F7F7`, padding 16px 20px, radius 12px 12px 0 0 |
| Card | white, radius 12px, padding 24px, 1px `#DEE1E3` ring plus `0 6px 32px 4px rgba(175,182,187,.06)` |
| Table header | 14/600 `#58666E`, 37px high |
| Table row | 48px high, cell padding 0 12px, second line 12px `#616D75`, row hover grey |
| Filter chip | 28px, radius 8px, 1px dashed `rgba(67,75,81,.18)` |
| Status tag | pill (radius 9999px), 24px high, 9% tint of the status colour, an icon, 12px text |
| Primary button | `#1364F1`, radius 8px, 14px, layered inset shadows |
| Link | `#0E54CD`, 14/500 |
| Page title (home) | TASA Orbiter 32/38, 600 |

**What we did with it.** `web/src/components/Shell.tsx` (used by `App.tsx`) uses Blade `TopNav` and `SideNav`. `components/Panel.tsx` is the header-band card (the fix steps, evidence, replay, customers and settings all use it), `Stat.tsx` the small stat card, `Crumbs.tsx` the breadcrumb. The incident page follows the payment detail page: summary card, stat cards, a Details-style main column and a sticky Timeline (`StepGroup`) on the right. The incident list, scan, audit log and eval checks use Blade `Table`.

Blade gotchas found while building it: `Card` accepts only `CardHeader`, `CardBody` and `CardFooter` as direct children; `InfoItemValue` does not style plain strings, so wrap values in `Text`; `SideNav` is `position: fixed` with `height: 100%`, so a `top` offset pushes its bottom (and the Settings link) off screen; pass `position="relative"` and put it beside the content in a flex row instead. Put the links straight inside `SideNavBody`: `SideNavLevel` adds a 56px left margin meant for the second-level menu. Blade also assumes `box-sizing: border-box` everywhere (`index.html` sets it), otherwise `TopNav` is wider than the window and clips the avatar; `SideNavLink as={Link}` receives React Router's `to`, not `href`; `TableRow onClick` is not a dependable way to navigate, so put a real link in the row.

---

## 14. The product is an addition to the Razorpay dashboard

Resolve is not a separate app with its own look. A merchant should feel it was always part of the dashboard they already use. Everything Razorpay already ships stays exactly as it is in production. Resolve is added next to it.

Source of truth for the shell: `src/components/Shell.tsx`. Read it before touching navigation.

**Top bar** (Blade `TopNav`, black, 56px)
- Left: the official Razorpay lockup, blue and white for the black bar (`web/public/razorpay-logo.svg`, taken from the header of razorpay.com). It is one drawing with its own spacing: never Blade's single-colour `RazorpayIcon` beside the word as text. Never the product name.
- Everything on the bar sits on its vertical centre line at every width. Blade's `TopNavBrand` (`paddingY`) and `TopNavActions` (sized around the 36px search field) do not do this on their own below `xl`; `Shell.tsx` compensates, and `e2e/shell.spec.ts` measures it at 375, 768 and 1440px.
- Product tabs, in production's order: Payments, then **Resolve** (our tab, active, with a green `BETA` badge in `titleSuffix`), then Banking+, Payroll, More. Production tabs are shown and inert.
- Right: search field (xl screens and up), activity icon, announcements icon, avatar. All inert except the avatar.
- Below the `l` breakpoint the tab strip is hidden (five tabs need about 570px beside the logo and actions, and at 768px `overflow` used to cut Payroll in half and hide More), below `xl` the search is hidden, and below `m` a menu button opens the side nav drawer.

**Side nav** (Blade `SideNav`, in this order)
1. Home, Transactions, Settlements, Reports: production, inert.
2. `RESOLVE` section: Overview, Payment issues, Customer complaints, Unpaid renewals (Kaksha only), Integration. Ours, live. Integration is one item with two steps, Build with AI (`/connect`) and the go-live check (`/release-check`), shown at the top of both pages by `components/IntegrationSteps.tsx`.
3. `CONTROL` section: Connectors, Settings, Alert tuning, Audit trail, Accuracy. Ours, live.

The first check (`/scan`, once called Day-0 scan) is not in the menu: it is the end of Setup and a link from Overview and Ray. The names come from Razorpay's own (section 22). Routes kept their old paths so links keep working.
4. `PAYMENT PRODUCTS` section: Payment Links, Payment Pages, Razorpay.me Link, then "+11 More" (`maxVisibleItems={3}`). Production, inert.
5. Footer: Test Mode switch (on, inert) and Account & Settings (inert).

**Inert means greyed, not hidden.** Anything that exists in production but not in this prototype is drawn at half opacity with a not-allowed cursor and cannot be clicked. It tells the viewer "this is the real dashboard" without sending them to a dead page. Do not remove these items and do not make them navigate. Use `InertItem` in `Shell.tsx`.

**Adding a screen.** Add one entry to `RESOLVE` or `PROOF` in `Shell.tsx` and one `<Route>` in `App.tsx`. Do not add a new top-bar tab and do not edit the production items.

**How a new Razorpay product sits in the dashboard** (observed 7 Oct 2026 on Agent Studio, which is the closest precedent): a side nav item with a green `Beta` pill, and a product home with page-level tabs on the left (Home, My Agents, Connectors) and a `Beta` pill on the right. The home has a hero carousel, an "Explore" heading with filter chips, then a grid of cards: a small icon and name at the top, one bold sentence, a divider, then a footer row with a chevron. Our Ray home follows the same order (section 16).

**Blade gotcha.** `TabNav` unmounts tabs that overflow and then crashes when their size updates are still queued ("Cannot read properties of undefined (reading 'width')"). `Shell.tsx` therefore renders all five tabs on every render and ignores the `items` argument. Keep it that way.

---

## 15. Page templates

Every screen is one of these. Pick one before you write any layout code.

**All pages**
- Content sits on `surface.background.gray.moderate` (#F7F7F7), inside a column at most 1120px wide, padding `spacing.5` on mobile and `spacing.7` from `m`. This lives in `App.tsx`. Do not set your own.
- Start with `<PageHeader title description guide actions />` (`components/PageHeader.tsx`). It gives the 24-32px heading, one muted line, an optional "How it works" button that opens the product guide, and room for actions on the right. Do not write your own heading block.
- Vertical rhythm: `spacing.6` between blocks on data pages, `spacing.7` on pages with explainers, `spacing.9` between major sections of a home page.
- Cards are white, radius 12, padding 24, with Blade's own border and shadow. Never draw a card from a `Box` with a border. Use `Card`, or `Panel` (`components/Panel.tsx`) for a card with a grey header band.

**List page** (Payment issues, Customer complaints, Audit trail): PageHeader, optional stat cards (added up from the rows, with a hint when part of a total is an estimate), then a `Panel` containing a Blade `Table`. Below `l` a table whose key figures sit on the right becomes one card per row (Payment issues), so the figures are not pushed off the side. An empty group says why it is empty. Rows are 48px, cells have 12px side padding, a second line under a value is 12px muted. The row's identifying text is a real link. Status goes in a `Badge`.

**Detail page** (a payment issue; v3 batch 1.2): the same order for all four kinds (webhook, charged twice, renewals, pay page), because the merchant should read any of them the same way. Top to bottom: the breadcrumb; one summary card (status tile, headline, owner and status badges); the **story strip** (`components/StoryStrip.tsx`: Hear, Find everyone, Whose side, Fix, Win back, each with the issue's own number, done steps ticked, the next one marked "now"; five across from `xl`; two across from `m` with the fifth tile spanning both; one on a phone. The Fix tile reads "N of M put right", where N is only what Resolve's approved actions did: access given back or a second charge refunded once confirmed, a pay-again link once the customer paid through it. A customer who paid again on their own, or whom the merchant had already handled, is never counted; the tile's note says them instead ("1 paid on their own", "4 fixed by you"), and the status when there is no one to say. Its tick reads the live group counts, so it agrees with "still to put right" below it); the one plain-words answer box; the **three numbers** (`IncidentStats`: customers hit, money stuck, never wrote in); then two columns, the content on the left and a sticky Timeline on the right. The left column runs: the chart of what happened (units on the axis, at most four gridlines, a line where it started, the shared compact key; every line is named for what happened, "Pay page broke", "Webhooks fixed", never "Started" or "Ended"; a mark too close to another or to the right edge is not drawn, because Blade draws an empty 80px pill on a line with no label, and the key says it with its time instead, "Too close to mark on the chart: Webhooks fixed (Thu 01 Oct, 11:34)"; value ticks in three equal round steps); **What happened, from each side** (`EvidenceLane`, redesigned 13 Oct: rows for your side, your server or app or pay page, Razorpay, the alert tool and Resolve on one time axis. Each row starts with a grey icon on a white disc for whose it is (colour stays for the outcome), rows sit on alternating bands, a stretch is a soft fill in its outcome's colour with no outline and its label in that colour, a moment is a solid dot centred on its time with its label (and its time of day on a fixed axis). A light dashed line marks the start and runs under the dots and labels. The axis is quiet: round times where they fit (every 15 minutes to every few days, in India's time), and the day said once in the subtitle. A stretch with no end yet carries the live pulse at its end. A list on a phone and in any card narrower than 520px, with the same icons and dots); **Is it just you?** (`JustYou`: up to three plain sentences, strongest first, the bars behind "Show the numbers", a line saying other merchants are not compared yet, and at its foot the one "What Resolve cannot see" block: the label once, the caveats as a short list); **Root cause | Actions** side by side when their column is 640px or wider, stacked below that (`RootCauseActions`: cause, what changed, the fix and whose side from the evidence pack; the actions that wait for approval with the page's one blue button, and the page's only "Send to your developer", beside the fix the developer ships, or "Open the evidence pack" when it is Razorpay's side); then the customers table, the side-by-side samples (each headed by the customer's masked name and amount, never the engine's `cust_` id) and the fix steps. The page loads the evidence pack with the incident, so no card grows as it arrives. "What Resolve cannot see" and "Send to your developer" are each said once on a page.

**Fix steps say what the merchant gets.** A step's heading names the result in the merchant's words ("Send customers a link to pay again", "Give customers their access back, 5 first", "Tell customers about their refund"), not the mechanism ("Payment links, a few at a time", "Test run"). A step that cannot run yet shows its button disabled with the reason under it and the way to clear it ("Fix your pay page first, then wait for 2 hours of healthy checks"), and a badge "Locked"; it never makes a draft that cannot be sent. Whatever holds an approved plan back is said in an Alert with the button that clears it.

**Stat cards**: the label is regular and muted, only the figure is bold (`components/Stat.tsx`, every page). A card's own text uses the card's width; the 720px measure is for the page header's line only.

**Two accounts** (13 Oct 2026, replacing the big-brand demo pages of batch 1.3): one dashboard, two demo merchants, and a judge sees every page as either. Kaksha is a small business that hears from customers (WhatsApp, Instagram, email) and gets Ray on WhatsApp; Flipkart is a big brand that hears from its own alert tools and works in a shared Slack channel. The way in is the account picker (`/signin`, outside the shell, under a dark bar with the logo): two selectable cards with a picture, the account's logo and name, a short write-up of the company and one on who it stands for, three lines on what you will see, one blue "Continue as". Each account has a square logo (`AccountLogo`, files in `public/brand/`): Kaksha's is drawn for the demo, Flipkart's is its own bag icon. It has no password field or anything to type, so it cannot pass for a real login. A first visit to Overview opens it; every other address opens as Kaksha, so a shared link always works, and `?account=flipkart` picks the brand. The avatar opens the account menu (who you are, "Switch to" the other, "See both demo accounts"), as Razorpay's own does. The side menu lists only the pages that account uses (`only` in `Shell.tsx`): a shopping app has no customer complaints through Resolve and no renewals. A page of the other account, opened by its address, says whose it is and offers the switch (`components/Mine.tsx`); it never shows one merchant's data inside the other's dashboard. The brand account's issue pages use the same parts in the same order as every issue page, plus "Where it showed up": what the customer's phone said, the alert as the brand's tool sent it, and the Slack thread, each a framed Blade card with the tool's name in text (no logo, no look-alike colours). Approvals there are this tab's only and say "No refund is made and no message is sent". The message to customers cannot be approved before the orders are confirmed, because "your order is confirmed" would be false.

**Settings page**: one `Panel` per topic, label above value, the control on the right, one Save button at the end. Read-only snapshots say so in an `Alert`.

**Home page** (Overview): a dashboard like Razorpay's own home (section 16): the header with the date range, Ray's one-line field, the setup card until setup is done, four cards, the open payment issues beside the issues chart (half and half), then the Explore cards and Ray on WhatsApp.

**Landing page** (How Resolve works, `/how-it-works`, 13 Oct 2026): the one page that explains the whole product, inside the shell, the same for both accounts. Built on the guide's hero slide (section 16): a crumb, then a hero card with the picture inset on the wash and, beside it from 840px of its own width, a green rule and the page name, the pitch as the h1 with one accent phrase, one supporting line and the two ways in (one blue, one secondary), each signing into its account before it opens Overview. Then sections `spacing.9` apart, each a large h2 and one muted line above its card: the two journeys (one card per account, picture, the five story-strip steps on a numbered line, one honest note, a secondary way in), the engine (step 1, Hear, as the ways in; steps 2 to 5 with a picture each; where the answer lands; as bands on one card with an arrow on a hairline between them, items without borders, icons on the wash). A page names the five steps one way only, the story strip's: Hear, Find everyone, Whose side, Fix, Win back, and no picture appears twice on it, "Why an AI agent" (its purpose in the section line, the point as a heading, the figures beside it, three cards of evidence, all from the eval report; while the report loads the card draws its own frame at the loaded size, with long text from the data held to a fixed number of lines) and "Today and in production". A section never caps its words at 720px inside a wide card: words and figures share the width, so no dead band is left on the right. Something not built is said once, in plain words, where it matters (the Flipkart journey's note), not as a badge on every part. Light motion: the hero and journeys rise 16px and fade in, 360ms, 80ms apart; nothing below the fold waits for a scroll, so a full-page screenshot shows every section.

**Chat page** (Ray, `/ray` and `/ray/:id`): the side menu stays (it is one page of Resolve, and the menu is the way to every other page), with Overview marked as where you are. A toolbar at the top, sticky, with "Overview" (back) on the left and "History" and "New chat" on the right. The thread sits in a centred column, the input is pinned at the bottom on a white surface over a faint wash. Razorpay's own Ray page drops its side menu and keeps a thin rail with a hamburger and a plus; we did not copy that, because a visitor would have no way back. See section 17.

**Agent answer**: section 17.

**Buttons.** One primary (blue) per view, or per card when each card is its own decision. Everything else is secondary. "Back", "Skip", "Cancel" are tertiary. Primary buttons that move forward carry a right arrow. Sizes: `medium` in cards and tables, `large` for the single main action on a page or a guide.

**Status colours.** Green positive, orange notice, red negative, grey neutral, always through `Badge` or `feedback.*` tokens. Overdue and failed text is red, never bold red on a red background.

**Numbers.** Rupees with Indian grouping through `rupees()` in `lib/api.ts`. Counts are plain integers. A figure that the agent states must come from the data, not from a model.

**Loading, empty and error.** A page loading its data shows `components/PageSkeleton.tsx` (Blade `Skeleton` shapes where the title, a row of figures and the first card will be), never a bare "Loading" word. Ray working shows `Analyzing` with the turning glyph. Never a spinner next to a skeleton. Empty says what is missing and what to do: a page with nothing in it yet uses Blade `EmptyState` (size `large`) with a picture from `lib/art.ts` (`GuideArt`) and one button to where the first entry comes from (Audit trail, your side of the WhatsApp demo). An empty group inside a page says why it is empty in one muted line. Error names the cause and the next step.

**Proof pages lead with the answer.** A page that proves something (Accuracy) opens with the score as a heading in a card, then a few checks in plain words as stat cards, then the full table behind "Show all".

---

## 16. Guides, onboarding and the Overview

**Product guide** (`routes/GuidePage.tsx`, content in `lib/guides.ts`). Copied from Razorpay's Smart Collect and Checkout Rewards guides, plus the "Get started" strip from the Subscriptions page. A guide answers three questions for someone who has never heard of the product: what is it, why use it, how do I use it. One slide each.
- Slide 1, what it is: on the left a picture on a soft blue-to-green wash (`GuideHero`), on the right a short green rule and "Razorpay", the product name, one paragraph that starts from the merchant's problem, two or three figures read from the data (`lib/guideStats.ts`), a line saying the data is simulated, and a primary "Read more".
- Slide 2, why: "What makes X great?" for the product, "Why it helps" for a page, three cards in the shape of the product cards on the dashboard home ("Ready-to-use products"): a white Blade `Card`, a light panel inset in it with a picture, a bold title, one line of darker body text. Two links at the top right; then a tertiary "Back" and a primary "See how to use it".
- Slide 3, how: "How to use X" (or "How to use it"), three cards in the same shape as slide 2, each with a neutral chip ("Step 1") between the picture and the title, then "Back" and a primary "Get started".
- From 1280px (Blade's xl) the guide is a carousel and all three slides are the same height (548px), so the card does not change height as you slide. Back and Get started sit at the bottom of the slide, and the arrows have room inside the card. Below 1280px the content column is too narrow for columns (about 480px at 768px and about 780px at 1024px with the side nav showing) and the three slides are very different heights, so the guide shows only the active slide, one column, as tall as its content, with dots under it and the same in-slide buttons. A carousel there left a blank band of 300 to 500px. Content that is short and tall means the pictures are too small or the card is too big; fix that rather than leaving a gap.
- Below the card: "Skip and get started". Dots under the carousel.
- **Pictures** are images, not drawings (Eshan's call, 11 Oct 2026: no illustrations drawn by the agent). Eighteen were made by an image model from briefs in Razorpay's illustration style, matched to Smart Collect's hero: flat isometric vector, Razorpay blue with an azure-to-cyan gradient, white surfaces, one orange accent for the problem, no text. They live in `public/art` as WebP at display size (1.7 MB in all; the originals are about 27 MB and stay out of the repo), listed with alt text in `lib/art.ts`. Heroes (4:3) lead each guide (`GuideHero`), the welcome pop-up and the first check. Spots (2:1) fill a card's picture panel (`GuideArt`) and empty states; a card names its picture by idea, so one picture serves every card about it. Every panel sits on the same mint-to-blue wash (`useHeroWash` in `components/iso.tsx`), so pictures with and without their own background look alike. A new picture: write a brief in the same style, save it as WebP at 1200px wide, add it to `lib/art.ts`.
- **Welcome pop-up** (`components/WelcomeTour.tsx`, a Blade `Modal`): three slides in the PRD's own words ("Find every customer a payment problem hit", "Know whose side it is, with proof", "Fix it and win customers back, with your approval"), then "Set up in 3 steps", which goes to Setup, then the first check, then the biggest payment issue. It replaced the "Take the tour" card. It opens once each time the app is opened or reloaded (Eshan's call; production would show it once per merchant), and "Take the tour" on the setup card opens it again. The picture and text keep one height on every slide so the window never jumps. Every sentence names its subject (Resolve, you, your customers), never "it" pointing back: the merchant reads it once, cold (Eshan, 13 Oct; `e2e/guides.spec.ts` checks). Automated browsers skip it unless the address has `?welcome` (`lib/setup.ts`).
- Every page in the side menu opens its own guide from `<PageHeader guide="..." />`. Slides 2 and 3 use Razorpay's headings ("What makes X great?", "How to use X") only for the product name; a page named with a plain noun says "Why it helps" and "How to use it", or its own `why` and `how`.
- To add a guide: an entry in `GUIDES` (each card and step names an `art` id from `lib/art.ts`), a hero in `HERO` in `lib/art.ts`, and a figure rule in `guideStats.ts` if it has one. Every sentence must be true of the product today. Every figure comes from the data, never typed.

**First-run setup** (`routes/Setup.tsx`). Copied from Razorpay's merchant onboarding.
- Left card: "Setup:" and the product name, then a vertical `StepGroup` (done is green, current is blue, later is grey).
- Right card: a Back link, a large heading, one muted line, the one question for this step, a full-width blue Continue at the bottom, a small muted note under it.
- One question per screen. Three steps at most.
- The choices are cards you can pick (Blade `Card` with `isSelected`; three across from 1280px, stacked below): channels (pick any) each with its own Blade icon, approval levels (pick one: Review first, Approve once, Full automation) with "Start here" on Review first. Step 3 shows the scan result as two large figures and an alert. A short note under the choices says what stays true whatever you pick.
- The two cards stretch to one height, and the left card ends with a moving picture for the current step that answers the question as you answer it (`components/SetupScene.tsx`): the channels you tick light up and send messages to Ray, the autonomy level decides whether messages stop at you, and the first scan sweeps the customers. Still for people who ask for less motion. The heading stays in the same place on every step.
- It never asks for a password, PAN, OTP, card number or any other credential. The recording of Razorpay's onboarding asks for those; ours does not. This is a hard rule from SPEC section 0.
- Progress is remembered in the browser only (`lib/setup.ts`), because settings are read-only in the demo.

**Overview** (`routes/Home.tsx`, the side menu's first item). A dashboard, as Razorpay's own dashboard home is (v3 roadmap batch 1.1, 12 Oct 2026). The first version was rejected on composition (the Ray glyph floating outside its box, a centred stepper with dead space, a tall chart above the list that matters more), so these are the rules it was rebuilt on.
- Header: "Overview", one line, then "Take a tour" and "Reset setup" as tertiary buttons and the date range (Today, Last 7 days, Last 30 days, This month), kept in the address (`?range=`). In the demo "today" is 2 Oct 2026, the day the data was taken (`lib/range.ts`); the page says so. Below `l` the actions go under the title.
- Ask Ray: one line, a field with the Ray glyph inside it and an "Ask" link, and "History" at its end. The three starter questions are on Ray's own page, not here. A question opens the chat page; a question about a screen goes to that screen.
- Order, top to bottom, and why: Ray one tap away; the setup card, only until setup is done (the one thing to do first, and the only blue button); what is wrong and how bad (four cards); what to act on (open payment issues, biggest first) beside the trend (chart); then the pages and what Ray sends. A merchant asks "what is wrong, how bad, what do I do, is it getting worse" in that order.
- Setup card until setup is done (`components/SetupCard.tsx`): a title, a `0/3 COMPLETED` badge, the one blue button, a thin progress bar and one tile per step (a green tick when done, a blue ring on the next, grey for later). A reached step is a link to `/setup?step=`. When done it folds into one line, "Setup complete", with "Review".
- Four cards added up in the browser from the issue summaries: open payment issues, customers hit, money stuck, customers made whole. Under them, for Kaksha only, one full-width row: Unpaid renewals, what the merchant is owed from failed renewals (`components/UnpaidRenewalsRow.tsx`, `GET /api/leakage`), linking to its page. A row and not a fifth card, because it is a different kind of number (a balance, not a payment issue) and the date range does not apply to it. It keeps one size loading, loaded, empty and failed (`e2e/unpaid-renewals.spec.ts`). Then, half and half from `l`: the open payment issues by money at stake (each row a link, the amount over its owner badge) and the issues chart (`components/IssuesChart.tsx`).
- The chart says what its bars add up to in a heading, has its own time horizon (a segmented control: 7 days, 30 days, Month; it starts at the page's range, and Today starts it at 7 days because a chart by day has nothing to show for one), Show (value or volume) and Group by (cause or whose side) as small menus. Chart colours are not blue (an action) or the orange of the owner badges.
- **A card never changes size because of its data** (Eshan, 12 Oct 2026). The plot has a fixed height; the legend has room for every group that exists, not only those in the range, so colours and legend stay put as the range moves; until the plot is drawn a Blade `Skeleton` of the same size stands in, so it never arrives small and grows; a range with nothing in it shows a small `EmptyState` in the same space (a green tick, "No payment issues") with its menus disabled. From `l` the chart card alone sets the row's height and the list card is laid over it (scrolling inside if it is long, with "See all payment issues" always at its foot), so the row cannot resize with the number of issues. `e2e/home.spec.ts` records both cards' sizes from the first frame and after every range, horizon and toggle, and fails on any change. Check this for every new card: what would it look like with no data, with one row, with the most rows, while loading, and at 375px.
- Under it: Explore Resolve, nine small cards in the menu's order, each a page name, a chevron and one line of eight words or fewer (the long text lives on the guide pages), then Ray on WhatsApp: the four problems as cards you can pick, one line of figures each, and beside them one clip of the first heads-up for the one picked. The left column is wider (3 to 2 from `xl`), the clip fills its card, and every clip sits in one grid cell with only the picked one visible, so the card is as tall as the longest clip and nothing moves when you pick another.

**Help bubble.** Razorpay's upload screens show a small blue question pill ("What is a Power of Attorney document?") that opens a short answer card. Use the same for any field a merchant may not understand. Not built yet.

---

## 17. The agentic journey: how an agent answers

Observed 7 Oct 2026 in Razorpay's own agents (Payout, Receivables, Bookkeeping, Insights, Reporting). Our agent answers the same way. Component: `components/AgentAnswer.tsx`; Resolve's answers: `components/RayAnswers.tsx`.

**The journey, in order**
1. **Ask.** The merchant types a request or taps a suggestion. Their message appears as a white bubble, right-aligned.
2. **Analyse.** The agent answers on the left with no bubble. A bold title that leads with the number ("₹1,91,000 pending"), then one muted line starting "I've analysed..." that says what it looked at and how it ordered the result.
3. **Show the evidence as cards.** White cards, one per item. Groups are separated by a centred divider with a small-caps coloured label ("URGENT · OVERDUE >14 DAYS" in red, "DUE SOON" in orange, "UPCOMING" in green). Inside a card: name, a status pill, a muted reference line, the amount right-aligned over a small-caps label (AMOUNT), the actions on the far right. Detail cards use small-caps section labels (AMOUNT, BANK DETAILS, ATTACHED DOCUMENTS), label left and value right.
4. **Propose the action.** The most urgent card has the one blue button ("Auto-Call", "Approve Payment"). Every other card has secondary buttons only ("View Details", "Review Invoice"). Nothing that moves money or messages people happens without that click.
5. **Confirm.** A success card in a light green tint with a green check, the result in green ("Synced with Tally"), and the reference in monospace ("Voucher #PV-2026-0303-01"), followed by a details card.
6. **Offer the next step.** A divider, the Ray glyph and "How can I help you next?", then numbered options as plain rows ("1. Call TechCorp now").
7. **Stay available.** The input ("Ask Ray anything related to Razorpay...") stays pinned at the bottom of the page on a faint gradient, on a white surface so nothing shows through it, above Blade's buttons (which sit at z-index 1 to 2). Razorpay's page has a hamburger (the chat history) and a "+" (new chat) in a thin rail on the left and no side menu; ours has the side menu and a labelled toolbar (Overview, History, New chat). `routes/RayChat.tsx` is this page; chats are kept in this browser (`lib/rayChats.ts`: the questions only, the answers are read from the data again; held in memory too, so a private window keeps them while the tab is open), listed in `components/RayHistory.tsx`. Edge cases handled: a question Ray cannot answer gets "I can answer from your payment data" with the questions it can; an address for a chat that is not in this browser says so and offers a new chat; an empty question does nothing; the history can be cleared.

**Mapping to Resolve.** Detect (the first check, payment issues) is step 2. Whose side and who is affected is step 3. Fix in stages with approval is step 4. Verify and close is step 5. The next-step list is step 6. The Ray home runs steps 1 to 3 and 6. The fix flow on the incident page runs steps 4 to 7 as turns (`Turn`, `UserBubble`, `Analyzing`, `NextSteps` in `components/AgentAnswer.tsx`, used by `FixPanel.tsx` and `Zone1Fix.tsx`): each step is a titled card with one blue button, pressing it adds the founder's bubble above the next step, steps appear as the founder reaches them, and a closed incident ends with "How can I help you next?". There is no OTP and no feedback row yet.

**Rules**
- The title states the number. The sentence under it says what was analysed. No filler greeting.
- Group by urgency, biggest first, and say how you grouped.
- Exactly one primary action per answer, on the card that needs it most.
- Every figure comes from the data. Ray's chat on the home is a router plus read-only answers, not a language model.
- Success is calm green, not confetti. Save RazorSense motion for the heroes in DESIGN.md section 8.

**The full journey, step by step** (from Razorpay's Agentic Business Banking demo, screen recording of 7 Oct 2026, banking agent: pay an overdue vendor, then book it in Tally). This is the longest agent flow we have seen and the model for our fix flow.

1. **Start from a suggestion.** The previous answer ends with numbered next steps ("1. Tell me which vendors to pay"). Tapping one is the same as typing it.
2. **"Analyzing".** Before any answer appears, the Ray glyph in green turns beside the green word "Analyzing". Then the answer streams in: the title first, then the line under it. No spinner, no blank wait.
3. **Answer with one recommended action.** "Vendor Invoice Analysis - 4 Overdue: ₹4,00,000", one line on how it was prioritised, then a 2 by 2 grid of cards. Each card: name and a small status tag (Critical in red), one reason line, the amount large, a due line. Only the critical card has a blue button ("Pay Now"). The others carry advice in plain coloured text ("Pay within 2 days", "Safe to delay", "Can wait 5 days"). Nothing else to click.
4. **Every click becomes a message.** Pressing "Pay Now" puts "Pay SpreadWorks now" into the thread as the merchant's own bubble, then the agent answers. The thread is the record of what the merchant decided. Buttons never act silently.
5. **Review before the act.** The next answer is the full detail card (amount, due date, bank details with the account masked, attached documents) with two buttons: blue "Approve Payment" and secondary "Review Invoice".
6. **Verify a human for money.** "Approve Payment" becomes another bubble, then a "Confirm Payment" card: "Enter OTP sent to xxxxxx7890", "Paying ₹20,000 to SpreadWorks", six boxes, "Resend OTP". Our fix flow has no OTP. Its equivalent is the staged approval (dry run, first 5, the rest), shown the same way: a card, then one explicit approve.
7. **Success, with proof.** Green check, "Payment Successful!", "₹20,000 paid to SpreadWorks", an UPDATED BALANCE line, and a small table (Amount Paid, Ref #, To, Time). For us: customers restored, how many were checked against the records, and the audit entry.
8. **Chain the next job.** The agent does not stop at success. It says what it can now do ("SpreadWorks is already mapped to SaaS Subscriptions on Tally... ready to create the payment entry") with one blue button ("Sync with Tally"). For us: after access is restored, "Message the 17 customers who complained".
9. **Close the loop.** The last answer is a calm green card ("Synced with Tally", voucher number in monospace) and a details table. Under any agent text there is a small feedback row: thumbs up, thumbs down, copy, share.
10. **Voice.** The same journey also runs by phone: the agent calls a vendor on the merchant's behalf ("Call to TechCorp Solutions initiated... I will notify you once the call is done and share a full summary"). Out of scope for us, but the pattern holds: say it started, say when you will report back.

**What to take for Resolve.** Thread as record (each click is a bubble). One primary button per answer. Calm "Analyzing" instead of spinners. Review card, then explicit approve, then proof, then the next job. Money and customer messages always sit behind an approval step.

---

## 18. Source of truth when documents disagree

A third-party style summary circulated on 7 Oct (name "Razorpay", brand Dodger Blue `#0d94fb`, Prussian Blue `#012652`, font Muli, radius 4px, success `#04db7c`) does not match what the dashboard and Blade actually ship. Measured production values and Blade's own source win:

| Thing | Third-party summary | What ships (use this) |
|---|---|---|
| Primary blue | `#0d94fb` | `#1364F1` (azure.500), hover `#0E54CD` |
| Sidebar | Prussian Blue column | White side nav, grey fill on the active item; the top bar is black |
| Font | Muli | Inter for UI, TASA Orbiter for headings |
| Radius | 4px | 8px buttons and inputs, 12px cards, 16px chat |
| Success | `#04db7c` | `#008F47` solid, `#00753B` text |

Where the summary is right and useful: status pills with a soft tinted fill, thin 1px lines, tooltips on a deep navy background, monospace for IDs and amounts in code-like contexts, a three-level shadow system. These are already in Blade.

Figma references given by Eshan: Blade Design System (community) and Organising Design Systems (community). They describe the same tokens as the installed `@razorpay/blade` 12.127.0. When Figma and the installed package differ, the installed package wins because that is what renders.

---

## 19. Checklist before you open a pull request

Run through this for every screen you add or change.

1. Does it use `Shell` and the page container, with no navigation or layout of its own?
2. Does it start with `PageHeader`, and is it one of the templates in section 15?
3. Blade components and tokens only? No hex, no pixel padding, no `style=` where a token exists. (`grep -rn "#[0-9a-fA-F]\{3,8\}" src --include='*.tsx'` should find nothing.)
4. One blue primary button per view or card? Blue only on things the user does, green only on Ray and success?
5. Copy: an issue headline leads with what happened to customers, and a stat or answer title with the number (section 22); sentence case, names the cause and the next step, no em dashes, no "Oops".
6. Amounts in rupees with Indian grouping, every figure from the data?
7. Does it ask a customer or merchant for a credential anywhere? It must not.
8. Production items still inert, none removed, none made clickable?
9. Looks right at 1440px and at a phone width (the side nav becomes a drawer, grids stack)?
10. `npx tsc -b`, `npx oxlint` and the snapshot e2e tests pass?
11. Have you run section 23 (composition, stability, edge cases, the journey around the screen, tests that can fail) and written down what you found?


---

## 20. Design philosophy

How we decide when a rule does not cover the case. These came out of the first design pass (7 Oct 2026) and apply to every screen from here on. Eshan decides what we build and how it should feel; these are the habits that keep it consistent when he is not in the room.

**1. Look like an addition, not a new product.**
A merchant who sees Resolve should think Razorpay shipped it. We earn trust by being recognisable: the same top bar, the same side nav, the same cards, buttons, tables and tone. When a screen from production already does the job, copy its structure. When we must invent, extend a pattern Razorpay already uses (Agent Studio is the precedent for a new product) and say which one in the pull request.

**2. Copy production before you invent, and measure before you copy.**
Take values from the live dashboard or from Blade's source, not from memory, a summary, or a screenshot's look. Order of trust: measured production, then Blade's installed source, then Figma, then any third-party summary. When two disagree, the higher one wins and the conflict goes into section 18.

**3. Inert beats absent beats fake.**
Production items we do not build stay visible and greyed, so the page still looks like the real dashboard. We never draw a control that pretends to work. Anything simulated is labelled simulated. This is also what keeps a demo honest in front of Razorpay's own PMs.

**4. The agent proposes, the person approves, the thread remembers.**
Every flow is a conversation: one recommended action per answer, one blue button, the founder's choice echoed as their own message, then the proof, then the next job. Nothing that moves money or messages customers happens without an explicit approve. The agent never asks for credentials.

**5. Every number comes from the data, and leads the sentence.**
Titles state the figure ("5 payment issues, ₹85,359 involved"). No model writes a number or a status. Rupees use Indian grouping. A line that says what was analysed sits under the title, so the founder can see how the answer was reached.

**6. Tokens and Blade, always; wrappers only with a reason.**
No hardcoded colour, spacing, radius or duration when a token exists. Use Blade components. If Blade cannot do something (an inert nav link, a tab strip that does not crash), write one small wrapper, put the reason in a comment, and note it in `web/CLAUDE.md`. Do not rebuild Blade components by hand.

**7. Responsive by construction, full width by default.**
Content fills the page container. Limit width only for the length of a line of text (about 720px) and for chat bubbles (a share of their column, never fixed pixels). Grids use `minmax(0, 1fr)`, tables get column minimums so they scroll instead of crushing, and two-column layouts become one column below `l`. Fixed-width phone mockups floating in the middle of a wide page are a defect.

**8. Calm over lively.**
Blue is for things the person does, green is for Ray and success. The living RazorSense surface is for a hero or a success moment, at most one per screen. While the agent works we show "Analyzing" with the Ray glyph, never a spinner and never a blank screen. Errors name the cause and the next step and never blame the merchant's customer or the merchant.

**9. Plain words.**
Sentence case, short sentences, the verb the merchant would use ("Grant the first 5", not "Initiate staged provisioning"). One action per message. No em dashes, no "Oops", no marketing adjectives in product copy. Every claim in a guide must be true of the product today.

**10. Prove it, then say it is done.**
A screen is not finished until it has been seen at 375, 768 and 1440px, the layout test covers it, types, lint and the browser tests pass, and the design review described in the root `CLAUDE.md` has been run. Say what was not checked.

**When none of this covers the case**
Find the closest Razorpay screen. Note what it does and why. Build that. Add a line to this section or to section 17 so the next person does not have to guess. If you cannot find a precedent, stop and ask Eshan, with two options and a recommendation.


---

## 21. The playful layer

Added 8 Oct 2026 after Eshan shared the launch recording of Razorpay Engage (ads inside ChatGPT, a product launched that week). Resolve is a new product inside the dashboard, so it may be a little more playful than a settings page, as long as it still reads as the same Razorpay. This section says how far.

**What Engage does that we took**
- One idea per screen, led by a big plain sentence. A hero on a soft wash with one thing to do.
- A scan that shows its work: a checklist whose lines tick one by one, real counts appearing beside them, then the result. Lines are written the way a person doing the job would say them ("Matching each payment to a customer's access").
- Italic serif accent on one phrase of a heading ("Checking who paid and *never got in*"). Component: `components/Accent.tsx` (Instrument Serif italic, loaded in `index.html`, falls back to Georgia italic).
- The result as numbered cards with "Why this matters" and "Whose side" (Engage says "Owner").
- One dark banner with the next step, once per page.
- The button turns into a green tick when it has done its job (`Approved` in `components/AgentAnswer.tsx`). It is not a button, so it cannot be pressed twice.
- A preview of the thing exactly as the other person will see it, before you approve it.

**What we did not take**: Engage's own page chrome (we keep the dashboard shell), a score out of 100 (it would be a number no data produces), confetti, anything that moves while the person is reading.

**Rules**
1. The italic accent goes on one phrase in a hero or launch heading. Never in tables, labels, buttons or body text. Never two in a view.
2. The first check (once Day-0 scan) replays as a checklist on every visit, and again on "Run it again", so anyone testing the demo sees how it works each time (Eshan's call). It says it is a replay of the saved result. Every count on it is read from the scan data; a line with no count in the data shows none. People who ask for less motion get the result at once.
3. One blue primary button per view still holds. On the scan result the blue button is the dark banner's.
4. The dark banner is drawn in a nested `BladeProvider colorScheme="dark"`, so every colour in it is a Blade token.
5. Figures may count up on first show (`lib/useCountUp.ts`), always ending on the data's number, even when animation frames are paused.
6. Motion stays inside section 8. Green is still only Ray and success.

**Messages are drawn as the app they are sent in.** When Resolve shows a message a customer will receive, it draws that app, not a card: `components/WhatsAppChat.tsx` is WhatsApp for Android (green header with the business name and verified tick, wallpaper, date chip, the Meta business notice, bubbles with a tail and a time, ticks on what the customer sent, quick-reply buttons, input bar). It is used for the fix flow's "Send this to N customers" step, Ray's alerts to the founder, and the customer side of the WhatsApp demo.
- This is the one place that is allowed raw elements, inline styles and hex colours, because it copies Meta's look, not Razorpay's. The colours live in `lib/whatsapp.ts` (a `.ts` file, so the hex grep in section 19 stays clean). Do not use them anywhere else.
- Show only what matters. Previews use `compact` (slim header and the messages on the wallpaper, no call icons, notice or input bar); the full phone with input bar stays only for the interactive customer demo. Show at most two previews side by side; list the other templates as text underneath. Where there are more than two, show one clip and let the person pick which (the Ray home). A clip is the one message that matters, not the whole thread.
- The wallpaper is the real WhatsApp doodle image (`public/whatsapp-wallpaper.jpg`, supplied by Eshan), multiplied over the beige. Chats that come from Razorpay (Ray's alerts) use the Razorpay mark as the profile picture (`avatar="razorpay"`).
- The same rule applies to email and Instagram when they get a preview: copy the real app first, then build. Email and Instagram previews are not built yet; `EmailDemo` and `IgDemo` still use plain cards.

**Charts** use Blade's chart components (`ChartBarWrapper`, `ChartBar`, axes, legend, tooltip), never hand-drawn bars: a chart needs axis labels and a tooltip on hover. First one: `components/TimelineChart.tsx` (webhook outcomes by hour). `DuplicateChart` follows it (INC-2, orders by day). `OrdersChart` (three lines: orders that arrived, normal for the hour, orders nobody tried to pay for) and `RenewalChart` (stacked card renewals) follow it as of 10 Oct 2026, and nothing is hand-drawn any more. A line says what a chart cannot: how many hours the pay page failed, how many UPI renewals went through. Alert tuning's six-week replay is a `ChartLine` with `type="linear"`: the weeks are points, and the default curve draws values between them that the data does not have.

**Control must be visible in the demo.** Where the real product lets you switch something off, the demo shows it working and shows the undo, with the change held in the browser tab only. First one: Connectors (Disconnect, then "Undo, connect it again").


---

## 22. Names and words (researched 11 Oct 2026)

Test viewers could not tell what the product was without Eshan explaining it, and named the copy as the reason. So the names and the words were checked against how Razorpay names its own products: its docs (razorpay.com/docs), the dashboard screenshots and recordings in Eshan's UI Reference folder, and the Agent Studio pages. Razorpay's names are short plural nouns or brand names, never verbs. It uses "incident" only for bank downtime history, and never says "scan", "learning", "autonomy", "autopilot", "at risk", "audit log" or "ground truth".

| Was | Now | Why |
|---|---|---|
| Ray (menu item) | Overview | "Ray AI" is already a top tab in Razorpay's dashboard; "Home" is taken by Razorpay's own item |
| Incidents | Payment issues | Razorpay keeps "incident" for bank downtime |
| Conversations | Customer complaints | a real Razorpay page name, with Open, In progress, Resolved |
| Channels | Connectors | Agent Studio's tab for the tools an agent can use |
| Day-0 scan | First check, off the menu, the end of Setup | no "scan" anywhere in Razorpay |
| Access report / Access without payment / Unpaid access | Unpaid renewals (path still `/access`) | "Report" means a download in Razorpay. "Unpaid access" (13 Oct) did not say what was unpaid or why it is not a payment issue: it is a renewal that failed for lack of money while the customer kept access, a balance the merchant is owed that grows every day, where the next step is the merchant's own call. A payment issue is an event with a cause and a fix, where the customer lost out |
| Release check + Connect by prompt | Integration: 1. Build with AI, 2. Go-live check | Razorpay's guides number "Build Integration, Test Integration, Go-live Checklist" |
| Learning | Alert tuning | "Alert" is a Razorpay word ("Alert Email"); "learning" read as tutorials |
| How we know | Accuracy | no Razorpay precedent; a plain noun |
| Audit log | Audit trail | Razorpay's word |
| Suggest / Assist / Autopilot | Review first / Approve once / Full automation | "review-first mode" and "full automation" are Razorpay's words for agents |
| Your side · Code, Razorpay side | Cause: Your code, Your settings, Razorpay, The bank | merchant words; Razorpay's own "Business related" reads two ways |
| Inferred | estimated | the word a merchant uses for a number that is not counted |
| At risk | Amount, Amount involved | Razorpay frames money as an amount or "pending" |
| Before Razorpay / Inside / After the payment | Before payment, During payment, After payment | one rhythm, and each says what happened in a line under it |
| Dry run / Verify and close / access hook | Test run / Check it held and close / your app | the verb a merchant would use |

**Headlines lead with what happened to customers.** An issue's title is built in the screen from its kind and count ("85 customers paid and did not get access", `headline()` in `lib/format.ts`), and the engine's technical title sits under it as "Cause: ...". The contracts did not change.

**One answer box per page.** An issue page has one blue box that says what happened in plain words, with "With Resolve on, you would have known ..." at its end, not a second box.

**Disclaimers are short.** The top banner says the data is made up. A page adds one short "Demo" or "Prototype" note only where it differs from what production would do.


---

## 23. Build checks: what to look for, every time

Written 12 Oct 2026 from batch 1.1 (the Overview), which Eshan sent back five times, each time for something the checklist in section 19 did not catch. Section 19 checks rules (tokens, one blue button, names). This section checks the *screen*: how it is composed, what it does when its data changes, and whether the journey around it holds together. **Run all of it on every screen you add or change, before the design review, and write what you found and fixed in the build log.** A check that was not run is written as "not checked", never as passed.

### A. Composition (look at it as a product designer, at 1440, 768 and 375px)
1. **What is the most important thing, and is it first?** Order the page by the questions a merchant asks: what is wrong, how bad, what do I do, is it getting worse, then everything else. Write the order down in the doc for that page (the Overview's is in section 16).
2. **Nothing floats.** An icon belongs inside the field or the card it describes (the Ray glyph sat outside its input and looked orphaned). Nothing hangs off a card's edge. Check that every left edge lines up: a heading, its steps, its button.
3. **No dead space, no block bigger than its job.** A tall chart above the list that matters more, a stepper with an empty left edge, a card that is mostly white under "₹0": each is a defect. If a block is large, say what it earns.
4. **A control belongs with the thing it controls.** The horizon of a chart sits on the chart, not on the page. Two to five short options are visible choices (`SegmentedControl`), not a dropdown (Blade's own guidance).
5. **Text size matches its job.** A legend is small text on tight lines. Blade's default legend (14px, 44px a row, not adjustable) was too loose, so the chart draws its own.
6. **Colour means one thing.** Blue is an action, green is Ray and success, orange is "your side". A chart does not use them for data. One blue primary per view or card.
7. **Touch targets are 36px or more** on both sides (a rail button measured 16px because a flex parent squeezed it). Text on a button does not wrap ("30 days" broke onto two lines at 375px).
8. **Room is the element's own width, not the screen's.** A card in a column beside a timeline is 396px wide on a 1024px screen. Choose a side-by-side layout, or a time axis over a list, from the measured width of the card (`useWidth`, before the first paint), with the thresholds written in the code comment (two cards need 640px, a lane with two labels in a row needs 520px). A screen breakpoint said "wide enough" at 1024px and the lane's labels ran into each other.
9. **Copy: the PRD's words, short, true today.** A card is a name and one line of about eight words. A claim in a guide or tour is something the product does now (the cross-merchant "is it just you" is not built, so it is not claimed). Names follow section 22.

### B. Stability: a card never changes size because of its data (Eshan's rule)
1. **Fixed where the data varies.** The chart's plot has a fixed height. The legend has room for every group that can exist, not only those in this range, so it and the colours stay put. A list scrolls inside its card.
2. **Loading is the same size as loaded.** A Blade `Skeleton` of the final size stands in. Nothing arrives small and grows. Measure the width **before** the first paint (`useLayoutEffect`), not after, or the first paint is a guess.
3. **Empty is the same size as full.** A range with nothing in it shows a small `EmptyState` (a green tick, why it is empty, what happens next) in the same space, with its controls disabled. Never a bare "₹0" over white.
4. **One card sets a row's height.** In a two-card row, the card whose size does not depend on data sets the row; the other is laid over it and fills it (`Panel` `fill`). Otherwise the taller of two data-driven cards moves the other.
5. **A number that shows progress comes from the same counts as the numbers next to it.** The "Fix" tile read a stored `fixed` field and disagreed with "still to put right" on every page and after the demo fix. Derive it from the live group counts, and test that it moves.
6. **Test it by measuring.** `e2e/home.spec.ts` records both cards' sizes on every frame from the first, changes every range, horizon and toggle, and fails on any difference. Do the same for any new card that shows data.

### C. Edge cases (for every element, list them before building, then try each)
No data; one row; the most rows; a very long name or title; loading; an error; a range or filter that matches nothing; a disabled state; hover and focus; the first visit and a return visit; 375, 768, 1024, 1440px (1024 is where a half-width card is narrowest, and it caught a legend leaving its card); a window resized while it is open.

### D. The journey around a screen (do not copy a reference blindly)
1. **Way in and way out.** Razorpay's Ray page drops its side menu because Ray is the whole product there. Ours is one page of Resolve, so the side menu stays, the page it came from is marked, and a toolbar has Overview (back), History and New chat. If a screen hides the navigation, there must be another obvious way back.
2. **Find your past.** Anything a user creates (a chat) can be found again, and cleared.
3. **Bad input.** A question the product cannot answer says so and offers what it can (a fallback that answers "rrr" with a table of issues is wrong). An empty submit does nothing. A link to something that does not exist (another browser, cleared history) says so and offers the next step.
4. **A browser that refuses storage** still works while the tab is open (keep a copy in memory).
5. **Order of layers.** Blade's buttons sit at z-index 1 to 2. A sticky bar must be above them (we use 5), and above the answers that scroll under it. A bar with a see-through input is a defect; check where the *buttons* are, not the middle of the bar.

### E. What Blade does that is not obvious (learned the hard way)
- The Blade docs tool needs `create_blade_skill` run once with the **repo root** as its directory (not `web/`). Read the docs before using a component; they say, for example, when to use a dropdown and when to use a segmented control. The generated `.agents/` and `.claude/skills/ui-code-guidelines` stay out of git.
- `Card` accepts only `CardHeader`, `CardBody` and `CardFooter` as children, and throws on anything else (it crashed the page). `CardBody` takes a `height`.
- `Box` `backgroundColor` accepts only `surface.*`, `overlay.*` and `transparent`, and throws on a chart colour. A chart-colour swatch is one plain `<span>` that reads the colour from the theme.
- A component defined inside another component's render is a new component every render, and React remounts it. Define it at the top level.
- `TextInput` on the web has no `onSubmit`; use `onKeyDown`. A Blade `Link` text never wraps. `StepGroup` horizontal centres its labels.
- Blade's chart legend, a button per item, ignores text size. Draw your own when it matters.
- Blade's `ChartReferenceLine` always draws its label pill, 80px wide even with an empty label. A line that has no room for its name is not drawn (`chartMarks` in `lib/format.ts`); never pass an empty label.

### F. Tests must be able to fail
1. Write the test, then make sure it **fails** against the bug (we shipped a legend test that measured the wrong element and could never fail; the reviewer caught it).
2. Wait for what you mean. A test that waits for the words of a question finds them on a suggestion chip and moves on early; wait for the answer.
3. Measure geometry in the browser instead of trusting a screenshot, and probe the *right point*. A screenshot tool that clips a tall page, or a check at the middle of a bar, cost us an "it is only an artefact" that was wrong.
4. Never call something an artefact until a measurement at the place that is affected says so.
5. **A check that finds nothing passes.** Our x-axis, value-tick and label checks used class names Blade does not use, matched no elements and passed. Assert that the thing was found (at least three value ticks, at least one axis label), then prove the check by putting the old behaviour back. A check on the strip's height hid a tile that grew inside it, because the strip takes the tallest tile's height: measure each part, not the container.
6. A suite run in CI mode needs port 5173 free (stop your preview first); check `lsof -i :5173`.

### G. Process, in order
1. Check the CI-failure issues (root `CLAUDE.md`). Read the roadmap task, the PRD section, this section and sections 14 to 22.
2. Read the Blade docs for any component you have not used. List the edge cases (C) before writing.
3. Build. Look at it at three widths, in the browser, with real interactions, including the empty state.
4. Run: `npx tsc -b`, `npx oxlint`, the snapshot suite, then `CI=1 npx playwright test` with the port free. Run `make test`, `make lint` and `make eval` when the backend or the data changed.
5. Run the design review (`.claude/agents/design-reviewer.md`, which includes this section). Fix every finding or say why not. Run it again until it passes.
6. Write the build log entry: what was built, what broke and why, what was measured, what was left on purpose, what was not checked.
7. Open the PR, bind it, switch Auto-fix on. Do not merge unless Eshan says so (he merges himself unless he says otherwise).
