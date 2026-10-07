"""INC-3 (Razorpay-side card renewal failures) and the escalation to Razorpay: the monitor, the verdict, the fix, the messages, the pack."""
import json
from datetime import datetime, timedelta

import pytest
from app import clock, merchant_mock
from app.act import autonomy, escalate, executor
from app.detect import renewal as monitor
from app.main import app
from app.renewal import build as renewal_build
from fastapi.testclient import TestClient

FOUNDER = "merchant:founder"


def ents(db):
    return [tuple(r) for r in db.execute("SELECT * FROM entitlements ORDER BY id")]


def run_all(db, kind="grant", **params):
    aid = executor.create(db, "INC-3", kind, params)
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(db, aid, stage, FOUNDER)
    return aid


def messaging_on(db):
    autonomy.write(db, autonomy.read(db).model_copy(update={"messaging_enabled": True}), FOUNDER)


@pytest.fixture
def api(world_file):
    return TestClient(app)


# ---------------- the monitor ----------------
def test_the_monitor_finds_the_whole_outage_and_nothing_else(world):
    runs = monitor.find(world)
    assert len(runs) == 1
    r = runs[0]
    assert r.method == "card" and r.error_code == "GATEWAY_ERROR" and len(r.payment_ids) == 27
    assert r.first_at == datetime.fromisoformat("2026-09-29T02:10:00+05:30")
    assert r.alert_at - r.first_at < timedelta(hours=3) and r.resolved_at and r.resolved_at > r.last_at
    assert r.control["method"] == "upi" and r.control["renewals"] >= 5 and r.control["failed"] == 0
    assert not r.explained_elsewhere and r.p_value < monitor.P_THRESHOLD


def test_a_short_run_of_failures_raises_nothing(fresh):
    keep = [r[0] for r in fresh.execute("SELECT id FROM payments WHERE is_renewal = 1 AND method = 'card' AND status = 'failed' ORDER BY created_at LIMIT 4")]
    fresh.execute(f"UPDATE payments SET status = 'captured', captured_at = created_at WHERE is_renewal = 1 AND method = 'card' AND status = 'failed' AND id NOT IN ({','.join('?' * 4)})", keep)
    assert monitor.find(fresh) == []


def test_a_run_of_ordinary_declines_is_not_blamed_on_razorpay(fresh):
    """Five failures in a row with five different reasons is bad luck or a bad card batch, not one gateway error."""
    codes = [("BAD_REQUEST_ERROR", "customer"), ("GATEWAY_ERROR", "bank"), ("BAD_REQUEST_ERROR", "bank"), ("SERVER_ERROR", "internal"), ("BAD_REQUEST_ERROR", "customer")]
    ids = [r[0] for r in fresh.execute("SELECT id FROM payments WHERE is_renewal = 1 AND method = 'card' AND status = 'failed' ORDER BY created_at LIMIT 5")]
    for pid, (code, src) in zip(ids, codes):
        fresh.execute("UPDATE payments SET error_code = ?, error_source = ? WHERE id = ?", (code, src, pid))
    fresh.execute("UPDATE payments SET status = 'captured', captured_at = created_at WHERE is_renewal = 1 AND method = 'card' AND status = 'failed' AND id NOT IN (%s)" % ",".join("?" * 5), ids)
    run = monitor.find(fresh)
    assert not run or run[0].explained_elsewhere


@pytest.mark.parametrize("what", ["bank_outage", "deploy", "upi_failing_too"])
def test_when_something_else_explains_it_the_incident_is_not_razorpays(fresh, what):
    r = monitor.find(fresh)[0]
    if what == "bank_outage":
        fresh.execute("INSERT INTO downtime_events (id, method, issuer, started_at, ended_at, severity) VALUES ('dt_x','card','Sahyadri Bank',?,?,'high')", ((r.first_at - timedelta(minutes=5)).isoformat(), (r.last_at + timedelta(minutes=5)).isoformat()))
    elif what == "deploy":
        fresh.execute("INSERT INTO merchant_events (id, merchant_id, kind, label, at) VALUES ('me_x','acc_KAKSHA001','deploy','web v2.7.8: billing job',?)", ((r.first_at - timedelta(minutes=50)).isoformat(),))
    else:
        fresh.execute("UPDATE payments SET status = 'failed', error_code = 'GATEWAY_ERROR', error_source = 'gateway', captured_at = NULL WHERE is_renewal = 1 AND method = 'upi' AND created_at BETWEEN ? AND ?",
                      (r.first_at.isoformat(), r.last_at.isoformat()))
    again = monitor.find(fresh)[0]
    assert again.explained_elsewhere
    assert renewal_build._attribution(again).owner != "razorpay"


