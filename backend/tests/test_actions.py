"""R2: staged execution, idempotency, undo, caps, autonomy, verification, messages, and the single send path."""
import re
import sqlite3
import threading
from pathlib import Path
from typing import get_args

import pytest
from app import clock, merchant_mock
from app.act import autonomy, executor, messages
from app.main import app
from app.schemas import ActionType
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
FOUNDER = "merchant:founder"


def entitlements(db):
    return [tuple(r) for r in db.execute("SELECT * FROM entitlements ORDER BY id")]


def counts(db, aid):
    return dict(executor.get(db, aid).item_counts)


def plan(db, kind="grant", **params):
    return executor.create(db, "INC-1", kind, params)


def run_grant(db):
    aid = plan(db)
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, aid, stage, FOUNDER)
    return aid


def set_level(db, level, **extra):
    s = autonomy.read(db)
    autonomy.write(db, s.model_copy(update={"autonomy": level, **extra}), FOUNDER)
    db.commit()


# ---------- staged execution ----------
def test_staged_run_dry_run_then_first_5_then_rest(fresh):
    before = entitlements(fresh)
    aid = plan(fresh)
    a = executor.get(fresh, aid)
    assert (a.status, a.next_stage, len(a.items)) == ("drafted", "dry_run", 81)

    a = executor.approve(fresh, aid, "dry_run", FOUNDER)
    assert (a.status, a.next_stage, a.item_counts) == ("approved", "first_5", {"pending": 81})
    assert entitlements(fresh) == before, "a dry run changes nothing"

    a = executor.approve(fresh, aid, "first_5", FOUNDER)
    assert (a.status, a.next_stage, a.item_counts) == ("approved", "rest", {"verified": 5, "pending": 76})

    a = executor.approve(fresh, aid, "rest", FOUNDER)
    assert (a.status, a.next_stage, a.item_counts) == ("done", None, {"verified": 81})
    assert fresh.execute("SELECT status FROM incidents WHERE id = 'INC-1'").fetchone()[0] == "verifying"
    assert fresh.execute("SELECT COUNT(*) FROM entitlements WHERE source = 'make_good_grant' AND entitlement_state = 'active'").fetchone()[0] == 81


def test_stages_cannot_be_skipped(fresh):
    aid = plan(fresh)
    with pytest.raises(executor.ActError) as e:
        executor.approve(fresh, aid, "rest", FOUNDER)
    assert e.value.status == 409 and "dry run" in str(e.value)
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    with pytest.raises(executor.ActError):
        executor.approve(fresh, aid, "rest", FOUNDER)


def test_nothing_runs_without_an_approval_on_record(fresh):
    aid = plan(fresh)
    assert executor.get(fresh, aid).approved_by is None
    assert fresh.execute("SELECT COUNT(*) FROM entitlements WHERE source = 'make_good_grant'").fetchone()[0] == 0


def test_a_failure_stops_the_batch_and_a_retry_finishes_it(fresh, monkeypatch):
    real, calls = merchant_mock.grant, []

    def flaky(db, pid):
        calls.append(pid)
        if len(calls) == 3:
            raise merchant_mock.MockError("Your access hook timed out.")
        return real(db, pid)

    monkeypatch.setattr(merchant_mock, "grant", flaky)
    aid = plan(fresh)
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    a = executor.approve(fresh, aid, "first_5", FOUNDER)
    assert (a.status, a.next_stage, a.item_counts) == ("failed", "first_5", {"verified": 2, "failed": 1, "pending": 78})
    monkeypatch.setattr(merchant_mock, "grant", real)
    a = executor.approve(fresh, aid, "first_5", FOUNDER)
    assert a.item_counts == {"verified": 5, "pending": 76}
    assert executor.approve(fresh, aid, "rest", FOUNDER).item_counts == {"verified": 81}


