"""Order-attempt gap (SPEC 6.2): orders that exist but nobody tried to pay for. Checkout will not open, so the order is created and
that is all that happens.

Looks at orders created in the 90 minutes up to 10 minutes ago (the last 10 minutes get time to show an attempt). Raises when the
share without any attempt is far above what is normal for this merchant, by a binomial test, for two checks in a row.

Scaled to this merchant. SPEC 6.2 asks for at least 8 orders and p < 0.01 in 60 minutes, which assumes about 10 orders an hour.
Kaksha gets 1.5 to 4.5, so the window is 90 minutes, the minimum is 5 orders and p must be below 0.001. That is stricter, not looser."""
import sqlite3
from datetime import datetime, timedelta

from ..zone1.baselines import Orders
from ..zone1.signal import Signal, grid
from ..zone1.stats import binom_sf

WINDOW, SETTLE = timedelta(minutes=90), timedelta(minutes=10)
MIN_ORDERS, MIN_SHARE, MAX_P = 5, 0.6, 0.001


def qualifies(window: list[dict], b: float) -> tuple[bool, dict]:
    n, z = len(window), sum(1 for r in window if not r["attempts"])
    p = binom_sf(z, n, b) if n else 1.0
    ok = n >= MIN_ORDERS and z / n >= max(MIN_SHARE, b + 0.3) and p < MAX_P
    return ok, {"orders": n, "zero_attempts": z, "baseline_share": round(b, 3), "p": p}


def find(db: sqlite3.Connection, orders: Orders, now: datetime) -> list[Signal]:
    if not orders.rows:
        return []
    out: list[Signal] = []
    streak: list[tuple[datetime, dict, list[dict]]] = []
    for t in list(grid(orders.rows[0]["t"] + WINDOW, now)) + [now + timedelta(days=1)]:  # the last mark closes any open run
        window = orders.between(t - WINDOW, t - SETTLE) if t <= now else []
        ok, d = qualifies(window, orders.zero_attempt_share(t - WINDOW)) if window else (False, {})
        if ok:
            streak.append((t, d, window))
            continue
        if len(streak) >= 2:
            anchor = [r for r in streak[-1][2] if not r["attempts"]][-1]   # the last order in the final check that nobody tried to pay for
            i = orders.rows.index(anchor)
            j = i
            while j > 0 and not orders.rows[j - 1]["attempts"]:  # where that run of unattempted orders began
                j -= 1
            first = orders.rows[j]["t"]
            after = next((r for r in orders.rows[i + 1:] if r["attempts"]), None)  # the first order that did get a payment attempt: it works again
            end = after["t"] if after else None
            zero = [r for r in orders.rows[j: i + 1] if not r["attempts"]]
            out.append(Signal("order_gap", first, end, streak[1][0], 1, {**streak[-1][1], "zero_attempt_orders": len(zero), "first_order_at": first.isoformat(), "last_order_at": anchor["t"].isoformat()}))
        streak = []
    return out
