"""INC-2 (customers charged twice after an app release) and the guarded refund: the monitor, the verdict, the refund rules, the messages, the close."""
import re
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from app import clock, merchant_mock, pipeline, service
from app.act import autonomy, executor, messages, refund
from app.detect import duplicate as monitor
from app.main import app
from fastapi.testclient import TestClient

FOUNDER = "merchant:founder"
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def api(world_file):
    return TestClient(app)


def plan(db):
    """The refund plan, with the dry run approved. Nothing has been refunded."""
    aid = executor.create(db, "INC-2", "refund", {})
    executor.approve(db, aid, "dry_run", FOUNDER)
    return aid


def refund_all(db, aid=None):
    aid = aid or plan(db)
    for it in executor.get(db, aid).items:
        executor.approve_row(db, aid, it.payment_id, FOUNDER)
    return aid


def refunds_made(db):
    return db.execute("SELECT COUNT(*) FROM refunds WHERE source = 'make_good'").fetchone()[0]


def messaging_on(db):
    autonomy.write(db, autonomy.read(db).model_copy(update={"messaging_enabled": True}), FOUNDER)


def exact_payments(db):
    return [r[0] for r in db.execute("SELECT payment_id FROM incident_members WHERE incident_id = 'INC-2' AND tier = 'exact' ORDER BY payment_id")]


# ---------------- the monitor ----------------
def test_the_monitor_finds_every_double_charge_and_sorts_the_look_alikes(world):
    runs = monitor.find(world)
    assert len(runs) == 1
    r = runs[0]
    assert r.app_version == "android-3.4.1" and len(r.pairs) == 15 and r.other_version_pairs == 0
    assert sorted(p.kind for p in r.excluded) == ["second_failed", "second_failed", "two_seat", "two_seat", "two_seat"]
    assert r.release_id == "me_app_341" and r.after_release and r.release_at < r.first_at
    assert r.alert_at == sorted(p.second_at for p in r.pairs)[monitor.MIN_PAIRS - 1]
    assert all(p.gap_seconds < monitor.MAX_GAP_SECONDS and p.app_version == "android-3.4.1" for p in r.pairs)


def test_two_double_charges_are_not_an_incident(fresh):
    """A stray double tap on a slow phone happens. The monitor needs 3 from one app version."""
    keep = {p.second_id for p in monitor.find(fresh)[0].pairs[:2]}
    for p in monitor.find(fresh)[0].pairs:
        if p.second_id not in keep:  # a second order for someone else is a second seat, not a duplicate
            other = fresh.execute("SELECT id FROM customers WHERE id != ? LIMIT 1", (p.customer_id,)).fetchone()[0]
            fresh.execute("UPDATE orders SET customer_id = ? WHERE id = (SELECT order_id FROM payments WHERE id = ?)", (other, p.second_id))
    assert monitor.find(fresh) == []


def test_charges_two_minutes_apart_are_not_double_charges(fresh):
    p = monitor.find(fresh)[0].pairs[0]
    first = fresh.execute("SELECT created_at FROM payments WHERE id = ?", (p.first_id,)).fetchone()[0]
    fresh.execute("UPDATE payments SET created_at = ? WHERE id = ?", ((datetime.fromisoformat(first) + timedelta(seconds=monitor.MAX_GAP_SECONDS + 1)).isoformat(), p.second_id))
    assert p.second_id not in {c.second_id for c in monitor.candidates(fresh)}


def test_a_refund_the_merchant_made_by_hand_is_left_out_and_the_incident_stays(fresh):
    p = monitor.find(fresh)[0].pairs[0]
    fresh.execute("INSERT INTO refunds (id, payment_id, amount_paise, status, speed, created_at, source) VALUES ('rfnd_byhand', ?, ?, 'processed', 'normal', ?, 'world')", (p.second_id, p.amount_paise, p.second_at.isoformat()))
    fresh.execute("UPDATE payments SET status = 'refunded' WHERE id = ?", (p.second_id,))
    r = monitor.find(fresh)[0]
    assert len(r.pairs) == 14 and p.second_id in {x.second_id for x in r.excluded if x.kind == "refunded"}


def test_a_pattern_that_began_before_the_release_is_not_blamed_on_it(fresh):
    fresh.execute("UPDATE merchant_events SET at = '2026-09-27T00:00:00+05:30' WHERE id = 'me_app_341'")
    r = monitor.find(fresh)[0]
    assert not r.after_release
    pipeline.run(fresh)
    row = fresh.execute("SELECT owner, owner_rule_id FROM incidents WHERE id = 'INC-2'").fetchone()
    assert (row["owner"], row["owner_rule_id"]) == ("unknown", 10)


