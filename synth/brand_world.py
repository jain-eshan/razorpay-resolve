"""The enterprise demo account (v3, two accounts): a large shopping app on Razorpay, with three payment issues and the alerts its tools sent in the same week.

Stands alone like `synth/j2_brand.py`: nothing here reads `synth/config.yaml` or the engine, so no frozen contract moves. Fixed seeds, so the files are the same on every run (a test
checks the committed files against a fresh run). Every figure the account's screens show is in these files; the words around the figures are built here too, so a screen only lays
them out. The brand's name is not in the data: the screens carry it (web/src/lib/account.ts).

  FK-1  1 Oct, open    Android app 8.2 shows "Payment failed" after a UPI payment that went through (the brand's code; `j2_brand.py`). Waits for the brand's approvals.
  FK-2  28 Sep, closed Razorpay delayed the brand's webhooks for 75 minutes, so paid orders sat unconfirmed (Razorpay's side; replayed by Razorpay, free).
  FK-3  24 Sep, closed iOS app 6.4 let a double tap place two orders, so some customers were charged twice (the brand's code; refunded).

Writes `web/public/brand/incidents.json` (the list, in the engine's IncidentSummary shape, so the Overview and the Payment issues page read it unchanged),
`web/public/brand/incidents/FK-n.json` (each issue's page) and `web/public/brand/alerts.json` (what the alert tools sent, and what became of each alert).
The brand's own pages (T4) read `integration.json` (the alert door and the Slack channel), `connectors.json`, `settings.json` (approvals, limits, Razorpay support sign-off)
and `audit.json` (what happened on the account, newest first), all in the same folder.
Run: `uv run python -m synth.brand_world`.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from .j2_brand import BANKS, IST, PRICES, REGIONS, UPI_APPS, iso
from .j2_brand import generate as fk1_core

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "brand"
ID = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def t(day: int, hour: int, minute: int, second: int = 0) -> datetime:
    return datetime(2026, 9 if day > 20 else 10, day, hour, minute, second, tzinfo=IST)


def clock(d: datetime | str) -> str:
    d = datetime.fromisoformat(d) if isinstance(d, str) else d
    return d.strftime("%-I:%M %p").lower()


def mins(a: str, b: str) -> int:
    return round((datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() / 60)


def grouped(n: int) -> str:
    """Indian digit grouping for a count: 1,240 and 12,40,000."""
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


def summary(d: dict) -> dict:
    """The issue as the list and the Overview read it: the engine's IncidentSummary fields, plus the customer-first headline."""
    waiting = sum(g["count"] for g in d["groups"] if not g["put_right"])
    return {
        "id": d["id"], "title": d["cause"], "headline": d["headline"], "mismatch_type": d["kind"], "owner": d["owner"], "status": d["status"], "inferred": False,
        "opened_by": "signal", "zone": "after", "onset_at": d["onset_at"], "would_have_alerted_at": None,
        "affected": d["affected"], "complained": d["complained"], "silent": d["affected"] - d["complained"], "fixed": d["affected"] - waiting,
        "at_risk_paise": d["money_stuck_paise"],
    }


