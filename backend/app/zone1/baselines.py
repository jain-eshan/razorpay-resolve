"""What is normal for this merchant, worked out from its own earlier days (SPEC 6.2 and the `baselines` table).

Order volume is pooled by hour of day, weekday against weekend, because a two-week history has one sample per hour of the week.
The mean drops the highest and lowest sample, so one bad evening (or one sale) does not move it. The baseline for a moment only
uses days before that moment's day, so a monitor never looks ahead.
"""
import sqlite3
from collections import Counter
from datetime import datetime, timedelta

MIN_DAYS = 6  # fewer samples than this and there is no baseline, so a monitor stays quiet


def hour_of(t: datetime) -> datetime:
    return t.replace(minute=0, second=0, microsecond=0)


class Orders:
    """Every order, with counts per hour and the baselines built from them."""

    def __init__(self, db: sqlite3.Connection):
        self.rows = [dict(r, t=datetime.fromisoformat(r["created_at"])) for r in db.execute(
            "SELECT id, customer_id, plan_id, amount_paise, attempts, created_at FROM orders ORDER BY created_at, id")]
        self.hourly = Counter(hour_of(r["t"]) for r in self.rows)
        self.first = self.rows[0]["t"] if self.rows else None
        self._cache: dict[datetime, float | None] = {}

    def between(self, lo: datetime, hi: datetime) -> list[dict]:
        return [r for r in self.rows if lo <= r["t"] < hi]

    def expected_hour(self, h: datetime) -> float | None:
        """Orders expected in the hour starting at h. None when the history is too short to say."""
        if h in self._cache:
            return self._cache[h]
        samples, day = [], self.first.replace(hour=0, minute=0, second=0, microsecond=0) if self.first else h
        while day.date() < h.date():
            if (day.weekday() >= 5) == (h.weekday() >= 5):
                samples.append(self.hourly.get(day.replace(hour=h.hour), 0))
            day += timedelta(days=1)
        value = None
        if len(samples) >= MIN_DAYS:
            s = sorted(samples)
            s = s[1:-1] if len(s) >= 6 else s
            value = sum(s) / len(s)
        self._cache[h] = value
        return value

    def expected(self, lo: datetime, hi: datetime) -> float | None:
        """Orders expected between lo and hi: the hourly baselines, weighted by how much of each hour is inside."""
        total, h = 0.0, hour_of(lo)
        while h < hi:
            e = self.expected_hour(h)
            if e is None:
                return None
            overlap = (min(hi, h + timedelta(hours=1)) - max(lo, h)).total_seconds() / 3600
            total += e * overlap
            h += timedelta(hours=1)
        return total

    def zero_attempt_share(self, before: datetime) -> float:
        """How many orders normally never get a payment attempt (people who open checkout and leave)."""
        prior = [r for r in self.rows if r["t"] < before]
        return sum(1 for r in prior if not r["attempts"]) / len(prior) if prior else 0.2
