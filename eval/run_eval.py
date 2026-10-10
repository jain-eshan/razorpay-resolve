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
from eval.handovers import run as run_handovers
from eval.learning import run as run_learning

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


incidents = world.execute("SELECT * FROM incidents WHERE zone = 'after' ORDER BY onset_at").fetchall()
t_inc = truth.execute("SELECT * FROM truth_incidents").fetchall()
add("incidents_found_minus_true", len(incidents) - len(t_inc), "0 (no missed, no false incident after the payment)", len(incidents) == len(t_inc))

inc1 = next((i for i in incidents if i["id"] == "INC-1"), None)
if inc1 and t_inc:
    inc, ti = inc1, next(t for t in t_inc if t["incident_id"] == "INC-1")  # Hero A by name: INC-3 sits earlier in time but is a different story
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

# ---- R5: handovers (Instagram and Messenger control passing, public posts to private messages) ----
for name, value, target, ok in run_handovers(world, truth):
    add(name, value, target, ok)

# ---- R5: the learning loop, six synthetic weeks replayed with and without it ----
for name, value, target, ok in run_learning(cfg["seed"]):
    add(name, value, target, ok)

# ---- R3: understanding. Extraction and matching on the world's complaints, scored against hidden ground truth. ----
tc = {r["complaint_id"]: dict(r) for r in truth.execute("SELECT * FROM truth_complaints")}
failed_ids = {r[0] for r in world.execute("SELECT id FROM payments WHERE status = 'failed'")}  # INC-3's complaints name one of these. They are scored in the INC-3 section.
n = amt = rrn_n = rrn_ok = lang = hi = hi_ok = topic = exact_n = exact_ok = keyed = 0
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
    if json.loads(t["payment_ids"]) and not set(json.loads(t["payment_ids"])) & failed_ids:  # only complaints about a captured payment can be matched by an exact key. Before-the-payment complaints have none, and INC-3's name a failed renewal (scored below).
        keyed += 1
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
    add("exact_key_match_share", exact_n / keyed, ">= 0.70 (kill criterion if lower)", exact_n / keyed >= 0.70)
    add("exact_key_match_precision", exact_ok / exact_n if exact_n else 1.0, ">= 0.99", (exact_ok / exact_n if exact_n else 1.0) >= 0.99)
fz = fit(world)
add("fuzzy_top1_recall_suggestions_only", fz["test"]["top1"], "reported", None)
add("fuzzy_top3_recall_suggestions_only", fz["test"]["top3"], ">= 0.60 (regression guard)", fz["test"]["top3"] >= 0.60)
add("fuzzy_operating_threshold", fz["t_auto"], "reported (>= 1 means fuzzy never auto-matches)", None)


# ---- R4: before the payment (Zone 1). Two incidents to find, five look-alikes that must not alert, and recovery links. ----
from datetime import timedelta

from app.zone1 import recovery as z1_recovery
from app.zone1 import volume as z1_volume
from app.zone1.baselines import Orders

OWNER_OF = {"ROUTE_NOT_FOUND_AFTER_DEPLOY": "merchant_code", "CHECKOUT_KEY_MISMATCH": "merchant_config"}
zrows = [dict(r) for r in truth.execute("SELECT * FROM truth_zone1")]
pos, neg = [r for r in zrows if r["kind"] == "positive"], [r for r in zrows if r["kind"] == "negative"]
found = [dict(r) for r in world.execute("SELECT * FROM incidents WHERE zone = 'before' ORDER BY id")]
BUCKET = 30  # minutes. Detection must land within two buckets of the true onset (SPEC 14).
match: dict[str, dict] = {}
for t in pos:
    near = [f for f in found if minutes(f["onset_at"], t["onset_at"]) <= 2 * BUCKET and f["id"] not in {m["id"] for m in match.values()}]
    if near:
        match[t["incident_id"]] = min(near, key=lambda f: minutes(f["onset_at"], t["onset_at"]))
tp = len(match)
fp = [f for f in found if f["id"] not in {m["id"] for m in match.values()}]
add("zone1_positives_found", float(tp), f"= {len(pos)} (INC-4 and INC-5 within two buckets)", tp == len(pos))
add("zone1_onset_error_minutes_max", max((minutes(match[t["incident_id"]]["onset_at"], t["onset_at"]) for t in pos if t["incident_id"] in match), default=999.0), "<= 60 (two half-hour buckets)",
    all(minutes(match[t["incident_id"]]["onset_at"], t["onset_at"]) <= 2 * BUCKET for t in pos if t["incident_id"] in match) and tp == len(pos))
right = sum(1 for t in pos if t["incident_id"] in match and match[t["incident_id"]]["cause_code"] == t["cause_code"] and match[t["incident_id"]]["owner"] == OWNER_OF[t["cause_code"]])
add("zone1_cause_and_owner_correct", right / len(pos), "1.0", right == len(pos))
in_neg: list[dict] = []
for f in found:
    for n in neg:
        lo, hi = datetime.fromisoformat(n["onset_at"]) - timedelta(hours=2), datetime.fromisoformat(n["resolved_at"]) + timedelta(hours=2)
        if lo <= datetime.fromisoformat(f["onset_at"]) <= hi:
            in_neg.append(f)
