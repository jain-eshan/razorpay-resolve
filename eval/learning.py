"""Learning eval (R5, SPEC 11.4). Replays six synthetic weeks three times and counts what the founder would have seen each week:
- off: the monitor as it was built (pooled baseline, fixed strictness, English messages)
- baseline: only the weekly-rhythm baseline (SPEC 11.2, from week 4)
- loop: the baseline and the feedback loop (stricter after false alarms, looser after a missed incident, the better message language)
Separating the arms shows which part does the work. The founder is simulated: every alert that is not inside a real outage is called false,
and every real outage with no alert is reported missed. Message replies and edits are drawn from invented rates (synth/replay.py)."""
import itertools
import json
import random
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.learning import loop, params
from app.schemas import LearningReplay, ReplayRow
from app.zone1 import volume
from app.zone1.baselines import Orders

from synth import replay

ARMS = ("off", "baseline", "loop")
GRACE = timedelta(hours=3)  # an alert up to 3 hours after an outage ends still counts as that outage's alert
KEY = "order_dip_p_threshold"
NOTE = ("Synthetic six-week replay with a simulated founder. Shows the loop working as designed on invented data: a harmless Wednesday dip, a drifting baseline "
        "and three real outages. Reply and edit rates come from invented rates, so the message result is mechanical.")


def _db(seed: int) -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript((ROOT / "contracts" / "schema.sql").read_text())
    db.executemany("INSERT INTO orders (id, merchant_id, customer_id, plan_id, amount_paise, status, created_at, attempts) VALUES (?,?,?,?,?,?,?,1)",
                   [(i, params.MERCHANT_ID, "cus_r", "plan_r", 49900, "paid", t) for i, t in replay.orders(seed)])
    return db


def simulate(arm: str, seed: int) -> tuple[list[ReplayRow], sqlite3.Connection]:
    db = _db(seed)
    orders = Orders(db, ewma=arm != "off")
    rng = random.Random(f"{seed}-{arm}")
    outs, rows = replay.outages(), []
    for w in range(1, replay.WEEKS + 1):
        lo, hi = replay.week_end(w - 1), replay.week_end(w)
        p = params.get(db, KEY) if arm == "loop" else volume.MAX_P
        alerts = [s for s in volume.find(orders, hi, p) if lo < s.detected_at <= hi]
        found = {i for s in alerts for i, o in enumerate(outs) if o.start <= s.detected_at <= o.end + GRACE}
        false = [s for s in alerts if not any(o.start <= s.detected_at <= o.end + GRACE for o in outs)]
        missed = [i for i, o in enumerate(outs) if lo < o.end <= hi and i not in found]
        variant = params.get(db, "message_variant") if arm == "loop" else "en"
        replied = edited = 0
        for k in range(replay.SENDS_PER_WEEK):
            v = variant if k >= replay.SENDS_PER_WEEK * replay.EXPLORE or arm != "loop" else next(x for x in params.VARIANTS if x != variant)
            r, e = rng.random() < replay.P_REPLY[v], rng.random() < replay.P_EDIT[v]
            replied, edited = replied + r, edited + e
            if arm == "loop":
                at = lo + timedelta(days=1, minutes=k)
                loop.record(db, "send", f"w{w}_{k}", "customer_replied" if r else "customer_silent", {"variant": v}, at)
                loop.record(db, "send", f"w{w}_{k}", "reply_edited" if e else "reply_sent", {"variant": v}, at)
        rows.append(ReplayRow(week=w, arm=arm, false_alerts=len(false), true_alerts=len(found), missed=len(missed), sends=replay.SENDS_PER_WEEK,
                              reply_rate=round(replied / replay.SENDS_PER_WEEK, 3), edit_rate=round(edited / replay.SENDS_PER_WEEK, 3)))
        if arm == "loop":
            for n, s in enumerate(false):
                loop.record(db, "alert", f"w{w}_{n}", "false_alarm", {"monitors": ["order_volume_dip"]}, s.detected_at)
            for i in missed:
                loop.record(db, "outage", f"o{i}", "missed_incident", {"monitors": ["order_volume_dip"]}, outs[i].end)
            loop.review(db, hi)
    return rows, db


REPLAYS = 5  # one replay is mostly luck (an alert or two a week), so each arm runs on 5 different random worlds and the weekly figures are averages


