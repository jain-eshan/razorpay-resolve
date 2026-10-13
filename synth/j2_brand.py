"""J2 world (PRD v3, journey J2): a big brand's Android app 8.2 shows "Payment failed" after a successful UPI payment. Payment issue FK-1 of the brand account
(`synth/brand_world.py` builds the account around it and writes the files).

Stands alone: it reads nothing from `synth/config.yaml`, so no frozen contract moves. Fixed seed, so the file is the same on every run
(a test checks the committed file against a fresh run). Every number the demo screens show comes from this file; none is typed into a screen.

The story, in IST on 1 Oct 2026 (the evening before the demo's "today", 2 Oct 10:40, so it is inside every date range): app 8.2 ships at 7:40 pm and its server stops calling "verify payment" for UPI at 7:41. Razorpay captures every payment normally. Errors reach
Sentry from 7:44 and the alert fires at 7:52. Resolve posts the RCA at 7:58, a Razorpay support engineer signs it off at 7:59, the brand rolls back at 8:01.
1,240 customers paid by UPI from app 8.2 between 7:40 and 7:56 pm and saw "Payment failed". 410 of them paid a second time (by 7:58 pm, when the RCA is posted, so the numbers it states are final) and got an order; 830 left with no order.

Run: `uv run python -m synth.brand_world` (writes the files). The brand's name is not here: the screens carry it (web/src/lib/account.ts).
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

SEED = 20261012
IST = timezone(timedelta(hours=5, minutes=30))
DAY = datetime(2026, 10, 1, tzinfo=IST)

APP_VERSION = "8.2"
AFFECTED, PAID_TWICE = 1240, 410
NO_ORDER = AFFECTED - PAID_TWICE  # 830
BASELINE_MINUTES = 30  # the half hour before the rollout, 7:10 to 7:40 pm
BASELINE_PAYMENTS = 2160  # the brand's payments in those minutes

# What the brand's customers look like. The affected payments and the baseline are drawn from the same mix, so a pattern that is only in one of them is real, and the ones
# that are in both ("not one bank, UPI app or region") come out even, as the PRD says.
BANKS = [("HDFC Bank", 24), ("State Bank of India", 21), ("ICICI Bank", 19), ("Axis Bank", 13), ("Kotak Mahindra Bank", 8), ("Other banks", 15)]
UPI_APPS = [("PhonePe", 42), ("Google Pay", 34), ("Paytm", 12), ("BHIM", 6), ("Other UPI apps", 6)]
REGIONS = [("South", 31), ("North", 26), ("West", 24), ("East", 14), ("Central", 5)]
METHODS = [("upi", 56), ("card", 30), ("netbanking", 9), ("wallet", 5)]
PLATFORMS = [("Android", 70), ("iOS", 24), ("Web", 6)]
VERSIONS = [("8.1", 62), ("8.0", 28), ("7.9", 10)]  # what Android customers were on before 8.2
PRICES = [(29900, 12), (49900, 16), (79900, 18), (99900, 17), (149900, 14), (199900, 10), (299900, 7), (499900, 4), (129900, 2)]  # paise

ID = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def at(hour: int, minute: int, second: int = 0) -> datetime:
    return DAY.replace(hour=hour, minute=minute, second=second)


def iso(t: datetime) -> str:
    return t.isoformat()


def share(rows: list[str], value: str) -> float:
    return round(sum(1 for r in rows if r == value) / len(rows), 4)


def generate(seed: int = SEED) -> dict:
    rng = random.Random(seed)

    def pick(table: list[tuple]) -> str:
        return rng.choices([v for v, _ in table], weights=[w for _, w in table])[0]

    def rid(prefix: str) -> str:
        return prefix + "".join(rng.choice(ID) for _ in range(14))

    # --- the 1,240 customers: one first payment each, in time order, busier as the staged rollout reaches more phones
    start, end = at(19, 40), at(19, 58)
    span = int((end - start).total_seconds()) - 120  # the first payments stop two minutes before the RCA, so every second payment can land before it too
    times = sorted(start + timedelta(seconds=min(span - 1, int(rng.triangular(0, span, span * 0.78)))) for _ in range(AFFECTED))
    twice = set(rng.sample(range(AFFECTED), PAID_TWICE))
    customers = []
    for i, t in enumerate(times):
        c = {
            "payment_id": rid("pay_"),
            "customer": f"Customer {rng.randrange(1000, 10000)}",
            "at": iso(t),
            "amount_paise": rng.choices([p for p, _ in PRICES], weights=[w for _, w in PRICES])[0],
            "upi_app": pick(UPI_APPS),
            "bank": pick(BANKS),
            "region": pick(REGIONS),
            "outcome": "paid_twice" if i in twice else "no_order",
        }
        if i in twice:  # the customer saw "failed", tried again, and that second payment got an order
            c["second_payment_id"] = rid("pay_")
            c["second_at"] = iso(min(t + timedelta(seconds=rng.randrange(25, 180)), end - timedelta(seconds=1)))
            c["order_id"] = rid("order_")
        customers.append(c)

    def money(rows: list[dict]) -> int:
        return sum(c["amount_paise"] for c in rows)

    dup = [c for c in customers if c["outcome"] == "paid_twice"]
    gone = [c for c in customers if c["outcome"] == "no_order"]

    # --- the baseline: the brand's payments in the half hour before the rollout, drawn from the same mix. Nothing is on 8.2 yet, and a verify call is missed now and then (0.3%).
    base = []
    for _ in range(BASELINE_PAYMENTS):
        platform = pick(PLATFORMS)
        base.append({
            "method": pick(METHODS), "platform": platform, "version": pick(VERSIONS) if platform == "Android" else "none",
            "bank": pick(BANKS), "upi_app": pick(UPI_APPS), "region": pick(REGIONS), "verify": "missing" if rng.random() < 0.003 else "called",
        })

    def row(dimension: str, value: str, affected: list[str], baseline: list[str]) -> dict:
        a, b = share(affected, value), share(baseline, value)
        return {"dimension": dimension, "value": value, "share_affected": a, "share_baseline": b, "lift": round(a / b, 2) if b else None}

    n = len(customers)
    lift = [
        row("verify_call", "never made", ["never made"] * n, ["never made" if p["verify"] == "missing" else "made" for p in base]),
        row("app_version", APP_VERSION, [APP_VERSION] * n, [p["version"] for p in base]),
        row("method", "upi", ["upi"] * n, [p["method"] for p in base]),
        row("platform", "Android", ["Android"] * n, [p["platform"] for p in base]),
    ]
    # The patterns that are NOT the cause. The two biggest values of each, so the panel can show they match the baseline.
    for dim, key, table in (("bank", "bank", BANKS), ("upi_app", "upi_app", UPI_APPS), ("region", "region", REGIONS)):
        mine = [c[key] for c in customers]
        for value in [v for v, _ in sorted(table, key=lambda t: -t[1])[:2]]:
            lift.append(row(dim, value, mine, [p[key] for p in base]))

    # --- what Sentry saw: 40 PaymentVerificationError events over the 10 minutes to 7:52, none in the first minute
    ramp = [0, 1, 2, 2, 3, 4, 5, 6, 8, 9]
    scale = 40 / sum(ramp)
    per_min = [int(r * scale) for r in ramp]
    per_min[-1] += 40 - sum(per_min)
    sentry = [{"at": iso(at(19, 43) + timedelta(minutes=i)), "events": e} for i, e in enumerate(per_min)]

    t = {
        "axis_from": iso(at(19, 30)), "axis_to": iso(at(20, 10)),
        "rollout": iso(at(19, 40)), "verify_stops": iso(at(19, 41)), "errors_start": iso(at(19, 44)), "alert": iso(at(19, 52)),
        "rca": iso(at(19, 58)), "signoff": iso(at(19, 59)), "rollback": iso(at(20, 1)),
    }
    return {
        "synthetic": True,
        "app_version": APP_VERSION,
        "previous_version": VERSIONS[0][0],
        "platform": "Android",
        "day": DAY.date().isoformat(),
        "timeline": t,
        "baseline_minutes": BASELINE_MINUTES,
        "counts": {"affected": n, "paid_twice": len(dup), "no_order": len(gone), "second_payments": len(dup), "sentry_events": sum(per_min), "baseline_payments": len(base)},
        "money_paise": {"stuck": money(customers), "paid_twice": money(dup), "no_order": money(gone)},
        "sentry": {"issue": "PaymentVerificationError", "service": "payment-service", "window_minutes": 10, "events": sum(per_min), "per_minute": sentry},
        "lift": lift,
        # Three independent signals that agree, as the RCA states ("exact, 3 signals agree"): the alert, the missing verify calls, the app version.
        "signals": [f"Sentry errors from {at(19, 44).strftime('%-I:%M %p').lower()}", "no verify-payment call for any of these payments", f"every payment came from app {APP_VERSION}"],
        "sample_payment_ids": [c["payment_id"] for c in customers[:5]],
        "customers": customers,
    }