def fk1() -> dict:
    j = fk1_core()
    c, m, tl, s = j["counts"], j["money_paise"], j["timeline"], j["sentry"]
    ver, platform = j["app_version"], j["platform"]
    first = s["per_minute"][[e["events"] for e in s["per_minute"]].index(next(e for e in [x["events"] for x in s["per_minute"]] if e > 0))]["at"]
    customers = [
        {**{k: x[k] for k in ("payment_id", "customer", "at", "amount_paise", "upi_app", "bank", "region")}, "group": x["outcome"],
         "what": "Paid again, and that one got an order" if x["outcome"] == "paid_twice" else "Paid, and no order was made",
         "note": f"This payment is the duplicate; second payment {clock(x['second_at'])}" if x["outcome"] == "paid_twice" else "Needs its order confirmed"}
        for x in j["customers"]
    ]
    return {
        "id": "FK-1", "kind": "B", "owner": "merchant_code", "status": "open", "confidence": "exact",
        "headline": f"{grouped(c['affected'])} customers were told “Payment failed” after paying",
        "cause": f"{platform} app {ver} skips the verify-payment call after UPI",
        "onset_at": tl["rollout"], "resolved_at": tl["rollback"],
        "heard": {"via": "Sentry", "value": "Alert from Sentry", "note": f"{clock(tl['alert'])}, forwarded to Razorpay", "at": tl["alert"]},
        "affected": c["affected"], "complained": 0,
        "answer": {
            "title": "Your app never told your server about these payments",
            "text": f"Since app {ver} went live at {clock(tl['rollout'])}, the app shows “Payment failed” after UPI payments that Razorpay captured. "
                    "Your server was never asked to verify them, so no order was confirmed. Razorpay and the banks were working normally.",
        },
        "groups": [
            {"id": "paid_twice", "label": "Paid twice", "count": c["paid_twice"], "amount_paise": m["paid_twice"], "hint": f"{rupees(m['paid_twice'])} to refund", "put_right": False},
            {"id": "no_order", "label": "Left with no order", "count": c["no_order"], "amount_paise": m["no_order"], "hint": f"{rupees(m['no_order'])} paid", "put_right": False},
        ],
        "money_stuck_paise": m["stuck"], "money_note": "paid, no order confirmed",
        "lane": {
            "axis_from": tl["axis_from"], "axis_to": tl["axis_to"], "onset": tl["rollout"],
            "rows": [
                {"name": "Your app", "items": [{"at": tl["rollout"], "label": f"{ver} rollout", "tone": "neutral"}, {"at": tl["rollback"], "label": "rolled back", "tone": "positive"}]},
                {"name": "Your server", "items": [{"at": tl["verify_stops"], "to": tl["rollback"], "label": "no verify-payment calls", "tone": "negative"}]},
                {"name": "Razorpay", "items": [{"at": tl["axis_from"], "to": tl["axis_to"], "label": "captured normally", "tone": "positive"}]},
                {"name": "Sentry", "items": [{"at": tl["errors_start"], "to": tl["rollback"], "label": f"errors, alert at {clock(tl['alert'])}", "tone": "notice"}]},
                {"name": "Blindspot", "items": [{"at": tl["signoff"], "label": "root cause signed off", "tone": "information"}]},
            ],
        },
        "lift": j["lift"], "compared": f"Compared with your payments in the {j['baseline_minutes']} minutes before the release",
        "cannot_see": ["customers who paid another way, such as cash on delivery or another gateway"],
        "root": {
            "cause": f"App {ver} skips the verify-payment call after UPI, so orders stay unconfirmed and the app shows “Payment failed”.",
            "fix": f"Roll back {ver}, or patch the verify-payment call.", "signals": j["signals"], "samples": j["sample_payment_ids"][:3],
        },
        "actions": [
            {"id": "refund", "title": f"Refund {c['paid_twice']} duplicate payments", "text": f"{rupees(m['paid_twice'])} goes back to each customer's original payment method.",
             "button": f"Refund {c['paid_twice']} duplicates", "group": "paid_twice"},
            {"id": "orders", "title": f"Send your order team {c['no_order']} paid orders", "text": f"{rupees(m['no_order'])} was paid with no order. The list has payment IDs, amounts and times, to confirm each order.",
             "button": f"Send {c['no_order']} order list"},
            {"id": "message", "title": f"Message {c['no_order']} customers", "text": "Tells them their payment went through and their order is confirmed, in your name. It waits until the orders are confirmed.",
             "button": f"Message {c['no_order']} customers", "needs": "orders", "group": "no_order"},
        ],
        "explained_minutes": mins(tl["alert"], tl["rca"]),
        "closing": f"Explained {mins(tl['alert'], tl['rca'])} minutes after the alert and signed off by Razorpay support at {clock(tl['signoff'])}. The cause was your app, not Razorpay or a bank.",
        "previews": {
            "app": {"platform": platform, "version": ver, "amount_paise": j["customers"][0]["amount_paise"], "item": "Wireless earbuds",
                    "said": "Payment failed", "true": "Razorpay captured the payment"},
            "alert": {"tool": "Sentry", "issue": s["issue"], "service": s["service"], "release": f"{platform.lower()}@{ver}", "events": s["events"],
                      "window_minutes": s["window_minutes"], "first_seen": first, "forwarded_at": tl["alert"], "per_minute": s["per_minute"],
                      "rule": "Payment errors, more than 20 in 10 minutes, are sent to Razorpay Blindspot"},
            "slack": {"channel": "razorpay-payments", "messages": [
                {"who": "Sentry", "at": tl["alert"], "text": f"{s['issue']} on {s['service']}: {s['events']} events in {s['window_minutes']} minutes"},
                {"who": "Razorpay Blindspot", "at": tl["rca"], "rca": {
                    "title": f"Root cause: {platform} app {ver} shows “Payment failed” after successful UPI payments",
                    "lines": [f"Whose side: your app code. Confidence: exact, {len(j['signals'])} signals agree.",
                              f"Started: {clock(tl['rollout'])}, with the {ver} rollout. Razorpay and banks are working normally.",
                              f"Affected: {grouped(c['affected'])} customers saw “failed” after paying. {c['paid_twice']} paid twice. {c['no_order']} left with no order.",
                              f"Fix: roll back {ver}, or patch the verify-payment call."],
                    "signed_off": f"Signed off by Razorpay support at {clock(tl['signoff'])}"}},
                {"who": "On-call engineer", "at": tl["rollback"], "text": f"Rolling back {ver} now."},
            ]},
        },
        "customers": customers,
    }


# When things happened on FK-2 and FK-3, kept here so the audit trail reads the same times as the issue pages.
FK2_T = {"start": t(28, 13, 5), "end": t(28, 14, 20), "rca": t(28, 13, 24), "done": t(28, 14, 34)}
FK3_T = {"release": t(24, 21, 10), "first": t(24, 21, 12), "alert": t(24, 21, 31), "fixed": t(24, 23, 40), "refunded": t(25, 11, 5)}


