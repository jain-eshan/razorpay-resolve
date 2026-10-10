"""R5: Instagram and Messenger handover, and public posts that move to a private message."""
import json
import re
from datetime import timedelta

import pytest
from app import clock
from app.act import executor
from app.act.executor import ActError
from app.channels import policy
from app.conversation import handover as ho
from app.conversation import machine as m
from app.main import app
from app.schemas import HandoverRequest
from fastapi.testclient import TestClient


def victim(db):
    return db.execute("""SELECT p.id, p.rrn, p.amount_paise FROM incident_members im JOIN payments p ON p.id = im.payment_id
                         WHERE im.incident_id = 'INC-1' AND im.tier = 'exact' AND im.complained = 0 AND p.rrn IS NOT NULL ORDER BY p.captured_at LIMIT 1""").fetchone()


def inbound(db, text, channel="ig_dm", who="igsid_1", context=None, **kw):
    return m.handle_inbound(db, channel, who, text, context or {}, **kw)


def lines(db, tid, kind=None):
    return [x for x in m.get_thread(db, tid).messages if x.sender_role == "system" and (kind is None or x.policy.get("kind") == kind)]


def control(db, tid):
    return ho.open_handover(db, tid) is not None


# ---------- Instagram and Messenger ----------
def test_a_payment_message_is_passed_to_blindspot_before_it_answers(fresh):
    tid = inbound(fresh, "paisa kat gaya 299 ka, Premium Monthly nahi mila")
    t = m.get_thread(fresh, tid)
    kinds = [(x.sender_role, x.policy.get("kind")) for x in t.messages]
    assert kinds[0] == ("system", "pass") and control(fresh, tid) and t.state == "identify"
    h = fresh.execute("SELECT * FROM handovers WHERE thread_id = ?", (tid,)).fetchone()
    assert (h["from_app"], h["to_app"], h["released_at"]) == ("meta_inbox", "blindspot", None) and "about a payment" in h["reason"]


def test_a_message_that_is_not_about_a_payment_never_leaves_the_inbox(fresh):
    tid = inbound(fresh, "kal ki class ka link bhejo")
    t = m.get_thread(fresh, tid)
    assert t.state == "pass_back" and not control(fresh, tid) and not [x for x in t.messages if x.sender_role in ("agent", "customer")]
    assert fresh.execute("SELECT handover_state FROM threads WHERE id = ?", (tid,)).fetchone()[0] == "stayed_with_inbox"
    assert fresh.execute("SELECT COUNT(*) FROM handovers").fetchone()[0] == 0


def test_control_is_kept_while_a_fix_is_awaited_and_given_back_when_the_incident_closes(fresh):
    v = victim(fresh)
    tid = inbound(fresh, f"Money debited (Rs {v['amount_paise'] // 100}) but my plan is not active. Ref {v['rrn']}.")
    assert m.get_thread(fresh, tid).state == "wait_for_fix" and control(fresh, tid)
    aid = executor.create(fresh, "INC-1", "grant", {})
    for st in ("dry_run", "first_5", "rest"):
        executor.approve(fresh, aid, st, "merchant:founder")
    from app import merchant_mock

    merchant_mock.set_webhook_mode(fresh, "ok")
    clock.advance(24)
    assert executor.verify(fresh, "INC-1").closeable
    assert m.get_thread(fresh, tid).state == "resolved" and not control(fresh, tid)
    assert "Resolved" in lines(fresh, tid, "release")[0].body


def test_a_threat_is_passed_then_given_straight_back_with_the_brief(fresh):
    tid = inbound(fresh, "fix my access today or I will go to consumer court and tweet about this fraud")
    t = m.get_thread(fresh, tid)
    assert t.state == "handoff" and not control(fresh, tid) and t.founder_brief
    assert [x.policy["kind"] for x in lines(fresh, tid)] == ["pass", "release"]


def test_a_second_message_from_the_same_customer_does_not_pass_it_again(fresh):
    tid = inbound(fresh, "paisa kat gaya 299 ka")
    inbound(fresh, "kal raat 10 baje")
    assert fresh.execute("SELECT COUNT(*) FROM handovers WHERE thread_id = ?", (tid,)).fetchone()[0] == 1


def test_messenger_works_the_same_way(fresh):
    tid = inbound(fresh, "I paid Rs 299 but my plan is not active", "fb_dm", "psid_1")
    assert control(fresh, tid) and m.get_thread(fresh, tid).channel == "fb_dm"


