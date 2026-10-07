"""The learning loop (SPEC 11): feedback in, a small bounded change out, a plain sentence about it.

This is tuning, not retraining. Nothing here writes a message, reads a payment or touches an amount. Two things move:
- how strong the evidence must be before the order-dip and complaint-spike monitors alert (false_alarm makes one stricter, missed_incident looser)
- which pre-approved message language goes to customers whose own language is not known (the one that gets more replies)

The calibrator refit and the body-reader examples of SPEC 11.2 are not here: the first has too few confirmed matches to refit, the second needs a model."""
import json
import sqlite3
from datetime import datetime, timedelta

from ..schemas import FeedbackRequest, LearningChange, LearningParam, LearningWeekly
from . import params

KINDS = FeedbackRequest.model_fields["kind"].annotation.__args__
TUNED = {"order_volume_dip": "order_dip_p_threshold", "complaint_spike": "complaint_spike_p_threshold"}  # evidence kind -> setting it tunes
NAME = {"order_dip_p_threshold": "order-dip", "complaint_spike_p_threshold": "complaint-spike"}
TOLD = {"false_alarm": ("false alarm", "false alarms"), "missed_incident": ("missed incident", "missed incidents")}
LANG = {"en": "English", "hi_latn": "Hinglish"}
MIN_SENDS, MARGIN, WINDOW = 20, 0.05, timedelta(days=28)  # SPEC 11.2: at least 20 sends. The margin stops a one-point lead from flipping the choice


def _at(r: sqlite3.Row) -> datetime:
    return datetime.fromisoformat(r["at"])


def record(db: sqlite3.Connection, subject_type: str, subject_id: str, kind: str, payload: dict, now: datetime) -> str:
    """Store one feedback event. A false alarm on an incident remembers which monitors raised it, so the weekly review knows what to tune."""
    if kind not in KINDS:
        raise ValueError(f"unknown feedback kind {kind}")
    payload = dict(payload)
    if subject_type == "incident" and "monitors" not in payload and kind in ("false_alarm", "verdict_wrong"):
        r = db.execute("SELECT evidence_json FROM incidents WHERE id = ?", (subject_id,)).fetchone()
        if not r:
            raise ValueError(f"no incident {subject_id}")
        payload["monitors"] = sorted({e["kind"] for e in json.loads(r["evidence_json"] or "[]") if e["kind"] in TUNED})
    if kind == "missed_incident" and not set(payload.get("monitors", [])) & set(TUNED):
        raise ValueError("a missed incident needs the monitor that should have caught it: " + ", ".join(TUNED))
    fid = f"fb_{db.execute('SELECT COUNT(*) FROM feedback_events').fetchone()[0] + 1:06d}"
    db.execute("INSERT INTO feedback_events (id, merchant_id, subject_type, subject_id, kind, payload_json, at) VALUES (?,?,?,?,?,?,?)",
               (fid, params.MERCHANT_ID, subject_type, subject_id, kind, json.dumps(payload, sort_keys=True), now.isoformat()))
    return fid


def _events(db: sqlite3.Connection, since: datetime, now: datetime) -> list[sqlite3.Row]:
    return [r for r in db.execute("SELECT * FROM feedback_events WHERE merchant_id = ? ORDER BY at, id", (params.MERCHANT_ID,)) if since < _at(r) <= now]


