"""Webhook health monitor (F-01). Event-count based, because merchant traffic is sparse and time buckets would be empty.

An event is bad when it was never attempted (endpoint disabled) or its first two delivery attempts both failed. A run opens when
one event is strongly bad (nothing attempted, or both early attempts returned an HTTP error) or 2 of the last 3 events are bad, and
closes at the first good event after it. Alert time is the second bad event plus the second
attempt, which is what a live monitor could know.
"""
import sqlite3
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta

HANDLER = "(e.event_type = 'subscription.charged' OR (e.event_type = 'payment.captured' AND e.subscription_id IS NULL))"


@dataclass
class Run:
    endpoint_id: str
    last_good_before: datetime | None
    first_bad_at: datetime
    alert_at: datetime
    last_bad_at: datetime
    resolved_at: datetime | None
    bad_event_ids: list[str] = field(default_factory=list)
    statuses: Counter = field(default_factory=Counter)
    classes: Counter = field(default_factory=Counter)
    body_excerpt: str | None = None
    baseline_bad_rate: float = 0.0
    events_before_alert: int = 0


def _t(s: str) -> datetime:
    return datetime.fromisoformat(s)


def handler_events(db: sqlite3.Connection, endpoint_id: str) -> list[dict]:
    rows = db.execute(f"SELECT e.id, e.payment_id, e.created_at, e.final_delivery_class FROM webhook_events e WHERE e.endpoint_id = ? AND {HANDLER} ORDER BY e.created_at", (endpoint_id,)).fetchall()
    out = []
    for r in rows:
        att = db.execute("SELECT attempt_no, http_status, response_body_excerpt, attempted_at FROM webhook_deliveries WHERE event_id = ? ORDER BY attempt_no", (r["id"],)).fetchall()
        first_two_ok = any(a["http_status"] is not None and 200 <= a["http_status"] < 300 for a in att[:2])
        # strong: nothing was attempted, or both early attempts came back as HTTP errors (not network timeouts, which can be transient)
        strong = (not att) or all(a["http_status"] is not None and a["http_status"] >= 400 for a in att[:2])
        out.append({**dict(r), "t": _t(r["created_at"]), "bad": not first_two_ok, "strong": (not first_two_ok) and strong, "attempts": [dict(a) for a in att]})
    return out


def find_runs(db: sqlite3.Connection, endpoint_id: str, second_attempt_delay_s: int = 9) -> list[Run]:
    evs = handler_events(db, endpoint_id)
    runs: list[Run] = []
    cur: Run | None = None
    good_streak = 0
    for i, e in enumerate(evs):
        if cur is None:
            window = evs[max(0, i - 2): i + 1]
            if e["bad"] and (e["strong"] or sum(w["bad"] for w in window) >= 2):
                bad_in_window = [w for w in window if w["bad"]]
                first_bad = bad_in_window[0]
                prior_good = [x for x in evs[: evs.index(first_bad)] if not x["bad"]]
                cur = Run(endpoint_id, prior_good[-1]["t"] if prior_good else None, first_bad["t"], e["t"] + timedelta(seconds=second_attempt_delay_s), e["t"], None)
                cur.events_before_alert = evs.index(e) - evs.index(first_bad) + 1
                prior = [x for x in evs[: evs.index(first_bad)]]
                cur.baseline_bad_rate = sum(x["bad"] for x in prior) / len(prior) if prior else 0.0
                for b in bad_in_window:
                    _add(cur, b)
                good_streak = 0
            continue
        if e["bad"]:
            _add(cur, e)
            cur.last_bad_at = e["t"]
            good_streak = 0
        else:
            good_streak += 1
            if good_streak >= 1:
                cur.resolved_at = e["t"]
                runs.append(cur)
                cur, good_streak = None, 0
    if cur:
        runs.append(cur)
    return runs


def _add(run: Run, e: dict) -> None:
    if e["id"] in run.bad_event_ids:
        return
    run.bad_event_ids.append(e["id"])
    run.classes[e["final_delivery_class"]] += 1
    first = e["attempts"][0] if e["attempts"] else None
    if first and first["http_status"]:
        run.statuses[first["http_status"]] += 1
        run.body_excerpt = run.body_excerpt or first["response_body_excerpt"]


def run_to_json(r: Run) -> dict:
    return {"endpoint_id": r.endpoint_id, "last_good_before": r.last_good_before.isoformat() if r.last_good_before else None, "first_bad_at": r.first_bad_at.isoformat(),
            "alert_at": r.alert_at.isoformat(), "last_bad_at": r.last_bad_at.isoformat(), "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "bad_event_ids": r.bad_event_ids, "statuses": {str(k): v for k, v in r.statuses.items()}, "classes": dict(r.classes), "body_excerpt": r.body_excerpt,
            "baseline_bad_rate": r.baseline_bad_rate, "events_before_alert": r.events_before_alert}


def run_from_json(d: dict) -> Run:
    f = lambda k: datetime.fromisoformat(d[k]) if d.get(k) else None
    return Run(d["endpoint_id"], f("last_good_before"), f("first_bad_at"), f("alert_at"), f("last_bad_at"), f("resolved_at"), d["bad_event_ids"],
               Counter({int(k): v for k, v in d["statuses"].items()}), Counter(d["classes"]), d["body_excerpt"], d["baseline_bad_rate"], d["events_before_alert"])
