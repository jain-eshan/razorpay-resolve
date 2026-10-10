"""The one send path (SPEC 3.3, section 17). Nothing else writes to `messages`, and the only outbound rows in `thread_messages` are written here; a test enforces both.

R2 runs the checks that exist before channels do: suppression list, messaging switched on, an approval on record, and the number-from-slot
check. R3 replaces `check` with the full engine (consent, window, disclosure, never-ask lint, rate limit) over real threads.
The sender is the mock: it records the message as sent and talks to no one."""
import re
import sqlite3
import uuid
from datetime import datetime, timedelta

from .. import audit, clock
from ..act import autonomy, messages
from ..conversation.lint import urgency_violations, violations
from .base import OutboundMessage, PolicyDecision, SendResult, ThreadRef
from .sim import ADAPTERS

RATE_LIMIT_PER_HOUR = 6


def _real_expiry(template_id: str | None, slots: dict | None) -> bool:
    """A validity statement is real only when the template takes the link's validity as its `hours` slot (BUSINESS_CASE B12)."""
    return bool(template_id and slots and slots.get("hours") and "hours" in messages.TEMPLATES[template_id]["slots"])


def check(db: sqlite3.Connection, *, customer_id: str, template_id: str, language: str, slots: dict, body: str, approved_by: str | None, block: str | None = None) -> PolicyDecision:
    reasons = [block] if block else []  # `block`: a reason the caller already knows (the channel's window has closed, there is no permission to message them)
    if db.execute("SELECT 1 FROM suppressions WHERE customer_ref_hash = ?", (customer_id,)).fetchone():  # R3 keys this by hashed channel handle
        reasons.append("This customer asked not to be contacted.")
    if not autonomy.read(db).messaging_enabled:
        reasons.append("Messaging is switched off in settings.")
    if not approved_by:
        reasons.append("No approval is on record for this message.")
    if not messages.numbers_ok(template_id, language, slots, body):
        reasons.append("The text has a number that is not from the customer's record.")
    for v in urgency_violations(body, _real_expiry(template_id, slots)):
        reasons.append(f"Pressures the customer or states an expiry that is not real: \"{v}\"")
    return PolicyDecision(allowed=not reasons, needs_founder_approval=not approved_by, reasons=reasons)


def send(db: sqlite3.Connection, *, action_id: str, payment_id: str, customer_id: str, template_id: str, language: str, slots: dict, approved_by: str | None, block: str | None = None) -> str:
    """Returns the message id, or raises PermissionError with the reasons. A blocked attempt is logged and stored as a draft."""
    body = messages.render(template_id, language, slots)
    decision = check(db, customer_id=customer_id, template_id=template_id, language=language, slots=slots, body=body, approved_by=approved_by, block=block)
    mid = f"msg_{uuid.uuid4().hex[:12]}"
    category = messages.TEMPLATES[template_id]["category"]
    status = "sent" if decision.allowed else "blocked"
    db.execute("INSERT INTO messages (id, action_id, payment_id, customer_id, template_id, language, category, sender, body, holdout, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
               (mid, action_id, payment_id, customer_id, template_id, language, category, messages.sender(slots), body, 0, status, clock.now().isoformat()))
    if not decision.allowed:
        audit.log(db, "system", "policy", payment_id, "Message blocked: " + " ".join(decision.reasons), action_id=action_id)
        raise PermissionError(" ".join(decision.reasons))
    return mid


def channel_level(db: sqlite3.Connection, channel_id: str) -> str:
    return db.execute("SELECT autonomy_level FROM channels WHERE id = ?", (channel_id,)).fetchone()["autonomy_level"]


# ---------- thread replies: the full engine (SPEC 3.3), in the order the spec gives ----------
HUMAN_AGENT_WINDOW = timedelta(days=7)


