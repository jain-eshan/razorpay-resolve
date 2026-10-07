"""Audit log (FR-AU-1): one row per approval, action, verification and blocked send. Never skipped, so every number on the audit page traces to a row."""
import hashlib
import json
import sqlite3

from . import clock


def log(db: sqlite3.Connection, actor: str, kind: str, ref_id: str | None, summary: str, **payload) -> None:
    body = json.dumps({"summary": summary, **payload}, default=str, sort_keys=True)
    db.execute("INSERT INTO audit_log (at, actor, kind, ref_id, input_hash, payload_json) VALUES (?,?,?,?,?,?)",
               (clock.now().isoformat(), actor, kind, ref_id, hashlib.sha256(body.encode()).hexdigest()[:16], body))
