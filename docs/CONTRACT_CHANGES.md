# Contract changes

A change to anything under `contracts/`, to `backend/app/schemas.py`, `backend/app/channels/base.py`, the template IDs and slots in
`backend/app/conversation/templates.py`, the capability flags in `backend/app/config.py` or `synth/config.yaml` needs a pull request that
updates `contracts/` (run `make contracts`), bumps the version below and adds an entry here. Streams do not edit these files directly.

## contracts-v0.3 (6 Oct 2026, during R2)

Additive only. No path, required field or type changed.
- `Settings.autonomy` (`suggest` | `assist` | `autopilot_reversible`, default `suggest`): the autonomy dial. It is stored in `settings`; the per-channel dial in `channels.autonomy_level` arrives with channels in R3.
- `Action.next_stage` (the stage waiting for approval, or null) and `Action.blocked_reason` (why approving is refused right now: bulk cap, messaging off).
- `/merchant-mock/*` (health, entitlement check and grant, webhook mode, test webhook) is mounted on the same server but is not part of `/api` and not in `openapi.json`. It stands in for the merchant's own system until R6.
- No change to `contracts/schema.sql`: actions, action items, messages, audit log and settings were already in v0.1. The mock keeps its webhook state in two `settings` keys (`mock.webhook_mode`, `mock.webhook_ok_since`).
- `BS_SOURCE=pipeline` now also serves real actions, verify, audit, settings, message preview and clock. The default is still placeholder data.

## contracts-v0.2 (6 Oct 2026, during R1)

Additive only.
- Added `GET /api/scan/day0` (latest day-0 scan result). The static snapshot build cannot call `POST /api/scan/day0`, so the web reads this route. The POST stays.
- Snapshot manifest gains `scan/day0.json`.
- `BS_SOURCE=pipeline` environment switch: the API serves real pipeline output where it exists (R1: incidents, members, sample, trace, RAY card, evidence pack, replay, day-0 scan, eval report). The default remains placeholder data so tests and fresh clones work. No model or path changed.

## contracts-v0.1 (6 Oct 2026)

Initial freeze at the end of R0.
- `contracts/schema.sql`: v1 section 14 plus v2 section 5.
- `contracts/truth_schema.sql`: v1 truth tables plus v2 truth tables.
- `contracts/openapi.json`: 44 API paths generated from the stub API and `schemas.py`.
- `contracts/snapshot_manifest.json`: 32 snapshot files the web build loads.
- Channel adapter and policy interfaces: `backend/app/channels/base.py`.
- Templates (15) with IDs and slots: `backend/app/conversation/templates.py`.
- Capability flags: `backend/app/config.py`.
- Seeds and ID formats: `synth/config.yaml`.

R0 data is placeholder data from `backend/app/fixtures.py`. The stub API returns it so every stream can build against real shapes.