def fk2() -> dict:
    """Razorpay's side: its webhook queue for this account backed up for 75 minutes. Payments were captured, but the brand's order service waits for the webhook, so orders sat unconfirmed."""
    rng = random.Random(20260928)
    start, end, rca, done = FK2_T["start"], FK2_T["end"], FK2_T["rca"], FK2_T["done"]
    n, complained = 214, 37
    customers = []
    for i in range(n):
        at_ = start + timedelta(seconds=rng.randrange(int((end - start).total_seconds())))
        late = rng.randrange(16, 76)
        customers.append({"payment_id": "pay_" + "".join(rng.choice(ID) for _ in range(14)), "customer": f"Customer {rng.randrange(1000, 10000)}", "at": iso(at_),
                          "amount_paise": rng.choices([p for p, _ in PRICES], weights=[w for _, w in PRICES])[0], "upi_app": rng.choices(*zip(*UPI_APPS))[0],
                          "bank": rng.choices(*zip(*BANKS))[0], "region": rng.choices(*zip(*REGIONS))[0], "group": "confirmed_late",
                          "what": f"Order confirmed {late} minutes late", "note": "Confirmed after Razorpay replayed the webhook"})
    customers.sort(key=lambda x: x["at"])
    total = sum(x["amount_paise"] for x in customers)
    return {
        "id": "FK-2", "kind": "A", "owner": "razorpay", "status": "closed", "confidence": "exact",
        "headline": f"{grouped(n)} customers paid and waited up to 75 minutes for their order",
        "cause": "Razorpay delayed this account's webhooks for 75 minutes",
        "onset_at": iso(start), "resolved_at": iso(end),
        "heard": {"via": "Razorpay", "value": "Razorpay's own monitor", "note": f"{clock(rca)}, before any alert of yours", "at": iso(rca)},
        "affected": n, "complained": complained,
        "answer": {"title": "This one was Razorpay's, and it is fixed",
                   "text": f"From {clock(start)} to {clock(end)} Razorpay sent your payment webhooks late. Payments were captured normally, but your order service waits for the webhook, "
                           "so orders sat unconfirmed. Razorpay replayed every webhook. The fix cost you nothing."},
        "groups": [{"id": "confirmed_late", "label": "Orders confirmed late", "count": n, "amount_paise": total, "hint": f"{rupees(total)} paid, all confirmed now", "put_right": True}],
        "money_stuck_paise": 0, "money_note": "all orders confirmed",
        "lane": {"axis_from": iso(t(28, 12, 50)), "axis_to": iso(t(28, 14, 50)), "onset": iso(start), "rows": [
            {"name": "Razorpay", "items": [{"at": iso(start), "to": iso(end), "label": "webhooks delayed", "tone": "negative"}]},
            {"name": "Razorpay payments", "items": [{"at": iso(t(28, 12, 50)), "to": iso(t(28, 14, 50)), "label": "captured normally", "tone": "positive"}]},
            {"name": "Your server", "items": [{"at": iso(start + timedelta(minutes=1)), "to": iso(done), "label": "orders waiting", "tone": "notice"}]},
            {"name": "Blindspot", "items": [{"at": iso(rca), "label": "root cause posted", "tone": "information"}]},
        ]},
        "lift": [
            {"dimension": "delivery_outcome", "value": "late by 15 minutes or more", "share_affected": 1.0, "share_baseline": 0.003, "lift": 333.33},
            {"dimension": "method", "value": "upi", "share_affected": 0.57, "share_baseline": 0.55, "lift": 1.04},
            {"dimension": "platform", "value": "Android", "share_affected": 0.71, "share_baseline": 0.69, "lift": 1.03},
        ],
        "compared": "Compared with your payments on a normal Monday afternoon",
        "cannot_see": ["whether customers who waited bought elsewhere"],
        "root": {"cause": "A queue that sends this account's webhooks fell behind at Razorpay. Your server did nothing wrong.",
                 "fix": "Razorpay replayed every delayed webhook and added an alert on the queue. Nothing to do on your side.",
                 "signals": ["every late order had its payment captured on time", "only webhook deliveries were late, for every method and app", "Razorpay's queue shows the backlog"],
                 "samples": [x["payment_id"] for x in customers[:3]]},
        "actions": [
            {"id": "replay", "title": f"Replay {n} webhooks", "text": "Done by Razorpay. Every order was confirmed by " + clock(done) + ".", "button": "Replayed", "done_by": "Razorpay", "done": True, "group": "confirmed_late"},
            {"id": "pack", "title": "Evidence pack to Razorpay", "text": "Payment IDs, the timeline and the cause, so nobody asks you for them again.", "button": "Sent", "done_by": "Blindspot", "done": True},
            {"id": "message", "title": f"Tell {complained} customers who wrote in", "text": "Your order is confirmed. Sorry for the wait.", "button": "Sent", "done_by": "you", "done": True},
        ],
        "explained_minutes": mins(iso(start), iso(rca)),
        "closing": f"Razorpay posted the root cause at {clock(rca)}, {mins(iso(start), iso(rca))} minutes after it began, and replayed every webhook by {clock(done)}. Razorpay's fault, so the fix was free.",
        "previews": {"slack": {"channel": "razorpay-payments", "messages": [
            {"who": "Razorpay Blindspot", "at": iso(rca), "rca": {
                "title": "Root cause: Razorpay is sending your webhooks late",
                "lines": ["Whose side: Razorpay. Your server is answering normally.", f"Started: {clock(start)}. Payments are captured normally; orders wait for the webhook.",
                          f"Affected so far: {grouped(n)} orders waiting.", "Fix: Razorpay will replay every delayed webhook. Nothing to do on your side."],
                "signed_off": f"Signed off by Razorpay support at {clock(rca + timedelta(minutes=2))}"}},
            {"who": "Razorpay Blindspot", "at": iso(done), "text": f"All {grouped(n)} webhooks replayed. Every order is confirmed."},
        ]}},
        "customers": customers,
    }


