"""The rule-based verdict for a Zone 1 incident (SPEC 7, 9.3 rows 8a to 8c). Rules only: the investigation agent is a later release.
Everything on screen comes from these numbers. The text says "inferred" because it is."""
import re
import sqlite3
from datetime import datetime, timedelta

from ..attribution import Attribution, Evidence, attribute
from ..schemas import AgentStep, AgentTrace, Verdict
from .baselines import Orders
from .inference import Group

ROUTE_CHANGE = re.compile(r"route|rename|redirect|url|path|page|link", re.IGNORECASE)
CANNOT_SEE = {
    "probe": ["Anything between the customer's device and your server", "Visitors who saw the error and left without writing to you", "Why the page stopped answering"],
    "gap": ["Why checkout would not open for these customers", "Visitors who tapped pay, saw nothing, and never created an order", "Whether the problem is the key, the page or the browser"],
    "complaints": ["Whether anything is actually broken", "Customers who did not write to you"],
}


def lost_orders(db: sqlite3.Connection, g: Group, orders: Orders, now: datetime) -> dict:
    """How many orders did this cost. Missing orders: what is normal for those hours minus what arrived. Orders nobody could pay for:
    the orders with no attempt, less the share that never gets an attempt anyway. Both are estimates and are labelled so."""
    lo, hi = g.onset, g.end or now
    expected = orders.expected(lo, hi)
    seen = orders.between(lo, hi)
    gap = g.sig("order_gap")
    base = orders.zero_attempt_share(lo)
    zero = sum(1 for r in seen if not r["attempts"])
    if g.kind == "gap" and gap:
        lost = round(zero * (1 - base))
    else:
        lost = max(0, round((expected or 0) - len(seen)))
    paid = [r["amount_paise"] for r in orders.rows if r["attempts"] and lo - timedelta(days=14) <= r["t"] < lo]
    avg = round(sum(paid) / len(paid)) if paid else 0
    return {"expected": round(expected or 0), "observed": len(seen), "zero_attempts": zero, "lost_orders": lost, "avg_order_paise": avg, "lost_paise": lost * avg, "normal_zero_share": round(base, 2)}


def cause_code(g: Group) -> str:
    probe = g.sig("probe")
    label = (g.event or {}).get("label", "")
    if probe and probe.details["first_status"] == 404:
        return "ROUTE_NOT_FOUND_AFTER_DEPLOY" if g.event and ROUTE_CHANGE.search(label) else "PAY_PAGE_NOT_FOUND"
    if probe:
        return "PAY_PAGE_ERROR"
    if g.sig("order_gap"):
        return "CHECKOUT_KEY_MISMATCH" if re.search(r"\bkey\b", label, re.IGNORECASE) else "CHECKOUT_NOT_OPENING"
    return "CHECKOUT_UNREACHABLE_UNKNOWN"


def title(g: Group, code: str) -> str:
    change = (g.event or {}).get("label", "").split(":")[0]
    return {"ROUTE_NOT_FOUND_AFTER_DEPLOY": f"Pay page returned 404 after {change}", "PAY_PAGE_NOT_FOUND": "Pay page returned 404", "PAY_PAGE_ERROR": "Pay page failed its checks",
            "CHECKOUT_KEY_MISMATCH": "Checkout would not open after the Razorpay key changed", "CHECKOUT_NOT_OPENING": "Checkout would not open",
            }.get(code, "Customers could not pay and nothing else says why")


def build(db: sqlite3.Connection, incident_id: str, g: Group, orders: Orders, members: int, now: datetime) -> tuple[Verdict, Attribution, AgentTrace, dict]:
    probe, gap, spike = g.sig("probe"), g.sig("order_gap"), g.sig("complaint_spike")
    label = (g.event or {}).get("label", "")
    channels = spike.details["channels"] if spike else {}
    attr = attribute(Evidence(zone1_confidence=g.confidence, probe_failure=probe is not None, route_change_event=bool(g.event and g.event["kind"] == "deploy" and ROUTE_CHANGE.search(label)),
                              zero_attempt_orders=gap is not None, one_channel_only=bool(spike and len(channels) == 1 and not probe and not gap)))
    code = cause_code(g)
    est = lost_orders(db, g, orders, now)
    slots: dict[str, str | int] = {"change": label, "deploy": label.split(":")[0], "title": title(g, code), **{k: v for k, v in est.items() if isinstance(v, int)},
                                   "status": probe.details["first_status"] if probe else 0}
    signature = {"kind": g.kind, "onset": g.onset.isoformat(), "end": g.end.isoformat() if g.end else None, "ongoing": g.end is None, "signal_ids": [s.id for s in g.signals],
                 "event_id": g.event["id"] if g.event else None, "first_status": probe.details["first_status"] if probe else None, "normal_zero_share": est["normal_zero_share"],
                 "pay_url": probe.details["url"] if probe else None}
    verdict = Verdict(incident_id=incident_id, mismatch_type="Z1", zone="before", inferred=True, cause_code=code, cause_summary_slots=slots, owner=attr.owner, owner_rule_id=attr.rule_id,
                      owner_evidence_ids=[e.ref for e in g.evidence], signature=signature, onset_at=g.onset, resolved_at=g.end, linked_event_id=g.event["id"] if g.event else None,
                      affected_count=members, confidence=g.confidence, evidence=g.evidence, what_we_cannot_see=CANNOT_SEE[g.kind])
    steps = []
    if spike:
        d = spike.details
        steps.append(AgentStep(tool="get_complaint_cluster", input={"window": f"{spike.start:%H:%M} to {spike.end:%H:%M}"},
                               output_summary=f"{d['count']} complaints about paying, {d['unmatched']} from customers with no payment attempt of their own. Normally about {d['baseline_per_hour']:g} an hour"))
    if probe:
        d = probe.details
        steps.append(AgentStep(tool="get_probe_results", input={"url": d["url"]}, output_summary=f"{d['failed_checks']} failed checks in a row, status {d['first_status']}" + (", still failing" if d["ongoing"] else ", then healthy again")))
    else:
        steps.append(AgentStep(tool="get_probe_results", input={"url": "pay page"}, output_summary="Every check passed, so the page itself loads"))
    steps.append(AgentStep(tool="get_order_attempts", input={"window": f"{g.onset:%a %H:%M} onward"},
                           output_summary=f"{est['observed']} orders created against about {est['expected']} expected, {est['zero_attempts']} with no payment attempt (normally {round(est['normal_zero_share'] * 100)}%)"))
    steps.append(AgentStep(tool="list_events", input={"window": "60 minutes before onset"}, output_summary=label or "No change on the merchant's side in that hour"))
    outages = db.execute("SELECT COUNT(*) AS n FROM downtime_events WHERE started_at <= ? AND ended_at >= ?", ((g.end or now).isoformat(), g.onset.isoformat())).fetchone()["n"]
    steps.append(AgentStep(tool="get_downtime_events", input={"window": "incident window"}, output_summary=f"{outages} bank outages overlap the window" if outages else "No bank outage covers the window"))
    steps.append(AgentStep(tool="attribute", input={}, output_summary=f"Rule {attr.rule_id}: {attr.owner}. {attr.reason}"))
    trace = AgentTrace(id=f"tr_{incident_id}", incident_id=incident_id, steps=steps, budget_used=len(steps), budget_total=8, model_id=None, rule_based=True)
    return verdict, attr, trace, est
