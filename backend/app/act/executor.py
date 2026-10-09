"""Actions (SPEC 10, FR-AC, FR-VE): plan, staged run (dry run, first 5, rest), idempotency, undo, verify and close.

Rules this file holds:
- Nothing runs without an approval on record (the founder's, or the autonomy setting's for stages the matrix lets run by themselves).
- Every item has a key sha256(incident, action type, payment). The column is UNIQUE, so a second plan or a second click cannot act twice.
- Each executed item is re-checked against the merchant's own record at once. A failure stops the batch.
- A grant stores the prior state and can be undone. There is no revoke anywhere in this file or in the mock.
"""
import hashlib
import json
import sqlite3
from collections import Counter

from .. import audit, clock, merchant_mock
from ..channels import policy
from ..conversation.templates import TEMPLATES
from ..db import write_tx as _write
from ..duplicates import read as dp
from ..renewal import read as rn
from ..schemas import Action, ActionItem, ActionSummary, MessagePreview, VerifyResult
from ..zone1 import read as z1
from ..zone1 import recovery
from . import autonomy, messages, refund

STAGES = autonomy.STAGES
FIRST_BATCH = 5
RETRY = ("pending", "failed", "verify_failed")
FOUNDER = "merchant:founder"
WEBHOOK_SAYS = {"401": "still answers 401", "500": "still answers 500", "ack_then_fail": "says OK but grants nothing"}


class ActError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def _key(incident_id: str, action_type: str, payment_id: str) -> str:
    return hashlib.sha256(f"{incident_id}|{action_type}|{payment_id}".encode()).hexdigest()


def _action(db: sqlite3.Connection, action_id: str) -> sqlite3.Row:
    r = db.execute("SELECT * FROM actions WHERE id = ?", (action_id,)).fetchone()
    if not r:
        raise ActError(404, f"Action {action_id} not found.")
    return r


def _items(db: sqlite3.Connection, action_id: str) -> list[sqlite3.Row]:
    return db.execute("SELECT * FROM action_items WHERE action_id = ? ORDER BY rowid", (action_id,)).fetchall()


def _next_stage(a: sqlite3.Row) -> str | None:
    s = a["status"]
    if a["action_type"] == "refund" and s != "drafted":
        return None  # after the dry run a refund has no stage: each customer is approved on their own
    return "dry_run" if s == "drafted" else ("first_5" if a["stage"] == "dry_run" else "rest") if s == "approved" else a["stage"] if s == "failed" else None


def _blocked(db: sqlite3.Connection, a: sqlite3.Row) -> str | None:
    s = autonomy.read(db)
    n = len(_items(db, a["id"]))
    if a["action_type"] != "refund" and n > s.max_bulk_customers:
        return f"{n} customers is above your limit of {s.max_bulk_customers} per action. Raise the limit in settings, then approve."
    if a["action_type"] in ("message", "recovery_link") and not s.messaging_enabled:
        return "Messaging is switched off. Turn it on in settings, then approve."
    if a["action_type"] == "recovery_link":
        row = db.execute("SELECT * FROM incidents WHERE id = ?", (a["incident_id"],)).fetchone()
        return rn.recovery_block(db, row) if row["mismatch_type"] == "G" else z1.recovery_block(db, row)
    return None


def _set_incident(db: sqlite3.Connection, incident_id: str, status: str) -> None:
    now = clock.now().isoformat()
    db.execute("UPDATE incidents SET status = ?, closed_at = ? WHERE id = ?", (status, now if status == "closed" else None, incident_id))


# ---------- read ----------
def _summary(a: sqlite3.Row, items: list[sqlite3.Row], db: sqlite3.Connection | None = None) -> ActionSummary:
    counts = dict(Counter(i["status"] for i in items))
    if db is not None and a["action_type"] == "recovery_link":  # what the links did so far, from the recovery offers
        counts |= recovery.outcome(db, a["incident_id"])
    return ActionSummary(id=a["id"], incident_id=a["incident_id"], action_type=a["action_type"], status=a["status"], stage=a["stage"], approved_by=a["approved_by"], item_counts=counts)