# ---------------- the incident ----------------
def test_inc3_is_on_razorpays_side_by_elimination_and_says_how_sure_it_is(world):
    row = world.execute("SELECT * FROM incidents WHERE id = 'INC-3'").fetchone()
    assert (row["owner"], row["owner_rule_id"], row["mismatch_type"], row["zone"], row["inferred"], row["opened_by"]) == ("razorpay", 8, "G", "after", 0, "signal")
    v = json.loads(row["verdict_json"])
    assert v["confidence"] == "medium" and v["cause_code"] == "RENEWAL_GATEWAY_ERROR_CARD"
    assert any("inside Razorpay" in s for s in v["what_we_cannot_see"])
    assert {e["kind"] for e in v["evidence"]} >= {"renewal_failures", "other_method_fine", "no_change_on_your_side", "no_bank_outage"}
    steps = json.loads(world.execute("SELECT steps_json FROM agent_traces WHERE incident_id = 'INC-3'").fetchone()[0])
    assert steps["rule_based"] and steps["model_id"] is None and steps["steps"][-1]["tool"] == "attribute"


def test_inc3_members_are_the_failed_renewals_and_leave_out_those_who_paid_again(world):
    rows = world.execute("SELECT im.*, p.status FROM incident_members im JOIN payments p ON p.id = im.payment_id WHERE incident_id = 'INC-3'").fetchall()
    assert len(rows) == 27 and {r["status"] for r in rows} == {"failed"}
    exact = [r for r in rows if r["tier"] == "exact"]
    out = [r for r in rows if r["tier"] == "excluded"]
    assert len(exact) == 24 and len(out) == 3 and all(r["exclusion_reason"].startswith("Paid since") for r in out)
    assert sum(r["complained"] for r in rows) == 3 and not any(r["complained"] for r in out)


def test_complaints_that_name_a_failed_renewal_join_the_incident(world):
    cases = world.execute("SELECT * FROM cases WHERE incident_id = 'INC-3'").fetchall()
    assert len(cases) == 3 and all(c["match_status"] == "matched" and c["owner"] == "razorpay" and c["mismatch_type"] == "G" for c in cases)
    assert world.execute("SELECT COUNT(*) FROM incident_members WHERE incident_id = 'INC-3' AND case_id IS NOT NULL").fetchone()[0] == 3


def test_inc3_leaves_hero_a_exactly_as_it_was(world):
    row = world.execute("SELECT * FROM incidents WHERE id = 'INC-1'").fetchone()
    assert row["owner"] == "merchant_code"
    m = world.execute("SELECT tier, COUNT(*) AS n, SUM(complained) AS c FROM incident_members WHERE incident_id = 'INC-1' GROUP BY tier").fetchall()
    assert {r["tier"]: r["n"] for r in m}["exact"] == 81 and sum(r["n"] for r in m) == 85 and sum(r["c"] for r in m) == 17


