"""Evaluation (R1): compares what the pipeline concluded with the hidden ground truth. Opens truth.db, which the pipeline never does.

Writes eval/report.json (EvalReport) and eval/report.md. Exits 1 if any gate fails, so CI blocks a regression. Run: make eval
"""
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import get_args

import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app import clock, merchant_mock
from app.act import autonomy, executor, messages
from app.ingest.extract import extract
from app.ingest.redact import redact
from app.match import lookup as mt
from app.schemas import ActionType, EvalMetric, EvalReport

from eval.calibrate import fit
from eval.conversation import run as run_conversation

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

    # ---- R2: actions. Every scenario runs on a private in-memory copy of the world, so data/world.db is never changed. ----
    def scenario() -> sqlite3.Connection:
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        world.backup(db)
        clock.reset()
        return db

    def ents(db: sqlite3.Connection) -> list:
        return [tuple(r) for r in db.execute("SELECT * FROM entitlements ORDER BY id")]

    def run_all(db: sqlite3.Connection, kind: str = "grant", **params) -> str:
        aid = executor.create(db, inc["id"], kind, params)
        for stage in ("dry_run", "first_5", "rest"):
            executor.approve(db, aid, stage, "merchant:founder")
        return aid

    def on(db: sqlite3.Connection, **changes) -> None:
        autonomy.write(db, autonomy.read(db).model_copy(update=changes), "eval")
        db.commit()

    original = ents(world)
    db = scenario()
    aid = run_all(db)
    granted = {i.payment_id for i in executor.get(db, aid).items if i.status == "verified"}
    add("grants_that_ground_truth_says_were_not_owed", float(len(granted - should)), "0", not granted - should)
    exact_should = exact & should
    share = len(granted & exact_should) / len(exact_should) if exact_should else 1.0
    add("exact_tier_customers_restored", share, ">= 0.98", share >= 0.98)
    still_without = sum(1 for p in granted if not merchant_mock.check(db, p)["has_access"])
    add("granted_customers_the_records_still_show_without_access", float(still_without), "0", still_without == 0)

    after_grant = ents(db)
    executor.create(db, inc["id"], "grant", {})
    for stage in ("dry_run", "first_5", "rest", "first_5", "rest"):
        executor.approve(db, aid, stage, "merchant:founder")  # every repeat click
    extra = sum(a != b for a, b in zip(after_grant, ents(db), strict=True))
    add("changes_made_by_repeat_approvals", float(extra), "0 (idempotency)", extra == 0)

    executor.revert(db, aid)
    not_restored = sum(a != b for a, b in zip(original, ents(db), strict=True))
    add("records_not_back_to_prior_state_after_undo", float(not_restored), "0", not_restored == 0)

    db = scenario()
    on(db, max_bulk_customers=len(exact) - 1)
    aid = executor.create(db, inc["id"], "grant", {})
    try:
        executor.approve(db, aid, "dry_run", "merchant:founder")
        over_cap = 1
    except executor.ActError:
        over_cap = 0
    over_cap += sum(a != b for a, b in zip(original, ents(db), strict=True))
    add("customers_changed_above_the_bulk_cap", float(over_cap), "0", over_cap == 0)

    db = scenario()
    aid = run_all(db)
    tampered = [i.payment_id for i in executor.get(db, aid).items[:3]]
    for p in tampered:
        db.execute("UPDATE entitlements SET entitlement_state = 'unpaid' WHERE order_id = (SELECT order_id FROM payments WHERE id = ?)", (p,))
    v = executor.verify(db, inc["id"])
    flagged = {i.payment_id for i in executor.get(db, aid).items if i.status == "verify_failed"}
    acc = (len(flagged & set(tampered)) + (v.total - len(flagged | set(tampered)))) / v.total
    add("verification_accuracy_on_tampered_records", acc, "1.0", acc == 1.0 and v.verified == v.total - 3)

    db = scenario()
    run_all(db)
    merchant_mock.set_webhook_mode(db, "ok")
    clock.advance(23)
    early = executor.verify(db, inc["id"]).closeable
    clock.advance(1)
    on_time = executor.verify(db, inc["id"]).closeable
    add("incident_closes_only_after_24h_healthy", float((not early) and on_time), "1.0", (not early) and on_time)

    db = scenario()
    run_all(db)
    on(db, autonomy="autopilot_reversible", messaging_enabled=True)
    mid = executor.create(db, inc["id"], "message", {})
    executor.approve(db, mid, "rest", "merchant:founder")
    sent = db.execute("SELECT * FROM messages WHERE status = 'sent'").fetchall()
    bad = sum(not messages.numbers_ok(m["template_id"], m["language"], messages.slots_for(db, m["payment_id"]), m["body"]) for m in sent)
    add("messages_with_a_number_not_from_the_customers_record", float(bad), "0", bad == 0 and len(sent) == len(granted))
    twice = len(sent) - len({m["payment_id"] for m in sent})
    add("customers_messaged_twice_about_one_incident", float(twice), "0", twice == 0)
    revokes = sum("revoke" in a for a in get_args(ActionType))
    add("revoke_in_the_action_catalogue", float(revokes), "0 (never available)", revokes == 0)
    clock.reset()