add("zone1_look_alikes_raising_an_incident", float(len(in_neg)), "0 (N1 to N5 must not alert)", not in_neg)
add("zone1_incidents_not_in_ground_truth", float(len(fp)), "0 (false alarms over the whole fortnight)", not fp)
prec = tp / (tp + len(fp)) if tp + len(fp) else 0.0
add("zone1_precision", prec, ">= 0.80 (kill criterion K6)", prec >= 0.8)
add("zone1_recall", tp / len(pos), "reported", None)
spikes = [json.loads(r["details"]) | {"at": r["onset_at"]} for r in world.execute("SELECT details, onset_at FROM signals WHERE monitor = 'complaint_spike'")]
n4 = next(n for n in neg if n["incident_id"] == "N4")
bank = [s for s in spikes if s["routed"] == "bank" and abs(minutes(s["at"], n4["onset_at"])) <= 60]
add("zone1_bank_outage_routed_to_the_bank", float(len(bank)), ">= 1 (N4 routes to attribution row 7, no Zone 1 incident)", len(bank) >= 1)
n1 = next(n for n in neg if n["incident_id"] == "N1")
q = z1_volume.check(Orders(world), datetime.fromisoformat(n1["resolved_at"]))
add("zone1_quiet_night_is_insufficient_volume", float(q["status"] == "insufficient_volume"), "1.0 (never alert on a quiet hour)", q["status"] == "insufficient_volume")

members_ok = 0
for t in pos:
    m = match.get(t["incident_id"])
    if not m:
        continue
    want = {r["customer_id"]: r["role"] for r in truth.execute("SELECT * FROM truth_zone1_members WHERE incident_id = ?", (t["incident_id"],))}
    got = {r["payment_id"]: r["tier"] for r in world.execute("SELECT * FROM incident_members WHERE incident_id = ?", (m["id"],))}
    paid_since = {c for c, role in want.items() if role == "affected_paid_since"}
    members_ok += set(got) == set(want) and {c for c, tier in got.items() if tier == "excluded"} >= paid_since
add("zone1_members_match_ground_truth", members_ok / len(pos), "1.0 (who could not pay, and who got through anyway)", members_ok == len(pos))
errs = []
for t in pos:
    m = match.get(t["incident_id"])
    if m:
        est = json.loads(m["verdict_json"])["cause_summary_slots"]["lost_orders"]
        errs.append(abs(est - t["expected_lost_orders"]) / max(t["expected_lost_orders"], 1))
add("zone1_lost_orders_estimate_error_worst", max(errs, default=1.0), "<= 0.50 (an estimate, labelled as one)", bool(errs) and max(errs) <= 0.5)
inc4 = match.get("INC-4")
if inc4:
    alert = minutes(json.loads(inc4["signature"])["alert_at"], inc4["onset_at"])
    add("zone1_inc4_minutes_from_start_to_alert", alert, "reported (needs the pay-URL check switched on)", None)

# recovery links, on private copies of the world
def zone1_scenario() -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    world.backup(db)
    clock.reset()
    return db


if inc4:
    db = zone1_scenario()
    before = ([tuple(r) for r in db.execute("SELECT * FROM entitlements ORDER BY id")], db.execute("SELECT COUNT(*) FROM refunds").fetchone()[0])
    autonomy.write(db, autonomy.read(db).model_copy(update={"messaging_enabled": True}), "eval")
    db.commit()
    aid = executor.create(db, inc4["id"], "recovery_link", {})
    early = executor.get(db, aid).blocked_reason is not None
    merchant_mock.set_page_mode(db, "ok")
    clock.advance(2)
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, aid, stage, "merchant:founder")
    people = {p.customer_id: p for p in z1_recovery.people(db, inc4["id"])}
    sent = db.execute("SELECT * FROM messages WHERE action_id = ? AND status = 'sent'", (aid,)).fetchall()
    holdout = set(json.loads(db.execute("SELECT params_json FROM actions WHERE id = ?", (aid,)).fetchone()[0])["holdout"])
    outside = 0
    for m in sent:
        p = people[m["customer_id"]]
        outside += z1_recovery.contact_rule(p.channel, p.last_inbound_at, datetime.fromisoformat(m["created_at"])) is not None
    add("zone1_links_blocked_until_the_fix_is_confirmed", float(early), "1.0", early)
    add("zone1_links_sent_outside_the_channel_window_or_without_permission", float(outside), "0", outside == 0)
    add("zone1_held_back_customers_messaged", float(sum(1 for m in sent if m["customer_id"] in holdout)), "0", not any(m["customer_id"] in holdout for m in sent))
    twice = len(sent) - len({m["customer_id"] for m in sent})
    add("zone1_customers_sent_two_links", float(twice), "0", twice == 0)
    after = ([tuple(r) for r in db.execute("SELECT * FROM entitlements ORDER BY id")], db.execute("SELECT COUNT(*) FROM refunds").fetchone()[0])
    add("zone1_money_or_access_changes_from_an_inferred_incident", float(after != before), "0 (inferred incidents never move money or access)", after == before)
    clock.advance(48)
    z1_recovery.settle(db)
    o = z1_recovery.outcome(db, inc4["id"])
    add("zone1_recovered_rupees_simulated_customers", o["recovered_paise"] / 100, "reported (synthetic customer behaviour, not a result)", None)
    add("zone1_paid_with_link_of_sent", o["sent_paid"] / max(o["sent"], 1), "reported (n is small)", None)
    add("zone1_paid_without_link_of_held_back", o["held_back_paid"] / max(o["held_back"], 1), "reported (n is 1: too few to estimate uplift)", None)
    db = zone1_scenario()
    merchant_mock.set_page_mode(db, "ok")
    clock.advance(1)
    too_early = executor.verify(db, inc4["id"]).closeable
    clock.advance(1)
    on_time = executor.verify(db, inc4["id"]).closeable
    add("zone1_incident_closes_only_after_two_healthy_hours", float((not too_early) and on_time), "1.0", (not too_early) and on_time)
    clock.reset()


