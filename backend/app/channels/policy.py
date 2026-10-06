"""The one send path (SPEC 3.3, section 17). Nothing else writes to `messages`; a test enforces that.

R2 runs the checks that exist before channels do: suppression list, messaging switched on, an approval on record, and the number-from-slot
check. R3 replaces `check` with the full engine (consent, window, disclosure, never-ask lint, rate limit) over real threads.
The sender is the mock: it records the message as sent and talks to no one."""
import sqlite3
import uuid

from .. import audit, clock
from ..act import autonomy, messages
from .base import PolicyDecision


def check(db: sqlite3.Connection, *, customer_id: str, template_id: str, language: str, slots: dict, body: str, approved_by: str | None) -> PolicyDecision:
    reasons = []
    if db.execute("SELECT 1 FROM suppressions WHERE customer_ref_hash = ?", (customer_id,)).fetchone():  # R3 keys this by hashed channel handle
        reasons.append("This customer asked not to be contacted.")
    if not autonomy.read(db).messaging_enabled:
        reasons.append("Messaging is switched off in settings.")
    if not approved_by:
        reasons.append("No approval is on record for this message.")
    if not messages.numbers_ok(template_id, language, slots, body):
        reasons.append("The text has a number that is not from the customer's record.")
    return PolicyDecision(allowed=not reasons, needs_founder_approval=not approved_by, reasons=reasons)


def send(db: sqlite3.Connection, *, action_id: str, payment_id: str, customer_id: str, template_id: str, language: str, slots: dict, approved_by: str | None) -> str:
    """Returns the message id, or raises PermissionError with the reasons. A blocked attempt is logged and stored as a draft."""
    body = messages.render(template_id, language, slots)
    decision = check(db, customer_id=customer_id, template_id=template_id, language=language, slots=slots, body=body, approved_by=approved_by)
    mid = f"msg_{uuid.uuid4().hex[:12]}"
    category = messages.TEMPLATES[template_id]["category"]
    status = "sent" if decision.allowed else "blocked"
    db.execute("INSERT INTO messages (id, action_id, payment_id, customer_id, template_id, language, category, sender, body, holdout, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
               (mid, action_id, payment_id, customer_id, template_id, language, category, messages.sender(slots), body, 0, status, clock.now().isoformat()))
    if not decision.allowed:
        audit.log(db, "system", "policy", payment_id, "Message blocked: " + " ".join(decision.reasons), action_id=action_id)
        raise PermissionError(" ".join(decision.reasons))
    return mid
