"""Four more payment issues for the enterprise demo account (FK-4 to FK-7), in the format `brand_world.py` writes for FK-1 to FK-3.

A single issue is thin for a demo, and two of the first three are closed. These four are open, each from a different place and with a different pattern in "Is it just you?":

  FK-4  29 Sep, open  HDFC Bank debited 412 customers and never confirmed to Razorpay, so their orders are on hold (the bank's side; likely, so a Razorpay support engineer signs it off first).
  FK-5  1 Oct, open   The brand's server answered a webhook slowly, Razorpay retried it, and 318 payments got two orders (the brand's code; exact).
  FK-6  2 Oct, open   (this morning, before the demo's "now" of 10:40 am) The card pay screen opens blank on iOS app 8.3, so about 960 customers left before paying (before payment, so the count is an estimate; the brand's code; likely).
  FK-7  30 Sep, open  640 coupon orders were charged the full price (the brand's code; exact).

Resolve does not look inside a payment (a payment that fails at the bank or the UPI app is Razorpay's Success Rate page), so none of these is "a payment failed at the bank".
Stands alone like `brand_world.py`: fixed seeds, nothing here reads `synth/config.yaml`, and the brand's name is not in the data (the screens carry it, web/src/lib/account.ts).
Every sentence that carries a figure is built here from the figures. Nothing is sent, refunded or cancelled in the demo: the approvals are the tab's only.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta

from .j2_brand import IST, PRICES, REGIONS, UPI_APPS, iso

ID = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
METHODS = [("upi", 56), ("card", 30), ("netbanking", 9), ("wallet", 5)]
PLATFORMS = [("Android", 70), ("iOS", 24), ("Web", 6)]


def t(day: int, hour: int, minute: int) -> datetime:
    return datetime(2026, 9 if day > 20 else 10, day, hour, minute, tzinfo=IST)


def clock(d: datetime | str) -> str:
    d = datetime.fromisoformat(d) if isinstance(d, str) else d
    return d.strftime("%-I:%M %p").lower()


def mins(a: str, b: str) -> int:
    return round((datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() / 60)


def grouped(n: int) -> str:
    s = str(n)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    parts = []
    while len(head) > 2:
        parts.insert(0, head[-2:])
        head = head[:-2]
    return ",".join([head, *parts, tail]) if head else ",".join([*parts, tail])


def rupees(paise: int) -> str:
    return "₹" + grouped(round(paise / 100))


# When each root cause was posted and signed off by Razorpay support. An exact one is posted at once and signed off within minutes; a likely one is held until it is signed off.
SIGNOFF = {
    "FK-4": (t(29, 21, 39), t(29, 21, 38)),
    "FK-5": (t(1, 18, 29), t(1, 18, 31)),
    "FK-6": (t(2, 9, 44), t(2, 9, 43)),
    "FK-7": (t(30, 20, 54), t(30, 20, 56)),
}


class World:
    def __init__(self, seed: int):
        self.rng = random.Random(seed)

    def pick(self, table: list[tuple]) -> str:
        return self.rng.choices([v for v, _ in table], weights=[w for _, w in table])[0]

    def pid(self, prefix: str = "pay_") -> str:
        return prefix + "".join(self.rng.choice(ID) for _ in range(14))

    def price(self) -> int:
        return self.rng.choices([p for p, _ in PRICES], weights=[w for _, w in PRICES])[0]

    def times(self, n: int, start: datetime, end: datetime) -> list[datetime]:
        span = int((end - start).total_seconds())
        return sorted(start + timedelta(seconds=min(span - 1, int(self.rng.triangular(0, span, span * 0.6)))) for _ in range(n))


def share(values: list[str], value: str) -> float:
    return round(sum(1 for v in values if v == value) / len(values), 4)


def normal(table: list[tuple[str, int]], value: str) -> float:
    return round(dict(table)[value] / sum(w for _, w in table), 4)


def lift(dimension: str, value: str, affected: float, usual: float) -> dict:
    return {"dimension": dimension, "value": value, "share_affected": affected, "share_baseline": usual, "lift": round(affected / usual, 2) if usual else None}


def look_alikes(rows: list[dict], key: str, table: list[tuple[str, int]], dimension: str | None = None) -> list[dict]:
    """The two biggest values of a pattern that is NOT the cause, so the panel can show they match normal."""
    mine = [r[key] for r in rows]
    return [lift(dimension or key, v, share(mine, v), normal(table, v)) for v, _ in sorted(table, key=lambda x: -x[1])[:2]]


def axis(onset: datetime) -> dict:
    """Forty minutes: ten before it starts and thirty after, a tick every ten."""
    return {"axis_from": iso(onset - timedelta(minutes=10)), "axis_to": iso(onset + timedelta(minutes=30)), "onset": iso(onset)}


def customer(w: World, at: datetime, group: str, what: str, note: str, *, prefix: str = "pay_", upi_app: str | None = None, bank: str = "Card", amount: int | None = None) -> dict:
    return {"payment_id": w.pid(prefix), "customer": f"Customer {w.rng.randrange(1000, 10000)}", "at": iso(at), "amount_paise": amount if amount is not None else w.price(),
            "upi_app": upi_app or w.pick(UPI_APPS), "bank": bank, "region": w.pick(REGIONS), "group": group, "what": what, "note": note}


def slack(rca_at: datetime, signed_at: datetime, title: str, lines: list[str], extra: list[dict] | None = None) -> dict:
    return {"channel": "razorpay-payments", "messages": [
        {"who": "Razorpay Resolve", "at": iso(rca_at), "rca": {"title": title, "lines": lines, "signed_off": f"Signed off by Razorpay support at {clock(signed_at)}"}},
        *(extra or []),
    ]}


def fk4() -> dict:
    """The bank's side: HDFC Bank debited customers during a sale and never confirmed to Razorpay, so each payment stayed pending and no order was made."""
    w = World(20260929)
    onset, last, alert = t(29, 21, 12), t(29, 21, 34), t(29, 21, 31)
    posted, signed = SIGNOFF["FK-4"]
    n, held_n = 412, 303
    stamps, again = w.times(n, onset, last), set(w.rng.sample(range(n), n - held_n))
    cust = [customer(w, at, "retried" if i in again else "held",
                     "Debited, then paid again another way" if i in again else "Debited, and the bank has not confirmed",
                     "Charged twice if the bank confirms the first" if i in again else "The order is on hold until the bank answers", bank="HDFC Bank")
            for i, at in enumerate(stamps)]
    held = [c for c in cust if c["group"] == "held"]
    retried = [c for c in cust if c["group"] == "retried"]
    s = lambda rows: sum(c["amount_paise"] for c in rows)
    signals = [f"every payment has been pending since {clock(onset)}", "every one is an HDFC Bank account", "other banks confirmed normally in the same minutes"]
    return {
        "id": "FK-4", "kind": "B", "owner": "bank", "status": "open", "confidence": "likely", "zone": "after", "inferred": False,
        "headline": f"{n} customers were debited by HDFC Bank and their orders are on hold",
        "cause": "HDFC Bank has not confirmed these payments to Razorpay",
        "onset_at": iso(onset), "resolved_at": None,
        "heard": {"via": "Resolve", "value": "Found in your payments", "note": f"{clock(alert)}, before any alert of yours", "at": iso(alert)},
        "affected": n, "complained": 38,
        "answer": {"title": "HDFC Bank has not confirmed these payments",
                   "text": f"Since {clock(onset)}, payments from HDFC Bank accounts have stayed pending. The money left the customer's account, but the bank's confirmation never reached Razorpay, "
                           "so no order was made. Razorpay and every other bank were working normally. Not yet compared with other merchants, so this is likely, not exact."},
        "groups": [
            {"id": "held", "label": "Order on hold", "count": len(held), "amount_paise": s(held), "hint": f"{rupees(s(held))} debited, waiting on the bank", "put_right": False},
            {"id": "retried", "label": "Paid again", "count": len(retried), "amount_paise": s(retried), "hint": f"{rupees(s(retried))}, charged twice if the bank confirms", "put_right": False},
        ],
        "money_stuck_paise": s(cust), "money_note": "debited and waiting",
        "lane": {**axis(onset), "rows": [
            {"name": "Razorpay", "items": [{"at": iso(onset), "label": "payments pending", "tone": "notice", "open": True}]},
            {"name": "HDFC Bank", "items": [{"at": iso(onset), "label": "no confirmations", "tone": "negative", "open": True}]},
            {"name": "Other banks", "items": [{"at": iso(onset - timedelta(minutes=10)), "to": iso(onset + timedelta(minutes=30)), "label": "confirmed normally", "tone": "positive"}]},
            {"name": "Resolve", "items": [{"at": iso(alert), "label": "found in payments", "tone": "information"}]},
        ]},
        "lift": [lift("status", "pending", 1.0, 0.03), lift("bank", "HDFC Bank", 1.0, 0.24), lift("method", "upi", 1.0, normal(METHODS, "upi")), *look_alikes(cust, "region", REGIONS)],
        "compared": "Compared with your payments in the same hours the day before",
        "cannot_see": ["customers whose bank debited them but who closed the app before the pending screen"],
        "root": {"cause": "HDFC Bank took the money but has not told Razorpay the payment went through, so each payment stays pending and no order is confirmed.",
                 "fix": "Ask HDFC Bank to confirm or reverse the payments, and keep the orders on hold until it does.", "signals": signals, "samples": [c["payment_id"] for c in cust[:3]]},
        "actions": [
            {"id": "ask", "title": "Ask HDFC Bank to confirm", "text": f"Prepares the {n} payment IDs with amounts and times ({rupees(s(cust))} in all) for your payments team to send to HDFC Bank, to confirm or reverse.",
             "button": "Prepare the list for HDFC"},
            {"id": "refund", "title": f"Refund {len(retried)} second payments", "text": f"{rupees(s(retried))} goes back to the customers who paid again by another method while HDFC was pending, so nobody is charged twice if the bank confirms the first.",
             "button": f"Refund {len(retried)} second payments", "group": "retried"},
            {"id": "message", "title": f"Message {n} customers", "text": "Tells them the money has left their account, the order is on hold, and the bank has been asked to confirm. In your name. It waits until the list is ready for HDFC.",
             "button": f"Message {n} customers", "needs": "ask", "group": "held", "told": n},
        ],
        "explained_minutes": mins(iso(onset), iso(posted)), "explained_from": "from the first pending payment, with proof",
        "closing": "The cause was HDFC Bank, not your app or Razorpay. Every action is approved. In this demo nothing was sent to the bank or the customers.",
        "previews": {"slack": slack(posted, signed, "Root cause: HDFC Bank has not confirmed payments it debited", [
            "Whose side: the bank. Confidence: likely, 3 signals agree. Not yet compared with other merchants.", f"Started: {clock(onset)}. Razorpay and every other bank are working normally.",
            f"Affected: {n} customers debited, {len(held)} orders on hold and {len(retried)} who paid again.", "Fix: ask HDFC Bank to confirm or reverse. Refund the second payments now."])},
        "customers": cust,
    }


