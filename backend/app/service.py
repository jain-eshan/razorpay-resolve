"""Read layer for the API: turns saved pipeline results into the response models. Every number is computed here from the data."""
import json
import sqlite3
from collections import Counter
from datetime import datetime, timedelta

from . import audit, clock, merchant_mock
from .act import executor, messages
from .config import ENTITLEMENT_EXPORT_AT
from .detect.webhook import HANDLER, Run, run_from_json
from .investigate.rules_fallback import build_pack
from .match.keys import complaints_by_payment
from .pipeline import pack_ref
from .schemas import (
    AgentTrace,
    AuditEntry,
    CaseDetail,
    CaseSummary,
    EvidencePack,
    IncidentDetail,
    IncidentSummary,
    LaneEvent,
    LiftRow,
    MatchCandidate,
    Member,
    RayCard,
    ReplaySummary,
    SampleTimeline,
    ScanResult,
    ThreeLane,
    TimelineBucket,
    Verdict,
)
from .widen.silent import Member as Cohort
from .widen.silent import build_cohort

OWNER_CHIP = {"merchant_code": "YOUR SIDE · Code", "merchant_config": "YOUR SIDE · Setup", "razorpay": "RAZORPAY SIDE", "bank": "BANK SIDE",
              "customer": "CUSTOMER SIDE", "unknown": "NOT SURE YET"}


def _fmt(d: datetime) -> str:
    return f"{d:%a %d %b %H:%M}"


def _row(db: sqlite3.Connection, incident_id: str) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()


def _cohort(db: sqlite3.Connection, row: sqlite3.Row) -> tuple[Run, list[Cohort], str | None]:
    run = run_from_json(json.loads(row["signature"]))
    disabled = db.execute("SELECT disabled_at FROM webhook_endpoints WHERE id = ?", (run.endpoint_id,)).fetchone()["disabled_at"]
    return run, build_cohort(db, run, disabled, clock.now(), ENTITLEMENT_EXPORT_AT, complaints_by_payment(db)), disabled


def _summary(row: sqlite3.Row, run: Run, members: list[Cohort], verdict: Verdict) -> IncidentSummary:
    complained = sum(m.complained for m in members)
    status = verdict.signature.get("status")
    change = verdict.cause_summary_slots.get("change")
    return IncidentSummary(
        id=row["id"], title=f"Webhook returned {status} after {change}" if verdict.linked_event_id else f"Webhook returned {status}", zone="after", mismatch_type="A",
        owner=row["owner"], inferred=False, status=row["status"], opened_by=row["opened_by"], affected=len(members), complained=complained, silent=len(members) - complained,
        fixed=sum(1 for m in members if (m.exclusion_reason or "").startswith("already active")),
        at_risk_paise=sum(m.amount_paise for m in members if m.tier != "excluded"), onset_at=verdict.onset_at, would_have_alerted_at=run.alert_at,
    )


def summaries(db: sqlite3.Connection) -> list[IncidentSummary]:
    out = []
    for row in db.execute("SELECT * FROM incidents ORDER BY onset_at").fetchall():
        run, members, _ = _cohort(db, row)
        out.append(_summary(row, run, members, Verdict.model_validate_json(row["verdict_json"])))
    return out


def _timeline(db: sqlite3.Connection, run: Run, disabled_at: str | None) -> list[TimelineBucket]:
    anchor = run.last_good_before or run.first_bad_at
    lo = (anchor - timedelta(hours=12)).replace(minute=0, second=0, microsecond=0)
    hi = ((run.resolved_at or run.last_bad_at) + timedelta(hours=6)).replace(minute=0, second=0, microsecond=0)
    evs = db.execute(f"SELECT e.created_at, e.final_delivery_class FROM webhook_events e WHERE e.endpoint_id = ? AND {HANDLER} AND e.created_at >= ? AND e.created_at < ?",
                     (run.endpoint_id, lo.isoformat(), hi.isoformat())).fetchall()
    marks = db.execute("SELECT at, label FROM merchant_events WHERE at >= ? AND at < ?", (lo.isoformat(), hi.isoformat())).fetchall()
    buckets, t = [], lo
    while t < hi:
        nxt = t + timedelta(hours=1)
        c = Counter(e["final_delivery_class"] for e in evs if t.isoformat() <= e["created_at"] < nxt.isoformat())
        m = [x["label"] for x in marks if t.isoformat() <= x["at"] < nxt.isoformat()]
        if t <= run.first_bad_at < nxt:
            m.append("change point")
        if t <= run.alert_at < nxt:
            m.append("alert would fire")
        if disabled_at and t <= datetime.fromisoformat(disabled_at) < nxt:
            m.append("Razorpay turns the webhook off")
        buckets.append(TimelineBucket(bucket_start=t, ok=c["2xx"], client_error=c["4xx"], server_error=c["5xx"] + c["timeout"], not_attempted=c["not_attempted_disabled"], markers=m))
        t = nxt
    return buckets


