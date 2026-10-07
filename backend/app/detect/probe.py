"""Pay-URL probe (SPEC 6.2). Every 5 minutes the merchant's pay page is requested. A check fails on status 400 or above, a load over
5 seconds, or no Razorpay checkout script on the page. One failure is noise. Two in a row raise a signal."""
import sqlite3
from collections import Counter
from datetime import datetime

from ..zone1.signal import Signal

SLOW_MS = 5000
CONSECUTIVE = 2


def failed(r: sqlite3.Row) -> bool:
    return r["http_status"] >= 400 or r["load_ms"] > SLOW_MS or not r["checkout_script_present"]


def find(db: sqlite3.Connection) -> list[Signal]:
    rows = db.execute("SELECT * FROM probes ORDER BY checked_at").fetchall()
    out: list[Signal] = []
    run: list[sqlite3.Row] = []

    def close(end: datetime | None) -> None:
        if len(run) >= CONSECUTIVE:
            statuses = Counter(str(r["http_status"]) for r in run)
            out.append(Signal("probe", datetime.fromisoformat(run[0]["checked_at"]), end, datetime.fromisoformat(run[CONSECUTIVE - 1]["checked_at"]), 2,
                              {"failed_checks": len(run), "statuses": dict(statuses), "first_status": run[0]["http_status"], "url": run[0]["url"],
                               "script_missing": sum(1 for r in run if not r["checkout_script_present"]), "ongoing": end is None}))

    for r in rows:
        if failed(r):
            run.append(r)
        else:
            close(datetime.fromisoformat(r["checked_at"]))
            run = []
    close(None)
    return out
