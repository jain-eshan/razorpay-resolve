# Blindspot (working name)

Razorpay x ISB AI PM Build Challenge, Track 2. An agent that owns what happens before and after a payment: it finds every customer a payment problem touched, talks to them to find the payment, says whose side the fault is on, and fixes it with the founder approving.

Read `docs/PRD.md` first, then `docs/SPEC.md` and `docs/BUILD_PLAN.md`. `docs/V1_SPEC.md` is inherited where the v2 docs are silent.

## Run

```
make setup        # python deps, web deps, git hooks
make synth        # create data/world.db and data/truth.db (synthetic world, seed 20261006)
make pipeline     # run detection on the world and save incidents
make snapshot     # eval, then write web/public/snapshot/*.json from the real pipeline output
make run-web      # http://localhost:5173  (snapshot mode, no backend needed)
make run-api      # http://localhost:8000  (set VITE_MODE=live to use it)
make test         # backend tests, web typecheck and build, secret scan
make e2e          # Playwright smoke tests (uses your installed Chrome)
make eval         # compare the pipeline with hidden ground truth; fails on a missed gate
make contracts    # regenerate openapi.json, snapshot manifest and web types after a contract change
```

## Status

R0 and R1 done. Contracts are at v0.2 (`docs/CONTRACT_CHANGES.md`). The incident screens, day-0 scan and evaluation show real pipeline output on a synthetic world. Everything else (cases, threads, channels, actions) is still placeholder data from `backend/app/fixtures.py`.

Mocked or simulated: all Razorpay data, all channels, all customer conversations. Proposed Razorpay capabilities are listed in `backend/app/config.py` (`PROPOSED`) and in PRD section 15.
