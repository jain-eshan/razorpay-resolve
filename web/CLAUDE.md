# RazorSense starter

A starter for building Razorpay products in Razorpay's own design language, RazorSense, on top of Blade (`@razorpay/blade`, Razorpay's open-source design system).

**Read [DESIGN.md](DESIGN.md) before designing or building any screen.** It holds the principles, the four emotional states, tokens, motion, components, voice, and product context. **Sections 14 to 19 are the rules for this product**: it is an addition to the live Razorpay dashboard (shell, page templates, guides and onboarding, agent answers, a pre-PR checklist). Follow them for every new screen.

**Before building:** check for open `ci-failure` issues (`gh issue list --label ci-failure --state open`) and fix them first. See the root `CLAUDE.md`.

## Stack
- Vite + React 18 + TypeScript
- `@razorpay/blade` 12.127.0 with styled-components 5, framer-motion 11 and i18nify. React 18 is required because `@razorpay/i18nify-react` doesn't support 19 yet.
- `.npmrc` sets `legacy-peer-deps=true` so npm doesn't pull in Blade's React Native peers. Keep it.
- Blade MCP server is configured in `.mcp.json`. Use `get_blade_component_docs` / `get_blade_pattern_docs` before using a Blade component you haven't used in this repo.

## Commands
- `npm run dev` starts the app at http://localhost:5173
- `npm run build` typechecks and builds
- `npm run lint` runs oxlint

