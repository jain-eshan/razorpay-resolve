"""Read layer for INC-3, the Razorpay-side renewal failure: the same response models as Hero A, filled from renewal evidence.

Nothing reached the merchant's webhook for these customers (the renewals never succeeded), so there are no deliveries to show. A
"member" is a failed renewal. The chart is card renewals by the hour: those that went through and those that failed. The fix is a
grace extension (access kept on for a few days) and the check is the merchant's own access record. Every number is computed here."""
import json
import sqlite3
from collections import Counter
from datetime import datetime, timedelta

from .. import audit, clock, merchant_mock
from ..act import messages
from ..match.keys import complaints_by_payment
from ..schemas import (
    EvidencePack,
    IncidentDetail,
    IncidentSummary,
    LaneEvent,
    LiftRow,
    Member,
    RayCard,
    ReplaySummary,
    SampleTimeline,
    ThreeLane,
    TimelineBucket,
    Verdict,
    VerifyResult,
)
from ..widen.silent import mask
from ..zone1 import recovery

HEALTHY_RENEWALS = 3  # card renewals that must have gone through since it cleared before the incident can close
FIX = "Nothing on your side caused this. Keep access on for these customers until Razorpay confirms it is fixed, and send Razorpay the evidence pack."


def _verdict(row: sqlite3.Row) -> Verdict:
    return Verdict.model_validate_json(row["verdict_json"])


def _sig(row: sqlite3.Row) -> dict:
    return json.loads(row["signature"])


def _dt(s: str | None) -> datetime | None:
    return datetime.fromisoformat(s) if s else None


def _rows(db: sqlite3.Connection, incident_id: str) -> list[sqlite3.Row]:
    return db.execute("""SELECT im.*, p.created_at AS at, p.subscription_id, p.card_network, p.error_code, c.name, c.id AS customer_id, pl.name AS plan
                         FROM incident_members im JOIN payments p ON p.id = im.payment_id JOIN customers c ON c.id = p.customer_id
                         LEFT JOIN subscriptions s ON s.id = p.subscription_id LEFT JOIN plans pl ON pl.id = s.plan_id WHERE im.incident_id = ? ORDER BY p.created_at, p.id""", (incident_id,)).fetchall()


def summary(db: sqlite3.Connection, row: sqlite3.Row) -> IncidentSummary:
    v, mem = _verdict(row), _rows(db, row["id"])
    live = [m for m in mem if m["tier"] != "excluded"]
    complained = sum(m["complained"] for m in mem)
    return IncidentSummary(id=row["id"], title=str(v.cause_summary_slots["title"]), zone="after", mismatch_type="G", owner=row["owner"], inferred=False, status=row["status"], opened_by=row["opened_by"],
                           affected=len(mem), complained=complained, silent=len(mem) - complained, fixed=len(mem) - len(live), at_risk_paise=sum(m["amount_paise"] for m in live),
                           onset_at=v.onset_at, would_have_alerted_at=_dt(_sig(row)["alert_at"]))


def hourly(db: sqlite3.Connection, row: sqlite3.Row) -> list[dict]:
    sig = _sig(row)
    first, end = datetime.fromisoformat(sig["first_failure_at"]), _dt(sig["resolved_at"]) or datetime.fromisoformat(sig["last_failure_at"])
    lo = (first - timedelta(hours=6)).replace(minute=0, second=0, microsecond=0)
    hi = (end + timedelta(hours=4)).replace(minute=0, second=0, microsecond=0)
    pays = db.execute("SELECT created_at, method, status FROM payments WHERE is_renewal = 1 AND created_at >= ? AND created_at < ?", (lo.isoformat(), hi.isoformat())).fetchall()
    out, h = [], lo
    while h < hi:
        nxt = h + timedelta(hours=1)
        here = [p for p in pays if h.isoformat() <= p["created_at"] < nxt.isoformat()]
        c = Counter((p["method"], p["status"] == "failed") for p in here)
        out.append({"at": h.isoformat(), "card_ok": c[("card", False)], "card_failed": c[("card", True)], "upi_ok": c[("upi", False)], "upi_failed": c[("upi", True)]})
        h = nxt
    return out


def _markers(sig: dict, hour: datetime) -> list[str]:
    nxt = hour + timedelta(hours=1)
    hit = lambda s: s and hour <= datetime.fromisoformat(s) < nxt
    marks = []
    if hit(sig["first_failure_at"]):
        marks.append("first card renewal fails")
    if hit(sig["alert_at"]):
        marks.append(f"alert would fire at {datetime.fromisoformat(sig['alert_at']).strftime('%H:%M')}")
    if hit(sig["resolved_at"]):
        marks.append("card renewals work again")
    return marks


