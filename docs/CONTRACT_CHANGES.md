# Contract changes

A change to anything under `contracts/`, to `backend/app/schemas.py`, `backend/app/channels/base.py`, the template IDs and slots in
`backend/app/conversation/templates.py`, the capability flags in `backend/app/config.py` or `synth/config.yaml` needs a pull request that
updates `contracts/` (run `make contracts`), bumps the version below and adds an entry here. Streams do not edit these files directly.

## contracts-v0.4 (6 Oct 2026, during R3)

Additive only.
- Two templates in `backend/app/conversation/templates.py`: `T-ACK` (payment found, merchant side is being fixed) and `T-OK` (payment found, access is active). Both have English and Hinglish and are category `service`.
- `autonomy.MATRIX` gains the message classes `disclosure_or_question` (auto at every level), `status_reply` (founder on Suggest, auto on Assist and Autopilot) and `public_reply` (founder always).
- No API path or model changed. `BS_SOURCE=pipeline` now also serves threads, inbound, reply, handoff, channels, consents and cases from the real state machine. The pipeline creates one case per complaint.
- `data/threads.json` (40 scripted conversations) and `truth_threads` rows come from `python -m synth.generate`. No change to the SQL contract.
- The token vault's `token` column is a global primary key, so each complaint's tokens are stored as `<complaint_id>:[RRN_1]`.

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