def fk5() -> dict:
    """The brand's code: its server answered Razorpay's webhook after more than 5 seconds, Razorpay sent it again, and the server made a second order for the same payment."""
    w = World(20261001)
    release, onset, last, alert = t(1, 18, 5), t(1, 18, 5), t(1, 18, 27), t(1, 18, 24)
    posted, signed = SIGNOFF["FK-5"]
    n, packed = 318, 96
    stamps = w.times(n, onset, last)
    cust = [customer(w, at, "duplicate", "Paid once, ordered twice", "Two orders for one payment") for at in stamps]
    for c in cust:
        c["method"] = w.pick(METHODS)
    total = sum(c["amount_paise"] for c in cust)
    waiting = n - packed
    return {
        "id": "FK-5", "kind": "B", "owner": "merchant_code", "status": "open", "confidence": "exact", "zone": "after", "inferred": False,
        "headline": f"{n} customers got two orders for one payment",
        "cause": "Your server answered a webhook slowly, so Razorpay sent it again and a second order was made",
        "onset_at": iso(onset), "resolved_at": None,
        "heard": {"via": "Datadog", "value": "Alert from Datadog", "note": f"{clock(alert)}, forwarded to Razorpay", "at": iso(alert)},
        "affected": n, "complained": 52,
        "answer": {"title": "Your server is making two orders for one payment",
                   "text": f"Since server release 3.14 went live at {clock(release)}, your server takes too long to answer Razorpay's webhook. Razorpay sends it again, and each retry makes another order. "
                           "The customer was charged once."},
        "groups": [{"id": "duplicate", "label": "Two orders, one payment", "count": n, "amount_paise": total, "hint": f"{rupees(total)} in duplicate orders", "put_right": False}],
        "money_stuck_paise": total, "money_note": "in duplicate orders",
        "lane": {**axis(onset), "rows": [
            {"name": "Your server", "items": [{"at": iso(release), "label": "release 3.14, slow webhook replies", "tone": "negative", "open": True}]},
            {"name": "Razorpay", "items": [{"at": iso(onset), "label": "retrying webhooks", "tone": "notice", "open": True}]},
            {"name": "Your orders", "items": [{"at": iso(onset), "label": "two orders per payment", "tone": "negative", "open": True}]},
            {"name": "Datadog", "items": [{"at": iso(alert), "label": "alert", "tone": "information"}]},
        ]},
        "lift": [lift("delivery_outcome", "answered too slowly", 1.0, 0.01), lift("server_release", "3.14", 1.0, 0.0), *look_alikes(cust, "method", METHODS), *look_alikes(cust, "region", REGIONS)],
        "compared": "Compared with your payments in the same hours the day before",
        "cannot_see": ["orders your server made without a Razorpay payment, such as cash on delivery"],
        "root": {"cause": "Your server answered Razorpay's webhook after more than 5 seconds. Razorpay sent it again, and the server made a second order for the same payment.",
                 "fix": "Answer the webhook straight away, and ignore a payment ID that already has an order. Cancel the duplicate orders.",
                 "signals": [f"webhooks answered slowly from {clock(onset)}", "every payment has two orders", "every one came after server release 3.14"], "samples": [c["payment_id"] for c in cust[:3]]},
        "actions": [
            {"id": "orders", "title": f"Send your order team {n} duplicate orders", "text": f"The list has payment IDs, order IDs and times: {waiting} are not packed yet and can be cancelled, {packed} are packed already and have to be stopped before dispatch.",
             "button": f"Send {n} order list"},
            {"id": "message", "title": f"Message {n} customers", "text": "Tells them they were charged once, a second order was made by mistake and is being cancelled. In your name. It waits until your order team has the list.",
             "button": f"Message {n} customers", "needs": "orders", "group": "duplicate"},
        ],
        "explained_minutes": mins(iso(alert), iso(posted)), "explained_from": "from the alert, with proof",
        "closing": "The cause was your server, not Razorpay: a webhook is sent again by design when it is not answered in time. Every action is approved. In this demo nothing was cancelled or sent.",
        "previews": {"slack": slack(posted, signed, "Root cause: your server is making two orders for one payment", [
            "Whose side: your server code. Confidence: exact, 3 signals agree.", f"Started: {clock(onset)}, with server release 3.14. Razorpay and banks are working normally.",
            f"Affected: {n} customers charged once and given two orders.", "Fix: answer the webhook straight away and ignore a payment that already has an order."],
            [{"who": "On-call engineer", "at": iso(posted + timedelta(minutes=6)), "text": "Looking at the webhook handler now."}])},
        "customers": cust,
    }


