"""Zone 1 world (R4, SPEC 13.2 and 13.3): problems that happen before a payment exists.

Applied on top of the finished R1 world with its own random stream, so every Hero A number stays the same. It changes the world
through SQL: it removes orders that were never created (INC-4), strips payment attempts (INC-5), adds the extra orders, failed
payments and complaints of the look-alikes, writes the pay-page check history, and writes the answers to truth.db.

Positives: INC-4 (ad links return 404 after a route rename, still broken at the snapshot) and INC-5 (checkout key rotated, the page
loads but checkout will not open). Look-alikes that must not alert: N1 a quiet night, N2 an ordinary dip, N3 questions about the course,
N4 a bank outage with real failed payments, N5 a sale with a few failed payments.
"""
from __future__ import annotations

import csv
import hashlib
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from .world import FAILS, ISSUERS, UPI_APPS, Rng, T, iso

MID, ENDPOINT = "acc_KAKSHA001", "ep_kaksha001"
ENT_COLS = ["order_id", "subscription_id", "razorpay_payment_id", "customer_id", "entitlement_state", "access_until", "updated_at", "source"]

# What a customer writes. The wording is a guess at real messages, kept simple on purpose: the extractor has to read all of it.
PAGE_EN = ["The {plan} page shows 404 not found, I cannot buy it. Rs {amt}", "Ad link for {plan} says page not found. I wanted to pay Rs {amt}, please fix it"]
PAGE_HI = ["bhai {plan} ka page khul nahi raha, 404 aa raha hai. {amt} ka lena tha", "ad ka link kaam nahi kar raha, page not found aa raha hai. {plan} {amt} ka lena hai"]
CHECKOUT_EN = ["I tap pay for {plan} (Rs {amt}) but the payment window does not open", "Checkout is not opening for {plan}, Rs {amt}. Nothing happens when I click pay"]
CHECKOUT_HI = ["{plan} ka pay button dabaya par payment window nahi khul rahi. {amt} ka hai", "checkout open nahi ho raha, {plan} {amt} ka lena tha, kuch nahi hota"]
CONTENT_EN = ["what time does the live class start tomorrow?", "when will the physics lecture recording be uploaded?", "can you add a new batch for biology?", "thanks, got it"]
CONTENT_HI = ["kal ki class ka link bhejo", "chemistry notes ka pdf mil sakta hai?", "doubt session kab hai aaj?"]
FAIL_EN = ["My UPI payment keeps failing with a bank error, Rs {amt} for {plan}", "payment failed again, card declined. {plan} Rs {amt}"]
FAIL_HI = ["UPI se payment nahi ho raha, bank error aa raha hai. {plan} {amt} ka", "payment fail ho gaya, {plan} {amt} ka lena tha"]


def token(phone: str) -> str:
    return "tok_" + hashlib.sha1(phone.encode()).hexdigest()[:8]


