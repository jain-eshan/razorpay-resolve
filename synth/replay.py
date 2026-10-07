"""Six-week replay for the learning loop (SPEC 11.4). A separate synthetic stream with its own random numbers, so no number of the main world moves.

What it contains, and what each part is for:
- orders per hour with a daily shape, a weekend lift and a baseline that drifts up every week (so a fixed baseline goes stale)
- a harmless recurring dip every Wednesday evening (a weekly live class), and irregular slow days (a holiday, an exam week) that nothing can
  predict: the founder will call every alert about either one false
- three real outages, with ground truth: two clear ones, and one partial one on a Saturday that looks like the harmless dip. A monitor that
  learned to be too strict would miss the third, and the founder's "missed incident" report is what lets it loosen again.
Everything here is invented to exercise the loop. A result on it shows the loop works as designed, not what a real merchant would see."""
import math
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
START = datetime(2026, 8, 17, tzinfo=IST)  # a Monday
WEEKS = 6
HOURLY = [0.3, 0.2, 0.2, 0.2, 0.3, 0.6, 1.2, 2, 3, 3.5, 4, 4.5, 5, 4.5, 4, 4, 4.5, 5, 6, 7, 7, 6, 4, 1.5]  # orders per hour, by hour of day
DRIFT = [1.0, 1.05, 1.12, 1.2, 1.3, 1.4]  # each week's level against week 1
WEEKEND = 1.25
WEDNESDAY_DIP = 0.25  # Wednesday 19:00 to 23:00, every week, harmless
SLOW_DAY, SLOW_SHARE = 0.12, 0.5  # each day has a 12 percent chance of running at half the usual orders, harmless
# real outages: (week 1..6, weekday 0=Mon, start hour, hours, share of normal orders left)
OUTAGES = [(2, 4, 18, 4, 0.05), (4, 1, 18, 4, 0.05), (5, 5, 17, 4, 0.30)]
SENDS_PER_WEEK, EXPLORE = 40, 0.25
P_REPLY = {"en": 0.18, "hi_latn": 0.30}  # invented: Hinglish gets more replies, and is edited less by the founder
P_EDIT = {"en": 0.35, "hi_latn": 0.20}


@dataclass
class Outage:
    start: datetime
    end: datetime


def week_end(w: int) -> datetime:
    return START + timedelta(weeks=w)


def outages() -> list[Outage]:
    out = []
    for w, d, h, n, _ in OUTAGES:
        s = START + timedelta(weeks=w - 1, days=d, hours=h)
        out.append(Outage(s, s + timedelta(hours=n)))
    return out


def _factor(t: datetime, slow: set[int]) -> float:
    f = SLOW_SHARE if (t - START).days in slow else 1.0
    f *= DRIFT[(t - START).days // 7] * (WEEKEND if t.weekday() >= 5 else 1.0)
    if t.weekday() == 2 and 19 <= t.hour < 23:
        f *= WEDNESDAY_DIP
    for (w, d, h, n, share), o in zip(OUTAGES, outages(), strict=True):
        if o.start <= t < o.end:
            f *= share
    return f


def orders(seed: int) -> list[tuple[str, str]]:
    """(order id, ISO time) for every order in the six weeks, newest last."""
    rng = random.Random(seed)
    slow = {d for d in range(WEEKS * 7) if random.Random(f"{seed}-slow-{d}").random() < SLOW_DAY}
    out, i = [], 0
    for h in range(WEEKS * 7 * 24):
        t = START + timedelta(hours=h)
        n = _poisson(rng, HOURLY[t.hour] * _factor(t, slow))
        for _ in range(n):
            i += 1
            out.append((f"order_r{i:05d}", (t + timedelta(seconds=rng.randrange(3600))).isoformat()))
    return sorted(out, key=lambda o: o[1])


def _poisson(rng: random.Random, lam: float) -> int:
    limit, k, p = math.exp(-lam), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1
