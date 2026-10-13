# Resolve web app

The dashboard for Razorpay Resolve (developed as Blindspot): a React and Vite app built on Razorpay's open-source [Blade](https://github.com/razorpay/blade) design system, shaped as an addition to the live Razorpay dashboard. The product itself is described in the [root README](../README.md).

It has two modes. Without `VITE_MODE=live` it plays a guided demo from the recorded snapshot in `public/snapshot/` (and the big-brand account from `public/brand/`), so it needs no server. With `VITE_MODE=live` it talks to the engine on port 8000.

## Run it

From the repo root, `make setup` once, then:

```bash
make run-web      # http://localhost:5173
```

Or from this folder: `npm ci`, `npm run dev`. Other scripts: `npm run build` (typecheck and build), `npm run lint`, and `make e2e` from the root for the Playwright tests.

## Where to read

- [DESIGN.md](DESIGN.md): the design guide. Sections 14 to 22 are the rules for this product (the shell, page templates, the two demo accounts, names, the build checks).
- [CLAUDE.md](CLAUDE.md): what each source file is for, the rules for components and copy, and known quirks of Blade.

The product is closed as of 13 October 2026, so these two files describe the app as it was left.

Not affiliated with Razorpay. Blade is MIT-licensed.