def _lift(db: sqlite3.Connection, run: Run, members: list[Cohort]) -> list[LiftRow]:
    base_lo = (run.first_bad_at - timedelta(days=7)).isoformat()
    baseline = [dict(r) for r in db.execute(
        "SELECT p.method, p.is_renewal, o.client_app_version FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE p.status = 'captured' AND p.captured_at >= ? AND p.captured_at < ?",
        (base_lo, run.first_bad_at.isoformat())).fetchall()]
    ids = [m.payment_id for m in members]
    aff = [dict(r) for r in db.execute(
        "SELECT p.method, p.is_renewal, o.client_app_version FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE p.id IN (%s)" % ",".join("?" * len(ids)), ids).fetchall()]
    rows = []
    evs = db.execute(f"SELECT e.final_delivery_class FROM webhook_events e WHERE e.endpoint_id = ? AND {HANDLER} AND e.created_at < ?", (run.endpoint_id, run.first_bad_at.isoformat())).fetchall()
    bad_share_base = sum(e["final_delivery_class"] != "2xx" for e in evs) / len(evs) if evs else 0.0
    rows.append(LiftRow(dimension="delivery_outcome", value="failed or never attempted", share_affected=1.0, share_baseline=round(bad_share_base, 4), lift=round(1.0 / max(bad_share_base, 0.001), 1)))
    for dim, key in (("method", "method"), ("app_version", "client_app_version"), ("kind", "is_renewal")):
        for val, n in Counter(a[key] for a in aff).most_common(3):
            sa = n / len(aff)
            sb = sum(1 for b in baseline if b[key] == val) / len(baseline) if baseline else 0.0
            label = ("renewal" if val else "one-time") if dim == "kind" else ("none" if val is None else str(val))
            rows.append(LiftRow(dimension=dim, value=label, share_affected=round(sa, 4), share_baseline=round(sb, 4), lift=round(sa / max(sb, 0.001), 1)))
    return rows


def _replay(incident_id: str, members: list[Cohort]) -> ReplaySummary:
    c = Counter(m.replay_eligibility for m in members)
    return ReplaySummary(incident_id=incident_id, replayable_by_support=c["replayable_by_support"], not_replayable_disabled_window=c["not_replayable_disabled_window"], too_old=c["too_old"],
                         note="Razorpay support can replay one event at a time. Bulk replay does not exist, and events sent while the webhook was off cannot be replayed at all.")


def detail(db: sqlite3.Connection, incident_id: str) -> IncidentDetail | None:
    row = _row(db, incident_id)
    if not row:
        return None
    run, members, disabled = _cohort(db, row)
    verdict = Verdict.model_validate_json(row["verdict_json"])
    verdict.affected_count = len(members)
    tiers = Counter(m.tier for m in members)
    return IncidentDetail(**_summary(row, run, members, verdict).model_dump(), verdict=verdict, timeline=_timeline(db, run, disabled), lift=_lift(db, run, members),
                          tier_counts={t: tiers[t] for t in ("exact", "likely", "check", "excluded")}, replay=_replay(incident_id, members), actions=executor.summaries(db, incident_id))


def members(db: sqlite3.Connection, incident_id: str, tier: str | None = None) -> list[Member] | None:
    row = _row(db, incident_id)
    if not row:
        return None
    _, cohort, _ = _cohort(db, row)
    return [Member(payment_id=m.payment_id, customer_masked=m.customer_masked, amount_paise=m.amount_paise, captured_at=m.captured_at, plan=m.plan, complained=m.complained,
                   delivery_outcome=m.delivery_outcome, merchant_state=m.merchant_state, tier=m.tier, exclusion_reason=m.exclusion_reason, replay_eligibility=m.replay_eligibility)
            for m in cohort if tier is None or m.tier == tier]