def test_a_grant_the_record_does_not_confirm_stops_the_batch(fresh, monkeypatch):
    monkeypatch.setitem(executor._CHECK, "grant", lambda db, item, result: False)
    aid = plan(fresh)
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    a = executor.approve(fresh, aid, "first_5", FOUNDER)
    assert (a.status, a.item_counts) == ("failed", {"verify_failed": 1, "pending": 80})


# ---------- idempotency ----------
def test_double_approval_does_not_double_grant(fresh):
    aid = plan(fresh)
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    executor.approve(fresh, aid, "first_5", FOUNDER)
    after_first = entitlements(fresh)
    a = executor.approve(fresh, aid, "first_5", FOUNDER)  # second click
    assert a.item_counts == {"verified": 5, "pending": 76}
    assert entitlements(fresh) == after_first
    executor.approve(fresh, aid, "rest", FOUNDER)
    done = entitlements(fresh)
    executor.approve(fresh, aid, "rest", FOUNDER)
    executor.approve(fresh, aid, "first_5", FOUNDER)
    assert entitlements(fresh) == done


def test_planning_twice_returns_the_same_plan_with_unique_keys(fresh):
    a1, a2 = plan(fresh), plan(fresh)
    assert a1 == a2
    keys = [i.idempotency_key for i in executor.get(fresh, a1).items]
    assert len(keys) == len(set(keys)) == 81
    assert fresh.execute("SELECT COUNT(*) FROM actions").fetchone()[0] == 1


def test_idempotency_key_is_sha256_of_incident_type_and_payment(fresh):
    import hashlib

    i = executor.get(fresh, plan(fresh)).items[0]
    assert i.idempotency_key == hashlib.sha256(f"INC-1|grant|{i.payment_id}".encode()).hexdigest()


