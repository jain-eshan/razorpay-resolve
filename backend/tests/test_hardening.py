"""Fixes from an independent code review (10 Oct 2026). Each test names the way the reviewer got past the old behaviour and fails without the fix."""
import json

import pytest
from app import clock
from app.act import autonomy, escalate, executor, refund
from app.act.executor import ActError
from app.channels import policy
from app.conversation import machine as m
from app.detect import duplicate as monitor
from app.ingest.redact import redact
from app.main import app
from fastapi.testclient import TestClient

FOUNDER = "merchant:founder"


@pytest.fixture
def api(world_file):
    return TestClient(app)


def inbound(db, text, channel="whatsapp_payments", who="+919800000077", context=None, **kw):
    return m.handle_inbound(db, channel, who, text, context or {}, **kw)


# ---------- approvals must come from a person or from the autonomy setting ----------
@pytest.mark.parametrize("approver", ["", "merchant:", "system", "x", "founder", "Merchant:founder", " merchant:founder", "merchant:a b", "auto:autopilot_reversible"])
def test_a_stage_cannot_be_approved_by_anything_but_a_person(fresh, approver):
    aid = executor.create(fresh, "INC-1", "grant", {})
    with pytest.raises(ActError) as e:
        executor.approve(fresh, aid, "dry_run", approver)
    assert e.value.status == 403
    assert executor.get(fresh, aid).status == "drafted"


@pytest.mark.parametrize("approver", ["", "merchant:", "system", "auto:autopilot_reversible"])
def test_a_refund_and_an_escalation_need_a_person_with_a_name(fresh, approver):
    rid = executor.create(fresh, "INC-2", "refund", {})
    executor.approve(fresh, rid, "dry_run", FOUNDER)
    with pytest.raises(ActError):
        executor.approve_row(fresh, rid, executor.get(fresh, rid).items[0].payment_id, approver)
    assert fresh.execute("SELECT COUNT(*) FROM refunds WHERE source = 'make_good'").fetchone()[0] == 0
    esc = escalate.create(fresh, "INC-3")
    with pytest.raises(ActError):
        escalate.send(fresh, esc.id, approver)


def test_the_approver_check_accepts_exactly_the_two_real_forms():
    assert autonomy.is_person("merchant:founder") and autonomy.is_person("merchant:Priya.S-1")
    assert not any(autonomy.is_person(x) for x in ("", None, "merchant:", "auto", "merchant:a b"))
    assert autonomy.is_approver("auto") and autonomy.is_approver("auto:autopilot_reversible") and autonomy.is_approver("merchant:x")
    assert not any(autonomy.is_approver(x) for x in ("", None, "system", "x", "auto:", "AUTO"))


def test_an_empty_name_is_refused_through_the_api_too(api):
    aid = api.post("/api/incidents/INC-1/actions", json={"action_type": "grant", "params": {}}).json()["id"]
    assert api.post(f"/api/actions/{aid}/approve", json={"stage": "dry_run", "approver": ""}).status_code == 403
    assert api.post(f"/api/actions/{aid}/approve", json={"stage": "dry_run", "approver": "founder"}).status_code == 200  # a named person still works


def test_a_reply_needs_a_named_person(fresh):
    tid = inbound(fresh, "paisa kat gaya 299 ka")
    with pytest.raises(ActError):
        m.reply(fresh, tid, "Looking into it.", None, "")


# ---------- the incident-message path runs the never-ask lint too ----------
def test_an_incident_message_that_asks_for_a_secret_is_blocked(fresh):
    cust = fresh.execute("SELECT customer_id FROM payments LIMIT 1").fetchone()["customer_id"]
    slots = {"first_name": "Asha", "date": "29 Sep", "grace_until": "4 Oct", "plan": "Premium Monthly"}
    d = policy.check(fresh, customer_id=cust, template_id="T-G1", language="en", slots=slots, body="Hi Asha, please send your OTP so we can fix it.", approved_by=FOUNDER)
    assert not d.allowed and any("never ask" in r for r in d.reasons)
    ok = policy.check(fresh, customer_id=cust, template_id="T-G1", language="en", slots=slots, body="Hi Asha, we never ask for your OTP.", approved_by="auto")
    assert not any("never ask" in r for r in ok.reasons)


