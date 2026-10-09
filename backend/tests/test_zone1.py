"""Zone 1 (R4): problems before the payment. Detection, inference, the read layer and recovery links."""
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

import pytest
import yaml
from app import clock, merchant_mock, service
from app.act import autonomy, executor, messages
from app.attribution import Evidence, attribute
from app.detect import order_gap, probe
from app.main import app
from app.zone1 import read as z1
from app.zone1 import recovery, volume
from app.zone1.baselines import Orders
from app.zone1.inference import group_signals
from app.zone1.signal import Signal
from app.zone1.stats import binom_sf, poisson_cdf, poisson_sf
from fastapi.testclient import TestClient

CFG = yaml.safe_load((Path(__file__).resolve().parents[2] / "synth" / "config.yaml").read_text())
Z = CFG["zone1"]
T = lambda s: datetime.fromisoformat(s + "+05:30")
FOUNDER = "merchant:founder"


def on(db, **changes):
    autonomy.write(db, autonomy.read(db).model_copy(update=changes), "test")
    db.commit()


# ---------- the arithmetic ----------
def test_tail_probabilities():
    assert poisson_cdf(0, 2.0) == pytest.approx(0.1353, abs=1e-3) and poisson_sf(3, 0.05) < 1e-4 and poisson_sf(0, 1.0) == 1.0
    assert binom_sf(5, 5, 0.2) == pytest.approx(0.2**5) and binom_sf(0, 5, 0.2) == pytest.approx(1.0)


# ---------- the pay-URL probe: one failure is noise, two in a row is a signal ----------
def _probes(*statuses):
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    db.executescript((Path(__file__).resolve().parents[2] / "contracts" / "schema.sql").read_text())
    t = T("2026-10-01T12:00:00")
    for i, s in enumerate(statuses):
        db.execute("INSERT INTO probes (id, merchant_id, url, checked_at, http_status, load_ms, checkout_script_present) VALUES (?,?,?,?,?,?,?)",
                   (f"p{i}", "m", "https://x.example/buy", (t + timedelta(minutes=5 * i)).isoformat(), 200 if s in ("slow", "nosc") else s, 6000 if s == "slow" else 150, 0 if s == "nosc" else 1))
    return db


def test_a_single_failed_check_raises_nothing_and_two_in_a_row_do():
    assert probe.find(_probes(200, 503, 200, 200)) == []
    sigs = probe.find(_probes(200, 404, 404, 404, 200))
    assert len(sigs) == 1 and sigs[0].weight == 2 and sigs[0].details["failed_checks"] == 3 and sigs[0].end is not None
    assert probe.find(_probes(200, 404, 404))[0].end is None  # still failing at the last check


def test_a_slow_page_or_a_missing_checkout_script_is_a_failed_check():
    assert len(probe.find(_probes(200, "slow", "slow", 200))) == 1 and len(probe.find(_probes(200, "nosc", "nosc", 200))) == 1


# ---------- the monitors on the generated world ----------
def zone1_incidents(world):
    return world.execute("SELECT * FROM incidents WHERE zone = 'before' ORDER BY id").fetchall()


def test_the_pipeline_finds_exactly_the_two_before_payment_incidents(world):
    rows = zone1_incidents(world)
    assert [r["id"] for r in rows] == ["INC-4", "INC-5"]
    inc4, inc5 = rows
    assert (inc4["cause_code"], inc4["owner"], inc4["owner_rule_id"], inc4["inferred"], inc4["mismatch_type"]) == ("ROUTE_NOT_FOUND_AFTER_DEPLOY", "merchant_code", 81, 1, "Z1")
    assert (inc5["cause_code"], inc5["owner"], inc5["owner_rule_id"], inc5["inferred"]) == ("CHECKOUT_KEY_MISMATCH", "merchant_config", 82, 1)
    assert json.loads(inc4["verdict_json"])["confidence"] == "high" and json.loads(inc5["verdict_json"])["confidence"] == "medium"


