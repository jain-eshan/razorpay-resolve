"""The conversation agent (SPEC section 4): one thread per customer and channel, a fixed state machine, three questions at most.

    opened -> triage -> not a payment -> pass_back
                     -> identify -> lookup -> matched -> explain / wait_for_fix -> resolved
                                          -> not_found -> (second miss) human
                     -> handoff (any state), with a one-screen brief for the founder

The agent never grants, refunds or edits settings. It finds the payment by an exact identifier, says what the record shows, and hands over
when a decision is needed. Customer text is data: an injection attempt, a threat or a request for a human ends the automatic part at once.
Every reply goes through channels/policy.py. Fuzzy matches go to the founder's brief and are never shown to the customer."""
import hashlib
import json
import re
import sqlite3
import uuid
from datetime import datetime, timedelta

from .. import audit, clock, merchant_mock
from ..act import autonomy, messages
from ..act.executor import ActError
from ..channels import policy
from ..channels.sim import ADAPTERS
from ..db import write_tx
from ..ingest.extract import Extraction, Ids, extract
from ..ingest.redact import Redacted, redact
from ..match import lookup as mt
from ..schemas import (
    CaseSummary,
    Channel,
    Consent,
    ConsentRequest,
    ThreadDetail,
    ThreadMessage,
    ThreadStep,
    ThreadSummary,
)

MAX_QUESTIONS = 3
QUESTIONS = ("T-ID1", "T-ID2", "T-ID3")
NUDGE_AFTER = timedelta(hours=6)
HUMAN_ASK = re.compile(r"\b(?:human|real person|agent|manager|supervisor|someone|insaan|banda|bande se|call me|talk to|speak to)\b", re.IGNORECASE)
LEGAL = re.compile(r"charge\s?back|consumer court|legal|lawyer|police|\bfir\b|ombudsman|\brbi\b", re.IGNORECASE)
OPEN = ("opened", "triage", "identify", "lookup", "matched", "explain", "wait_for_fix", "not_found")
CLAIM_LABEL = {"debited_no_access": "paid but has no access", "debited_no_order": "was charged but the order did not go through", "charged_twice": "was charged twice",
               "refund_not_received": "has not received a refund", "charged_after_cancel": "was charged after cancelling", "renewal_failed": "renewal failed",
               "payment_failed": "payment failed", "page_error": "the pay page did not open", "checkout_not_opening": "checkout would not open",
               "other": "something about payments"}
CONVERSATIONAL = ("help_button", "whatsapp_payments", "email")


def _merchant(db: sqlite3.Connection) -> sqlite3.Row:
    return db.execute("SELECT * FROM merchants LIMIT 1").fetchone()


def _name(db: sqlite3.Connection) -> str:
    return _merchant(db)["name"].split(" (")[0]


# ---------- channels and consent (S-12) ----------
def ensure_channels(db: sqlite3.Connection) -> None:
    if db.execute("SELECT 1 FROM channels LIMIT 1").fetchone():
        return
    m, now = _merchant(db), clock.now().isoformat()
    ident = f"{_name(db)} payment help, powered by Razorpay"
    seeds = [("ch_help", "help_button", True), ("ch_wa", "whatsapp_payments", True), ("ch_email", "email", True), ("ch_ig", "ig_dm", False), ("ch_fb", "fb_dm", False),
             ("ch_public", "public_mention", False), ("ch_ray", "ray_forward", True), ("ch_paste", "paste", True), ("ch_csv", "csv", True)]
    for cid, kind, on in seeds:
        db.execute("INSERT INTO channels (id, merchant_id, type, status, reply_identity, autonomy_level, connected_at) VALUES (?,?,?,?,?,?,?)",
                   (cid, m["id"], kind, "connected" if on else "disconnected", ident if kind in CONVERSATIONAL else None, "suggest", now if on else None))
        if kind in CONVERSATIONAL:
            _grant(db, cid, m["id"], ["Read payment-related messages", f"Reply as {ident}", "Look up payments by an identifier the customer shares"], m["owner_contact"] or "founder", f"cn_{cid}")
    db.commit()


