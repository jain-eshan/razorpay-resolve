"""Refunds for duplicate charges (F-39, FR-AC-7), against Razorpay's Refunds API, mocked. The only code in Blindspot that returns money.

Rules held here, each with a test:
- A refund goes to the original payment method. The `refunds` table has no destination column and this file takes none.
- Only a payment that the duplicate monitor put in the Exact tier of an incident can be refunded, and only for its full amount.
- A person approves every refund, one customer at a time. An approver that is not a person (the autonomy setting, a script) is refused.
- A daily cap bounds what can go out in one day. The refund that would pass it is refused and the rest of the day's refunds stand.
- One refund per payment. The payment turns `refunded`, so a second attempt finds nothing to refund.
- A refund cannot be undone. The bank reference (RRN for UPI and netbanking, ARN for cards) appears only once the refund is processed.
"""
import hashlib
import sqlite3
from datetime import datetime, timedelta

from .. import audit, clock
from . import autonomy, messages

HOURS_TO_PROCESS = {"upi": 2, "netbanking": 24, "card": 72}   # how long the mocked refund stays pending on the demo clock
WINDOW = {"upi": "3 working days", "netbanking": "5 working days", "card": "7 working days"}  # what the customer is told to expect
REF_FORMAT = {"upi": "RRN", "netbanking": "RRN", "card": "ARN"}


class RefundBlocked(PermissionError):
    """A rule stopped the refund. The message says which, in words the founder can act on."""


def _digits(seed: str, n: int) -> str:
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    return str(h)[:n].rjust(n, "0")


def refund_id(payment_id: str) -> str:
    return "rfnd_" + hashlib.sha256(payment_id.encode()).hexdigest()[:14]


def spent_today(db: sqlite3.Connection) -> int:
    """Paise Blindspot refunded on the current day of the demo clock."""
    day = clock.now().date().isoformat()
    return db.execute("SELECT COALESCE(SUM(amount_paise), 0) FROM refunds WHERE source = 'make_good' AND substr(created_at, 1, 10) = ?", (day,)).fetchone()[0]


def blocked(db: sqlite3.Connection, payment_id: str, incident_id: str) -> str | None:
    """Why this refund cannot go out right now, in words the founder can act on. None means it can."""
    p = db.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
    member = db.execute("SELECT tier FROM incident_members WHERE incident_id = ? AND payment_id = ?", (incident_id, payment_id)).fetchone()
    if not p or not member or member["tier"] != "exact":
        return f"{payment_id} is not a confirmed duplicate in {incident_id}, so it cannot be refunded."
    if p["status"] != "captured" or db.execute("SELECT 1 FROM refunds WHERE payment_id = ?", (payment_id,)).fetchone():
        return f"{payment_id} has already been refunded, or was never captured."
    cap, spent = autonomy.read(db).daily_refund_cap_paise, spent_today(db)
    if spent + p["amount_paise"] > cap:
        return f"Today's refund limit is ₹{messages.inr(cap)}. ₹{messages.inr(spent)} is already refunded today, so this ₹{messages.inr(p['amount_paise'])} waits for tomorrow or a higher limit in settings."
    return None


def issue(db: sqlite3.Connection, payment_id: str, approver: str, incident_id: str) -> dict:
    """Refund one duplicate in full to its original method. Raises RefundBlocked with the reason when a rule says no."""
    if not autonomy.is_person(approver):
        raise RefundBlocked("A refund needs a person's approval, one customer at a time. It never runs on its own.")
    if reason := blocked(db, payment_id, incident_id):
        raise RefundBlocked(reason)
    p = db.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
    rid = refund_id(payment_id)
    db.execute("INSERT INTO refunds (id, payment_id, amount_paise, status, arn, rrn, speed, created_at, processed_at, source) VALUES (?,?,?,?,?,?,?,?,?,?)",
               (rid, payment_id, p["amount_paise"], "pending", None, None, "normal", clock.now().isoformat(), None, "make_good"))
    db.execute("UPDATE payments SET status = 'refunded' WHERE id = ?", (payment_id,))
    audit.log(db, approver, "action", payment_id, f"Refunded ₹{messages.inr(p['amount_paise'])} to the original {p['method']} method. Refund {rid}. This cannot be undone.", incident_id=incident_id, refund_id=rid)
    return {"refund_id": rid}


def check(db: sqlite3.Connection, payment_id: str) -> bool:
    """The refund exists, for the full amount, and has not failed. What 'verified' means for a refund."""
    r = db.execute("SELECT r.status, r.amount_paise, p.amount_paise AS paid FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE r.payment_id = ?", (payment_id,)).fetchone()
    return r is not None and r["status"] in ("pending", "processed") and r["amount_paise"] == r["paid"]


def settle(db: sqlite3.Connection, now: datetime) -> int:
    """Move refunds from pending to processed once enough time has passed on the demo clock, and give them their bank reference. Safe to call any time."""
    n = 0
    for r in db.execute("SELECT r.*, p.method FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE r.status = 'pending' AND r.source = 'make_good'").fetchall():
        done = datetime.fromisoformat(r["created_at"]) + timedelta(hours=HOURS_TO_PROCESS.get(r["method"], max(HOURS_TO_PROCESS.values())))
        if now >= done:
            card = r["method"] == "card"
            db.execute("UPDATE refunds SET status = 'processed', processed_at = ?, arn = ?, rrn = ? WHERE id = ?",
                       (done.isoformat(), _digits(r["id"], 23) if card else None, None if card else _digits(r["id"], 12), r["id"]))
            n += 1
    return n


def reference(db: sqlite3.Connection, payment_id: str) -> dict | None:
    """The refund as the customer is told about it. None until the bank reference exists."""
    r = db.execute("SELECT r.*, p.method FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE r.payment_id = ?", (payment_id,)).fetchone()
    if not r or r["status"] != "processed":
        return None
    return {"refund_id": r["id"], "ref": r["arn"] or r["rrn"], "ref_format": REF_FORMAT[r["method"]], "refund_date": datetime.fromisoformat(r["created_at"]), "window": WINDOW[r["method"]]}