# ---- R4/R5: INC-3, card renewals that failed on Razorpay's side, and the escalation pack. Scored against hidden truth. ----
ti3 = truth.execute("SELECT * FROM truth_incidents WHERE incident_id = 'INC-3'").fetchone()
inc3 = world.execute("SELECT * FROM incidents WHERE id = 'INC-3'").fetchone()
if ti3:
    add("renewal_incident_found", float(inc3 is not None), "1.0 (INC-3 within two buckets)", inc3 is not None and minutes(inc3["onset_at"], ti3["onset_at"]) <= 60)
if ti3 and inc3:
    err3 = minutes(inc3["onset_at"], ti3["onset_at"])
    add("renewal_onset_error_minutes", err3, "<= 60", err3 <= 60)
    add("renewal_cause_and_owner_correct", float(inc3["cause_code"] == ti3["cause_code"] and inc3["owner"] == ti3["owner"]), "1.0", inc3["cause_code"] == ti3["cause_code"] and inc3["owner"] == ti3["owner"])
    add("renewal_minutes_from_start_to_alert", minutes(json.loads(inc3["signature"])["alert_at"], ti3["onset_at"]), "reported (needs 5 failures in a row to raise anything)", None)
    false3 = [i for i in world.execute("SELECT id FROM incidents WHERE mismatch_type = 'G'") if i["id"] != "INC-3"]
    add("renewal_incidents_not_in_ground_truth", float(len(false3)), "0 (no false renewal alarm over the fortnight)", not false3)
    m3 = {r["payment_id"]: r["tier"] for r in world.execute("SELECT payment_id, tier FROM incident_members WHERE incident_id = 'INC-3'")}
    t3 = {r["payment_id"]: dict(r) for r in truth.execute("SELECT * FROM truth_payments WHERE incident_id = 'INC-3'")}
    owed = {p for p, t in t3.items() if t["should_fix"]}
    ex3 = {p for p, tier in m3.items() if tier == "exact"}
    add("renewal_fix_precision", len(ex3 & owed) / len(ex3) if ex3 else 0.0, ">= 0.98", bool(ex3) and len(ex3 & owed) / len(ex3) >= 0.98)
    add("renewal_fix_recall", len(ex3 & owed) / len(owed) if owed else 1.0, ">= 0.98", (len(ex3 & owed) / len(owed) if owed else 1.0) >= 0.98)
    add("renewal_members_not_in_ground_truth", float(len(set(m3) - set(t3))), "0", not set(m3) - set(t3))
    again = {p for p, t in t3.items() if t["exclusion_reason"] == "paid_since"}
    add("renewal_paid_again_left_out", float(len(again & ex3)), "0 (customers who paid again are not in the fix)", not again & ex3)
    tc3 = {r["complaint_id"] for r in truth.execute("SELECT complaint_id, payment_ids FROM truth_complaints") if set(json.loads(r["payment_ids"])) & set(t3)}
    joined = {r["complaint_id"] for r in world.execute("SELECT complaint_id FROM cases WHERE incident_id = 'INC-3'")}
    add("renewal_complaints_joined_to_the_incident", len(tc3 & joined) / len(tc3) if tc3 else 1.0, "1.0", tc3 <= joined)

    def renewal_scenario() -> sqlite3.Connection:
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        world.backup(db)
        clock.reset()
        return db

    def all_ents(db: sqlite3.Connection) -> list:
        return [tuple(r) for r in db.execute("SELECT * FROM entitlements ORDER BY id")]

    db = renewal_scenario()
    base_ents = all_ents(db)
    gid = executor.create(db, "INC-3", "grant", {})
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, gid, stage, "merchant:founder")
    granted3 = {i.payment_id for i in executor.get(db, gid).items if i.status == "verified"}
    add("renewal_grace_for_customers_not_owed", float(len(granted3 - owed)), "0", not granted3 - owed)
    add("renewal_customers_covered", len(granted3 & owed) / len(owed) if owed else 1.0, ">= 0.98", (len(granted3 & owed) / len(owed) if owed else 1.0) >= 0.98)
    done = all_ents(db)
    for stage in ("first_5", "rest", "rest"):
        executor.approve(db, gid, stage, "merchant:founder")
    add("renewal_changes_made_by_repeat_approvals", float(sum(a != b for a, b in zip(done, all_ents(db), strict=True))), "0 (idempotency)", done == all_ents(db))
    touched = sum(1 for p in again for r in db.execute("SELECT e.* FROM entitlements e JOIN payments pm ON pm.subscription_id = e.subscription_id WHERE pm.id = ?", (p,)) if tuple(r) not in base_ents)
    add("renewal_paid_again_customers_touched", float(touched), "0", touched == 0)
    executor.revert(db, gid)
    add("renewal_records_not_back_after_undo", float(sum(a != b for a, b in zip(base_ents, all_ents(db), strict=True))), "0", base_ents == all_ents(db))

    db = renewal_scenario()
    autonomy.write(db, autonomy.read(db).model_copy(update={"messaging_enabled": True}), "eval")
    db.commit()
    try:
        executor.create(db, "INC-3", "message", {"language": "auto"})
        early_msg = 1
    except executor.ActError:
        early_msg = 0
    add("renewal_messages_planned_before_access_is_kept", float(early_msg), "0 (nobody is told before it is true)", early_msg == 0)
    gid = executor.create(db, "INC-3", "grant", {})
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, gid, stage, "merchant:founder")
    mid = executor.create(db, "INC-3", "message", {"language": "auto"})
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, mid, stage, "merchant:founder")
    sent3 = db.execute("SELECT * FROM messages WHERE template_id = 'T-G1' AND status = 'sent'").fetchall()
    bad3 = sum(not messages.numbers_ok(m["template_id"], m["language"], messages.slots_for(db, m["payment_id"]), m["body"]) for m in sent3)
    add("renewal_messages_with_a_number_not_from_the_record", float(bad3), "0", bad3 == 0 and len(sent3) == len(granted3))
    add("renewal_customers_messaged_twice", float(len(sent3) - len({m["payment_id"] for m in sent3})), "0", len(sent3) == len({m["payment_id"] for m in sent3}))

    db = renewal_scenario()
    gid = executor.create(db, "INC-3", "grant", {})
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, gid, stage, "merchant:founder")
    ok_close = executor.verify(db, "INC-3").closeable
    last_bad = json.loads(inc3["signature"])["last_failure_at"]
    db.execute("UPDATE payments SET status = 'failed', captured_at = NULL WHERE is_renewal = 1 AND method = 'card' AND created_at > ?", (last_bad,))
    still_failing = executor.verify(db, "INC-3").closeable
    add("renewal_closes_only_when_cards_work_again", float(ok_close and not still_failing), "1.0", ok_close and not still_failing)

    # the renewal link, sent once cards work again to the customers who were promised one
    from app.zone1 import recovery as z1recovery

    def links_scenario() -> tuple[sqlite3.Connection, str]:
        db = renewal_scenario()
        autonomy.write(db, autonomy.read(db).model_copy(update={"messaging_enabled": True}), "eval")
        for kind in ("grant", "message"):
            aid = executor.create(db, "INC-3", kind, {"language": "auto"})
            for stage in ("dry_run", "first_5", "rest"):
                executor.approve(db, aid, stage, "merchant:founder")
        return db, executor.create(db, "INC-3", "recovery_link", {"language": "auto"})

    db = renewal_scenario()
    autonomy.write(db, autonomy.read(db).model_copy(update={"messaging_enabled": True}), "eval")
    gid = executor.create(db, "INC-3", "grant", {})
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, gid, stage, "merchant:founder")
    try:
        executor.create(db, "INC-3", "recovery_link", {})
        early_link = 1
    except executor.ActError:
        early_link = 0
    add("renewal_links_planned_before_customers_are_told", float(early_link), "0 (the link follows the message that promised it)", early_link == 0)

    db, lid = links_scenario()
    db.execute("UPDATE payments SET status = 'failed', captured_at = NULL WHERE is_renewal = 1 AND method = 'card' AND created_at > ?", (last_bad,))
    try:
        executor.approve(db, lid, "dry_run", "merchant:founder")
    except executor.ActError:
        pass
    early_sent = db.execute("SELECT COUNT(*) FROM messages WHERE template_id = 'T-G2' AND status = 'sent'").fetchone()[0]
    add("renewal_links_sent_while_cards_still_fail", float(early_sent), "0 (nothing goes out until card renewals work again)", early_sent == 0)

    db, lid = links_scenario()
    plan3 = executor.get(db, lid)
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, lid, stage, "merchant:founder")
    held3 = set(plan3.params["holdout"])
    links3 = db.execute("SELECT * FROM messages WHERE template_id = 'T-G2' AND status = 'sent'").fetchall()
    to3 = {m["payment_id"] for m in links3}
    add("renewal_links_to_customers_not_owed", float(len(to3 - owed)), "0 (only customers whose renewal failed on Razorpay's side)", not to3 - owed)
    add("renewal_links_to_customers_who_paid_again", float(len(to3 & again)), "0", not to3 & again)
    add("renewal_customers_sent_two_links", float(len(links3) - len({m["customer_id"] for m in links3})), "0 (one link each)", len(links3) == len({m["customer_id"] for m in links3}))
    add("renewal_held_back_customers_messaged", float(len(to3 & held3)), "0 (the held-back group gets nothing)", not to3 & held3)
    add("renewal_customers_held_back", float(len(held3)), f"reported ({len(plan3.items)} planned, 10 percent held back by a hash so nobody chooses)", None)
    bad_links = sum(not messages.numbers_ok(m["template_id"], m["language"], messages.slots_for(db, m["payment_id"]) | {"hours": z1recovery.LINK_HOURS}, m["body"]) for m in links3)
    add("renewal_link_messages_with_a_number_not_from_the_record", float(bad_links), "0", bad_links == 0 and len(links3) == len(plan3.items) - len(held3))
    clock.advance(48)
    z1recovery.settle(db)
    out3 = z1recovery.outcome(db, "INC-3")
    add("renewal_paid_after_a_link_simulated", float(out3["sent_paid"]), f"reported, of {out3['sent']} sent (simulated customers, not a result)", None)
    add("renewal_paid_without_a_link_simulated", float(out3["held_back_paid"]), f"reported, of {out3['held_back']} held back (too few to say what the link adds)", None)
    clock.reset()

    # the escalation to Razorpay
    from app.act import escalate

    db = renewal_scenario()
    esc = escalate.create(db, "INC-3", "razorpay")
    add("escalation_sent_without_the_founders_approval", float(esc.status != "drafted"), "0 (drafted until the founder sends)", esc.status == "drafted")
    add("escalation_pack_payments_match_ground_truth", float(set(esc.pack["payment_ids"]) == set(t3)), "1.0", set(esc.pack["payment_ids"]) == set(t3))
    people = db.execute("SELECT c.name, c.email, c.phone, c.vpa FROM customers c JOIN payments pm ON pm.customer_id = c.id JOIN incident_members im ON im.payment_id = pm.id WHERE im.incident_id = 'INC-3'").fetchall()
    blob = json.dumps(esc.pack)
    leaked = sum(any(v and v in blob for v in tuple(r)) for r in people)
    add("escalation_pack_customer_details", float(leaked), "0 (payment ids and counts only)", leaked == 0)
    try:
        escalate.create(db, "INC-1", "razorpay")
        refused = 0
    except executor.ActError:
        refused = 1
    add("escalation_of_a_merchant_side_incident_refused", float(refused), "1.0 (only what is Razorpay's goes to Razorpay)", refused == 1)
    escalate.send(db, esc.id, "merchant:founder")
    add("escalation_messages_sent_to_customers", float(db.execute("SELECT COUNT(*) FROM messages").fetchone()[0]), "0", db.execute("SELECT COUNT(*) FROM messages").fetchone()[0] == 0)
    clock.reset()