def test_double_charges_on_several_app_versions_are_not_one_releases_fault(fresh):
    from app.duplicates import build

    for p in monitor.find(fresh)[0].pairs[:6]:
        fresh.execute("UPDATE orders SET client_app_version = 'android-3.4.0' WHERE id IN (SELECT order_id FROM payments WHERE id IN (?, ?))", (p.first_id, p.second_id))
    runs = {r.app_version: r for r in monitor.find(fresh)}
    assert set(runs) == {"android-3.4.0", "android-3.4.1"}
    assert runs["android-3.4.0"].other_version_pairs == 9 and runs["android-3.4.1"].other_version_pairs == 6
    assert all(build._attribution(r).rule_id != 6 for r in runs.values())


# ---------------- the incident ----------------
def test_the_incident_is_on_the_merchants_side_with_the_evidence(world):
    row = world.execute("SELECT * FROM incidents WHERE id = 'INC-2'").fetchone()
    d = service.detail(world, "INC-2")
    assert (row["mismatch_type"], row["owner"], row["owner_rule_id"], row["zone"]) == ("E", "merchant_code", 6, "after")
    v = d.verdict
    assert v.confidence == "high" and v.linked_event_id == "me_app_341" and not v.inferred and v.what_we_cannot_see
    kinds = {e.kind for e in v.evidence}
    assert {"duplicate_pairs", "one_app_version", "after_release", "share_of_orders", "left_out", "webhook_healthy"} <= kinds
    assert d.affected == 15 and d.complained == 4 and d.silent == 11 and d.at_risk_paise == 498500 and d.fixed == 0
    assert d.tier_counts == {"exact": 15, "likely": 0, "check": 0, "excluded": 5}
    assert d.timeline and any("released" in m for b in d.timeline for m in b.markers) and any("first double charge" in m for b in d.timeline for m in b.markers)
    assert sum(b.server_error for b in d.timeline) == 15
    assert any(r.dimension == "app_version" and r.value == "android-3.4.1" and r.lift > 5 for r in d.lift)


def test_the_look_alikes_are_listed_as_left_out_with_a_reason(world):
    rows = service.members(world, "INC-2", "excluded")
    assert len(rows) == 5 and all(r.exclusion_reason for r in rows)
    reasons = {r.exclusion_reason for r in rows}
    assert any("Two seats" in x for x in reasons) and any("second attempt failed" in x for x in reasons)
    assert not {r.payment_id for r in rows} & set(exact_payments(world))


def test_complaints_that_name_either_charge_join_the_incident(world):
    cases = world.execute("SELECT * FROM cases WHERE incident_id = 'INC-2'").fetchall()
    assert len(cases) == 4 and all(c["mismatch_type"] == "E" and c["owner"] == "merchant_code" for c in cases)
    members = world.execute("SELECT case_id FROM incident_members WHERE incident_id = 'INC-2' AND complained = 1").fetchall()
    assert len(members) == 4 and all(m["case_id"] for m in members)
    cited = [world.execute("SELECT matched_payment_ids FROM cases WHERE id = ?", (c["id"],)).fetchone()[0] for c in cases]
    exact = set(exact_payments(world))
    assert any(any(p in exact for p in re.findall(r"pay_\w{14}", c)) for c in cited) and any(not any(p in exact for p in re.findall(r"pay_\w{14}", c)) for c in cited)


def test_the_pages_work_and_hold_no_customer_details(world):
    assert service.replay(world, "INC-2").replayable_by_support == 0
    pack = service.evidence_pack(world, "INC-2")
    assert pack.affected_events == 15 and len(pack.affected_payment_ids) == 15 and "idempotency key" in pack.suggested_fix and pack.linked_change == "app_release android-3.4.1"
    card = service.ray_card(world, "INC-2")
    assert card.owner_chip == "YOUR SIDE · Code" and not card.inferred and "android-3.4.1" in card.cause_line
    lanes = service.sample(world, "INC-2")
    assert len(lanes) == 4 and all(l.lanes.razorpay and l.lanes.merchant for l in lanes)
    blob = pack.model_dump_json() + card.model_dump_json()
    for name, email, phone in world.execute("SELECT c.name, c.email, c.phone FROM customers c JOIN payments p ON p.customer_id = c.id JOIN incident_members im ON im.payment_id = p.id WHERE im.incident_id = 'INC-2'"):
        assert name not in blob and email not in blob and phone not in blob
    assert all(m.customer_masked != "" for m in service.members(world, "INC-2"))


