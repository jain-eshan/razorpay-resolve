import json
from collections import Counter
from datetime import datetime

from app.attribution import Evidence, attribute
from app.detect.access import mismatch
from app.match.keys import extract_keys
from app.widen.silent import replay_eligibility

NOW = datetime.fromisoformat("2026-10-02T10:40:00+05:30")


# ---- attribution: one test per row of the decision table (first match wins) ----
def test_attribution_rows():
    e = Evidence
    cases = [
        (e(delivery_classes=Counter({"4xx": 3}), merchant_response_body=True, merchant_event_id="me1"), "merchant_code", 1),
        (e(delivery_classes=Counter({"5xx": 3}), merchant_response_body=True), "merchant_code", 2),
        (e(delivery_classes=Counter({"timeout": 3})), "merchant_config", 3),
        (e(tls_or_dns_errors=True), "merchant_config", 3),
        (e(disabled_by_razorpay=True), "merchant_code", 4),
        (e(ack_ok_but_no_access=True), "merchant_code", 5),
        (e(duplicate_captures_after_release=True), "merchant_code", 6),
        (e(failures_inside_downtime_window=True, error_source="bank"), "bank", 7),
        (e(single_gateway_code_unexplained=True), "razorpay", 8),
        (e(error_source="customer"), "customer", 9),
        (e(), "unknown", 10),
    ]
    for ev, owner, row in cases:
        a = attribute(ev)
        assert (a.owner, a.rule_id) == (owner, row), (ev, a)


def test_first_matching_row_wins():
    a = attribute(Evidence(delivery_classes=Counter({"4xx": 1}), merchant_response_body=True, merchant_event_id="x", disabled_by_razorpay=True, error_source="customer"))
    assert a.rule_id == 1


# ---- access reconciler ----
def test_access_mismatch_one_time():
    p = {"subscription_id": None, "captured_at": "2026-09-30T10:00:00+05:30"}
    assert mismatch(p, None) == "no_row"
    assert mismatch(p, {"entitlement_state": "unpaid", "access_until": None}) == "unpaid"
    assert mismatch(p, {"entitlement_state": "active", "access_until": None}) is None


def test_access_mismatch_renewal():
    p = {"subscription_id": "sub_1", "captured_at": "2026-09-30T10:00:00+05:30"}
    assert mismatch(p, {"entitlement_state": "expired", "access_until": "2026-09-30T10:00:00+05:30"}) == "access_cut"
    assert mismatch(p, {"entitlement_state": "active", "access_until": "2026-09-30T10:00:00+05:30"}) == "not_extended"
    assert mismatch(p, {"entitlement_state": "active", "access_until": "2026-10-30T10:00:00+05:30"}) is None


# ---- replay eligibility follows Razorpay's documented limits ----
def test_replay_eligibility():
    disabled = "2026-09-30T15:15:15+05:30"
    assert replay_eligibility("2026-09-29T16:00:00+05:30", disabled, NOW) == "replayable_by_support"
    assert replay_eligibility("2026-09-30T15:15:15+05:30", disabled, NOW) == "not_replayable_disabled_window"
    assert replay_eligibility("2026-10-01T09:00:00+05:30", disabled, NOW) == "not_replayable_disabled_window"
    assert replay_eligibility("2026-09-01T09:00:00+05:30", None, NOW) == "too_old"


# ---- exact keys ----
def test_extract_keys():
    k = extract_keys("kat gaya, UPI ref 424712347862 aur pay_AbCdEfGhIjKlMn, order_ZyXwVuTsRqPoNm, 12345 nahi, 1234567890123 nahi")
    assert k["rrn"] == ["424712347862"] and k["payment_id"] == ["pay_AbCdEfGhIjKlMn"] and k["order_id"] == ["order_ZyXwVuTsRqPoNm"]


# ---- the pipeline on a freshly generated world ----
def test_pipeline_finds_exactly_the_injected_incident(world):
    rows = world.execute("SELECT * FROM incidents").fetchall()
    assert len(rows) == 1 and rows[0]["owner"] == "merchant_code" and rows[0]["owner_rule_id"] == 1
    assert rows[0]["cause_code"] == "WEBHOOK_ENDPOINT_401_AFTER_DEPLOY"


def test_alert_is_early_and_cohort_has_every_tier_and_reason(world):
    sig = json.loads(world.execute("SELECT signature FROM incidents").fetchone()[0])
    deploy = datetime.fromisoformat("2026-09-29T14:20:00+05:30")
    assert (datetime.fromisoformat(sig["alert_at"]) - deploy).total_seconds() < 2 * 3600
    assert sig["events_before_alert"] == 1
    tiers = {(r[0], r[1]) for r in world.execute("SELECT tier, exclusion_reason FROM incident_members")}
    assert ("exact", None) in tiers and ("excluded", "refunded") in tiers and ("excluded", "already active (manual grant)") in tiers


def test_hidden_2xx_group_is_found(world):
    n = world.execute("""SELECT count(*) FROM incident_members m JOIN webhook_events e ON e.payment_id = m.payment_id
                         WHERE m.tier = 'exact' AND e.final_delivery_class = '2xx' AND e.event_type IN ('payment.captured','subscription.charged')""").fetchone()[0]
    assert n == world.counts["hidden_2xx"]


def test_pipeline_is_idempotent(world):
    from app import pipeline

    before = world.execute("SELECT count(*) FROM incident_members").fetchone()[0]
    pipeline.run(world)
    assert world.execute("SELECT count(*) FROM incidents").fetchone()[0] == 1
    assert world.execute("SELECT count(*) FROM incident_members").fetchone()[0] == before


def test_service_numbers_add_up(world):
    from app import service

    inc = service.summaries(world)[0]
    assert inc.complained + inc.silent == inc.affected
    d = service.detail(world, "INC-1")
    assert sum(d.tier_counts.values()) == inc.affected
    assert d.replay.replayable_by_support + d.replay.not_replayable_disabled_window == len(
        [m for m in service.members(world, "INC-1") if m.replay_eligibility != "n/a"])
    assert service.detail(world, "INC-9") is None
