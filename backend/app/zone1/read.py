"""Read layer for Zone 1 incidents: the same response models as Hero A, filled from different evidence (SPEC 15, 16).

Hero A's models talk about payments and webhook deliveries. Here nothing was paid, so a "member" is a customer who could not pay (the
customer's id sits where a payment id would be), the chart is orders and pay-page checks by the hour, and the live fix check is the
pay page (or the orders that followed). Every number is computed here from the saved data."""
import json
import sqlite3
from collections import Counter
from datetime import datetime, timedelta

from .. import audit, clock, merchant_mock
from ..act import messages
from ..detect import probe as probe_monitor
from ..schemas import (
    Cluster,
    EvidencePack,
    IncidentDetail,
    IncidentSummary,
    LaneEvent,
    Member,
    ProbeResult,
    RayCard,
    ReplaySummary,
    SampleTimeline,
    ThreeLane,
    TimelineBucket,
    Verdict,
    VerifyResult,
)
from . import recovery
from .baselines import Orders, hour_of

OWNER_CHIP = {"merchant_code": "YOUR SIDE · Code", "merchant_config": "YOUR SIDE · Setup", "unknown": "NOT SURE YET"}
STATE_LABEL = {"ready": "no payment yet", "not_reachable": "no payment yet", "paid_since": "paid since", "link_sent": "link sent", "held_back": "held back", "recovered": "paid"}
FIX = {"ROUTE_NOT_FOUND_AFTER_DEPLOY": "Redirect the old link to the new page (or restore the route), then run the pay page check again.",
       "PAY_PAGE_NOT_FOUND": "Check that the pay page route still exists after the last deploy, then run the pay page check again.",
       "PAY_PAGE_ERROR": "Look at your server logs for the pay page error, then run the pay page check again.",
       "CHECKOUT_KEY_MISMATCH": "Put the new Razorpay key into your checkout, then place one test order and confirm checkout opens.",
       "CHECKOUT_NOT_OPENING": "Open your checkout in a browser with the console open, find the error, then place one test order."}


def _verdict(row: sqlite3.Row) -> Verdict:
    return Verdict.model_validate_json(row["verdict_json"])


def _sig(row: sqlite3.Row) -> dict:
    return json.loads(row["signature"])


def _dt(s: str | None) -> datetime | None:
    return datetime.fromisoformat(s) if s else None


def _people(db: sqlite3.Connection, row: sqlite3.Row) -> list[recovery.Person]:
    return recovery.people(db, row["id"])


def _numbers(v: Verdict, people: list[recovery.Person]) -> dict:
    lost = int(v.cause_summary_slots.get("lost_orders", 0))
    affected = max(lost, len(people))
    complained = sum(1 for p in people if p.complained)
    waiting = [p for p in people if p.state in ("ready", "not_reachable", "link_sent", "held_back")]
    return {"affected": affected, "complained": complained, "silent": affected - complained, "fixed": sum(1 for p in people if p.state in ("paid_since", "recovered")),
            "at_risk_paise": sum(p.amount_paise for p in waiting)}


def summary(db: sqlite3.Connection, row: sqlite3.Row) -> IncidentSummary:
    v = _verdict(row)
    n = _numbers(v, _people(db, row))
    return IncidentSummary(id=row["id"], title=str(v.cause_summary_slots["title"]), zone="before", mismatch_type="Z1", owner=row["owner"], inferred=True, status=row["status"],
                           opened_by=row["opened_by"], onset_at=v.onset_at, would_have_alerted_at=_dt(_sig(row).get("alert_at")), **n)


# ---------- the chart: orders and pay-page checks, hour by hour ----------
def hourly(db: sqlite3.Connection, row: sqlite3.Row, now: datetime | None = None) -> list[dict]:
    now = now or clock.now()
    sig = _sig(row)
    onset, end = datetime.fromisoformat(sig["onset"]), _dt(sig["end"])
    orders = Orders(db, ewma=True)
    lo, hi = hour_of(onset) - timedelta(hours=6), hour_of(min(now, (end or now) + timedelta(hours=3))) + timedelta(hours=1)
    probes = db.execute("SELECT checked_at, http_status, load_ms, checkout_script_present FROM probes WHERE checked_at >= ? AND checked_at < ?", (lo.isoformat(), hi.isoformat())).fetchall()
    said = db.execute("""SELECT c.received_at FROM complaints c JOIN extractions e ON e.complaint_id = c.id WHERE c.received_at >= ? AND c.received_at < ?
                         AND json_extract(e.json, '$.claim') IN ('page_error','checkout_not_opening')""", (lo.isoformat(), hi.isoformat())).fetchall()
    out, h = [], lo
    while h < hi:
        nxt = h + timedelta(hours=1)
        o = orders.between(h, nxt)
        ps = [p for p in probes if h.isoformat() <= p["checked_at"] < nxt.isoformat()]
        out.append({"at": h.isoformat(), "orders": len(o), "expected": round(orders.expected_hour(h) or 0, 1), "zero_attempts": sum(1 for r in o if not r["attempts"]),
                    "probe_checks": len(ps), "probe_failed": sum(1 for p in ps if probe_monitor.failed(p)), "wrote_in": sum(1 for c in said if h.isoformat() <= c["received_at"] < nxt.isoformat())})
        h = nxt
    return out


