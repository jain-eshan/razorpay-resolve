"""Order volume dip (SPEC 6.2). Orders created against what is normal for that hour. Quiet hours never alert: with fewer than 4 orders
expected there is not enough to tell a dip from chance, and the answer is `insufficient_volume`.

Scaled to this merchant. SPEC 6.2 uses a 60-minute window. At 4 or 5 orders an hour a 60-minute window cannot get under p = 0.01
unless there are no orders at all, so the window is 150 minutes (the trailing 2.5 hours)."""
from datetime import datetime, timedelta

from .baselines import Orders
from .signal import Signal, grid
from .stats import poisson_cdf

WINDOW = timedelta(minutes=150)
MIN_EXPECTED, MAX_RATIO, MAX_P = 4.0, 0.5, 0.01


def check(orders: Orders, t: datetime) -> dict:
    """What the dip monitor says about the 150 minutes before t: insufficient_volume, normal or dip."""
    lo = t - WINDOW
    exp = orders.expected(lo, t)
    obs = len(orders.between(lo, t))
    if exp is None or exp < MIN_EXPECTED:
        return {"status": "insufficient_volume", "expected": exp, "observed": obs}
    p = poisson_cdf(obs, exp)
    return {"status": "dip" if obs / exp <= MAX_RATIO and p < MAX_P else "normal", "expected": round(exp, 2), "observed": obs, "p": p}


def find(orders: Orders, now: datetime) -> list[Signal]:
    if not orders.rows:
        return []
    out: list[Signal] = []
    streak: list[tuple[datetime, dict]] = []
    for t in list(grid(orders.rows[0]["t"], now)) + [now + timedelta(days=1)]:
        c = check(orders, t) if t <= now else {"status": "end"}
        if c["status"] == "dip":
            streak.append((t, c))
            continue
        if len(streak) >= 2:
            first, last = streak[0], streak[-1]
            out.append(Signal("volume_dip", first[0] - WINDOW, last[0], streak[1][0], 1, {"expected": last[1]["expected"], "observed": last[1]["observed"], "window_minutes": 150}))
        streak = []
    return out
