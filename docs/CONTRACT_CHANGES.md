# Contract changes

A change to anything under `contracts/`, to `backend/app/schemas.py`, `backend/app/channels/base.py`, the template IDs and slots in
`backend/app/conversation/templates.py`, the capability flags in `backend/app/config.py` or `synth/config.yaml` needs a pull request that
updates `contracts/` (run `make contracts`), bumps the version below and adds an entry here. Streams do not edit these files directly.

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
