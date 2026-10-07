"""Run every Zone 1 monitor, combine what they found, and save the incidents (SPEC 6 and 7). Part of `make pipeline`.

Incident numbers start at INC-4: INC-2 and INC-3 are reserved for the after-the-payment incidents of the spec that this build does not
include yet. Among Zone 1 incidents the one with the most evidence comes first, then the most recent."""
import json
import sqlite3
from datetime import datetime, timedelta

from ..detect import complaint_spike, order_gap, probe
from . import verdict, volume
from .baselines import Orders
from .inference import Group, group_signals
from .signal import Signal

FIRST_ID = 4
ATTACH_CLAIMS = ("page_error", "checkout_not_opening")  # complaints that say the customer could not get as far as paying
METRIC = {"probe": "pay_page_failed_checks", "order_gap": "orders_without_attempt_share", "volume_dip": "orders_vs_expected", "complaint_spike": "payment_complaints_per_hour"}


def _levels(s: Signal) -> tuple[float, float]:
    d = s.details
    return {"probe": (0.0, 1.0), "order_gap": (d.get("baseline_share", 0.0), round(d.get("zero_attempts", 0) / max(d.get("orders", 1), 1), 3)),
            "volume_dip": (float(d.get("expected", 0)), float(d.get("observed", 0))), "complaint_spike": (d.get("baseline_per_hour", 0.0), float(d.get("count", 0)))}[s.monitor]


def _members(db: sqlite3.Connection, g: Group, orders: Orders, complaints: list[dict], now: datetime) -> list[dict]:
    """Customers who could not pay: those who wrote in, and for orders nobody could pay for, every customer with such an order."""
    lo, hi = g.onset, (g.end or now) + timedelta(minutes=90)
    people: dict[str, dict] = {}
    for c in complaints:
        if c["claim"] in ATTACH_CLAIMS and lo <= c["t"] <= hi and c["customer_id"] and not complaint_spike.own_attempts(db, c):
            people[c["customer_id"]] = {"customer_id": c["customer_id"], "at": c["t"], "amount": c["amount_paise"] or 0, "case_id": c["case_id"], "complained": True}
    if g.kind == "gap" or g.sig("order_gap"):
        first = g.sig("order_gap").start
        for r in orders.between(first, (g.end or now) + timedelta(seconds=1)):
            if not r["attempts"]:
                p = people.setdefault(r["customer_id"], {"customer_id": r["customer_id"], "at": r["t"], "amount": r["amount_paise"], "case_id": None, "complained": False})
                p["amount"] = p["amount"] or r["amount_paise"]
                p["at"] = min(p["at"], r["t"])
    out = []
    for p in people.values():
        paid = db.execute("SELECT created_at FROM payments WHERE customer_id = ? AND status = 'captured' AND created_at >= ? ORDER BY created_at LIMIT 1", (p["customer_id"], p["at"].isoformat())).fetchone()
        out.append({**p, "tier": "excluded" if paid else "exact", "reason": f"paid since, {datetime.fromisoformat(paid['created_at']):%a %H:%M}" if paid else None})
    return sorted(out, key=lambda p: (not p["complained"], p["at"]))


def run(db: sqlite3.Connection, now: datetime, first_id: int = FIRST_ID) -> list[str]:
    orders = Orders(db)
    complaints = complaint_spike.load(db)
    signals = probe.find(db) + order_gap.find(db, orders, now) + volume.find(orders, now) + complaint_spike.find(db, now, complaints)
    for i, s in enumerate(sorted(signals, key=lambda s: s.start), 1):
        s.id = f"sig_z{i:02d}_{s.monitor}"
        before, after = _levels(s)
        db.execute("INSERT INTO signals (id, monitor, metric, detected_at, onset_at, before_level, after_level, details) VALUES (?,?,?,?,?,?,?,?)",
                   (s.id, s.monitor, METRIC[s.monitor], s.detected_at.isoformat(), s.start.isoformat(), before, after,
                    json.dumps({**s.details, "zone1": s.zone1, "weight": s.weight, "end": s.end.isoformat() if s.end else None})))
    groups = sorted(group_signals(db, signals, now), key=lambda g: (-g.weight, -g.onset.timestamp()))
    ids = []
    for k, g in enumerate(groups):
        iid = f"INC-{first_id + k}"
        mem = _members(db, g, orders, complaints, now)
        v, attr, trace, _ = verdict.build(db, iid, g, orders, len(mem), now)
        db.execute("INSERT INTO agent_traces (id, incident_id, steps_json, model_id, tokens_in, tokens_out, created_at) VALUES (?,?,?,?,?,?,?)", (trace.id, iid, trace.model_dump_json(), None, 0, 0, now.isoformat()))
        db.execute("""INSERT INTO incidents (id, merchant_id, mismatch_type, status, signature, onset_at, resolved_at, owner, owner_rule_id, cause_code, verdict_json, agent_trace_id, opened_by,
                      created_at, closed_at, zone, inferred, evidence_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                   (iid, "acc_KAKSHA001", "Z1", "open", json.dumps({**v.signature, "alert_at": g.alert_at.isoformat(), "weight": g.weight}), g.onset.isoformat(), g.end.isoformat() if g.end else None, attr.owner,
                    attr.rule_id, v.cause_code, v.model_dump_json(), trace.id, "signal", g.alert_at.isoformat(), None, "before", 1, json.dumps([e.model_dump() for e in g.evidence])))
        db.executemany("INSERT INTO incident_members (incident_id, payment_id, tier, exclusion_reason, complained, case_id, amount_paise) VALUES (?,?,?,?,?,?,?)",
                       [(iid, p["customer_id"], p["tier"], p["reason"], int(p["complained"]), p["case_id"], p["amount"]) for p in mem])
        for p in mem:
            if p["case_id"]:
                db.execute("UPDATE cases SET match_status = 'no_payment_found', mismatch_type = 'Z1', owner = ?, incident_id = ? WHERE id = ?", (attr.owner, iid, p["case_id"]))
        ids.append(iid)
    return ids