def _plural(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def review(db: sqlite3.Connection, now: datetime) -> list[LearningChange]:
    """The weekly job. Reads feedback since the setting last changed (at most 7 days back) and moves each setting at most one step."""
    out: list[LearningChange] = []
    ev = _events(db, now - params.WEEK, now)
    for key in (k for k in params.DEFAULTS if k != "message_variant"):
        last = params.last_change(db, key)
        mine = [r for r in ev if not last or _at(r) > datetime.fromisoformat(last["updated_at"])]
        hits = {k: sum(1 for r in mine if r["kind"] == k and key in {TUNED.get(m) for m in json.loads(r["payload_json"]).get("monitors", [])}) for k in ("false_alarm", "missed_incident")}
        fa, mi = hits["false_alarm"], hits["missed_incident"]
        if bool(fa) == bool(mi) or not params.can_change(db, key, now):  # nothing said, or the founder said both: leave it
            continue
        cur = params.get(db, key)
        new = params.step(cur, +1 if fa else -1)
        if new is None:
            continue
        why = (f"{_plural(fa, NAME[key] + ' alert was', NAME[key] + ' alerts were')} marked false" if fa
               else f"{_plural(mi, 'incident was', 'incidents were')} missed that the {NAME[key]} monitor should have caught")
        out.append(LearningChange(at=now, key=key, before=cur, after=new, reason=why, version=params.set_(db, key, new, why, now)))
    cur = params.get(db, "message_variant")
    rate = variant_rates(db, now)
    best = max(rate, key=lambda v: rate[v][0], default=None)
    if best and best != cur and all(rate[v][1] >= MIN_SENDS for v in rate) and len(rate) == 2 and rate[best][0] - rate[cur][0] >= MARGIN and params.can_change(db, "message_variant", now):
        why = f"{LANG[best]} messages got {rate[best][0]:.0%} replies against {rate[cur][0]:.0%} for {LANG[cur]}"
        out.append(LearningChange(at=now, key="message_variant", before=cur, after=best, reason=why, version=params.set_(db, "message_variant", best, why, now)))
    return out


def variant_rates(db: sqlite3.Connection, now: datetime) -> dict[str, tuple[float, int]]:
    """Reply rate and number of sends per message language over the last 28 days. Only customers who replied or were left waiting count."""
    seen: dict[str, list[int]] = {}
    for r in _events(db, now - WINDOW, now):
        if r["kind"] in ("customer_replied", "customer_silent"):
            v = json.loads(r["payload_json"]).get("variant")
            if v in params.VARIANTS:
                s = seen.setdefault(v, [0, 0])
                s[0] += r["kind"] == "customer_replied"
                s[1] += 1
    return {v: (s[0] / s[1], s[1]) for v, s in seen.items()}


def _line(c: LearningChange) -> str:
    if c.key == "message_variant":
        return f"I now use {LANG[c.after]} by default for customers whose language I do not know, because {c.reason}."
    way = "stricter" if c.after < c.before else "looser"
    odds = f"1 in {round(1 / c.after):,}"
    return f"I made the {NAME[c.key]} alert {way}: it now needs evidence that would happen by chance about {odds} times (it was 1 in {round(1 / c.before):,}), because {c.reason}."


def changes(db: sqlite3.Connection, since: datetime, now: datetime) -> list[LearningChange]:
    out, prev = [], {}
    for r in params.rows(db):
        v = json.loads(r["value_json"])
        before, prev[r["key"]] = prev.get(r["key"], params.DEFAULTS[r["key"]]), v
        if since < datetime.fromisoformat(r["updated_at"]) <= now:
            out.append(LearningChange(at=r["updated_at"], key=r["key"], before=before, after=v, reason=r["reason"], version=r["version"]))
    return out


def weekly(db: sqlite3.Connection, now: datetime) -> LearningWeekly:
    since = now - params.WEEK
    ch = changes(db, since, now)
    ev = _events(db, since, now)
    lines = [_line(c) for c in ch] or ["Nothing changed this week."]
    told = [_plural(n, *TOLD[k]) for k in TOLD if (n := sum(1 for r in ev if r["kind"] == k))]
    if told:
        lines.append("You told me " + ", ".join(told) + " this week.")
    rates = variant_rates(db, now)
    if len(rates) == 2:
        lines.append("Reply rates over 4 weeks: " + ", ".join(f"{LANG[v]} {r:.0%} ({n} sent)" for v, (r, n) in sorted(rates.items())) + ".")
    return LearningWeekly(week_start=since, lines=lines, changes=ch)


def all_params(db: sqlite3.Connection, now: datetime) -> list[LearningParam]:
    """Every version of every setting, plus a version 0 row for a setting that never changed, so the screen can show what is in force."""
    out = [LearningParam(key=r["key"], version=r["version"], value=json.loads(r["value_json"]), reason=r["reason"], updated_at=r["updated_at"]) for r in params.rows(db)]
    for k, v in params.DEFAULTS.items():
        if not any(p.key == k for p in out):
            out.append(LearningParam(key=k, version=0, value=v, reason="Default", updated_at=now))
    return sorted(out, key=lambda p: (p.key, p.version))
