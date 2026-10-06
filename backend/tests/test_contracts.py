"""Contract tests for contracts-v0.1. A failure here means a stream changed a frozen contract without going through
contracts/ and docs/CONTRACT_CHANGES.md."""
import json
import re
import sqlite3
from pathlib import Path

import pytest
from app.config import FLAG_DEFAULTS, PROPOSED
from app.conversation.templates import TEMPLATES
from app.main import app
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
client = TestClient(app)


def test_schema_loads_and_has_v2_tables():
    db = sqlite3.connect(":memory:")
    db.executescript((ROOT / "contracts" / "schema.sql").read_text())
    tables = {r[0] for r in db.execute("select name from sqlite_master where type='table'")}
    assert {"merchants", "payments", "orders", "incidents", "channels", "threads", "thread_messages", "consents",
            "suppressions", "order_signals", "baselines", "probes", "handovers", "escalations", "feedback_events",
            "learning_params", "recovery_offers"} <= tables
    cols = lambda t: {r[1] for r in db.execute(f"pragma table_info({t})")}
    assert {"attempts", "first_attempt_at", "last_attempt_at"} <= cols("orders")
    assert {"zone", "inferred", "evidence_json"} <= cols("incidents")
    assert "replay_eligibility" in cols("webhook_events")


def test_openapi_matches_frozen_contract():
    frozen = json.loads((ROOT / "contracts" / "openapi.json").read_text())
    assert app.openapi() == frozen, "Run `make contracts` and record the change in docs/CONTRACT_CHANGES.md"


def test_every_manifest_path_serves_200():
    manifest = json.loads((ROOT / "contracts" / "snapshot_manifest.json").read_text())
    assert len(manifest) >= 30
    for e in manifest:
        assert client.get(e["path"]).status_code == 200, e["path"]


def test_templates_have_both_languages_and_declared_slots():
    for tid, t in TEMPLATES.items():
        used_en, used_hi = set(re.findall(r"{(\w+)}", t["en"])), set(re.findall(r"{(\w+)}", t["hi_latn"]))
        assert used_en == used_hi == set(t["slots"]), tid
        assert "—" not in t["en"] + t["hi_latn"], tid


def test_proposed_capabilities_default_to_mock():
    assert PROPOSED <= set(FLAG_DEFAULTS)
    assert not any(FLAG_DEFAULTS[f] for f in PROPOSED)


def test_pipeline_code_never_reads_ground_truth():
    for p in (ROOT / "backend" / "app").rglob("*.py"):
        assert "truth.db" not in p.read_text() and "truth_" not in p.read_text(), p


@pytest.mark.parametrize("folder", ["backend/app", "web/src", "synth", "eval"])
def test_no_em_dashes_in_code_and_copy(folder):
    for p in (ROOT / folder).rglob("*"):
        if p.suffix in {".py", ".ts", ".tsx", ".yaml", ".md"} and "types" not in p.parts:
            assert "—" not in p.read_text(), p