def _grant(db: sqlite3.Connection, channel_id: str, merchant_id: str, scopes: list[str], by: str, cid: str | None = None) -> str:
    cid = cid or f"cn_{uuid.uuid4().hex[:8]}"
    db.execute("INSERT INTO consents (id, merchant_id, channel_id, scopes_json, granted_by, granted_at, retention_days) VALUES (?,?,?,?,?,?,?)",
               (cid, merchant_id, channel_id, json.dumps(scopes), by, clock.now().isoformat(), 30))
    return cid


def channels(db: sqlite3.Connection) -> list[Channel]:
    ensure_channels(db)
    return [Channel(id=r["id"], type=r["type"], status=r["status"], reply_identity=r["reply_identity"], autonomy_level=r["autonomy_level"],
                    connected_at=datetime.fromisoformat(r["connected_at"]) if r["connected_at"] else None, mocked=True) for r in db.execute("SELECT * FROM channels ORDER BY rowid")]


def update_channel(db: sqlite3.Connection, channel_id: str, status: str | None, level: str | None, actor: str = "merchant:founder") -> Channel:
    ensure_channels(db)
    with write_tx(db):
        ch = db.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
        if not ch:
            raise ActError(404, f"Channel {channel_id} not found.")
        if level and level != ch["autonomy_level"]:
            db.execute("UPDATE channels SET autonomy_level = ? WHERE id = ?", (level, channel_id))
            audit.log(db, actor, "approval", channel_id, f"Changed {ch['type']} autonomy from {ch['autonomy_level']} to {level}")
        if status and status != ch["status"]:
            if status == "disconnected":  # processing stops at once
                db.execute("UPDATE consents SET revoked_at = ? WHERE channel_id = ? AND revoked_at IS NULL", (clock.now().isoformat(), channel_id))
                db.execute("UPDATE channels SET status = 'disconnected', disconnected_at = ? WHERE id = ?", (clock.now().isoformat(), channel_id))
            elif status == "connected":
                if ch["type"] in CONVERSATIONAL and not db.execute("SELECT 1 FROM consents WHERE channel_id = ? AND revoked_at IS NULL", (channel_id,)).fetchone():
                    raise ActError(409, "Grant consent for this channel first, then connect it.")
                db.execute("UPDATE channels SET status = 'connected', connected_at = ?, disconnected_at = NULL WHERE id = ?", (clock.now().isoformat(), channel_id))
            else:
                db.execute("UPDATE channels SET status = ? WHERE id = ?", (status, channel_id))
            audit.log(db, actor, "approval", channel_id, f"Changed {ch['type']} from {ch['status']} to {status}")
    return next(c for c in channels(db) if c.id == channel_id)


def consents(db: sqlite3.Connection) -> list[Consent]:
    ensure_channels(db)
    return [Consent(id=r["id"], channel_id=r["channel_id"], scopes=json.loads(r["scopes_json"]), granted_by=r["granted_by"], granted_at=datetime.fromisoformat(r["granted_at"]),
                    revoked_at=datetime.fromisoformat(r["revoked_at"]) if r["revoked_at"] else None, retention_days=r["retention_days"]) for r in db.execute("SELECT * FROM consents ORDER BY granted_at, rowid")]


def grant_consent(db: sqlite3.Connection, body: ConsentRequest) -> Consent:
    ensure_channels(db)
    with write_tx(db):
        ch = db.execute("SELECT * FROM channels WHERE id = ?", (body.channel_id,)).fetchone()
        if not ch:
            raise ActError(404, f"Channel {body.channel_id} not found.")
        cid = _grant(db, body.channel_id, ch["merchant_id"], body.scopes, body.granted_by)
        audit.log(db, f"merchant:{body.granted_by}", "approval", body.channel_id, f"Granted consent for {ch['type']}: {', '.join(body.scopes)}")
    return next(c for c in consents(db) if c.id == cid)


# ---------- extraction state kept per complaint ----------
def _vault(db: sqlite3.Connection, cid: str) -> dict[str, tuple[str, str]]:
    """The vault's token column is one global key, so each complaint's tokens are stored as 'complaint_id:[RRN_1]'."""
    return {r["token"].split(":", 1)[1]: (r["kind"], r["value"]) for r in db.execute("SELECT * FROM token_vault WHERE complaint_id = ?", (cid,))}