## Files
- `src/main.tsx`: BladeProvider, fonts, LazyMotion setup
- `src/razorsense.ts`: the four emotional states (Blade gradient maps + static fallbacks), Ray glyph path, reduced-motion flag
- `src/App.tsx`: the routes. The page container lives here.
- `src/components/Shell.tsx`: top bar and side nav, copied from the production dashboard. Production items are inert. Add a screen by adding to `BLINDSPOT` or `PROOF` there. The phone menu is a plain Blade `Drawer` around the same items (see Known quirks).
- `src/components/PageHeader.tsx`: the title block every page starts with.
- `src/components/AgentAnswer.tsx`, `RayAnswers.tsx`: how Ray answers, and the `Turn` pieces the fix flows use (DESIGN.md section 17).
- `e2e/layout.spec.ts`: opens every route at 375, 768 and 1440px and fails on errors or sideways overflow. Add new routes to its list.
- `src/lib/guides.ts`, `routes/GuidePage.tsx`, `routes/Setup.tsx`, `routes/Home.tsx`: product guides (three slides: what, why, how; one per page in the menu), first-run setup, the Overview (what Blindspot is, what is wrong now, Ray).
- `src/components/WelcomeTour.tsx`: the welcome pop-up (Blade `Modal`, three slides, then Setup). Once per app load; `welcomeDue` in `lib/setup.ts` decides, and automated browsers skip it unless the address has `?welcome`.
- `src/lib/art.ts`, `public/art/*.webp`: every picture, with alt text. Images made from briefs in Razorpay's illustration style (DESIGN.md section 16), not drawn in code. `GuideHero.tsx` shows a guide's 4:3 hero, `GuideArt.tsx` a 2:1 spot in a card panel; both on the wash from `iso.tsx`. `src/lib/guideStats.ts`: the figures on a guide's hero, read from the data. `SetupScene.tsx`: the moving picture in Setup's left card, one per step, that follows the choices on the right (a live diagram, kept in code).
- `src/routes/RenewalView.tsx`, `components/RenewalFix.tsx`, `components/RenewalChart.tsx`: INC-3, the incident on Razorpay's side (card renewals failed in its gateway): evidence, the 3 day grace extension in stages, the customer message, the evidence pack to Razorpay, and the renewal link once cards work again (10 percent held back). `Incident.tsx` sends `mismatch_type: G` here, `zone: before` to `Zone1View`.
- `src/routes/Home.tsx`, `components/SetupCard.tsx`, `components/IssuesChart.tsx`, `components/MenuPick.tsx`, `lib/range.ts`: the Overview dashboard (DESIGN.md section 16). `lib/range.ts` holds the date ranges and the demo's "today" (2 Oct 2026); `MenuPick` is the page-filter dropdown (Blade `Dropdown` with a `DropdownButton`).
- `src/routes/RayChat.tsx`, `lib/rayChats.ts`, `components/RayHistory.tsx`: Ray's chat page (`/ray`, `/ray/:id`): the side menu stays (Overview is marked), a sticky toolbar with Overview, History and New chat. Chats live in the browser's storage and in memory. `App.tsx` drops the page container for it.
- `src/components/StoryStrip.tsx`, `IncidentStats.tsx`, `EvidenceLane.tsx`, `JustYou.tsx` (+ `lib/justYou.ts`), `RootCauseActions.tsx`, `ChartKey.tsx`: the parts every payment issue page is built from (DESIGN.md section 15, Detail page). The four views (`Incident`, `DuplicateView`, `RenewalView`, `Zone1View`) use the same parts in the same order and load the evidence pack with the incident. `ChartKey` is the compact key under every chart; its swatch is one plain span (see above).
- `src/lib/useWidth.ts` (an element's measured width, before first paint), `src/lib/useNarrow.ts` (true on a phone): layouts that depend on room are chosen from these, not from the screen width (DESIGN.md section 23 A8).
- `src/components/RulesFail.tsx`: the "where rules fail" card on Accuracy. Every figure is read from the eval report (`eval/messy.py`, `eval/messy_complaints.json`); only the wording is here.
- `src/routes/Leakage.tsx`: J6, "Unpaid access" (`/access`): UPI renewals that failed on the customer's side while access stayed on past the merchant's own rule. A list only: no button, nothing written, no access taken away. Read from `GET /api/leakage`, so the hosted demo needs no replay frames.
- `src/routes/ReleaseCheck.tsx`: Integration step 2, the go-live check (`/release-check`, `GET /api/guard/release-check`): a verdict, five steps (webhook answers, accepts a signed event, acknowledges; pay page opens, checkout opens) each Passed, Failed or Not tried with what it means and the next step, and the line for a release script. Read only. The hosted demo picks one of four recorded answers by what the user has fixed so far (`guard` in `demo.json`).
- `src/components/IntegrationSteps.tsx`: the two steps at the top of both Integration pages.
- `src/routes/Connect.tsx`, `src/lib/connectPrompt.ts`: Integration step 1, Build with AI (`/connect`): the text a merchant pastes into a coding agent to wire the webhook and the fulfilment acknowledgement, a copy button, a link to the go-live check, and what each rule closes. A page of text, no data, nothing written. The prompt carries no key or secret (a test checks).
- `src/routes/DuplicateView.tsx`, `components/DuplicateFix.tsx`, `components/DuplicateChart.tsx`: INC-2, customers charged twice after an app release (the merchant's app, not the webhook): evidence, the look-alikes left out, a Refund button per customer (approved one at a time, never undoable), the customer message with the bank reference, and the developer's fix. `Incident.tsx` sends `mismatch_type: E` here. The hosted demo refunds in the order shown.
- `src/components/WhatsAppChat.tsx`, `src/lib/whatsapp.ts`: WhatsApp drawn as the app looks, for every message preview (DESIGN.md section 21). The only file besides `Reference.tsx` allowed hex colours and raw elements.
- `src/components/PageSkeleton.tsx`: what every page shows while its data loads. Use it instead of a "Loading" line.
- `src/components/Accent.tsx`, `src/lib/useCountUp.ts`: the italic serif accent word and the count-up figure. `src/routes/Scan.tsx`: the first check (once Day-0 scan) replay and report; off the menu, reached from Setup and Overview.
- Names follow Razorpay's own (DESIGN.md section 22). An issue's headline is built from its kind (`headline()` in `lib/format.ts`); the engine's title is the "Cause:" line.
- `src/routes/Reference.tsx`: the RazorSense reference screens (state switcher, voice examples, Ask Ray chat, success moment)

## Rules
1. Use Blade components and tokens. No hardcoded colours, spacing, radii or durations when a token exists. Layout with `Box`.
2. **Blue acts, green thinks.** Primary blue only on things the user does. AI green (`surface.icon.onSea.onSubtle`, `RayIcon`) only for Ray and AI output.
3. Map every product state to Calm / Joyful / Caution / Regret (DESIGN.md section 3).
4. `RazorSense` (the WebGL surface) is for success, AI loading, login and hero moments only. At most one per screen. Always `preloadRazorSenseAssets(preset)` first, and put a static fallback behind it, because Blade hides the canvas on slow devices.
5. Respect `prefersReducedMotion` from `src/razorsense.ts`.
6. Copy: lead with the number, amounts as ₹ with Indian grouping (₹2,40,000), one action per message, errors name the cause and the next step. Sentence case in UI.
7. Blade's MCP docs sometimes list a stale value (e.g. the border-radius scale) or accept a looser type than the installed version (e.g. `reasoningTraces` needs `{ label }` objects). The installed types win.

## Known quirks
- Blade's `TopNavBrand` and `TopNavActions` do not centre their content on their own below `xl`. `Shell.tsx` passes `paddingY` to the brand and fixes the actions' height; `e2e/shell.spec.ts` guards it. The logo is `public/razorpay-logo.svg`, not Blade's `RazorpayIcon`.
- `get_blade_component_docs` refuses to run until `create_blade_cursor_rules` has written files into the repo. Don't. Read the component source in `node_modules/@razorpay/blade/build/lib/web/development/components/<Name>/` instead.
- Blade assumes `box-sizing: border-box` on everything. `index.html` sets it. Without it the top bar overflows the window and clips the avatar.
- The top bar shows Razorpay, not the product name. Blindspot is one product tab beside Payments, and a section in the side nav. Everything Razorpay already ships is shown but inert (greyed, not clickable).
- Blade's `TabNav` crashes when it unmounts overflowing tabs. `Shell.tsx` renders every tab always. Do not switch it back to the `items` argument.
- Blade's `SideNav`, given `onDismiss`, renders two modal `Drawer`s at phone width and keeps the second mounted even when the menu is closed. Their focus managers set `aria-hidden` on `#root`, hide each other's portals (so the open menu is not in the accessibility tree) and let Tab escape. So `Shell.tsx` uses `SideNav` for desktop only and a plain Blade `Drawer` for the phone menu, which mounts only while open. Do not give `SideNav` an `onDismiss` again.
- `npm run dev` and the e2e config use port 5173, shared with every other worktree. If another chat has it, a test run hits their code. Use a different `--port` locally and do not commit that change.
- Blade's `Table` logs a React "Cannot update a component while rendering" warning in dev. It comes from Blade, not our code.
- Blade's `Table` logs "Cannot update a component (`_Table`) while rendering `_TableHeaderRow`" in dev. It is Blade's own, not ours.
- Blade's `Link` sets its text to `width: max-content`, so a long label never wraps and is cut off. Use it for short labels only. For a long title that must be a link (an incident in the list), use the router's `Link` around Blade `Text`, as `routes/Incidents.tsx` and the Explore cards do.
- Blade's `EmptyState` caps its asset at 60, 90, 120 or 160px square by size, and `xlarge` also makes the title display-sized. Use `size="large"` with a 120px-wide asset (`GuideArt` at 80px high), as Audit log and the WhatsApp demo do.
- Blade's `ChatMessage` with an array `loadingText` logs a `validateDOMNesting` warning in dev. It comes from Blade, not our code.
- `RayChat.tsx` draws the wash behind the pinned input as a plain `<div>` with an inline gradient built from Blade tokens (as `WelcomeTour.tsx` does for its picture wash), because `Box` takes no gradient. `App.tsx` gives `<main>` an inline minimum height on `/ray` only, for the same reason `main` is a plain element.
- `IssuesChart.tsx` draws its legend swatch as a plain `<span>` with an inline background read from the theme's chart colour token: Blade's `Box` throws on a `data.*` colour. It is the only raw element there.
- Blade has no image component and its `Box` takes no element type, so pictures are plain `<img>` (`GuideArt`, `GuideHero`, `WelcomeTour`, the first check) and the page's main region is a plain `<main>` in `App.tsx`. Keep them plain: no colours or spacing on them.
- In a hidden or background browser tab, Blade's frame-rate guard switches the RazorSense canvas off, and you'll see the static fallback. That's expected.