def fk3() -> dict:
    """The brand's code: iOS app 6.4 did not disable the pay button after a tap, so a double tap placed two orders and charged twice."""
    rng = random.Random(20260924)
    release, first, alert, fixed_at, refunded = (FK3_T[k] for k in ("release", "first", "alert", "fixed", "refunded"))
    n = 38
    customers = []
    for i in range(n):
        at_ = first + timedelta(seconds=rng.randrange(int((fixed_at - first).total_seconds())))
        customers.append({"payment_id": "pay_" + "".join(rng.choice(ID) for _ in range(14)), "customer": f"Customer {rng.randrange(1000, 10000)}", "at": iso(at_),
                          "amount_paise": rng.choices([p for p, _ in PRICES], weights=[w for _, w in PRICES])[0], "upi_app": "Card" if rng.random() < 0.4 else rng.choices(*zip(*UPI_APPS))[0],
                          "bank": rng.choices(*zip(*BANKS))[0], "region": rng.choices(*zip(*REGIONS))[0], "group": "refunded",
                          "what": "Charged twice, second charge refunded", "note": "Refund to the original payment method"})
    customers.sort(key=lambda x: x["at"])
    total = sum(x["amount_paise"] for x in customers)
    return {
        "id": "FK-3", "kind": "E", "owner": "merchant_code", "status": "closed", "confidence": "exact",
        "headline": f"{grouped(n)} customers were charged twice on iOS",
        "cause": "iOS app 6.4 let a double tap place two orders",
        "onset_at": iso(release), "resolved_at": iso(fixed_at),
        "heard": {"via": "Blindspot", "value": "Found in your payments", "note": f"{clock(alert)}, before any customer wrote", "at": iso(alert)},
        "affected": n, "complained": 6,
        "answer": {"title": "Your iOS app charged some customers twice, and every one is refunded",
                   "text": f"iOS app 6.4 (out at {clock(release)}) did not disable the pay button after a tap. A double tap placed two orders and Razorpay captured both. "
                           f"App 6.4.1 fixed it at {clock(fixed_at)}, and every second charge was refunded the next morning."},
        "groups": [{"id": "refunded", "label": "Charged twice", "count": n, "amount_paise": total, "hint": f"{rupees(total)} refunded", "put_right": True}],
        "money_stuck_paise": 0, "money_note": "all refunded",
        "lane": {"axis_from": iso(t(24, 21, 0)), "axis_to": iso(t(24, 23, 55)), "onset": iso(release), "rows": [
            {"name": "Your app", "items": [{"at": iso(release), "label": "6.4 out", "tone": "neutral"}, {"at": iso(fixed_at), "label": "6.4.1 fix", "tone": "positive"}]},
            {"name": "Your checkout", "items": [{"at": iso(first), "to": iso(fixed_at), "label": "second order after a double tap", "tone": "negative"}]},
            {"name": "Razorpay", "items": [{"at": iso(first), "to": iso(fixed_at), "label": "both charges captured", "tone": "positive"}]},
            {"name": "Blindspot", "items": [{"at": iso(alert), "label": "alert", "tone": "information"}]},
        ]},
        "lift": [
            {"dimension": "app_version", "value": "ios-6.4", "share_affected": 1.0, "share_baseline": 0.0, "lift": None},
            {"dimension": "platform", "value": "iOS", "share_affected": 1.0, "share_baseline": 0.24, "lift": 4.17},
            {"dimension": "method", "value": "upi", "share_affected": 0.6, "share_baseline": 0.56, "lift": 1.07},
        ],
        "compared": "Compared with your payments in the evening before the release",
        "cannot_see": ["customers who noticed the double charge and asked their bank to reverse it"],
        "root": {"cause": "iOS app 6.4 did not disable the pay button after the first tap, so a second tap created a second order and a second payment.",
                 "fix": "Disable the pay button after one tap (shipped in 6.4.1).",
                 "signals": ["two payments for the same cart within 10 seconds", "every pair came from iOS app 6.4", "no pairs on Android or the website"],
                 "samples": [x["payment_id"] for x in customers[:3]]},
        "actions": [
            {"id": "refund", "title": f"Refund {n} second charges", "text": f"{rupees(total)} back to the original payment method, one customer at a time.", "button": "Refunded", "done_by": "you", "done": True, "group": "refunded"},
            {"id": "message", "title": f"Tell {n} customers", "text": "We charged you twice by mistake. The second charge is refunded.", "button": "Sent", "done_by": "you", "done": True},
        ],
        "explained_minutes": mins(iso(release), iso(alert)),
        "closing": f"Found {mins(iso(release), iso(alert))} minutes after the release, from your payments alone. Every second charge was refunded by {clock(refunded)} the next day.",
        "previews": {"slack": {"channel": "razorpay-payments", "messages": [
            {"who": "Razorpay Blindspot", "at": iso(alert), "rca": {
                "title": "Root cause: iOS app 6.4 is charging some customers twice",
                "lines": ["Whose side: your app code. Confidence: exact, 3 signals agree.", f"Started: {clock(first)}, after 6.4 went out at {clock(release)}.",
                          "Affected so far: 9 customers charged twice, all on iOS 6.4.", "Fix: disable the pay button after one tap. Refunds wait for your approval."],
                "signed_off": f"Signed off by Razorpay support at {clock(alert + timedelta(minutes=3))}"}},
            {"who": "iOS lead", "at": iso(fixed_at), "text": "6.4.1 is live with the fix."},
        ]}},
        "customers": customers,
    }