def fk6() -> dict:
    """Before payment: the card pay screen opens blank on iOS app 8.3, so customers leave and Razorpay never sees an attempt. The count is an estimate, worked out from carts."""
    w = World(20261002)
    onset, last, alert = t(2, 9, 20), t(2, 9, 41), t(2, 9, 38)
    posted, signed = SIGNOFF["FK-6"]
    n, back = 960, 320
    stamps, returned = w.times(n, onset, last), set(w.rng.sample(range(n), back))
    cust = [customer(w, at, "returned" if i in returned else "lost", "Tapped Pay, then paid another way" if i in returned else "Tapped Pay and left",
                     "Bought, on UPI or net banking" if i in returned else "Has not bought since", prefix="cart_", upi_app="iOS app 8.3", bank="Card checkout") for i, at in enumerate(stamps)]
    lost = [c for c in cust if c["group"] == "lost"]
    came = [c for c in cust if c["group"] == "returned"]
    s = lambda rows: sum(c["amount_paise"] for c in rows)
    return {
        "id": "FK-6", "kind": "Z1", "owner": "merchant_code", "status": "open", "confidence": "likely", "zone": "before", "inferred": True,
        "headline": f"About {n} customers could not pay by card on the iPhone app",
        "cause": "The card pay screen opens blank on iOS app 8.3",
        "onset_at": iso(onset), "resolved_at": None,
        "heard": {"via": "Sentry", "value": "Alert from Sentry", "note": f"{clock(alert)}, forwarded to Razorpay", "at": iso(alert)},
        "affected": n, "complained": 71,
        "answer": {"title": "The pay screen is blank for cards on iPhone",
                   "text": f"Since app 8.3 reached iPhones at {clock(onset)}, choosing a card opens an empty screen. No payment is made, so Razorpay has nothing to match. "
                           "The count is an estimate, worked out from carts that reached the pay screen and stopped."},
        "groups": [
            {"id": "lost", "label": "Left without paying", "count": len(lost), "amount_paise": s(lost), "hint": f"About {rupees(s(lost))} of carts, not bought", "put_right": False},
            {"id": "returned", "label": "Paid another way", "count": len(came), "amount_paise": s(came), "hint": f"About {rupees(s(came))} bought after leaving", "put_right": True},
        ],
        "money_stuck_paise": s(cust), "money_note": "of carts, estimated",
        "lane": {**axis(onset), "rows": [
            {"name": "Your app", "items": [{"at": iso(onset), "label": "iOS 8.3 rollout", "tone": "neutral"}]},
            {"name": "Your pay screen", "items": [{"at": iso(onset), "label": "blank for cards", "tone": "negative", "open": True}]},
            {"name": "Razorpay", "items": [{"at": iso(onset), "label": "no card attempts from iOS", "tone": "notice", "open": True}]},
            {"name": "Sentry", "items": [{"at": iso(alert), "label": "alert", "tone": "information"}]},
        ]},
        "lift": [lift("platform", "iOS", 1.0, normal(PLATFORMS, "iOS")), lift("app_version", "8.3", 1.0, 0.0), lift("checkout_method", "card", 1.0, normal(METHODS, "card")), *look_alikes(cust, "region", REGIONS)],
        "compared": "Compared with your card checkouts in the same hours the day before",
        "cannot_see": ["customers who left the app before they reached the pay screen"],
        "root": {"cause": "After the iOS app 8.3 update, the pay screen opens blank when the customer picks a card. Razorpay never sees an attempt, so these are counted from carts, not payments.",
                 "fix": "Roll the Razorpay SDK in app 8.3 back to the version in 8.2, or ship a patch, and invite the customers back.",
                 "signals": [f"card checkouts opened blank from {clock(onset)}", "every one is the iOS app, version 8.3", "Android and web card payments were normal"], "samples": [c["payment_id"] for c in cust[:3]]},
        "actions": [
            {"id": "cause", "title": "Send your app team the cause", "text": "The SDK version that broke the pay screen, the 8.2 version that worked, and when card checkouts started opening blank.", "button": "Send the cause"},
            {"id": "carts", "title": f"Send your team about {len(lost)} lost carts", "text": f"About {rupees(s(lost))} of carts were left. The list has cart IDs, values and times, so the carts can be kept open.", "button": f"Send about {len(lost)} carts"},
            {"id": "message", "title": f"Message about {len(lost)} customers", "text": "Tells them card payments on the iPhone app had a fault and their cart is saved. In your name. It waits until your team has the carts.",
             "button": f"Message about {len(lost)} customers", "needs": "carts", "group": "lost"},
        ],
        "explained_minutes": mins(iso(alert), iso(posted)), "explained_from": "from the alert, an estimate",
        "closing": "The cause was your app, not Razorpay or a bank. The count is an estimate from carts. Every action is approved. In this demo nothing was sent.",
        "previews": {"slack": slack(posted, signed, "Root cause: the card pay screen is blank on iOS app 8.3", [
            "Whose side: your app code. Confidence: likely, 3 signals agree. The count is an estimate from carts.", f"Started: {clock(onset)}, with the iOS 8.3 rollout. Android and web card payments are normal.",
            f"Affected: about {n} customers left the card pay screen without paying.", "Fix: roll back the SDK in 8.3, or patch it."])},
        "customers": cust,
    }


