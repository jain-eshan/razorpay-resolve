"""Escalation to Razorpay with an evidence pack (F-26, SPEC 10, FR-AC-10).

Two steps, so nothing leaves without a person: `create` drafts the pack and keeps it (asking again returns the same one), and `send`
is the founder's approval. Sending is the mock: the prototype records "Sent to Razorpay (mock)" with a reference and talks to no one.

The pack is for Razorpay's support desk. It holds payment ids, counts, error codes, the hours and what was ruled out. It never holds a
customer's name, email, phone or a message they wrote: Razorpay can look the payments up itself. Only incidents that Resolve has
put on Razorpay's side can be escalated; one that is the merchant's goes to the merchant's developer instead."""
import json
import sqlite3
from datetime import datetime

from .. import audit, clock
from ..db import write_tx as _write
from ..pipeline import pack_ref
from ..schemas import Escalation
from . import autonomy
from .executor import ActError

SAMPLE = 5


def _row(db: sqlite3.Connection, esc_id: str) -> sqlite3.Row:
    r = db.execute("SELECT * FROM escalations WHERE id = ?", (esc_id,)).fetchone()
    if not r:
        raise ActError(404, f"Escalation {esc_id} not found.")
    return r


def _model(r: sqlite3.Row) -> Escalation:
    return Escalation(id=r["id"], incident_id=r["incident_id"], target=r["target"], ref=r["ref"], status=r["status"], pack=json.loads(r["pack_json"]),
                      created_at=datetime.fromisoformat(r["created_at"]), updated_at=datetime.fromisoformat(r["updated_at"]) if r["updated_at"] else None)


def build_pack(db: sqlite3.Connection, incident_id: str) -> dict:
    inc = db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
    sig, v = json.loads(inc["signature"]), json.loads(inc["verdict_json"])
    ids = [r["payment_id"] for r in db.execute("SELECT payment_id FROM incident_members WHERE incident_id = ? ORDER BY payment_id", (incident_id,))]
    buckets = db.execute(f"""SELECT error_code, error_description, error_source, COUNT(*) AS n FROM payments WHERE id IN ({','.join('?' * len(ids))})
                             GROUP BY 1, 2, 3 ORDER BY n DESC""", ids).fetchall()
    m = db.execute("SELECT id, mid, name, tech_contact FROM merchants LIMIT 1").fetchone()
    graced = db.execute("""SELECT COUNT(*) AS n FROM action_items i JOIN actions a ON a.id = i.action_id
                           WHERE a.incident_id = ? AND a.action_type = 'grant' AND a.status != 'reverted' AND i.status = 'verified'""", (incident_id,)).fetchone()["n"]
    c, n = sig["control"], sig["run_length"]
    first, last = datetime.fromisoformat(sig["first_failure_at"]), datetime.fromisoformat(sig["last_failure_at"])
    return {
        "ref": pack_ref(incident_id),
        "to": "Razorpay merchant support (mock)",
        "merchant": {"id": m["id"], "mid": m["mid"], "name": m["name"].split(" (")[0], "technical_contact": m["tech_contact"]},
        "incident": {"id": incident_id, "title": v["cause_summary_slots"]["title"], "first_failure_at": sig["first_failure_at"], "last_failure_at": sig["last_failure_at"], "resolved_at": sig["resolved_at"]},
        "what_happened": f"{n} {sig['method']} mandate renewals in a row failed between {first:%a %d %b %H:%M} and {last:%a %d %b %H:%M} with {sig['error_code']}. "
                         f"{c.get('renewals', 0)} UPI AutoPay renewals in the same hours went through, {c.get('failed', 0)} failed.",
        "error_buckets": [{"code": b["error_code"], "description": b["error_description"], "source": b["error_source"], "count": b["n"]} for b in buckets],
        "card_networks": sig["networks"],
        "ruled_out": [e["ref"] for e in v["evidence"] if e["kind"] in ("no_change_on_your_side", "no_bank_outage")],
        "payment_ids": ids,
        "sample_payment_ids": ids[:SAMPLE],
        "already_tried": [f"Kept access on for {graced} customers with a grace extension, so nobody is locked out while this is open."] if graced else [],
        "ask": f"Please confirm whether {sig['method']} mandate renewals were failing at the gateway between {first:%H:%M} and {last:%H:%M} on {first:%d %b}, "
               "and whether the failed renewals can be retried without asking each customer to pay again.",
    }


def create(db: sqlite3.Connection, incident_id: str, target: str = "razorpay", actor: str = "merchant:founder") -> Escalation:
    """Draft the pack. One per incident and target: asking again returns the same one, so a double click is safe."""
    with _write(db):
        inc = db.execute("SELECT id, owner, mismatch_type FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        if not inc:
            raise ActError(404, f"Incident {incident_id} not found.")
        if target != "razorpay":
            raise ActError(422, "Only escalation to Razorpay is available here. Your developer gets the evidence pack from the incident page.")
        if inc["owner"] != "razorpay" or inc["mismatch_type"] != "G":
            raise ActError(409, "Resolve has not put this on Razorpay's side, so there is nothing to send them. Send the evidence pack to your own developer.")
        eid = f"esc_{incident_id.removeprefix('INC-')}_{target}"
        if db.execute("SELECT 1 FROM escalations WHERE id = ?", (eid,)).fetchone():
            return _model(_row(db, eid))
        now = clock.now().isoformat()
        pack = build_pack(db, incident_id)
        db.execute("INSERT INTO escalations (id, incident_id, thread_id, target, pack_json, ref, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
                   (eid, incident_id, None, target, json.dumps(pack), pack["ref"], "drafted", now, now))
        audit.log(db, actor, "action", eid, f"Drafted an evidence pack for Razorpay about {incident_id}, reference {pack['ref']}. Nothing has been sent.", incident_id=incident_id)
    return _model(_row(db, eid))


def send(db: sqlite3.Connection, esc_id: str, approver: str) -> Escalation:
    """The founder's approval. The pack is rebuilt first, so 'what was already tried' is true at the moment it goes."""
    if not autonomy.is_person(approver):
        raise ActError(403, "Only a person can send the evidence pack, as 'merchant:' and a name.")
    with _write(db):
        r = _row(db, esc_id)
        if r["status"] != "drafted":
            audit.log(db, approver, "approval", esc_id, f"Ignored a repeat send of {r['ref']}. It was already sent, so nothing changed.", incident_id=r["incident_id"])
            return _model(r)
        now = clock.now().isoformat()
        pack = build_pack(db, r["incident_id"])
        db.execute("UPDATE escalations SET pack_json = ?, status = 'sent', updated_at = ? WHERE id = ?", (json.dumps(pack), now, esc_id))
        audit.log(db, approver, "approval", esc_id, f"Sent the evidence pack {r['ref']} to Razorpay (mock) for {len(pack['payment_ids'])} payments.", incident_id=r["incident_id"])
    return _model(_row(db, esc_id))


def get(db: sqlite3.Connection, esc_id: str) -> Escalation:
    return _model(_row(db, esc_id))


def for_incident(db: sqlite3.Connection, incident_id: str | None = None) -> list[Escalation]:
    return [_model(r) for r in db.execute("SELECT * FROM escalations WHERE target = 'razorpay' AND (? IS NULL OR incident_id = ?) ORDER BY created_at, id", (incident_id, incident_id))]