# ---- R4: INC-2, customers charged twice after an app release, and the guarded refund. Scored against hidden truth. ----
ti2 = truth.execute("SELECT * FROM truth_incidents WHERE incident_id = 'INC-2'").fetchone()
inc2 = world.execute("SELECT * FROM incidents WHERE id = 'INC-2'").fetchone()
if ti2:
    add("duplicate_incident_found", float(inc2 is not None), "1.0 (INC-2 within an hour of the first double charge)", inc2 is not None and minutes(inc2["onset_at"], ti2["onset_at"]) <= 60)
if ti2 and inc2:
    sig2 = json.loads(inc2["signature"])
    add("duplicate_cause_owner_and_release_correct", float(inc2["cause_code"] == ti2["cause_code"] and inc2["owner"] == ti2["owner"] and sig2["release_id"] == ti2["linked_event_id"]), "1.0 (cause, owner, and the app release it began at)",
        inc2["cause_code"] == ti2["cause_code"] and inc2["owner"] == ti2["owner"] and sig2["release_id"] == ti2["linked_event_id"])
    seconds2 = [r["at"] for r in world.execute("SELECT COALESCE(p.captured_at, p.created_at) AS at FROM incident_members im JOIN payments p ON p.id = im.payment_id WHERE im.incident_id = 'INC-2' AND im.tier = 'exact'")]
    add("duplicate_charges_when_alert_fires", float(sum(1 for t in seconds2 if t <= sig2["alert_at"])), "reported (it needs 3 double charges from one app version)", None)
    add("duplicate_minutes_from_first_double_charge_to_alert", minutes(sig2["alert_at"], ti2["onset_at"]), "reported", None)
    false2 = [i for i in world.execute("SELECT id FROM incidents WHERE mismatch_type = 'E'") if i["id"] != "INC-2"]
    add("duplicate_incidents_not_in_ground_truth", float(len(false2)), "0 (no false double-charge alarm over the fortnight)", not false2)
    m2 = {r["payment_id"]: r["tier"] for r in world.execute("SELECT payment_id, tier FROM incident_members WHERE incident_id = 'INC-2'")}
    t2 = {r["payment_id"]: dict(r) for r in truth.execute("SELECT * FROM truth_payments WHERE incident_id = 'INC-2'")}
    owed2 = {p for p, t in t2.items() if t["should_fix"]}
    ex2 = {p for p, tier in m2.items() if tier == "exact"}
    add("duplicate_pairs_precision", len(ex2 & owed2) / len(ex2) if ex2 else 0.0, ">= 0.98", bool(ex2) and len(ex2 & owed2) / len(ex2) >= 0.98)
    add("duplicate_pairs_recall", len(ex2 & owed2) / len(owed2) if owed2 else 1.0, ">= 0.98", (len(ex2 & owed2) / len(owed2) if owed2 else 1.0) >= 0.98)
    look = {p for p, t in t2.items() if t["exclusion_reason"] in ("legit_second_purchase", "second_attempt_failed")}
    add("duplicate_look_alikes_in_the_refund_list", float(len(look & ex2)), "0 (two seats for two people and failed second attempts are left out)", not look & ex2)
    add("duplicate_look_alikes_left_out_with_a_reason", float(len(look & {p for p, tier in m2.items() if tier == "excluded"})), f"= {len(look)} (shown as left-out rows)", look <= {p for p, tier in m2.items() if tier == "excluded"})
    add("duplicate_members_not_in_ground_truth", float(len(set(m2) - set(t2))), "0", not set(m2) - set(t2))
    tc2 = {r["complaint_id"] for r in truth.execute("SELECT complaint_id FROM truth_complaints WHERE mismatch_type = 'E'")}
    joined2 = {r["complaint_id"] for r in world.execute("SELECT complaint_id FROM cases WHERE incident_id = 'INC-2'")}
    add("duplicate_complaints_joined_to_the_incident", len(tc2 & joined2) / len(tc2) if tc2 else 1.0, "1.0 (whether the customer names the first or the second charge)", tc2 <= joined2)
    said2 = sum(r[0] for r in world.execute("SELECT complained FROM incident_members WHERE incident_id = 'INC-2' AND tier = 'exact'"))
    add("double_charge_silent_vs_wrote_in_ratio", (len(ex2) - said2) / said2 if said2 else float("inf"), "reported (customers who were charged twice and have not written in)", None)

    from app.act import refund as refunds

    def dup_scenario() -> sqlite3.Connection:
        db = sqlite3.connect(":memory:")
        db.row_factory = sqlite3.Row
        world.backup(db)
        clock.reset()
        return db

    def refund_all(db: sqlite3.Connection) -> str:
        aid = executor.create(db, "INC-2", "refund", {})
        executor.approve(db, aid, "dry_run", "merchant:founder")
        for it in executor.get(db, aid).items:
            try:
                executor.approve_row(db, aid, it.payment_id, "merchant:founder")
            except executor.ActError:
                pass
        return aid

    pays_before = {r["id"]: r["status"] for r in world.execute("SELECT id, status FROM payments")}
    db = dup_scenario()
    aid = refund_all(db)
    refunded2 = {r["payment_id"] for r in db.execute("SELECT payment_id FROM refunds WHERE source = 'make_good'")}
    add("refunds_that_ground_truth_says_were_not_owed", float(len(refunded2 - owed2)), "0", not refunded2 - owed2)
    add("duplicates_refunded_within_the_daily_limit", len(refunded2 & owed2) / len(owed2) if owed2 else 1.0, ">= 0.98 (the default limit of Rs 5,000 covers the Rs 4,985 owed)", (len(refunded2 & owed2) / len(owed2) if owed2 else 1.0) >= 0.98)
    add("refunded_customers_without_a_refund_record", float(len([p for p in refunded2 if not refunds.check(db, p)])), "0", all(refunds.check(db, p) for p in refunded2))
    other = sum(1 for r in db.execute("SELECT id, status FROM payments") if r["status"] != pays_before[r["id"]] and r["id"] not in refunded2)
    add("payments_changed_other_than_the_refunded_ones", float(other), "0", other == 0)
    cols = {r["name"] for r in db.execute("PRAGMA table_info(refunds)")}
    add("refund_columns_that_could_hold_another_destination", float(len(cols & {"destination", "account", "vpa", "iban", "to_account", "method"})), "0 (original method only: there is nowhere to put another)", not cols & {"destination", "account", "vpa", "iban", "to_account", "method"})
    done = db.execute("SELECT COUNT(*), MAX(c) FROM (SELECT COUNT(*) AS c FROM refunds WHERE source = 'make_good' GROUP BY payment_id)").fetchone()
    autonomy.write(db, autonomy.read(db).model_copy(update={"daily_refund_cap_paise": 10_000_000}), "eval")  # lift the daily limit so only the one-refund-per-payment rule is being tested
    db.commit()
    for _ in range(2):  # every repeat click, and a fresh plan request
        for it in executor.get(db, aid).items:
            try:
                executor.approve_row(db, aid, it.payment_id, "merchant:founder")
            except executor.ActError:
                pass
        executor.create(db, "INC-2", "refund", {})
    after = db.execute("SELECT COUNT(*), MAX(c) FROM (SELECT COUNT(*) AS c FROM refunds WHERE source = 'make_good' GROUP BY payment_id)").fetchone()
    add("second_refunds_after_repeat_approvals", float(after[0] - done[0] + (after[1] - 1)), "0 (idempotency: one refund per payment)", after[0] == done[0] and after[1] == 1)
    try:
        executor.revert(db, aid)
        undone = 1
    except executor.ActError:
        undone = 0
    add("refunds_that_could_be_undone", float(undone), "0 (a refund cannot be taken back, and the screen says so)", undone == 0)

    db = dup_scenario()
    aid = executor.create(db, "INC-2", "refund", {})
    on = lambda **c: (autonomy.write(db, autonomy.read(db).model_copy(update=c), "eval"), db.commit())
    on(autonomy="autopilot_reversible")
    executor.create(db, "INC-2", "refund", {})
    n_auto = db.execute("SELECT COUNT(*) FROM refunds").fetchone()[0] - len([1 for r in world.execute("SELECT 1 FROM refunds")])
    add("refunds_made_by_the_autonomy_setting", float(n_auto), "0 (even on Autopilot a person approves every refund)", n_auto == 0)
    executor.approve(db, aid, "dry_run", "merchant:founder")
    refused = 0
    for stage in ("first_5", "rest"):
        try:
            executor.approve(db, aid, stage, "merchant:founder")
        except executor.ActError:
            refused += 1
    try:
        executor.approve_row(db, aid, next(iter(owed2)), "auto:autopilot_reversible")
    except executor.ActError:
        refused += 1
    n_bulk = db.execute("SELECT COUNT(*) FROM refunds").fetchone()[0] - len([1 for r in world.execute("SELECT 1 FROM refunds")])
    add("refunds_made_in_bulk_or_by_a_script", float(n_bulk), "0 (whole-list stages and non-person approvers are refused)", n_bulk == 0 and refused == 3)
    sneaky = 0
    for pid in look:
        try:
            refunds.issue(db, pid, "merchant:founder", "INC-2")
            sneaky += 1
        except PermissionError:
            pass
    add("look_alikes_refunded_when_asked_directly", float(sneaky), "0 (a payment outside the Exact tier is refused by the refund engine itself)", sneaky == 0)

    db = dup_scenario()
    limit = 200_000
    autonomy.write(db, autonomy.read(db).model_copy(update={"daily_refund_cap_paise": limit}), "eval")
    db.commit()
    refund_all(db)
    spent = refunds.spent_today(db)
    add("refunded_in_one_day_above_the_limit", float(max(spent - limit, 0)), "0 (the refund that would pass the daily limit is refused)", spent <= limit and spent > 0)
    day1 = db.execute("SELECT COUNT(*) FROM refunds WHERE source = 'make_good'").fetchone()[0]
    clock.advance(24)
    refund_all(db)
    day2 = db.execute("SELECT COUNT(*) FROM refunds WHERE source = 'make_good'").fetchone()[0] - day1
    add("refunds_waiting_on_the_limit_go_out_the_next_day", float(day2), "> 0 and again within the limit (the limit is per day, not a total)", day2 > 0 and refunds.spent_today(db) <= limit)
    clock.reset()

    db = dup_scenario()
    autonomy.write(db, autonomy.read(db).model_copy(update={"messaging_enabled": True}), "eval")
    db.commit()
    refund_all(db)
    try:
        executor.create(db, "INC-2", "message", {"language": "auto"})
        early2 = 1
    except executor.ActError:
        early2 = 0
    add("refund_messages_planned_before_the_bank_reference_exists", float(early2), "0 (a customer is told once the refund has a reference)", early2 == 0)
    clock.advance(72)
    refunds.settle(db, clock.now())
    mid = executor.create(db, "INC-2", "message", {"language": "auto"})
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, mid, stage, "merchant:founder")
    sent2 = db.execute("SELECT * FROM messages WHERE template_id = 'T-E1' AND status = 'sent'").fetchall()
    bad2 = sum(not messages.numbers_ok(m["template_id"], m["language"], messages.slots_for(db, m["payment_id"]), m["body"]) for m in sent2)
    wrong_ref = sum(1 for m in sent2 if not ((r := db.execute("SELECT * FROM refunds WHERE payment_id = ?", (m["payment_id"],)).fetchone()) and r["id"] in m["body"] and (r["arn"] or r["rrn"]) in m["body"]))
    add("refund_messages_with_a_number_not_from_the_record", float(bad2 + wrong_ref), "0", bad2 == 0 and wrong_ref == 0 and len(sent2) == len(refunded2))
    add("customers_messaged_twice_about_a_refund", float(len(sent2) - len({m["payment_id"] for m in sent2})), "0", len(sent2) == len({m["payment_id"] for m in sent2}))

    db = dup_scenario()
    refund_all(db)
    clock.advance(72)
    refunds.settle(db, clock.now())
    before_fix = executor.verify(db, "INC-2").closeable
    merchant_mock.set_app_mode(db, "fixed")
    clock.advance(1)
    too_soon = executor.verify(db, "INC-2").closeable
    clock.advance(24)
    closed = executor.verify(db, "INC-2").closeable
    add("incident_closes_only_after_the_fix_has_held_24h", float(not before_fix and not too_soon and closed), "1.0 (refunds are not enough: the app must stop doubling first)", not before_fix and not too_soon and closed)
    clock.reset()

