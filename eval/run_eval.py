"""Eval harness skeleton (R0). Reads world.db and truth.db, writes eval/report.json (EvalReport shape) and report.md.
Metrics arrive release by release; the three-arm comparison arrives in R4. Run: make eval"""
import sqlite3
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.schemas import EvalReport

data = ROOT / "data"
for f in ("world.db", "truth.db"):
    sqlite3.connect(data / f).execute("select 1 from sqlite_master").fetchone()  # fails loudly if missing
import yaml

seed = yaml.safe_load((ROOT / "synth" / "config.yaml").read_text())["seed"]
report = EvalReport(seed=seed, generated_at=datetime(2026, 10, 2, 10, 40, tzinfo=timezone(timedelta(hours=5, minutes=30))), metrics=[], arms=[])
(Path(__file__).parent / "report.json").write_text(report.model_dump_json(indent=2) + "\n")
(Path(__file__).parent / "report.md").write_text(f"# Eval report\n\nSeed {seed}. R0 skeleton: no metrics yet.\n")
print("eval: report written (no metrics yet)")
