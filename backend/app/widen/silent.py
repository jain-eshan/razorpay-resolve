"""Silent-victim search (F-33): from one failure signature to every affected payment, tiered, with reasons for exclusions.

Tiers: exact (Razorpay and the merchant's record both confirm), likely (Razorpay signal, no merchant row), check (conflicting),
excluded (with a stated reason). Replay eligibility follows Razorpay's documented limits (SPEC section 8).
"""
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta

from ..detect.access import mismatch
from ..detect.webhook import HANDLER, Run

REPLAY_MAX_AGE_DAYS = 15
RECONCILE_DELAY = timedelta(minutes=30)


@dataclass
class Member:
    payment_id: str
    event_id: str
    customer_id: str
    customer_masked: str
    amount_paise: int
    captured_at: str
    plan: str
    complained: bool
    delivery_outcome: str
    merchant_state: str
    tier: str
    exclusion_reason: str | None
    replay_eligibility: str
    kind: str


def mask(name: str) -> str:
    first, _, last = name.partition(" ")
    return f"{first[:1]}. {last[:1]}{'*' * max(len(last) - 1, 1)}"


def replay_eligibility(event_created: str, disabled_at: str | None, now: datetime) -> str:
    created = datetime.fromisoformat(event_created)
    if disabled_at and created >= datetime.fromisoformat(disabled_at):
        return "not_replayable_disabled_window"
    if now - created > timedelta(days=REPLAY_MAX_AGE_DAYS):
        return "too_old"
    return "replayable_by_support"


def _ent(db: sqlite3.Connection, p: dict) -> dict | None:
    if p["subscription_id"]:
        r = db.execute("SELECT * FROM entitlements WHERE subscription_id = ?", (p["subscription_id"],)).fetchone()
    else:
        r = db.execute("SELECT * FROM entitlements WHERE order_id = ?", (p["order_id"],)).fetchone()
    return dict(r) if r else None


def _member(db, p, ev, run_class: str, complained: bool, disabled_at, now, export_at) -> Member:
    ent = _ent(db, p)
    kind = mismatch(p, ent)
    refunded = db.execute("SELECT 1 FROM refunds WHERE payment_id = ? AND status IN ('processed','pending')", (p["id"],)).fetchone() is not None
    manual = ent is not None and ent["source"] == "manual" and ent["entitlement_state"] == "active"
    restored = ent is not None and ent["source"] == "make_good_grant" and ent["entitlement_state"] == "active"
    reason = None
    if refunded:
        tier, reason = "excluded", "refunded"
    elif manual:
        tier, reason = "excluded", "already active (manual grant)"
    elif restored:
        tier, reason = "excluded", "restored by Resolve"
    elif kind in ("unpaid", "access_cut"):
        tier = "exact"
    elif kind == "no_row":
        tier = "likely"
    elif kind == "not_extended":
        tier = "check"
    else:
        tier, reason = "excluded", "already active"
    plan = db.execute("SELECT pl.name FROM orders o JOIN plans pl ON pl.id = o.plan_id WHERE o.id = ?", (p["order_id"],)).fetchone() if p["order_id"] else None
    cust = db.execute("SELECT name FROM customers WHERE id = ?", (p["customer_id"],)).fetchone()
    return Member(
        payment_id=p["id"], event_id=ev["id"], customer_id=p["customer_id"], customer_masked=mask(cust["name"]), amount_paise=p["amount_paise"],
        captured_at=p["captured_at"], plan=plan["name"] if plan else "Premium Monthly", complained=complained, delivery_outcome=run_class,
        merchant_state=(ent["entitlement_state"] if ent else "no record"), tier=tier, exclusion_reason=reason,
        replay_eligibility=replay_eligibility(ev["created_at"], disabled_at, now) if run_class != "2xx, access not granted" else "n/a", kind=kind or "none",
    )


def build_cohort(db: sqlite3.Connection, run: Run, disabled_at: str | None, now: datetime, export_at: datetime, complaints: dict) -> list[Member]:
    members: list[Member] = []
    seen: set[str] = set()
    for eid in run.bad_event_ids:
        ev = dict(db.execute("SELECT * FROM webhook_events WHERE id = ?", (eid,)).fetchone())
        p = dict(db.execute("SELECT * FROM payments WHERE id = ?", (ev["payment_id"],)).fetchone())
        outcome = "not attempted (webhook off, as Razorpay's docs describe)" if ev["final_delivery_class"] == "not_attempted_disabled" else "401, retried until Razorpay stopped" if ev["final_delivery_class"] == "4xx" else ev["final_delivery_class"]
        members.append(_member(db, p, ev, outcome, p["id"] in complaints, disabled_at, now, export_at))
        seen.add(p["id"])
    # delivered with a 2xx but the merchant's record shows no access (needs the access records)
    q = f"SELECT p.*, e.id AS eid, e.created_at AS ecreated FROM payments p JOIN webhook_events e ON e.payment_id = p.id AND {HANDLER} WHERE p.status IN ('captured','refunded') AND e.final_delivery_class = '2xx' AND p.captured_at >= ? AND p.captured_at <= ?"
    for r in db.execute(q, (run.first_bad_at.isoformat(), (export_at - RECONCILE_DELAY).isoformat())).fetchall():
        p = dict(r)
        ent = _ent(db, p)
        restored = ent is not None and ent["source"] == "make_good_grant"  # still part of the incident once Resolve has restored them
        if p["id"] in seen or (mismatch(p, ent) not in ("unpaid", "no_row") and not restored):
            continue
        ev = {"id": p["eid"], "created_at": p["ecreated"]}
        members.append(_member(db, p, ev, "2xx, access not granted", p["id"] in complaints, disabled_at, now, export_at))
    return sorted(members, key=lambda m: m.captured_at)