def test_two_clicks_at_once_grant_once(world_file):
    def conn():
        c = sqlite3.connect(world_file, timeout=30)
        c.row_factory = sqlite3.Row
        return c

    setup = conn()
    aid = plan(setup)
    executor.approve(setup, aid, "dry_run", FOUNDER)
    setup.close()
    errors = []

    def click():
        c = conn()
        try:
            executor.approve(c, aid, "first_5", FOUNDER)
        except Exception as e:  # noqa: BLE001
            errors.append(e)
        finally:
            c.close()

    threads = [threading.Thread(target=click) for _ in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    check = conn()
    assert not errors
    assert counts(check, aid) == {"verified": 5, "pending": 76}
    assert check.execute("SELECT COUNT(*) FROM entitlements WHERE source = 'make_good_grant'").fetchone()[0] == 5


# ---------- undo ----------
def test_undo_restores_the_prior_state_exactly(fresh):
    before = entitlements(fresh)
    aid = run_grant(fresh)
    assert entitlements(fresh) != before
    a = executor.revert(fresh, aid)
    assert a.status == "reverted"
    assert entitlements(fresh) == before
    assert fresh.execute("SELECT status FROM incidents WHERE id = 'INC-1'").fetchone()[0] == "open"
    again = plan(fresh)  # the same plan can be armed again, with the same keys
    assert again == aid and executor.get(fresh, aid).status == "drafted"


def test_undo_refuses_to_overwrite_a_change_the_merchant_made_after(fresh):
    aid = run_grant(fresh)
    pid = executor.get(fresh, aid).items[0].payment_id
    fresh.execute("UPDATE entitlements SET source = 'manual' WHERE razorpay_payment_id = ? OR order_id = (SELECT order_id FROM payments WHERE id = ?)", (pid, pid))
    snapshot = entitlements(fresh)
    with pytest.raises(executor.ActError) as e:
        executor.revert(fresh, aid)
    assert e.value.status == 409 and "Nothing was undone" in str(e.value)
    assert entitlements(fresh) == snapshot


def test_an_unrun_plan_has_nothing_to_undo(fresh):
    with pytest.raises(executor.ActError):
        executor.revert(fresh, plan(fresh))


# ---------- caps and autonomy ----------
def test_bulk_cap_blocks_approval_with_a_reason(fresh):
    set_level(fresh, "suggest", max_bulk_customers=10)
    aid = plan(fresh)
    a = executor.get(fresh, aid)
    assert "above your limit of 10" in a.blocked_reason
    with pytest.raises(executor.ActError) as e:
        executor.approve(fresh, aid, "dry_run", FOUNDER)
    assert e.value.status == 409
    assert fresh.execute("SELECT COUNT(*) FROM entitlements WHERE source = 'make_good_grant'").fetchone()[0] == 0


def test_suggest_needs_a_tap_for_every_stage(fresh):
    aid = plan(fresh)
    assert executor.get(fresh, aid).status == "drafted"
    assert executor.approve(fresh, aid, "dry_run", FOUNDER).status == "approved"
    assert executor.approve(fresh, aid, "first_5", FOUNDER).status == "approved"


def test_assist_needs_one_approval_then_runs_staged_to_the_end(fresh):
    set_level(fresh, "assist")
    aid = plan(fresh)
    assert executor.get(fresh, aid).status == "drafted"
    a = executor.approve(fresh, aid, "dry_run", FOUNDER)
    assert (a.status, a.item_counts) == ("done", {"verified": 81})
    first = fresh.execute("SELECT approved_by FROM actions").fetchone()[0]
    assert first == FOUNDER


def test_assist_stops_when_the_first_five_fail(fresh, monkeypatch):
    set_level(fresh, "assist")
    monkeypatch.setitem(executor._CHECK, "grant", lambda db, item, result: False)
    aid = plan(fresh)
    a = executor.approve(fresh, aid, "dry_run", FOUNDER)
    assert a.status == "failed" and a.item_counts.get("pending") == 80


def test_autopilot_runs_within_cap_and_is_still_undoable(fresh):
    before = entitlements(fresh)
    set_level(fresh, "autopilot_reversible")
    aid = plan(fresh)
    a = executor.get(fresh, aid)
    assert (a.status, a.approved_by) == ("done", "auto:autopilot_reversible")
    executor.revert(fresh, aid)
    assert entitlements(fresh) == before


def test_autopilot_does_not_run_above_the_cap(fresh):
    set_level(fresh, "autopilot_reversible", max_bulk_customers=10)
    assert executor.get(fresh, plan(fresh)).status == "drafted"


def test_matrix_matches_the_spec_table():
    assert autonomy.taps("grant", "suggest") == autonomy.STAGES
    assert autonomy.taps("grant", "assist") == ("dry_run",)
    assert autonomy.taps("grant", "autopilot_reversible") == ()
    assert autonomy.taps("message", "assist") == autonomy.STAGES  # bulk customer messages: founder approves on suggest and assist
    assert autonomy.taps("message", "autopilot_reversible") == ()
    assert autonomy.MATRIX["refund"] == dict.fromkeys(autonomy.LEVELS, "per_row_web")
    assert autonomy.MATRIX["recovery_link"] == dict.fromkeys(autonomy.LEVELS, "founder")


def test_settings_are_validated_and_every_change_is_audited(fresh):
    s = autonomy.read(fresh)
    assert (s.autonomy, s.messaging_enabled, s.max_bulk_customers) == ("suggest", False, 100)
    with pytest.raises(ValueError):
        autonomy.write(fresh, s.model_copy(update={"max_bulk_customers": 0}), FOUNDER)
    autonomy.write(fresh, s.model_copy(update={"autonomy": "assist", "holdout_percent": 20}), FOUNDER)
    assert (autonomy.read(fresh).autonomy, autonomy.read(fresh).holdout_percent) == ("assist", 20)
    notes = [r[0] for r in fresh.execute("SELECT payload_json FROM audit_log")]
    assert any("autonomy from suggest to assist" in n for n in notes)


# ---------- there is no revoke ----------
def test_no_revoke_in_the_action_catalogue():
    assert not any("revoke" in a for a in get_args(ActionType))
    assert set(autonomy.ACTION_CLASS) == {"grant", "message", "recovery_link", "refund"}
    for p in (ROOT / "backend" / "app").rglob("*.py"):
        assert not re.search(r"def\s+revoke|/revoke", p.read_text()), p


def test_unsupported_action_types_are_refused(fresh):
    for kind in ("refund", "recovery_link", "resend_events", "revoke"):
        with pytest.raises(executor.ActError) as e:
            executor.create(fresh, "INC-1", kind, {})
        assert e.value.status == 422


def test_only_the_exact_tier_is_granted_automatically(fresh):
    with pytest.raises(executor.ActError):
        plan(fresh, tier="likely")


# ---------- verification and closing ----------
def test_incident_stays_open_until_the_webhook_has_been_healthy_for_24_hours(fresh):
    run_grant(fresh)
    v = executor.verify(fresh, "INC-1")
    assert (v.verified, v.total, v.closeable) == (81, 81, False) and "401" in v.line
    merchant_mock.set_webhook_mode(fresh, "ok")
    v = executor.verify(fresh, "INC-1")
    assert not v.closeable and "0.0 of 24 hours" in v.line
    clock.advance(23)
    assert not executor.verify(fresh, "INC-1").closeable
    clock.advance(1)
    v = executor.verify(fresh, "INC-1")
    assert v.closeable and v.signal_healthy and v.restored_paise > 0
    assert re.fullmatch(r"81 of 81 confirmed active by your records\. Your webhook has answered normally for 24 hours\. ₹[\d,]+ restored\.", v.line), v.line
    assert fresh.execute("SELECT status, closed_at FROM incidents WHERE id = 'INC-1'").fetchone()[0] == "closed"


def test_restored_amount_is_the_sum_of_what_was_restored(fresh):
    aid = run_grant(fresh)
    merchant_mock.set_webhook_mode(fresh, "ok")
    clock.advance(24)
    v = executor.verify(fresh, "INC-1")
    want = fresh.execute("SELECT SUM(p.amount_paise) FROM action_items i JOIN payments p ON p.id = i.payment_id WHERE i.action_id = ?", (aid,)).fetchone()[0]
    assert v.restored_paise == want
    assert f"₹{messages.inr(want)}" in v.line


def test_verify_notices_a_record_that_was_changed_back(fresh):
    aid = run_grant(fresh)
    merchant_mock.set_webhook_mode(fresh, "ok")
    clock.advance(24)
    bad = [i.payment_id for i in executor.get(fresh, aid).items[:3]]
    for pid in bad:
        fresh.execute("UPDATE entitlements SET entitlement_state = 'unpaid' WHERE order_id = (SELECT order_id FROM payments WHERE id = ?)", (pid,))
    v = executor.verify(fresh, "INC-1")
    assert (v.verified, v.total, v.closeable) == (78, 81, False)
    failed = {i.payment_id for i in executor.get(fresh, aid).items if i.status == "verify_failed"}
    assert failed == set(bad)
    assert fresh.execute("SELECT status FROM incidents WHERE id = 'INC-1'").fetchone()[0] == "fixing"


def test_a_webhook_that_says_ok_but_grants_nothing_is_not_healthy(fresh):
    run_grant(fresh)
    merchant_mock.set_webhook_mode(fresh, "ack_then_fail")
    clock.advance(48)
    v = executor.verify(fresh, "INC-1")
    assert not v.closeable and "says OK but grants nothing" in v.line


def test_verify_before_any_fix_says_so(fresh):
    v = executor.verify(fresh, "INC-1")
    assert (v.total, v.closeable) == (0, False)


def test_restored_customers_leave_the_exact_group_with_a_reason(fresh):
    from app import service
    from app.widen.silent import build_cohort  # noqa: F401

    before = service.detail(fresh, "INC-1")
    run_grant(fresh)
    after = service.detail(fresh, "INC-1")
    assert before.tier_counts["exact"] == 81 and after.tier_counts["exact"] == 0
    assert {m.exclusion_reason for m in service.members(fresh, "INC-1", "excluded")} >= {"restored by Blindspot"}
    assert after.affected == before.affected
    assert [a.action_type for a in after.actions] == ["grant"]


# ---------- messages ----------
def test_messages_need_a_confirmed_grant_first(fresh):
    with pytest.raises(executor.ActError) as e:
        plan(fresh, "message")
    assert e.value.status == 409 and "Restore access first" in str(e.value)


def test_messaging_is_off_until_enabled_in_settings(fresh):
    run_grant(fresh)
    aid = plan(fresh, "message")
    a = executor.get(fresh, aid)
    assert "Messaging is switched off" in a.blocked_reason
    with pytest.raises(executor.ActError):
        executor.approve(fresh, aid, "dry_run", FOUNDER)
    assert fresh.execute("SELECT COUNT(*) FROM messages").fetchone()[0] == 0


def test_messages_go_out_staged_in_the_merchants_voice_with_numbers_from_slots(fresh):
    run_grant(fresh)
    set_level(fresh, "suggest", messaging_enabled=True)
    aid = plan(fresh, "message")
    for stage in ("dry_run", "first_5", "rest"):
        a = executor.approve(fresh, aid, stage, FOUNDER)
    assert a.item_counts == {"verified": 81}
    rows = fresh.execute("SELECT * FROM messages").fetchall()
    assert len(rows) == 81 and {r["status"] for r in rows} == {"sent"}
    assert {r["sender"] for r in rows} == {"Kaksha payment help, powered by Razorpay"}
    assert {r["category"] for r in rows} == {"utility"} and {r["holdout"] for r in rows} == {0}
    for r in rows:
        assert "never" not in r["body"].lower() or "OTP" in r["body"]
        slots = messages.slots_for(fresh, r["payment_id"])
        assert messages.numbers_ok(r["template_id"], r["language"], slots, r["body"])
    complained = {r[0] for r in fresh.execute("SELECT payment_id FROM incident_members WHERE complained = 1")}
    assert {r["template_id"] for r in rows if r["payment_id"] in complained} == {"T-A2"}
    assert {r["template_id"] for r in rows if r["payment_id"] not in complained} == {"T-A1"}


def test_a_customer_is_never_messaged_twice_about_one_incident(fresh):
    run_grant(fresh)
    set_level(fresh, "autopilot_reversible", messaging_enabled=True)
    aid = plan(fresh, "message")
    assert executor.get(fresh, aid).status == "done"
    assert plan(fresh, "message") == aid
    executor.approve(fresh, aid, "rest", FOUNDER)
    assert fresh.execute("SELECT COUNT(*) FROM messages").fetchone()[0] == 81


def test_language_toggle_changes_the_text_not_the_numbers(fresh):
    run_grant(fresh)
    aid = plan(fresh, "message", language="hi_latn")
    p = executor.message_previews(fresh, aid)
    assert {x.language for x in p} == {"hi_latn"} and sum(x.recipients for x in p) == 81
    assert "chalu" in p[0].body
    plan(fresh, "message", language="en")  # toggling a draft updates it
    assert {x.language for x in executor.message_previews(fresh, aid)} == {"en"}
    follow = {x.language for x in executor.message_previews(fresh, plan(fresh, "message", language="auto"))}
    assert follow <= {"en", "hi_latn"}


def test_messages_cannot_be_unsent_and_block_undoing_the_grant(fresh):
    gid = run_grant(fresh)
    set_level(fresh, "autopilot_reversible", messaging_enabled=True)
    mid = plan(fresh, "message")
    for aid in (mid, gid):
        with pytest.raises(executor.ActError) as e:
            executor.revert(fresh, aid)
        assert e.value.status == 409


def test_undoing_the_grant_drops_an_unsent_message_plan(fresh):
    gid = run_grant(fresh)
    plan(fresh, "message")
    executor.revert(fresh, gid)
    assert fresh.execute("SELECT COUNT(*) FROM actions WHERE action_type = 'message'").fetchone()[0] == 0


def test_policy_blocks_and_records_a_message_with_a_number_not_in_the_slots(fresh):
    from app.channels import policy

    run_grant(fresh)
    set_level(fresh, "suggest", messaging_enabled=True)
    pid = executor.get(fresh, plan(fresh)).items[0].payment_id
    slots = messages.slots_for(fresh, pid)
    assert not messages.numbers_ok("T-A1", "en", slots, messages.render("T-A1", "en", slots) + " Call 9999988888.")
    cust = fresh.execute("SELECT customer_id FROM payments WHERE id = ?", (pid,)).fetchone()[0]
    d = policy.check(fresh, customer_id=cust, template_id="T-A1", language="en", slots=slots, body="Pay 55555", approved_by=FOUNDER)
    assert not d.allowed and "number that is not from the customer's record" in d.reasons[0]
    d = policy.check(fresh, customer_id=cust, template_id="T-A1", language="en", slots=slots, body=messages.render("T-A1", "en", slots), approved_by=None)
    assert not d.allowed and d.needs_founder_approval


def test_suppressed_customers_are_never_messaged(fresh):
    run_grant(fresh)
    set_level(fresh, "suggest", messaging_enabled=True)
    aid = plan(fresh, "message")
    first = executor.get(fresh, aid).items[0].payment_id
    cust = fresh.execute("SELECT customer_id FROM payments WHERE id = ?", (first,)).fetchone()[0]
    fresh.execute("INSERT INTO suppressions (id, merchant_id, customer_ref_hash, reason, created_at) VALUES ('s1','acc_KAKSHA001',?,'asked to stop','2026-10-01')", (cust,))
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    a = executor.approve(fresh, aid, "first_5", FOUNDER)
    assert a.status == "failed" and a.item_counts.get("failed") == 1
    assert fresh.execute("SELECT COUNT(*) FROM messages WHERE status = 'sent'").fetchone()[0] == 0
    assert fresh.execute("SELECT COUNT(*) FROM audit_log WHERE kind = 'policy'").fetchone()[0] == 1


def test_there_is_exactly_one_place_that_writes_a_message():
    writers = [p.relative_to(ROOT).as_posix() for p in (ROOT / "backend" / "app").rglob("*.py") if re.search(r"INSERT\s+INTO\s+messages", p.read_text())]
    assert writers == ["backend/app/channels/policy.py"]


def test_inr_uses_indian_grouping():
    assert [messages.inr(v) for v in (59900, 249900, 12499900, 19950)] == ["599", "2,499", "1,24,999", "199.50"]


def test_every_template_variant_the_incident_uses_passes_the_number_check(fresh):
    slots = messages.slots_for(fresh, executor.get(fresh, plan(fresh)).items[0].payment_id)
    for tid in ("T-A1", "T-A2"):
        for lang in messages.LANGS:
            assert messages.numbers_ok(tid, lang, slots, messages.render(tid, lang, slots))


# ---------- audit ----------
def test_every_approval_and_action_is_audited(fresh):
    aid = run_grant(fresh)
    executor.revert(fresh, aid)
    rows = [r["kind"] for r in fresh.execute("SELECT kind FROM audit_log ORDER BY id")]
    assert rows.count("approval") == 3 and rows.count("action") == 2  # plan, undo


# ---------- over HTTP ----------
@pytest.fixture
def api(world_file):
    return TestClient(app)


def test_http_flow_from_plan_to_closed_incident(api):
    r = api.post("/api/incidents/INC-1/actions", json={"action_type": "grant", "params": {}})
    assert r.status_code == 200 and r.json()["next_stage"] == "dry_run"
    aid = r.json()["id"]
    for stage in ("dry_run", "first_5", "rest"):
        r = api.post(f"/api/actions/{aid}/approve", json={"stage": stage, "approver": "founder"})
        assert r.status_code == 200
    assert r.json()["status"] == "done" and r.json()["approved_by"] == "merchant:founder"
    assert api.get("/api/incidents/INC-1").json()["actions"][0]["status"] == "done"
    assert api.post("/api/incidents/INC-1/verify").json()["closeable"] is False
    assert api.get("/merchant-mock/health").json()["webhook_mode"] == "401"
    assert api.post("/merchant-mock/webhook").status_code == 401
    assert api.post("/merchant-mock/webhook-mode", json={"mode": "ok"}).json()["webhook_mode"] == "ok"
    assert api.post("/merchant-mock/webhook").status_code == 200
    assert api.post("/api/clock/advance", json={"hours": 24}).status_code == 200
    v = api.post("/api/incidents/INC-1/verify").json()
    assert v["closeable"] and v["verified"] == v["total"] == 81
    assert api.get("/api/incidents/INC-1").json()["status"] == "closed"
    kinds = {e["kind"] for e in api.get("/api/audit").json()}
    assert {"approval", "action", "verify"} <= kinds
    assert api.get("/api/audit", params={"ref_id": aid}).json()


def test_http_errors_name_the_reason(api):
    assert api.post("/api/incidents/INC-1/actions", json={"action_type": "refund", "params": {}}).status_code == 422
    assert api.post("/api/incidents/INC-9/actions", json={"action_type": "grant", "params": {}}).status_code == 404
    aid = api.post("/api/incidents/INC-1/actions", json={"action_type": "grant", "params": {}}).json()["id"]
    r = api.post(f"/api/actions/{aid}/approve", json={"stage": "rest", "approver": "founder"})
    assert r.status_code == 409 and "dry run" in r.json()["detail"]
    assert api.post("/api/clock/advance", json={"hours": -1}).status_code == 422
    assert api.post("/merchant-mock/webhook-mode", json={"mode": "nope"}).status_code == 409


def test_http_settings_round_trip_and_validation(api):
    s = api.get("/api/settings").json()
    assert (s["autonomy"], s["messaging_enabled"]) == ("suggest", False)
    s["autonomy"], s["messaging_enabled"] = "assist", True
    assert api.put("/api/settings", json=s).json()["autonomy"] == "assist"
    assert api.get("/api/settings").json()["messaging_enabled"] is True
    s["max_bulk_customers"] = 0
    assert api.put("/api/settings", json=s).status_code == 422


def test_http_preview_and_messages(api):
    aid = api.post("/api/incidents/INC-1/actions", json={"action_type": "grant", "params": {}}).json()["id"]
    for stage in ("dry_run", "first_5", "rest"):
        api.post(f"/api/actions/{aid}/approve", json={"stage": stage, "approver": "founder"})
    m = api.post("/api/incidents/INC-1/actions", json={"action_type": "message", "params": {"language": "en"}}).json()
    p = api.get("/api/messages/preview", params={"action_id": m["id"]}).json()
    assert sum(x["recipients"] for x in p) == 81 and p[0]["sender"] == "Kaksha payment help, powered by Razorpay"
    assert "switched off" in m["blocked_reason"]


def test_an_unchanged_verification_is_logged_once(fresh):
    run_grant(fresh)
    for _ in range(3):
        executor.verify(fresh, "INC-1")
    assert fresh.execute("SELECT COUNT(*) FROM audit_log WHERE kind = 'verify'").fetchone()[0] == 1
    merchant_mock.set_webhook_mode(fresh, "ok")
    executor.verify(fresh, "INC-1")
    assert fresh.execute("SELECT COUNT(*) FROM audit_log WHERE kind = 'verify'").fetchone()[0] == 2