def alerts(issues: dict) -> list[dict]:
    """What the brand's alert tools sent this week, and what Blindspot did with each: matched to Razorpay payments (an issue), dropped (not about payments), or checked and
    closed with no payment hit. An alert alone is never acted on."""
    a = issues["FK-1"]["previews"]["alert"]
    return [
        {"id": "AL-5", "tool": "Sentry", "title": a["issue"], "service": a["service"], "at": a["forwarded_at"], "events": a["events"], "status": "matched", "issue": "FK-1",
         "why": f"Matched to {grouped(issues['FK-1']['affected'])} captured payments with no verify call"},
        {"id": "AL-4", "tool": "Datadog", "title": "p95 latency above 2s", "service": "search-service", "at": iso(t(1, 18, 20)), "events": 1, "status": "dropped", "issue": None,
         "why": "Not a payment service, so it is left out by your payment filter"},
        {"id": "AL-3", "tool": "PagerDuty", "title": "5xx errors above 1%", "service": "checkout-service", "at": iso(t(30, 11, 2)), "events": 1, "status": "no_impact", "issue": None,
         "why": "Checked against Razorpay payments for those 2 minutes: payments and orders were normal, so no issue was opened"},
        {"id": "AL-2", "tool": "Razorpay", "title": "Webhook deliveries delayed", "service": "Razorpay webhooks", "at": issues["FK-2"]["heard"]["at"], "events": 1, "status": "matched", "issue": "FK-2",
         "why": f"Razorpay's own monitor. Matched to {grouped(issues['FK-2']['affected'])} orders waiting for a webhook"},
        {"id": "AL-1", "tool": "Sentry", "title": "DuplicateOrderWarning", "service": "order-service", "at": iso(t(24, 21, 25)), "events": 12, "status": "matched", "issue": "FK-3",
         "why": f"Matched to {issues['FK-3']['affected']} customers with two payments for one cart"},
        # Added for the Alerts page (T4): a second alert about FK-1 that joined it instead of opening an issue of its own, and the noise a payment filter is for.
        {"id": "AL-6", "tool": "Datadog", "title": "Order confirmations below normal", "service": "order-service", "at": iso(t(1, 19, 55)), "events": 1, "status": "matched", "issue": "FK-1",
         "why": f"Same cause as the Sentry alert at {clock(a['forwarded_at'])}, so it joined that issue instead of opening a second one"},
        {"id": "AL-7", "tool": "PagerDuty", "title": "Disk above 90%", "service": "recommendation-service", "at": iso(t(29, 3, 10)), "events": 1, "status": "dropped", "issue": None,
         "why": "Not a payment service, so it is left out by your payment filter"},
        {"id": "AL-8", "tool": "Sentry", "title": "ImageLoadTimeout", "service": "catalog-service", "at": iso(t(27, 16, 45)), "events": 230, "status": "dropped", "issue": None,
         "why": "Not a payment service, so it is left out by your payment filter"},
        {"id": "AL-9", "tool": "Datadog", "title": "Payment success rate below 92%", "service": "payment-service", "at": iso(t(26, 22, 5)), "events": 1, "status": "no_impact", "issue": None,
         "why": "Checked against Razorpay payments for those 15 minutes: one bank's UPI was slow, which Razorpay's Success Rate page covers. Every paid order was confirmed"},
    ]


# The brand's own pages (T4): Integration, Connectors, Settings and Audit trail. All of it is read-only in the demo, set up by an account manager, and every line is built here.
SET_UP = datetime(2026, 9, 12, 11, 0, tzinfo=IST)
PAYMENT_SERVICES = ["payment-service", "checkout-service", "order-service"]
GROUP_MINUTES = 10
CHANNEL = "razorpay-payments"
APPROVERS = ["Payments lead", "On-call engineering manager"]
REFUND_PER_APPROVAL, REFUND_PER_DAY, MESSAGE_PER_APPROVAL = 5_00_000_00, 20_00_000_00, 1_000
# What each alert tool sends, as its alert rule says. Razorpay's monitor is Razorpay's own and needs no rule.
TOOLS = [
    {"id": "sentry", "name": "Sentry", "rule": f"Payment errors, more than 20 in {GROUP_MINUTES} minutes"},
    {"id": "datadog", "name": "Datadog", "rule": "Monitors on order confirmations and payment success rate"},
    {"id": "pagerduty", "name": "PagerDuty", "rule": "Incidents on the services your payment filter lists"},
]