# ---------- Meta's window ----------
def _decide(db, tid, hours, human):
    th = db.execute("SELECT * FROM threads WHERE id = ?", (tid,)).fetchone()
    return policy.check_thread(db, th, "ig_dm", body="Hi, I am an AI. Please send the UPI ref.", template_id=None, language="en", slots=None, message_class="status_reply",
                               approved_by="merchant:founder", now=th and (m.clock.now() + timedelta(hours=hours)), human=human)


def test_the_assistant_stops_at_24_hours_and_only_a_person_may_continue_for_7_days(fresh):
    tid = inbound(fresh, "paisa kat gaya 299 ka")
    assert _decide(fresh, tid, 23, False).allowed
    d = _decide(fresh, tid, 26, False)
    assert not d.allowed and any("Only a person can reply now, with the Human Agent tag" in r for r in d.reasons)
    assert _decide(fresh, tid, 26, True).allowed
    d = _decide(fresh, tid, 24 * 7 + 2, True)
    assert not d.allowed and any("7 day Human Agent window is closed" in r for r in d.reasons)


# ---------- the API ----------
@pytest.fixture
def api(world_file):
    return TestClient(app)


def test_http_pass_and_release(api):
    tid = api.post("/api/inbound/ig_dm", json={"customer_ref": "igsid_http", "text": "kal ki class ka link bhejo"}).json()["thread"]["id"]
    assert api.post("/api/handovers", json={"thread_id": tid, "action": "release"}).status_code == 409  # we never had it
    p = api.post("/api/handovers", json={"thread_id": tid, "action": "pass", "reason": "The inbox wants help"})
    assert p.status_code == 200 and p.json()["to_app"] == "blindspot" and p.json()["released_at"] is None
    assert api.post("/api/handovers", json={"thread_id": tid, "action": "pass"}).status_code == 409
    r = api.post("/api/handovers", json={"thread_id": tid, "action": "release", "reason": "Founder took over"})
    assert r.status_code == 200 and r.json()["released_at"]
    wa = api.post("/api/inbound/whatsapp_payments", json={"customer_ref": "+919800000077", "text": "paisa kat gaya 299 ka"}).json()["thread"]["id"]
    assert api.post("/api/handovers", json={"thread_id": wa, "action": "pass"}).status_code == 409
    assert api.post("/api/handovers", json={"thread_id": "thr_nope", "action": "pass"}).status_code == 404


# ---------- public posts ----------
def public(db, text, label="synthetic", who="@someone"):
    return inbound(db, text, "public_mention", who, {"label": label}, is_public=True)


def test_a_public_post_gets_one_generic_reply_held_for_the_founder(fresh):
    v = victim(fresh)
    tid = public(fresh, f"Paid Rs {v['amount_paise'] // 100} but locked out. Ref {v['rrn']} @KakshaApp")
    t = m.get_thread(fresh, tid)
    agent = [x for x in t.messages if x.sender_role == "agent"]
    assert t.is_public and t.state == "opened" and len(agent) == 1 and agent[0].policy["status"] == "draft"
    body = re.sub(r"https?://\S+", "", agent[0].body)
    assert "I'm an AI" in body and not re.search(r"\d", body) and "rzp.io/h/" in agent[0].body
    assert not re.search(r"active|refund|paid|received|captured", body, re.IGNORECASE)
    assert "Waiting for your approval" in " ".join(agent[0].policy["reasons"])


def test_nothing_in_a_public_post_is_looked_up_or_tied_to_the_handle(fresh):
    v = victim(fresh)
    cases, vault, cands = (fresh.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("cases", "token_vault", "match_candidates"))
    tid = public(fresh, f"Paid. Ref {v['rrn']} @KakshaApp")
    assert tuple(fresh.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("cases", "token_vault", "match_candidates")) == (cases, vault, cands)
    inbound_text = next(x.body for x in m.get_thread(fresh, tid).messages if x.direction == "inbound")
    assert v["rrn"] not in inbound_text and "[RRN_1]" in inbound_text  # the identifier is kept only as a token nobody can turn back


def test_the_founder_approves_the_public_reply_and_it_still_has_to_pass_the_public_filter(fresh):
    tid = public(fresh, "my paisa got deducted but premium not showing @KakshaApp")
    sent = m.reply(fresh, tid, None, None, "founder").thread
    assert [x.policy["status"] for x in sent.messages if x.sender_role == "agent"] == ["sent"]
    with pytest.raises(ActError, match="only the one generic reply|cannot contain numbers"):
        m.reply(fresh, tid, "Your 299 payment is safe", None, "founder")