# ---- J6: access without payment, a read-only report. Scored against hidden truth (`truth_leakage`). ----
from app import leakage as leakage_report

states = {}
for r in truth.execute("SELECT payment_id, state FROM truth_leakage"):
    states.setdefault(r["state"], set()).add(r["payment_id"])
if states:
    rep = leakage_report.report(world, clock.now())
    listed, soon = {x.payment_id for x in rep.rows}, {x.payment_id for x in rep.inside_rule}
    add("leakage_report_precision", len(listed & states["leak"]) / len(listed) if listed else 0.0, ">= 0.98", bool(listed) and len(listed & states["leak"]) / len(listed) >= 0.98)
    add("leakage_report_recall", len(listed & states["leak"]) / len(states["leak"]), ">= 0.98", len(listed & states["leak"]) / len(states["leak"]) >= 0.98)
    look2 = states["access_cut"] | states["paid_since"] | states["not_theirs"]
    add("leakage_look_alikes_in_the_report", float(len((listed | soon) & look2)), "0 (access already cut, paid again, bank-side failures)", not (listed | soon) & look2)
    add("leakage_inside_rule_shown_as_leaks", float(len(listed & states["inside_grace"])), "0 (a failure inside the merchant's own 48 hour rule is not a leak yet)", not listed & states["inside_grace"])
    add("leakage_inside_rule_listed_apart", len(soon & states["inside_grace"]) / len(states["inside_grace"]), "1.0 (shown as 'will cross', each with the hour its rule ends)", soon == states["inside_grace"])
    mem = sqlite3.connect(":memory:")
    mem.row_factory = sqlite3.Row
    world.backup(mem)
    changes = mem.total_changes
    leakage_report.report(mem, clock.now())
    add("leakage_rows_written_by_reading_the_report", float(mem.total_changes - changes), "0 (report only)", mem.total_changes == changes)
    clock.advance(48)
    later = leakage_report.report(mem, clock.now())
    clock.reset()
    add("leakage_inside_rule_move_in_when_the_rule_runs_out", float(later.customers - rep.customers), f"= {len(states['inside_grace'])} (the same customers, 48 hours on)", later.customers - rep.customers == len(states["inside_grace"]))
    verbs = {"revoke", "cut", "remove", "cancel", "suspend", "expire"}
    add("leakage_actions_that_take_access_away", float(len([a for a in get_args(ActionType) if any(v in a for v in verbs)])), "0 (no revoke exists; the founder cuts access in their own system)", not [a for a in get_args(ActionType) if any(v in a for v in verbs)])
    add("leakage_unpaid_renewals_paise", float(rep.owed_paise), "reported (failed renewals with access still on, past the rule)", None)
    add("leakage_longest_hours_over_the_rule", rep.longest_over_hours, "reported", None)

