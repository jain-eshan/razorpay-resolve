"""J6 world (V1 8.3): UPI AutoPay renewals that failed for insufficient funds while the customer kept access.

Applied last, with its own random stream, so nothing earlier moves. The merchant's own rule is 48 hours of grace after a failed
renewal. Nine customers failed more than 48 hours ago and still have access (the report). Five failed and were cut when the rule ran
out (correct), three paid again on their own, four failed within the last 48 hours (not yet past the rule), and two failed on the bank's
side with access on (the customer owes nothing). Nobody complains about free access, so there are no complaints here.
"""
from __future__ import annotations

import csv
import sqlite3
from datetime import timedelta
from pathlib import Path

from .renewals import ENDPOINT, ENT_COLS, MID
from .world import FAILS, FIRST, ISSUERS, LAST, UPI_APPS, Rng, T, iso


def apply(cfg: dict, world: sqlite3.Connection, truth: sqlite3.Connection, out: Path) -> dict:
    z = cfg["leakage"]
    rng = Rng(cfg["seed"] + 6006)
    plan = next(p for p in cfg["plans"] if p["id"] == "plan_monthly_299")
    grace = timedelta(hours=cfg["merchant"]["grace_hours_after_failed_renewal"])
    export_at = T(cfg["entitlement_export_at"])
    people, subs, pays, events, deliveries, ents, states = [], [], [], [], [], [], []
    insufficient = next(f for f in FAILS if f[4] == "insufficient_funds")
    bank_side = next(f for f in FAILS if f[2] == "bank")

    def at_past() -> object:
        p = z["past_grace"]
        day = T(p["from"]) + timedelta(days=rng.randrange((T(p["to"]) - T(p["from"])).days + 1))
        return day + timedelta(hours=rng.randrange(*p["hours"]), minutes=rng.randrange(60), seconds=rng.randrange(60))

    def at_inside() -> object:
        lo, hi = (T(x) for x in z["inside_window"])
        return lo + timedelta(seconds=rng.randrange(int((hi - lo).total_seconds())))

    def renewal(state: str, when, err, access: str, paid_back: bool = False) -> None:
        i = len(people)
        f, l = rng.choice(FIRST), rng.choice(LAST)
        c = dict(id=f"cust_l{i:04d}", merchant_id=MID, name=f"{f} {l}", email=f"{f.lower()}.{l.lower()}l{i}@example.test", phone=f"+9190002{i:05d}", vpa=f"{f.lower()}l{i}@fakebank",
                 language_pref="hi_latn" if rng.random() < 0.65 else "en", created_at=iso(when - timedelta(days=rng.randrange(40, 200))))
        people.append(c)
        sid = rng.rid("sub_")
        subs.append(dict(id=sid, merchant_id=MID, customer_id=c["id"], plan_id=plan["id"], method="upi_autopay", status="active", current_start=iso(when - timedelta(days=30)),
                         current_end=iso(when), created_at=iso(when - timedelta(days=60))))

        def payment(at, ok: bool) -> dict:
            p = dict(id=rng.rid("pay_"), merchant_id=MID, order_id=None, subscription_id=sid, customer_id=c["id"], amount_paise=plan["amount_paise"], currency="INR", method="upi",
                     issuer=rng.choice(ISSUERS), app=rng.choice(UPI_APPS), card_network=None, card_last4=None, vpa=c["vpa"], status="captured" if ok else "failed",
                     error_code=None if ok else err[0], error_description=None if ok else err[1], error_source=None if ok else err[2], error_step=None if ok else err[3],
                     error_reason=None if ok else err[4], rrn=rng.digits(12) if ok else None, upi_txn_id=None, auth_code=None, is_renewal=1, created_at=iso(at),
                     authorized_at=iso(at + timedelta(seconds=8)) if ok else None, captured_at=iso(at + timedelta(seconds=15)) if ok else None, email=c["email"], contact=c["phone"])
            p["upi_txn_id"] = p["rrn"]
            pays.append(p)
            if ok:  # the merchant's webhook was healthy then: both events arrive and are answered 200
                t0 = at + timedelta(seconds=15)
                for j, kind in enumerate(["subscription.charged", "payment.captured"]):
                    eid = rng.rid("evt_")
                    events.append(dict(id=eid, merchant_id=MID, endpoint_id=ENDPOINT, event_type=kind, payment_id=p["id"], subscription_id=sid, created_at=iso(t0 + timedelta(seconds=j)), final_delivery_class="2xx"))
                    deliveries.append(dict(id=rng.rid("dlv_"), event_id=eid, attempt_no=1, attempted_at=iso(t0 + timedelta(seconds=j)), http_status=200, latency_ms=rng.randint(40, 180),
                                           error_class=None, response_body_excerpt='{"ok":true}'))
            return p

        failed = payment(when, False)
        if paid_back:
            later = payment(when + timedelta(hours=rng.uniform(*z["paid_back_hours"])), True)
            until, rzp = T(later["captured_at"]) + timedelta(days=30), later["id"]
        else:  # "on": the merchant's job extended access when the renewal came due and never took it back. "cut": it did when its own rule ran out.
            until, rzp = (when + timedelta(days=30), "") if access == "on" else (when + grace, "")
        ents.append(dict(order_id=None, subscription_id=sid, razorpay_payment_id=rzp if until > export_at else "", customer_id=c["id"], entitlement_state="active" if until >= export_at else "expired",
                         access_until=iso(until), updated_at=iso(min(export_at, until)), source="webhook"))
        states.append(dict(payment_id=failed["id"], subscription_id=sid, state=state))

    for _ in range(z["access_on"]):
        renewal("leak", at_past(), insufficient, "on")
    for _ in range(z["access_cut"]):
        renewal("access_cut", at_past(), insufficient, "cut")
    for _ in range(z["paid_since"]):
        renewal("paid_since", at_past(), insufficient, "on", paid_back=True)
    for _ in range(z["inside_grace"]):
        renewal("inside_grace", at_inside(), insufficient, "on")
    for _ in range(z["not_theirs"]):
        renewal("not_theirs", at_past(), bank_side, "on")

    def ins(db: sqlite3.Connection, table: str, rows: list[dict]) -> None:
        if rows:
            cols = list(rows[0])
            db.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [tuple(r[c] for c in cols) for r in rows])

    for table, rows in (("customers", people), ("subscriptions", subs), ("payments", pays), ("webhook_events", events), ("webhook_deliveries", deliveries), ("entitlements", ents)):
        ins(world, table, rows)
    ins(truth, "truth_leakage", states)
    world.row_factory = sqlite3.Row
    with open(out / "entitlements_snapshot.csv", "w", newline="") as f:  # rewritten from the database, as INC-3 does
        w = csv.DictWriter(f, fieldnames=ENT_COLS)
        w.writeheader()
        w.writerows([dict(r) for r in world.execute(f"SELECT {','.join(ENT_COLS)} FROM entitlements ORDER BY id")])
    world.commit()
    truth.commit()
    return dict(leakage_access_on=z["access_on"], leakage_inside_grace=z["inside_grace"])