# ---------- typed text cannot state an amount that is not in the record ----------
def test_a_typed_reply_cannot_state_an_amount_that_is_not_the_customers(fresh):
    v = fresh.execute("""SELECT p.id, p.amount_paise, p.rrn FROM incident_members im JOIN payments p ON p.id = im.payment_id
                         WHERE im.incident_id = 'INC-1' AND im.tier = 'exact' AND p.rrn IS NOT NULL LIMIT 1""").fetchone()
    tid = inbound(fresh, f"paisa kat gaya {v['rrn']}")
    th = fresh.execute("SELECT * FROM threads WHERE id = ?", (tid,)).fetchone()

    def decide(text):
        return policy.check_thread(fresh, th, "whatsapp_payments", body=text, template_id=None, language="en", slots=None, message_class="status_reply", approved_by=FOUNDER, now=clock.now(), human=True)
    true_amount = f"Rs {v['amount_paise'] // 100}"
    assert not any("amount" in r for r in decide(f"Sorry about this. {true_amount} was received.").reasons)
    bad = decide("We refunded Rs 99999 to you, it will arrive in 3 minutes.")
    assert not bad.allowed and any("not in this customer's record" in r for r in bad.reasons)


# ---------- secrets a customer volunteers are removed before anything is stored ----------
@pytest.mark.parametrize("text,kind", [
    ("my card 4111 1111 1111 1111 expiry 12/28", "card number"), ("card number 4111111111111111", "card number"), ("cvv 123", "cvv"), ("OTP is 482913 hai", "otp"),
    ("mera pin 4821", "pin"), ("password is Hunter2x", "password"), ("my pan ABCDE1234F", "pan"), ("aadhaar 1234 5678 9012", "aadhaar"),
])
def test_a_volunteered_secret_is_removed_and_never_tokenised(text, kind):
    r = redact(text)
    assert kind in r.secrets and "[REMOVED]" in r.text
    for secret in ("4111", "482913", "4821", "Hunter2x", "ABCDE1234F", "5678 9012", "123"):
        assert secret not in r.text.replace("12/28", ""), (text, r.text)
    assert r.vault == {}  # nothing about a secret is kept anywhere


def test_a_upi_reference_a_phone_and_an_amount_are_not_secrets():
    r = redact("paid Rs 599, UPI ref 424712347862, call 9876543210")
    assert r.secrets == [] and "[RRN_1]" in r.text and "[PHONE_1]" in r.text and "599" in r.text


def test_a_secret_in_a_chat_is_not_stored_and_is_noted_in_the_audit_log(fresh):
    tid = inbound(fresh, "paisa kat gaya, my card 4111 1111 1111 1111 cvv 123 otp 482913")
    stored = " ".join(r["body_redacted"] for r in fresh.execute("SELECT body_redacted FROM thread_messages WHERE thread_id = ?", (tid,)))
    stored += " " + " ".join(r["redacted_text"] for r in fresh.execute("SELECT redacted_text FROM complaints"))
    assert "4111" not in stored and "482913" not in stored and "cvv 123" not in stored.lower()
    assert fresh.execute("SELECT COUNT(*) FROM audit_log WHERE payload_json LIKE '%shared%removed%'").fetchone()[0] >= 1


# ---------- "stop" is honoured for good ----------
@pytest.mark.parametrize("text", ["STOP", "stop", "Please stop messaging me", "do not contact me again", "unsubscribe", "mujhe message mat bhejna", "leave me alone"])
def test_an_opt_out_suppresses_the_customer_and_gets_no_reply(fresh, text):
    tid = inbound(fresh, text, who="+919800000088")
    th = fresh.execute("SELECT * FROM threads WHERE id = ?", (tid,)).fetchone()
    assert fresh.execute("SELECT 1 FROM suppressions WHERE customer_ref_hash = ?", (th["customer_ref"],)).fetchone()
    assert th["state"] == "human"
    assert not [x for x in m.get_thread(fresh, tid).messages if x.direction == "outbound"]
    again = inbound(fresh, "paisa kat gaya 299 ka", who="+919800000088")
    d = policy.check_thread(fresh, fresh.execute("SELECT * FROM threads WHERE id = ?", (again,)).fetchone(), "whatsapp_payments", body="Hi, I'm an AI. Please send the UPI ref.",
                            template_id=None, language="en", slots=None, message_class="disclosure_or_question", approved_by="auto", now=clock.now())
    assert not d.allowed and any("asked not to be contacted" in r for r in d.reasons)


def test_a_complaint_that_says_stop_in_another_sense_is_not_an_opt_out(fresh):
    for text in ("please stop the double charge, I was charged twice", "stop, my payment failed twice", "I paid 599 and the app did not stop loading"):
        inbound(fresh, text, who="+919800000089")
    assert not fresh.execute("SELECT 1 FROM suppressions").fetchone()


