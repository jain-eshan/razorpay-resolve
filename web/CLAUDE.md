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
- `src/lib/guides.ts`, `routes/GuidePage.tsx`, `routes/Setup.tsx`, `routes/Home.tsx`: product guides (three slides: what, why, how), first-run setup, the Ray home with its welcome card.
- `src/components/GuideHero.tsx`, `IsoScenes.tsx`, `IsoHero.tsx`, `iso.tsx`, `src/lib/guideStats.ts`: the guide hero (a wash with an isometric scene, drawn in code with Blade tokens) and the figures on it, read from the data. `FlatArt.tsx` and `GuideArt.tsx`: the flat pictures on guide cards and in Setup, in the style of the dashboard home's illustrations, chosen by an `art` id.
- `src/routes/RenewalView.tsx`, `components/RenewalFix.tsx`, `components/RenewalChart.tsx`: INC-3, the incident on Razorpay's side (card renewals failed in its gateway): evidence, the 3 day grace extension in stages, the customer message, the evidence pack to Razorpay, and the renewal link once cards work again (10 percent held back). `Incident.tsx` sends `mismatch_type: G` here, `zone: before` to `Zone1View`.
- `src/routes/Leakage.tsx`: J6, "Access without payment" (`/access`): UPI renewals that failed on the customer's side while access stayed on past the merchant's own rule. A report only: no button, nothing written, no revoke. Read from `GET /api/leakage`, so the hosted demo needs no replay frames.
- `src/routes/DuplicateView.tsx`, `components/DuplicateFix.tsx`, `components/DuplicateChart.tsx`: INC-2, customers charged twice after an app release (the merchant's app, not the webhook): evidence, the look-alikes left out, a Refund button per customer (approved one at a time, never undoable), the customer message with the bank reference, and the developer's fix. `Incident.tsx` sends `mismatch_type: E` here. The hosted demo refunds in the order shown.
- `src/components/WhatsAppChat.tsx`, `src/lib/whatsapp.ts`: WhatsApp drawn as the app looks, for every message preview (DESIGN.md section 21). The only file besides `Reference.tsx` allowed hex colours and raw elements.
- `src/components/Accent.tsx`, `src/lib/useCountUp.ts`: the italic serif accent word and the count-up figure. `src/routes/Scan.tsx`: the Day-0 scan replay and report.
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
- Blade's `ChatMessage` with an array `loadingText` logs a `validateDOMNesting` warning in dev. It comes from Blade, not our code.
- In a hidden or background browser tab, Blade's frame-rate guard switches the RazorSense canvas off, and you'll see the static fallback. That's expected.