def get(db: sqlite3.Connection, action_id: str) -> Action:
    a = _action(db, action_id)
    items = _items(db, action_id)
    nxt = _next_stage(a)
    return Action(**_summary(a, items, db).model_dump(), params=json.loads(a["params_json"] or "{}"), next_stage=nxt, blocked_reason=_blocked(db, a) if nxt else None,
                  items=[ActionItem(payment_id=i["payment_id"], status=i["status"], idempotency_key=i["idempotency_key"]) for i in items])


def summaries(db: sqlite3.Connection, incident_id: str) -> list[ActionSummary]:
    return [_summary(a, _items(db, a["id"]), db) for a in db.execute("SELECT * FROM actions WHERE incident_id = ? ORDER BY created_at, id", (incident_id,))]


def message_previews(db: sqlite3.Connection, action_id: str | None) -> list[MessagePreview]:
    a = _action(db, action_id) if action_id else db.execute("SELECT * FROM actions WHERE action_type = 'message' ORDER BY created_at DESC LIMIT 1").fetchone()
    if a and a["action_type"] == "recovery_link":
        params, groups, renewal = json.loads(a["params_json"]), {}, _is_renewal(db, a["incident_id"])
        pp = {} if renewal else {p.customer_id: p for p in recovery.people(db, a["incident_id"])}
        tid = "T-G2" if renewal else "T-Z1R"
        for it in _items(db, a["id"]):
            if it["payment_id"] not in params["holdout"]:
                sl = rn.link_slots(db, it["payment_id"], params["valid_hours"]) if renewal else recovery.slots(db, pp[it["payment_id"]], params["valid_hours"])
                groups.setdefault(sl["_lang"] if params["language"] == "auto" else params["language"], []).append(sl)
        return [MessagePreview(template_id=tid, language=lang, category=TEMPLATES[tid]["category"], sender=messages.sender(rows[0]), body=messages.render(tid, lang, rows[0]),
                               recipients=len(rows), holdout_allowed=True) for lang, rows in sorted(groups.items())]
    if not a or a["action_type"] != "message":
        return []
    complained = {r["payment_id"] for r in db.execute("SELECT payment_id FROM incident_members WHERE incident_id = ? AND complained = 1", (a["incident_id"],))}
    return messages.previews(db, [i["payment_id"] for i in _items(db, a["id"])], complained, json.loads(a["params_json"])["language"])


# ---------- plan ----------
def _plan_payments(db: sqlite3.Connection, incident_id: str, action_type: str) -> list[str]:
    if action_type == "recovery_link" and _is_renewal(db, incident_id):  # customers who were promised a link, as failed payment ids like the grants and messages
        return rn.link_candidates(db, incident_id)
    if action_type == "recovery_link":  # customers who could not pay and may be messaged right now. The id column holds the customer, there is no payment
        return [p.customer_id for p in recovery.people(db, incident_id) if p.state == "ready"]
    if action_type == "grant":  # Exact tier only, customers who complained first so the first 5 are the ones the founder has heard of
        return [r["payment_id"] for r in db.execute("""SELECT im.payment_id FROM incident_members im JOIN payments p ON p.id = im.payment_id
                                                     WHERE im.incident_id = ? AND im.tier = 'exact' ORDER BY im.complained DESC, p.captured_at, p.id""", (incident_id,))]
    if action_type == "refund":  # the second charge of each confirmed duplicate, customers who complained first
        return [r["payment_id"] for r in db.execute("""SELECT im.payment_id FROM incident_members im JOIN payments p ON p.id = im.payment_id
                                                     WHERE im.incident_id = ? AND im.tier = 'exact' ORDER BY im.complained DESC, p.captured_at, p.id""", (incident_id,))]
    g = db.execute("SELECT id FROM actions WHERE incident_id = ? AND action_type = ? AND status != 'reverted'", (incident_id, "refund" if _is_dup(db, incident_id) else "grant")).fetchone()
    if g and _is_dup(db, incident_id):  # a customer is told about a refund only once it has its bank reference
        return [r["payment_id"] for r in db.execute("SELECT payment_id FROM action_items WHERE action_id = ? AND status = 'verified' ORDER BY rowid", (g["id"],)) if refund.reference(db, r["payment_id"])]
    return [r["payment_id"] for r in db.execute("SELECT payment_id FROM action_items WHERE action_id = ? AND status = 'verified' ORDER BY rowid", (g["id"],))] if g else []