def sample(db: sqlite3.Connection, incident_id: str) -> list[SampleTimeline] | None:
    row = _row(db, incident_id)
    if not row:
        return None
    _, cohort, disabled = _cohort(db, row)
    complaints = complaints_by_payment(db)
    picks, seen = [], set()
    for want in (lambda m: m.complained and m.tier == "exact", lambda m: m.delivery_outcome.startswith("not attempted") and m.tier == "exact",
                 lambda m: m.delivery_outcome.startswith("401") and m.tier == "exact", lambda m: m.delivery_outcome.startswith("2xx") and m.tier == "exact",
                 lambda m: m.tier == "excluded"):
        m = next((x for x in cohort if want(x) and x.payment_id not in seen), None)
        if m:
            picks.append(m)
            seen.add(m.payment_id)
    out = []
    for m in picks:
        att = db.execute("SELECT attempted_at, http_status FROM webhook_deliveries WHERE event_id = ? ORDER BY attempt_no", (m.event_id,)).fetchall()
        ent_state = m.merchant_state
        cust = [LaneEvent(at=datetime.fromisoformat(c["received_at"]), text=c["raw_text"], source_ref=c["id"]) for c in complaints.get(m.payment_id, [])]
        rz = [LaneEvent(at=datetime.fromisoformat(m.captured_at), text="Payment captured", source_ref=m.payment_id)]
        if att:
            rz.append(LaneEvent(at=datetime.fromisoformat(att[0]["attempted_at"]), text=f"{len(att)} webhook attempts, each answered {att[0]['http_status']}" if all(a["http_status"] == att[0]["http_status"] for a in att) else f"{len(att)} webhook attempts", source_ref=m.event_id))
        elif disabled:
            rz.append(LaneEvent(at=datetime.fromisoformat(disabled), text="Webhook was off. Nothing was sent.", source_ref=m.event_id))
        mer = [LaneEvent(at=ENTITLEMENT_EXPORT_AT, text=f"Access record: {ent_state}", source_ref=m.customer_id)]
        out.append(SampleTimeline(payment_id=m.payment_id, lanes=ThreeLane(customer=cust, razorpay=rz, merchant=mer)))
    return out


def trace(db: sqlite3.Connection, incident_id: str) -> AgentTrace | None:
    r = db.execute("SELECT steps_json FROM agent_traces WHERE incident_id = ?", (incident_id,)).fetchone()
    return AgentTrace.model_validate_json(r["steps_json"]) if r else None


def ray_card(db: sqlite3.Connection, incident_id: str) -> RayCard | None:
    d = detail(db, incident_id)
    if not d:
        return None
    row = _row(db, incident_id)
    run, _, disabled = _cohort(db, row)
    status = d.verdict.signature.get("status")
    line = f"Your server returned {status} to Razorpay from {_fmt(run.first_bad_at)}."
    if disabled:
        line += f" Razorpay turned the webhook off on {_fmt(datetime.fromisoformat(disabled))}."
    return RayCard(incident_id=incident_id, owner_chip=OWNER_CHIP[d.owner], inferred=False, cause_line=line, affected=d.affected, complained=d.complained, silent=d.silent,
                   fixed=d.fixed, at_risk_paise=d.at_risk_paise, language="en", buttons=["View list", "Send to dev"])


def evidence_pack(db: sqlite3.Connection, incident_id: str) -> EvidencePack | None:
    row = _row(db, incident_id)
    if not row:
        return None
    run, cohort, _ = _cohort(db, row)
    return build_pack(db, incident_id, run, Verdict.model_validate_json(row["verdict_json"]), cohort, pack_ref(incident_id))


def replay(db: sqlite3.Connection, incident_id: str) -> ReplaySummary | None:
    row = _row(db, incident_id)
    if not row:
        return None
    return _replay(incident_id, _cohort(db, row)[1])


def scan_day0(db: sqlite3.Connection, days: int = 30) -> ScanResult:
    incs = summaries(db)
    customers, paise = 0, 0
    for i in incs:
        cohort = _cohort(db, _row(db, i.id))[1]
        live = [m for m in cohort if m.tier != "excluded"]
        customers += len(live)
        paise += sum(m.amount_paise for m in live)
    head = f"I found {customers} customers in the last {days} days who paid and have no access." if customers else f"No mismatches found in the last {days} days."
    return ScanResult(days=days, headline=head, leaked_customers=customers, leaked_paise=paise, incidents=incs)


def audit_entries(db: sqlite3.Connection, ref_id: str | None = None) -> list[AuditEntry]:
    rows = db.execute("SELECT * FROM audit_log WHERE (? IS NULL OR ref_id = ?) ORDER BY id DESC LIMIT 500", (ref_id, ref_id)).fetchall()
    return [AuditEntry(id=r["id"], at=datetime.fromisoformat(r["at"]), actor=r["actor"], kind=r["kind"], ref_id=r["ref_id"], model_id=r["model_id"], latency_ms=r["latency_ms"],
                       cost_usd=r["cost_usd"], summary=json.loads(r["payload_json"])["summary"]) for r in rows]


def log_clock(db: sqlite3.Connection, hours: int, now: datetime) -> None:
    audit.log(db, "system", "action", None, f"Demo clock moved forward {hours} hours to {_fmt(now)}.")
    db.commit()


# ---------- cases (S-04): what the customer says, what Razorpay says, what the merchant says ----------
def _case_row(db: sqlite3.Connection, case_id: str) -> sqlite3.Row | None:
    return db.execute("SELECT cs.*, cm.channel, cm.received_at, cm.redacted_text, cm.raw_text, cm.id AS cid FROM cases cs JOIN complaints cm ON cm.id = cs.complaint_id WHERE cs.id = ?", (case_id,)).fetchone()


