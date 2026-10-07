# Blindspot

Product monorepo (working name) for the Razorpay x ISB AI PM Build Challenge, Track 2. `main` is the only long-lived branch and holds the product. Work on a short-lived branch, merge by pull request once CI passes, and delete the branch.

**Read first:** `docs/PRD.md`, then `docs/SPEC.md` and `docs/BUILD_PLAN.md`. `docs/V1_SPEC.md` applies where the v2 docs are silent.

## Rules
- The hard rules are SPEC section 0. Numbers come from SQL or Python, never from a model. Nothing moves money or sends bulk messages without the approval the autonomy setting requires. The assistant never asks customers for credentials.
- Contracts are frozen (`contracts/`, `backend/app/schemas.py`, `backend/app/channels/base.py`, template IDs and slots, capability flags, `synth/config.yaml`). Change them only through `make contracts` and an entry in `docs/CONTRACT_CHANGES.md`.
- Each build stream owns its directories (BUILD_PLAN section 3). Do not edit another stream's files.
- No secrets in the repo. Razorpay keys are `rzp_test_` only, in `.env`.
- No em dashes in code, copy or docs.

## Branches and worktrees
One long-lived branch, `main`. Eshan runs one Claude chat per git worktree, so each chat works on its own short-lived branch: `git fetch`, cut it from `origin/main`, then `make setup` and `cd web && npm ci` in the new folder. Merge by PR once CI passes, delete the branch, remove the worktree. Details and traps: `docs/HANDOFF.md` section 3b.

## Web
Work in `web/`. Read `web/CLAUDE.md` and `web/DESIGN.md` first. Use Blade components and tokens only, and read a component's docs through the Blade MCP server (`.mcp.json`) before using one this repo has not used.

## Commands
`make setup`, `make synth`, `make snapshot`, `make run-web`, `make run-api`, `make test`, `make lint`, `make eval`, `make contracts`.
