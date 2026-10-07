"""Turn a renewal run that the monitor found into INC-3 (SPEC 11.4, v1 J5): saved incident, members, verdict, trace. Part of `make pipeline`.

The incident is on Razorpay's side by elimination: nothing changed on the merchant's side, no bank outage covers the hours, one gateway
error sits on nearly every failure across card networks, and UPI AutoPay renewals in the same hours went through. Blindspot cannot see
inside Razorpay, so confidence is medium and the verdict says the finding needs Razorpay's review.

Nothing here touches money or access. The fix (a grace extension) and the escalation are separate actions the founder approves."""
import json
import sqlite3
from datetime import datetime

from ..attribution import Attribution, Evidence, attribute
from ..detect import renewal as monitor
from ..match.keys import complaints_by_payment
from ..schemas import AgentStep, AgentTrace, EvidenceItem, Verdict

INCIDENT_ID = "INC-3"
CAUSE_CODE = "RENEWAL_GATEWAY_ERROR_CARD"
TITLE = "Card renewals failed with a gateway error"
CANNOT_SEE = ["Why the gateway returned the error. That is inside Razorpay.", "Whether other merchants were hit in the same hours", "Whether Razorpay has already fixed it"]


def _members(db: sqlite3.Connection, run: monitor.Run, complaints: dict) -> list[dict]:
    """Every failed renewal in the run. A customer who paid for the same subscription afterwards is left out of the fix, with the reason."""
    out = []
    for pid in run.payment_ids:
        p = db.execute("SELECT * FROM payments WHERE id = ?", (pid,)).fetchone()
        later = db.execute("SELECT created_at FROM payments WHERE subscription_id = ? AND status = 'captured' AND created_at > ? ORDER BY created_at LIMIT 1", (p["subscription_id"], p["created_at"])).fetchone()
        out.append({"payment_id": pid, "tier": "excluded" if later else "exact", "reason": f"Paid since {datetime.fromisoformat(later['created_at']):%a %H:%M}" if later else None,
                    "complained": pid in complaints, "amount": p["amount_paise"]})
    return out


def _attribution(run: monitor.Run) -> Attribution:
    return attribute(Evidence(error_source=run.error_source, failures_inside_downtime_window=run.downtime_overlap, merchant_event_id=run.merchant_change,
                              single_gateway_code_unexplained=not run.explained_elsewhere))


def _evidence(run: monitor.Run) -> list[EvidenceItem]:
    n, c = len(run.payment_ids), run.control
    items = [EvidenceItem(kind="renewal_failures", weight=3, ref=f"{n} {run.method} renewals in a row failed. Normally about 1 in {round(1 / run.baseline_rate)} does"),
             EvidenceItem(kind="one_error_code", weight=2, ref=f"{round(run.code_share * 100)}% of them carry {run.error_code}, reported by the {run.error_source}"),
             EvidenceItem(kind="several_networks", weight=1, ref=f"{len(run.networks)} card networks: {', '.join(run.networks)}")]
    if c.get("renewals"):
        items.append(EvidenceItem(kind="other_method_fine", weight=2, ref=f"{c['renewals']} UPI AutoPay renewals in the same hours, {c['failed']} failed"))
    items.append(EvidenceItem(kind="no_change_on_your_side", weight=1, ref="No deploy or setting change on your side in the 2 hours before" if not run.merchant_change else run.merchant_change))
    items.append(EvidenceItem(kind="no_bank_outage", weight=1, ref="No bank outage covers the hours" if not run.downtime_overlap else "A bank outage overlaps the hours"))
    return items


def _slots(run: monitor.Run, members: list[dict]) -> dict[str, str | int]:
    return {"title": TITLE, "failed": len(run.payment_ids), "left_out": sum(m["tier"] == "excluded" for m in members), "method": run.method, "code": run.error_code,
            "networks": len(run.networks), "control_renewals": int(run.control.get("renewals", 0)), "control_failed": int(run.control.get("failed", 0)),
            "baseline_one_in": round(1 / run.baseline_rate)}


