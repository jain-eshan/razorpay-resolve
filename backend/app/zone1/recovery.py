"""Recovery for Zone 1 incidents (SPEC 10.1): who lost a sale, whether Blindspot may message them now, and what happened after.

A customer who could not pay is a member of the incident (incident_members, with the customer's id where a payment id would be: there
is no payment). Whether they can be messaged is worked out fresh each time, because it depends on the clock: WhatsApp allows a free-form
service message only inside 24 hours of the customer's last message. Instagram has no adapter yet. A customer who never wrote has not
given permission, so Blindspot stays silent.

Offers live in `recovery_offers`; the id is `ro:<incident>:<customer>` so the customer can be read back. Holdout offers record who was
deliberately not messaged, to measure what the link adds. The behaviour that decides whether a simulated customer pays after a link is
synthetic and labelled so (settings key sim.recovery, written by the world generator)."""
import hashlib
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta

from .. import audit, clock
from ..act import messages
from ..widen.silent import mask

WHATSAPP_WINDOW = timedelta(hours=24)
LINK_HOURS = 48          # how long a recovery link stays valid
MIN_FOR_HOLDOUT = 5      # below this a holdout would leave nobody to message


@dataclass
class Person:
    customer_id: str
    masked: str
    amount_paise: int
    plan: str
    complained: bool
    channel: str | None
    last_inbound_at: datetime | None
    case_id: str | None
    said: str
    wrote_at: datetime   # when they wrote in, or when the order nobody could pay for was created
    state: str           # ready | not_reachable | paid_since | link_sent | held_back | recovered
    reason: str | None


def contact_rule(channel: str | None, last_inbound: datetime | None, now: datetime) -> str | None:
    """None when a message may go out now, otherwise the plain reason it may not."""
    if channel is None or last_inbound is None:
        return "They never wrote to you, so there is no permission to message them."
    if channel == "whatsapp_payments":
        closes = last_inbound + WHATSAPP_WINDOW
        return None if now <= closes else f"WhatsApp's 24 hour window closed {closes:%a %H:%M}."
    if channel in ("email", "help_button"):
        return None
    if channel == "ig_dm":
        return "Instagram replies arrive in a later release."
    return "There is no way to reply on this channel."


def offer_id(incident_id: str, customer_id: str) -> str:
    return f"ro:{incident_id}:{customer_id}"


def _behaviour(db: sqlite3.Connection) -> dict:
    r = db.execute("SELECT value FROM settings WHERE key = 'sim.recovery'").fetchone()
    return json.loads(r["value"]) if r else {"link": {}, "organic": {}}


def due(db: sqlite3.Connection, offer: sqlite3.Row, now: datetime) -> bool:
    """Has this customer paid by now. A stored paid_at wins; otherwise the simulated behaviour says when they would have."""
    if offer["paid_at"]:
        return True
    cid = offer["id"].split(":", 2)[2]
    delay = _behaviour(db)["organic" if offer["holdout"] else "link"].get(cid)
    return delay is not None and datetime.fromisoformat(offer["sent_at"]) + timedelta(hours=delay) <= now


