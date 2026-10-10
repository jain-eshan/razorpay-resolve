"""Read layer for INC-2, customers charged twice: the same response models as Hero A, filled from the duplicate-charge evidence.

Both charges reached the merchant's webhook and both orders were fulfilled, so there are no deliveries to show. A "member" is the second
charge of a pair. The chart is the Android app's orders by day, with the ones that were doubled marked. The fix has two halves: the
merchant's developer ships a release that cannot double submit, and the founder refunds the second charges one customer at a time.
Every number here is computed from the data."""
import json
import sqlite3
from collections import Counter
from datetime import datetime, timedelta

from .. import audit, clock, merchant_mock
from ..act import messages, refund
from ..config import ENTITLEMENT_EXPORT_AT
from ..detect import duplicate as monitor
from ..match.keys import complaints_by_payment
from ..schemas import (
    EvidencePack,
    IncidentDetail,
    IncidentSummary,
    LaneEvent,
    LiftRow,
    Member,
    RayCard,
    RefundBoard,
    RefundRow,
    ReplaySummary,
    SampleTimeline,
    ThreeLane,
    TimelineBucket,
    Verdict,
    VerifyResult,
)
from ..widen.silent import mask

FIX = "Add an idempotency key to order creation, so a second tap returns the first order, and disable the Pay button after the first tap. Ship it in a new Android release."
OUTCOME = {"two_seat": "Two orders for two people", "second_failed": "Second attempt failed after the debit", "refunded": "Refunded by you earlier"}


def _verdict(row: sqlite3.Row) -> Verdict:
    return Verdict.model_validate_json(row["verdict_json"])


def _sig(row: sqlite3.Row) -> dict:
    return json.loads(row["signature"])


def _dt(s: str | None) -> datetime | None:
    return datetime.fromisoformat(s) if s else None


def _pairs(db: sqlite3.Connection) -> dict[str, monitor.Pair]:
    """second payment id -> the pair it belongs to."""
    return {p.second_id: p for p in monitor.candidates(db)}


def _rows(db: sqlite3.Connection, incident_id: str) -> list[sqlite3.Row]:
    return db.execute("""SELECT im.*, p.created_at AS at, p.captured_at, p.method, p.status AS pay_status, p.order_id, c.name, c.id AS customer_id, pl.name AS plan
                         FROM incident_members im JOIN payments p ON p.id = im.payment_id JOIN customers c ON c.id = p.customer_id
                         LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN plans pl ON pl.id = o.plan_id WHERE im.incident_id = ? ORDER BY COALESCE(p.captured_at, p.created_at), p.id""", (incident_id,)).fetchall()


def _refund(db: sqlite3.Connection, payment_id: str) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM refunds WHERE payment_id = ?", (payment_id,)).fetchone()


def summary(db: sqlite3.Connection, row: sqlite3.Row) -> IncidentSummary:
    v, mem = _verdict(row), _rows(db, row["id"])
    dups = [m for m in mem if m["tier"] == "exact"]
    done = [m for m in dups if _refund(db, m["payment_id"])]
    complained = sum(m["complained"] for m in dups)
    return IncidentSummary(id=row["id"], title=str(v.cause_summary_slots["title"]), zone="after", mismatch_type="E", owner=row["owner"], inferred=False, status=row["status"], opened_by=row["opened_by"],
                           affected=len(dups), complained=complained, silent=len(dups) - complained, fixed=len(done), at_risk_paise=sum(m["amount_paise"] for m in dups if m not in done),
                           onset_at=v.onset_at, would_have_alerted_at=_dt(_sig(row)["alert_at"]))


