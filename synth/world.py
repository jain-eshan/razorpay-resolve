"""World builder for the fictional merchant Kaksha. Deterministic from the seed.

Writes the raw world (what Razorpay, the merchant and customers would have produced) to world.db, and the ground truth
(what really happened) to truth.db. The pipeline never reads truth.db. Every count in the incident is a result of the
parameters in config.yaml, never a typed number.
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import random
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

IST = timezone(timedelta(hours=5, minutes=30))
ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
FIRST = ["Aarav", "Vihaan", "Ananya", "Diya", "Rohan", "Ishaan", "Kavya", "Meera", "Arjun", "Saanvi", "Nikhil", "Pooja", "Rahul", "Sneha",
         "Karan", "Neha", "Amit", "Priya", "Vikram", "Riya", "Sahil", "Tanvi", "Yash", "Aditi", "Manav", "Ira", "Dev", "Nisha"]
LAST = ["Sharma", "Verma", "Gupta", "Nair", "Iyer", "Singh", "Das", "Patel", "Rao", "Kulkarni", "Mishra", "Gill", "Bose", "Khan", "Jain"]
ISSUERS = ["Sahyadri Bank", "Konkan Bank", "Malwa Bank", "Deccan Bank", "Awadh Bank"]
UPI_APPS = ["PayDost", "QuickPe", "RupeeGo"]
NETWORKS = ["Visa", "Mastercard", "RuPay"]
FAILS = [
    ("BAD_REQUEST_ERROR", "Payment cancelled by customer", "customer", "payment_authorization", "payment_cancelled"),
    ("BAD_REQUEST_ERROR", "Insufficient funds in account", "customer", "payment_authorization", "insufficient_funds"),
    ("GATEWAY_ERROR", "Payment processing failed due to error at bank or wallet gateway", "bank", "payment_authorization", "gateway_technical_error"),
]
HI_TEXT = [
    "paisa kat gaya {amt} ka, {plan} nahi mila. UPI ref {ref}",
    "bhai {amt} deduct hua par {plan} activate nahi hua. ref no {ref}",
    "{amt} kat gaye {when}, premium abhi bhi band hai. {ref}",
]
EN_TEXT = [
    "Hi, I paid Rs {amt} for {plan} but my account still shows the free plan. Reference {ref}",
    "Money debited (Rs {amt}) but {plan} is not active. Ref {ref}. Please check.",
]


def T(s) -> datetime:
    return datetime.fromisoformat(str(s)).replace(tzinfo=IST)


def iso(d: datetime) -> str:
    return d.isoformat(timespec="seconds")


class Rng(random.Random):
    def rid(self, prefix: str, n: int = 14) -> str:
        return prefix + "".join(self.choice(ALNUM) for _ in range(n))

    def digits(self, n: int) -> str:
        return "".join(self.choice("0123456789") for _ in range(n))

    def poisson(self, lam: float) -> int:
        limit, k, p = math.exp(-lam), 0, 1.0
        while True:
            k += 1
            p *= self.random()
            if p <= limit:
                return k - 1

    def weighted(self, weights: dict):
        r, acc = self.random() * sum(weights.values()), 0.0
        for k, w in weights.items():
            acc += w
            if r <= acc:
                return k
        return k


def ins(db: sqlite3.Connection, table: str, rows: list[dict]) -> None:
    if rows:
        cols = list(rows[0])
        db.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [tuple(r[c] for c in cols) for r in rows])


def build(cfg: dict, world: sqlite3.Connection, truth: sqlite3.Connection, out: Path) -> dict:
    rng = Rng(cfg["seed"])
    tr, wh, i1 = cfg["traffic"], cfg["webhooks"], cfg["inc1"]
    mid = cfg["merchant"]["id"]
    plans = {p["id"]: p for p in cfg["plans"]}
    start, now = T(f"{cfg['world']['start']}T00:00:00"), T(cfg["snapshot_at"])
    export_at = T(cfg["entitlement_export_at"])
    deploy_at, resolved_at = T(i1["deploy_at"]), T(i1["resolved_at"])
    downtime = [(T(d["started_at"]), T(d["ended_at"]), d["issuer"]) for d in cfg["downtime"]]

    # ---- customers ----
    customers = []
    for i in range(tr["customers"] + tr["subscribers"]):
        sub = i >= tr["customers"]
        f, l = rng.choice(FIRST), rng.choice(LAST)
        customers.append(dict(id=f"cust_{'s' if sub else 'o'}{i:04d}", merchant_id=mid, name=f"{f} {l}", email=f"{f.lower()}.{l.lower()}{i}@example.test",
                              phone=f"+9190000{i:05d}", vpa=f"{f.lower()}{i}@fakebank", language_pref="hi_latn" if rng.random() < 0.65 else "en",
                              created_at=iso(start - timedelta(days=rng.randrange(5, 200)))))
    cust = {c["id"]: c for c in customers}
    buyers = [c["id"] for c in customers if c["id"].startswith("cust_o")]
    subbers = [c["id"] for c in customers if c["id"].startswith("cust_s")]

    orders, payments, subs = [], [], []

    def web_version(ts):
        return "web-2.7.9" if ts < deploy_at else ("web-2.8.0" if ts < resolved_at else "web-2.8.1")

    def make_payment(ts, order, cid, method, ok, sub_id=None, renewal=False, force_bank_fail=False):
        c = cust[cid]
        pid = rng.rid("pay_")
        issuer = rng.choice(ISSUERS) if method in ("upi", "netbanking") else None
        err = None
        if force_bank_fail:
            issuer, ok, err = "Sahyadri Bank", False, FAILS[2]
        elif not ok:
            err = rng.choice(FAILS)
        p = dict(id=pid, merchant_id=mid, order_id=order["id"] if order else None, subscription_id=sub_id, customer_id=cid,
                 amount_paise=order["amount_paise"] if order else plans["plan_monthly_299"]["amount_paise"], currency="INR", method=method,
                 issuer=issuer, app=rng.choice(UPI_APPS) if method == "upi" else None, card_network=rng.choice(NETWORKS) if method == "card" else None,
                 card_last4=rng.digits(4) if method == "card" else None, vpa=c["vpa"] if method == "upi" else None,
                 status="captured" if ok else "failed", error_code=err[0] if err else None, error_description=err[1] if err else None,
                 error_source=err[2] if err else None, error_step=err[3] if err else None, error_reason=err[4] if err else None,
                 rrn=rng.digits(12) if ok and method in ("upi", "netbanking") else None, upi_txn_id=None, auth_code=rng.digits(6) if ok and method == "card" else None,
                 is_renewal=1 if renewal else 0, created_at=iso(ts), authorized_at=iso(ts + timedelta(seconds=8)) if ok else None,
                 captured_at=iso(ts + timedelta(seconds=15)) if ok else None, email=c["email"], contact=c["phone"])
        p["upi_txn_id"] = p["rrn"] if method == "upi" else None
        payments.append(p)
        return p

    def make_order(ts, plan_id, force_attempts=False):
        cid = rng.choice(buyers)
        pl = plans[plan_id]
        o = dict(id=rng.rid("order_"), merchant_id=mid, customer_id=cid, plan_id=plan_id, receipt=f"KK-2026-{len(orders) + 1:06d}",
                 amount_paise=pl["amount_paise"], status="created", client_app_version="android-3.4.0" if rng.random() < 0.35 else web_version(ts),
                 created_at=iso(ts), attempts=0, first_attempt_at=None, last_attempt_at=None)
        orders.append(o)
        if not force_attempts and rng.random() < tr["abandonment"]:
            return o
        method = rng.weighted(tr["method_weights"])
        for k in range(tr["max_attempts"]):
            at = ts + timedelta(seconds=40 + 90 * k)
            in_down = any(a <= at <= b for a, b, _ in downtime) and method == "upi" and rng.random() < 0.8
            ok = (not in_down) and rng.random() < (tr["first_attempt_success"] if k == 0 else tr["retry_success"])
            make_payment(at, o, cid, method, ok, force_bank_fail=in_down)
            o["attempts"] += 1
            o["first_attempt_at"] = o["first_attempt_at"] or iso(at)
            o["last_attempt_at"] = iso(at)
            if ok:
                o["status"] = "paid"
                break
        else:
            o["status"] = "attempted"
        if o["status"] == "created" and o["attempts"]:
            o["status"] = "attempted"
        return o

    # ---- one-time purchases and abandoned orders ----
    rates = tr["orders_per_hour"]
    hours = int((now - start).total_seconds() // 3600) + 1
    for h in range(hours):
        base = start + timedelta(hours=h)
        hod = base.hour
        rate = rates["night"] if hod < 6 else rates["morning"] if hod < 10 else rates["day"] if hod < 17 else rates["evening"] if hod < 23 else rates["late"]
        rate *= tr["weekend_multiplier"] if base.weekday() >= 5 else 1
        for _ in range(rng.poisson(rate)):
            ts = base + timedelta(minutes=rng.randrange(60), seconds=rng.randrange(60))
            if ts < now:
                make_order(ts, rng.weighted(tr["plan_weights"]))

    # purchases made right after the fix that the merchant's handler still fails to grant (the 2xx-is-not-success case)
    hid = i1["hidden_ack_then_fail"]
    hidden_orders = []
    for _ in range(hid["count"]):
        span = (T(hid["end"]) - T(hid["start"])).total_seconds()
        o = make_order(T(hid["start"]) + timedelta(seconds=rng.randrange(int(span))), hid["plan"], force_attempts=True)
        hidden_orders.append(o["id"])
    orders.sort(key=lambda o: o["created_at"])

    # ---- subscriptions and renewals ----
    entitlements = []
    sub_access = {}
    for cid in subbers:
        sid = rng.rid("sub_")
        method = "upi_autopay" if rng.random() < 0.65 else "card_mandate"
        first = start + timedelta(days=rng.randrange(30), hours=rng.randrange(24), minutes=rng.randrange(60))
        subs.append(dict(id=sid, merchant_id=mid, customer_id=cid, plan_id="plan_monthly_299", method=method, status="active",
                         current_start=iso(first - timedelta(days=30)), current_end=iso(first), created_at=iso(first - timedelta(days=60))))
        sub_access[sid] = first  # paid-through date before the renewal
        if first < now:
            ok = rng.random() < tr["renewal_success"]
            make_payment(first, None, cid, "upi" if method == "upi_autopay" else "card", ok, sub_id=sid, renewal=True)

    # ---- webhook events (two per captured payment, as observed on real Razorpay) ----
    events = []
    for p in payments:
        if p["status"] != "captured":
            continue
        t0 = T(p["captured_at"])
        kinds = ["subscription.charged", "payment.captured"] if p["is_renewal"] else ["payment.captured", "order.paid"]
        for j, k in enumerate(kinds):
            events.append(dict(id=rng.rid("evt_"), merchant_id=mid, endpoint_id="ep_kaksha001", event_type=k, payment_id=p["id"],
                               subscription_id=p["subscription_id"], created_at=iso(t0 + timedelta(seconds=j)), final_delivery_class=None))
    events.sort(key=lambda e: e["created_at"])

    def is_handler(e):
        return e["event_type"] == "subscription.charged" or (e["event_type"] == "payment.captured" and e["subscription_id"] is None)

    first_fail = next(T(e["created_at"]) for e in events if T(e["created_at"]) >= deploy_at)
    disabled_at = first_fail + timedelta(hours=wh["disable_after_hours"])
    endpoint = dict(id="ep_kaksha001", merchant_id=mid, url=wh["endpoint"], status="active", disabled_at=iso(disabled_at),
                    disable_email_sent_at=iso(disabled_at + timedelta(minutes=1)))

    deliveries = []
    for e in events:
        ts = T(e["created_at"])
        if deploy_at <= ts < resolved_at:
            if ts >= disabled_at:
                e["final_delivery_class"] = "not_attempted_disabled"
                continue
            for k, off in enumerate(wh["retry_offsets_seconds"]):
                at = ts + timedelta(seconds=off)
                if k > 0 and at >= disabled_at:
                    break
                deliveries.append(dict(id=rng.rid("dlv_"), event_id=e["id"], attempt_no=k + 1, attempted_at=iso(at), http_status=i1["failing_status"],
                                       latency_ms=rng.randint(25, 70), error_class=None, response_body_excerpt=i1["failing_body"]))
            e["final_delivery_class"] = "4xx"
        else:
            if rng.random() < wh["baseline_first_attempt_failure"]:
                deliveries.append(dict(id=rng.rid("dlv_"), event_id=e["id"], attempt_no=1, attempted_at=iso(ts), http_status=None, latency_ms=10000,
                                       error_class="timeout", response_body_excerpt=None))
                deliveries.append(dict(id=rng.rid("dlv_"), event_id=e["id"], attempt_no=2, attempted_at=iso(ts + timedelta(seconds=9)), http_status=200,
                                       latency_ms=rng.randint(40, 180), error_class=None, response_body_excerpt='{"ok":true}'))
            else:
                deliveries.append(dict(id=rng.rid("dlv_"), event_id=e["id"], attempt_no=1, attempted_at=iso(ts), http_status=200,
                                       latency_ms=rng.randint(40, 180), error_class=None, response_body_excerpt='{"ok":true}'))
            e["final_delivery_class"] = "2xx"

    # ---- merchant access records (what the founder's database says) ----
    handler_ev = {e["payment_id"]: e for e in events if is_handler(e)}
    pay_by_id = {p["id"]: p for p in payments}
    order_by_id = {o["id"]: o for o in orders}
    ent_order = {o["id"]: dict(order_id=o["id"], subscription_id=None, razorpay_payment_id="", customer_id=o["customer_id"], entitlement_state="unpaid",
                               access_until=None, updated_at=o["created_at"], source="webhook") for o in orders}
    hidden_pay_ids, affected = set(), []
    for p in payments:
        if p["status"] != "captured" or p["id"] not in handler_ev:
            continue
        e = handler_ev[p["id"]]
        delivered = e["final_delivery_class"] == "2xx"
        ts = T(p["captured_at"])
        if not p["is_renewal"]:
            en = ent_order[p["order_id"]]
            if delivered and p["order_id"] in hidden_orders:  # handler answered 2xx but failed to write access
                hidden_pay_ids.add(p["id"])
                affected.append(p)
            elif delivered:
                en.update(entitlement_state="active", razorpay_payment_id=p["id"], updated_at=iso(ts + timedelta(seconds=40)))
            else:
                affected.append(p)
        else:
            if delivered:
                sub_access[p["subscription_id"]] = max(sub_access[p["subscription_id"]], ts) + timedelta(days=30)
            else:
                affected.append(p)

    # ---- complaints, hand fixes and refunds ----
    affected.sort(key=lambda p: p["captured_at"])
    early = [p for p in affected if T(p["captured_at"]) < disabled_at - timedelta(hours=4)]
    forced = {p["id"] for p in rng.sample(early, min(i1["forced_early_complaints"], len(early)))}
    complaints, comp_by_pay = [], {}
    for p in affected:
        ts = T(p["captured_at"])
        if p["id"] in forced:
            at = min(ts + timedelta(hours=rng.uniform(5, 12)), resolved_at - timedelta(hours=1))
        elif rng.random() < i1["complain_probability"]:
            at = ts + timedelta(hours=1 + rng.expovariate(1 / 18))
        else:
            continue
        if at > now - timedelta(minutes=10):
            continue
        c = cust[p["customer_id"]]
        ref = p["rrn"] if p["rrn"] else p["id"]
        amt = f"{p['amount_paise'] / 100:g}"
        plan = plans[order_by_id[p["order_id"]]["plan_id"]]["name"] if p["order_id"] else "Premium Monthly"
        tpl = rng.choice(HI_TEXT if c["language_pref"] == "hi_latn" else EN_TEXT)
        raw = tpl.format(amt=amt, plan=plan, ref=ref, when=rng.choice(["kal raat", "aaj subah", "parso"]))
        token = "tok_" + hashlib.sha1(c["phone"].encode()).hexdigest()[:8]
        cm = dict(id=rng.rid("cmp_", 10), merchant_id=mid, channel=rng.weighted({"whatsapp_payments": 0.5, "email": 0.3, "ray_forward": 0.2}),
                  received_at=iso(at), from_handle=token, raw_text=raw, raw_hash=hashlib.sha256(raw.encode()).hexdigest(),
                  redacted_text=raw.replace(ref, "<REF_1>"), attachment_path=None, data_role="merchant_data_processor", thread_id=None, customer_ref=token)
        complaints.append(cm)
        comp_by_pay[p["id"]] = (cm, p, c)
    fixed_by_hand, refunded = set(), set()
    pre_fix = sorted([v for v in comp_by_pay.values() if T(v[0]["received_at"]) < resolved_at], key=lambda v: v[0]["received_at"])
    for cm, p, _ in pre_fix[: i1["forced_early_complaints"]]:
        fixed_by_hand.add(p["id"])
    rest = [v for v in sorted(comp_by_pay.values(), key=lambda v: v[0]["received_at"]) if v[1]["id"] not in fixed_by_hand and T(v[0]["received_at"]) < now - timedelta(hours=8)]
    refunds = []
    for cm, p, _ in rest[: i1["refunded_complainers"]]:
        rt = T(cm["received_at"]) + timedelta(hours=3)
        refunded.add(p["id"])
        p["status"] = "refunded"
        refunds.append(dict(id=rng.rid("rfnd_"), payment_id=p["id"], amount_paise=p["amount_paise"], status="processed", arn=rng.digits(23) if p["method"] == "card" else None,
                            rrn=rng.digits(12) if p["method"] != "card" else None, speed="normal", created_at=iso(rt), processed_at=iso(rt + timedelta(hours=6)), source="world"))

    # hand fixes, then final subscription entitlements
    for pid in fixed_by_hand:
        p = pay_by_id[pid]
        cm = comp_by_pay[pid][0]
        at = iso(T(cm["received_at"]) + timedelta(hours=1))
        if p["is_renewal"]:
            sub_access[p["subscription_id"]] = T(p["captured_at"]) + timedelta(days=30)
        else:
            ent_order[p["order_id"]].update(entitlement_state="active", razorpay_payment_id=pid, updated_at=at, source="manual")
    sub_rows = {s["id"]: s for s in subs}
    for sid, until in sub_access.items():
        s = sub_rows[sid]
        paid = next((p for p in payments if p["subscription_id"] == sid and p["status"] != "failed"), None)
        entitlements.append(dict(order_id=None, subscription_id=sid, razorpay_payment_id=(paid["id"] if paid and until > export_at else ""), customer_id=s["customer_id"],
                                 entitlement_state="active" if until >= export_at else "expired", access_until=iso(until), updated_at=iso(min(export_at, until)),
                                 source="manual" if any(p["subscription_id"] == sid and p["id"] in fixed_by_hand for p in payments) else "webhook"))
    entitlements = list(ent_order.values()) + entitlements

    # ---- write world.db ----
    merchant_events = [dict(id=e["id"], merchant_id=mid, kind=e["kind"], label=e["label"], at=iso(T(e["at"]))) for e in cfg["merchant_events"]]
    ins(world, "customers", customers)
    ins(world, "orders", orders)
    ins(world, "subscriptions", subs)
    ins(world, "payments", payments)
    ins(world, "refunds", refunds)
    ins(world, "webhook_endpoints", [endpoint])
    ins(world, "webhook_events", events)
    ins(world, "webhook_deliveries", deliveries)
    ins(world, "entitlements", entitlements)
    ins(world, "merchant_events", merchant_events)
    ins(world, "downtime_events", [dict(id=d["id"], method=d["method"], issuer=d["issuer"], started_at=iso(T(d["started_at"])), ended_at=iso(T(d["ended_at"])), severity=d["severity"]) for d in cfg["downtime"]])
    ins(world, "complaints", complaints)

    # ---- write truth.db ----
    affected_ids = {a["id"] for a in affected}
    for p in payments:
        if p["status"] == "failed":
            continue
        inc = p["id"] in affected_ids
        reason = "already_active" if p["id"] in fixed_by_hand else "refunded" if p["id"] in refunded else None
        ins(truth, "truth_payments", [dict(payment_id=p["id"], incident_id="INC-1" if inc else None, mismatch_type=("G" if p["is_renewal"] else "A") if inc else None,
                                           should_fix=1 if inc and not reason else 0, exclusion_reason=reason if inc else None)])
    ins(truth, "truth_complaints", [dict(complaint_id=cm["id"], payment_ids=json.dumps([p["id"]]), mismatch_type="G" if p["is_renewal"] else "A", topic="payment",
                                         is_injection=0, language=c["language_pref"], amount_paise=p["amount_paise"], rrn=p["rrn"]) for cm, p, c in comp_by_pay.values()])
    ins(truth, "truth_incidents", [dict(incident_id="INC-1", cause_code="WEBHOOK_ENDPOINT_401_AFTER_DEPLOY", owner="merchant_code", onset_at=iso(deploy_at),
                                        resolved_at=iso(resolved_at), linked_event_id="me_deploy_280")])

    # ---- entitlement export (what the founder would upload) ----
    out.mkdir(parents=True, exist_ok=True)
    with open(out / "entitlements_snapshot.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["order_id", "subscription_id", "razorpay_payment_id", "customer_id", "entitlement_state", "access_until", "updated_at", "source"])
        w.writeheader()
        w.writerows(entitlements)

    ins(world, "merchants", [dict(id=mid, name=cfg["merchant"]["name"], segment=cfg["merchant"]["segment"], mid=cfg["merchant"]["mid"],
                                  tech_contact="dev@kaksha.example", owner_contact="founder@kaksha.example",
                                  grace_hours_after_failed_renewal=cfg["merchant"]["grace_hours_after_failed_renewal"])])
    ins(world, "plans", [dict(id=p["id"], merchant_id=mid, name=p["name"], amount_paise=p["amount_paise"], interval=p["interval"]) for p in cfg["plans"]])
    world.commit()
    truth.commit()
    return dict(orders=len(orders), payments=len(payments), captured=sum(p["status"] != "failed" for p in payments), events=len(events), deliveries=len(deliveries),
                affected=len(affected), hidden_2xx=len(hidden_pay_ids), complaints=len(complaints), fixed_by_hand=len(fixed_by_hand), refunded=len(refunded),
                disabled_at=iso(disabled_at))
