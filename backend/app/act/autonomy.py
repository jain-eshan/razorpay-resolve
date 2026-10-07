"""Autonomy matrix (SPEC 10.2) and the settings that bound it (FR-SE-3). The dial is stored in `settings` under 'autonomy'.

Each action or message class maps to the approval a level needs. `taps` turns that into the stages the founder must approve by hand;
every other stage runs by itself once the stage before it has been verified."""
import json
import sqlite3

from .. import audit
from ..config import ENTITLEMENT_EXPORT_AT
from ..schemas import Autonomy, ConnectorStatus, Settings

LEVELS: tuple[Autonomy, ...] = ("suggest", "assist", "autopilot_reversible")
STAGES = ("dry_run", "first_5", "rest")

# founder: approves every stage. once_per_incident: approves the dry run, the rest follows. auto: no tap, still staged, still capped.
MATRIX = {
    "disclosure_or_question": {"suggest": "auto", "assist": "auto", "autopilot_reversible": "auto"},
    "status_reply": {"suggest": "founder", "assist": "auto", "autopilot_reversible": "auto"},
    "public_reply": {"suggest": "founder", "assist": "founder", "autopilot_reversible": "founder"},
    "grant_exact": {"suggest": "founder", "assist": "once_per_incident", "autopilot_reversible": "auto"},
    "incident_message": {"suggest": "founder", "assist": "founder", "autopilot_reversible": "auto"},
    "recovery_link": {"suggest": "founder", "assist": "founder", "autopilot_reversible": "founder"},
    "refund": {"suggest": "per_row_web", "assist": "per_row_web", "autopilot_reversible": "per_row_web"},
}
ACTION_CLASS = {"grant": "grant_exact", "message": "incident_message", "recovery_link": "recovery_link"}  # the types that can execute: R2 grants and messages, R4 recovery links

DEFAULTS = {"daily_refund_cap_paise": 500_000, "max_bulk_customers": 100, "messaging_enabled": False, "holdout_percent": 10, "autonomy": "suggest"}


def taps(action_type: str, level: str) -> tuple[str, ...]:
    rule = MATRIX[ACTION_CLASS[action_type]][level]
    return STAGES if rule == "founder" else ("dry_run",) if rule == "once_per_incident" else ()


def read(db: sqlite3.Connection) -> Settings:
    stored = {r["key"]: json.loads(r["value"]) for r in db.execute("SELECT key, value FROM settings WHERE key IN (%s)" % ",".join("?" * len(DEFAULTS)), list(DEFAULTS))}
    merged = {**DEFAULTS, **stored}
    n = db.execute("SELECT COUNT(*) AS n FROM entitlements").fetchone()["n"]
    contact = db.execute("SELECT tech_contact FROM merchants LIMIT 1").fetchone()
    return Settings(**merged, technical_contact=json.loads(stored["technical_contact"]) if "technical_contact" in stored else (contact["tech_contact"] if contact else ""),
                    entitlement_connector=ConnectorStatus(mode="csv", status=f"{n} access records loaded", updated_at=ENTITLEMENT_EXPORT_AT))


def write(db: sqlite3.Connection, new: Settings, actor: str) -> Settings:
    if new.max_bulk_customers < 1 or new.daily_refund_cap_paise < 0 or not 0 <= new.holdout_percent <= 100:
        raise ValueError("Limits must be: at least 1 customer per bulk action, a refund cap of 0 or more, and a holdout between 0 and 100 percent.")
    old = read(db)
    for key in (*DEFAULTS, "technical_contact"):
        if getattr(old, key) != getattr(new, key):
            db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, json.dumps(getattr(new, key))))
            show = lambda v: ("on" if v else "off") if isinstance(v, bool) else v
            audit.log(db, actor, "approval", key, f"Changed {key.replace('_', ' ')} from {show(getattr(old, key))} to {show(getattr(new, key))}")
    return read(db)