def apply(cfg: dict, world: sqlite3.Connection, truth: sqlite3.Connection, out: Path) -> dict:
    z = cfg["zone1"]
    rng = Rng(cfg["seed"] + 404)
    world.row_factory = sqlite3.Row
    plans = {p["id"]: p for p in cfg["plans"]}
    start, now = T(f"{cfg['world']['start']}T00:00:00"), T(cfg["snapshot_at"])
    deploy_1, resolved_1 = T(cfg["inc1"]["deploy_at"]), T(cfg["inc1"]["resolved_at"])
    deploy_4 = T(z["inc4"]["onset"])
    cust = {r["id"]: dict(r) for r in world.execute("SELECT * FROM customers ORDER BY id")}
    buyers = [c for c in cust if c.startswith("cust_o")]
    seq = [int(world.execute("SELECT MAX(CAST(SUBSTR(receipt, 9) AS INTEGER)) FROM orders").fetchone()[0])]
    truth_rows: dict[str, list[dict]] = {"truth_zone1": [], "truth_zone1_members": [], "truth_complaints": [], "truth_payments": []}
    counts: dict[str, int] = {}

    def ins(db: sqlite3.Connection, table: str, rows: list[dict]) -> None:
        if rows:
            cols = list(rows[0])
            db.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [tuple(r[c] for c in cols) for r in rows])

    def marks(n: int) -> str:
        return ",".join("?" * n)

    def web_version(ts: datetime) -> str:
        return "web-2.7.9" if ts < deploy_1 else "web-2.8.0" if ts < resolved_1 else "web-2.8.1" if ts < deploy_4 else "web-2.8.2"

    def plan_pick() -> dict:
        return plans[rng.weighted(cfg["traffic"]["plan_weights"])]

    # ---------- removing and changing orders ----------
    def payments_of(order_ids: list[str]) -> list[str]:
        return [r[0] for r in world.execute(f"SELECT id FROM payments WHERE order_id IN ({marks(len(order_ids))})", order_ids)] if order_ids else []

    def delete_payments(pids: list[str]) -> None:
        if not pids:
            return
        eids = [r[0] for r in world.execute(f"SELECT id FROM webhook_events WHERE payment_id IN ({marks(len(pids))})", pids)]
        if eids:
            world.execute(f"DELETE FROM webhook_deliveries WHERE event_id IN ({marks(len(eids))})", eids)
            world.execute(f"DELETE FROM webhook_events WHERE id IN ({marks(len(eids))})", eids)
        world.execute(f"DELETE FROM payments WHERE id IN ({marks(len(pids))})", pids)
        truth.execute(f"DELETE FROM truth_payments WHERE payment_id IN ({marks(len(pids))})", pids)

    def drop_orders(order_ids: list[str]) -> None:
        """These orders were never created: the visitor never got far enough."""
        if not order_ids:
            return
        delete_payments(payments_of(order_ids))
        world.execute(f"DELETE FROM entitlements WHERE order_id IN ({marks(len(order_ids))})", order_ids)
        world.execute(f"DELETE FROM orders WHERE id IN ({marks(len(order_ids))})", order_ids)

    def orders_between(lo: datetime, hi: datetime) -> list[sqlite3.Row]:
        return world.execute("SELECT * FROM orders WHERE created_at >= ? AND created_at < ? ORDER BY created_at, id", (iso(lo), iso(hi))).fetchall()

    # ---------- adding orders ----------
    def add_order(ts: datetime, cid: str, plan: dict, outcome: str, fail: int = 2) -> dict:
        """outcome: paid, failed (1 failed payment) or untried (an order and nothing else)."""
        c = cust[cid]
        seq[0] += 1
        order = dict(id=rng.rid("order_"), merchant_id=MID, customer_id=cid, plan_id=plan["id"], receipt=f"KK-2026-{seq[0]:06d}", amount_paise=plan["amount_paise"],
                     status="created", client_app_version="android-3.4.0" if rng.random() < 0.35 else web_version(ts), created_at=iso(ts), attempts=0,
                     first_attempt_at=None, last_attempt_at=None)
        pays, evs, dlv = [], [], []
        if outcome != "untried":
            at = ts + timedelta(seconds=40 + rng.randrange(60))
            method = rng.weighted(cfg["traffic"]["method_weights"]) if outcome == "paid" else "upi"
            ok = outcome == "paid"
            err = None if ok else FAILS[fail]
            issuer = "Sahyadri Bank" if (not ok and fail == 2) else rng.choice(ISSUERS) if method in ("upi", "netbanking") else None
            p = dict(id=rng.rid("pay_"), merchant_id=MID, order_id=order["id"], subscription_id=None, customer_id=cid, amount_paise=plan["amount_paise"], currency="INR", method=method,
                     issuer=issuer, app=rng.choice(UPI_APPS) if method == "upi" else None, card_network="Visa" if method == "card" else None,
                     card_last4=rng.digits(4) if method == "card" else None, vpa=c["vpa"] if method == "upi" else None, status="captured" if ok else "failed",
                     error_code=err[0] if err else None, error_description=err[1] if err else None, error_source=err[2] if err else None, error_step=err[3] if err else None,
                     error_reason=err[4] if err else None, rrn=rng.digits(12) if ok and method in ("upi", "netbanking") else None, upi_txn_id=None,
                     auth_code=rng.digits(6) if ok and method == "card" else None, is_renewal=0, created_at=iso(at), authorized_at=iso(at + timedelta(seconds=8)) if ok else None,
                     captured_at=iso(at + timedelta(seconds=15)) if ok else None, email=c["email"], contact=c["phone"])
            p["upi_txn_id"] = p["rrn"] if method == "upi" else None
            pays.append(p)
            order.update(attempts=1, first_attempt_at=iso(at), last_attempt_at=iso(at), status="paid" if ok else "attempted")
            if ok:
                t0 = T(p["captured_at"])
                for j, kind in enumerate(("payment.captured", "order.paid")):
                    e = dict(id=rng.rid("evt_"), merchant_id=MID, endpoint_id=ENDPOINT, event_type=kind, payment_id=p["id"], subscription_id=None, created_at=iso(t0 + timedelta(seconds=j)),
                             final_delivery_class="2xx")
                    evs.append(e)
                    dlv.append(dict(id=rng.rid("dlv_"), event_id=e["id"], attempt_no=1, attempted_at=e["created_at"], http_status=200, latency_ms=rng.randint(40, 180), error_class=None,
                                    response_body_excerpt='{"ok":true}'))
                truth_rows["truth_payments"].append(dict(payment_id=p["id"], incident_id=None, mismatch_type=None, should_fix=0, exclusion_reason=None))
        ent = dict(order_id=order["id"], subscription_id=None, razorpay_payment_id=pays[0]["id"] if pays and pays[0]["status"] == "captured" else "", customer_id=cid,
                   entitlement_state="active" if order["status"] == "paid" else "unpaid", access_until=None, updated_at=iso(ts + timedelta(seconds=55)) if order["status"] == "paid" else iso(ts),
                   source="webhook")
        ins(world, "orders", [order])
        ins(world, "payments", pays)
        ins(world, "webhook_events", evs)
        ins(world, "webhook_deliveries", dlv)
        ins(world, "entitlements", [ent])
        return order

    # ---------- complaints ----------
    def question(cid: str) -> str:
        return rng.choice(CONTENT_HI if cust[cid]["language_pref"] == "hi_latn" else CONTENT_EN)

    def say(cid: str, templates: tuple[list[str], list[str]], plan: dict) -> str:
        c = cust[cid]
        tpl = rng.choice(templates[1] if c["language_pref"] == "hi_latn" else templates[0])
        return tpl.format(plan=plan["name"], amt=f"{plan['amount_paise'] / 100:g}")

    def complaint(ts: datetime, cid: str, channel: str, text: str, topic: str, mismatch: str | None, amount: int | None) -> dict:
        tok = token(cust[cid]["phone"])
        row = dict(id=rng.rid("cmp_", 10), merchant_id=MID, channel=channel, received_at=iso(ts), from_handle=tok, raw_text=text, raw_hash=hashlib.sha256(text.encode()).hexdigest(),
                   redacted_text=text, attachment_path=None, data_role="merchant_data_processor", thread_id=None, customer_ref=tok)
        ins(world, "complaints", [row])
        truth_rows["truth_complaints"].append(dict(complaint_id=row["id"], payment_ids="[]", mismatch_type=mismatch, topic=topic, is_injection=0, language=cust[cid]["language_pref"],
                                                    amount_paise=amount, rrn=None))
        return row

    def pick_customers(n: int, exclude: set[str]) -> list[str]:
        pool = [c for c in buyers if c not in exclude]
        return rng.sample(pool, n)

    def spread(lo: datetime, hi: datetime, n: int) -> list[datetime]:
        span = int((hi - lo).total_seconds())
        return sorted(lo + timedelta(seconds=rng.randrange(span)) for _ in range(n))

    behaviour: dict[str, dict] = {"link": {}, "organic": {}}
    sim = z["recovery"]

    def behave(cid: str) -> None:
        for key, p in (("link", sim["pay_with_link"]), ("organic", sim["pay_without_link"])):
            behaviour[key][cid] = round(rng.uniform(1, sim["max_delay_hours"]), 1) if rng.random() < p else None

    paid_after = {r[0] for r in world.execute("SELECT customer_id FROM payments WHERE created_at >= ?", (iso(deploy_4),))}

    # ================= INC-4: ad links return 404, still broken at the snapshot =================
    c4 = z["inc4"]
    dropped = [o["id"] for o in orders_between(deploy_4, now + timedelta(minutes=1)) if rng.random() < c4["suppress_share"]]
    drop_orders(dropped)
    counts["inc4_orders_never_created"] = len(dropped)
    n_msg = c4["pay_trouble_complaints"] + c4["content_questions"]
    who = pick_customers(n_msg, paid_after)
    chans = [ch for ch, k in c4["channels"].items() for _ in range(k)]
    assert len(chans) == n_msg, "channel mix must add up to the number of messages"
    rng.shuffle(chans)
    content_idx = set(rng.sample([i for i, ch in enumerate(chans) if ch == "whatsapp_payments"], c4["content_questions"]))  # content questions arrive on WhatsApp
    evening = spread(deploy_4 + timedelta(minutes=10), deploy_4 + timedelta(hours=2, minutes=40), 10)
    later = spread(deploy_4 + timedelta(hours=3), now - timedelta(minutes=30), n_msg - 10)
    times = sorted(evening + later)
    paid_since = None
    for i, (cid, ch, ts) in enumerate(zip(who, chans, times, strict=True)):
        if i in content_idx:
            complaint(ts, cid, ch, question(cid), "content", None, None)
            continue
        plan = plan_pick()
        complaint(ts, cid, ch, say(cid, (PAGE_EN, PAGE_HI), plan), "payment", "Z1", plan["amount_paise"])
        role = "affected"
        if paid_since is None and c4["paid_since"] and ch == "email":
            paid_since, role = cid, "affected_paid_since"
            add_order(ts + timedelta(hours=1, minutes=20), cid, plan, "paid")
        truth_rows["truth_zone1_members"].append(dict(incident_id="INC-4", customer_id=cid, role=role))
        behave(cid)
    truth_rows["truth_zone1"].append(dict(incident_id="INC-4", onset_at=iso(deploy_4), resolved_at=None, cause_code="ROUTE_NOT_FOUND_AFTER_DEPLOY", expected_lost_orders=len(dropped), kind="positive"))

    # ================= INC-5: the page loads, checkout will not open =================
    c5 = z["inc5"]
    lo5, hi5 = T(c5["onset"]), T(c5["end"])
    base = orders_between(lo5, hi5)
    lost5 = 0
    stripped = []
    for o in base:
        if o["attempts"]:
            lost5 += 1
            stripped.append(o["id"])
    delete_payments(payments_of(stripped))
    if stripped:
        world.execute(f"UPDATE orders SET attempts = 0, first_attempt_at = NULL, last_attempt_at = NULL, status = 'created' WHERE id IN ({marks(len(stripped))})", stripped)
        world.execute(f"UPDATE entitlements SET entitlement_state = 'unpaid', razorpay_payment_id = '', access_until = NULL, source = 'webhook' WHERE order_id IN ({marks(len(stripped))})", stripped)
    extras = []
    for ts in spread(lo5, hi5, c5["extra_orders"]):
        cid = rng.choice(buyers)
        plan = plan_pick()
        extras.append(add_order(ts, cid, plan, "untried"))
        lost5 += rng.random() > cfg["traffic"]["abandonment"]  # would have gone on to pay
    window5 = orders_between(lo5, hi5)
    counts["inc5_orders_in_window"] = len(window5)
    counts["inc5_orders_with_zero_attempts"] = sum(1 for o in window5 if not o["attempts"])
    victims = rng.sample(window5, min(c5["complaints"], len(window5)))
    for o in sorted(victims, key=lambda o: o["created_at"]):
        plan = plans[o["plan_id"]]
        ts = T(o["created_at"]) + timedelta(minutes=rng.randrange(8, 30))
        ch = "whatsapp_payments" if rng.random() < 0.6 else "email"
        complaint(ts, o["customer_id"], ch, say(o["customer_id"], (CHECKOUT_EN, CHECKOUT_HI), plan), "payment", "Z1", plan["amount_paise"])
        behave(o["customer_id"])
    for o in window5:
        truth_rows["truth_zone1_members"].append(dict(incident_id="INC-5", customer_id=o["customer_id"], role="affected"))
    truth_rows["truth_zone1"].append(dict(incident_id="INC-5", onset_at=iso(lo5), resolved_at=iso(hi5), cause_code="CHECKOUT_KEY_MISMATCH", expected_lost_orders=int(lost5), kind="positive"))

    # ================= look-alikes that must not alert =================
    def negative(name: str, start_s: str, end_s: str) -> tuple[datetime, datetime]:
        lo, hi = T(start_s), T(end_s)
        truth_rows["truth_zone1"].append(dict(incident_id=name, onset_at=iso(lo), resolved_at=iso(hi), cause_code="NONE", expected_lost_orders=0, kind="negative"))
        return lo, hi

    lo, hi = negative("N1", z["n1"]["start"], z["n1"]["end"])
    drop_orders([o["id"] for o in orders_between(lo, hi)])  # not a single order all night

    lo, hi = negative("N2", z["n2"]["start"], z["n2"]["end"])
    drop_orders([o["id"] for o in orders_between(lo, hi) if rng.random() < z["n2"]["drop_share"]])

    lo, hi = negative("N3", z["n3"]["start"], z["n3"]["end"])
    for ts, cid in zip(spread(lo, hi, z["n3"]["complaints"]), pick_customers(z["n3"]["complaints"], set()), strict=True):
        complaint(ts, cid, "whatsapp_payments", question(cid), "content", None, None)

    lo, hi = negative("N4", z["n4"]["start"], z["n4"]["end"])  # a bank outage: customers really did fail to pay
    who4 = pick_customers(z["n4"]["failed_customers"], set())
    for k, (ts, cid) in enumerate(zip(spread(lo, hi - timedelta(minutes=2), len(who4)), who4, strict=True)):
        plan = plan_pick()
        add_order(ts, cid, plan, "failed", fail=2)
        if k < z["n4"]["complaints"]:
            complaint(ts + timedelta(minutes=rng.randrange(4, 14)), cid, "whatsapp_payments", say(cid, (FAIL_EN, FAIL_HI), plan), "payment", None, plan["amount_paise"])

    lo, hi = negative("N5", z["n5"]["start"], z["n5"]["end"])  # a sale: many more orders, a few customers fail to pay
    hours = int((hi - lo).total_seconds() // 3600)
    for h in range(hours):
        for _ in range(rng.poisson(z["n5"]["extra_orders_per_hour"])):
            ts = lo + timedelta(hours=h, minutes=rng.randrange(60), seconds=rng.randrange(60))
            add_order(ts, rng.choice(buyers), plan_pick(), "paid" if rng.random() < 0.9 else "failed", fail=1)
    for ts, cid in zip(spread(lo + timedelta(hours=2, minutes=10), lo + timedelta(hours=3), z["n5"]["complaints"]), pick_customers(z["n5"]["complaints"], set()), strict=True):
        plan = plan_pick()
        add_order(ts - timedelta(minutes=12), cid, plan, "failed", fail=1)
        complaint(ts, cid, "whatsapp_payments", say(cid, (FAIL_EN, FAIL_HI), plan), "payment", None, plan["amount_paise"])

    # ================= the pay-page check history =================
    probes, prev_flake, t = [], False, start
    step = timedelta(minutes=z["probe_every_minutes"])
    while t <= now:
        broken = t >= deploy_4
        flake = (not broken) and (not prev_flake) and rng.random() < z["probe_flake_rate"]
        prev_flake = flake
        if broken:
            status, ms, script, note = 404, rng.randint(80, 160), 0, "Route not found"
        elif flake:
            status, ms, script, note = 503, rng.randint(900, 2500), 1, "Service unavailable"
        else:
            status, ms, script, note = 200, rng.randint(120, 420), 1, None
        probes.append(dict(id=f"probe_{t:%Y%m%d%H%M}", merchant_id=MID, url=z["pay_url"], checked_at=iso(t), http_status=status, load_ms=ms, checkout_script_present=script, note=note))
        t += step
    ins(world, "probes", probes)

    # ================= simulated customer behaviour after a recovery link (labelled synthetic) =================
    world.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('sim.recovery', ?)", (json.dumps({"label": "synthetic", **sim, **behaviour}),))
    world.commit()

    for table, rows in truth_rows.items():
        ins(truth, table, rows)
    truth.commit()

    # the entitlement file the founder would upload, rebuilt from the final records
    with open(out / "entitlements_snapshot.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=ENT_COLS)
        w.writeheader()
        w.writerows({k: r[k] for k in ENT_COLS} for r in world.execute("SELECT * FROM entitlements ORDER BY id"))
    counts.update(probes=len(probes), zone1_complaints=len(truth_rows["truth_complaints"]))
    return counts