def _is_dup(db: sqlite3.Connection, incident_id: str) -> bool:
    return db.execute("SELECT mismatch_type FROM incidents WHERE id = ?", (incident_id,)).fetchone()["mismatch_type"] == "E"


def _is_renewal(db: sqlite3.Connection, incident_id: str) -> bool:
    return db.execute("SELECT mismatch_type FROM incidents WHERE id = ?", (incident_id,)).fetchone()["mismatch_type"] == "G"


def create(db: sqlite3.Connection, incident_id: str, action_type: str, params: dict, actor: str = FOUNDER) -> str:
    """One plan per incident and type. Asking again returns it (and updates a draft's settings), which is what makes a double click safe."""
    with _write(db):
        if not db.execute("SELECT 1 FROM incidents WHERE id = ?", (incident_id,)).fetchone():
            raise ActError(404, f"Incident {incident_id} not found.")
        if action_type not in autonomy.ACTION_CLASS:
            raise ActError(422, f"'{action_type}' is not something Blindspot can do yet.")
        if action_type == "refund" and not _is_dup(db, incident_id):
            raise ActError(422, "Refunds are only for customers who were charged twice.")
        if action_type == "grant" and _is_dup(db, incident_id):
            raise ActError(422, "Nothing to restore. Both orders already have access. The second charge is what to refund.")
        if action_type in ("grant", "refund") and params.get("tier", "exact") != "exact":
            raise ActError(422, "Only the Exact group is switched on automatically. Likely and Check manually need your own review.")
        if action_type == "message" and params.get("language", "auto") not in ("auto", *messages.LANGS):
            raise ActError(422, "Language must be auto, en or hi_latn.")
        if action_type == "recovery_link" and db.execute("SELECT zone FROM incidents WHERE id = ?", (incident_id,)).fetchone()["zone"] != "before" and not _is_renewal(db, incident_id):
            raise ActError(422, "Recovery links are for incidents where customers could not get as far as paying, or whose renewal failed on Razorpay's side.")
        params = {"tier": "exact"} if action_type in ("grant", "refund") else {"language": params.get("language", "auto")}
        if action_type == "recovery_link":
            who = _plan_payments(db, incident_id, action_type)
            params |= {"valid_hours": recovery.LINK_HOURS, "holdout_percent": autonomy.read(db).holdout_percent, "holdout": recovery.holdout_ids(who, incident_id, autonomy.read(db).holdout_percent)}
        aid = f"act_{incident_id.removeprefix('INC-')}_{action_type}"
        row = db.execute("SELECT * FROM actions WHERE id = ?", (aid,)).fetchone()
        if row and row["status"] != "reverted":
            if row["status"] == "drafted" and json.loads(row["params_json"]) != params:
                db.execute("UPDATE actions SET params_json = ? WHERE id = ?", (json.dumps(params), aid))
            if action_type == "message" and row["status"] == "done" and _is_dup(db, incident_id):  # more refunds have a bank reference now: tell those customers too, in one more approval
                have = {i["payment_id"] for i in _items(db, aid)}
                new = [p for p in _plan_payments(db, incident_id, action_type) if p not in have]
                for pid in new:
                    k = _key(incident_id, action_type, pid)
                    db.execute("INSERT INTO action_items (id, action_id, payment_id, idempotency_key, status) VALUES (?,?,?,?,?)", (f"ai_{k[:16]}", aid, pid, k, "pending"))
                if new:
                    db.execute("UPDATE actions SET status = 'approved', stage = 'first_5' WHERE id = ?", (aid,))
                    audit.log(db, actor, "action", aid, f"Added {len(new)} customers whose refund now has a bank reference. They are told after the next approval.", incident_id=incident_id)
            return aid
        pids = _plan_payments(db, incident_id, action_type)
        if not pids:
            raise ActError(409, ("Nothing to tell yet. A message about a refund goes only to customers whose refund has a bank reference. Refund them first, then move the clock forward until it is processed."
                                 if _is_dup(db, incident_id) else "Nothing to do yet. Restore access first: a message says access is on, so it only goes to customers whose access is confirmed.")
                           if action_type == "message" else _nobody_renewal(db, incident_id) if action_type == "recovery_link" and _is_renewal(db, incident_id) else _nobody(db, incident_id) if action_type == "recovery_link" else "No Exact-tier customers in this incident.")
        if row:  # undone earlier: arm the same plan again, same keys
            db.execute("UPDATE actions SET status = 'drafted', stage = 'dry_run', params_json = ?, approved_by = NULL, approved_at = NULL WHERE id = ?", (json.dumps(params), aid))
            db.execute("UPDATE action_items SET status = 'pending', prior_state_json = NULL, result_json = NULL, executed_at = NULL, verified_at = NULL WHERE action_id = ?", (aid,))
        else:
            db.execute("INSERT INTO actions (id, incident_id, action_type, status, stage, params_json, created_at) VALUES (?,?,?,?,?,?,?)",
                       (aid, incident_id, action_type, "drafted", "dry_run", json.dumps(params), clock.now().isoformat()))
            for pid in pids:
                k = _key(incident_id, action_type, pid)
                db.execute("INSERT INTO action_items (id, action_id, payment_id, idempotency_key, status) VALUES (?,?,?,?,?)", (f"ai_{k[:16]}", aid, pid, k, "pending"))
        audit.log(db, actor, "action", aid, f"Planned {action_type} for {len(pids)} customers. Nothing has run yet.", incident_id=incident_id)
        _auto(db, aid, autonomy.read(db).autonomy)
    return aid


