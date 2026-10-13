"""Turn a duplicate-charge run that the monitor found into INC-2 (v1 J2, FR-DG-3): saved incident, members, verdict, trace. Part of `make pipeline`.

Nothing here moves money. The refunds are separate actions the founder approves one customer at a time (`act/refund.py`).

A member is the second charge of a pair, the one that is owed back. The look-alikes (two seats for two people, a second attempt that failed
and is reversed by the bank, a charge the merchant already refunded) are saved as left-out members with the reason, so the list shows
what Resolve looked at and chose not to touch."""
import json
import sqlite3
from datetime import datetime

from ..attribution import Attribution, Evidence, attribute
from ..detect import duplicate as monitor
from ..match.keys import complaints_by_payment
from ..schemas import AgentStep, AgentTrace, EvidenceItem, Verdict

INCIDENT_ID = "INC-2"
CAUSE_CODE = "DOUBLE_SUBMIT_AFTER_APP_RELEASE"
LABEL = {"two_seat": "two seats for two people", "second_failed": "a failed second attempt the bank reverses", "refunded": "already refunded"}
LEFT_OUT = {"two_seat": "Two seats for two people. Both were fulfilled", "second_failed": "The second attempt failed. The bank reverses it by itself", "refunded": "Already refunded"}
CANNOT_SEE = ["Whether the customer meant to buy twice. Two orders for the same person and plan seconds apart are almost always a double tap, but Resolve cannot ask the app",
              "Whether the bank has already reversed a failed second attempt", "Whether the customer saw an error and tapped again, which a fixed app would also stop"]


def _members(run: monitor.Run, complaints: dict) -> list[dict]:
    out = []
    for p in run.pairs:
        out.append({"payment_id": p.second_id, "tier": "exact", "reason": None, "complained": bool(complaints.get(p.first_id) or complaints.get(p.second_id)), "amount": p.amount_paise})
    for p in run.excluded:
        out.append({"payment_id": p.second_id, "tier": "excluded", "reason": LEFT_OUT[p.kind], "complained": bool(complaints.get(p.first_id) or complaints.get(p.second_id)), "amount": p.amount_paise})
    return out


def _attribution(run: monitor.Run) -> Attribution:
    return attribute(Evidence(duplicate_captures_after_release=run.after_release and run.other_version_pairs == 0))


def _evidence(run: monitor.Run) -> list[EvidenceItem]:
    n = len(run.pairs)
    items = [EvidenceItem(kind="duplicate_pairs", weight=3, ref=f"{n} customers were charged twice for the same plan, {run.median_gap} seconds apart on average, since {run.first_at:%a %d %b %H:%M}"),
             EvidenceItem(kind="one_app_version", weight=3, ref=f"All {n} came from {run.app_version}. Other app versions and the web: {run.other_version_pairs} in {run.other_version_orders} orders")]
    if run.release_at:
        items.append(EvidenceItem(kind="after_release", weight=2, ref=f"{run.app_version} was released on {run.release_at:%a %d %b %H:%M}. The first double charge came {_since(run.release_at, run.first_at)} later"))
    items.append(EvidenceItem(kind="share_of_orders", weight=1, ref=f"{n} of {run.orders_on_version} {run.app_version} orders since the release were followed by a second one"))
    if run.excluded:
        items.append(EvidenceItem(kind="left_out", weight=1, ref=f"{len(run.excluded)} look-alikes left out: " + ", ".join(f"{sum(p.kind == k for p in run.excluded)} {LABEL[k]}" for k in LABEL if any(p.kind == k for p in run.excluded))))
    items.append(EvidenceItem(kind="webhook_healthy", weight=1, ref="Your webhook answered 200 for both charges and both orders got access, so only the second charge is wrong"))
    return items


def _since(a: datetime, b: datetime) -> str:
    h = (b - a).total_seconds() / 3600
    return f"{h:.0f} hours" if h >= 1.5 else f"{round(h * 60)} minutes"


def _slots(run: monitor.Run, members: list[dict]) -> dict[str, str | int]:
    return {"title": f"Customers charged twice after {run.app_version}", "pairs": len(run.pairs), "left_out": len(run.excluded), "version": run.app_version, "release": run.release_at.isoformat() if run.release_at else "",
            "median_gap": run.median_gap, "to_refund_paise": sum(m["amount"] for m in members if m["tier"] == "exact"), "orders_on_version": run.orders_on_version}


