"""INC-2 world (SPEC 13.2, v1 16.2): customers charged twice after an Android app release.

Applied after the finished world, with its own random stream, so every number in INC-1, INC-3, INC-4 and INC-5 stays the same.
Release android-3.4.1 lets the Pay button be tapped twice. Each double tap makes two orders and two captures for the same person,
the same plan and the same amount, a few seconds apart. The merchant's webhook was healthy at those times (the times avoid the INC-1
outage and every Zone 1 incident and look-alike window), so both orders get access and the only harm is the second charge.

Two look-alikes must not be refunded: a customer who buys the same plan twice on purpose, once for a friend (two seats, two fulfilled
orders for two people), and a pair where the second attempt failed after the bank debited it, which the bank reverses by itself.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sqlite3
from datetime import timedelta
from pathlib import Path

from .world import FIRST, ISSUERS, LAST, UPI_APPS, Rng, T, iso

MID, ENDPOINT = "acc_KAKSHA001", "ep_kaksha001"
APP = "android-3.4.1"
ENT_COLS = ["order_id", "subscription_id", "razorpay_payment_id", "customer_id", "entitlement_state", "access_until", "updated_at", "source"]
EN = ["Hi, I was charged twice. Rs {amt} was deducted two times for {plan} on {when}. Please refund one. Ref {ref}",
      "Money debited twice (Rs {amt} two times) for {plan}, I only wanted to buy it once. Ref {ref}. Please refund the extra"]
HI = ["bhai {amt} do baar kat gaye {when} ko, {plan} ek hi baar liya tha. ref {ref}",
      "{plan} ke {amt} do baar kat gaye, ek wapas kar do. ref {ref}"]


def apply(cfg: dict, world: sqlite3.Connection, truth: sqlite3.Connection, out: Path) -> dict:
    z = cfg["inc2"]
    rng = Rng(cfg["seed"] + 2002)
    world.row_factory = sqlite3.Row
    plans = {p["id"]: p for p in cfg["plans"]}
    release = T(z["release"]["at"])
    i1 = cfg["inc1"]
    deploy_1, fixed_1 = T(i1["deploy_at"]), T(i1["resolved_at"])
    zc = cfg["zone1"]
    avoid = [(T(e.get("start") or e["onset"]), T(e["end"])) for e in (zc[k] for k in ("inc5", "n1", "n2", "n3", "n4", "n5"))]
    windows = [(T(a), T(b)) for a, b in z["windows"]]
    people: list[dict] = []
    orders, pays, events, deliveries, ents = [], [], [], [], []
    n_receipts = world.execute("SELECT COUNT(*) FROM orders").fetchone()[0]

    def person() -> dict:
        i = len(people)
        f, l = rng.choice(FIRST), rng.choice(LAST)
        c = dict(id=f"cust_d{i:04d}", merchant_id=MID, name=f"{f} {l}", email=f"{f.lower()}.{l.lower()}d{i}@example.test", phone=f"+9190002{i:05d}", vpa=f"{f.lower()}d{i}@fakebank",
                 language_pref="hi_latn" if rng.random() < 0.65 else "en", created_at=iso(T(f"{cfg['world']['start']}T00:00:00") - timedelta(days=rng.randrange(5, 200))))
        people.append(c)
        return c

    def web_version(ts) -> str:
        return "web-2.7.9" if ts < deploy_1 else ("web-2.8.0" if ts < fixed_1 else "web-2.8.1")

    def when() -> object:
        """A moment in one of the allowed windows, in the early afternoon. Those hours are not in the evening and overnight stretch that INC-4's and INC-5's baselines are measured over, so neither moves."""
        while True:
            lo, hi = windows[rng.weighted({i: (b - a).total_seconds() for i, (a, b) in enumerate(windows)})]  # longer windows get more double taps
            ts = lo + timedelta(seconds=rng.randrange(int((hi - lo).total_seconds())))
            if 13 <= ts.hour < 17 and not any(a - timedelta(minutes=10) <= ts <= b + timedelta(minutes=10) for a, b in avoid):
                return ts

    def order(owner: dict, plan_id: str, at, version: str) -> dict:
        nonlocal n_receipts
        n_receipts += 1
        pl = plans[plan_id]
        o = dict(id=rng.rid("order_"), merchant_id=MID, customer_id=owner["id"], plan_id=plan_id, receipt=f"KK-2026-{n_receipts:06d}", amount_paise=pl["amount_paise"], status="created",
                 client_app_version=version, created_at=iso(at), attempts=0, first_attempt_at=None, last_attempt_at=None)
        orders.append(o)
        return o

    def pay(o: dict, payer: dict, owner: dict, method: str, issuer: str | None, app: str | None, ok: bool, err: dict | None = None) -> dict:
        at = T(o["created_at"]) + timedelta(seconds=40)
        upi = method == "upi"
        p = dict(id=rng.rid("pay_"), merchant_id=MID, order_id=o["id"], subscription_id=None, customer_id=owner["id"], amount_paise=o["amount_paise"], currency="INR", method=method,
                 issuer=issuer, app=app, card_network=None if method != "card" else rng.choice(["Visa", "Mastercard", "RuPay"]), card_last4=rng.digits(4) if method == "card" else None,
                 vpa=payer["vpa"] if upi else None, status="captured" if ok else "failed", error_code=None if ok else err["code"], error_description=None if ok else err["description"],
                 error_source=None if ok else err["source"], error_step=None if ok else err["step"], error_reason=None if ok else err["reason"],
                 rrn=rng.digits(12) if ok and method in ("upi", "netbanking") else None, upi_txn_id=None, auth_code=rng.digits(6) if ok and method == "card" else None, is_renewal=0,
                 created_at=iso(at), authorized_at=iso(at + timedelta(seconds=8)) if ok else None, captured_at=iso(at + timedelta(seconds=15)) if ok else None,
                 email=payer["email"], contact=payer["phone"])  # checkout records the person who paid, not the person the order is for
        p["upi_txn_id"] = p["rrn"] if upi else None
        pays.append(p)
        o.update(attempts=1, first_attempt_at=iso(at), last_attempt_at=iso(at), status="paid" if ok else "attempted")
        if ok:  # the merchant's webhook was healthy: both events arrive and are answered 200, and the handler gives that order access
            t0 = at + timedelta(seconds=15)
            for j, kind in enumerate(["payment.captured", "order.paid"]):
                eid = rng.rid("evt_")
                events.append(dict(id=eid, merchant_id=MID, endpoint_id=ENDPOINT, event_type=kind, payment_id=p["id"], subscription_id=None, created_at=iso(t0 + timedelta(seconds=j)), final_delivery_class="2xx"))
                deliveries.append(dict(id=rng.rid("dlv_"), event_id=eid, attempt_no=1, attempted_at=iso(t0 + timedelta(seconds=j)), http_status=200, latency_ms=rng.randint(40, 180),
                                       error_class=None, response_body_excerpt='{"ok":true}'))
        ents.append(dict(order_id=o["id"], subscription_id=None, razorpay_payment_id=p["id"] if ok else "", customer_id=owner["id"], entitlement_state="active" if ok else "unpaid",
                         access_until=None, updated_at=iso(at + timedelta(seconds=40)) if ok else o["created_at"], source="webhook"))
        return p

    def how() -> tuple[str, str | None, str | None]:
        method = rng.weighted(cfg["traffic"]["method_weights"])
        return method, rng.choice(ISSUERS) if method in ("upi", "netbanking") else None, rng.choice(UPI_APPS) if method == "upi" else None

    gap = lambda: rng.randint(*z["gap_seconds"])
    jobs = [("dup", pid) for pid, n in z["duplicates"].items() for _ in range(n)] + [("legit", None)] * z["legit_two_seat"] + [("reverse", None)] * z["reversing"]
    rng.shuffle(jobs)
    times = sorted(when() for _ in jobs)
    times[0] = release + timedelta(hours=3, minutes=rng.randrange(0, 120))  # the first double tap comes within a few hours of the release, in the afternoon like the rest
    times.sort()
    pairs = []  # (kind, first payment, second payment, plan id)
    for (kind, plan_id), at in zip(jobs, times, strict=True):
        payer = person()
        method, issuer, app = how()
        if kind == "dup":
            o1, o2 = order(payer, plan_id, at, APP), order(payer, plan_id, at + timedelta(seconds=gap()), APP)
            pairs.append((kind, pay(o1, payer, payer, method, issuer, app, True), pay(o2, payer, payer, method, issuer, app, True), plan_id))
        elif kind == "legit":  # a second seat for a friend, bought straight after: two orders, two people, both fulfilled
            plan_id = rng.choice(["plan_mock_199", "plan_series_599"])
            friend = person()
            o1, o2 = order(payer, plan_id, at, web_version(at)), order(friend, plan_id, at + timedelta(seconds=rng.randint(20, 110)), web_version(at))
            pairs.append((kind, pay(o1, payer, payer, method, issuer, app, True), pay(o2, payer, friend, method, issuer, app, True), plan_id))
        else:  # the second attempt failed after the bank debited it. The bank puts the money back by itself
            plan_id = rng.choice(["plan_mock_199", "plan_series_599"])
            o1, o2 = order(payer, plan_id, at, APP), order(payer, plan_id, at + timedelta(seconds=gap()), APP)
            pairs.append((kind, pay(o1, payer, payer, method, issuer, app, True), pay(o2, payer, payer, method, issuer, app, False, z["reversal_error"]), plan_id))
    dups = [p for p in pairs if p[0] == "dup"]
    onset = min(p[2]["created_at"] for p in dups)

    # ---- four customers who were charged twice write in; two cite the first charge and two the second ----
    snap = T(cfg["snapshot_at"])
    early = [p for p in dups if T(p[2]["captured_at"]) < snap - timedelta(days=1)]
    chosen = sorted(rng.sample(early, z["complaints"]), key=lambda p: p[2]["captured_at"])
    cust = {c["id"]: c for c in people}
    comps = []
    for k, (_, first, second, plan_id) in enumerate(chosen):
        cited = second if k % 2 == 0 else first
        c = cust[second["customer_id"]]
        at = T(second["captured_at"]) + timedelta(hours=1 + rng.expovariate(1 / 6))
        ref = cited["rrn"] or cited["id"]
        raw = rng.choice(HI if c["language_pref"] == "hi_latn" else EN).format(amt=f"{second['amount_paise'] / 100:g}", plan=plans[plan_id]["name"], ref=ref,
                                                                                 when=rng.choice(["kal raat", "aaj subah", "parso"]) if c["language_pref"] == "hi_latn" else T(second["created_at"]).strftime("%d %b"))
        token = "tok_" + hashlib.sha1(c["phone"].encode()).hexdigest()[:8]
        comps.append(dict(id=rng.rid("cmp_", 10), merchant_id=MID, channel=rng.weighted({"whatsapp_payments": 0.5, "email": 0.3, "ray_forward": 0.2}), received_at=iso(min(at, snap - timedelta(minutes=30))),
                          from_handle=token, raw_text=raw, raw_hash=hashlib.sha256(raw.encode()).hexdigest(), redacted_text=raw.replace(ref, "<REF_1>"), attachment_path=None,
                          data_role="merchant_data_processor", thread_id=None, customer_ref=token, _payment=cited["id"], _language=c["language_pref"], _amount=second["amount_paise"]))

    def ins(db: sqlite3.Connection, table: str, rows: list[dict]) -> None:
        rows = [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]
        if rows:
            cols = list(rows[0])
            db.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [tuple(r[c] for c in cols) for r in rows])

    # a release carries ordinary orders too: most Android customers who order after it are on the new version. Existing orders are relabelled, none are added, so no baseline moves
    upgraded = [r["id"] for r in world.execute("SELECT id FROM orders WHERE client_app_version = 'android-3.4.0' AND created_at >= ? ORDER BY created_at, id", (iso(release),)) if rng.random() < z["adoption"]]
    world.executemany("UPDATE orders SET client_app_version = ? WHERE id = ?", [(APP, oid) for oid in upgraded])

    ins(world, "customers", people)
    ins(world, "orders", orders)
    ins(world, "payments", pays)
    ins(world, "webhook_events", events)
    ins(world, "webhook_deliveries", deliveries)
    ins(world, "entitlements", ents)
    ins(world, "complaints", comps)
    ins(world, "merchant_events", [dict(id=z["release"]["id"], merchant_id=MID, kind="app_release", label=z["release"]["label"], at=iso(release))])
    with open(out / "entitlements_snapshot.csv", "w", newline="") as f:  # rewritten from the database so it holds every access record, including these
        w = csv.DictWriter(f, fieldnames=ENT_COLS)
        w.writeheader()
        w.writerows([dict(r) for r in world.execute(f"SELECT {','.join(ENT_COLS)} FROM entitlements ORDER BY id")])

    # ---- ground truth ----
    ins(truth, "truth_incidents", [dict(incident_id="INC-2", cause_code="DOUBLE_SUBMIT_AFTER_APP_RELEASE", owner="merchant_code", onset_at=onset, resolved_at=None, linked_event_id=z["release"]["id"])])
    for kind, first, second, _ in pairs:
        # the first charge is what the customer owes. The second is the one to refund, unless the pair is a look-alike.
        ins(truth, "truth_payments", [dict(payment_id=first["id"], incident_id="INC-2" if kind == "dup" else None, mismatch_type="E" if kind == "dup" else None, should_fix=0,
                                           exclusion_reason="original_charge" if kind == "dup" else None)])
        reason = {"dup": None, "legit": "legit_second_purchase", "reverse": "second_attempt_failed"}[kind]
        ins(truth, "truth_payments", [dict(payment_id=second["id"], incident_id="INC-2", mismatch_type="E", should_fix=int(kind == "dup"), exclusion_reason=reason)])
    ins(truth, "truth_complaints", [dict(complaint_id=c["id"], payment_ids=json.dumps([c["_payment"]]), mismatch_type="E", topic="payment", is_injection=0, language=c["_language"],
                                         amount_paise=c["_amount"], rrn=next((p["rrn"] for p in pays if p["id"] == c["_payment"]), None)) for c in comps])
    world.commit()
    truth.commit()
    return dict(inc2_pairs=len(dups), inc2_legit=sum(p[0] == "legit" for p in pairs), inc2_reversing=sum(p[0] == "reverse" for p in pairs), inc2_complaints=len(comps),
                inc2_to_refund_paise=sum(p[2]["amount_paise"] for p in dups), inc2_first_at=onset, inc2_orders_upgraded=len(upgraded))
