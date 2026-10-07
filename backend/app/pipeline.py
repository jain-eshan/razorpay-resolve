"""Run detection end to end and save the results: signals, incidents, incident members, traces. Idempotent. Run: make pipeline."""
import hashlib
import json
import sqlite3
from datetime import datetime

from . import clock
from .config import ENTITLEMENT_EXPORT_AT
from .detect.webhook import find_runs, run_to_json
from .ingest.extract import extract
from .ingest.redact import redact
from .investigate.rules_fallback import build_trace, build_verdict
from .match import lookup as mt
from .match.keys import complaints_by_payment
from .renewal import build as renewal
from .widen.silent import build_cohort
from .zone1 import build as zone1


def run(db: sqlite3.Connection) -> list[str]:
    for t in ("incident_members", "agent_traces", "incidents", "signals", "cases", "extractions", "match_candidates"):
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
    _cases(db)
    ids += renewal.run(db, now)  # INC-3 is reserved for it: it must exist before Zone 1 numbers start at INC-4
    ids += zone1.run(db, now)
    db.commit()
    return ids


def _cases(db: sqlite3.Connection) -> None:
    """One case per complaint: extract, look up by exact key, and tie it to the incident that covers the payment (stream B: thread to case to incident)."""
    cal = mt.load_calibrator()
    for c in db.execute("SELECT * FROM complaints ORDER BY received_at").fetchall():
        when = datetime.fromisoformat(c["received_at"])
        red = redact(c["raw_text"])
        x = extract(red, when)
        res = mt.lookup(db, red, x, when, cal)
        pids = [e.payment_id for e in res.exact]
        member = db.execute("SELECT im.*, i.owner, i.mismatch_type FROM incident_members im JOIN incidents i ON i.id = im.incident_id WHERE im.payment_id = ? LIMIT 1", (pids[0],)).fetchone() if pids else None
        cs = f"cs_{c['id'][4:]}"
        db.execute("INSERT INTO cases (id, complaint_id, match_status, matched_payment_ids, mismatch_type, owner, incident_id, created_at) VALUES (?,?,?,?,?,?,?,?)",
                   (cs, c["id"], "matched" if pids else "not_payment" if not x.is_payment_related else "needs_detail", json.dumps(pids), member["mismatch_type"] if member else None,
                    member["owner"] if member else None, member["incident_id"] if member else None, c["received_at"]))
        db.execute("INSERT INTO extractions (complaint_id, model_id, prompt_version, json, injection_suspected, status, created_at) VALUES (?,?,?,?,?,?,?)",
                   (c["id"], "rules-v1", "0", x.model_dump_json(), int(x.injection_suspected), "ok", c["received_at"]))
        for rank, cand in enumerate(res.exact + res.suggestions, 1):
            db.execute("INSERT OR REPLACE INTO match_candidates (complaint_id, payment_id, method, raw_score, calibrated_score, features, rank) VALUES (?,?,?,?,?,?,?)",
                       (c["id"], cand.payment_id, cand.method, cand.score, cand.score, json.dumps(cand.features), rank))
        for pid in pids:
            db.execute("UPDATE incident_members SET case_id = ? WHERE payment_id = ?", (cs, pid))


def pack_ref(incident_id: str) -> str:
    return f"MG-{incident_id}-{hashlib.sha1(incident_id.encode()).hexdigest()[:4].upper()}"