def _markers(sig: dict, change: str, hour: datetime) -> list[str]:
    nxt = hour + timedelta(hours=1)
    hit = lambda s: s and hour <= datetime.fromisoformat(s) < nxt
    marks = []
    if hit(sig.get("event_at")):
        marks.append(change)
    if hit(sig["onset"]):
        marks.append("pay page starts failing" if sig["kind"] == "probe" else "first order nobody could pay for")
    if hit(sig.get("alert_at")):
        marks.append("alert would fire")
    if sig["end"] and hit(sig["end"]):
        marks.append("works again")
    return marks


def detail(db: sqlite3.Connection, row: sqlite3.Row) -> IncidentDetail:
    from ..act import executor

    v = _verdict(row)
    ppl = _people(db, row)
    s = summary(db, row)
    v.affected_count = s.affected
    sig = _sig(row)
    if v.linked_event_id:
        e = db.execute("SELECT at FROM merchant_events WHERE id = ?", (v.linked_event_id,)).fetchone()
        sig["event_at"] = e["at"] if e else None
    hrs = hourly(db, row)
    v.signature = {**sig, "hourly": hrs, "lost_orders": v.cause_summary_slots.get("lost_orders", 0)}
    buckets = [TimelineBucket(bucket_start=datetime.fromisoformat(h["at"]), ok=h["orders"] - h["zero_attempts"], client_error=0, server_error=0, not_attempted=h["zero_attempts"],
                              markers=_markers(sig, str(v.cause_summary_slots["change"]), datetime.fromisoformat(h["at"]))) for h in hrs]
    ready = sum(1 for p in ppl if p.state == "ready")
    return IncidentDetail(**s.model_dump(), verdict=v, timeline=buckets, lift=[], tier_counts={"exact": ready, "likely": 0, "check": 0, "excluded": len(ppl) - ready},
                          replay=ReplaySummary(incident_id=row["id"], replayable_by_support=0, not_replayable_disabled_window=0, too_old=0, note="Not applicable: nobody had paid, so there is nothing to replay."),
                          actions=executor.summaries(db, row["id"]))


def _said(p: recovery.Person) -> str:
    return f"Wrote on {p.channel.replace('_', ' ') if p.channel else 'no channel'}: \"{p.said}\"" if p.said else "Created an order and never got as far as paying"


def members(db: sqlite3.Connection, row: sqlite3.Row, tier: str | None = None) -> list[Member]:
    out = []
    for p in _people(db, row):
        t = "exact" if p.state == "ready" else "excluded"
        if tier and t != tier:
            continue
        out.append(Member(payment_id=p.customer_id, customer_masked=p.masked, amount_paise=p.amount_paise, captured_at=p.wrote_at, plan=p.plan, complained=p.complained,
                          delivery_outcome=_said(p), merchant_state=STATE_LABEL[p.state], tier=t, exclusion_reason=p.reason, replay_eligibility="n/a"))
    return out


def sample(db: sqlite3.Connection, row: sqlite3.Row) -> list[SampleTimeline]:
    sig, ppl = _sig(row), _people(db, row)
    picks = [next((p for p in ppl if p.complained and p.state == "ready"), None), next((p for p in ppl if not p.complained and p.state == "ready"), None),
             next((p for p in ppl if p.state == "paid_since"), None)]
    out = []
    for p in (x for x in picks if x):
        cust = [LaneEvent(at=p.wrote_at, text=p.said, source_ref=p.case_id)] if p.said else [LaneEvent(at=p.wrote_at, text=f"Opened checkout for {p.plan} and left", source_ref=p.customer_id)]
        rz = [LaneEvent(at=p.wrote_at, text="No payment attempt from this customer in the 6 hours before" if p.complained else "Order created, no payment attempt", source_ref=p.customer_id)]
        if sig["kind"] == "probe":
            chk = db.execute("SELECT * FROM probes WHERE checked_at <= ? ORDER BY checked_at DESC LIMIT 1", (p.wrote_at.isoformat(),)).fetchone()
            mer = [LaneEvent(at=datetime.fromisoformat(chk["checked_at"]), text=f"Pay page check: HTTP {chk['http_status']}" + ("" if chk["checkout_script_present"] else ", no checkout script"), source_ref=chk["id"])] if chk else []
        else:
            mer = [LaneEvent(at=p.wrote_at, text="Pay page check passed: the page loads. Checkout is where it stopped.", source_ref=None)]
        if p.state == "paid_since":
            rz.append(LaneEvent(at=clock.now(), text=p.reason, source_ref=p.customer_id))
        out.append(SampleTimeline(payment_id=p.customer_id, lanes=ThreeLane(customer=cust, razorpay=rz, merchant=mer)))
    return out