def _redact(db: sqlite3.Connection, cid: str | None, text: str) -> Redacted:
    """Redact new text so its tokens continue the numbering already in this complaint's vault."""
    old = _vault(db, cid) if cid else {}
    red = redact(text)
    if not old:
        return red
    # renumber: the fresh tokens [KIND_n] are shifted past the highest existing n of that kind, and values already in the vault reuse their token
    by_value = {v: t for t, v in old.items()}
    counts: dict[str, int] = {}
    for t, (k, _) in old.items():
        counts[k] = max(counts.get(k, 0), int(re.search(r"_(\d+)\]", t).group(1)))
    mapping: dict[str, str] = {}
    vault = dict(old)
    for t, (k, v) in red.vault.items():
        if (k, v) in by_value:
            mapping[t] = by_value[(k, v)]
        else:
            counts[k] = counts.get(k, 0) + 1
            mapping[t] = f"[{k.upper()}_{counts[k]}]"
            vault[mapping[t]] = (k, v)
    text = re.sub(r"\[[A-Z0-9_]+_\d+\]", lambda m: mapping.get(m.group(0), m.group(0)), red.text)
    return Redacted(text, vault)


def _merge(old: Extraction | None, new: Extraction) -> Extraction:
    if old is None:
        return new
    d, o = new.model_dump(), old.model_dump()
    for k, v in d.items():
        if k in ("window", "ids"):
            continue
        if v in (None, "unknown", False) or (k in ("claim", "topic") and new.claim == "other") or (k == "language" and v == "en" and o[k] != "en"):
            d[k] = o[k]
    d["ids"] = {k: (new.ids.model_dump()[k] or old.ids.model_dump()[k]) for k in Ids.model_fields}
    d["window"] = new.window or old.window
    d["injection_suspected"] = new.injection_suspected or old.injection_suspected
    return Extraction.model_validate({**d, "window": d["window"]})


def _saved(db: sqlite3.Connection, cid: str | None) -> Extraction | None:
    r = db.execute("SELECT json FROM extractions WHERE complaint_id = ?", (cid,)).fetchone() if cid else None
    return Extraction.model_validate_json(r["json"]) if r else None


# ---------- one inbound message ----------
def handle_inbound(db: sqlite3.Connection, channel: str, customer_ref: str, text: str | None, context: dict, received_at: datetime | None = None, is_public: bool = False) -> str:
    ensure_channels(db)
    if channel not in ADAPTERS:
        raise ActError(422, f"'{channel}' is not a conversational channel.")
    with write_tx(db):
        ch = db.execute("SELECT * FROM channels WHERE type = ?", (channel,)).fetchone()
        if ch["status"] != "connected":
            raise ActError(409, f"The {channel.replace('_', ' ')} channel is not connected.")
        now = received_at or clock.now()
        cref = f"cust_{hashlib.sha256(customer_ref.encode()).hexdigest()[:12]}"
        th = db.execute("SELECT * FROM threads WHERE channel_id = ? AND customer_ref = ? AND state IN (%s) ORDER BY opened_at DESC LIMIT 1" % ",".join("?" * len(OPEN)),
                        (ch["id"], cref, *OPEN)).fetchone()
        if not th:
            tid = f"thr_{uuid.uuid4().hex[:8]}"
            db.execute("INSERT INTO threads (id, merchant_id, channel_id, external_ref, customer_ref, opened_at, last_inbound_at, state, language, is_public) VALUES (?,?,?,?,?,?,?,?,?,?)",
                       (tid, ch["merchant_id"], ch["id"], context.get("external_ref"), cref, now.isoformat(), now.isoformat(), "opened", "en", int(is_public)))
        else:
            tid = th["id"]
            db.execute("UPDATE threads SET last_inbound_at = ? WHERE id = ?", (now.isoformat(), tid))
        body = (text or "") + ("\n" + context["screenshot_text"] if context.get("screenshot_text") else "")  # the screenshot reader's output is treated as customer text
        _turn(db, tid, channel, body, context, now)
    return tid


