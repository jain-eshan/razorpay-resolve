"""The big-brand demo's other issues (J2 is the headline story, synth/j2_brand.py): four more payment issues for the same made-up brand, one for each place Blindspot looks.

Stands alone like j2_brand: it reads nothing from `synth/config.yaml` and writes only `web/public/brand/issues.json`. Fixed seed, so the file is the same on every run (a test checks the
committed file against a fresh run). Every number the screens show comes from this file, and the sentences that carry a number (the actions, the banner) are written here from the counts.

The four, each with a different owner and a different pattern in "Is it just you?":
  bank-pending    After payment. One bank debited customers and never confirmed to Razorpay, so the orders are on hold. Owner: the bank.
  dup-orders      After payment. The brand's server was slow to answer a webhook, Razorpay retried it, and the server made a second order. Owner: the brand's code.
  ios-checkout    Before payment. The pay screen opens blank for cards on the iOS app after an SDK update, so customers leave. Owner: the brand's code, estimated (no payment exists).
  coupon-mismatch After payment. Coupon orders were charged the full price. Owner: the brand's code.
Blindspot does not look inside a payment (bank and UPI failures are Razorpay's Success Rate page), so no issue here is "a payment failed at the bank".

Run: `uv run python -m synth.brand_issues` (writes the file). The brand's name is not here: the screens carry it (web/src/lib/brand.ts).
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

SEED = 20261013
OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "brand" / "issues.json"
IST = timezone(timedelta(hours=5, minutes=30))

REGIONS = [("South", 31), ("North", 26), ("West", 24), ("East", 14), ("Central", 5)]
UPI_APPS = [("PhonePe", 42), ("Google Pay", 34), ("Paytm", 12), ("BHIM", 6), ("Other UPI apps", 6)]
METHODS = [("upi", 56), ("card", 30), ("netbanking", 9), ("wallet", 5)]
PLATFORMS = [("Android", 70), ("iOS", 24), ("Web", 6)]
PRICES = [(29900, 12), (49900, 16), (79900, 18), (99900, 17), (149900, 14), (199900, 10), (299900, 7), (499900, 4), (129900, 2)]  # paise
ID = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def inr(paise: int) -> str:
    """₹ with Indian digit grouping, as the screens print it (Intl en-IN, no decimals)."""
    s = str(round(paise / 100))
    head, tail = s[:-3], s[-3:]
    if head:
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        tail = ",".join(parts) + "," + tail
    return f"₹{tail}"


def clock(t: datetime) -> str:
    return t.strftime("%-I:%M %p").lower()


def share(values: list[str], value: str) -> float:
    return round(sum(1 for v in values if v == value) / len(values), 4)


def baseline(table: list[tuple[str, int]], value: str) -> float:
    return round(dict(table)[value] / sum(w for _, w in table), 4)


class World:
    def __init__(self, seed: int):
        self.rng = random.Random(seed)

    def pick(self, table: list[tuple]) -> str:
        return self.rng.choices([v for v, _ in table], weights=[w for _, w in table])[0]

    def rid(self, prefix: str) -> str:
        return prefix + "".join(self.rng.choice(ID) for _ in range(14))

    def times(self, n: int, start: datetime, end: datetime) -> list[datetime]:
        span = int((end - start).total_seconds())
        return sorted(start + timedelta(seconds=min(span - 1, int(self.rng.triangular(0, span, span * 0.6)))) for _ in range(n))


def lift(dimension: str, value: str, affected: float, normal: float) -> dict:
    return {"dimension": dimension, "value": value, "share_affected": affected, "share_baseline": normal, "lift": round(affected / normal, 2) if normal else None}


def noise(w: World, rows: list[dict], key: str, table: list[tuple[str, int]], dimension: str | None = None) -> list[dict]:
    """The two biggest values of a pattern that is NOT the cause, so the panel can show it matches normal."""
    mine = [r[key] for r in rows]
    return [lift(dimension or key, v, share(mine, v), baseline(table, v)) for v, _ in sorted(table, key=lambda t: -t[1])[:2]]


def window(onset: datetime) -> dict:
    """Every issue shows 40 minutes: 10 before it starts and 30 after, a tick every 10 minutes."""
    return {"axis_from": (onset - timedelta(minutes=10)).isoformat(), "axis_to": (onset + timedelta(minutes=30)).isoformat()}


def issue(*, id: str, short: str, headline: str, cause: str, fix: str, owner: str, zone: str, inferred: bool, confidence: str, signals: list[str], started: datetime, alert: datetime,
          rca: datetime, complained: int, groups: list[dict], customers: list[dict], money_hint: str, amount_label: str, banner: dict, rows: list[dict], lifts: list[dict],
          cannot_see: str, compared: str, actions: list[dict], closing: str, sample_note: str) -> dict:
    total = sum(c["amount_paise"] for c in customers)
    for g in groups:
        mine = [c for c in customers if c["group"] == g["id"]]
        g["count"], g["money_paise"] = len(mine), sum(c["amount_paise"] for c in mine)
    return {
        "id": id, "short": short, "headline": headline, "cause": cause, "fix": fix, "owner": owner, "zone": zone, "inferred": inferred, "confidence": confidence, "signals": signals,
        "started_at": started.isoformat(), "alert_at": alert.isoformat(), "rca_at": rca.isoformat(), **window(started),
        "counts": {"affected": len(customers), "complained": complained}, "money_paise": total, "money_hint": money_hint, "amount_label": amount_label,
        "groups": groups, "banner": banner, "rows": rows, "lift": lifts, "cannot_see": cannot_see, "compared": compared, "actions": actions, "closing": closing,
        "sample_payment_ids": [c["id"] for c in customers[:5]], "sample_note": sample_note, "customers": customers,
    }


def row(c: dict, **extra) -> dict:
    return {"id": c["id"], "name": c["name"], "at": c["at"], "amount_paise": c["amount_paise"], "region": c["region"], "group": c["group"], **extra}


def bank_pending(w: World) -> dict:
    day = datetime(2026, 10, 2, tzinfo=IST)
    t0, last, alert, rca = (day.replace(hour=21, minute=m) for m in (12, 34, 31, 36))
    n, held = 412, 303
    stamps, dupes = w.times(n, t0, last), set(w.rng.sample(range(n), n - held))
    cust = [row({"id": w.rid("pay_"), "name": f"Customer {w.rng.randrange(1000, 10000)}", "at": t.isoformat(), "amount_paise": w.rng.choices([p for p, _ in PRICES], weights=[x for _, x in PRICES])[0],
                 "region": w.pick(REGIONS), "group": "retried" if i in dupes else "held"}, detail=f"{w.pick(UPI_APPS)} · HDFC Bank") for i, t in enumerate(stamps)]
    groups = [
        {"id": "held", "label": "Order on hold", "hint": "debited by HDFC Bank, not confirmed", "what": "Debited, and the bank has not confirmed", "note": "The order is on hold until the bank answers"},
        {"id": "retried", "label": "Paid again", "hint": "if the first one is confirmed, charged twice", "what": "Debited, then paid again another way", "note": "Charged twice if the bank confirms the first"},
    ]
    s = sum(c["amount_paise"] for c in cust)
    held_n = sum(1 for c in cust if c["group"] == "held")
    held_m = sum(c["amount_paise"] for c in cust if c["group"] == "held")
    return issue(
        id="bank-pending", short="HDFC Bank payments on hold", headline=f"{n} customers were debited by HDFC Bank and their orders are on hold", owner="bank", zone="after", inferred=False, confidence="Likely, 3 signals agree",
        cause="HDFC Bank took the money but has not told Razorpay the payment went through, so each payment stays pending and no order is confirmed.",
        fix="Ask HDFC Bank to confirm or reverse the payments, and keep the orders on hold until it does.",
        signals=[f"every payment has been pending since {clock(t0)}", "every one is an HDFC Bank account", "other banks confirmed normally in the same minutes"],
        started=t0, alert=alert, rca=rca, complained=38, groups=groups, customers=cust, money_hint="debited and waiting", amount_label="Debited",
        banner={"title": "HDFC Bank has not confirmed these payments", "text": f"Since {clock(t0)}, payments from HDFC Bank accounts have stayed pending. The money left the customer's account, but the bank's confirmation never reached Razorpay, so no order was made. Razorpay and every other bank were working normally."},
        rows=[
            {"name": "Sale", "items": [{"at": t0.replace(minute=2).isoformat(), "to": t0.replace(minute=42).isoformat(), "label": "sale running", "tone": "neutral"}]},
            {"name": "Razorpay", "items": [{"at": t0.isoformat(), "label": "payments pending", "tone": "notice", "open": True}]},
            {"name": "HDFC Bank", "items": [{"at": t0.isoformat(), "label": "no confirmations", "tone": "negative", "open": True}]},
            {"name": "Blindspot", "items": [{"at": alert.isoformat(), "label": "alert", "tone": "information"}]},
        ],
        lifts=[lift("status", "pending", 1.0, 0.03), lift("bank", "HDFC Bank", 1.0, 0.24), lift("method", "upi", 1.0, baseline(METHODS, "upi")),
               *noise(w, cust, "region", REGIONS)],
        cannot_see="customers whose bank debited them but who closed the app before the pending screen",
        compared="Compared with the brand's payments in the same hours the day before",
        actions=[
            {"id": "ask", "title": "Ask HDFC Bank to confirm", "kind": "fix", "covers": n, "text": f"Prepares the {n} payment IDs with amounts and times ({inr(s)} in all) for the brand to send to HDFC Bank, to confirm or reverse.", "button": "Prepare the list for HDFC"},
            {"id": "hold", "title": f"Ask the brand to keep {held_n} orders on hold", "kind": "fix", "covers": 0, "text": f"{inr(held_m)} is waiting on the bank. The orders stay on hold and are released when the payments are confirmed.", "button": f"Ask to hold {held_n} orders"},
            {"id": "tell", "title": f"Message {n} customers", "kind": "tell", "covers": n, "text": "Tells them the money has left their account, the order is on hold, and the bank has been asked to confirm. Written in the brand's name.", "button": f"Message {n} customers"},
        ],
        closing="The cause was HDFC Bank, not the brand's app or Razorpay. Every action is approved. In this demo nothing was sent to the bank, the brand or the customers.",
        sample_note="payment IDs",
    )


def dup_orders(w: World) -> dict:
    day = datetime(2026, 10, 2, tzinfo=IST)
    t0, last, alert, rca = (day.replace(hour=18, minute=m) for m in (5, 27, 24, 29))
    n, packed = 318, 96
    stamps, pk = w.times(n, t0, last), set(w.rng.sample(range(n), packed))
    cust = [row({"id": w.rid("pay_"), "name": f"Customer {w.rng.randrange(1000, 10000)}", "at": t.isoformat(), "amount_paise": w.rng.choices([p for p, _ in PRICES], weights=[x for _, x in PRICES])[0],
                 "region": w.pick(REGIONS), "group": "packed" if i in pk else "waiting"}, detail="Two orders, one payment") for i, t in enumerate(stamps)]
    for c in cust:
        c["method"] = w.pick(METHODS)
    groups = [
        {"id": "waiting", "label": "Duplicate not packed", "hint": "can still be cancelled", "what": "Paid once, ordered twice", "note": "The second order has not been packed yet"},
        {"id": "packed", "label": "Duplicate packed", "hint": "has to be called back", "what": "Paid once, ordered twice", "note": "The second order is already packed"},
    ]
    s = sum(c["amount_paise"] for c in cust)
    wait_n = n - packed
    return issue(
        id="dup-orders", short="Two orders for one payment", headline=f"{n} customers got two orders for one payment", owner="merchant_code", zone="after", inferred=False, confidence="Exact, 3 signals agree",
        cause="The brand's server answered Razorpay's webhook after more than 5 seconds. Razorpay sent it again, and the server made a second order for the same payment.",
        fix="Answer the webhook straight away and ignore a payment ID that already has an order. Cancel the duplicate orders.",
        signals=[f"webhooks answered slowly from {clock(t0)}", "every payment has two orders", "every one came after server release 3.14"],
        started=t0, alert=alert, rca=rca, complained=52, groups=groups, customers=cust, money_hint="in duplicate orders", amount_label="Paid",
        banner={"title": "One payment is making two orders", "text": f"Since server release 3.14 went live at {clock(t0)}, the brand's server takes too long to answer Razorpay's webhook. Razorpay retries it, and each retry makes another order. The customer was charged once."},
        rows=[
            {"name": "{brand} server", "items": [{"at": t0.isoformat(), "label": "release 3.14, slow webhook replies", "tone": "negative", "open": True}]},
            {"name": "Razorpay", "items": [{"at": t0.isoformat(), "label": "retrying webhooks", "tone": "notice", "open": True}]},
            {"name": "Orders", "items": [{"at": t0.isoformat(), "label": "two orders per payment", "tone": "negative", "open": True}]},
            {"name": "Blindspot", "items": [{"at": alert.isoformat(), "label": "alert", "tone": "information"}]},
        ],
        lifts=[lift("delivery_outcome", "answered too slowly", 1.0, 0.01), lift("server_release", "3.14", 1.0, 0.0), *noise(w, cust, "method", METHODS),
               *noise(w, cust, "region", REGIONS)],
        cannot_see="orders the brand made without a Razorpay payment, such as cash on delivery",
        compared="Compared with the brand's payments in the same hours the day before",
        actions=[
            {"id": "cancel", "title": f"Ask the brand to cancel {wait_n} duplicate orders", "kind": "fix", "covers": wait_n, "text": f"These {wait_n} duplicates are not packed yet. The brand cancels the second order and keeps the first; the customer was charged once.", "button": f"Ask to cancel {wait_n} duplicates"},
            {"id": "recall", "title": f"Ask the brand to stop {packed} packed duplicates", "kind": "fix", "covers": packed, "text": f"These {packed} are packed already. The list has order IDs and times, for the brand to stop before dispatch.", "button": f"Ask to stop {packed} packed duplicates"},
            {"id": "tell", "title": f"Message {n} customers", "kind": "tell", "covers": n, "text": "Tells them they were charged once, a second order was made by mistake and has been cancelled. Written in the brand's name.", "button": f"Message {n} customers"},
        ],
        closing="The cause was the brand's server, not Razorpay: the webhook is sent again by design when it is not answered in time. Every action is approved. In this demo nothing was cancelled or sent.",
        sample_note="payment IDs",
    )


def ios_checkout(w: World) -> dict:
    day = datetime(2026, 10, 2, tzinfo=IST)
    t0, last, alert, rca = (day.replace(hour=11, minute=m) for m in (20, 41, 38, 43))
    n, back = 960, 320
    stamps, bk = w.times(n, t0, last), set(w.rng.sample(range(n), back))
    cust = [row({"id": w.rid("cart_"), "name": f"Customer {w.rng.randrange(1000, 10000)}", "at": t.isoformat(), "amount_paise": w.rng.choices([p for p, _ in PRICES], weights=[x for _, x in PRICES])[0],
                 "region": w.pick(REGIONS), "group": "returned" if i in bk else "lost"}, detail="iOS app 8.3 · card") for i, t in enumerate(stamps)]
    groups = [
        {"id": "lost", "label": "Left without paying", "hint": "of carts, estimated, not bought", "what": "Tapped Pay and left", "note": "Has not bought since"},
        {"id": "returned", "label": "Paid another way", "hint": "bought after leaving", "what": "Tapped Pay, then paid another way", "note": "Bought, on UPI or net banking"},
    ]
    lost_n = n - back
    lost_m = sum(c["amount_paise"] for c in cust if c["group"] == "lost")
    return issue(
        id="ios-checkout", short="Blank card checkout on iPhone", headline=f"About {n} customers could not pay by card on the iPhone app", owner="merchant_code", zone="before", inferred=True, confidence="Likely, 3 signals agree",
        cause="After the iOS app 8.3 update, the pay screen opens blank when the customer picks a card. Razorpay never sees an attempt, so these are counted from carts, not payments.",
        fix="Roll the Razorpay SDK in app 8.3 back to the version in 8.2, or ship a patch, and invite the customers back.",
        signals=[f"card checkouts opened blank from {clock(t0)}", "every one is the iOS app, version 8.3", "Android and web card payments were normal"],
        started=t0, alert=alert, rca=rca, complained=71, groups=groups, customers=cust, money_hint="of carts, estimated", amount_label="Cart value",
        banner={"title": "The pay screen is blank for cards on iPhone", "text": f"Since app 8.3 reached iPhones at {clock(t0)}, choosing a card opens an empty screen. No payment is made, so Razorpay has nothing to match. The count is estimated from carts that reached the pay screen and stopped."},
        rows=[
            {"name": "{brand} app", "items": [{"at": t0.isoformat(), "label": "iOS 8.3 rollout", "tone": "neutral"}]},
            {"name": "Pay screen", "items": [{"at": t0.isoformat(), "label": "blank for cards", "tone": "negative", "open": True}]},
            {"name": "Razorpay", "items": [{"at": t0.isoformat(), "label": "no card attempts from iOS", "tone": "notice", "open": True}]},
            {"name": "Blindspot", "items": [{"at": alert.isoformat(), "label": "alert", "tone": "information"}]},
        ],
        lifts=[lift("platform", "iOS", 1.0, baseline(PLATFORMS, "iOS")), lift("app_version", "8.3", 1.0, 0.0), lift("checkout_method", "card", 1.0, baseline(METHODS, "card")),
               *noise(w, cust, "region", REGIONS)],
        cannot_see="customers who left the app before they reached the pay screen",
        compared="Compared with the brand's card checkouts in the same hours the day before",
        actions=[
            {"id": "rollback", "title": "Roll back the SDK in app 8.3", "kind": "fix", "covers": n, "text": "Sends the brand the cause, the SDK version that broke the pay screen and the 8.2 version that worked.", "button": "Send the cause to the brand"},
            {"id": "carts", "title": f"Send the brand about {lost_n} lost carts", "kind": "fix", "covers": 0, "text": f"About {inr(lost_m)} of carts were left. The list has cart IDs, values and times, for the brand to keep the carts open.", "button": f"Send about {lost_n} carts"},
            {"id": "tell", "title": f"Message about {lost_n} customers", "kind": "tell", "covers": lost_n, "text": "Tells them card payments on the iPhone app had a fault and their cart is saved. Written in the brand's name.", "button": f"Message about {lost_n} customers"},
        ],
        closing="The cause was the brand's app, not Razorpay or a bank. The count is an estimate from carts. Every action is approved. In this demo nothing was sent.",
        sample_note="cart IDs",
    )


def coupon_mismatch(w: World) -> dict:
    day = datetime(2026, 10, 2, tzinfo=IST)
    t0, last, alert, rca = (day.replace(hour=20, minute=m) for m in (30, 51, 49, 54))
    n, pct = 640, 410
    stamps, pc = w.times(n, t0, last), set(w.rng.sample(range(n), pct))
    cust = []
    for i, t in enumerate(stamps):
        full = w.rng.choices([p for p, _ in PRICES], weights=[x for _, x in PRICES])[0]
        off = round(full * w.rng.choice([10, 15, 20]) / 100, -2) if i in pc else w.rng.choice([10000, 15000, 20000, 25000])
        c = row({"id": w.rid("pay_"), "name": f"Customer {w.rng.randrange(1000, 10000)}", "at": t.isoformat(), "amount_paise": int(off), "region": w.pick(REGIONS), "group": "percent" if i in pc else "flat"},
                detail=f"Paid {inr(full)}, order total {inr(full - int(off))}")
        c["platform"] = w.pick(PLATFORMS)
        c["method"] = w.pick(METHODS)
        cust.append(c)
    groups = [
        {"id": "percent", "label": "Percentage coupon", "hint": "charged more than the order total", "what": "Charged the full price", "note": "A percentage coupon was applied to the order"},
        {"id": "flat", "label": "Flat coupon", "hint": "charged more than the order total", "what": "Charged the full price", "note": "A flat-amount coupon was applied to the order"},
    ]
    s = sum(c["amount_paise"] for c in cust)
    return issue(
        id="coupon-mismatch", short="Coupon orders overcharged", headline=f"{n} customers were charged the full price after using a coupon", owner="merchant_code", zone="after", inferred=False, confidence="Exact, 3 signals agree",
        cause="The app applies the coupon to the order total but sends the full price to Razorpay, so the payment is larger than the order.",
        fix="Send the discounted amount when the payment is created, and refund the difference.",
        signals=[f"order and payment amounts differ from {clock(t0)}", "every one used a coupon", "orders without a coupon matched their payments"],
        started=t0, alert=alert, rca=rca, complained=96, groups=groups, customers=cust, money_hint="charged too much", amount_label="Overcharged",
        banner={"title": "Coupon orders are paid at the full price", "text": f"Since the coupon campaign opened at {clock(t0)}, the order shows the discounted total but the customer's payment is the full price. Razorpay captured exactly what the app asked for."},
        rows=[
            {"name": "Campaign", "items": [{"at": t0.isoformat(), "label": "coupons live", "tone": "neutral"}]},
            {"name": "{brand} app", "items": [{"at": t0.isoformat(), "label": "full price sent", "tone": "negative", "open": True}]},
            {"name": "Razorpay", "items": [{"at": t0.isoformat(), "label": "captured as asked", "tone": "positive", "open": True}]},
            {"name": "Blindspot", "items": [{"at": alert.isoformat(), "label": "alert", "tone": "information"}]},
        ],
        lifts=[lift("coupon", "used", 1.0, 0.18), lift("order_payment_gap", "payment larger than order", 1.0, 0.0), *noise(w, cust, "platform", PLATFORMS), *noise(w, cust, "method", METHODS)],
        cannot_see="customers who saw the larger charge and cancelled the order",
        compared="Compared with the brand's payments in the same hours the day before",
        actions=[
            {"id": "refund", "title": f"Refund the difference to {n} customers", "kind": "fix", "covers": n, "text": f"{inr(s)} in all goes back to the customers' original payment methods, each the gap between what they paid and their order total.", "button": f"Refund {inr(s)}"},
            {"id": "send", "title": "Send the brand the mismatch list", "kind": "fix", "covers": 0, "text": f"The list has {n} payment IDs, paid amounts and order totals, so the brand can find the coupon code path.", "button": "Send the list"},
            {"id": "tell", "title": f"Message {n} customers", "kind": "tell", "covers": n, "text": "Tells them the discount was missed, the difference is being refunded, and when to expect it. Written in the brand's name.", "button": f"Message {n} customers"},
        ],
        closing="The cause was the brand's app, not Razorpay or a bank. Every action is approved. In this demo nothing was refunded or sent.",
        sample_note="payment IDs",
    )


def generate(seed: int = SEED) -> dict:
    w = World(seed)
    return {
        "synthetic": True,
        "issues": [bank_pending(w), dup_orders(w), ios_checkout(w), coupon_mismatch(w)],
    }


def write(path: Path = OUT) -> dict:
    data = generate()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    return data


if __name__ == "__main__":
    d = write()
    for i in d["issues"]:
        print(f"{i['id']}: {i['counts']['affected']} customers, {i['money_paise'] / 100:,.0f} rupees")
    print(f"-> {OUT.relative_to(OUT.parents[3])}")
