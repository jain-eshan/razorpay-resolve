"""Evaluation (R1): compares what the pipeline concluded with the hidden ground truth. Opens truth.db, which the pipeline never does.

Writes eval/report.json (EvalReport) and eval/report.md. Exits 1 if any gate fails, so CI blocks a regression. Run: make eval
"""
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.schemas import EvalMetric, EvalReport

world = sqlite3.connect(ROOT / "data" / "world.db")
world.row_factory = sqlite3.Row
truth = sqlite3.connect(ROOT / "data" / "truth.db")
truth.row_factory = sqlite3.Row
cfg = yaml.safe_load((ROOT / "synth" / "config.yaml").read_text())

metrics: list[EvalMetric] = []


def add(name: str, value: float | None, target: str, ok: bool | None) -> None:
    status = "n/a" if value is None else "report" if ok is None else "pass" if ok else "fail"
    metrics.append(EvalMetric(name=name, value=None if value is None else round(value, 4), target=target, status=status))


def minutes(a: str, b: str) -> float:
    return abs((datetime.fromisoformat(a) - datetime.fromisoformat(b)).total_seconds()) / 60


incidents = world.execute("SELECT * FROM incidents ORDER BY onset_at").fetchall()
t_inc = truth.execute("SELECT * FROM truth_incidents").fetchall()
add("incidents_found_minus_true", len(incidents) - len(t_inc), "0 (no missed, no false incident)", len(incidents) == len(t_inc))

if incidents and t_inc:
    inc, ti = incidents[0], t_inc[0]
    sig = json.loads(inc["signature"])
    add("cause_and_owner_correct", float(inc["cause_code"] == ti["cause_code"] and inc["owner"] == ti["owner"]), "1.0", inc["cause_code"] == ti["cause_code"] and inc["owner"] == ti["owner"])
    err = minutes(inc["onset_at"], ti["onset_at"])
    add("onset_error_minutes", err, "<= 120 (two hourly buckets)", err <= 120)
    lat = minutes(sig["alert_at"], ti["onset_at"])
    add("alert_latency_minutes_from_deploy", lat, "<= 120", lat <= 120)
    add("customers_affected_when_alert_fires", float(sig["events_before_alert"]), "reported", None)

    members = {r["payment_id"]: dict(r) for r in world.execute("SELECT * FROM incident_members WHERE incident_id = ?", (inc["id"],))}
    tp = {r["payment_id"]: dict(r) for r in truth.execute("SELECT * FROM truth_payments WHERE incident_id = 'INC-1'")}
    exact = {p for p, m in members.items() if m["tier"] == "exact"}
    reach = {p for p, m in members.items() if m["tier"] in ("exact", "likely")}
    should = {p for p, t in tp.items() if t["should_fix"]}
    prec = len(exact & should) / len(exact) if exact else 0.0
    rec = len(reach & should) / len(should) if should else 1.0
    add("silent_victim_precision_exact_tier", prec, ">= 0.98", prec >= 0.98)
    add("silent_victim_recall_exact_plus_likely", rec, ">= 0.90", rec >= 0.90)

    covered = set(members) | set(tp)
    right = sum(1 for p in covered if (p in members and members[p]["tier"] == "excluded") == (p in tp and not tp[p]["should_fix"]) and (p in members) == (p in tp))
    add("inclusion_and_exclusion_accuracy", right / len(covered), ">= 0.98", right / len(covered) >= 0.98)
    reasons = {"already active (manual grant)": "already_active", "refunded": "refunded"}
    wrong_reason = sum(1 for p, m in members.items() if m["tier"] == "excluded" and reasons.get(m["exclusion_reason"]) != tp.get(p, {}).get("exclusion_reason"))
    add("exclusion_reasons_wrong", float(wrong_reason), "0", wrong_reason == 0)

    hidden = {p for p in should if world.execute("SELECT 1 FROM webhook_events WHERE payment_id = ? AND final_delivery_class = '2xx' AND (event_type = 'subscription.charged' OR (event_type = 'payment.captured' AND subscription_id IS NULL))", (p,)).fetchone()}
    hrec = len(hidden & reach) / len(hidden) if hidden else 1.0
    add("hidden_2xx_but_no_access_recall", hrec, ">= 0.90 (needs the access records)", hrec >= 0.90)

    complained = sum(m["complained"] for m in members.values())
    silent = len(members) - complained
    ratio = silent / complained if complained else float("inf")
    add("silent_to_complained_ratio", ratio, ">= 2 (kill criterion K1)", ratio >= 2)
    add("day0_customers_found_vs_truth", float(len(reach)), f"= {len(should)}", len(reach) == len(should))
else:
    add("pipeline_produced_incident", 0.0, "1", False)

report = EvalReport(seed=cfg["seed"], generated_at=datetime.fromisoformat(cfg["snapshot_at"] + "+05:30"), metrics=metrics, arms=[])
(Path(__file__).parent / "report.json").write_text(report.model_dump_json(indent=2) + "\n")
lines = ["# Eval report", "", f"Synthetic world, seed {cfg['seed']}. Ground truth is never visible to the pipeline.", "",
         "Caveat: this world is clean and the generator and detector share assumptions, so near-perfect scores are expected here. Harder negatives arrive in R3 and R4.", "", "| Metric | Value | Target | Result |", "|---|---|---|---|"]
lines += [f"| {m.name} | {m.value if m.value is not None else 'n/a'} | {m.target} | {m.status} |" for m in metrics]
(Path(__file__).parent / "report.md").write_text("\n".join(lines) + "\n")
print("\n".join(f"{m.status.upper():6} {m.name} = {m.value}  (target {m.target})" for m in metrics))
sys.exit(1 if any(m.status == "fail" for m in metrics) else 0)