def _say(db: sqlite3.Connection, tid: str, tpl: str, slots: dict, language: str, message_class: str, now: datetime, nudge: bool = False) -> tuple[str, bool]:
    """Render a template (adding the AI disclosure on the first agent message) and send it through the policy engine."""
    th = db.execute("SELECT t.*, c.type AS ctype FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?", (tid,)).fetchone()
    lang = language if language in messages.LANGS else "en"
    body = messages.render(tpl, lang, slots)
    use_tpl = tpl
    if not th["disclosed"]:  # the first agent message says it is an AI. The inner greeting is dropped so it does not say "Hi" twice.
        inner = re.sub(r"^Hi [^,]+,\s*", "", body)
        inner = inner[:1].upper() + inner[1:]
        body = messages.render("T-DISC", lang, {"merchant": slots["merchant"], "body": inner})
        use_tpl, slots = "T-DISC", {"merchant": slots["merchant"], "body": inner}
    mid, d = policy.send_thread(db, th, th["ctype"], body=body, template_id=use_tpl, language=lang, slots=slots, message_class=message_class, approved_by="auto" if not d_needs(db, message_class, th["channel_id"]) else None,
                                now=now, nudge=nudge)
    return mid, d.allowed


def d_needs(db: sqlite3.Connection, message_class: str, channel_id: str) -> bool:
    return autonomy.MATRIX[message_class][policy.channel_level(db, channel_id)] != "auto"


def _lang(x: Extraction) -> str:
    return "hi_latn" if x.language in ("hi_latn", "mixed") else "en"


def _turn(db: sqlite3.Connection, tid: str, channel: str, body: str, context: dict, now: datetime) -> None:
    th = db.execute("SELECT * FROM threads WHERE id = ?", (tid,)).fetchone()
    cid = db.execute("SELECT complaint_id FROM cases WHERE id = ?", (th["case_id"],)).fetchone()["complaint_id"] if th["case_id"] else None
    red = _redact(db, cid, body)
    ctx_pay = db.execute("SELECT id FROM payments WHERE id = ? OR order_id = ?", (context.get("payment_id"), context.get("order_id"))).fetchone() if (context.get("payment_id") or context.get("order_id")) else None
    new = extract(red, now, known_payment=bool(ctx_pay))
    name = _name(db)
    slots0 = {"merchant": name, "first_name": "there"}
    lang = _lang(new)  # replaced by the language of the whole conversation once the earlier messages are merged in

    handoff = _handoff_reason(new, body)
    if not new.is_payment_related and not th["claim"] and not ctx_pay and not handoff:
        # not a payment: nothing about the customer's message is kept, only a count
        db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('dropped_messages', ?)", (json.dumps(1 + int((db.execute("SELECT value FROM settings WHERE key = 'dropped_messages'").fetchone() or {"value": "0"})["value"])),))
        db.execute("UPDATE threads SET state = 'pass_back', closed_at = ? WHERE id = ?", (now.isoformat(), tid))
        _say(db, tid, "T-HO", slots0, lang, "disclosure_or_question", now)
        return

    # keep the message (redacted) and the complaint it belongs to
    if not cid:
        cid, case_id = f"cmp_{uuid.uuid4().hex[:10]}", f"cs_{uuid.uuid4().hex[:8]}"
        db.execute("INSERT INTO complaints (id, merchant_id, channel, received_at, from_handle, raw_text, raw_hash, redacted_text, data_role, customer_ref) VALUES (?,?,?,?,?,?,?,?,?,?)",
                   (cid, th["merchant_id"], channel, now.isoformat(), th["customer_ref"], red.text, hashlib.sha256(body.encode()).hexdigest(), red.text,
                    "razorpay_fiduciary" if channel == "help_button" else "merchant_data_processor", th["customer_ref"]))
        db.execute("INSERT INTO cases (id, complaint_id, match_status, matched_payment_ids, created_at) VALUES (?,?,?,?,?)", (case_id, cid, "needs_detail", "[]", now.isoformat()))
        db.execute("UPDATE threads SET case_id = ? WHERE id = ?", (case_id, tid))
    for token, (kind, value) in red.vault.items():
        db.execute("INSERT OR IGNORE INTO token_vault (token, complaint_id, kind, value) VALUES (?,?,?,?)", (f"{cid}:{token}", cid, kind, value))
    db.execute("INSERT INTO thread_messages (id, thread_id, direction, sender_role, body_redacted, raw_hash, created_at) VALUES (?,?,?,?,?,?,?)",
               (f"tm_{uuid.uuid4().hex[:12]}", tid, "inbound", "customer", red.text, hashlib.sha256(body.encode()).hexdigest(), now.isoformat()))
    x = _merge(_saved(db, cid), new)
    lang = _lang(x)  # a customer who started in Hinglish is answered in Hinglish even if the next message is just a reference number
    db.execute("UPDATE threads SET language = ? WHERE id = ?", (lang, tid))
    db.execute("INSERT OR REPLACE INTO extractions (complaint_id, model_id, prompt_version, json, injection_suspected, status, created_at) VALUES (?,?,?,?,?,?,?)",
               (cid, "rules-v1", "0", x.model_dump_json(), int(x.injection_suspected), "ok", now.isoformat()))
    db.execute("UPDATE threads SET claim = ?, state = 'triage' WHERE id = ?", (x.claim, tid))

    if handoff:
        _handoff(db, tid, handoff, x, red, now)
        return

    # lookup: a payment id from a help button is as good as one the customer typed
    full = Redacted("\n".join(r["body_redacted"] for r in db.execute("SELECT body_redacted FROM thread_messages WHERE thread_id = ? AND direction = 'inbound' ORDER BY created_at, rowid", (tid,))), _vault(db, cid))
    cal = mt.load_calibrator()
    res = mt.lookup(db, full, x, now, cal)
    if not res.exact and ctx_pay:
        res = mt.MatchResult("matched", exact=[mt.Candidate(ctx_pay["id"], "exact_payment_id", 0.99)])
    for c in res.exact + res.suggestions:
        db.execute("INSERT OR REPLACE INTO match_candidates (complaint_id, payment_id, method, raw_score, calibrated_score, features, rank) VALUES (?,?,?,?,?,?,?)",
                   (cid, c.payment_id, c.method, c.score, c.score, json.dumps(c.features), (res.exact + res.suggestions).index(c) + 1))
    if res.exact:
        _explain(db, tid, cid, res, x, lang, now)
        return
    th = db.execute("SELECT * FROM threads WHERE id = ?", (tid,)).fetchone()
    asked = th["question_count"]
    if res.key_not_found:
        asked += 1  # a wrong identifier counts as a miss
        db.execute("UPDATE threads SET question_count = ?, state = 'not_found' WHERE id = ?", (asked, tid))
        if asked >= 2:
            _handoff(db, tid, "We could not find the payment from the details given, after two tries.", x, full, now, human=True, suggestions=res.suggestions)
            return
        _say(db, tid, "T-NF", {**slots0, "date": _date_slot(x, now)}, lang, "disclosure_or_question", now)
        return
    if asked >= MAX_QUESTIONS:
        _handoff(db, tid, "Three questions asked and no payment identified.", x, full, now, human=True, suggestions=res.suggestions)
        return
    db.execute("UPDATE threads SET question_count = ?, state = 'identify' WHERE id = ?", (asked + 1, tid))
    _say(db, tid, QUESTIONS[asked], slots0, lang, "disclosure_or_question", now)