def _nobody(db: sqlite3.Connection, incident_id: str) -> str:
    why = Counter(p.reason for p in recovery.people(db, incident_id) if p.state == "not_reachable")
    paid = sum(1 for p in recovery.people(db, incident_id) if p.state in ("paid_since", "recovered", "link_sent", "held_back"))
    return "Nobody can be sent a link right now." + (f" {sum(why.values())} cannot be reached: {why.most_common(1)[0][0]}" if why else "") + (f" {paid} are already paid or already have a link." if paid else "")


def _nobody_renewal(db: sqlite3.Connection, incident_id: str) -> str:
    if not rn.told(db, incident_id):
        return "Tell the customers first. The link follows the message that promised it, and goes only to customers who got that message."
    return "Nobody is left to send a link: every customer who was told has either paid again or already has one."


# ---------- run ----------
def _do_grant(db, a, item, approver):
    """Switch access on. For a renewal that failed on Razorpay's side the payment is a failed one, and what is switched on is a grace period."""
    failed = db.execute("SELECT status FROM payments WHERE id = ?", (item["payment_id"],)).fetchone()["status"] == "failed"
    return (merchant_mock.extend_grace(db, item["payment_id"]) if failed else merchant_mock.grant(db, item["payment_id"])), {"granted": True}


def _do_message(db, a, item, approver):
    pid = item["payment_id"]
    slots = messages.slots_for(db, pid)
    complained = bool(db.execute("SELECT complained FROM incident_members WHERE incident_id = ? AND payment_id = ?", (a["incident_id"], pid)).fetchone()["complained"])
    tid, lang = messages.pick(complained, slots, json.loads(a["params_json"])["language"])
    cust = db.execute("SELECT customer_id FROM payments WHERE id = ?", (pid,)).fetchone()["customer_id"]
    mid = policy.send(db, action_id=a["id"], payment_id=pid, customer_id=cust, template_id=tid, language=lang, slots=slots, approved_by=approver)
    return None, {"message_id": mid}