def test_onsets_are_close_to_when_the_change_went_live(world):
    onset = {r["id"]: datetime.fromisoformat(r["onset_at"]) for r in zone1_incidents(world)}
    assert abs(onset["INC-4"] - T(Z["inc4"]["onset"])) <= timedelta(minutes=30)
    assert abs(onset["INC-5"] - T(Z["inc5"]["onset"])) <= timedelta(minutes=30)


def test_inc4_is_found_minutes_after_the_deploy_and_before_any_customer_wrote(world):
    inc4 = world.execute("SELECT * FROM incidents WHERE id = 'INC-4'").fetchone()
    alert = datetime.fromisoformat(json.loads(inc4["signature"])["alert_at"])
    first_complaint = min(datetime.fromisoformat(r["received_at"]) for r in world.execute("SELECT received_at FROM complaints WHERE raw_text LIKE '%404%' OR raw_text LIKE '%page not found%'"))
    assert alert - T(Z["inc4"]["onset"]) <= timedelta(minutes=15) and alert < first_complaint
    assert inc4["resolved_at"] is None  # still broken at the snapshot


def test_the_look_alikes_raise_no_incident(world):
    for incident in zone1_incidents(world):
        onset = datetime.fromisoformat(incident["onset_at"])
        for name in ("n1", "n2", "n3", "n4", "n5"):
            assert not (T(Z[name]["start"]) - timedelta(hours=2) <= onset <= T(Z[name]["end"]) + timedelta(hours=2)), (incident["id"], name)


def test_a_bank_outage_is_routed_to_the_bank_and_a_sale_to_the_customers(world):
    spikes = [json.loads(r["details"]) for r in world.execute("SELECT details FROM signals WHERE monitor = 'complaint_spike' ORDER BY onset_at")]
    routed = {s["routed"] for s in spikes}
    assert routed == {"customer_or_unknown", "bank", "zone1"}
    bank = next(s for s in spikes if s["routed"] == "bank")
    assert bank["unmatched"] == 0 and attribute(Evidence(failures_inside_downtime_window=True, error_source="bank")).rule_id == 7


def test_a_quiet_night_is_insufficient_volume_not_a_dip(world):
    orders = Orders(world)
    n1 = T(Z["n1"]["end"])
    assert volume.check(orders, n1)["status"] == "insufficient_volume"
    assert volume.check(orders, T("2026-10-01T22:30:00"))["status"] == "dip"  # INC-4 evening
    assert volume.check(orders, T("2026-09-22T20:00:00"))["status"] in ("normal", "insufficient_volume")  # N2, an ordinary dip


def test_the_order_gap_needs_five_orders_and_two_checks_in_a_row():
    assert order_gap.qualifies([{"attempts": 0}] * 4, 0.2)[0] is False
    assert order_gap.qualifies([{"attempts": 0}] * 5, 0.2)[0] is True
    assert order_gap.qualifies([{"attempts": 0}] * 4 + [{"attempts": 1}] * 4, 0.2)[0] is False  # half is not enough


def test_a_complaint_spike_alone_is_not_an_incident():
    db = _probes()
    s = Signal("complaint_spike", T("2026-10-01T12:00:00"), T("2026-10-01T12:30:00"), T("2026-10-01T12:30:00"), 1)
    assert group_signals(db, [s], T("2026-10-02T10:40:00")) == []
    s2 = Signal("volume_dip", T("2026-10-01T12:00:00"), T("2026-10-01T12:30:00"), T("2026-10-01T12:30:00"), 1)
    g = group_signals(db, [s, s2], T("2026-10-02T10:40:00"))
    assert len(g) == 1 and g[0].confidence == "medium" and g[0].weight == 2


def test_weights_and_confidence_follow_the_spec():
    db = _probes()
    p = Signal("probe", T("2026-10-01T12:00:00"), None, T("2026-10-01T12:05:00"), 2)
    c = Signal("complaint_spike", T("2026-10-01T12:20:00"), T("2026-10-01T12:50:00"), T("2026-10-01T12:30:00"), 1)
    d = Signal("volume_dip", T("2026-10-01T12:30:00"), T("2026-10-01T13:00:00"), T("2026-10-01T13:00:00"), 1)
    assert group_signals(db, [p], T("2026-10-02T10:40:00"))[0].confidence == "medium"            # weight 2, one source
    g = group_signals(db, [p, c, d], T("2026-10-02T10:40:00"))[0]
    assert g.confidence == "high" and g.weight == 4 and g.sources == {"pay page", "complaints", "orders"} and g.alert_at == T("2026-10-01T12:05:00")