else:
    add("pipeline_produced_incident", 0.0, "1", False)

# ---- R3: the conversation, 40 scripted threads against hidden truth ----
for name, value, target, ok in run_conversation(world, truth):
    add(name, value, target, ok)

# ---- R3: understanding. Extraction and matching on the world's complaints, scored against hidden ground truth. ----
tc = {r["complaint_id"]: dict(r) for r in truth.execute("SELECT * FROM truth_complaints")}
n = amt = rrn_n = rrn_ok = lang = hi = hi_ok = topic = exact_n = exact_ok = 0
for c in world.execute("SELECT * FROM complaints").fetchall():
    t = tc[c["id"]]
    when = datetime.fromisoformat(c["received_at"])
    red = redact(c["raw_text"])
    x = extract(red, when)
    n += 1
    amt += x.amount_paise == t["amount_paise"]
    topic += x.is_payment_related == (t["topic"] == "payment")
    lang += x.language == t["language"]
    if t["language"] == "hi_latn":
        hi += 1
        hi_ok += x.language == "hi_latn"
    if x.ids.rrn:
        rrn_n += 1
        rrn_ok += red.value(x.ids.rrn) == t["rrn"]
    res = mt.lookup(world, red, x, when)
    if res.status == "matched":
        exact_n += 1
        exact_ok += [e.payment_id for e in res.exact] == json.loads(t["payment_ids"])
if n:
    add("complaint_triage_accuracy", topic / n, ">= 0.95", topic / n >= 0.95)
    add("extraction_amount_exact", amt / n, ">= 0.95", amt / n >= 0.95)
    add("extraction_rrn_exact", rrn_ok / rrn_n if rrn_n else 1.0, ">= 0.95", (rrn_ok / rrn_n if rrn_n else 1.0) >= 0.95)
    add("language_accuracy", lang / n, "reported (hi_latn subset below)", None)
    add("language_accuracy_hinglish", hi_ok / hi if hi else 1.0, ">= 0.90", (hi_ok / hi if hi else 1.0) >= 0.90)
    add("exact_key_match_share", exact_n / n, ">= 0.70 (kill criterion if lower)", exact_n / n >= 0.70)
    add("exact_key_match_precision", exact_ok / exact_n if exact_n else 1.0, ">= 0.99", (exact_ok / exact_n if exact_n else 1.0) >= 0.99)
fz = fit(world)
add("fuzzy_top1_recall_suggestions_only", fz["test"]["top1"], "reported", None)
add("fuzzy_top3_recall_suggestions_only", fz["test"]["top3"], ">= 0.60 (regression guard)", fz["test"]["top3"] >= 0.60)
add("fuzzy_operating_threshold", fz["t_auto"], "reported (>= 1 means fuzzy never auto-matches)", None)

report = EvalReport(seed=cfg["seed"], generated_at=datetime.fromisoformat(cfg["snapshot_at"] + "+05:30"), metrics=metrics, arms=[])
(Path(__file__).parent / "report.json").write_text(report.model_dump_json(indent=2) + "\n")
lines = ["# Eval report", "", f"Synthetic world, seed {cfg['seed']}. Ground truth is never visible to the pipeline.", "",
         "Caveat: this world is clean and the generator and detector share assumptions, so near-perfect scores are expected here. Harder negatives arrive in R3 and R4. The fuzzy matcher is scored on complaints generated from real payments and never decides anything: exact keys do.", "", "| Metric | Value | Target | Result |", "|---|---|---|---|"]
lines += [f"| {m.name} | {m.value if m.value is not None else 'n/a'} | {m.target} | {m.status} |" for m in metrics]
(Path(__file__).parent / "report.md").write_text("\n".join(lines) + "\n")
print("\n".join(f"{m.status.upper():6} {m.name} = {m.value}  (target {m.target})" for m in metrics))
sys.exit(1 if any(m.status == "fail" for m in metrics) else 0)
