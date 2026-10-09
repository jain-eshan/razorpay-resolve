"""INC-3 world (SPEC 13.2, v1 16.2): Razorpay-side card renewal failures.

Applied last, on top of the finished world, with its own random stream, so every number in INC-1, INC-4 and INC-5 stays the same.
For about seven hours every card mandate renewal fails with one gateway error. UPI AutoPay renewals in the same hours go through, and
card renewals work again afterwards. The merchant's access job cut access when each renewal failed, so the customers are "failed,
access cut". Nothing on the merchant's side changed (no deploy, the webhook was healthy) and no bank outage covers the hours.

The window sits before the INC-1 deploy on purpose: the merchant's webhook was fine then, so the successful renewals around it are
ordinary. Three customers paid again on their own afterwards, and the incident must leave them out. Three customers wrote in.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sqlite3
from datetime import timedelta
from pathlib import Path

from .world import FIRST, ISSUERS, LAST, NETWORKS, UPI_APPS, Rng, T, iso

MID, ENDPOINT = "acc_KAKSHA001", "ep_kaksha001"
ENT_COLS = ["order_id", "subscription_id", "razorpay_payment_id", "customer_id", "entitlement_state", "access_until", "updated_at", "source"]
EN = ["Hi, my {plan} renewal of Rs {amt} on {when} failed but I did nothing wrong and my access is gone. Reference {ref}", "{plan} auto renewal (Rs {amt}) failed and now I cannot open my course. Ref {ref}. Please check"]
HI = ["bhai {when} ko {plan} ka {amt} ka renewal nahi hua par maine kuch galat nahi kiya, access band ho gaya. ref {ref}", "{plan} ka {amt} ka auto renewal fail ho gaya aur ab course nahi khul raha. {ref}"]


def apply(cfg: dict, world: sqlite3.Connection, truth: sqlite3.Connection, out: Path) -> dict:
    z = cfg["inc3"]
    rng = Rng(cfg["seed"] + 3003)
    world.row_factory = sqlite3.Row
    plan = next(p for p in cfg["plans"] if p["id"] == "plan_monthly_299")
    lo, hi = T(z["start"]), T(z["end"])
    export_at, deploy_1 = T(cfg["entitlement_export_at"]), T(cfg["inc1"]["deploy_at"])
    err = z["error"]
    span = int((hi - lo).total_seconds())
    people: list[dict] = []
    subs, pays, events, deliveries, ents, comps = [], [], [], [], [], []

    def person(language: str | None = None) -> dict:
        i = len(people)
        f, l = rng.choice(FIRST), rng.choice(LAST)
        c = dict(id=f"cust_r{i:04d}", merchant_id=MID, name=f"{f} {l}", email=f"{f.lower()}.{l.lower()}r{i}@example.test", phone=f"+9190001{i:05d}",
                 vpa=f"{f.lower()}r{i}@fakebank", language_pref=language or ("hi_latn" if rng.random() < 0.65 else "en"), created_at=iso(lo - timedelta(days=rng.randrange(40, 200))))
        people.append(c)
        return c

    def subscription(c: dict, method: str, due) -> str:
        sid = rng.rid("sub_")
        subs.append(dict(id=sid, merchant_id=MID, customer_id=c["id"], plan_id=plan["id"], method=method, status="active", current_start=iso(due - timedelta(days=30)),
                         current_end=iso(due), created_at=iso(due - timedelta(days=60))))
        return sid

    def payment(c: dict, sid: str, method: str, at, ok: bool) -> dict:
        upi = method == "upi"
        p = dict(id=rng.rid("pay_"), merchant_id=MID, order_id=None, subscription_id=sid, customer_id=c["id"], amount_paise=plan["amount_paise"], currency="INR", method=method,
                 issuer=rng.choice(ISSUERS) if upi else None, app=rng.choice(UPI_APPS) if upi else None, card_network=None if upi else rng.choice(NETWORKS),
                 card_last4=None if upi else rng.digits(4), vpa=c["vpa"] if upi else None, status="captured" if ok else "failed",
                 error_code=None if ok else err["code"], error_description=None if ok else err["description"], error_source=None if ok else err["source"],
                 error_step=None if ok else err["step"], error_reason=None if ok else err["reason"], rrn=rng.digits(12) if ok and upi else None, upi_txn_id=None,
                 auth_code=rng.digits(6) if ok and not upi else None, is_renewal=1, created_at=iso(at), authorized_at=iso(at + timedelta(seconds=8)) if ok else None,
                 captured_at=iso(at + timedelta(seconds=15)) if ok else None, email=c["email"], contact=c["phone"])
        p["upi_txn_id"] = p["rrn"] if upi else None
        pays.append(p)
        if ok:  # the merchant's webhook was healthy then (before the INC-1 deploy): both events arrive and are answered 200
            t0 = at + timedelta(seconds=15)
            for j, kind in enumerate(["subscription.charged", "payment.captured"]):
                eid = rng.rid("evt_")
                events.append(dict(id=eid, merchant_id=MID, endpoint_id=ENDPOINT, event_type=kind, payment_id=p["id"], subscription_id=sid, created_at=iso(t0 + timedelta(seconds=j)), final_delivery_class="2xx"))
                deliveries.append(dict(id=rng.rid("dlv_"), event_id=eid, attempt_no=1, attempted_at=iso(t0 + timedelta(seconds=j)), http_status=200, latency_ms=rng.randint(40, 180),
                                       error_class=None, response_body_excerpt='{"ok":true}'))
        return p

    def entitlement(c: dict, sid: str, until, paid: dict | None) -> None:
        ents.append(dict(order_id=None, subscription_id=sid, razorpay_payment_id=paid["id"] if paid and until > export_at else "", customer_id=c["id"],
                         entitlement_state="active" if until >= export_at else "expired", access_until=iso(until), updated_at=iso(min(export_at, until)), source="webhook"))

    # ---- an ordinary card renewal that fell inside the window would have failed too ----
    converted = [dict(r) for r in world.execute("SELECT * FROM payments WHERE is_renewal = 1 AND method = 'card' AND status = 'captured' AND created_at >= ? AND created_at <= ?", (iso(lo), iso(hi)))]
    for r in converted:
        world.execute("DELETE FROM webhook_deliveries WHERE event_id IN (SELECT id FROM webhook_events WHERE payment_id = ?)", (r["id"],))
        world.execute("DELETE FROM webhook_events WHERE payment_id = ?", (r["id"],))
        world.execute("""UPDATE payments SET status = 'failed', error_code = ?, error_description = ?, error_source = ?, error_step = ?, error_reason = ?, authorized_at = NULL,
                         captured_at = NULL, auth_code = NULL WHERE id = ?""", (err["code"], err["description"], err["source"], err["step"], err["reason"], r["id"]))
        world.execute("UPDATE entitlements SET entitlement_state = 'expired', access_until = ?, updated_at = ?, razorpay_payment_id = '' WHERE subscription_id = ?", (r["created_at"], r["created_at"], r["subscription_id"]))
        truth.execute("UPDATE truth_payments SET incident_id = 'INC-3', mismatch_type = 'G', should_fix = 1, exclusion_reason = NULL WHERE payment_id = ?", (r["id"],))

    # ---- UPI AutoPay renewals in the same hours go through ----
    for _ in range(z["upi_ok_during"]):
        c, at = person(), lo + timedelta(seconds=rng.randrange(span))
        sid = subscription(c, "upi_autopay", at)
        p = payment(c, sid, "upi", at, True)
        entitlement(c, sid, T(p["captured_at"]) + timedelta(days=30), p)

    # ---- card renewals: every one in the window fails; a few customers pay again on their own later ----
    times = sorted([lo] + [lo + timedelta(seconds=rng.randrange(span)) for _ in range(z["card_failures"] - 1)])
    again = set(rng.sample(range(1, len(times)), z["card_paid_since"]))
    victims = []
    for k, at in enumerate(times):
        c = person()
        sid = subscription(c, "card_mandate", at)
        failed = payment(c, sid, "card", at, False)
        victims.append(failed)
        if k in again:
            later = hi + timedelta(seconds=rng.randrange(20 * 60, int((deploy_1 - timedelta(hours=1) - hi).total_seconds())))
            paid = payment(c, sid, "card", later, True)
            entitlement(c, sid, T(paid["captured_at"]) + timedelta(days=30), paid)
            failed["_paid_since"] = paid["id"]
        else:
            entitlement(c, sid, at, None)  # the merchant's job cut access when the renewal failed

    # ---- card renewals work again once it clears ----
    for _ in range(z["card_ok_after"]):
        c, at = person(), hi + timedelta(minutes=5) + timedelta(seconds=rng.randrange(int((deploy_1 - timedelta(hours=1) - hi).total_seconds())))
        sid = subscription(c, "card_mandate", at)
        p = payment(c, sid, "card", at, True)
        entitlement(c, sid, T(p["captured_at"]) + timedelta(days=30), p)

    # ---- three of the customers whose access was cut write in ----
    wrote = rng.sample([v for v in victims if "_paid_since" not in v], z["complaints"])
    cust = {c["id"]: c for c in people}
    for v in wrote:
        c = cust[v["customer_id"]]
        at = T(v["created_at"]) + timedelta(hours=rng.uniform(6, 30))
        raw = rng.choice(HI if c["language_pref"] == "hi_latn" else EN).format(plan=plan["name"], amt=f"{plan['amount_paise'] / 100:g}", when=rng.choice(["kal subah", "aaj subah", "parso"]) if c["language_pref"] == "hi_latn" else T(v["created_at"]).strftime("%d %b"), ref=v["id"])
        comps.append(dict(id=rng.rid("cmp_", 10), merchant_id=MID, channel=rng.weighted({"whatsapp_payments": 0.5, "email": 0.3, "ray_forward": 0.2}), received_at=iso(at),
                          from_handle="tok_" + hashlib.sha1(c["phone"].encode()).hexdigest()[:8], raw_text=raw, raw_hash=hashlib.sha256(raw.encode()).hexdigest(),
                          redacted_text=raw.replace(v["id"], "<REF_1>"), attachment_path=None, data_role="merchant_data_processor", thread_id=None,
                          customer_ref="tok_" + hashlib.sha1(c["phone"].encode()).hexdigest()[:8], _payment=v["id"], _language=c["language_pref"]))

    # ---- simulated behaviour after a renewal link (labelled synthetic). Drawn last, so nothing above moves. Merged into what Zone 1 wrote: customer ids never overlap. ----
    sim = z["recovery"]
    row = world.execute("SELECT value FROM settings WHERE key = 'sim.recovery'").fetchone()
    behaviour = json.loads(row["value"]) if row else {"label": "synthetic", "link": {}, "organic": {}}
    for cid in [v["customer_id"] for v in victims if "_paid_since" not in v] + [r["customer_id"] for r in converted]:
        for key, p in (("link", sim["pay_with_link"]), ("organic", sim["pay_without_link"])):
            behaviour[key][cid] = round(rng.uniform(1, sim["max_delay_hours"]), 1) if rng.random() < p else None
    world.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('sim.recovery', ?)", (json.dumps(behaviour),))

    def ins(db: sqlite3.Connection, table: str, rows: list[dict]) -> None:
        rows = [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]
        if rows:
            cols = list(rows[0])
            db.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [tuple(r[c] for c in cols) for r in rows])

    ins(world, "customers", people)
    ins(world, "subscriptions", subs)
    ins(world, "payments", pays)
    ins(world, "webhook_events", events)
    ins(world, "webhook_deliveries", deliveries)
    ins(world, "entitlements", ents)
    ins(world, "complaints", comps)
    with open(out / "entitlements_snapshot.csv", "w", newline="") as f:  # rewritten from the database: a converted renewal changed an earlier row
        w = csv.DictWriter(f, fieldnames=ENT_COLS)
        w.writeheader()
        w.writerows([dict(r) for r in world.execute(f"SELECT {','.join(ENT_COLS)} FROM entitlements ORDER BY id")])

    # ---- ground truth ----
    first_ok = min(T(p["created_at"]) for p in pays if p["method"] == "card" and p["status"] == "captured" and T(p["created_at"]) > hi)
    onset = min([v["created_at"] for v in victims] + [r["created_at"] for r in converted])
    ins(truth, "truth_incidents", [dict(incident_id="INC-3", cause_code="RENEWAL_GATEWAY_ERROR_CARD", owner="razorpay", onset_at=onset, resolved_at=iso(first_ok), linked_event_id=None)])
    for p in pays:
        v = p["status"] == "failed"
        since = p.get("_paid_since")
        ins(truth, "truth_payments", [dict(payment_id=p["id"], incident_id="INC-3" if v else None, mismatch_type="G" if v else None, should_fix=0 if (not v or since) else 1,
                                           exclusion_reason="paid_since" if since else None)] if v or p["status"] == "captured" else [])
    ins(truth, "truth_complaints", [dict(complaint_id=c["id"], payment_ids=json.dumps([c["_payment"]]), mismatch_type="G", topic="payment", is_injection=0, language=c["_language"],
                                         amount_paise=plan["amount_paise"], rrn=None) for c in comps])
    world.commit()
    truth.commit()
    return dict(inc3_failed_card_renewals=len(victims) + len(converted), inc3_paid_since=len(again), inc3_complaints=len(comps), inc3_window_ends=iso(hi))