def case_lanes(db: sqlite3.Connection, case: sqlite3.Row) -> ThreeLane:
    """One customer's message beside what Razorpay and the merchant's own page show for that moment."""
    at = datetime.fromisoformat(case["received_at"])
    kind = _sig(db.execute("SELECT * FROM incidents WHERE id = ?", (case["incident_id"],)).fetchone())["kind"]
    if kind == "probe":
        chk = db.execute("SELECT * FROM probes WHERE checked_at <= ? ORDER BY checked_at DESC LIMIT 1", (at.isoformat(),)).fetchone()
        mer = [LaneEvent(at=datetime.fromisoformat(chk["checked_at"]), text=f"Pay page check: HTTP {chk['http_status']}" + ("" if chk["checkout_script_present"] else ", no checkout script"), source_ref=chk["id"])] if chk else []
    else:
        mer = [LaneEvent(at=at, text="Pay page check passed: the page loads. Checkout is where it stopped.", source_ref=None)]
    return ThreeLane(customer=[LaneEvent(at=at, text=case["raw_text"], source_ref=case["cid"])],
                     razorpay=[LaneEvent(at=at, text="No payment attempt from this customer in the 6 hours before they wrote", source_ref=case["cid"])], merchant=mer)


def ray_card(db: sqlite3.Connection, row: sqlite3.Row) -> RayCard:
    v, s, sig = _verdict(row), summary(db, row), _sig(row)
    t = f"{v.onset_at:%a %d %b %H:%M}"
    slots = v.cause_summary_slots
    line = (f"Your pay page returned {slots['status']} from {t}. {s.complained} customers wrote in, and Razorpay saw no payment from them." if sig["kind"] == "probe" else
            f"Checkout would not open from {t}. {slots['zero_attempts']} orders were created and nobody could pay for them." if sig["kind"] == "gap" else
            f"Customers started saying they cannot pay from {t}. Nothing else points to a cause yet.")
    return RayCard(incident_id=row["id"], owner_chip=f"INFERRED · {OWNER_CHIP[row['owner']]}", inferred=True, cause_line=line, affected=s.affected, complained=s.complained, silent=s.silent,
                   fixed=s.fixed, at_risk_paise=s.at_risk_paise, language="en", buttons=["View evidence", "Send to dev"])


def evidence_pack(db: sqlite3.Connection, row: sqlite3.Row, ref: str) -> EvidencePack:
    v, sig = _verdict(row), _sig(row)
    last = db.execute("SELECT MAX(checked_at) AS t, COUNT(*) AS n FROM probes WHERE checked_at >= ? AND (http_status >= 400 OR load_ms > 5000 OR checkout_script_present = 0)", (sig["onset"],)).fetchone()
    excerpt = (f"HTTP {sig['first_status']}" + (", no Razorpay checkout script on the page" if sig["first_status"] and sig["first_status"] >= 400 else "")) if sig["kind"] == "probe" else \
        f"Pay page loads. {v.cause_summary_slots['zero_attempts']} orders created, none with a payment attempt."
    return EvidencePack(incident_id=row["id"], ref=ref, endpoint=sig.get("pay_url"), first_failure_at=v.onset_at, last_failure_at=_dt(last["t"]) if sig["kind"] == "probe" else _dt(sig["end"]),
                        linked_change=str(v.cause_summary_slots["change"]) or None, response_excerpt=excerpt, affected_events=last["n"] if sig["kind"] == "probe" else int(v.cause_summary_slots["zero_attempts"]),
                        affected_payment_ids=[], suggested_fix=FIX.get(v.cause_code, "Check what changed on your side around the start time, then run the pay page check again."))


# ---------- the live check, the fix, verify and close ----------
def run_probe(db: sqlite3.Connection) -> ProbeResult:
    """One pay-page check, now. Saved with the others, so the monitors see it too."""
    now, page = clock.now(), merchant_mock.pay_page(db)
    pid = f"probe_{now:%Y%m%d%H%M%S}"
    url = db.execute("SELECT url FROM probes ORDER BY checked_at DESC LIMIT 1").fetchone()
    url = url["url"] if url else "https://kaksha.example/buy"
    db.execute("INSERT OR REPLACE INTO probes (id, merchant_id, url, checked_at, http_status, load_ms, checkout_script_present, note) VALUES (?,?,?,?,?,?,?,?)",
               (pid, "acc_KAKSHA001", url, now.isoformat(), page["status"], page["load_ms"], int(page["checkout_script_present"]), page["note"]))
    ok = page["status"] < 400 and page["load_ms"] <= probe_monitor.SLOW_MS and page["checkout_script_present"]
    return ProbeResult(id=pid, url=url, checked_at=now, http_status=page["status"], load_ms=page["load_ms"], checkout_script_present=page["checkout_script_present"], ok=ok, note=page["note"])


