"""Complaint spike (SPEC 6.2): customers writing in about paying, far more often than normal, and with no payment of theirs to point at.

Counts complaints whose claim is a payment that would not go through, a page that would not load, or a checkout that would not open, in
a 60-minute window, against how often that happens normally (Poisson upper tail below 0.01, at least 3). Then asks whether each person
has any payment attempt of their own in the 6 hours before they wrote:
- Mostly no (share without one at 0.6 or more): the customer never reached Razorpay. This is a Zone 1 candidate.
- Mostly yes, and the failures sit inside a bank outage: it is the bank (attribution row 7). Not Zone 1.
- Mostly yes otherwise: the customers' own side (a declined card). Not Zone 1."""
import hashlib
import json
import sqlite3
from collections import Counter
from datetime import datetime, timedelta

from ..zone1.signal import Signal, grid
from ..zone1.stats import poisson_sf

SPIKE_CLAIMS = ("payment_failed", "page_error", "checkout_not_opening")
WINDOW, LOOKBACK = timedelta(minutes=60), timedelta(hours=6)
MIN_COUNT, MAX_P, FLOOR_PER_HOUR, UNMATCHED = 3, 0.01, 0.05, 0.6


def token_of(phone: str) -> str:
    return "tok_" + hashlib.sha1(phone.encode()).hexdigest()[:8]


def load(db: sqlite3.Connection) -> list[dict]:
    """Every complaint that reads as a payment problem, with who wrote it when the sender is a known customer."""
    who = {token_of(r["phone"]): r["id"] for r in db.execute("SELECT id, phone FROM customers")}
    out = []
    for r in db.execute("SELECT c.*, e.json AS ex, cs.id AS case_id FROM complaints c JOIN extractions e ON e.complaint_id = c.id LEFT JOIN cases cs ON cs.complaint_id = c.id ORDER BY c.received_at"):
        x = json.loads(r["ex"])
        if x["claim"] in SPIKE_CLAIMS:
            out.append({"id": r["id"], "case_id": r["case_id"], "t": datetime.fromisoformat(r["received_at"]), "channel": r["channel"], "customer_id": who.get(r["from_handle"]),
                        "claim": x["claim"], "amount_paise": x["amount_paise"], "plan": x["product_or_plan"], "handle": r["from_handle"]})
    return out


def own_attempts(db: sqlite3.Connection, c: dict) -> list[sqlite3.Row]:
    if not c["customer_id"]:
        return []
    return db.execute("SELECT * FROM payments WHERE customer_id = ? AND created_at >= ? AND created_at <= ?", (c["customer_id"], (c["t"] - LOOKBACK).isoformat(), c["t"].isoformat())).fetchall()


def _routed(db: sqlite3.Connection, attempts: list[sqlite3.Row]) -> str:
    """Where a cluster of complaints with payment attempts belongs. Bank when the failures sit in a bank outage window."""
    failed = [p for p in attempts if p["status"] == "failed"]
    if failed and all(p["error_source"] == "bank" for p in failed):
        for p in failed:
            if not db.execute("SELECT 1 FROM downtime_events WHERE method = ? AND issuer = ? AND started_at <= ? AND ended_at >= ?", (p["method"], p["issuer"], p["created_at"], p["created_at"])).fetchone():
                return "customer_or_unknown"
        return "bank"
    return "customer_or_unknown"


def find(db: sqlite3.Connection, now: datetime, complaints: list[dict] | None = None, max_p: float = MAX_P) -> list[Signal]:
    cs = complaints if complaints is not None else load(db)
    if not cs:
        return []
    out: list[Signal] = []
    streak: list[tuple[datetime, list[dict]]] = []
    for t in list(grid(cs[0]["t"], now)) + [now + timedelta(days=1)]:
        win = [c for c in cs if t - WINDOW < c["t"] <= t] if t <= now else []
        past = sum(1 for c in cs if t - WINDOW - timedelta(days=7) <= c["t"] <= t - WINDOW)
        lam = max(past / (7 * 24), FLOOR_PER_HOUR)
        if len(win) >= MIN_COUNT and poisson_sf(len(win), lam) < max_p:
            streak.append((t, win))
            continue
        if streak:
            members = {c["id"]: c for _, w in streak for c in w}.values()
            members = sorted(members, key=lambda c: c["t"])
            attempts = {c["id"]: own_attempts(db, c) for c in members}
            unmatched = sum(1 for c in members if not attempts[c["id"]])
            share = unmatched / len(members)
            routed = "zone1" if share >= UNMATCHED else _routed(db, [p for a in attempts.values() for p in a])
            lam0 = max(sum(1 for c in cs if streak[0][0] - WINDOW - timedelta(days=7) <= c["t"] <= streak[0][0] - WINDOW) / (7 * 24), FLOOR_PER_HOUR)
            out.append(Signal("complaint_spike", members[0]["t"], members[-1]["t"], streak[0][0], 1 if routed == "zone1" else 0,
                              {"count": len(members), "unmatched": unmatched, "unmatched_share": round(share, 2), "routed": routed, "claims": dict(Counter(c["claim"] for c in members)),
                               "channels": dict(Counter(c["channel"] for c in members)), "complaint_ids": [c["id"] for c in members], "baseline_per_hour": round(lam0, 3),
                               "lift": round(len(members) / max(lam0, FLOOR_PER_HOUR), 1)}, zone1=routed == "zone1"))
        streak = []
    return out