def _trace(run: monitor.Run, attr: Attribution) -> AgentTrace:
    n = len(run.pairs)
    steps = [AgentStep(tool="find_duplicate_captures", input={"gap_under_seconds": monitor.MAX_GAP_SECONDS}, output_summary=f"{n} pairs with the same contact and amount, same person and plan, captured seconds apart"),
             AgentStep(tool="classify_look_alikes", input={"pairs": n + len(run.excluded)}, output_summary=f"{len(run.excluded)} left out: two seats for two people, failed second attempts, charges already refunded"),
             AgentStep(tool="group_by_app_version", input={"min_pairs": monitor.MIN_PAIRS}, output_summary=f"All {n} on {run.app_version}; {run.other_version_pairs} on any other version"),
             AgentStep(tool="list_events", input={"before": f"{run.first_at:%a %H:%M}"}, output_summary=f"app_release {run.app_version} at {run.release_at:%a %d %b %H:%M}" if run.release_at else "No app release before the first double charge"),
             AgentStep(tool="check_webhook", input={"payments": n * 2}, output_summary="Both charges delivered and both orders granted, so this is not a webhook problem"),
             AgentStep(tool="attribute", input={}, output_summary=f"Rule {attr.rule_id}: {attr.owner}. {attr.reason}")]
    return AgentTrace(id=f"tr_{INCIDENT_ID}", incident_id=INCIDENT_ID, steps=steps, budget_used=len(steps), budget_total=8, model_id=None, rule_based=True)


def run(db: sqlite3.Connection, now: datetime) -> list[str]:
    found = monitor.find(db)
    if not found:
        return []
    r = found[0]  # only the first run becomes INC-2. A second app version with the same fault would need its own number
    complaints = complaints_by_payment(db)
    mem = _members(r, complaints)
    attr = _attribution(r)
    ev = _evidence(r)
    signature = {"kind": "duplicate", "app_version": r.app_version, "release_id": r.release_id, "release_at": r.release_at.isoformat() if r.release_at else None, "first_at": r.first_at.isoformat(),
                 "last_at": r.last_at.isoformat(), "alert_at": r.alert_at.isoformat(), "resolved_at": None, "pairs": len(r.pairs), "median_gap": r.median_gap, "orders_on_version": r.orders_on_version,
                 "other_version_pairs": r.other_version_pairs, "other_version_orders": r.other_version_orders}
    verdict = Verdict(incident_id=INCIDENT_ID, mismatch_type="E", zone="after", inferred=False, cause_code=CAUSE_CODE, cause_summary_slots=_slots(r, mem), owner=attr.owner, owner_rule_id=attr.rule_id,
                      owner_evidence_ids=[e.ref for e in ev], signature=signature, onset_at=r.first_at, resolved_at=None, linked_event_id=r.release_id, affected_count=len(r.pairs),
                      confidence="high" if attr.rule_id == 6 else "low", evidence=ev, what_we_cannot_see=CANNOT_SEE)
    trace = _trace(r, attr)
    db.execute("INSERT INTO signals (id, monitor, metric, detected_at, onset_at, before_level, after_level, details) VALUES (?,?,?,?,?,?,?,?)",
               ("sig_2_duplicates", "duplicate_capture", "duplicate_capture_count", r.alert_at.isoformat(), r.first_at.isoformat(), 0, len(r.pairs), json.dumps(signature)))
    db.execute("INSERT INTO agent_traces (id, incident_id, steps_json, model_id, tokens_in, tokens_out, created_at) VALUES (?,?,?,?,?,?,?)", (trace.id, INCIDENT_ID, trace.model_dump_json(), None, 0, 0, now.isoformat()))
    db.execute("""INSERT INTO incidents (id, merchant_id, mismatch_type, status, signature, onset_at, resolved_at, owner, owner_rule_id, cause_code, verdict_json, agent_trace_id, opened_by,
                  created_at, closed_at, zone, inferred, evidence_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
               (INCIDENT_ID, "acc_KAKSHA001", "E", "open", json.dumps(signature), r.first_at.isoformat(), None, attr.owner, attr.rule_id, CAUSE_CODE, verdict.model_dump_json(), trace.id, "signal",
                r.alert_at.isoformat(), None, "after", 0, json.dumps([e.model_dump() for e in ev])))
    db.executemany("INSERT INTO incident_members (incident_id, payment_id, tier, exclusion_reason, complained, case_id, amount_paise) VALUES (?,?,?,?,?,?,?)",
                   [(INCIDENT_ID, m["payment_id"], m["tier"], m["reason"], int(m["complained"]), None, m["amount"]) for m in mem])
    for p in r.pairs:  # a complaint that names either charge of a pair belongs to this incident, and the member points at the case
        for pid in (p.first_id, p.second_id):
            for c in complaints.get(pid, []):
                case = f"cs_{c['id'][4:]}"
                db.execute("UPDATE cases SET match_status = 'matched', matched_payment_ids = ?, mismatch_type = 'E', owner = ?, incident_id = ? WHERE id = ?", (json.dumps([pid]), attr.owner, INCIDENT_ID, case))
                db.execute("UPDATE incident_members SET case_id = ? WHERE incident_id = ? AND payment_id = ?", (case, INCIDENT_ID, p.second_id))
    return [INCIDENT_ID]