def _lift(db: sqlite3.Connection, row: sqlite3.Row, mem: list[sqlite3.Row]) -> list[LiftRow]:
    sig = _sig(row)
    lo = (datetime.fromisoformat(sig["first_failure_at"]) - timedelta(days=14)).isoformat()
    base = db.execute("SELECT method, status, error_code, card_network FROM payments WHERE is_renewal = 1 AND created_at >= ? AND created_at < ?", (lo, sig["first_failure_at"])).fetchall()
    cards = [b for b in base if b["method"] == "card"]
    fails = [b for b in base if b["status"] == "failed"]
    code = sig["error_code"]
    share_card = len(cards) / len(base) if base else 0.0
    share_code = sum(1 for m in mem if m["error_code"] == code) / len(mem)
    base_code = sum(1 for f in fails if f["error_code"] == code) / len(fails) if fails else 0.0
    rows = [LiftRow(dimension="method", value="card", share_affected=1.0, share_baseline=round(share_card, 4), lift=round(1.0 / max(share_card, 0.001), 1))]
    if len(fails) >= 10:  # with fewer failures in the baseline, "how often is this code normal" says nothing
        rows.append(LiftRow(dimension="error_code", value=code, share_affected=round(share_code, 4), share_baseline=round(base_code, 4), lift=round(share_code / max(base_code, 0.001), 1)))
    for net, n in Counter(m["card_network"] for m in mem).most_common(3):
        sa, sb = n / len(mem), (sum(1 for c in cards if c["card_network"] == net) / len(cards) if cards else 0.0)
        rows.append(LiftRow(dimension="card_network", value=str(net), share_affected=round(sa, 4), share_baseline=round(sb, 4), lift=round(sa / max(sb, 0.001), 1)))
    return rows


def detail(db: sqlite3.Connection, row: sqlite3.Row) -> IncidentDetail:
    from ..act import executor

    v, s, mem = _verdict(row), summary(db, row), _rows(db, row["id"])
    sig = _sig(row)
    hrs = hourly(db, row)
    v.signature = {**sig, "hourly": hrs}
    v.affected_count = s.affected
    buckets = [TimelineBucket(bucket_start=datetime.fromisoformat(h["at"]), ok=h["card_ok"], client_error=0, server_error=h["card_failed"], not_attempted=0, markers=_markers(sig, datetime.fromisoformat(h["at"]))) for h in hrs]
    exact = sum(1 for m in mem if m["tier"] == "exact")
    return IncidentDetail(**s.model_dump(), verdict=v, timeline=buckets, lift=_lift(db, row, mem), tier_counts={"exact": exact, "likely": 0, "check": 0, "excluded": len(mem) - exact},
                          replay=replay(row["id"]), actions=executor.summaries(db, row["id"]))


def replay(incident_id: str) -> ReplaySummary:
    return ReplaySummary(incident_id=incident_id, replayable_by_support=0, not_replayable_disabled_window=0, too_old=0,
                         note="Nothing to replay. These renewals never succeeded, so Razorpay sent your server no event for them.")


def members(db: sqlite3.Connection, row: sqlite3.Row, tier: str | None = None) -> list[Member]:
    out = []
    for m in _rows(db, row["id"]):
        if tier and m["tier"] != tier:
            continue
        state = merchant_mock.check(db, m["payment_id"])
        out.append(Member(payment_id=m["payment_id"], customer_masked=mask(m["name"]), amount_paise=m["amount_paise"], captured_at=m["at"], plan=m["plan"] or "Premium Monthly", complained=bool(m["complained"]),
                          delivery_outcome=f"Card renewal failed: {m['error_code']}", merchant_state="active" if state["has_access"] else state["entitlement_state"], tier=m["tier"],
                          exclusion_reason=m["exclusion_reason"], replay_eligibility="n/a"))
    return out