def _mean(rows: list[ReplayRow], arm: str, weeks: range, field: str) -> float:
    xs = [getattr(r, field) for r in rows if r.arm == arm and r.week in weeks]
    return sum(xs) / len(xs)


def _spaced(rs: list[sqlite3.Row]) -> bool:
    ts = [datetime.fromisoformat(r["updated_at"]) for r in rs]
    return all(b - a >= params.WEEK for a, b in itertools.pairwise(ts))


def run(seed: int) -> list[tuple[str, float, str, bool | None]]:
    runs = {arm: [simulate(arm, seed + k) for k in range(REPLAYS)] for arm in ARMS}
    rows = [ReplayRow(week=w, arm=arm, sends=replay.SENDS_PER_WEEK, **{f: round(sum(getattr(r[0][w - 1], f) for r in runs[arm]) / REPLAYS, 3) for f in ("false_alerts", "true_alerts", "missed", "reply_rate", "edit_rate")})
            for arm in ARMS for w in range(1, replay.WEEKS + 1)]
    (ROOT / "eval" / "learning_replay.json").write_text(LearningReplay(note=NOTE, rows=rows).model_dump_json(indent=2) + "\n")
    dbs = [r[1] for r in runs["loop"]]
    first, last = range(1, 4), range(4, 7)
    tot = {a: sum(r.false_alerts for r in rows if r.arm == a) for a in ARMS}
    miss = {a: sum(r.missed for r in rows if r.arm == a) for a in ARMS}
    ps = [r for db in dbs for r in params.rows(db)]
    ok_log = bool(ps) and all(r["reason"] and params.valid(r["key"], json.loads(r["value_json"])) for r in ps)
    ok_ver = all(r["version"] == i + 1 for db in dbs for k in params.DEFAULTS for i, r in enumerate(params.rows(db, k)))
    ok_gap = all(_spaced(params.rows(db, k)) for db in dbs for k in params.DEFAULTS)
    clear = {a: _mean(rows, a, range(2, 5, 2), "true_alerts") for a in ARMS}
    res: list[tuple[str, float, str, bool | None]] = []

    def add(name: str, value: float, target: str, ok: bool | None) -> None:
        res.append((name, float(value), target, ok))

    a, b = _mean(rows, "loop", first, "false_alerts"), _mean(rows, "loop", last, "false_alerts")
    add("learning_false_alerts_per_week_weeks_1_to_3_loop", a, "reported (average of 5 replays)", None)
    add("learning_false_alerts_per_week_weeks_4_to_6_loop", b, "< weeks 1 to 3 (false alerts fall)", b < a)
    add("learning_false_alerts_per_replay_off", tot["off"], "reported", None)
    add("learning_false_alerts_per_replay_baseline_only", tot["baseline"], "reported (the weekly-rhythm baseline alone)", None)
    add("learning_false_alerts_per_replay_loop", tot["loop"], "< off (the loop has fewer false alerts than no loop)", tot["loop"] < tot["off"])
    add("learning_clear_outages_found_every_arm", min(clear.values()), "1.0 (both clear outages alerted in every replay, every arm)", min(clear.values()) == 1.0)
    add("learning_missed_outages_per_replay_off", miss["off"], "reported", None)
    add("learning_missed_outages_per_replay_loop", miss["loop"], "reported (the price of stricter alerts; a miss is reported, the next week loosens)", None)
    add("learning_changes_logged_in_bounds_one_per_week", float(ok_log and ok_ver and ok_gap), "1.0 (every change has a reason, a version, a value on the ladder and a week since the last)", ok_log and ok_ver and ok_gap)
    hi = sum(params.get(db, "message_variant") == "hi_latn" for db in dbs) / REPLAYS
    add("learning_message_language_goes_to_higher_reply_rate", hi, "1.0 (Hinglish, the language with the higher invented reply rate, in every replay)", hi == 1.0)
    e1, e2 = _mean(rows, "loop", range(1, 3), "edit_rate"), _mean(rows, "loop", range(5, 7), "edit_rate")
    add("learning_edit_rate_weeks_5_to_6_minus_weeks_1_to_2", e2 - e1, "< 0 (the founder edits fewer drafts; invented edit rates)", e2 < e1)
    return res