def day(d: datetime | str) -> str:
    d = datetime.fromisoformat(d) if isinstance(d, str) else d
    return f"{d.day} {d.strftime('%b')}, {clock(d)}"


def plural(n: int, one: str, many: str | None = None) -> str:
    return f"{grouped(n)} {one if n == 1 else (many or one + 's')}"


def since(al: list[dict]) -> str:
    """The alerts cover the days before the demo's "today" (2 Oct); the pages say from when, not "this week"."""
    d = datetime.fromisoformat(min(a["at"] for a in al))
    return f"since {d.day} {d.strftime('%b')}"


def signoffs(issues: dict) -> dict:
    """When Razorpay support signed off each root cause, from the times the issues use."""
    tl = fk1_core()["timeline"]
    return {"FK-1": (tl["rca"], tl["signoff"]), "FK-2": (iso(FK2_T["rca"]), iso(FK2_T["rca"] + timedelta(minutes=2))),
            "FK-3": (iso(FK3_T["alert"]), iso(FK3_T["alert"] + timedelta(minutes=3)))}


def integration(al: list[dict]) -> dict:
    left_out = sorted({a["service"] for a in al if a["status"] == "dropped"})
    return {
        "set_up": f"Set up by your Razorpay account manager on {SET_UP.day} {SET_UP.strftime('%b %Y')}. In this demo it is read only.",
        "sections": [
            {"id": "door", "title": "Alert door", "subtitle": "How your alert tools send Blindspot what they see", "rows": [
                {"label": "Your alert address", "code": "https://api.razorpay.com/v1/blindspot/alerts/acc_3Fq9Tz7Wd",
                 "note": "One address for your account. Sentry, Datadog and PagerDuty send to it through an alert rule, with no change to your app."},
                {"label": "Signing", "value": "Every alert must be signed with your signing secret. Unsigned alerts are refused.",
                 "note": f"The signing secret is shown once, when you create it. Yours was created on {SET_UP.day} {SET_UP.strftime('%b')}."},
                {"label": "Counted as payments", "list": PAYMENT_SERVICES,
                 "note": "Your payment filter. Alerts from these services are checked against your payments."},
                {"label": f"Left out {since(al)}", "list": left_out, "note": "Alerts from any other service are dropped on arrival and never read."},
                {"label": "What is read from an alert", "list": ["Time window", "Error type", "Service or endpoint", "Platform and app version", "Sample order or payment IDs"]},
                {"label": "Never needed", "list": ["Customer names", "Phone numbers or email addresses", "Card or bank details"],
                 "note": "Fields like these are dropped before an alert is stored."},
                {"label": "Grouping", "value": f"Alerts about one cause within {GROUP_MINUTES} minutes join one payment issue.",
                 "note": "So 200 alerts in a bad release are one issue, posted once."},
                {"label": "Match before acting", "value": "An alert stays unconfirmed until Razorpay's payment data shows customers were hit. An alert alone is never acted on."},
            ]},
            {"id": "slack", "title": "Shared Slack channel", "subtitle": "Where root causes and approvals reach your team", "rows": [
                {"label": "Channel", "code": f"#{CHANNEL}", "note": "Blindspot posts only here, never in a channel you did not pick."},
                {"label": "Who is in it", "value": "Your payments and on-call teams, your Razorpay account manager and Razorpay support."},
                {"label": "What is posted", "list": ["A root cause, as a thread", "Approval requests for refunds, order lists and messages", "A closing note when an issue is fixed"]},
                {"label": "Who can approve", "list": APPROVERS, "note": "Approve buttons work only for these roles. Everyone else in the channel can read."},
                {"label": "Razorpay support sign-off", "value": "A Razorpay support engineer signs off every root cause. One that is only likely waits for that sign-off before it is posted.",
                 "note": "The levels are on Settings."},
            ]},
        ],
    }