# ---------------- the fix: a grace extension, staged, undoable ----------------
def test_the_grace_extension_runs_in_stages_and_never_twice(fresh):
    before = ents(fresh)
    aid = executor.create(fresh, "INC-3", "grant", {})
    assert len(executor.get(fresh, aid).items) == 24 and ents(fresh) == before  # a plan changes nothing
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    assert ents(fresh) == before
    executor.approve(fresh, aid, "first_5", FOUNDER)
    assert executor.get(fresh, aid).item_counts == {"verified": 5, "pending": 19}
    executor.approve(fresh, aid, "first_5", FOUNDER)  # a second click
    assert executor.get(fresh, aid).item_counts == {"verified": 5, "pending": 19}
    executor.approve(fresh, aid, "rest", FOUNDER)
    done = ents(fresh)
    executor.approve(fresh, aid, "rest", FOUNDER)
    assert ents(fresh) == done and executor.get(fresh, aid).item_counts == {"verified": 24}
    pid = executor.get(fresh, aid).items[0].payment_id
    c = merchant_mock.check(fresh, pid)
    assert c["has_access"] and datetime.fromisoformat(c["access_until"]) == clock.now() + timedelta(days=merchant_mock.GRACE_DAYS)


def test_customers_who_paid_again_are_never_touched(fresh):
    left_out = {r[0] for r in fresh.execute("SELECT payment_id FROM incident_members WHERE incident_id = 'INC-3' AND tier = 'excluded'")}
    before = {r["subscription_id"]: tuple(r) for r in fresh.execute("SELECT e.* FROM entitlements e JOIN payments p ON p.subscription_id = e.subscription_id WHERE p.id IN (%s)" % ",".join("?" * 3), list(left_out))}
    run_all(fresh)
    after = {r["subscription_id"]: tuple(r) for r in fresh.execute("SELECT e.* FROM entitlements e JOIN payments p ON p.subscription_id = e.subscription_id WHERE p.id IN (%s)" % ",".join("?" * 3), list(left_out))}
    assert before == after


def test_a_grace_extension_never_shortens_access(fresh):
    pid = fresh.execute("SELECT payment_id FROM incident_members WHERE incident_id = 'INC-3' AND tier = 'exact' LIMIT 1").fetchone()[0]
    fresh.execute("UPDATE entitlements SET entitlement_state = 'active', access_until = ? WHERE subscription_id = (SELECT subscription_id FROM payments WHERE id = ?)", ((clock.now() + timedelta(days=30)).isoformat(), pid))
    with pytest.raises(merchant_mock.MockError, match="already show access"):
        merchant_mock.extend_grace(fresh, pid)


def test_a_grace_extension_applies_only_to_a_failed_renewal(fresh):
    captured = fresh.execute("SELECT id FROM payments WHERE status = 'captured' LIMIT 1").fetchone()[0]
    with pytest.raises(merchant_mock.MockError, match="not a failed renewal"):
        merchant_mock.extend_grace(fresh, captured)


def test_undo_puts_every_record_back(fresh):
    before = ents(fresh)
    aid = run_all(fresh)
    assert ents(fresh) != before
    executor.revert(fresh, aid)
    assert ents(fresh) == before


# ---------------- messages ----------------
def test_nobody_is_told_their_access_is_kept_until_it_is_kept(fresh):
    messaging_on(fresh)
    with pytest.raises(executor.ActError, match="Restore access first"):
        executor.create(fresh, "INC-3", "message", {"language": "auto"})
    aid = executor.create(fresh, "INC-3", "grant", {})
    for stage in ("dry_run", "first_5"):
        executor.approve(fresh, aid, stage, FOUNDER)
    mid = executor.create(fresh, "INC-3", "message", {"language": "auto"})
    assert len(executor.get(fresh, mid).items) == 5  # only the five whose records now show access


def test_the_message_says_it_is_the_payment_network_and_names_the_date_from_the_record(fresh):
    messaging_on(fresh)
    run_all(fresh)
    mid = executor.create(fresh, "INC-3", "message", {"language": "auto"})
    previews = executor.message_previews(fresh, mid)
    assert {p.template_id for p in previews} == {"T-G1"} and sum(p.recipients for p in previews) == 24
    until = clock.now() + timedelta(days=merchant_mock.GRACE_DAYS)
    for p in previews:
        assert f"{until.day} {until:%b}" in p.body and "Razorpay" not in p.body.split("powered by")[0]
    assert any("not your card" in p.body for p in previews if p.language == "en")
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(fresh, mid, stage, FOUNDER)
    assert fresh.execute("SELECT COUNT(*) FROM messages WHERE template_id = 'T-G1' AND status = 'sent'").fetchone()[0] == 24