def test_the_new_attribution_rows_come_before_unknown():
    assert (attribute(Evidence(zone1_confidence="high", probe_failure=True)).owner, attribute(Evidence(zone1_confidence="medium", route_change_event=True)).rule_id) == ("merchant_code", 81)
    assert attribute(Evidence(zone1_confidence="medium", zero_attempt_orders=True)).rule_id == 82
    assert attribute(Evidence(zone1_confidence="medium", one_channel_only=True)).rule_id == 83
    assert attribute(Evidence(zone1_confidence="medium", zero_attempt_orders=True, probe_failure=True)).rule_id == 81
    assert attribute(Evidence()).rule_id == 10


# ---------- the incident as the web reads it ----------
def test_incident_numbers_add_up_and_say_inferred(world):
    for i in (x for x in service.summaries(world) if x.zone == "before"):
        assert i.inferred and i.mismatch_type == "Z1" and i.complained + i.silent == i.affected
    d = service.detail(world, "INC-4")
    assert d.verdict.what_we_cannot_see and d.replay.replayable_by_support == 0 and sum(d.tier_counts.values()) == len(service.members(world, "INC-4"))
    assert d.verdict.signature["hourly"] and d.timeline and d.verdict.cause_summary_slots["lost_orders"] > 0
    card = service.ray_card(world, "INC-4")
    assert card.inferred and card.owner_chip.startswith("INFERRED") and "404" in card.cause_line


def test_inc4_names_the_customers_and_says_why_some_cannot_be_messaged_now(world):
    ms = service.members(world, "INC-4")
    assert len(ms) == 12  # 12 customers wrote that they could not pay
    reasons = {m.exclusion_reason for m in ms if m.tier == "excluded"}
    assert any(r.startswith("Instagram") for r in reasons) and any(r.startswith("Paid since") for r in reasons)
    assert sum(1 for m in ms if m.tier == "exact") == 8


def test_cases_for_these_customers_say_no_payment_exists(world):
    cs = [c for c in service.cases(world) if c.incident_id == "INC-4"]
    assert len(cs) == 12 and {c.match_status for c in cs} == {"no_payment_found"} and {c.mismatch_type for c in cs} == {"Z1"}
    d = service.case_detail(world, cs[0].id)
    assert "inferred" in d.state_line and "no payment exists" in d.state_line and "No payment attempt" in d.lanes.razorpay[0].text


def test_scan_headline_mentions_the_before_payment_incidents(world):
    assert "81 customers" in service.scan_day0(world).headline and "Before the payment, 2 more times" in service.scan_day0(world).headline


# ---------- contact rules ----------
def test_who_may_be_messaged_now():
    now = T("2026-10-02T10:40:00")
    assert recovery.contact_rule("whatsapp_payments", now - timedelta(hours=23), now) is None
    assert "24 hour window closed" in recovery.contact_rule("whatsapp_payments", now - timedelta(hours=25), now)
    assert recovery.contact_rule("email", now - timedelta(days=9), now) is None
    assert "later release" in recovery.contact_rule("ig_dm", now, now)
    assert "never wrote" in recovery.contact_rule(None, None, now)


def test_the_window_closes_while_the_demo_clock_runs(fresh):
    ready = lambda: sum(1 for p in recovery.people(fresh, "INC-4") if p.state == "ready")
    now = ready()
    clock.advance(30)  # every WhatsApp window has closed, email stays open
    assert 0 < ready() < now