def test_the_day_zero_scan_counts_double_charges_apart_from_paid_without_access(world):
    scan = service.scan_day0(world)
    assert "charged twice" in scan.headline and scan.leaked_customers == 81  # the same 81 actionable customers as before: a second charge is not a customer without access
    assert any(i.id == "INC-2" and i.mismatch_type == "E" for i in scan.incidents)


# ---------------- the refund rules ----------------
def test_a_refund_needs_the_dry_run_then_one_person_per_customer(fresh):
    aid = executor.create(fresh, "INC-2", "refund", {})
    a = executor.get(fresh, aid)
    assert a.status == "drafted" and len(a.items) == 15 and a.next_stage == "dry_run"
    with pytest.raises(executor.ActError, match="Review the list first"):
        executor.approve_row(fresh, aid, a.items[0].payment_id, FOUNDER)
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    assert executor.get(fresh, aid).next_stage is None and refunds_made(fresh) == 0
    for stage in ("first_5", "rest"):  # the whole-list stages that every other action has do not exist for refunds
        with pytest.raises(executor.ActError, match="one customer at a time"):
            executor.approve(fresh, aid, stage, FOUNDER)
    assert refunds_made(fresh) == 0
    executor.approve_row(fresh, aid, a.items[0].payment_id, FOUNDER)
    assert refunds_made(fresh) == 1 and executor.get(fresh, aid).status == "approved"


def test_nothing_but_a_person_can_refund(fresh):
    aid = plan(fresh)
    pid = executor.get(fresh, aid).items[0].payment_id
    with pytest.raises(executor.ActError) as e:
        executor.approve_row(fresh, aid, pid, "auto:autopilot_reversible")
    assert e.value.status == 403
    with pytest.raises(refund.RefundBlocked, match="person"):
        refund.issue(fresh, pid, "system", "INC-2")
    assert refunds_made(fresh) == 0


def test_the_autonomy_setting_never_runs_a_refund(fresh):
    autonomy.write(fresh, autonomy.read(fresh).model_copy(update={"autonomy": "autopilot_reversible"}), FOUNDER)
    aid = executor.create(fresh, "INC-2", "refund", {})
    assert executor.get(fresh, aid).status == "drafted" and refunds_made(fresh) == 0
    assert set(autonomy.MATRIX["refund"].values()) == {"per_row_web"} and autonomy.taps("refund", "autopilot_reversible") == autonomy.STAGES


def test_a_refund_goes_to_the_original_method_for_the_full_amount_and_is_recorded(fresh):
    aid = plan(fresh)
    it = executor.get(fresh, aid).items[0]
    p = fresh.execute("SELECT * FROM payments WHERE id = ?", (it.payment_id,)).fetchone()
    executor.approve_row(fresh, aid, it.payment_id, FOUNDER)
    r = fresh.execute("SELECT * FROM refunds WHERE payment_id = ?", (it.payment_id,)).fetchone()
    assert (r["amount_paise"], r["status"], r["source"], r["arn"], r["rrn"]) == (p["amount_paise"], "pending", "make_good", None, None)
    assert fresh.execute("SELECT status FROM payments WHERE id = ?", (it.payment_id,)).fetchone()[0] == "refunded"
    assert executor.get(fresh, aid).items[0].status == "verified"
    cols = {c["name"] for c in fresh.execute("PRAGMA table_info(refunds)")}
    assert not cols & {"destination", "account", "vpa", "to_account", "method"}  # there is nowhere to put another destination
    assert any("This cannot be undone" in l["payload_json"] for l in fresh.execute("SELECT payload_json FROM audit_log WHERE kind = 'action'"))


def test_a_repeat_approval_refunds_nobody_twice(fresh):
    aid = plan(fresh)
    it = executor.get(fresh, aid).items[0]
    executor.approve_row(fresh, aid, it.payment_id, FOUNDER)
    for _ in range(3):
        executor.approve_row(fresh, aid, it.payment_id, FOUNDER)
    executor.create(fresh, "INC-2", "refund", {})
    assert fresh.execute("SELECT COUNT(*) FROM refunds WHERE payment_id = ?", (it.payment_id,)).fetchone()[0] == 1
    assert any("repeat approval" in l["payload_json"] for l in fresh.execute("SELECT payload_json FROM audit_log WHERE kind = 'approval'"))


