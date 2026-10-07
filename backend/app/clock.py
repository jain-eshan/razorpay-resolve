"""All time logic goes through here. Never call datetime.now() in pipeline code."""
from datetime import datetime

from .config import BS_NOW

_offset_hours = 0


def now() -> datetime:
    from datetime import timedelta

    return BS_NOW + timedelta(hours=_offset_hours)


def advance(hours: int) -> datetime:
    global _offset_hours
    _offset_hours += hours
    return now()


def reset() -> None:
    global _offset_hours
    _offset_hours = 0