def test_holdout_is_the_same_customers_every_time_and_never_everyone():
    ids = [f"cust_{i}" for i in range(8)]
    assert recovery.holdout_ids(ids, "INC-4", 10) == recovery.holdout_ids(ids, "INC-4", 10) and len(recovery.holdout_ids(ids, "INC-4", 10)) == 1
    assert recovery.holdout_ids(ids[:4], "INC-4", 10) == [] and recovery.holdout_ids(ids, "INC-4", 0) == [] and len(recovery.holdout_ids(ids, "INC-4", 100)) == 8


# ---------- recovery links ----------
def plan(db):
    return executor.create(db, "INC-4", "recovery_link", {})


def test_links_wait_for_a_confirmed_fix_and_for_messaging(fresh):
    aid = plan(fresh)
    a = executor.get(fresh, aid)
    assert a.status == "drafted" and len(a.items) == 8 and a.params["valid_hours"] == 48 and len(a.params["holdout"]) == 1
    assert "Messaging is switched off" in a.blocked_reason
    on(fresh, messaging_enabled=True)
    assert "pay page still answers 404" in executor.get(fresh, aid).blocked_reason
    with pytest.raises(executor.ActError, match="fix is confirmed"):
        executor.approve(fresh, aid, "dry_run", FOUNDER)
    merchant_mock.set_page_mode(fresh, "ok")
    clock.advance(1)
    assert "1 of 2 hours" in executor.get(fresh, aid).blocked_reason
    clock.advance(1)
    assert executor.get(fresh, aid).blocked_reason is None


def run_recovery(db):
    on(db, messaging_enabled=True)
    aid = plan(db)
    merchant_mock.set_page_mode(db, "ok")
    clock.advance(2)
    for st in ("dry_run", "first_5", "rest"):
        executor.approve(db, aid, st, FOUNDER)
    return aid


def test_a_link_goes_to_everyone_reachable_except_the_held_back_customer(fresh):
    aid = run_recovery(fresh)
    a = executor.get(fresh, aid)
    assert a.status == "done" and a.item_counts["verified"] == 8 and a.item_counts["sent"] == 7 and a.item_counts["held_back"] == 1
    sent = fresh.execute("SELECT * FROM messages WHERE action_id = ? AND status = 'sent'", (aid,)).fetchall()
    assert len(sent) == 7 and {m["template_id"] for m in sent} == {"T-Z1R"}
    held = json.loads(fresh.execute("SELECT params_json FROM actions WHERE id = ?", (aid,)).fetchone()[0])["holdout"]
    assert not {m["customer_id"] for m in sent} & set(held)
    people = {p.customer_id: p for p in recovery.people(fresh, "INC-4")}
    for m in sent:  # every number in the text is the customer's own amount or the template's own wording
        assert messages.numbers_ok("T-Z1R", m["language"], recovery.slots(fresh, people[m["customer_id"]]), m["body"])


def test_nobody_unreachable_is_ever_messaged(fresh):
    aid = run_recovery(fresh)
    reachable = {i.payment_id for i in executor.get(fresh, aid).items}
    ig = {p.customer_id for p in recovery.people(fresh, "INC-4") if p.channel == "ig_dm"} | {p.customer_id for p in recovery.people(fresh, "INC-4") if p.state == "paid_since"}
    assert not {m["customer_id"] for m in fresh.execute("SELECT customer_id FROM messages WHERE action_id = ? AND status = 'sent'", (aid,))} & ig
    assert not reachable & ig


def test_a_blocked_send_stops_the_batch_and_nothing_goes_out_of_window(fresh):
    on(fresh, messaging_enabled=True)
    aid = plan(fresh)
    merchant_mock.set_page_mode(fresh, "ok")
    clock.advance(2)
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    clock.advance(24)  # the WhatsApp windows close between the plan and the send
    executor.approve(fresh, aid, "first_5", FOUNDER)
    a = executor.get(fresh, aid)
    assert a.status == "failed" and "24 hour window closed" in fresh.execute("SELECT result_json FROM action_items WHERE status = 'failed' LIMIT 1").fetchone()[0]
    assert all(m["status"] != "sent" or m["language"] for m in fresh.execute("SELECT * FROM messages WHERE action_id = ?", (aid,)))


