# RazorSense starter

A starter for building Razorpay products in Razorpay's own design language, RazorSense, on top of Blade (`@razorpay/blade`, Razorpay's open-source design system).

**Read [DESIGN.md](DESIGN.md) before designing or building any screen.** It holds the principles, the four emotional states, tokens, motion, components, voice, and product context.

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
- `src/App.tsx`: reference screens (state switcher, voice examples, Ask Ray chat, success moment)

## Rules
1. Use Blade components and tokens. No hardcoded colours, spacing, radii or durations when a token exists. Layout with `Box`.
2. **Blue acts, green thinks.** Primary blue only on things the user does. AI green (`surface.icon.onSea.onSubtle`, `RayIcon`) only for Ray and AI output.
3. Map every product state to Calm / Joyful / Caution / Regret (DESIGN.md section 3).
4. `RazorSense` (the WebGL surface) is for success, AI loading, login and hero moments only. At most one per screen. Always `preloadRazorSenseAssets(preset)` first, and put a static fallback behind it, because Blade hides the canvas on slow devices.
5. Respect `prefersReducedMotion` from `src/razorsense.ts`.
6. Copy: lead with the number, amounts as ₹ with Indian grouping (₹2,40,000), one action per message, errors name the cause and the next step. Sentence case in UI.
7. Blade's MCP docs sometimes list a stale value (e.g. the border-radius scale) or accept a looser type than the installed version (e.g. `reasoningTraces` needs `{ label }` objects). The installed types win.

## Known quirks
- Blade assumes `box-sizing: border-box` on everything. `index.html` sets it. Without it the top bar overflows the window and clips the avatar.
- The top bar shows Razorpay, not the product name. Blindspot is a section in the side nav.
- Blade's `Table` logs a React "Cannot update a component while rendering" warning in dev. It comes from Blade, not our code.
- Blade's `Table` logs "Cannot update a component (`_Table`) while rendering `_TableHeaderRow`" in dev. It is Blade's own, not ours.
- Blade's `ChatMessage` with an array `loadingText` logs a `validateDOMNesting` warning in dev. It comes from Blade, not our code.
- In a hidden or background browser tab, Blade's frame-rate guard switches the RazorSense canvas off, and you'll see the static fallback. That's expected.