def _date_slot(x: Extraction, now: datetime) -> str:
    return f"{x.window.start.day} {x.window.start:%b}" if x.window and x.window.resolved else "the time you mentioned"


def _handoff_reason(x: Extraction, body: str) -> str | None:
    if x.injection_suspected:
        return "The message tried to give the system instructions. Treated as data and not followed."
    if x.sentiment == "threatening_chargeback_or_public" or LEGAL.search(body):
        return "The customer mentioned a chargeback, legal action or going public."
    if HUMAN_ASK.search(body):
        return "The customer asked for a person."
    if x.claim == "charged_twice":
        return "Duplicate charge: a refund decision is needed."
    if x.claim == "refund_not_received" or x.customer_wants == "refund" and x.claim != "debited_no_access":
        return "Money decision: the customer wants a refund."
    return None


# ---------- matched: say what the record shows ----------
def _explain(db: sqlite3.Connection, tid: str, cid: str, res: mt.MatchResult, x: Extraction, lang: str, now: datetime) -> None:
    th = db.execute("SELECT * FROM threads WHERE id = ?", (tid,)).fetchone()
    case = db.execute("SELECT * FROM cases WHERE id = ?", (th["case_id"],)).fetchone()
    pids = [c.payment_id for c in res.exact]
    pid = pids[0]
    p = db.execute("SELECT * FROM payments WHERE id = ?", (pid,)).fetchone()
    db.execute("UPDATE cases SET match_status = 'matched', matched_payment_ids = ? WHERE id = ?", (json.dumps(pids), case["id"]))
    if len({r["order_id"] for r in db.execute("SELECT order_id FROM payments WHERE id IN (%s)" % ",".join("?" * len(pids)), pids)}) == 1 and len(pids) > 1:
        _handoff(db, tid, f"{len(pids)} captured payments on one order: a possible duplicate charge.", x, None, now)
        return
    if p["status"] == "refunded" or db.execute("SELECT 1 FROM refunds WHERE payment_id = ?", (pid,)).fetchone():
        _handoff(db, tid, "This payment was already refunded. Confirm with the customer what they expect.", x, None, now)
        return
    member = db.execute("SELECT im.*, i.status AS inc_status, i.owner, i.mismatch_type FROM incident_members im JOIN incidents i ON i.id = im.incident_id WHERE im.payment_id = ? LIMIT 1", (pid,)).fetchone()
    has_access = merchant_mock.check(db, pid)["has_access"]
    slots = {k: v for k, v in messages.slots_for(db, pid).items() if not k.startswith("_")}
    if member and not has_access:
        db.execute("UPDATE incident_members SET complained = 1, case_id = ? WHERE incident_id = ? AND payment_id = ?", (case["id"], member["incident_id"], pid))
        db.execute("UPDATE cases SET mismatch_type = ?, owner = ?, incident_id = ? WHERE id = ?", (member["mismatch_type"], member["owner"], member["incident_id"], case["id"]))
        db.execute("UPDATE threads SET state = 'wait_for_fix', incident_id = ?, zone = 'after' WHERE id = ?", (member["incident_id"], tid))
        _say(db, tid, "T-ACK", slots, lang, "status_reply", now)
    elif has_access:
        db.execute("UPDATE threads SET state = 'explain' WHERE id = ?", (tid,))
        _say(db, tid, "T-OK", slots, lang, "status_reply", now)
    else:
        _handoff(db, tid, "The payment is real and your access record does not show it, but no incident covers it.", x, None, now)