def test_a_real_post_is_watched_and_never_answered(fresh):
    tid = public(fresh, "Payment deducted from users, No update/webhook to us, Nothing visible on dashboard", "real_public_post", "@real")
    t = m.get_thread(fresh, tid)
    assert t.state == "pass_back" and not [x for x in t.messages if x.sender_role == "agent"]
    assert any("only watches it" in x.body for x in lines(fresh, tid, "observed"))


def test_a_public_threat_goes_to_a_person_and_nothing_is_posted(fresh):
    tid = public(fresh, "@KakshaApp frauds. I will go to consumer court if my money is not back")
    t = m.get_thread(fresh, tid)
    assert t.state == "handoff" and not [x for x in t.messages if x.sender_role == "agent"]


def test_a_post_that_is_not_about_a_payment_is_ignored_and_not_stored(fresh):
    tid = public(fresh, "love the new chemistry course @KakshaApp")
    t = m.get_thread(fresh, tid)
    assert t.state == "pass_back" and not [x for x in t.messages if x.direction == "inbound"]


def test_when_the_customer_writes_privately_the_public_thread_closes_and_the_private_one_matches(fresh):
    v = victim(fresh)
    pub = public(fresh, f"Paid Rs {v['amount_paise'] // 100} but locked out @KakshaApp")
    priv = inbound(fresh, f"UPI ref {v['rrn']}", "whatsapp_payments", "+919800000055", {"public_thread": pub})
    t, p = m.get_thread(fresh, priv), m.get_thread(fresh, pub)
    assert p.state == "closed" and t.state == "wait_for_fix"
    assert json.loads(fresh.execute("SELECT matched_payment_ids FROM cases WHERE id = ?", (t.case.id,)).fetchone()[0]) == [v["id"]]
    row = fresh.execute("SELECT * FROM handovers WHERE thread_id = ? AND from_app = 'public_mention'", (priv,)).fetchone()
    assert row and row["to_app"] == "whatsapp_payments"
    assert fresh.execute("SELECT handover_state FROM threads WHERE id = ?", (pub,)).fetchone()[0] == "moved_private"
    assert any("began as a public post" in x.body for x in lines(fresh, priv))


def test_a_private_message_that_names_a_thread_that_is_not_a_public_invitation_links_nothing(fresh):
    other = inbound(fresh, "paisa kat gaya 299 ka", "whatsapp_payments", "+919800000066")
    priv = inbound(fresh, "UPI ref 111122223333", "whatsapp_payments", "+919800000067", {"public_thread": other})
    assert fresh.execute("SELECT COUNT(*) FROM handovers WHERE from_app = 'public_mention'").fetchone()[0] == 0 and m.get_thread(fresh, other).state != "closed" and priv


def test_the_new_channels_start_connected_with_consent(fresh):
    chs = {c.type: c for c in m.channels(fresh)}
    assert chs["ig_dm"].status == chs["fb_dm"].status == chs["public_mention"].status == "connected"
    scopes = {c.channel_id: c.scopes for c in m.consents(fresh)}
    assert "Post one generic public reply with a private link" in scopes["ch_public"]


def test_a_public_thread_is_visible_in_the_thread_list_with_the_public_flag(fresh):
    public(fresh, "my paisa got deducted but premium not showing @KakshaApp")
    assert any(t.is_public for t in m.list_threads(fresh))


def test_handover_request_model_rejects_an_unknown_action():
    with pytest.raises(ValueError):
        HandoverRequest(thread_id="t", action="steal")


def test_the_hinglish_public_reply_says_it_is_an_ai_and_the_founder_can_approve_it(fresh):
    tid = public(fresh, "paisa kat gaya 299 ka, Premium Monthly nahi mila @KakshaApp")
    draft = next(x for x in m.get_thread(fresh, tid).messages if x.sender_role == "agent")
    assert "Main ek AI" in draft.body
    assert [x.policy["status"] for x in m.reply(fresh, tid, None, None, "founder").thread.messages if x.sender_role == "agent"] == ["sent"]


def test_a_free_text_reply_that_pressures_or_invents_an_expiry_is_held_as_a_draft(fresh):
    tid = inbound(fresh, "paisa kat gaya 299 ka")
    th = fresh.execute("SELECT * FROM threads WHERE id = ?", (tid,)).fetchone()

    def decide(body):
        return policy.check_thread(fresh, th, "ig_dm", body=body, template_id=None, language="en", slots=None, message_class="status_reply", approved_by="merchant:founder", now=m.clock.now())
    assert decide("Hi, I am an AI. Please send the UPI ref.").allowed
    for body in ("Hi, I am an AI. Hurry, send the UPI ref.", "Hi, I am an AI. Send the UPI ref within 2 hours."):
        d = decide(body)
        assert not d.allowed and any("not real" in r for r in d.reasons), body