def fix_health(db: sqlite3.Connection, row: sqlite3.Row) -> dict:
    """Has what broke been fixed, and for long enough to trust. The pay page for a page problem, the orders that followed for a checkout problem."""
    sig = _sig(row)
    if sig["kind"] == "probe":
        h = merchant_mock.page_health(db)
        if h["page_mode"] != "ok":
            return {"healthy": False, "hours": 0.0, "line": f"Your pay page still answers {h['page_status']}. Ask your developer to ship the fix, then check again."}
        need = merchant_mock.PAGE_HEALTHY_HOURS
        return {"healthy": h["signal_healthy"], "hours": h["healthy_hours"], "line": f"Your pay page has answered normally for {h['healthy_hours']:g} of {need} hours." if not h["signal_healthy"]
                else f"Your pay page has answered normally for {int(h['healthy_hours'])} hours."}
    end = _dt(sig["end"])
    if sig["kind"] == "gap" and end:
        since = [r for r in Orders(db).rows if r["t"] >= end and r["attempts"]]
        if len(since) >= 3:
            return {"healthy": True, "hours": round((clock.now() - end).total_seconds() / 3600, 1), "line": f"{len(since)} orders since then got a payment attempt. Checkout works again."}
        return {"healthy": False, "hours": 0.0, "line": "Not enough orders since the fix to confirm checkout works. Place a test order."}
    return {"healthy": False, "hours": 0.0, "line": "There is no fix to check yet."}


def recovery_block(db: sqlite3.Connection, row: sqlite3.Row) -> str | None:
    """Why recovery links cannot go out right now, or None. They go out only after the cause is fixed and has stayed fixed."""
    h = fix_health(db, row)
    return None if h["healthy"] else f"Links go out only after the fix is confirmed. {h['line']}"


def verify(db: sqlite3.Connection, incident_id: str, actor: str = "system") -> VerifyResult:
    row = db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    h = fix_health(db, row)
    recovery.settle(db)
    out = recovery.outcome(db, incident_id)
    total, verified = out["sent"] + out["held_back"], out["sent_paid"] + out["held_back_paid"]
    running = db.execute("SELECT 1 FROM actions WHERE incident_id = ? AND action_type = 'recovery_link' AND status IN ('approved','failed')", (incident_id,)).fetchone() is not None
    closeable = h["healthy"] and not running
    line = h["line"]
    if total:
        line += f" Paid since: {verified} of {total} customers, ₹{messages.inr(out['recovered_paise'] + out['paid_anyway_paise'])} in all."
        if out["held_back"]:
            line += f" Held back on purpose: {out['held_back_paid']} of {out['held_back']} paid on their own. Too few customers to say what the link adds." if out["held_back"] < 20 else \
                f" Held back on purpose: {out['held_back_paid']} of {out['held_back']} paid on their own."
    elif closeable:
        line += " No recovery links were sent."
    status = "closed" if closeable else "verifying" if h["healthy"] else "open"
    db.execute("UPDATE incidents SET status = ?, closed_at = ? WHERE id = ?", (status, clock.now().isoformat() if status == "closed" else None, incident_id))
    if closeable:
        from ..conversation import machine

        machine.resolve_threads(db, incident_id)
    last = db.execute("SELECT payload_json FROM audit_log WHERE kind = 'verify' AND ref_id = ? ORDER BY id DESC LIMIT 1", (incident_id,)).fetchone()
    if not last or json.loads(last["payload_json"])["summary"] != line:
        audit.log(db, actor, "verify", incident_id, line, closeable=closeable)
    return VerifyResult(incident_id=incident_id, verified=verified, total=total, signal_healthy=h["healthy"], restored_paise=out["recovered_paise"] + out["paid_anyway_paise"], closeable=closeable, line=line)


def clusters(db: sqlite3.Connection) -> list[Cluster]:
    out = []
    for r in db.execute("SELECT * FROM signals WHERE monitor = 'complaint_spike' ORDER BY onset_at"):
        d = json.loads(r["details"])
        claim = Counter(d["claims"]).most_common(1)[0][0]
        out.append(Cluster(id=r["id"], window_start=datetime.fromisoformat(r["onset_at"]), window_end=datetime.fromisoformat(d["end"]), claim=claim, count=d["count"], unmatched_count=d["unmatched"],
                           unmatched_share=d["unmatched_share"], baseline_rate=d["baseline_per_hour"], lift=d["lift"]))
    return out