# ---------- handoff and the founder's brief ----------
def _brief(db: sqlite3.Connection, tid: str, reason: str, x: Extraction, suggestions: list[mt.Candidate]) -> str:
    th = db.execute("SELECT t.*, c.type AS ctype FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?", (tid,)).fetchone()
    inbound = db.execute("SELECT COUNT(*) AS n FROM thread_messages WHERE thread_id = ? AND direction = 'inbound'", (tid,)).fetchone()["n"]
    case = db.execute("SELECT matched_payment_ids FROM cases WHERE id = ?", (th["case_id"],)).fetchone() if th["case_id"] else None
    lines = [f"Why this needs you: {reason}",
             f"Who: a customer on {th['ctype'].replace('_', ' ')}, {inbound} message{'s' if inbound != 1 else ''}, {x.language.replace('_', ' ')}.",
             f"They say: {CLAIM_LABEL[x.claim]}" + (f", Rs {messages.inr(x.amount_paise)}" if x.amount_paise else "") + (f", around {x.stated_time_text}" if x.stated_time_text else "") + "."]
    if case and json.loads(case["matched_payment_ids"] or "[]"):
        lines.append("Found by an exact identifier: " + ", ".join(json.loads(case["matched_payment_ids"])) + ".")
    else:
        lines.append("No exact identifier matched.")
    if suggestions:
        lines.append("Closest guesses, for you only (never shown to the customer): " + "; ".join(
            f"{c.payment_id} {round(c.score * 100)}%" for c in suggestions[:3]) + ".")
    lines.append(f"Questions asked so far: {th['question_count']} of {MAX_QUESTIONS}.")
    return "\n".join(lines)


def _handoff(db: sqlite3.Connection, tid: str, reason: str, x: Extraction, red: Redacted | None, now: datetime, human: bool = False, suggestions: list[mt.Candidate] | None = None) -> None:
    if suggestions is None and red is not None and x.amount_paise:
        suggestions = mt.fuzzy(db, red, x, now, mt.load_calibrator())
    brief = _brief(db, tid, reason, x, suggestions or [])
    db.execute("UPDATE threads SET state = ? WHERE id = ?", ("human" if human else "handoff", tid))
    db.execute("INSERT INTO escalations (id, thread_id, target, pack_json, ref, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
               (f"esc_{uuid.uuid4().hex[:8]}", tid, "founder", json.dumps({"brief": brief, "reason": reason}), f"MG-THR-{tid[4:]}", "open", now.isoformat(), now.isoformat()))
    audit.log(db, "system", "action", tid, f"Handed to the founder: {reason}", thread_id=tid)
    _say(db, tid, "T-HO", {"merchant": _name(db), "first_name": "there"}, _lang(x), "disclosure_or_question", now)