report = EvalReport(seed=cfg["seed"], generated_at=datetime.fromisoformat(cfg["snapshot_at"] + "+05:30"), metrics=metrics, arms=[])
(Path(__file__).parent / "report.json").write_text(report.model_dump_json(indent=2) + "\n")
lines = ["# Eval report", "", f"Synthetic world, seed {cfg['seed']}. Ground truth is never visible to the pipeline.", "",
         "Caveat: this world is clean and the generator and detector share assumptions, so near-perfect scores are expected here. The Zone 1 results rest on two incidents and five look-alikes in one seed, and the monitors' windows were set after looking at this world, so they show the monitors work as designed, not how often they would be wrong on real traffic. Recovery numbers come from simulated customers. The fuzzy matcher is scored on complaints generated from real payments and never decides anything: exact keys do.", "", "| Metric | Value | Target | Result |", "|---|---|---|---|"]
lines += [f"| {m.name} | {m.value if m.value is not None else 'n/a'} | {m.target} | {m.status} |" for m in metrics]
(Path(__file__).parent / "report.md").write_text("\n".join(lines) + "\n")
print("\n".join(f"{m.status.upper():6} {m.name} = {m.value}  (target {m.target})" for m in metrics))
sys.exit(1 if any(m.status == "fail" for m in metrics) else 0)