def test_a_second_tab_finds_the_refund_already_made(world_file):
    """Two connections, as two browser tabs would be. The second finds the refund made by the first and does nothing."""
    import sqlite3
    a, b = sqlite3.connect(world_file), sqlite3.connect(world_file)
    for c in (a, b):
        c.row_factory = sqlite3.Row
    aid = executor.create(a, "INC-2", "refund", {})
    executor.approve(a, aid, "dry_run", FOUNDER)
    pid = executor.get(a, aid).items[0].payment_id
    executor.approve_row(a, aid, pid, FOUNDER)
    executor.approve_row(b, aid, pid, FOUNDER)
    assert a.execute("SELECT COUNT(*) FROM refunds WHERE payment_id = ?", (pid,)).fetchone()[0] == 1


def test_a_look_alike_cannot_be_refunded_even_when_asked_directly(fresh):
    aid = plan(fresh)
    look = [m.payment_id for m in service.members(fresh, "INC-2", "excluded")]
    for pid in look:
        with pytest.raises(refund.RefundBlocked, match="not a confirmed duplicate"):
            refund.issue(fresh, pid, FOUNDER, "INC-2")
        with pytest.raises(executor.ActError, match="not in this plan"):
            executor.approve_row(fresh, aid, pid, FOUNDER)
    assert refunds_made(fresh) == 0


def test_the_first_charge_is_never_refunded(fresh):
    first = monitor.find(fresh)[0].pairs[0].first_id
    with pytest.raises(refund.RefundBlocked):
        refund.issue(fresh, first, FOUNDER, "INC-2")


def test_the_daily_limit_refuses_the_refund_that_would_pass_it_and_resets_tomorrow(fresh):
    autonomy.write(fresh, autonomy.read(fresh).model_copy(update={"daily_refund_cap_paise": 150_000}), FOUNDER)
    aid = plan(fresh)
    out = []
    for it in executor.get(fresh, aid).items:
        try:
            executor.approve_row(fresh, aid, it.payment_id, FOUNDER)
        except executor.ActError as e:
            out.append(str(e))
    assert 0 < refund.spent_today(fresh) <= 150_000 and out and all("refund limit is ₹1,500" in m and "waits for tomorrow" in m for m in out)
    first_day = refunds_made(fresh)
    clock.advance(24)
    for it in executor.get(fresh, aid).items:
        if it.status != "verified" and not refund.blocked(fresh, it.payment_id, "INC-2"):
            executor.approve_row(fresh, aid, it.payment_id, FOUNDER)
    assert refunds_made(fresh) > first_day and refund.spent_today(fresh) <= 150_000


def test_refunds_cannot_be_undone(fresh):
    aid = refund_all(fresh)
    with pytest.raises(executor.ActError, match="cannot be undone"):
        executor.revert(fresh, aid)


def test_no_access_grant_is_offered_for_a_double_charge(fresh):
    with pytest.raises(executor.ActError, match="Both orders already have access"):
        executor.create(fresh, "INC-2", "grant", {})
    with pytest.raises(executor.ActError, match="charged twice"):
        executor.create(fresh, "INC-1", "refund", {})


def test_nothing_but_the_refund_engine_writes_a_refund():
    """Same idea as the one send path: a refund Resolve makes comes from act/refund.py and nowhere else."""
    for p in (ROOT / "backend" / "app").rglob("*.py"):
        if p.name != "refund.py":
            assert "INSERT INTO refunds" not in p.read_text(), p


# ---------------- the bank reference ----------------
def test_a_refund_stays_pending_until_the_bank_has_had_time_then_gets_its_reference(fresh):
    refund_all(fresh)
    rows = {r.payment_id: r for r in service.refund_board(fresh, "INC-2").rows}
    assert {r.state for r in rows.values()} == {"pending"} and not any(r.ref for r in rows.values())
    clock.advance(3)
    refund.settle(fresh, clock.now())
    board = service.refund_board(fresh, "INC-2")
    assert {r.method for r in board.rows} > {"upi"}  # the world has cards and netbanking too, which the bank takes longer over
    assert all((r.state == "processed") == (r.method == "upi") for r in board.rows)
    clock.advance(72)
    refund.settle(fresh, clock.now())
    for r in service.refund_board(fresh, "INC-2").rows:
        assert r.state == "processed" and r.ref and r.ref_format == ("ARN" if r.method == "card" else "RRN")
        assert len(r.ref) == (23 if r.method == "card" else 12) and r.ref.isdigit()
    refund.settle(fresh, clock.now())  # safe to run again: nothing changes
    assert refunds_made(fresh) == 15