def founder_brief(db: sqlite3.Connection, tid: str) -> str | None:
    r = db.execute("SELECT pack_json FROM escalations WHERE thread_id = ? AND target = 'founder' ORDER BY created_at DESC, rowid DESC LIMIT 1", (tid,)).fetchone()
    return json.loads(r["pack_json"])["brief"] if r else None


# ---------- founder actions ----------
def reply(db: sqlite3.Connection, thread_id: str, body: str | None, template_id: str | None, approved_by: str) -> ThreadStep:
    with write_tx(db):
        th = db.execute("SELECT t.*, c.type AS ctype FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?", (thread_id,)).fetchone()
        if not th:
            raise ActError(404, f"Thread {thread_id} not found.")
        now = clock.now()
        approver = f"merchant:{approved_by}"
        if body is None:  # approve the held draft as it is
            d = db.execute("SELECT * FROM thread_messages WHERE thread_id = ? AND direction = 'outbound' AND json_extract(policy_json, '$.status') = 'draft' ORDER BY created_at DESC, rowid DESC LIMIT 1", (thread_id,)).fetchone()
            if not d:
                raise ActError(409, "There is no draft to approve.")
            pj = json.loads(d["policy_json"])
            _, dec = policy.send_thread(db, th, th["ctype"], body=d["body_redacted"], template_id=d["template_id"], language=pj.get("language", "en"), slots=pj.get("slots") or None,
                                        message_class=pj["class"], approved_by=approver, now=now, draft_of=d["id"], store_blocked=False)
            if not dec.allowed:
                raise ActError(409, " ".join(dec.reasons))
            audit.log(db, approver, "approval", thread_id, "Approved the drafted reply and sent it.", thread_id=thread_id)
        else:  # the founder's own words: the same checks apply
            _, dec = policy.send_thread(db, th, th["ctype"], body=body, template_id=template_id, language="en", slots=None, message_class="status_reply", approved_by=approver,
                                        now=now, sender_role="founder", store_blocked=False)
            if not dec.allowed:
                raise ActError(409, " ".join(dec.reasons))
            audit.log(db, approver, "approval", thread_id, "Sent their own reply.", thread_id=thread_id)
    return step(db, thread_id)


def handoff(db: sqlite3.Connection, thread_id: str, reason: str) -> ThreadStep:
    with write_tx(db):
        th = db.execute("SELECT * FROM threads WHERE id = ?", (thread_id,)).fetchone()
        if not th:
            raise ActError(404, f"Thread {thread_id} not found.")
        cid = db.execute("SELECT complaint_id FROM cases WHERE id = ?", (th["case_id"],)).fetchone()
        x = _saved(db, cid["complaint_id"] if cid else None) or Extraction(topic="other", is_payment_related=False, language="en", claim="other")
        _handoff(db, thread_id, reason, x, None, clock.now())
    return step(db, thread_id)


def nudge_silent(db: sqlite3.Connection, now: datetime) -> int:
    """One nudge inside the window to a customer who has not answered, then park. Never a second nudge."""
    n = 0
    with write_tx(db):
        for th in db.execute("SELECT * FROM threads WHERE state IN ('identify','not_found')").fetchall():
            last = db.execute("SELECT direction, sender_role, created_at, json_extract(policy_json, '$.status') AS status FROM thread_messages WHERE thread_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1", (th["id"],)).fetchone()
            if not last or last["direction"] != "outbound" or last["sender_role"] != "agent" or last["status"] != "sent" or datetime.fromisoformat(last["created_at"]) > now - NUDGE_AFTER:
                continue  # only when our question is the last word, it was actually sent, and the customer has been quiet long enough
            if db.execute("SELECT 1 FROM thread_messages WHERE thread_id = ? AND json_extract(policy_json, '$.nudge') = 1", (th["id"],)).fetchone():
                continue
            _, ok = _say(db, th["id"], "T-ND", {"merchant": _name(db), "first_name": "there"}, th["language"], "disclosure_or_question", now, nudge=True)
            n += ok
    return n