def _record_offer(db, a, oid: str, amount_paise: int, held: bool) -> None:
    link = f"https://rzp.io/l/{hashlib.sha256(oid.encode()).hexdigest()[:8]}"  # a mock of Razorpay's payment link API
    db.execute("INSERT OR REPLACE INTO recovery_offers (id, incident_id, thread_id, order_id, link_ref, amount_paise, holdout, sent_at, paid_at) VALUES (?,?,?,?,?,?,?,?,NULL)",
               (oid, a["incident_id"], None, None, link, amount_paise, int(held), clock.now().isoformat()))


def _do_renewal_link(db, a, item, approver):
    """A renewal link for one customer whose card renewal failed on Razorpay's side. A held-back customer is recorded and not messaged. Someone who paid again meanwhile is refused."""
    params, pid = json.loads(a["params_json"]), item["payment_id"]
    pay = db.execute("SELECT customer_id, amount_paise FROM payments WHERE id = ?", (pid,)).fetchone()
    held = pid in params["holdout"]
    oid = recovery.offer_id(a["incident_id"], pay["customer_id"])
    result = {"offer_id": oid, "held_back": held}
    if not held:
        sl = rn.link_slots(db, pid, params["valid_hours"])
        result["message_id"] = policy.send(db, action_id=a["id"], payment_id=pid, customer_id=pay["customer_id"], template_id="T-G2", language=sl["_lang"] if params["language"] == "auto" else params["language"],
                                           slots=sl, approved_by=approver, block="They have already paid their renewal, so no link is sent." if rn.paid_since(db, pid) else None)
    _record_offer(db, a, oid, pay["amount_paise"], held)
    return None, result


def _do_recovery(db, a, item, approver):
    """A recovery link for one customer who could not pay. A held-back customer is recorded and not messaged. Everyone else goes through the policy engine."""
    if _is_renewal(db, a["incident_id"]):
        return _do_renewal_link(db, a, item, approver)
    params = json.loads(a["params_json"])
    cid = item["payment_id"]
    person = next(p for p in recovery.people(db, a["incident_id"]) if p.customer_id == cid)
    held = cid in params["holdout"]
    oid = recovery.offer_id(a["incident_id"], cid)
    result = {"offer_id": oid, "held_back": held}
    if not held:
        sl = recovery.slots(db, person, params["valid_hours"])
        result["message_id"] = policy.send(db, action_id=a["id"], payment_id=cid, customer_id=cid, template_id="T-Z1R", language=sl["_lang"] if params["language"] == "auto" else params["language"],
                                           slots=sl, approved_by=approver, block=person.reason if person.state != "ready" else None)
    _record_offer(db, a, oid, person.amount_paise, held)
    return None, result


def _check_recovery(db, item, result):
    if not db.execute("SELECT 1 FROM recovery_offers WHERE id = ?", (result["offer_id"],)).fetchone():
        return False
    return result["held_back"] or (db.execute("SELECT status FROM messages WHERE id = ?", (result["message_id"],)).fetchone() or {"status": ""})["status"] == "sent"


def _do_refund(db, a, item, approver):
    """Refund one customer's second charge to the original method. Not undoable, so no prior state."""
    return None, refund.issue(db, item["payment_id"], approver, a["incident_id"])


def _check_refund(db, item, result): return refund.check(db, item["payment_id"])
def _check_grant(db, item, result): return merchant_mock.check(db, item["payment_id"])["has_access"]
def _check_message(db, item, result): return (db.execute("SELECT status FROM messages WHERE id = ?", (result["message_id"],)).fetchone() or {"status": ""})["status"] == "sent"