def settings(issues: dict, al: list[dict]) -> dict:
    so = signoffs(issues)
    slowest = max(mins(a, b) for a, b in so.values())
    exact = sum(1 for d in issues.values() if d["confidence"] == "exact")
    return {
        "set_up": f"Set by your payments lead with your Razorpay account manager on {SET_UP.day} {SET_UP.strftime('%b %Y')}. In this demo they are read only.",
        "sections": [
            {"id": "approvals", "title": "Approvals", "subtitle": "What waits for a person, and who that is", "rows": [
                {"label": "Level", "value": "Review first", "note": "Every refund, order list and message waits for an approver. Root causes are posted without waiting."},
                {"label": "Waits for approval", "list": ["Refunds", "Messages to customers", "Order lists sent to your team"]},
                {"label": "Who approves", "list": APPROVERS, "note": f"In #{CHANNEL} or on the payment issue's page."},
            ]},
            {"id": "limits", "title": "Limits", "subtitle": "The most one approval can do", "rows": [
                {"label": "Refunds in one approval", "value": rupees(REFUND_PER_APPROVAL), "note": "More than this needs a second approver."},
                {"label": "Refunds in a day", "value": rupees(REFUND_PER_DAY), "note": "Refunds stop for the day once this much has gone out."},
                {"label": "Customers in one message approval", "value": grouped(MESSAGE_PER_APPROVAL), "note": "More than this needs a second approver."},
                {"label": "Refunds go to", "value": "The customer's original payment method, and nowhere else."},
            ]},
            {"id": "signoff", "title": "Razorpay support sign-off", "subtitle": "No root cause reaches you unseen by a person at Razorpay", "rows": [
                {"label": "Exact: the signals agree", "value": "Posted at once. A support engineer signs it off in the thread within 15 minutes."},
                {"label": "Likely", "value": "Held until a support engineer signs it off, then posted."},
                {"label": "Not sure", "value": "Not posted. Support looks into it and says so in the channel."},
                {"label": "S" + since(al)[1:], "value": f"{plural(exact, 'root cause')} posted, all exact, all signed off",
                 "note": f"The slowest sign-off came {plural(slowest, 'minute')} after the root cause was posted."},
            ]},
            {"id": "slack", "title": "In Slack", "subtitle": f"How #{CHANNEL} gets your team's attention", "rows": [
                {"label": "Mentions", "value": "@payments-oncall on every new root cause, and the approvers on every approval request."},
                {"label": "Quiet hours", "value": "None. Root causes are posted at any hour, and approvals wait for an approver."},
            ]},
            {"id": "never", "title": "Never, at any level", "subtitle": "No setting unlocks these", "rows": [
                {"label": "Blindspot never", "list": ["Refunds to a different payment method", "Touches your app, servers or database", "Changes your Razorpay settings",
                                                      "Messages customers outside a confirmed payment issue", "Asks anyone for a password, OTP or card details"]},
            ]},
        ],
    }


def connectors(al: list[dict], issues: dict) -> dict:
    def seen(tool: str) -> dict:
        mine = [a for a in al if a["tool"] == tool]
        last = max(mine, key=lambda a: a["at"]) if mine else None
        return {"count": f"{plural(len(mine), 'alert')} {since(al)}", "last": f"Last alert {day(last['at'])}" if last else f"No alerts {since(al)}"}
    posted = [p for p, _ in signoffs(issues).values()]
    # `title` is the small label over each card's name: what kind of connector it is.
    return {
        "groups": [
            {"id": "alerts", "title": "Alert tool", "items": [
                {"id": x["id"], "name": x["name"], "kind": "alert", "status": "connected", "sends": f"Sends: {x['rule']}", **seen(x["name"]),
                 "off": f"Disconnected. Alerts from {x['name']} are refused until you connect it again."} for x in TOOLS]},
            {"id": "razorpay", "title": "Razorpay's own monitor", "items": [
                {"id": "razorpay", "name": "Razorpay webhooks", "kind": "razorpay", "status": "on", "sends": "Sends: webhook deliveries to your servers that are late or failing", **seen("Razorpay"),
                 "off": "Switched off. Razorpay will not tell you when it delivers your webhooks late."}]},
            {"id": "answers", "title": "Where answers go", "items": [
                {"id": "slack", "name": "Slack", "kind": "slack", "status": "connected", "sends": f"Root causes, approval requests and closing notes, in #{CHANNEL} only",
                 "count": f"{plural(len(posted), 'root cause')} posted {since(al)}", "last": f"Last root cause {day(max(posted))}",
                 "off": "Disconnected. Root causes and approval requests show only on this dashboard."}]},
            {"id": "later", "title": "Helpdesk", "items": [
                {"id": "freshdesk", "name": "Freshdesk", "kind": "helpdesk", "status": "later", "sends": "Customer tickets about payments, so a complaint can start a payment issue too",
                 "count": "", "last": "", "off": ""}]},
        ],
    }