def resolve_threads(db: sqlite3.Connection, incident_id: str) -> int:
    """When an incident closes, threads waiting on it are resolved. A customer who has not already been told gets the 'it's fixed' message."""
    now, n = clock.now(), 0
    for th in db.execute("SELECT * FROM threads WHERE state = 'wait_for_fix' AND incident_id = ?", (incident_id,)).fetchall():
        case = db.execute("SELECT matched_payment_ids FROM cases WHERE id = ?", (th["case_id"],)).fetchone()
        pid = json.loads(case["matched_payment_ids"])[0]
        db.execute("UPDATE threads SET state = 'resolved', closed_at = ? WHERE id = ?", (now.isoformat(), th["id"]))
        if not db.execute("SELECT 1 FROM messages WHERE payment_id = ? AND status = 'sent'", (pid,)).fetchone():
            slots = {k: v for k, v in messages.slots_for(db, pid).items() if not k.startswith("_")}
            _say(db, th["id"], "T-A2", slots, th["language"], "status_reply", now)
        n += 1
    return n


# ---------- read ----------
def _summary(r: sqlite3.Row, ctype: str) -> ThreadSummary:
    return ThreadSummary(id=r["id"], channel=ctype, state=r["state"], claim=r["claim"], zone=r["zone"], language=r["language"] or "en", customer_ref=r["customer_ref"],
                         last_inbound_at=datetime.fromisoformat(r["last_inbound_at"]), window_expires_at=datetime.fromisoformat(r["window_expires_at"]) if r["window_expires_at"] else None,
                         incident_id=r["incident_id"], question_count=r["question_count"], is_public=bool(r["is_public"]))


def list_threads(db: sqlite3.Connection, state: str | None = None, incident: str | None = None) -> list[ThreadSummary]:
    ensure_channels(db)
    rows = db.execute("SELECT t.*, c.type AS ctype FROM threads t JOIN channels c ON c.id = t.channel_id WHERE (? IS NULL OR t.state = ?) AND (? IS NULL OR t.incident_id = ?) ORDER BY t.opened_at DESC, t.rowid DESC",
                      (state, state, incident, incident)).fetchall()
    return [_summary(r, r["ctype"]) for r in rows]


def get_thread(db: sqlite3.Connection, thread_id: str) -> ThreadDetail | None:
    r = db.execute("SELECT t.*, c.type AS ctype FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?", (thread_id,)).fetchone()
    if not r:
        return None
    msgs = [ThreadMessage(id=m["id"], direction=m["direction"], sender_role=m["sender_role"], body=m["body_redacted"], created_at=datetime.fromisoformat(m["created_at"]),
                          template_id=m["template_id"], approved_by=m["approved_by"], policy=json.loads(m["policy_json"] or "{}"))
            for m in db.execute("SELECT * FROM thread_messages WHERE thread_id = ? ORDER BY created_at, rowid", (thread_id,))]
    case = None
    if r["case_id"]:
        c = db.execute("SELECT cs.*, cm.channel, cm.received_at FROM cases cs JOIN complaints cm ON cm.id = cs.complaint_id WHERE cs.id = ?", (r["case_id"],)).fetchone()
        case = CaseSummary(id=c["id"], complaint_id=c["complaint_id"], channel=c["channel"], match_status=c["match_status"], mismatch_type=c["mismatch_type"], owner=c["owner"],
                           incident_id=c["incident_id"], received_at=datetime.fromisoformat(c["received_at"]))
    return ThreadDetail(**_summary(r, r["ctype"]).model_dump(), messages=msgs, case=case, disclosed=bool(r["disclosed"]), founder_brief=founder_brief(db, thread_id))


def step(db: sqlite3.Connection, thread_id: str) -> ThreadStep:
    t = get_thread(db, thread_id)
    sent = [m for m in t.messages if m.direction == "outbound" and m.policy.get("status") == "sent"]
    draft = next((m for m in reversed(t.messages) if m.direction == "outbound" and m.policy.get("status") == "draft"), None)
    return ThreadStep(thread=t, drafted_reply=draft.body if draft else None, auto_sent=bool(sent and sent[-1].approved_by == "auto"))