def test_once_told_the_grace_cannot_be_undone(fresh):
    messaging_on(fresh)
    aid = run_all(fresh)
    mid = executor.create(fresh, "INC-3", "message", {"language": "auto"})
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(fresh, mid, stage, FOUNDER)
    with pytest.raises(executor.ActError, match="already told"):
        executor.revert(fresh, aid)


# ---------------- verify and close ----------------
def test_the_incident_closes_only_when_everyone_has_access_and_cards_work_again(fresh):
    aid = executor.create(fresh, "INC-3", "grant", {})
    assert not executor.verify(fresh, "INC-3").closeable  # nothing done yet
    for stage in ("dry_run", "first_5"):
        executor.approve(fresh, aid, stage, FOUNDER)
    part = executor.verify(fresh, "INC-3")
    assert (part.verified, part.total, part.closeable) == (5, 24, False) and "19 are still waiting for the next step" in part.line and "still show no access" not in part.line
    assert fresh.execute("SELECT status FROM incidents WHERE id = 'INC-3'").fetchone()[0] == "fixing"
    executor.approve(fresh, aid, "rest", FOUNDER)
    full = executor.verify(fresh, "INC-3")
    assert (full.verified, full.total, full.closeable, full.signal_healthy) == (24, 24, True, True)
    assert fresh.execute("SELECT status FROM incidents WHERE id = 'INC-3'").fetchone()[0] == "closed"


def test_it_does_not_close_while_card_renewals_are_still_failing(fresh):
    sig = json.loads(fresh.execute("SELECT signature FROM incidents WHERE id = 'INC-3'").fetchone()[0])
    fresh.execute("UPDATE payments SET status = 'failed', error_code = 'GATEWAY_ERROR', captured_at = NULL WHERE is_renewal = 1 AND method = 'card' AND created_at > ?", (sig["last_failure_at"],))
    run_all(fresh)
    v = executor.verify(fresh, "INC-3")
    assert v.verified == 24 and not v.closeable and not v.signal_healthy and "Verify again later" in v.line


# ---------------- escalation to Razorpay ----------------
def test_the_pack_is_drafted_first_and_only_the_founders_approval_sends_it(fresh):
    e = escalate.create(fresh, "INC-3", "razorpay")
    assert e.status == "drafted" and e.ref.startswith("MG-INC-3-") and e.id == "esc_3_razorpay"
    assert escalate.create(fresh, "INC-3", "razorpay").id == e.id and len(escalate.for_incident(fresh, "INC-3")) == 1  # a double click makes one
    assert escalate.get(fresh, e.id).status == "drafted"
    sent = escalate.send(fresh, e.id, FOUNDER)
    assert sent.status == "sent" and sent.updated_at
    log = escalate.send(fresh, e.id, FOUNDER)  # a repeat changes nothing and says so
    assert log.status == "sent" and log.updated_at == sent.updated_at
    assert fresh.execute("SELECT COUNT(*) FROM audit_log WHERE ref_id = ? AND kind = 'approval'", (e.id,)).fetchone()[0] == 2


def test_the_pack_holds_payment_ids_and_counts_and_nothing_about_the_customers(fresh):
    p = escalate.create(fresh, "INC-3", "razorpay").pack
    assert len(p["payment_ids"]) == 27 and p["error_buckets"][0]["code"] == "GATEWAY_ERROR" and p["error_buckets"][0]["count"] == 27
    assert len(p["sample_payment_ids"]) == 5 and p["ruled_out"] and p["card_networks"]
    blob = json.dumps(p)
    people = fresh.execute("SELECT c.name, c.email, c.phone, c.vpa FROM customers c JOIN payments pm ON pm.customer_id = c.id JOIN incident_members im ON im.payment_id = pm.id WHERE im.incident_id = 'INC-3'").fetchall()
    for r in people:
        assert not any(v in blob for v in (r["name"], r["email"], r["phone"], r["vpa"]))
    assert "@example.test" not in blob


