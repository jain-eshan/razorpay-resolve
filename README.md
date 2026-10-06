# Blindspot (working name)

Razorpay x ISB AI PM Build Challenge, Track 2. An agent that owns what happens before and after a payment: it finds every customer a payment problem touched, talks to them to find the payment, says whose side the fault is on, and fixes it with the founder approving.

Read `docs/PRD.md` first, then `docs/SPEC.md` and `docs/BUILD_PLAN.md`. `docs/V1_SPEC.md` is inherited where the v2 docs are silent.

## Run

```
make setup        # python deps, web deps, git hooks
make synth        # create data/world.db and data/truth.db (synthetic world, seed 20261006)
make pipeline     # run detection on the world and save incidents
make snapshot     # eval, then write web/public/snapshot/ (data and the demo recording) from the real engine. Commit the result.
make run-web      # http://localhost:5173  (guided demo from the snapshot, no backend needed)
make run-api      # http://localhost:8000  (set VITE_MODE=live to use it)
make test         # backend tests, web typecheck and build, secret scan
make e2e          # Playwright smoke tests (uses your installed Chrome)
make eval         # compare the pipeline with hidden ground truth; fails on a missed gate
make contracts    # regenerate openapi.json, snapshot manifest and web types after a contract change
```

## Status

R0 to R3 done, plus a guided demo. Contracts are at v0.4 (`docs/CONTRACT_CHANGES.md`). What works: detection and the day-0 scan, fixing in stages with undo, messages in the merchant's voice, verify and close, an audit log, settings and autonomy, and a conversation agent on a help button, WhatsApp and email with a policy engine, cases and channels. Triage and extraction are rules, not a model.

The web app runs in two modes. Without `VITE_MODE=live` (the hosted site) it plays a guided demo from `web/public/snapshot/` with no server: frames recorded from the real engine. With `VITE_MODE=live` it talks to the API. A page reload restarts the demo.

For a new session start at `docs/HANDOFF.md`. What broke and why is in `docs/BUILD_LOG.md`.

Mocked or simulated: all Razorpay data, all channels, all customer conversations, screenshots (a script supplies the text). Proposed Razorpay capabilities are listed in `backend/app/config.py` (`PROPOSED`) and in PRD section 15.
