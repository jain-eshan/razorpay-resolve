"""Learned settings (SPEC 11.2). Every one has a default, a hard bound and a log line.

Alert strictness moves along a short ladder one rung at a time and never past either end. A setting changes at most once a week.
The first change is version 1; version 0 is the default and has no row."""
import json
import sqlite3
from datetime import datetime, timedelta

MERCHANT_ID = "acc_KAKSHA001"
WEEK = timedelta(days=7)
LADDER = (0.001, 0.0025, 0.005, 0.01, 0.02, 0.05)  # p thresholds, strictest first. SPEC 11.2 bound: 0.001 to 0.05
DEFAULTS: dict[str, float | str] = {"order_dip_p_threshold": 0.01, "complaint_spike_p_threshold": 0.01, "message_variant": "en"}
VARIANTS = ("en", "hi_latn")  # pre-approved template languages; learning never writes a message


def valid(key: str, value: float | str) -> bool:
    if key == "message_variant":
        return value in VARIANTS
    return key in DEFAULTS and value in LADDER


def step(value: float, strictness: int) -> float | None:
    """One rung stricter (+1) or looser (-1). None at the end of the ladder."""
    i = LADDER.index(value) - strictness
    return LADDER[i] if 0 <= i < len(LADDER) else None


def rows(db: sqlite3.Connection, key: str | None = None) -> list[sqlite3.Row]:
    q, a = "SELECT * FROM learning_params WHERE merchant_id = ?", [MERCHANT_ID]
    if key:
        q, a = q + " AND key = ?", a + [key]
    return db.execute(q + " ORDER BY key, version", a).fetchall()


def last_change(db: sqlite3.Connection, key: str) -> sqlite3.Row | None:
    r = rows(db, key)
    return r[-1] if r else None


def get(db: sqlite3.Connection, key: str) -> float | str:
    r = last_change(db, key)
    return json.loads(r["value_json"]) if r else DEFAULTS[key]


def can_change(db: sqlite3.Connection, key: str, now: datetime) -> bool:
    r = last_change(db, key)
    return r is None or now - datetime.fromisoformat(r["updated_at"]) >= WEEK


def set_(db: sqlite3.Connection, key: str, value: float | str, reason: str, now: datetime) -> int:
    """Write the next version. Refuses anything out of bounds or a second change inside a week. Returns the version."""
    if not valid(key, value):
        raise ValueError(f"{value!r} is outside the allowed values for {key}")
    if not can_change(db, key, now):
        raise ValueError(f"{key} already changed in the last 7 days")
    last = last_change(db, key)
    version = (last["version"] if last else 0) + 1
    db.execute("INSERT INTO learning_params (merchant_id, key, version, value_json, reason, updated_at) VALUES (?,?,?,?,?,?)",
               (MERCHANT_ID, key, version, json.dumps(value), reason, now.isoformat()))
    return version
