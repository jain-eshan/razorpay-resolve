"""Handovers (SPEC 3.2, F-14 and F-15), simulated the way Meta documents them.

Instagram and Messenger: the merchant's Meta inbox is the primary receiver. When a message looks like a payment problem the inbox passes the
thread to Resolve (`pass_thread_control`). Resolve talks to the customer inside the 24 hour window. When the conversation is resolved, or needs a
person, control goes back to the inbox (`take_thread_control`, here called release). A message that is not about a payment never leaves the inbox.

Public posts: a post that mentions the merchant gets at most one generic public reply with a private link. Nothing about a payment, an amount or a
person is said in public, and nothing is looked up. If the customer then writes privately, that thread picks up from the public one.

Every pass and release is a row in `handovers` and a plain line in the thread, so the founder sees who had control and why."""
import json
import sqlite3
import uuid
from datetime import datetime

from .. import audit
from ..act.executor import ActError
from ..schemas import Handover, HandoverRequest

META_INBOX = "meta_inbox"
BLINDSPOT = "blindspot"
IG_CHANNELS = ("ig_dm", "fb_dm")
RELEASE_STATES = {"handoff": "Needs a person, so the thread goes back to the Meta inbox with the brief.", "human": "Needs a person, so the thread goes back to the Meta inbox with the brief.",
                  "pass_back": "Not something Resolve should handle, so the thread goes back to the Meta inbox.", "resolved": "Resolved, so the thread goes back to the Meta inbox.",
                  "explain": "Answered from the record, so the thread goes back to the Meta inbox.", "closed": "Closed, so the thread goes back to the Meta inbox."}


def note(db: sqlite3.Connection, tid: str, text: str, now: datetime, kind: str) -> None:
    """A plain line in the thread: who has control, or why nothing was said."""
    db.execute("INSERT INTO thread_messages (id, thread_id, direction, sender_role, body_redacted, raw_hash, policy_json, created_at) VALUES (?,?,?,?,?,?,?,?)",
               (f"tm_{uuid.uuid4().hex[:12]}", tid, "outbound", "system", text, None, json.dumps({"status": "note", "kind": kind}), now.isoformat()))


def _row(r: sqlite3.Row) -> Handover:
    return Handover(id=r["id"], thread_id=r["thread_id"], from_app=r["from_app"], to_app=r["to_app"], reason=r["reason"], passed_at=datetime.fromisoformat(r["passed_at"]),
                    released_at=datetime.fromisoformat(r["released_at"]) if r["released_at"] else None)


def open_handover(db: sqlite3.Connection, tid: str) -> sqlite3.Row | None:
    return db.execute("SELECT * FROM handovers WHERE thread_id = ? AND to_app = ? AND released_at IS NULL ORDER BY passed_at DESC, rowid DESC LIMIT 1", (tid, BLINDSPOT)).fetchone()


def pass_control(db: sqlite3.Connection, tid: str, reason: str, now: datetime, from_app: str = META_INBOX) -> Handover:
    hid = f"ho_{uuid.uuid4().hex[:8]}"
    db.execute("INSERT INTO handovers (id, thread_id, from_app, to_app, reason, passed_at) VALUES (?,?,?,?,?,?)", (hid, tid, from_app, BLINDSPOT, reason, now.isoformat()))
    db.execute("UPDATE threads SET handover_state = 'with_blindspot' WHERE id = ?", (tid,))
    note(db, tid, f"The Meta inbox passed this conversation to Resolve. Reason: {reason}", now, "pass")
    audit.log(db, "system", "action", tid, f"Took control of a thread from the {from_app.replace('_', ' ')}: {reason}", thread_id=tid)
    return _row(db.execute("SELECT * FROM handovers WHERE id = ?", (hid,)).fetchone())


def release(db: sqlite3.Connection, tid: str, reason: str, now: datetime, actor: str = "system") -> Handover | None:
    h = open_handover(db, tid)
    if not h:
        return None
    db.execute("UPDATE handovers SET released_at = ? WHERE id = ?", (now.isoformat(), h["id"]))
    db.execute("UPDATE threads SET handover_state = 'released' WHERE id = ?", (tid,))
    note(db, tid, f"Resolve released this conversation to the Meta inbox. {reason}", now, "release")
    audit.log(db, actor, "action", tid, f"Gave control of a thread back to the Meta inbox: {reason}", thread_id=tid)
    return _row(db.execute("SELECT * FROM handovers WHERE id = ?", (h["id"],)).fetchone())


def sync(db: sqlite3.Connection, tid: str, now: datetime) -> None:
    """After any change to a thread: if Resolve has control and the conversation is over, or needs a person, give control back."""
    th = db.execute("SELECT * FROM threads WHERE id = ?", (tid,)).fetchone()
    if th and th["state"] in RELEASE_STATES and open_handover(db, tid):
        release(db, tid, RELEASE_STATES[th["state"]], now)


def link_public(db: sqlite3.Connection, public_tid: str, private_tid: str, now: datetime) -> bool:
    """The customer answered the public reply by writing privately. The public thread closes, the private one carries on, and a row records the move."""
    pub = db.execute("SELECT t.*, c.type AS ctype FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?", (public_tid,)).fetchone()
    if not pub or not pub["is_public"] or pub["handover_state"] != "public_invited":
        return False
    priv = db.execute("SELECT t.*, c.type AS ctype FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?", (private_tid,)).fetchone()
    db.execute("UPDATE threads SET state = 'closed', handover_state = 'moved_private', closed_at = ? WHERE id = ?", (now.isoformat(), public_tid))
    db.execute("UPDATE threads SET handover_state = CASE WHEN handover_state = 'with_blindspot' THEN handover_state ELSE 'from_public' END WHERE id = ?", (private_tid,))
    db.execute("INSERT INTO handovers (id, thread_id, from_app, to_app, reason, passed_at, released_at) VALUES (?,?,?,?,?,?,?)",
               (f"ho_{uuid.uuid4().hex[:8]}", private_tid, "public_mention", priv["ctype"], "The customer wrote privately after the public reply", now.isoformat(), now.isoformat()))
    note(db, public_tid, "The customer wrote privately. This public thread is closed and nothing more is said in public.", now, "moved_private")
    note(db, private_tid, "This conversation began as a public post. Nothing from the post was looked up before the customer wrote here.", now, "from_public")
    audit.log(db, "system", "action", private_tid, "A customer moved from a public post to a private message.", thread_id=private_tid, public_thread=public_tid)
    return True


def request(db: sqlite3.Connection, body: HandoverRequest, now: datetime) -> Handover:
    """POST /handovers: pass a thread to Resolve or release it, the way the Meta inbox would."""
    th = db.execute("SELECT t.*, c.type AS ctype FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?", (body.thread_id,)).fetchone()
    if not th:
        raise ActError(404, f"Thread {body.thread_id} not found.")
    if th["ctype"] not in IG_CHANNELS:
        raise ActError(409, "Only Instagram and Messenger threads are handed over. Other channels are ours from the start.")
    if body.action == "pass":
        if open_handover(db, body.thread_id):
            raise ActError(409, "Resolve already has control of this thread.")
        return pass_control(db, body.thread_id, body.reason or "Passed by the Meta inbox", now, body.to_app and META_INBOX or META_INBOX)
    h = release(db, body.thread_id, body.reason or "Released by the founder.", now, actor="merchant:founder")
    if not h:
        raise ActError(409, "Resolve does not have control of this thread.")
    return h
