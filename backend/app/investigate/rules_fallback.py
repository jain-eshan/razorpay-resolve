"""Rule-based verdict (the fallback that must always work, SPEC 9 and v1 11.5). The investigation agent arrives in R4 and is
checked against this. Every number comes from the data, never from text."""
import sqlite3
from collections import Counter
from datetime import datetime, timedelta

from ..attribution import Attribution, Evidence, attribute
from ..detect.webhook import Run
from ..schemas import AgentStep, AgentTrace, EvidenceItem, EvidencePack, Verdict
from ..widen.silent import Member

FIX_HINT = {
    401: "Exclude the webhook route from session auth, keep signature verification, and skip events already processed (guard on the event ID).",
    403: "Allow Razorpay's requests through your firewall or CSRF protection for the webhook route, and keep signature verification.",
    404: "Check that the webhook route still exists after the last deploy, then run the endpoint test again.",
}


def linked_event(db: sqlite3.Connection, run: Run) -> sqlite3.Row | None:
    lo = run.last_good_before or run.first_bad_at - timedelta(hours=6)
    return db.execute("SELECT * FROM merchant_events WHERE kind IN ('deploy','config_change') AND at > ? AND at <= ? ORDER BY at DESC LIMIT 1", (lo.isoformat(), run.first_bad_at.isoformat())).fetchone()


def evidence_for(run: Run, ev_row, disabled_at: str | None, members: list[Member]) -> Evidence:
    return Evidence(
        delivery_classes=Counter(run.classes), merchant_response_body=bool(run.body_excerpt), merchant_event_id=ev_row["id"] if ev_row else None,
        disabled_by_razorpay=bool(disabled_at), ack_ok_but_no_access=any(m.delivery_outcome.startswith("2xx") for m in members),
    )


def build_verdict(db: sqlite3.Connection, incident_id: str, run: Run, members: list[Member], disabled_at: str | None, signal_id: str) -> tuple[Verdict, Attribution]:
    ev_row = linked_event(db, run)
    attr = attribute(evidence_for(run, ev_row, disabled_at, members))
    status = run.statuses.most_common(1)[0][0] if run.statuses else None
    kind = "DEPLOY" if ev_row and ev_row["kind"] == "deploy" else "CHANGE"
    cause = f"WEBHOOK_ENDPOINT_{status}_AFTER_{kind}" if status and ev_row else f"WEBHOOK_ENDPOINT_{status or 'FAILING'}"
    evidence = [EvidenceItem(kind="webhook_non2xx_rate", weight=2, ref=signal_id)]
    if ev_row:
        evidence.append(EvidenceItem(kind="merchant_event", weight=1, ref=ev_row["id"]))
    if disabled_at:
        evidence.append(EvidenceItem(kind="webhook_disabled", weight=1, ref=f"disabled@{disabled_at}"))
    if any(m.delivery_outcome.startswith("2xx") for m in members):
        evidence.append(EvidenceItem(kind="access_record_mismatch", weight=1, ref="reconciler"))
    return Verdict(
        incident_id=incident_id, mismatch_type="A", zone="after", inferred=False, cause_code=cause,
        cause_summary_slots={"status": status or 0, "change": ev_row["label"] if ev_row else "none found", "events": len(run.bad_event_ids)},
        owner=attr.owner, owner_rule_id=attr.rule_id, owner_evidence_ids=[e.ref for e in evidence], signature={"endpoint_id": run.endpoint_id, "response_class": "4xx", "status": status},
        onset_at=(datetime.fromisoformat(ev_row["at"]) if ev_row else run.first_bad_at),
        resolved_at=run.resolved_at, linked_event_id=ev_row["id"] if ev_row else None, affected_count=len(members),
        confidence="high" if ev_row and len(run.bad_event_ids) >= 5 else "medium", evidence=evidence,
        what_we_cannot_see=["Why your server answered with an error (only you can see your logs)", "Customers who paid by a route that does not use this webhook"],
    ), attr


def build_trace(incident_id: str, run: Run, verdict: Verdict, attr: Attribution, members: list[Member]) -> AgentTrace:
    total = sum(m.amount_paise for m in members if m.tier != "excluded")
    steps = [
        AgentStep(tool="find_change_points", input={"metric": "webhook_non2xx_rate", "endpoint": run.endpoint_id},
                  output_summary=f"Run opened after {run.events_before_alert} events. First failing event {run.first_bad_at:%a %d %b %H:%M}. Baseline failure rate {run.baseline_bad_rate:.1%}."),
        AgentStep(tool="list_events", input={"window": "between the last good event and the first failing one"},
                  output_summary=f"{verdict.cause_summary_slots['change']}" if verdict.linked_event_id else "No merchant change found in that window"),
        AgentStep(tool="query_payments", input={"signature": verdict.signature}, output_summary=f"{len(members)} captured payments, ₹{total / 100:,.0f} not yet restored"),
        AgentStep(tool="attribute", input={}, output_summary=f"Rule {attr.rule_id}: {attr.owner}. {attr.reason}"),
    ]
    return AgentTrace(id=f"tr_{incident_id}", incident_id=incident_id, steps=steps, budget_used=len(steps), budget_total=8, model_id=None, rule_based=True)


def build_pack(db: sqlite3.Connection, incident_id: str, run: Run, verdict: Verdict, members: list[Member], ref: str) -> EvidencePack:
    ep = db.execute("SELECT url FROM webhook_endpoints WHERE id = ?", (run.endpoint_id,)).fetchone()
    last_attempt = db.execute("SELECT max(attempted_at) AS t FROM webhook_deliveries WHERE event_id IN (%s)" % ",".join("?" * len(run.bad_event_ids)), run.bad_event_ids).fetchone()
    status = verdict.signature.get("status")
    return EvidencePack(
        incident_id=incident_id, ref=ref, endpoint=ep["url"] if ep else None, first_failure_at=run.first_bad_at, last_failure_at=last_attempt["t"] if last_attempt else None,
        linked_change=verdict.cause_summary_slots.get("change"), response_excerpt=run.body_excerpt, affected_events=len(run.bad_event_ids),
        affected_payment_ids=[m.payment_id for m in members][:200], suggested_fix=FIX_HINT.get(status, "Check your handler's logs for the first failing event ID and re-run the endpoint test."),
    )
