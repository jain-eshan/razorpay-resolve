"""Run detection end to end and save the results: signals, incidents, incident members, traces. Idempotent. Run: make pipeline."""
import hashlib
import json
import sqlite3

from . import clock
from .config import ENTITLEMENT_EXPORT_AT
from .detect.webhook import find_runs, run_to_json
from .investigate.rules_fallback import build_trace, build_verdict
from .match.keys import complaints_by_payment
from .widen.silent import build_cohort


def run(db: sqlite3.Connection) -> list[str]:
    for t in ("incident_members", "agent_traces", "incidents", "signals"):
        db.execute(f"DELETE FROM {t}")
    now, export_at = clock.now(), ENTITLEMENT_EXPORT_AT
    complaints = complaints_by_payment(db)
    ids, n = [], 0
    for ep in db.execute("SELECT * FROM webhook_endpoints").fetchall():
        for r in find_runs(db, ep["id"]):
            n += 1
            iid, sig = f"INC-{n}", f"sig_{n}_webhook"
            members = build_cohort(db, r, ep["disabled_at"], now, export_at, complaints)
            verdict, attr = build_verdict(db, iid, r, members, ep["disabled_at"], sig)
            trace = build_trace(iid, r, verdict, attr, members)
            db.execute("INSERT INTO signals (id, monitor, metric, detected_at, onset_at, before_level, after_level, details) VALUES (?,?,?,?,?,?,?,?)",
                       (sig, "webhook_health", "webhook_non2xx_rate", r.alert_at.isoformat(), r.first_bad_at.isoformat(), r.baseline_bad_rate, 1.0,
                        json.dumps({"endpoint": ep["id"], "bad_events": len(r.bad_event_ids), "events_before_alert": r.events_before_alert})))
            if ep["disabled_at"]:
                db.execute("INSERT INTO signals (id, monitor, metric, detected_at, onset_at, before_level, after_level, details) VALUES (?,?,?,?,?,?,?,?)",
                           (f"sig_{n}_disabled", "webhook_disabled", "webhook_state", ep["disabled_at"], ep["disabled_at"], 0, 1, json.dumps({"endpoint": ep["id"]})))
            db.execute("INSERT INTO agent_traces (id, incident_id, steps_json, model_id, tokens_in, tokens_out, created_at) VALUES (?,?,?,?,?,?,?)",
                       (trace.id, iid, trace.model_dump_json(), None, 0, 0, now.isoformat()))
            db.execute("""INSERT INTO incidents (id, merchant_id, mismatch_type, status, signature, onset_at, resolved_at, owner, owner_rule_id, cause_code, verdict_json,
                          agent_trace_id, opened_by, created_at, closed_at, zone, inferred, evidence_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                       (iid, "acc_KAKSHA001", "A", "open", json.dumps(run_to_json(r)), verdict.onset_at.isoformat(), r.resolved_at.isoformat() if r.resolved_at else None,
                        attr.owner, attr.rule_id, verdict.cause_code, verdict.model_dump_json(), trace.id, "signal", r.alert_at.isoformat(), None, "after", 0,
                        json.dumps([e.model_dump() for e in verdict.evidence])))
            db.executemany("INSERT INTO incident_members (incident_id, payment_id, tier, exclusion_reason, complained, case_id, amount_paise) VALUES (?,?,?,?,?,?,?)",
                           [(iid, m.payment_id, m.tier, m.exclusion_reason, int(m.complained), None, m.amount_paise) for m in members])
            ids.append(iid)
    db.commit()
    return ids


def pack_ref(incident_id: str) -> str:
    return f"MG-{incident_id}-{hashlib.sha1(incident_id.encode()).hexdigest()[:4].upper()}"
