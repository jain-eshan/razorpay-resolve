.PHONY: setup hooks contracts synth pipeline snapshot eval run-api run-web test e2e lint
setup:
	uv sync
	cd web && npm ci
	$(MAKE) hooks
hooks:
	git config core.hooksPath .githooks
contracts:
	uv run python scripts/gen_contracts.py
	cd web && npx openapi-typescript ../contracts/openapi.json -o src/types/api.ts
synth:
	uv run python -m synth.generate --seed 20261006 --out data
pipeline: synth
	uv run python scripts/run_pipeline.py
eval: pipeline
	uv run python -m eval.run_eval
snapshot: eval
	BS_SOURCE=pipeline uv run python scripts/snapshot.py
run-api: pipeline
	BS_SOURCE=pipeline uv run uvicorn app.main:app --app-dir backend --reload --port 8000
run-web:
	cd web && npm run dev
test:
	uv run pytest -q
	cd web && npm run build
	./scripts/secret_scan.sh
e2e: snapshot
	cd web && npx playwright test
lint:
	uv run ruff check .
	cd web && npm run lint