_DO = {"grant": _do_grant, "message": _do_message, "recovery_link": _do_recovery, "refund": _do_refund}
_CHECK = {"grant": _check_grant, "message": _check_message, "recovery_link": _check_recovery, "refund": _check_refund}


def _exec_item(db: sqlite3.Connection, a: sqlite3.Row, item: sqlite3.Row, approver: str) -> bool:
    try:
        prior, result = _DO[a["action_type"]](db, a, item, approver)
    except (merchant_mock.MockError, PermissionError) as e:
        db.execute("UPDATE action_items SET status = 'failed', result_json = ? WHERE id = ?", (json.dumps({"error": str(e)}), item["id"]))
        audit.log(db, approver, "action", a["id"], f"Stopped at {item['payment_id']}: {e}")
        return False
    now = clock.now().isoformat()
    ok = _CHECK[a["action_type"]](db, item, result)
    db.execute("UPDATE action_items SET status = ?, prior_state_json = ?, result_json = ?, executed_at = ?, verified_at = ? WHERE id = ?",
               ("verified" if ok else "verify_failed", item["prior_state_json"] or (json.dumps(prior) if prior else None), json.dumps(result), now, now, item["id"]))
    if not ok:
        audit.log(db, approver, "verify", a["id"], f"{item['payment_id']} was changed but your records still do not show it. Stopped.")
    return ok


def _do_stage(db: sqlite3.Connection, aid: str, stage: str, approver: str) -> None:
    a = _action(db, aid)
    if stage == "dry_run":
        db.execute("UPDATE actions SET status = 'approved', stage = 'dry_run', approved_by = ?, approved_at = ? WHERE id = ?", (approver, clock.now().isoformat(), aid))
        audit.log(db, approver, "approval", aid, f"Reviewed the dry run for {len(_items(db, aid))} customers. Nothing has changed yet.")
        return
    items = _items(db, aid)
    todo = [i for i in items if i["status"] in RETRY]
    batch = todo[:max(FIRST_BATCH - (len(items) - len(todo)), 0)] if stage == "first_5" else todo
    stopped = False
    for it in batch:
        if not _exec_item(db, a, it, approver):
            stopped = True  # FR-AC-3: a failure stops the batch
            break
    left = sum(1 for i in _items(db, aid) if i["status"] in RETRY)
    status = "failed" if stopped else "done" if left == 0 else "approved"
    db.execute("UPDATE actions SET status = ?, stage = ?, approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, ?) WHERE id = ?",
               (status, stage, approver, clock.now().isoformat(), aid))
    done = sum(1 for i in _items(db, aid) if i["status"] == "verified")
    audit.log(db, approver, "approval", aid, f"Approved {stage.replace('_', ' ')}: {done} of {len(items)} done and confirmed." + (" Stopped on a failure." if stopped else ""), stage=stage)
    if a["action_type"] == "grant":
        _set_incident(db, a["incident_id"], "verifying" if status == "done" else "fixing")


def _auto(db: sqlite3.Connection, aid: str, level: str) -> None:
    """Run every stage the autonomy matrix lets run without a tap, stopping at the first one that needs the founder, is blocked, or failed."""
    while True:
        a = _action(db, aid)
        stage = _next_stage(a)
        if stage is None or a["status"] == "failed" or stage in autonomy.taps(a["action_type"], level) or _blocked(db, a):
            return
        _do_stage(db, aid, stage, f"auto:{level}")


