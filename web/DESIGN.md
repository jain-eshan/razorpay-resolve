# RazorSense: Razorpay's design language

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

**What we did with it.** `web/src/App.tsx` uses Blade `TopNav` and `SideNav`. `components/Panel.tsx` is the header-band card (the fix steps, evidence, replay, customers and settings all use it), `Stat.tsx` the small stat card, `Crumbs.tsx` the breadcrumb. The incident page follows the payment detail page: summary card, stat cards, a Details-style main column and a sticky Timeline (`StepGroup`) on the right. The incident list, scan, audit log and eval checks use Blade `Table`.

Blade gotchas found while building it: `Card` accepts only `CardHeader`, `CardBody` and `CardFooter` as direct children; `InfoItemValue` does not style plain strings, so wrap values in `Text`; `SideNav` is a fixed overlay, so give it `top` and `bottom` offsets and reserve its width on the content; `SideNavLink as={Link}` receives React Router's `to`, not `href`; `TableRow onClick` is not a dependable way to navigate, so put a real link in the row.
