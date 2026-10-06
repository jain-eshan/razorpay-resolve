# Blindspot (working name)

Razorpay x ISB AI PM Build Challenge, Track 2. An agent that owns what happens before and after a payment: it finds every customer a payment problem touched, talks to them to find the payment, says whose side the fault is on, and fixes it with the founder approving.

Read `docs/PRD.md` first, then `docs/SPEC.md` and `docs/BUILD_PLAN.md`. `docs/V1_SPEC.md` is inherited where the v2 docs are silent.

## Run

```
make setup        # python deps, web deps, git hooks
make synth        # create data/world.db and data/truth.db
make snapshot     # write web/public/snapshot/*.json from the stub API
make run-web      # http://localhost:5173  (snapshot mode, no backend needed)
make run-api      # http://localhost:8000  (set VITE_MODE=live to use it)
make test         # backend tests, web typecheck and build, secret scan
make eval         # eval report (R0 skeleton, no metrics yet)
make contracts    # regenerate openapi.json, snapshot manifest and web types after a contract change
```

## Status

R0 done. Contracts are at v0.1 (`docs/CONTRACT_CHANGES.md`). Everything the UI shows is placeholder data from `backend/app/fixtures.py` until R1.

Mocked or simulated: all Razorpay data, all channels, all customer conversations. Proposed Razorpay capabilities are listed in `backend/app/config.py` (`PROPOSED`) and in PRD section 15.