def approve(db: sqlite3.Connection, action_id: str, stage: str, approver: str) -> Action:
    with _write(db):
        a = _action(db, action_id)
        if a["status"] == "reverted":
            raise ActError(409, "This plan was undone. Plan it again to run it.")
        nxt = _next_stage(a)
        if a["action_type"] == "refund" and stage != "dry_run":
            raise ActError(409, "Refunds are approved one customer at a time. Use the Refund button on a customer's row.")
        if nxt is None or STAGES.index(stage) < STAGES.index(nxt):  # a second click on a stage that already ran
            audit.log(db, approver, "approval", action_id, f"Ignored a repeat approval of {stage.replace('_', ' ')}. It already ran, so nothing changed.")
            return get(db, action_id)
        if stage != nxt:
            raise ActError(409, f"Approve '{nxt.replace('_', ' ')}' next, not '{stage.replace('_', ' ')}'.")
        if reason := _blocked(db, a):
            raise ActError(409, reason)
        _do_stage(db, action_id, stage, approver)
        _auto(db, action_id, autonomy.read(db).autonomy)
    return get(db, action_id)


def approve_row(db: sqlite3.Connection, action_id: str, payment_id: str, approver: str) -> Action:
    """Approve and run one refund (FR-AC-7: per row, web only). Refused for anyone but a person, and when a rule such as the daily limit says no."""
    with _write(db):
        a = _action(db, action_id)
        if a["action_type"] != "refund":
            raise ActError(422, "Only refunds are approved one customer at a time.")
        if not approver.startswith("merchant:"):
            raise ActError(403, "A refund needs a person's approval, one customer at a time. It never runs on its own.")
        if a["status"] == "drafted":
            raise ActError(409, "Review the list first: approve the dry run, then refund customers one by one.")
        if a["status"] == "reverted":
            raise ActError(409, "This plan was undone. Plan it again to run it.")
        it = next((i for i in _items(db, action_id) if i["payment_id"] == payment_id), None)
        if it is None:
            raise ActError(404, f"{payment_id} is not in this plan.")
        if it["status"] == "verified":
            audit.log(db, approver, "approval", action_id, f"Ignored a repeat approval of the refund for {payment_id}. It was already refunded, so nothing changed.")
            return get(db, action_id)
        if reason := refund.blocked(db, payment_id, a["incident_id"]):
            raise ActError(409, reason)
        _exec_item(db, a, it, approver)
        left = sum(1 for i in _items(db, action_id) if i["status"] in RETRY)
        db.execute("UPDATE actions SET status = ?, stage = 'rest' WHERE id = ?", ("done" if left == 0 else "approved", action_id))
        _set_incident(db, a["incident_id"], "verifying" if left == 0 else "fixing")
        audit.log(db, approver, "approval", action_id, f"Approved the refund for {payment_id}. {len(_items(db, action_id)) - left} of {len(_items(db, action_id))} refunded.", incident_id=a["incident_id"])
    return get(db, action_id)


# ---------- undo ----------
def revert(db: sqlite3.Connection, action_id: str, actor: str = FOUNDER) -> Action:
    with _write(db):
        a = _action(db, action_id)
        if a["action_type"] == "refund":
            raise ActError(409, "A refund cannot be undone. The money has gone back to the customer's original payment method.")
        if a["action_type"] in ("message", "recovery_link"):
            raise ActError(409, "Messages cannot be unsent.")
        if a["status"] == "reverted":
            return get(db, action_id)
        if a["status"] == "drafted":
            raise ActError(409, "Nothing has run yet, so there is nothing to undo.")
        if db.execute("SELECT 1 FROM messages m JOIN actions x ON x.id = m.action_id WHERE x.incident_id = ? AND m.status = 'sent'", (a["incident_id"],)).fetchone():
            raise ActError(409, "Customers were already told their access is on, so the grants can no longer be undone.")
        n = 0
        for it in _items(db, action_id):
            if it["status"] in ("verified", "verify_failed", "done"):
                try:
                    merchant_mock.restore(db, it["payment_id"], json.loads(it["prior_state_json"]))
                except merchant_mock.MockError as e:
                    raise ActError(409, f"{e} Nothing was undone.") from e
                n += 1
            db.execute("UPDATE action_items SET status = 'reverted' WHERE id = ?", (it["id"],))
        db.execute("UPDATE actions SET status = 'reverted', stage = 'dry_run', approved_by = NULL, approved_at = NULL WHERE id = ?", (action_id,))
        for m in db.execute("SELECT id FROM actions WHERE incident_id = ? AND action_type = 'message' AND status = 'drafted'", (a["incident_id"],)).fetchall():
            db.execute("DELETE FROM action_items WHERE action_id = ?", (m["id"],))  # an unsent message plan listed customers who are no longer restored
            db.execute("DELETE FROM actions WHERE id = ?", (m["id"],))
        _set_incident(db, a["incident_id"], "open")
        audit.log(db, actor, "action", action_id, f"Undid the grants: {n} customers are back to the state they were in before.", incident_id=a["incident_id"])
    return get(db, action_id)