def test_what_was_already_tried_is_true_at_the_moment_it_is_sent(fresh):
    e = escalate.create(fresh, "INC-3", "razorpay")
    assert e.pack["already_tried"] == []
    run_all(fresh)
    sent = escalate.send(fresh, e.id, FOUNDER)
    assert "24 customers" in sent.pack["already_tried"][0]


def test_only_what_is_razorpays_can_be_sent_to_razorpay(fresh):
    with pytest.raises(executor.ActError, match="your own developer"):
        escalate.create(fresh, "INC-1", "razorpay")
    with pytest.raises(executor.ActError, match="Only escalation to Razorpay"):
        escalate.create(fresh, "INC-3", "founder")
    with pytest.raises(executor.ActError, match="not found"):
        escalate.create(fresh, "INC-99", "razorpay")


def test_sending_a_pack_sends_no_message_to_any_customer(fresh):
    e = escalate.create(fresh, "INC-3", "razorpay")
    escalate.send(fresh, e.id, FOUNDER)
    assert fresh.execute("SELECT COUNT(*) FROM messages").fetchone()[0] == 0


# ---------------- over HTTP ----------------
def test_inc3_pages_over_http(api):
    inc = api.get("/api/incidents/INC-3").json()
    assert (inc["owner"], inc["mismatch_type"], inc["zone"], inc["inferred"], inc["affected"], inc["complained"], inc["silent"], inc["fixed"]) == ("razorpay", "G", "after", False, 27, 3, 24, 3)
    assert inc["tier_counts"] == {"exact": 24, "likely": 0, "check": 0, "excluded": 3} and inc["timeline"] and inc["verdict"]["confidence"] == "medium"
    assert len(api.get("/api/incidents/INC-3/members").json()) == 27 and len(api.get("/api/incidents/INC-3/members?tier=exact").json()) == 24
    assert api.get("/api/incidents/INC-3/sample").json()
    ray = api.get("/api/incidents/INC-3/ray_card").json()
    assert ray["owner_chip"] == "RAZORPAY SIDE" and not ray["inferred"] and "Send to Razorpay" in ray["buttons"]
    pack = api.get("/api/incidents/INC-3/evidence_pack").json()
    assert pack["for_razorpay"] and len(pack["affected_payment_ids"]) == 27
    assert api.get("/api/incidents/INC-3/trace").json()["rule_based"]
    assert api.get("/api/incidents/INC-3/replay").json()["replayable_by_support"] == 0
    assert "INC-3" in {i["id"] for i in api.get("/api/incidents").json()}


def test_the_day0_scan_counts_only_customers_who_paid_and_adds_the_renewals_in_words(api):
    s = api.post("/api/scan/day0").json()
    assert s["leaked_customers"] == 81 and "27 card renewals failed" in s["headline"]


def test_escalation_over_http(api):
    e = api.post("/api/escalations", json={"incident_id": "INC-3", "target": "razorpay"}).json()
    assert e["status"] == "drafted" and api.get("/api/escalations", params={"incident_id": "INC-3"}).json()[0]["id"] == e["id"]
    assert api.get(f"/api/escalations/{e['id']}").json()["ref"] == e["ref"]
    sent = api.post(f"/api/escalations/{e['id']}/send", json={"approver": "founder"}).json()
    assert sent["status"] == "sent"
    assert api.post("/api/escalations", json={"incident_id": "INC-1", "target": "razorpay"}).status_code == 409
    assert api.get("/api/escalations/esc_nope").status_code == 404


def test_the_grace_flow_over_http(api):
    aid = api.post("/api/incidents/INC-3/actions", json={"action_type": "grant", "params": {}}).json()["id"]
    for stage in ("dry_run", "first_5", "rest"):
        a = api.post(f"/api/actions/{aid}/approve", json={"stage": stage, "approver": "founder"}).json()
    assert a["status"] == "done" and a["item_counts"] == {"verified": 24}
    v = api.post("/api/incidents/INC-3/verify").json()
    assert v["closeable"] and v["verified"] == 24