def _case_summary(r: sqlite3.Row) -> CaseSummary:
    return CaseSummary(id=r["id"], complaint_id=r["complaint_id"], channel=r["channel"], match_status=r["match_status"], mismatch_type=r["mismatch_type"], owner=r["owner"],
                       incident_id=r["incident_id"], received_at=datetime.fromisoformat(r["received_at"]))


def cases(db: sqlite3.Connection, status: str | None = None) -> list[CaseSummary]:
    q = "SELECT cs.*, cm.channel, cm.received_at FROM cases cs JOIN complaints cm ON cm.id = cs.complaint_id WHERE (? IS NULL OR cs.match_status = ?) ORDER BY cm.received_at DESC"
    return [_case_summary(r) for r in db.execute(q, (status, status)).fetchall()]


def case_lanes(db: sqlite3.Connection, case_id: str) -> ThreeLane | None:
    r = _case_row(db, case_id)
    if not r:
        return None
    thread = db.execute("SELECT id FROM threads WHERE case_id = ?", (case_id,)).fetchone()
    if thread:
        said = [LaneEvent(at=datetime.fromisoformat(m["created_at"]), text=m["body_redacted"], source_ref=m["id"])
                for m in db.execute("SELECT * FROM thread_messages WHERE thread_id = ? AND direction = 'inbound' ORDER BY created_at, rowid", (thread["id"],))]
    else:
        said = [LaneEvent(at=datetime.fromisoformat(r["received_at"]), text=r["raw_text"], source_ref=r["cid"])]
    rz, mer = [], []
    for pid in json.loads(r["matched_payment_ids"] or "[]")[:1]:
        p = db.execute("SELECT * FROM payments WHERE id = ?", (pid,)).fetchone()
        rz.append(LaneEvent(at=datetime.fromisoformat(p["captured_at"]), text=f"Payment of {rupees_text(p['amount_paise'])} captured", source_ref=pid))
        att = db.execute("SELECT d.attempted_at, d.http_status FROM webhook_deliveries d JOIN webhook_events e ON e.id = d.event_id WHERE e.payment_id = ? ORDER BY d.attempted_at", (pid,)).fetchall()
        if att:
            rz.append(LaneEvent(at=datetime.fromisoformat(att[0]["attempted_at"]), text=f"{len(att)} webhook attempts, first answered {att[0]['http_status']}", source_ref=pid))
        ent = merchant_mock.check(db, pid)
        mer.append(LaneEvent(at=clock.now(), text=f"Access record: {ent['entitlement_state']}", source_ref=pid))
    return ThreeLane(customer=said, razorpay=rz, merchant=mer)


def rupees_text(paise: int) -> str:
    return f"₹{messages.inr(paise)}"


def case_detail(db: sqlite3.Connection, case_id: str) -> CaseDetail | None:
    r = _case_row(db, case_id)
    if not r:
        return None
    ex = db.execute("SELECT json, injection_suspected FROM extractions WHERE complaint_id = ?", (r["cid"],)).fetchone()
    cands = [MatchCandidate(payment_id=c["payment_id"], method=c["method"], calibrated_score=c["calibrated_score"], features={k: v for k, v in json.loads(c["features"] or "{}").items()})
             for c in db.execute("SELECT * FROM match_candidates WHERE complaint_id = ? ORDER BY rank", (r["cid"],))]
    thread = db.execute("SELECT * FROM threads WHERE case_id = ?", (case_id,)).fetchone()
    draft = db.execute("SELECT body_redacted FROM thread_messages WHERE thread_id = ? AND direction = 'outbound' AND json_extract(policy_json, '$.status') = 'draft' ORDER BY created_at DESC, rowid DESC LIMIT 1", (thread["id"],)).fetchone() if thread else None
    pids = json.loads(r["matched_payment_ids"] or "[]")
    if r["match_status"] == "matched" and r["incident_id"]:
        line = f"Matched to {pids[0]} by an exact identifier. Part of {r['incident_id']}: {OWNER_CHIP.get(r['owner'] or 'unknown', '')}."
    elif r["match_status"] == "matched":
        line = f"Matched to {pids[0]} by an exact identifier. No incident covers it."
    elif r["match_status"] == "not_payment":
        line = "Not about a payment. Nothing is kept."
    else:
        line = "No payment found yet. Closest guesses are for the founder only."
    return CaseDetail(**_case_summary(r).model_dump(), extraction=json.loads(ex["json"]) if ex else {}, candidates=cands, lanes=case_lanes(db, case_id), state_line=line,
                      reply_draft=draft["body_redacted"] if draft else None, injection_suspected=bool(ex["injection_suspected"]) if ex else False)
