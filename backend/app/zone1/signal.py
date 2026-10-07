"""A signal is one monitor saying "this looks wrong from here to there". Zone 1 inference combines them (SPEC 7)."""
from dataclasses import dataclass, field
from datetime import datetime, timedelta

STEP = timedelta(minutes=30)  # every monitor looks again every half hour (SPEC 6.2)


@dataclass
class Signal:
    monitor: str                      # probe | order_gap | volume_dip | complaint_spike
    start: datetime                   # when it began, as far as this monitor can tell
    end: datetime | None              # when it stopped. None: still going at the last data point
    detected_at: datetime             # when a live monitor could have raised it
    weight: int                       # SPEC 7: probe 2, the others 1. Zero for a spike that other evidence explains
    details: dict = field(default_factory=dict)
    zone1: bool = True                # False: seen, but routed elsewhere (a bank outage, a customer-side failure)
    id: str = ""                      # set when the signal is saved


def grid(lo: datetime, hi: datetime):
    """Half-hour marks from just after lo up to hi."""
    t = lo.replace(minute=0, second=0, microsecond=0)
    while t <= lo:
        t += STEP
    while t <= hi:
        yield t
        t += STEP