def fk7() -> dict:
    """The brand's code: the app applies the coupon to the order total but sends the full price to Razorpay, so the payment is larger than the order."""
    w = World(20260930)
    onset, last, alert = t(30, 20, 30), t(30, 20, 51), t(30, 20, 49)
    posted, signed = SIGNOFF["FK-7"]
    n = 640
    stamps = w.times(n, onset, last)
    cust = []
    for at in stamps:
        full = w.price()
        gap = int(round(full * w.rng.choice([10, 15, 20]) / 100, -2)) if w.rng.random() < 0.64 else w.rng.choice([10000, 15000, 20000, 25000])
        c = customer(w, at, "overcharged", f"Charged {rupees(full)}, order total {rupees(full - gap)}", f"{rupees(gap)} too much", amount=gap)
        c["platform"] = w.pick(PLATFORMS)
        c["method"] = w.pick(METHODS)
        cust.append(c)
    total = sum(c["amount_paise"] for c in cust)
    return {
        "id": "FK-7", "kind": "B", "owner": "merchant_code", "status": "open", "confidence": "exact", "zone": "after", "inferred": False,
        "headline": f"{n} customers were charged the full price after using a coupon",
        "cause": "Your app sends the full price to Razorpay after a coupon is applied",
        "onset_at": iso(onset), "resolved_at": None,
        "heard": {"via": "Resolve", "value": "Found in your payments", "note": f"{clock(alert)}, before any customer wrote", "at": iso(alert)},
        "affected": n, "complained": 96,
        "answer": {"title": "Coupon orders are paid at the full price",
                   "text": f"Since the coupon campaign opened at {clock(onset)}, the order shows the discounted total but the customer's payment is the full price. Razorpay captured exactly what your app asked for."},
        "groups": [{"id": "overcharged", "label": "Charged too much", "count": n, "amount_paise": total, "hint": f"{rupees(total)} to refund, the gap on each order", "put_right": False}],
        "money_stuck_paise": total, "money_note": "to refund",
        "lane": {**axis(onset), "rows": [
            {"name": "Your campaign", "items": [{"at": iso(onset), "label": "coupons live", "tone": "neutral"}]},
            {"name": "Your app", "items": [{"at": iso(onset), "label": "full price sent", "tone": "negative", "open": True}]},
            {"name": "Razorpay", "items": [{"at": iso(onset), "label": "captured as asked", "tone": "positive", "open": True}]},
            {"name": "Resolve", "items": [{"at": iso(alert), "label": "found in payments", "tone": "information"}]},
        ]},
        "lift": [lift("coupon", "used", 1.0, 0.18), lift("order_payment_gap", "payment larger than order", 1.0, 0.0), *look_alikes(cust, "platform", PLATFORMS), *look_alikes(cust, "method", METHODS)],
        "compared": "Compared with your payments in the same hours the day before",
        "cannot_see": ["customers who saw the larger charge and cancelled the order"],
        "root": {"cause": "The app applies the coupon to the order total but sends the full price to Razorpay, so the payment is larger than the order.",
                 "fix": "Send the discounted amount when the payment is created, and refund the difference.",
                 "signals": [f"order and payment amounts differ from {clock(onset)}", "every one used a coupon", "orders without a coupon matched their payments"], "samples": [c["payment_id"] for c in cust[:3]]},
        "actions": [
            {"id": "refund", "title": f"Refund the difference to {n} customers", "text": f"{rupees(total)} in all goes back to the customers' original payment methods, each the gap between what they paid and their order total.",
             "button": f"Refund {rupees(total)}", "group": "overcharged"},
            {"id": "list", "title": "Send your app team the mismatch list", "text": f"The list has {n} payment IDs, paid amounts and order totals, so the coupon code path can be found.", "button": "Send the list"},
            {"id": "message", "title": f"Message {n} customers", "text": "Tells them the discount was missed, the difference is being refunded, and when to expect it. In your name. It waits until the refund is approved.",
             "button": f"Message {n} customers", "needs": "refund", "told": n},
        ],
        "explained_minutes": mins(iso(onset), iso(posted)), "explained_from": "from the campaign start, with proof",
        "closing": "The cause was your app, not Razorpay or a bank. Every action is approved. In this demo nothing was refunded or sent.",
        "previews": {"slack": slack(posted, signed, "Root cause: coupon orders are being charged the full price", [
            "Whose side: your app code. Confidence: exact, 3 signals agree.", f"Started: {clock(onset)}, when the coupon campaign opened.",
            f"Affected: {n} customers charged more than their order total, {rupees(total)} in all.", "Fix: send the discounted amount, and refund the difference."])},
        "customers": cust,
    }


def extra_issues() -> list[dict]:
    return [fk4(), fk5(), fk6(), fk7()]