def sample(db: sqlite3.Connection, row: sqlite3.Row) -> list[SampleTimeline]:
    mem, said = _rows(db, row["id"]), complaints_by_payment(db)
    picks = [next((m for m in mem if m["complained"] and m["tier"] == "exact"), None), next((m for m in mem if not m["complained"] and m["tier"] == "exact"), None),
             next((m for m in mem if m["tier"] == "excluded"), None)]
    out = []
    for m in (x for x in picks if x):
        at = datetime.fromisoformat(m["at"])
        cust = [LaneEvent(at=datetime.fromisoformat(c["received_at"]), text=c["raw_text"], source_ref=c["id"]) for c in said.get(m["payment_id"], [])]
        rz = [LaneEvent(at=at, text=f"Card renewal of ₹{messages.inr(m['amount_paise'])} failed: {m['error_code']}, no fault of the customer's card", source_ref=m["payment_id"])]
        if m["exclusion_reason"]:
            rz.append(LaneEvent(at=clock.now(), text=m["exclusion_reason"], source_ref=m["payment_id"]))
        ent = merchant_mock.check(db, m["payment_id"])
        mer = [LaneEvent(at=clock.now(), text=f"Access record: {ent['entitlement_state']}" + (f", until {datetime.fromisoformat(ent['access_until']):%a %d %b %H:%M}" if ent["access_until"] else ""), source_ref=m["customer_id"])]
        out.append(SampleTimeline(payment_id=m["payment_id"], lanes=ThreeLane(customer=cust, razorpay=rz, merchant=mer)))
    return out


def ray_card(db: sqlite3.Connection, row: sqlite3.Row) -> RayCard:
    v, s = _verdict(row), summary(db, row)
    sl = v.cause_summary_slots
    line = (f"Card renewals started failing at {v.onset_at:%a %d %b %H:%M} with a gateway error. {sl['failed']} renewals failed. "
            f"UPI AutoPay renewals in the same hours went through ({sl['control_renewals']} of {sl['control_renewals']}).")
    return RayCard(incident_id=row["id"], owner_chip="RAZORPAY SIDE", inferred=False, cause_line=line, affected=s.affected, complained=s.complained, silent=s.silent, fixed=s.fixed,
                   at_risk_paise=s.at_risk_paise, language="en", buttons=["See what failed", "Send to Razorpay"])


def evidence_pack(db: sqlite3.Connection, row: sqlite3.Row, ref: str) -> EvidencePack:
    sig = _sig(row)
    return EvidencePack(incident_id=row["id"], ref=ref, endpoint=None, first_failure_at=_dt(sig["first_failure_at"]), last_failure_at=_dt(sig["last_failure_at"]), linked_change=None,
                        response_excerpt=f"{sig['error_code']}: Payment processing failed due to error at bank or wallet gateway ({sig['run_length']} card renewals)",
                        affected_events=sig["run_length"], affected_payment_ids=[m["payment_id"] for m in _rows(db, row["id"])], suggested_fix=FIX, for_razorpay=True)


# ---------- the fix is checked against the merchant's own records ----------
def gateway_health(db: sqlite3.Connection, row: sqlite3.Row) -> dict:
    """Has the failing method started working again. Card renewals that went through since the last failure."""
    sig = _sig(row)
    since = db.execute("SELECT COUNT(*) AS n, MIN(created_at) AS first FROM payments WHERE is_renewal = 1 AND method = ? AND status = 'captured' AND created_at > ?", (sig["method"], sig["last_failure_at"])).fetchone()
    ok = since["n"] >= HEALTHY_RENEWALS
    return {"healthy": ok, "n": since["n"], "since": since["first"]}


# ---------- the renewal link, sent once card renewals work again to the customers who were promised one ----------
def recovery_block(db: sqlite3.Connection, row: sqlite3.Row) -> str | None:
    """Why renewal links cannot go out right now, or None. They go out only after card renewals have worked again, so the link does not fail the same way."""
    h = gateway_health(db, row)
    return None if h["healthy"] else f"Links go out only after card renewals work again. {h['n']} of {HEALTHY_RENEWALS} have gone through since the last failure."


def told(db: sqlite3.Connection, incident_id: str) -> bool:
    """Has anyone been sent the message that promised a link (T-G1)."""
    return db.execute("""SELECT 1 FROM messages m JOIN incident_members im ON im.payment_id = m.payment_id
                         WHERE im.incident_id = ? AND m.template_id = 'T-G1' AND m.status = 'sent' LIMIT 1""", (incident_id,)).fetchone() is not None


def paid_since(db: sqlite3.Connection, payment_id: str) -> bool:
    """Has this customer paid a renewal since the one that failed."""
    return db.execute("""SELECT 1 FROM payments f JOIN payments q ON q.customer_id = f.customer_id AND q.status = 'captured' AND q.created_at > f.created_at
                         WHERE f.id = ? LIMIT 1""", (payment_id,)).fetchone() is not None


