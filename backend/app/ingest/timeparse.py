"""Deterministic time resolver (SPEC 11.2.1): code, not a model, turns "kal raat 10 baje" into a window.

Conventions: "kal" is yesterday. Parts of the day: subah 05-12, dopahar 12-16, shaam 16-20, raat 20-04 (the hours after midnight belong to the
next calendar day). "X baje" is X:00 plus or minus 60 minutes, with am or pm taken from the part-of-day word. No phrase at all means the
last 72 hours. A window never ends after the moment the message arrived."""
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
SLACK = timedelta(minutes=60)

DAYS = {"today": 0, "aaj": 0, "aj": 0, "kal": 1, "yesterday": 1, "yday": 1, "parso": 2, "parson": 2}
PARTS = {"subah": "morning", "savere": "morning", "morning": "morning", "dopahar": "noon", "afternoon": "noon", "dophar": "noon",
         "shaam": "evening", "sham": "evening", "evening": "evening", "raat": "night", "night": "night", "tonight": "night", "rat": "night"}
SPAN = {"morning": (5, 12), "noon": (12, 16), "evening": (16, 20), "night": (20, 28)}  # hours from midnight of the named day; 28 is 04:00 next day
DEFAULT_LOOKBACK = timedelta(hours=72)

TIME = re.compile(r"(?<![\d:.,])(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|bje|o'?clock)\b")
AGO = re.compile(r"(\d{1,2})\s*(?:din|days?|day)\s*(?:pehle|pahle|ago|purane)")


@dataclass(frozen=True)
class Window:
    start: datetime
    end: datetime
    resolved: bool  # False when the text had no time phrase and the 72-hour default was used


def _hour(h: int, part: str | None, meridiem: str | None) -> list[int]:
    """Hours since midnight of the named day that "h" can mean. Two when nothing says am or pm."""
    if meridiem == "am":
        return [0 if h == 12 else h]
    if meridiem == "pm":
        return [12 if h == 12 else h + 12]
    if h >= 13:
        return [h]
    if part == "night":
        return [24] if h == 12 else [h + 24] if h < 5 else [h + 12]
    if part == "evening":
        return [h + 12]
    if part == "noon":
        return [12] if h == 12 else [h + 12] if h < 6 else [h]
    if part == "morning":
        return [h]
    return [h, 12 if h == 12 else h + 12] if h != 12 else [0, 12]  # no clue: both readings


def resolve(text: str | None, received_at: datetime) -> Window:
    received = received_at.astimezone(IST)
    low = (text or "").lower()
    words = set(re.findall(r"[a-z']+", low))
    day = next((DAYS[w] for w in re.findall(r"[a-z]+", low) if w in DAYS), None)
    if (m := AGO.search(low)):
        day = int(m.group(1))
    part = next((PARTS[w] for w in re.findall(r"[a-z]+", low) if w in PARTS), None)
    if "tonight" in words and day is None:
        day = 0
    t = TIME.search(low)
    if day is None and part is None and t is None:
        return Window(received - DEFAULT_LOOKBACK, received, False)

    def at(date, hours: float) -> datetime:
        return datetime(date.year, date.month, date.day, tzinfo=IST) + timedelta(hours=hours)

    def window(date) -> tuple[datetime, datetime]:
        if t:
            hrs = _hour(int(t.group(1)), part, t.group(3) if t.group(3) in ("am", "pm") else None)
            mins = int(t.group(2) or 0) / 60
            return at(date, min(hrs) + mins) - SLACK, at(date, max(hrs) + mins) + SLACK
        if part:
            lo, hi = SPAN[part]
            return at(date, lo), at(date, hi)
        return at(date, 0), at(date, 24)

    if day is None and t:  # take the most recent reading of the clock time that is not in the future
        mins = int(t.group(2) or 0) / 60
        for back in (0, 1):
            date = received.date() - timedelta(days=back)
            hrs = _hour(int(t.group(1)), part, t.group(3) if t.group(3) in ("am", "pm") else None)
            ok = [h for h in hrs if at(date, h + mins) <= received]
            if ok:
                return Window(at(date, min(ok) + mins) - SLACK, min(at(date, max(ok) + mins) + SLACK, received), True)
    base = received.date() - timedelta(days=day or 0)
    start, end = window(base)
    if day is None and start > received:  # "subah" said at 03:00 means yesterday morning
        start, end = window(base - timedelta(days=1))
    end = min(end, received)
    return Window(min(start, end), end, True)