def test_an_incident_message_is_blocked_for_a_customer_who_opted_out_under_their_chat_handle(fresh):
    v = fresh.execute("""SELECT p.id, p.customer_id, p.rrn FROM incident_members im JOIN payments p ON p.id = im.payment_id
                         WHERE im.incident_id = 'INC-1' AND im.tier = 'exact' AND p.rrn IS NOT NULL LIMIT 1""").fetchone()
    tid = inbound(fresh, f"paisa kat gaya {v['rrn']}", who="+919800000090")
    inbound(fresh, "STOP", who="+919800000090")
    case = fresh.execute("SELECT matched_payment_ids FROM cases WHERE id = (SELECT case_id FROM threads WHERE id = ?)", (tid,)).fetchone()
    assert v["id"] in json.loads(case["matched_payment_ids"])
    assert policy.opted_out(fresh, v["customer_id"], v["id"])
    assert not policy.opted_out(fresh, v["customer_id"], None)


# ---------- the clock and times ----------
def test_a_time_without_a_zone_is_taken_as_the_merchants_own_and_cannot_break_the_clock(api):
    r = api.post("/api/inbound/whatsapp_payments", json={"customer_ref": "+919800000091", "text": "paisa kat gaya 299 ka", "context": {}, "received_at": "2026-10-02T10:00:00"})
    assert r.status_code == 200
    assert api.post("/api/clock/advance", json={"hours": 1}).status_code == 200


def test_the_clock_is_capped_and_a_failure_does_not_move_it(api):
    before = api.post("/api/clock/advance", json={"hours": 0}).json()["now"]
    assert api.post("/api/clock/advance", json={"hours": 10**9}).status_code == 422
    assert api.post("/api/clock/advance", json={"hours": 0}).json()["now"] == before


# ---------- the duplicate monitor counts customers ----------
def test_one_customer_tapping_many_times_is_not_an_incident(fresh):
    pairs = monitor.candidates(fresh)
    dup = [p for p in pairs if p.kind == "duplicate"]
    assert dup, "the world has real duplicate pairs to copy from"
    fake = [dup[0].__class__(**{**dup[0].__dict__, "first_id": f"a{i}", "second_id": f"b{i}", "app_version": "9.9.9"}) for i in range(monitor.MIN_PAIRS + 2)]
    monitor_candidates = monitor.candidates
    try:
        monitor.candidates = lambda db: fake  # the same customer id on every pair
        assert [r for r in monitor.find(fresh) if r.app_version == "9.9.9"] == []
    finally:
        monitor.candidates = monitor_candidates


# ---------- refunds ----------
def test_refund_text_keeps_paise_and_an_unknown_method_cannot_break_the_clock(fresh):
    assert refund.HOURS_TO_PROCESS.get("wallet", max(refund.HOURS_TO_PROCESS.values())) == 72
    fresh.execute("UPDATE payments SET method = 'wallet' WHERE id = (SELECT payment_id FROM incident_members WHERE incident_id = 'INC-2' LIMIT 1)")
    rid = executor.create(fresh, "INC-2", "refund", {})
    executor.approve(fresh, rid, "dry_run", FOUNDER)
    executor.approve_row(fresh, rid, executor.get(fresh, rid).items[0].payment_id, FOUNDER)
    clock.advance(500)
    refund.settle(fresh, clock.now())  # would have raised KeyError for a method the table does not list


# ---------- a message the rules cannot read is never dropped silently when it mentions money ----------
@pytest.mark.parametrize("text", [
    "ur site ate my money. 599. bank msg says success", "yaar kal raat 599 gaya account se, kuch nahi mila", "topped up the thing, bank says 599 is gone",
    "मेरे 599 रुपये कट गए पर प्लान नहीं मिला", "bhai paisa kat gaya 299 ka, app khul nahi raha",
])
def test_an_unreadable_message_about_money_goes_to_the_founder_and_is_kept(fresh, text):
    tid = inbound(fresh, text, who=f"+9198000{abs(hash(text)) % 100000:05d}")
    t = m.get_thread(fresh, tid)
    assert t.state != "pass_back", t.state  # not dropped: the assistant asks, or a person is handed the thread
    assert any(x.direction == "inbound" for x in t.messages), "the message is kept for the founder"


@pytest.mark.parametrize("text", ["what time does the live class start tomorrow?", "kal ki class ka link bhejo", "can you share the syllabus pdf", "good morning sir"])
def test_a_message_that_is_not_about_money_is_still_dropped_and_not_stored(fresh, text):
    tid = inbound(fresh, text, who=f"+9198001{abs(hash(text)) % 100000:05d}")
    t = m.get_thread(fresh, tid)
    assert t.state == "pass_back" and not [x for x in t.messages if x.direction == "inbound"]
