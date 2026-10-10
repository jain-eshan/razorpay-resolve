"""Retention (F-54, SPEC 3.4): what the Channels screen means by "Kept for 30 days".

A finished conversation loses its transcript and the real identifiers behind its tokens (phone, email, UPI handle, bank reference) once nothing has happened on it for the
channel's retention period. Kept on purpose: the redacted complaint text, because the pipeline rebuilds cases from it and a purge must never move an incident number;
the case, the template ids and send decisions on each message, and the audit log.
Not touched: a conversation whose incident is still open (the founder needs the evidence), and one with a reply waiting for approval (approving it would send the removed text).
"""
import sqlite3
from datetime import datetime, timedelta

from .. import audit
from .machine import OPEN

DEFAULT_DAYS = 30
GONE = "[removed after the retention period]"


def sweep(db: sqlite3.Connection, now: datetime) -> dict[str, int]:
    """Remove what has expired. Safe to run any number of times: a second run finds nothing."""
    done = {"conversations": 0, "messages": 0, "identifiers": 0}
    rows = db.execute("""
        SELECT t.id, t.state, t.case_id,
               COALESCE((SELECT MAX(created_at) FROM thread_messages WHERE thread_id = t.id), t.opened_at) AS last_at,
               COALESCE((SELECT retention_days FROM consents WHERE channel_id = t.channel_id ORDER BY granted_at DESC, rowid DESC LIMIT 1), ?) AS days
        FROM threads t LEFT JOIN incidents i ON i.id = t.incident_id
        WHERE (i.id IS NULL OR i.status = 'closed')
          AND NOT EXISTS (SELECT 1 FROM thread_messages m WHERE m.thread_id = t.id AND json_extract(m.policy_json, '$.status') = 'draft')""", (DEFAULT_DAYS,)).fetchall()
    for t in rows:
        if datetime.fromisoformat(t["last_at"]) >= now - timedelta(days=t["days"]):
            continue
        complaints = [r[0] for r in db.execute("SELECT complaint_id FROM cases WHERE id = ? UNION SELECT id FROM complaints WHERE thread_id = ?", (t["case_id"], t["id"])) if r[0]]
        ids = db.execute(f"DELETE FROM token_vault WHERE complaint_id IN ({','.join('?' * len(complaints))})", complaints).rowcount if complaints else 0
        msgs = db.execute("UPDATE thread_messages SET body_redacted = ? WHERE thread_id = ? AND body_redacted != ?", (GONE, t["id"], GONE)).rowcount
        if t["state"] in OPEN:  # a customer who writes again starts a new conversation instead of continuing on text that is gone
            db.execute("UPDATE threads SET state = 'resolved', closed_at = COALESCE(closed_at, ?) WHERE id = ?", (now.isoformat(), t["id"]))
        if ids or msgs:
            done["conversations"] += 1
            done["messages"] += msgs
            done["identifiers"] += ids
    if done["conversations"]:
        n = done["conversations"]
        audit.log(db, "system", "policy", None,
                  f"Removed {done['messages']} messages and {done['identifiers']} saved identifiers from {n} conversation{'' if n == 1 else 's'} past the retention period.", **done)
    return done