def daily(db: sqlite3.Connection, row: sqlite3.Row) -> list[dict]:
    """The Android version's orders by day: how many, and how many were the second order of a double tap."""
    sig = _sig(row)
    first, version = datetime.fromisoformat(sig["release_at"] or sig["first_at"]), sig["app_version"]
    start = (first - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = clock.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    seconds = {m["order_id"] for m in _rows(db, row["id"]) if m["tier"] == "exact"}
    orders = db.execute("SELECT o.id AS oid, o.client_app_version AS v, o.created_at FROM orders o WHERE o.created_at >= ? AND o.created_at < ?", (start.isoformat(), end.isoformat())).fetchall()
    out, d = [], start
    while d < end:
        nxt = d + timedelta(days=1)
        here = [o for o in orders if d.isoformat() <= o["created_at"] < nxt.isoformat()]
        mine = [o for o in here if o["v"] == version]
        out.append({"at": d.isoformat(), "version_orders": len(mine), "doubled": sum(1 for o in mine if o["oid"] in seconds), "other_orders": len(here) - len(mine)})
        d = nxt
    return out


def _markers(sig: dict, day: datetime) -> list[str]:
    nxt = day + timedelta(days=1)
    hit = lambda s: s and day <= datetime.fromisoformat(s) < nxt
    marks = []
    if hit(sig["release_at"]):
        marks.append(f"{sig['app_version']} released")
    if hit(sig["first_at"]):
        marks.append("first double charge")
    if hit(sig["alert_at"]):
        marks.append(f"alert would fire at {datetime.fromisoformat(sig['alert_at']).strftime('%H:%M')}")
    return marks


def _lift(db: sqlite3.Connection, row: sqlite3.Row, mem: list[sqlite3.Row]) -> list[LiftRow]:
    sig = _sig(row)
    lo = (datetime.fromisoformat(sig["release_at"] or sig["first_at"]) - timedelta(days=14)).isoformat()
    base = db.execute("""SELECT p.method, o.client_app_version AS v, o.plan_id FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.is_renewal = 0 AND p.status IN ('captured', 'refunded')
                         AND p.created_at >= ? AND p.created_at < ?""", (lo, sig["release_at"] or sig["first_at"])).fetchall()
    aff = db.execute("SELECT p.method, o.client_app_version AS v, o.plan_id FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id IN (%s)" % ",".join("?" * len(mem)), [m["payment_id"] for m in mem]).fetchall() if mem else []
    rows = []
    for dim, key in (("app_version", "v"), ("method", "method"), ("plan", "plan_id")):
        for val, n in Counter(a[key] for a in aff).most_common(3):
            sa = n / len(aff)
            sb = sum(1 for b in base if b[key] == val) / len(base) if base else 0.0
            rows.append(LiftRow(dimension=dim, value=str(val), share_affected=round(sa, 4), share_baseline=round(sb, 4), lift=round(sa / max(sb, 0.001), 1)))
    return rows


def detail(db: sqlite3.Connection, row: sqlite3.Row) -> IncidentDetail:
    from ..act import executor

    v, s, mem = _verdict(row), summary(db, row), _rows(db, row["id"])
    sig = _sig(row)
    days = daily(db, row)
    v.signature = {**sig, "daily": days}
    v.affected_count = s.affected
    buckets = [TimelineBucket(bucket_start=datetime.fromisoformat(d["at"]), ok=d["version_orders"] - d["doubled"], client_error=0, server_error=d["doubled"], not_attempted=0,
                              markers=_markers(sig, datetime.fromisoformat(d["at"]))) for d in days]
    dups = [m for m in mem if m["tier"] == "exact"]
    return IncidentDetail(**s.model_dump(), verdict=v, timeline=buckets, lift=_lift(db, row, dups), tier_counts={"exact": len(dups), "likely": 0, "check": 0, "excluded": len(mem) - len(dups)},
                          replay=replay(row["id"]), actions=executor.summaries(db, row["id"]))


def replay(incident_id: str) -> ReplaySummary:
    return ReplaySummary(incident_id=incident_id, replayable_by_support=0, not_replayable_disabled_window=0, too_old=0,
                         note="Nothing to replay. Your webhook answered 200 for both charges and both orders got access. The only problem is the second charge.")


STATE = {"two_seat": "both orders fulfilled", "second_failed": "first order fulfilled", "refunded": "refunded"}


def _state(db: sqlite3.Connection, m: sqlite3.Row, kind: str) -> str:
    if kind != "duplicate":
        return STATE.get(kind, "")
    r = _refund(db, m["payment_id"])
    return "not refunded" if not r else "refund pending" if r["status"] == "pending" else "refund processed"


def members(db: sqlite3.Connection, row: sqlite3.Row, tier: str | None = None) -> list[Member]:
    pairs, out = _pairs(db), []
    for m in _rows(db, row["id"]):
        if tier and m["tier"] != tier:
            continue
        p = pairs.get(m["payment_id"])
        kind = p.kind if p else "duplicate"
        out.append(Member(payment_id=m["payment_id"], customer_masked=mask(m["name"]), amount_paise=m["amount_paise"], captured_at=m["captured_at"] or m["at"], plan=m["plan"] or "", complained=bool(m["complained"]),
                          delivery_outcome=f"Charged twice, {p.gap_seconds} seconds apart" if m["tier"] == "exact" and p else OUTCOME.get(kind, "Looked like a duplicate"), merchant_state=_state(db, m, kind), tier=m["tier"],
                          exclusion_reason=m["exclusion_reason"], replay_eligibility="n/a"))
    return out


def sample(db: sqlite3.Connection, row: sqlite3.Row) -> list[SampleTimeline]:
    mem, said, pairs = _rows(db, row["id"]), complaints_by_payment(db), _pairs(db)
    want = (lambda m: m["tier"] == "exact" and m["complained"], lambda m: m["tier"] == "exact" and not m["complained"],
            lambda m: m["exclusion_reason"] and "seats" in m["exclusion_reason"], lambda m: m["exclusion_reason"] and "failed" in m["exclusion_reason"])
    out = []
    for w in want:
        m = next((x for x in mem if w(x)), None)
        p = pairs.get(m["payment_id"]) if m else None
        if not m or not p:
            continue
        at, first_at = datetime.fromisoformat(m["captured_at"] or m["at"]), p.first_at
        cust = [LaneEvent(at=datetime.fromisoformat(c["received_at"]), text=c["raw_text"], source_ref=c["id"]) for pid in (p.first_id, m["payment_id"]) for c in said.get(pid, [])]
        rz = [LaneEvent(at=first_at, text=f"Payment of ₹{messages.inr(m['amount_paise'])} captured", source_ref=p.first_id)]
        if m["tier"] == "exact":
            rz.append(LaneEvent(at=at, text=f"A second payment of the same amount from the same person, {p.gap_seconds} seconds later", source_ref=m["payment_id"]))
            if (r := _refund(db, m["payment_id"])):
                rz.append(LaneEvent(at=datetime.fromisoformat(r["created_at"]), text=f"Refunded to the original method ({r['id']})" + (f", bank reference {r['arn'] or r['rrn']}" if r["status"] == "processed" else ", pending"), source_ref=r["id"]))
        else:
            rz.append(LaneEvent(at=at, text=m["exclusion_reason"] or "Left out", source_ref=m["payment_id"]))
        oks = db.execute("SELECT o.id, e.entitlement_state FROM orders o LEFT JOIN entitlements e ON e.order_id = o.id WHERE o.id IN (SELECT order_id FROM payments WHERE id IN (?, ?)) ORDER BY o.created_at", (p.first_id, m["payment_id"])).fetchall()
        mer = [LaneEvent(at=ENTITLEMENT_EXPORT_AT, text=f"Order {k + 1}: access record {o['entitlement_state'] or 'none'}", source_ref=o["id"]) for k, o in enumerate(oks)]
        out.append(SampleTimeline(payment_id=m["payment_id"], lanes=ThreeLane(customer=cust, razorpay=rz, merchant=mer)))
    return out


def ray_card(db: sqlite3.Connection, row: sqlite3.Row) -> RayCard:
    v, s = _verdict(row), summary(db, row)
    sl = v.cause_summary_slots
    line = (f"Since {v.onset_at:%a %d %b} {sl['pairs']} customers were charged twice for the same plan, a few seconds apart. All of them used {sl['version']}. "
            f"Both charges reached your server and both orders got access, so only the second charge is wrong.")
    return RayCard(incident_id=row["id"], owner_chip="YOUR SIDE · Code", inferred=False, cause_line=line, affected=s.affected, complained=s.complained, silent=s.silent, fixed=s.fixed,
                   at_risk_paise=s.at_risk_paise, language="en", buttons=["See who was charged twice", "Send to dev"])


def evidence_pack(db: sqlite3.Connection, row: sqlite3.Row, ref: str) -> EvidencePack:
    sig, mem = _sig(row), _rows(db, row["id"])
    return EvidencePack(incident_id=row["id"], ref=ref, endpoint=None, first_failure_at=_dt(sig["first_at"]), last_failure_at=_dt(sig["last_at"]), linked_change=f"app_release {sig['app_version']}",
                        response_excerpt=f"{sig['pairs']} customers placed two orders for the same plan {sig['median_gap']} seconds apart on average, all from {sig['app_version']}. Other versions: {sig['other_version_pairs']}.",
                        affected_events=sig["pairs"], affected_payment_ids=[m["payment_id"] for m in mem if m["tier"] == "exact"], suggested_fix=FIX)


# ---------- the refund screen ----------
def board(db: sqlite3.Connection, row: sqlite3.Row) -> RefundBoard:
    pairs, rows, owed, done = _pairs(db), [], 0, 0
    sent = {r["payment_id"] for r in db.execute("SELECT payment_id FROM messages WHERE template_id = 'T-E1' AND status = 'sent'")}
    for m in _rows(db, row["id"]):
        p = pairs.get(m["payment_id"])
        if m["tier"] != "exact" or not p:
            continue
        r = _refund(db, m["payment_id"])
        owed += 0 if r else m["amount_paise"]
        done += m["amount_paise"] if r else 0
        rows.append(RefundRow(payment_id=m["payment_id"], first_payment_id=p.first_id, customer_masked=mask(m["name"]), amount_paise=m["amount_paise"], method=m["method"], charged_at=datetime.fromisoformat(m["captured_at"] or m["at"]),
                              gap_seconds=p.gap_seconds, complained=bool(m["complained"]), state="ready" if not r else r["status"], refund_id=r["id"] if r else None,
                              ref=(r["arn"] or r["rrn"]) if r and r["status"] == "processed" else None, ref_format=refund.REF_FORMAT[m["method"]] if r and r["status"] == "processed" else None,
                              refunded_at=_dt(r["created_at"]) if r else None, processed_at=_dt(r["processed_at"]) if r else None, messaged=m["payment_id"] in sent))
    from ..act import autonomy

    rows.sort(key=lambda r: (not r.complained, r.charged_at, r.payment_id))  # the order the refund plan runs in: customers who wrote in first
    return RefundBoard(incident_id=row["id"], cap_paise=autonomy.read(db).daily_refund_cap_paise, spent_today_paise=refund.spent_today(db), owed_paise=owed, refunded_paise=done, rows=rows)


# ---------- the fix is checked against Razorpay's refund records and the app's own release ----------
def verify(db: sqlite3.Connection, incident_id: str, actor: str = "system") -> VerifyResult:
    from ..act import executor

    h = merchant_mock.app_health(db)
    g = db.execute("SELECT * FROM actions WHERE incident_id = ? AND action_type = 'refund' AND status != 'reverted'", (incident_id,)).fetchone()
    if not g:
        return VerifyResult(incident_id=incident_id, verified=0, total=0, signal_healthy=h["signal_healthy"], restored_paise=0, closeable=False, line="Nothing has been refunded yet. Plan the refunds, then approve them one customer at a time.")
    now = clock.now().isoformat()
    for it in executor._items(db, g["id"]):
        if it["status"] in ("done", "verified", "verify_failed"):
            db.execute("UPDATE action_items SET status = ?, verified_at = ? WHERE id = ?", ("verified" if refund.check(db, it["payment_id"]) else "verify_failed", now, it["id"]))
    items = executor._items(db, g["id"])
    verified = sum(1 for i in items if i["status"] == "verified")
    returned = db.execute("SELECT COALESCE(SUM(p.amount_paise), 0) FROM action_items i JOIN payments p ON p.id = i.payment_id WHERE i.action_id = ? AND i.status = 'verified'", (g["id"],)).fetchone()[0]
    closeable = verified == len(items) and h["signal_healthy"]
    line = f"{verified} of {len(items)} refunds confirmed in Razorpay's records."
    if closeable:
        line += f" The fixed app has run {int(h['healthy_hours'])} hours with no new double charge. ₹{messages.inr(returned)} returned."
    elif verified < len(items):
        waiting = sum(1 for i in items if i["status"] == "pending")
        bad = len(items) - verified - waiting
        line += (f" {waiting} still to refund. Approve them one customer at a time." if waiting else "") + (f" {bad} could not be checked. Look at them in the list." if bad else "")
    elif h["app_mode"] != "fixed":
        line += " The app still lets the Pay button be tapped twice. Ask your developer to ship the fix, then verify again."
    else:
        line += f" The fixed app has run {h['healthy_hours']} of {merchant_mock.APP_HEALTHY_HOURS} hours. Verify again later."
    executor._set_incident(db, incident_id, "closed" if closeable else "verifying" if verified == len(items) else "fixing")
    if closeable:
        from ..conversation import machine

        machine.resolve_threads(db, incident_id)
    last = db.execute("SELECT payload_json FROM audit_log WHERE kind = 'verify' AND ref_id = ? ORDER BY id DESC LIMIT 1", (incident_id,)).fetchone()
    if not last or json.loads(last["payload_json"])["summary"] != line:
        audit.log(db, actor, "verify", incident_id, line, closeable=closeable)
    return VerifyResult(incident_id=incident_id, verified=verified, total=len(items), signal_healthy=h["signal_healthy"], restored_paise=returned, closeable=closeable, line=line)