def check_thread(db: sqlite3.Connection, thread: sqlite3.Row, channel_type: str, *, body: str, template_id: str | None, language: str, slots: dict | None,
                 message_class: str, approved_by: str | None, now: datetime, human: bool = False) -> PolicyDecision:
    """Checks in order: suppression, consent, window, disclosure, never-ask lint, number-from-slot, public-channel filter, rate limit, autonomy.
    Every failed check adds a reason, so a blocked reply shows all of them."""
    reasons: list[str] = []
    needs_template = False
    if db.execute("SELECT 1 FROM suppressions WHERE customer_ref_hash = ?", (thread["customer_ref"],)).fetchone():
        reasons.append("This customer asked not to be contacted.")
    if not db.execute("SELECT 1 FROM consents WHERE channel_id = ? AND revoked_at IS NULL", (thread["channel_id"],)).fetchone():
        reasons.append("This channel has no active consent. Reconnect it in Channels.")
    adapter = ADAPTERS[channel_type]
    ref = ThreadRef(id=thread["id"], channel=channel_type, last_inbound_at=datetime.fromisoformat(thread["last_inbound_at"]), is_public=bool(thread["is_public"]), disclosed=bool(thread["disclosed"]))  # type: ignore[arg-type]
    win = adapter.window(ref, now)
    if win.requires_template:
        needs_template = True
        if template_id is None:
            reasons.append("The 24 hour window is closed, so only an approved template can be sent.")
        elif messages.TEMPLATES[template_id]["category"] == "service_promotional":
            reasons.append("Promotional templates cannot be sent after the window closes.")
    if channel_type in ("ig_dm", "fb_dm") and not win.free_form_allowed:  # Meta: after 24 hours only a person may reply, with the Human Agent tag, for up to 7 days
        if not human:
            reasons.append("The 24 hour window is closed. Only a person can reply now, with the Human Agent tag, for up to 7 days.")
        elif now > ref.last_inbound_at + HUMAN_AGENT_WINDOW:
            reasons.append("The 7 day Human Agent window is closed too, so nothing more can be sent on this channel.")
    if channel_type == "public_mention" and (message_class != "public_reply" or template_id != "T-PUB"):
        reasons.append("In public, only the one generic reply with a private link may be posted.")
    if not thread["disclosed"] and not re.search(r"i'm an ai|i am an ai|main ek ai", body, re.IGNORECASE):
        reasons.append("The first message must say it is an AI assistant.")
    for v in violations(body):
        reasons.append(f"Asks for something it must never ask for: \"{v}\"")
    for v in urgency_violations(body, _real_expiry(template_id, slots)):
        reasons.append(f"Pressures the customer or states an expiry that is not real: \"{v}\"")
    if template_id and slots is not None and not messages.numbers_ok(template_id, language, slots, body):
        reasons.append("The text has a number that is not from the customer's record.")
    if thread["is_public"] and (re.search(r"\d", re.sub(r"https?://\S+", "", body)) or (slots and slots.get("first_name") and slots["first_name"] in body)):
        reasons.append("A public reply cannot contain numbers or names. Move to a private message.")
    recent = db.execute("SELECT COUNT(*) AS n FROM thread_messages WHERE thread_id = ? AND direction = 'outbound' AND sender_role IN ('agent','founder') AND created_at >= ?",
                        (thread["id"], (now - timedelta(hours=1)).isoformat())).fetchone()["n"]
    if recent >= RATE_LIMIT_PER_HOUR:
        reasons.append(f"Rate limit: at most {RATE_LIMIT_PER_HOUR} messages an hour to one customer.")
    level = channel_level(db, thread["channel_id"])  # the dial is per channel for conversations (SPEC 10.2); grants and incident messages use the global setting
    needs_founder = autonomy.MATRIX[message_class][level] != "auto" and not approved_by
    if needs_founder:
        reasons.append("Waiting for your approval.")
    return PolicyDecision(allowed=not reasons, requires_template=needs_template, needs_founder_approval=needs_founder, reasons=reasons)


def send_thread(db: sqlite3.Connection, thread: sqlite3.Row, channel_type: str, *, body: str, template_id: str | None, language: str, slots: dict | None,
                message_class: str, approved_by: str | None, now: datetime, sender_role: str = "agent", draft_of: str | None = None, nudge: bool = False,
                store_blocked: bool = True) -> tuple[str, PolicyDecision]:
    """The only writer of outbound thread messages. Returns the message id and the decision. A reply that is not allowed is stored as a draft
    (not sent) so the founder sees it with the reasons. Sending a draft again passes `draft_of`, which replaces the draft."""
    import json

    decision = check_thread(db, thread, channel_type, body=body, template_id=template_id, language=language, slots=slots, message_class=message_class, approved_by=approved_by, now=now,
                            human=sender_role == "founder")
    mid = f"tm_{uuid.uuid4().hex[:12]}"
    cost = 0
    if decision.allowed:
        res: SendResult = ADAPTERS[channel_type].send(ThreadRef(id=thread["id"], channel=channel_type, last_inbound_at=datetime.fromisoformat(thread["last_inbound_at"])), OutboundMessage(  # type: ignore[arg-type]
            thread_id=thread["id"], template_id=template_id, body=body, language=language if language in ("en", "hi_latn", "hi_deva") else "en", message_class=message_class), approved_by=approved_by)  # type: ignore[arg-type]
        cost = res.cost_inr_milli
        db.execute("UPDATE threads SET disclosed = 1 WHERE id = ?", (thread["id"],))
    if not decision.allowed and not store_blocked:
        return "", decision
    if draft_of:
        db.execute("DELETE FROM thread_messages WHERE id = ?", (draft_of,))
    policy = {"status": "sent" if decision.allowed else "draft", "class": message_class, "reasons": decision.reasons, "nudge": nudge,
              "language": language, "slots": {k: v for k, v in (slots or {}).items() if not k.startswith("_")}}
    db.execute("INSERT INTO thread_messages (id, thread_id, direction, sender_role, body_redacted, raw_hash, template_id, approved_by, policy_json, cost_inr_milli, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
               (mid, thread["id"], "outbound", sender_role, body, None, template_id, approved_by if decision.allowed else None, json.dumps(policy), cost, now.isoformat()))
    if not decision.allowed:
        audit.log(db, "system", "policy", thread["id"], "Reply held as a draft: " + " ".join(decision.reasons), thread_id=thread["id"])
    return mid, decision