def test_approving_twice_sends_nothing_twice(fresh):
    aid = run_recovery(fresh)
    n = fresh.execute("SELECT COUNT(*) FROM messages WHERE status = 'sent'").fetchone()[0]
    for st in ("dry_run", "first_5", "rest", "rest"):
        executor.approve(fresh, aid, st, FOUNDER)
    assert fresh.execute("SELECT COUNT(*) FROM messages WHERE status = 'sent'").fetchone()[0] == n == 7
    executor.create(fresh, "INC-4", "recovery_link", {})
    assert fresh.execute("SELECT COUNT(*) FROM actions WHERE action_type = 'recovery_link'").fetchone()[0] == 1


def test_links_cannot_be_unsent_and_there_is_no_money_action(fresh):
    aid = run_recovery(fresh)
    with pytest.raises(executor.ActError, match="cannot be unsent"):
        executor.revert(fresh, aid)
    assert "revoke" not in autonomy.ACTION_CLASS
    assert set(autonomy.MATRIX["refund"].values()) == {"per_row_web"}  # the one money action is approved a customer at a time at every level
    with pytest.raises(executor.ActError, match="charged twice|something Blindspot can do"):
        executor.create(fresh, "INC-4", "refund", {})


def test_recovery_links_always_need_the_founder_at_every_autonomy_level():
    assert all(autonomy.taps("recovery_link", lvl) == autonomy.STAGES for lvl in autonomy.LEVELS)


def test_recovery_link_is_refused_for_an_incident_about_payments(fresh):
    with pytest.raises(executor.ActError, match="could not get as far as paying"):
        executor.create(fresh, "INC-1", "recovery_link", {})


def test_the_preview_shows_the_template_in_each_language_and_allows_a_holdout(fresh):
    previews = executor.message_previews(fresh, plan(fresh))
    assert {p.language for p in previews} == {"en", "hi_latn"} and all(p.holdout_allowed and p.template_id == "T-Z1R" for p in previews) and sum(p.recipients for p in previews) == 7


def test_payments_after_the_link_are_counted_against_the_held_back_customer(fresh):
    aid = run_recovery(fresh)
    out0 = recovery.outcome(fresh, "INC-4")
    assert out0["sent_paid"] == 0 and out0["held_back"] == 1
    clock.advance(48)
    recovery.settle(fresh)
    out = recovery.outcome(fresh, "INC-4")
    assert out["sent_paid"] >= 2 and out["recovered_paise"] > 0
    assert executor.get(fresh, aid).item_counts["sent_paid"] == out["sent_paid"]
    assert fresh.execute("SELECT COUNT(*) FROM recovery_offers WHERE paid_at IS NOT NULL").fetchone()[0] == out["sent_paid"] + out["held_back_paid"]


# ---------- verify and close ----------
def test_the_incident_closes_only_after_the_page_has_been_healthy_for_two_hours(fresh):
    assert executor.verify(fresh, "INC-4").closeable is False
    merchant_mock.set_page_mode(fresh, "ok")
    r = executor.verify(fresh, "INC-4")
    assert not r.closeable and "0 of 2 hours" in r.line
    clock.advance(2)
    r = executor.verify(fresh, "INC-4")
    assert r.closeable and fresh.execute("SELECT status FROM incidents WHERE id = 'INC-4'").fetchone()[0] == "closed" and "No recovery links were sent" in r.line


def test_the_checkout_incident_verifies_from_the_orders_that_followed(fresh):
    r = executor.verify(fresh, "INC-5")
    assert r.closeable and "payment attempt" in r.line


def test_a_recovery_in_progress_keeps_the_incident_open(fresh):
    on(fresh, messaging_enabled=True)
    aid = plan(fresh)
    merchant_mock.set_page_mode(fresh, "ok")
    clock.advance(2)
    executor.approve(fresh, aid, "dry_run", FOUNDER)
    executor.approve(fresh, aid, "first_5", FOUNDER)
    r = executor.verify(fresh, "INC-4")
    assert r.signal_healthy and not r.closeable