# ---------------- telling the customers ----------------
def test_a_customer_is_told_only_once_the_refund_has_a_bank_reference(fresh):
    messaging_on(fresh)
    refund_all(fresh)
    with pytest.raises(executor.ActError, match="bank reference"):
        executor.create(fresh, "INC-2", "message", {"language": "auto"})
    clock.advance(72)
    refund.settle(fresh, clock.now())
    mid = executor.create(fresh, "INC-2", "message", {"language": "auto"})
    previews = executor.message_previews(fresh, mid)
    assert {p.template_id for p in previews} == {"T-E1"} and sum(p.recipients for p in previews) == 15 and all(p.sender.endswith("powered by Razorpay") for p in previews)
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(fresh, mid, stage, FOUNDER)
    sent = fresh.execute("SELECT * FROM messages WHERE template_id = 'T-E1' AND status = 'sent'").fetchall()
    assert len(sent) == 15 and len({m["payment_id"] for m in sent}) == 15
    for m in sent:
        r = fresh.execute("SELECT * FROM refunds WHERE payment_id = ?", (m["payment_id"],)).fetchone()
        assert r["id"] in m["body"] and (r["arn"] or r["rrn"]) in m["body"]
        assert messages.numbers_ok(m["template_id"], m["language"], messages.slots_for(fresh, m["payment_id"]), m["body"])


def test_customers_whose_refund_arrives_later_are_told_in_one_more_approval(fresh):
    messaging_on(fresh)
    refund_all(fresh)
    clock.advance(3)  # UPI refunds are processed, cards are not
    refund.settle(fresh, clock.now())
    mid = executor.create(fresh, "INC-2", "message", {"language": "auto"})
    for stage in ("dry_run", "first_5", "rest"):
        executor.approve(fresh, mid, stage, FOUNDER)
    first = fresh.execute("SELECT COUNT(*) FROM messages WHERE template_id = 'T-E1'").fetchone()[0]
    assert 0 < first < 15
    clock.advance(72)
    refund.settle(fresh, clock.now())
    assert executor.create(fresh, "INC-2", "message", {"language": "auto"}) == mid
    executor.approve(fresh, mid, "rest", FOUNDER)
    sent = fresh.execute("SELECT payment_id FROM messages WHERE template_id = 'T-E1' AND status = 'sent'").fetchall()
    assert len(sent) == 15 and len({r[0] for r in sent}) == 15  # nobody twice


def test_messages_stay_off_until_the_founder_turns_them_on(fresh):
    refund_all(fresh)
    clock.advance(72)
    refund.settle(fresh, clock.now())
    mid = executor.create(fresh, "INC-2", "message", {"language": "auto"})
    with pytest.raises(executor.ActError, match="Messaging is switched off"):
        executor.approve(fresh, mid, "dry_run", FOUNDER)


# ---------------- verify and close ----------------
def test_the_incident_closes_only_when_everyone_is_refunded_and_the_app_is_fixed_for_a_day(fresh):
    assert not executor.verify(fresh, "INC-2").closeable and "Nothing has been refunded" in executor.verify(fresh, "INC-2").line
    aid = plan(fresh)
    executor.approve_row(fresh, aid, executor.get(fresh, aid).items[0].payment_id, FOUNDER)
    v = executor.verify(fresh, "INC-2")
    assert not v.closeable and v.verified == 1 and "still to refund" in v.line
    refund_all(fresh, aid)
    v = executor.verify(fresh, "INC-2")
    assert not v.closeable and v.verified == 15 and "still lets the Pay button be tapped twice" in v.line and v.restored_paise == 498500
    merchant_mock.set_app_mode(fresh, "fixed")
    clock.advance(1)
    v = executor.verify(fresh, "INC-2")
    assert not v.closeable and "of 24 hours" in v.line
    assert fresh.execute("SELECT status FROM incidents WHERE id = 'INC-2'").fetchone()[0] == "verifying"
    clock.advance(24)
    v = executor.verify(fresh, "INC-2")
    assert v.closeable and "₹4,985 returned" in v.line
    assert fresh.execute("SELECT status FROM incidents WHERE id = 'INC-2'").fetchone()[0] == "closed"