def people(db: sqlite3.Connection, incident_id: str, now: datetime | None = None) -> list[Person]:
    now = now or clock.now()
    offers = {r["id"].split(":", 2)[2]: r for r in db.execute("SELECT * FROM recovery_offers WHERE incident_id = ?", (incident_id,))}
    out = []
    for m in db.execute("SELECT * FROM incident_members WHERE incident_id = ? ORDER BY complained DESC, rowid", (incident_id,)).fetchall():
        c = db.execute("SELECT * FROM customers WHERE id = ?", (m["payment_id"],)).fetchone()
        cm = db.execute("SELECT cm.* FROM cases cs JOIN complaints cm ON cm.id = cs.complaint_id WHERE cs.id = ?", (m["case_id"],)).fetchone() if m["case_id"] else None
        ex = json.loads(db.execute("SELECT json FROM extractions WHERE complaint_id = ?", (cm["id"],)).fetchone()["json"]) if cm else {}
        plan = ex.get("product_or_plan") or (db.execute("SELECT pl.name FROM orders o JOIN plans pl ON pl.id = o.plan_id WHERE o.customer_id = ? ORDER BY o.created_at DESC LIMIT 1", (m["payment_id"],)).fetchone() or {"name": "your plan"})["name"]
        channel, at = (cm["channel"], datetime.fromisoformat(cm["received_at"])) if cm else (None, None)
        order = None if cm else db.execute("SELECT created_at FROM orders WHERE customer_id = ? AND attempts = 0 ORDER BY created_at DESC LIMIT 1", (m["payment_id"],)).fetchone()
        wrote_at = at or (datetime.fromisoformat(order["created_at"]) if order else now)
        offer = offers.get(m["payment_id"])
        if m["tier"] == "excluded":
            state, reason = "paid_since", m["exclusion_reason"]
        elif offer and due(db, offer, now):
            state, reason = "recovered", "Paid after the held-back period" if offer["holdout"] else "Paid through the recovery link"
        elif offer and offer["holdout"]:
            state, reason = "held_back", "Held back on purpose, to measure what the link adds"
        elif offer:
            state, reason = "link_sent", "Link sent, nothing paid yet"
        elif (why := contact_rule(channel, at, now)):
            state, reason = "not_reachable", why
        else:
            state, reason = "ready", None
        out.append(Person(m["payment_id"], mask(c["name"]), m["amount_paise"], plan, bool(m["complained"]), channel, at, m["case_id"], cm["redacted_text"] if cm else "", wrote_at, state, reason))
    return out


def holdout_ids(customer_ids: list[str], incident_id: str, percent: int) -> list[str]:
    """Who is held back: the same customers every time the plan is drawn, picked by a hash so nobody chooses."""
    n = len(customer_ids)
    k = 0 if percent <= 0 or n < MIN_FOR_HOLDOUT else max(1, round(n * percent / 100))
    return sorted(customer_ids, key=lambda c: hashlib.sha256(f"{incident_id}|holdout|{c}".encode()).hexdigest())[:k]


def slots(db: sqlite3.Connection, p: Person, hours: int = LINK_HOURS) -> dict:
    c = db.execute("SELECT c.name, c.language_pref, m.name AS merchant FROM customers c, merchants m WHERE c.id = ?", (p.customer_id,)).fetchone()
    return {"first_name": c["name"].split()[0], "merchant": c["merchant"].split(" (")[0], "amount": messages.inr(p.amount_paise), "hours": hours,
            "_lang": c["language_pref"] if c["language_pref"] in messages.LANGS else "en"}


def outcome(db: sqlite3.Connection, incident_id: str, now: datetime | None = None) -> dict:
    """What the links did, against the customers deliberately not messaged. Counts first: with a handful of customers a rate means little."""
    now = now or clock.now()
    offers = db.execute("SELECT * FROM recovery_offers WHERE incident_id = ?", (incident_id,)).fetchall()
    t = [o for o in offers if not o["holdout"]]
    h = [o for o in offers if o["holdout"]]
    tp = [o for o in t if due(db, o, now)]
    hp = [o for o in h if due(db, o, now)]
    return {"sent": len(t), "sent_paid": len(tp), "held_back": len(h), "held_back_paid": len(hp), "recovered_paise": sum(o["amount_paise"] for o in tp),
            "paid_anyway_paise": sum(o["amount_paise"] for o in hp)}


def settle(db: sqlite3.Connection, now: datetime | None = None) -> int:
    """Write down every payment that is due by now. Called when the clock moves and when an incident is verified."""
    now = now or clock.now()
    n = 0
    for o in db.execute("SELECT * FROM recovery_offers WHERE paid_at IS NULL AND sent_at IS NOT NULL").fetchall():
        if due(db, o, now):
            cid = o["id"].split(":", 2)[2]
            delay = _behaviour(db)["organic" if o["holdout"] else "link"][cid]
            paid_at = datetime.fromisoformat(o["sent_at"]) + timedelta(hours=delay)
            db.execute("UPDATE recovery_offers SET paid_at = ? WHERE id = ?", (paid_at.isoformat(), o["id"]))
            audit.log(db, "system", "action", o["incident_id"], f"A customer paid ₹{messages.inr(o['amount_paise'])}" + (" without a link (held back)." if o["holdout"] else " through the recovery link."),
                      offer=o["id"], simulated=True)
            n += 1
    return n