def audit(issues: dict, al: list[dict]) -> dict:
    """What happened on the account, newest first: alerts in, root causes posted and signed off, approvals and what they did. Approvals made in this tab are added by the page."""
    so = signoffs(issues)
    fk1, fk2_, fk3_ = issues["FK-1"], issues["FK-2"], issues["FK-3"]
    tl = fk1_core()["timeline"]
    word = {"matched": "matched to payments", "dropped": "left out by your payment filter", "no_impact": "checked, no payment impact"}
    ev = [
        {"at": iso(SET_UP), "kind": "setup", "summary": f"Alert door set up for Sentry, Datadog and PagerDuty, counting {', '.join(PAYMENT_SERVICES)} as payments", "actor": "Razorpay account manager", "ref": None},
        {"at": iso(SET_UP + timedelta(minutes=20)), "kind": "setup", "summary": f"Slack channel #{CHANNEL} connected", "actor": "Razorpay account manager", "ref": None},
        {"at": iso(SET_UP + timedelta(minutes=35)), "kind": "setup", "summary": f"Approvals set to Review first, refunds up to {rupees(REFUND_PER_APPROVAL)} in one approval", "actor": "Payments lead", "ref": None},
    ]
    for a in al:
        ev.append({"at": a["at"], "kind": "alert", "summary": f"{a['tool']} alert, {a['title']} on {a['service']}: {word[a['status']]}", "actor": a["tool"], "ref": a["issue"]})
    for id_, (posted, signed) in so.items():
        title = issues[id_]["previews"]["slack"]["messages"][0 if id_ != "FK-1" else 1]["rca"]["title"]
        ev.append({"at": posted, "kind": "root_cause", "summary": f"{title}, posted in #{CHANNEL}", "actor": "Blindspot", "ref": id_})
        ev.append({"at": signed, "kind": "sign_off", "summary": f"Root cause signed off, confidence {issues[id_]['confidence']}", "actor": "Razorpay support", "ref": id_})
    for x in fk1["actions"]:
        ev.append({"at": tl["rca"], "kind": "approval", "summary": f"Approval asked in #{CHANNEL}: {x['title']}", "actor": "Blindspot", "ref": "FK-1"})
    ev.append({"at": tl["rollback"], "kind": "action", "summary": f"App {fk1['previews']['app']['version']} rolled back, said in #{CHANNEL}", "actor": "Your on-call engineer", "ref": "FK-1"})
    replay, pack, msg2 = fk2_["actions"]
    ev += [
        {"at": iso(FK2_T["rca"] + timedelta(minutes=1)), "kind": "action", "summary": f"{pack['title']}: {pack['text']}", "actor": "Blindspot", "ref": "FK-2"},
        {"at": iso(FK2_T["done"]), "kind": "action", "summary": f"{replay['title']}. {replay['text']}", "actor": "Razorpay", "ref": "FK-2"},
        {"at": iso(FK2_T["done"] + timedelta(minutes=6)), "kind": "approval", "summary": f"Approved: {msg2['title']}", "actor": APPROVERS[0], "ref": "FK-2"},
        {"at": iso(FK2_T["done"] + timedelta(minutes=7)), "kind": "action", "summary": f"{msg2['title']}: sent", "actor": "Blindspot", "ref": "FK-2"},
    ]
    refund3, msg3 = fk3_["actions"]
    ev += [
        {"at": iso(FK3_T["fixed"] + timedelta(minutes=10)), "kind": "approval", "summary": f"Approved: {refund3['title']}, {fk3_['groups'][0]['hint'].replace(' refunded', '')}", "actor": APPROVERS[1], "ref": "FK-3"},
        {"at": iso(FK3_T["refunded"]), "kind": "action", "summary": f"{refund3['title']}: {refund3['text']}", "actor": "Razorpay", "ref": "FK-3"},
        {"at": iso(FK3_T["refunded"] + timedelta(minutes=5)), "kind": "approval", "summary": f"Approved: {msg3['title']}", "actor": APPROVERS[0], "ref": "FK-3"},
        {"at": iso(FK3_T["refunded"] + timedelta(minutes=6)), "kind": "action", "summary": f"{msg3['title']}: sent", "actor": "Blindspot", "ref": "FK-3"},
    ]
    # Newest first; at the same minute the later step first (the approvals asked come after the root cause they belong to).
    ev = [e for _, e in sorted(enumerate(ev), key=lambda x: (x[1]["at"], x[0]), reverse=True)]
    for i, e in enumerate(ev):
        e["id"] = f"EV-{len(ev) - i}"
    return {
        "kinds": {"alert": "Alert", "root_cause": "Root cause", "sign_off": "Sign-off", "approval": "Approval", "action": "Action", "setup": "Setup"},
        "events": ev,
        # The FK-1 approvals a judge can make on its page. Made in this tab, they are added at the top of the trail with these words.
        "pending": [{"issue": "FK-1", "action": x["id"], "summary": f"Approved: {x['title']}. In this demo nothing was refunded or sent."} for x in fk1["actions"]],
        "pending_actor": "You, in this tab",
    }


def world() -> dict:
    issues = {d["id"]: d for d in (fk1(), fk2(), fk3())}
    al = sorted(alerts(issues), key=lambda a: a["at"], reverse=True)
    return {"incidents": [summary(d) for d in issues.values()], "details": issues, "alerts": al, "integration": integration(al), "settings": settings(issues, al),
            "connectors": connectors(al, issues), "audit": audit(issues, al)}


# The brand pages' files beside alerts.json, each read at /api/brand/<name> (web/src/lib/api.ts).
PAGES = ("integration", "settings", "connectors", "audit")


def write(out: Path = OUT) -> dict:
    w = world()
    (out / "incidents").mkdir(parents=True, exist_ok=True)
    (out / "incidents.json").write_text(json.dumps(w["incidents"], indent=1, ensure_ascii=False) + "\n")
    for id_, d in w["details"].items():
        (out / "incidents" / f"{id_}.json").write_text(json.dumps(d, separators=(",", ":"), ensure_ascii=False) + "\n")
    (out / "alerts.json").write_text(json.dumps(w["alerts"], indent=1, ensure_ascii=False) + "\n")
    for name in PAGES:
        (out / f"{name}.json").write_text(json.dumps(w[name], indent=1, ensure_ascii=False) + "\n")
    return w


if __name__ == "__main__":
    w = write()
    print("brand: " + ", ".join(f"{i['id']} {i['status']} {i['affected']} hit" for i in w["incidents"]) + f"; {len(w['alerts'])} alerts, "
          + f"{len(w['audit']['events'])} audit events, {', '.join(PAGES)} -> web/public/brand/")