def test_a_refund_that_the_records_do_not_show_is_not_counted(fresh):
    refund_all(fresh)
    fresh.execute("UPDATE refunds SET status = 'failed' WHERE id = (SELECT id FROM refunds WHERE source = 'make_good' LIMIT 1)")
    v = executor.verify(fresh, "INC-2")
    assert v.verified == 14 and not v.closeable and "could not be checked" in v.line


def test_the_pipeline_can_run_again_after_refunds_without_losing_the_incident(fresh):
    refund_all(fresh)
    pipeline.run(fresh)
    assert fresh.execute("SELECT COUNT(*) FROM incident_members WHERE incident_id = 'INC-2' AND tier = 'exact'").fetchone()[0] == 15
    d = service.detail(fresh, "INC-2")
    assert d.fixed == 15 and d.at_risk_paise == 0


# ---------------- through HTTP ----------------
def test_http_the_refund_screen_and_the_one_customer_route(api):
    board = api.get("/api/incidents/INC-2/refunds").json()
    assert board["owed_paise"] == 498500 and board["refunded_paise"] == 0 and len(board["rows"]) == 15 and board["cap_paise"] == 500000
    assert api.get("/api/incidents/INC-1/refunds").json()["rows"] == [] and api.get("/api/incidents/INC-9/refunds").status_code == 404
    aid = api.post("/api/incidents/INC-2/actions", json={"action_type": "refund", "params": {}}).json()["id"]
    pid = board["rows"][0]["payment_id"]
    early = api.post(f"/api/actions/{aid}/items/{pid}/approve", json={"approver": "founder"})
    assert early.status_code == 409 and "Review the list" in early.json()["detail"]
    assert api.post(f"/api/actions/{aid}/approve", json={"stage": "dry_run", "approver": "founder"}).status_code == 200
    assert api.post(f"/api/actions/{aid}/approve", json={"stage": "rest", "approver": "founder"}).status_code == 409
    ok = api.post(f"/api/actions/{aid}/items/{pid}/approve", json={"approver": "founder"})
    assert ok.status_code == 200 and sum(i["status"] == "verified" for i in ok.json()["items"]) == 1
    after = api.get("/api/incidents/INC-2/refunds").json()
    assert after["refunded_paise"] == board["rows"][0]["amount_paise"] and after["rows"][0]["state"] == "pending" and after["rows"][0]["refund_id"].startswith("rfnd_")
    assert api.post(f"/api/actions/{aid}/items/pay_nosuchpayment001/approve", json={"approver": "founder"}).status_code == 404
    assert api.post(f"/api/actions/{aid}/revert").status_code == 409


def test_http_the_daily_limit_comes_back_as_a_plain_sentence(api):
    s = api.get("/api/settings").json() | {"daily_refund_cap_paise": 30000}
    assert api.put("/api/settings", json=s).status_code == 200
    aid = api.post("/api/incidents/INC-2/actions", json={"action_type": "refund", "params": {}}).json()["id"]
    api.post(f"/api/actions/{aid}/approve", json={"stage": "dry_run", "approver": "founder"})
    rows = api.get("/api/incidents/INC-2/refunds").json()["rows"]
    big = max(rows, key=lambda r: r["amount_paise"])
    r = api.post(f"/api/actions/{aid}/items/{big['payment_id']}/approve", json={"approver": "founder"})
    assert r.status_code == 409 and "refund limit is ₹300" in r.json()["detail"]
    assert api.get("/api/incidents/INC-2/refunds").json()["refunded_paise"] == 0


def test_http_the_developer_ships_the_fix(api):
    assert api.get("/merchant-mock/app-health").json()["app_mode"] == "broken"
    h = api.post("/merchant-mock/app-mode", json={"mode": "fixed"}).json()
    assert h["app_mode"] == "fixed" and h["app_fixed_since"] and not h["signal_healthy"]
    assert api.post("/merchant-mock/app-mode", json={"mode": "nope"}).status_code == 409
    clock.advance(25)
    assert api.get("/merchant-mock/app-health").json()["signal_healthy"]
    api.post("/api/clock/advance", json={"hours": 1})
    assert api.get("/api/incidents/INC-2").json()["id"] == "INC-2"