def link_candidates(db: sqlite3.Connection, incident_id: str) -> list[str]:
    """Failed payment ids to send a link for: customers who were told one was coming and have not paid since, one payment each. Their order is the order they were told."""
    told_ids = [r["payment_id"] for r in db.execute("""SELECT m.payment_id FROM messages m JOIN incident_members im ON im.payment_id = m.payment_id
                                                       WHERE im.incident_id = ? AND m.template_id = 'T-G1' AND m.status = 'sent' ORDER BY m.rowid""", (incident_id,))]
    out, seen = [], set()
    for pid in told_ids:
        cust = db.execute("SELECT customer_id FROM payments WHERE id = ?", (pid,)).fetchone()["customer_id"]
        if cust not in seen and not paid_since(db, pid):
            seen.add(cust)
            out.append(pid)
    return out


def link_slots(db: sqlite3.Connection, payment_id: str, hours: int) -> dict:
    return messages.slots_for(db, payment_id) | {"hours": hours}


def _outcome_line(out: dict) -> str:
    total, paid = out["sent"] + out["held_back"], out["sent_paid"] + out["held_back_paid"]
    if not total:
        return ""
    line = f" Renewed since: {paid} of {total} customers, ₹{messages.inr(out['recovered_paise'] + out['paid_anyway_paise'])} in all."
    if out["held_back"]:
        line += f" Held back on purpose: {out['held_back_paid']} of {out['held_back']} paid on their own." + (" Too few customers to say what the link adds." if out["held_back"] < 20 else "")
    return line


def verify(db: sqlite3.Connection, incident_id: str, actor: str = "system") -> VerifyResult:
    from ..act import executor

    row = db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    h = gateway_health(db, row)
    g = db.execute("SELECT * FROM actions WHERE incident_id = ? AND action_type = 'grant' AND status != 'reverted'", (incident_id,)).fetchone()
    if not g:
        return VerifyResult(incident_id=incident_id, verified=0, total=0, signal_healthy=h["healthy"], restored_paise=0, closeable=False, line="Nothing has been done yet. Plan the grace extension and run it first.")
    now = clock.now().isoformat()
    for it in executor._items(db, g["id"]):
        if it["status"] in ("done", "verified", "verify_failed"):
            db.execute("UPDATE action_items SET status = ?, verified_at = ? WHERE id = ?", ("verified" if executor._check_grant(db, it, {}) else "verify_failed", now, it["id"]))
    items = executor._items(db, g["id"])
    verified = sum(1 for i in items if i["status"] == "verified")
    recovery.settle(db)
    out = recovery.outcome(db, incident_id)
    running = db.execute("SELECT 1 FROM actions WHERE incident_id = ? AND action_type = 'recovery_link' AND status IN ('approved','failed')", (incident_id,)).fetchone() is not None
    closeable = verified == len(items) and h["healthy"] and not running
    line = f"{verified} of {len(items)} confirmed to have access by your records."
    if running:
        line += " A renewal link send that is half done keeps the incident open." + _outcome_line(out)
    elif closeable:
        line += f" Card renewals have gone through again since {datetime.fromisoformat(h['since']):%a %H:%M} ({h['n']} so far)."
        line += _outcome_line(out) or " Their renewals still have to be collected."
    elif not h["healthy"]:
        line += f" Card renewals have gone through {h['n']} of {HEALTHY_RENEWALS} times needed since the last failure. Verify again later."
    else:
        waiting = sum(1 for i in items if i["status"] == "pending")
        bad = len(items) - verified - waiting
        line += (f" {waiting} are still waiting for the next step." if waiting else "") + (f" {bad} still show no access. Run the plan again to retry them." if bad else "")
    executor._set_incident(db, incident_id, "closed" if closeable else "verifying" if verified == len(items) else "fixing")
    if closeable:
        from ..conversation import machine

        machine.resolve_threads(db, incident_id)
    last = db.execute("SELECT payload_json FROM audit_log WHERE kind = 'verify' AND ref_id = ? ORDER BY id DESC LIMIT 1", (incident_id,)).fetchone()
    if not last or json.loads(last["payload_json"])["summary"] != line:
        audit.log(db, actor, "verify", incident_id, line, closeable=closeable)
    return VerifyResult(incident_id=incident_id, verified=verified, total=len(items), signal_healthy=h["healthy"], restored_paise=0, closeable=closeable, line=line)
