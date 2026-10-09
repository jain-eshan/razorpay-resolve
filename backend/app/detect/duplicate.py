"""Duplicate-charge monitor (F-03, v1 FR-DG-3 and J2): one customer charged twice for the same thing, a few seconds apart.

A candidate is two payments with the same payer contact and the same amount, less than 2 minutes apart, the first captured. Each is then
sorted by what is on the two orders:
- duplicate: both orders are for the same person and the same plan, and the second payment was captured. The second charge is owed back.
- two seat: the orders are for two different people (a second seat for a friend). Both were fulfilled, nothing is owed.
- second failed: the second attempt failed after the bank debited it. The bank puts the money back by itself, so it is not a capture.
- refunded: the second charge was already refunded by the merchant. (A refund Blindspot made keeps the pair a duplicate, so a rerun cannot lose the incident.)

Only duplicates count towards an incident. An incident needs at least 3 of them from one app version, and none of that version's
duplicates before its release: one stray double tap on a slow phone is not an incident, and a pattern that starts at a release is the merchant's code.
"""
import sqlite3
from dataclasses import dataclass
from datetime import datetime

MIN_PAIRS = 3
MAX_GAP_SECONDS = 120


@dataclass
class Pair:
    first_id: str
    second_id: str
    kind: str                   # duplicate | two_seat | second_failed | refunded
    amount_paise: int
    gap_seconds: int
    first_at: datetime
    second_at: datetime         # when the second charge went through (or was attempted)
    app_version: str
    plan: str
    customer_id: str


@dataclass
class Run:
    app_version: str
    pairs: list[Pair]           # the duplicates
    excluded: list[Pair]        # the look-alikes, with their kind
    first_at: datetime
    last_at: datetime
    alert_at: datetime          # the MIN_PAIRS-th duplicate, the first moment a live monitor could have raised it
    release_id: str | None
    release_at: datetime | None
    orders_on_version: int      # orders created on this app version since the release
    other_version_pairs: int    # duplicates on every other app version
    other_version_orders: int
    median_gap: int = 0

    @property
    def after_release(self) -> bool:
        return self.release_at is not None and self.release_at <= self.first_at


def _t(s: str) -> datetime:
    return datetime.fromisoformat(s)


def candidates(db: sqlite3.Connection) -> list[Pair]:
    rows = db.execute("""
        SELECT p1.id AS a, p2.id AS b, p1.created_at AS a_at, p2.created_at AS b_at, p2.captured_at AS b_cap, p2.status AS b_status, p2.error_reason AS b_reason, p2.amount_paise AS amount,
               o1.customer_id AS c1, o2.customer_id AS c2, o1.plan_id AS plan1, o2.plan_id AS plan2, o1.client_app_version AS version, pl.name AS plan_name
        FROM payments p1 JOIN payments p2 ON p2.contact = p1.contact AND p2.amount_paise = p1.amount_paise AND p2.id != p1.id AND p2.created_at > p1.created_at
        JOIN orders o1 ON o1.id = p1.order_id JOIN orders o2 ON o2.id = p2.order_id LEFT JOIN plans pl ON pl.id = o1.plan_id
        WHERE p1.status = 'captured' AND p1.is_renewal = 0 AND p2.is_renewal = 0 AND o1.id != o2.id
          AND (julianday(p2.created_at) - julianday(p1.created_at)) * 86400 < ?
        ORDER BY p2.created_at, p2.id""", (MAX_GAP_SECONDS,)).fetchall()
    out = []
    for r in rows:
        rf = db.execute("SELECT source FROM refunds WHERE payment_id = ? LIMIT 1", (r["b"],)).fetchone()
        refunded = (rf is not None and rf["source"] != "make_good") or (rf is None and r["b_status"] == "refunded")  # a refund Blindspot made stays part of the incident
        if r["b_status"] == "failed":
            if r["b_reason"] != "debit_reversal_pending":  # an ordinary failed retry moves no money, so there is nothing to sort
                continue
            kind = "second_failed"
        elif refunded:
            kind = "refunded"
        elif r["c1"] == r["c2"] and r["plan1"] == r["plan2"]:
            kind = "duplicate"
        else:
            kind = "two_seat"
        a_at, b_at = _t(r["a_at"]), _t(r["b_at"])
        out.append(Pair(first_id=r["a"], second_id=r["b"], kind=kind, amount_paise=r["amount"], gap_seconds=round((b_at - a_at).total_seconds()), first_at=a_at,
                        second_at=_t(r["b_cap"]) if r["b_cap"] else b_at, app_version=r["version"] or "unknown", plan=r["plan_name"] or "", customer_id=r["c2"]))
    return out


def find(db: sqlite3.Connection) -> list[Run]:
    pairs = candidates(db)
    out = []
    for version in sorted({p.app_version for p in pairs if p.kind == "duplicate"}):
        mine = sorted((p for p in pairs if p.kind == "duplicate" and p.app_version == version), key=lambda p: p.second_at)
        if len(mine) < MIN_PAIRS:
            continue
        rel = db.execute("SELECT id, at FROM merchant_events WHERE kind = 'app_release' AND label = ? ORDER BY at DESC LIMIT 1", (version,)).fetchone()
        release_at = _t(rel["at"]) if rel else None
        since = release_at or mine[0].first_at
        excluded = sorted((p for p in pairs if p.kind != "duplicate" and p.second_at >= since), key=lambda p: p.second_at)  # the look-alikes since the release, kept as left-out rows
        on_version = db.execute("SELECT COUNT(*) FROM orders WHERE client_app_version = ? AND created_at >= ?", (version, since.isoformat())).fetchone()[0]
        other_orders = db.execute("SELECT COUNT(*) FROM orders WHERE client_app_version != ? AND created_at >= ?", (version, since.isoformat())).fetchone()[0]
        other_pairs = sum(1 for p in pairs if p.kind == "duplicate" and p.app_version != version)
        gaps = sorted(p.gap_seconds for p in mine)
        out.append(Run(app_version=version, pairs=mine, excluded=excluded, first_at=mine[0].second_at, last_at=mine[-1].second_at, alert_at=mine[MIN_PAIRS - 1].second_at,
                       release_id=rel["id"] if rel else None, release_at=release_at, orders_on_version=on_version, other_version_pairs=other_pairs, other_version_orders=other_orders,
                       median_gap=gaps[len(gaps) // 2]))
    return sorted(out, key=lambda r: r.first_at)