def test_the_probe_writes_a_check_the_monitors_can_read(fresh):
    before = fresh.execute("SELECT COUNT(*) FROM probes").fetchone()[0]
    p = z1.run_probe(fresh)
    assert not p.ok and p.http_status == 404 and fresh.execute("SELECT COUNT(*) FROM probes").fetchone()[0] == before + 1
    merchant_mock.set_page_mode(fresh, "ok")
    assert z1.run_probe(fresh).ok
    merchant_mock.set_page_mode(fresh, "key_mismatch")
    assert z1.run_probe(fresh).ok  # the page loads. A probe cannot see that checkout will not open: this is why the order gap monitor exists


# ---------- HTTP ----------
@pytest.fixture
def api(world_file):
    return TestClient(app)


def test_http_probe_clusters_and_incident_views(api):
    assert [c["claim"] for c in api.get("/api/clusters").json()] and all(0 <= c["unmatched_share"] <= 1 for c in api.get("/api/clusters").json())
    assert api.post("/api/probes/run").json()["http_status"] == 404
    assert api.get("/merchant-mock/page-health").json()["page_mode"] == "404"
    assert api.post("/merchant-mock/page-mode", json={"mode": "ok"}).json()["page_mode"] == "ok"
    assert api.get("/merchant-mock/pay-page").status_code == 200
    ids = {i["id"] for i in api.get("/api/incidents").json()}
    assert ids == {"INC-1", "INC-2", "INC-3", "INC-4", "INC-5"}
    for path in ("", "/members", "/sample", "/trace", "/ray_card", "/evidence_pack", "/replay"):
        assert api.get(f"/api/incidents/INC-4{path}").status_code == 200, path
    r = api.post("/api/incidents/INC-4/actions", json={"action_type": "recovery_link", "params": {}})
    assert r.status_code == 200 and r.json()["action_type"] == "recovery_link"


# ---------- a customer who writes in live while the pay page is broken ----------
def _inbound(db, text, channel="whatsapp_payments", who="+919800077001"):
    from app.conversation import machine as m

    return m.step(db, m.handle_inbound(db, channel, who, text, {}, None, False))


def test_a_live_customer_who_cannot_open_the_page_is_told_it_is_the_merchants_side_and_joins_the_incident(fresh):
    step = _inbound(fresh, "The ad link for Test Series says page not found. I wanted to pay Rs 599")
    t = step.thread
    assert t.state == "wait_for_fix" and t.zone == "before" and t.incident_id == "INC-4" and t.question_count == 0
    assert "no money should have left your account" in step.drafted_reply or any("no money should have left" in m.body for m in t.messages)
    assert t.case.mismatch_type == "Z1" and "UPI ref" not in step.drafted_reply.split("If it did")[0]


def test_a_checkout_complaint_joins_the_checkout_incident_only_while_it_is_recent(fresh):
    clock.advance(24 * 3)  # INC-5 ended days ago, so a new complaint is not about it
    t = _inbound(fresh, "checkout open nahi ho raha, Test Series 599 ka lena tha, kuch nahi hota", who="+919800077002").thread
    assert t.incident_id is None and t.state == "identify"


def test_closing_a_before_payment_incident_resolves_its_threads_without_a_message(fresh):
    t = _inbound(fresh, "The Test Series page shows 404 not found, I cannot buy it. Rs 599", who="+919800077003").thread
    merchant_mock.set_page_mode(fresh, "ok")
    clock.advance(2)
    assert executor.verify(fresh, "INC-4").closeable
    from app.conversation import machine as m

    assert m.get_thread(fresh, t.id).state == "resolved"


def test_a_customer_who_adds_the_upi_ref_is_looked_up_not_told_it_is_the_page(fresh):
    v = fresh.execute("SELECT p.rrn FROM incident_members im JOIN payments p ON p.id = im.payment_id WHERE im.incident_id = 'INC-1' LIMIT 1").fetchone()[0]
    t = _inbound(fresh, f"page not found aa raha hai but paisa kat gaya, UPI ref {v}", who="+919800077004").thread
    assert t.zone != "before"