def _trace(run: monitor.Run, attr: Attribution) -> AgentTrace:
    c = run.control
    steps = [AgentStep(tool="get_renewal_failures", input={"method": run.method, "from": f"{run.first_at:%a %H:%M}", "to": f"{run.last_at:%a %H:%M}"},
                       output_summary=f"{len(run.payment_ids)} {run.method} renewals in a row failed. Normally about 1 in {round(1 / run.baseline_rate)} does, so this has a chance of {run.p_value:.4f}"),
             AgentStep(tool="get_error_codes", input={"payment_ids": len(run.payment_ids)},
                       output_summary=f"{round(run.code_share * 100)}% carry {run.error_code}, source {run.error_source}, across {len(run.networks)} card networks"),
             AgentStep(tool="get_other_method_renewals", input={"method": c.get("method") or "upi", "same_hours": True},
                       output_summary=f"{c.get('renewals', 0)} renewals in the same hours, {c.get('failed', 0)} failed"),
             AgentStep(tool="list_events", input={"window": "2 hours before the first failure"}, output_summary=run.merchant_change or "No change on the merchant's side in that window"),
             AgentStep(tool="get_downtime_events", input={"window": "incident window"}, output_summary="A bank outage overlaps the window" if run.downtime_overlap else "No bank outage covers the window"),
             AgentStep(tool="attribute", input={}, output_summary=f"Rule {attr.rule_id}: {attr.owner}. {attr.reason}")]
    return AgentTrace(id=f"tr_{INCIDENT_ID}", incident_id=INCIDENT_ID, steps=steps, budget_used=len(steps), budget_total=8, model_id=None, rule_based=True)


def run(db: sqlite3.Connection, now: datetime) -> list[str]:
    found = monitor.find(db)
    if not found:
        return []
    r = found[0]
    complaints = complaints_by_payment(db)
    mem = _members(db, r, complaints)
    attr = _attribution(r)
    owned = attr.rule_id == 8
    ev = _evidence(r)
    signature = {"kind": "renewal", "method": r.method, "error_code": r.error_code, "error_source": r.error_source, "first_failure_at": r.first_at.isoformat(), "last_failure_at": r.last_at.isoformat(),
                 "alert_at": r.alert_at.isoformat(), "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None, "baseline_rate": r.baseline_rate, "p_value": r.p_value,
                 "run_length": len(r.payment_ids), "networks": r.networks, "control": r.control}
    verdict = Verdict(incident_id=INCIDENT_ID, mismatch_type="G", zone="after", inferred=False, cause_code=CAUSE_CODE, cause_summary_slots=_slots(r, mem), owner=attr.owner, owner_rule_id=attr.rule_id,
                      owner_evidence_ids=[e.ref for e in ev], signature=signature, onset_at=r.first_at, resolved_at=r.resolved_at, linked_event_id=None, affected_count=len(mem),
                      confidence="medium" if owned else "low", evidence=ev, what_we_cannot_see=CANNOT_SEE)
    trace = _trace(r, attr)
    db.execute("INSERT INTO signals (id, monitor, metric, detected_at, onset_at, before_level, after_level, details) VALUES (?,?,?,?,?,?,?,?)",
               ("sig_3_renewal", "renewal_failures", f"{r.method}_renewal_failure_rate", r.alert_at.isoformat(), r.first_at.isoformat(), r.baseline_rate, 1.0, json.dumps(signature)))
    db.execute("INSERT INTO agent_traces (id, incident_id, steps_json, model_id, tokens_in, tokens_out, created_at) VALUES (?,?,?,?,?,?,?)", (trace.id, INCIDENT_ID, trace.model_dump_json(), None, 0, 0, now.isoformat()))
    db.execute("""INSERT INTO incidents (id, merchant_id, mismatch_type, status, signature, onset_at, resolved_at, owner, owner_rule_id, cause_code, verdict_json, agent_trace_id, opened_by,
                  created_at, closed_at, zone, inferred, evidence_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
               (INCIDENT_ID, "acc_KAKSHA001", "G", "open", json.dumps(signature), r.first_at.isoformat(), r.resolved_at.isoformat() if r.resolved_at else None, attr.owner, attr.rule_id, CAUSE_CODE,
                verdict.model_dump_json(), trace.id, "signal", r.alert_at.isoformat(), None, "after", 0, json.dumps([e.model_dump() for e in ev])))
    db.executemany("INSERT INTO incident_members (incident_id, payment_id, tier, exclusion_reason, complained, case_id, amount_paise) VALUES (?,?,?,?,?,?,?)",
                   [(INCIDENT_ID, m["payment_id"], m["tier"], m["reason"], int(m["complained"]), None, m["amount"]) for m in mem])
    for m in mem:  # a complaint that names one of these payments belongs to this incident
        for c in complaints.get(m["payment_id"], []):
            case = f"cs_{c['id'][4:]}"
            db.execute("UPDATE cases SET match_status = 'matched', matched_payment_ids = ?, mismatch_type = 'G', owner = ?, incident_id = ? WHERE id = ?", (json.dumps([m["payment_id"]]), attr.owner, INCIDENT_ID, case))
            db.execute("UPDATE incident_members SET case_id = ? WHERE incident_id = ? AND payment_id = ?", (case, INCIDENT_ID, m["payment_id"]))
    return [INCIDENT_ID]
