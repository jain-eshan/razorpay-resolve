# RazorSense starter

A starting point for building Razorpay products in **RazorSense**, Razorpay's design language "for the humans in the AI era", using the real [Blade](https://github.com/razorpay/blade) components.

It includes:
- **[DESIGN.md](DESIGN.md)**: the design language in depth
  - principles
  - the four emotional states (Calm, Joyful, Caution, Regret)
  - colour, type, spacing and motion tokens with exact values
  - component specs and voice and tone
  - Razorpay product context
- **A reference app** built from Blade:
  - the live RazorSense surface switching between emotional states
  - how each state sounds in copy
  - an "Ask Ray" chat with the thinking state
  - a success moment
- **Blade MCP** wired in (`.mcp.json`), so AI coding tools can read Blade's component docs.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

## Sources
- RazorSense: https://razorpay.com/razorsense/
- Blade: https://github.com/razorpay/blade · Storybook: https://blade.razorpay.com/?path=/story/components-razorsense--default

Not affiliated with Razorpay. Blade is MIT-licensed; RazorSense assets load from Blade's public CDN.