# ---------- verify and close ----------
def verify(db: sqlite3.Connection, incident_id: str, actor: str = "system") -> VerifyResult:
    with _write(db):
        if not db.execute("SELECT 1 FROM incidents WHERE id = ?", (incident_id,)).fetchone():
            raise ActError(404, f"Incident {incident_id} not found.")
        inc = db.execute("SELECT zone, mismatch_type FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        if inc["zone"] == "before":
            return z1.verify(db, incident_id, actor)
        if inc["mismatch_type"] == "G":
            return rn.verify(db, incident_id, actor)
        if inc["mismatch_type"] == "E":
            return dp.verify(db, incident_id, actor)
        h = merchant_mock.health(db)
        g = db.execute("SELECT * FROM actions WHERE incident_id = ? AND action_type = 'grant' AND status != 'reverted'", (incident_id,)).fetchone()
        if not g:
            return VerifyResult(incident_id=incident_id, verified=0, total=0, signal_healthy=h["signal_healthy"], restored_paise=0, closeable=False,
                                line="Nothing has been restored yet. Plan the fix and run it first.")
        now = clock.now().isoformat()
        for it in _items(db, g["id"]):
            if it["status"] in ("done", "verified", "verify_failed"):
                db.execute("UPDATE action_items SET status = ?, verified_at = ? WHERE id = ?", ("verified" if _check_grant(db, it, {}) else "verify_failed", now, it["id"]))
        items = _items(db, g["id"])
        verified = sum(1 for i in items if i["status"] == "verified")
        restored = db.execute("SELECT COALESCE(SUM(p.amount_paise), 0) AS s FROM action_items i JOIN payments p ON p.id = i.payment_id WHERE i.action_id = ? AND i.status = 'verified'", (g["id"],)).fetchone()["s"]
        closeable = verified == len(items) and h["signal_healthy"]
        line = f"{verified} of {len(items)} confirmed active by your records."
        if closeable:
            line += f" Your webhook has answered normally for {int(h['healthy_hours'])} hours. ₹{messages.inr(restored)} restored."
        elif h["webhook_mode"] != "ok":
            line += f" Your webhook {WEBHOOK_SAYS[h['webhook_mode']]}. Ask your developer to ship the fix, then verify again."
        elif not h["signal_healthy"]:
            line += f" Your webhook has been healthy for {h['healthy_hours']} of {merchant_mock.HEALTHY_HOURS} hours. Verify again later."
        else:
            line += f" {len(items) - verified} still show no access. Run the plan again to retry them."
        _set_incident(db, incident_id, "closed" if closeable else "verifying" if verified == len(items) else "fixing")
        if closeable:
            from ..conversation import machine  # threads waiting on this incident are resolved with it

            machine.resolve_threads(db, incident_id)
        last = db.execute("SELECT payload_json FROM audit_log WHERE kind = 'verify' AND ref_id = ? ORDER BY id DESC LIMIT 1", (incident_id,)).fetchone()
        if not last or json.loads(last["payload_json"])["summary"] != line:  # re-checking an unchanged result is not news
            audit.log(db, actor, "verify", incident_id, line, closeable=closeable)
    return VerifyResult(incident_id=incident_id, verified=verified, total=len(items), signal_healthy=h["signal_healthy"], restored_paise=restored, closeable=closeable, line=line)
