"""The learning loop (SPEC 11): feedback is stored, settings move one bounded step, nothing moves twice in a week, and every change is logged."""
import json
from datetime import timedelta

import pytest
from app import clock
from app.learning import loop, params
from app.zone1.baselines import Orders
from fastapi.testclient import TestClient

NOW = clock.now()
DIP = "order_volume_dip"


def fb(db, kind, monitors=(DIP,), at=None, **extra):
    return loop.record(db, "alert", "a1", kind, {"monitors": list(monitors), **extra}, at or NOW)


def test_defaults_when_nothing_has_changed(fresh):
    assert params.get(fresh, "order_dip_p_threshold") == 0.01
    assert params.get(fresh, "message_variant") == "en"
    assert [p.version for p in loop.all_params(fresh, NOW)] == [0, 0, 0]


def test_false_alarm_on_an_incident_remembers_which_monitors_raised_it(fresh):
    fid = loop.record(fresh, "incident", "INC-4", "false_alarm", {}, NOW)
    got = json.loads(fresh.execute("SELECT payload_json FROM feedback_events WHERE id = ?", (fid,)).fetchone()[0])
    assert got["monitors"] == ["complaint_spike", "order_volume_dip"]  # the probe is not tunable, so it is not listed


def test_unknown_incident_unknown_kind_and_missed_without_a_monitor_are_refused(fresh):
    for args in (("incident", "INC-99", "false_alarm", {}), ("incident", "INC-4", "nonsense", {}), ("outage", "o1", "missed_incident", {})):
        with pytest.raises(ValueError):
            loop.record(fresh, *args, NOW)


def test_one_false_alarm_makes_the_monitor_one_step_stricter(fresh):
    fb(fresh, "false_alarm")
    [c] = loop.review(fresh, NOW)
    assert (c.key, c.before, c.after, c.version) == ("order_dip_p_threshold", 0.01, 0.005, 1)
    assert params.get(fresh, "complaint_spike_p_threshold") == 0.01  # only the monitor that raised it


def test_a_missed_incident_makes_it_one_step_looser(fresh):
    fb(fresh, "missed_incident")
    [c] = loop.review(fresh, NOW)
    assert (c.before, c.after) == (0.01, 0.02)


def test_false_alarm_and_missed_incident_in_the_same_week_cancel_out(fresh):
    fb(fresh, "false_alarm")
    fb(fresh, "missed_incident")
    assert loop.review(fresh, NOW) == []


def test_a_setting_changes_once_a_week_and_the_same_feedback_is_not_counted_twice(fresh):
    fb(fresh, "false_alarm")
    assert len(loop.review(fresh, NOW)) == 1
    assert loop.review(fresh, NOW + timedelta(days=1)) == []  # same feedback, already used
    fb(fresh, "false_alarm", at=NOW + timedelta(days=2))
    assert loop.review(fresh, NOW + timedelta(days=3)) == []  # new feedback, but the lock holds for 7 days
    assert len(loop.review(fresh, NOW + timedelta(days=8))) == 1  # lock lifted, and that feedback now counts
    assert [r["version"] for r in params.rows(fresh, "order_dip_p_threshold")] == [1, 2]


def test_strictness_stops_at_both_ends_of_the_ladder(fresh):
    t = NOW
    for _ in range(8):
        fb(fresh, "false_alarm", at=t)
        loop.review(fresh, t)
        t += timedelta(days=8)
    assert params.get(fresh, "order_dip_p_threshold") == 0.001
    for bad in (0.0005, 0.07, 0.01 / 3):
        with pytest.raises(ValueError):
            params.set_(fresh, "order_dip_p_threshold", bad, "out of bounds", t)
    with pytest.raises(ValueError):
        params.set_(fresh, "message_variant", "fr", "not a pre-approved template", t)


def send(db, variant, replied, n, at):
    for _ in range(n):
        loop.record(db, "send", "s", "customer_replied" if replied else "customer_silent", {"variant": variant}, at)


def test_message_language_switches_only_with_enough_sends_and_a_clear_lead(fresh):
    send(fresh, "en", True, 4, NOW), send(fresh, "en", False, 16, NOW)  # 20 sends, 20 percent
    send(fresh, "hi_latn", True, 3, NOW), send(fresh, "hi_latn", False, 12, NOW)  # 15 sends, 20 percent
    assert loop.review(fresh, NOW) == []  # too few Hinglish sends
    send(fresh, "hi_latn", False, 5, NOW)  # 20 sends, 15 percent
    assert loop.review(fresh, NOW) == []  # Hinglish is behind
    send(fresh, "hi_latn", True, 10, NOW)  # 30 sends, 43 percent
    [c] = loop.review(fresh, NOW)
    assert (c.key, c.before, c.after) == ("message_variant", "en", "hi_latn") and "replies" in c.reason


def test_a_one_point_lead_does_not_flip_the_language(fresh):
    send(fresh, "en", True, 10, NOW), send(fresh, "en", False, 20, NOW)
    send(fresh, "hi_latn", True, 11, NOW), send(fresh, "hi_latn", False, 22, NOW)  # 33.3 against 33.3
    assert loop.review(fresh, NOW) == []


def test_learned_language_is_used_for_customers_whose_own_language_is_unknown(fresh):
    from app.act import messages
    pid = fresh.execute("SELECT p.id FROM payments p JOIN customers c ON c.id = p.customer_id WHERE c.language_pref IS NULL OR c.language_pref NOT IN ('en', 'hi_latn') LIMIT 1").fetchone()
    if pid is None:
        fresh.execute("UPDATE customers SET language_pref = 'unknown' WHERE id = (SELECT customer_id FROM payments LIMIT 1)")
        pid = fresh.execute("SELECT p.id FROM payments p JOIN customers c ON c.id = p.customer_id WHERE c.language_pref = 'unknown' LIMIT 1").fetchone()
    assert messages.slots_for(fresh, pid[0])["_lang"] == "en"
    params.set_(fresh, "message_variant", "hi_latn", "test", NOW)
    assert messages.slots_for(fresh, pid[0])["_lang"] == "hi_latn"


def test_weekly_card_says_what_changed_in_plain_words(fresh):
    assert loop.weekly(fresh, NOW).lines == ["Nothing changed this week."]
    fb(fresh, "false_alarm")
    loop.review(fresh, NOW)
    card = loop.weekly(fresh, NOW)
    text = " ".join(card.lines)
    assert "order-dip alert stricter" in text and "1 in 200" in text and "1 in 100" in text and "1 order-dip alert was marked false" in text
    assert card.changes[0].before == 0.01 and card.changes[0].after == 0.005
    assert loop.weekly(fresh, NOW + timedelta(days=9)).lines == ["Nothing changed this week."]  # a week later the change is history, and still in the version list
    assert [p.version for p in loop.all_params(fresh, NOW) if p.key == "order_dip_p_threshold"] == [1]


def test_a_stricter_threshold_changes_what_the_dip_monitor_raises(world):
    from app.zone1 import volume
    orders = Orders(world, ewma=True)
    now = clock.now()
    loose, strict = volume.find(orders, now, 0.05), volume.find(orders, now, 0.001)
    assert len(strict) <= len(volume.find(orders, now, 0.01)) <= len(loose)


def test_weekly_rhythm_baseline_waits_for_three_weeks_so_the_14_day_world_is_unchanged(world):
    a, b = Orders(world), Orders(world, ewma=True)
    h = a.rows[-1]["t"].replace(minute=0, second=0, microsecond=0)
    assert a.expected_hour(h) == b.expected_hour(h)


@pytest.fixture
def api(world_file):
    from app.main import app
    return TestClient(app)


def test_api_feedback_then_review_moves_the_setting_and_writes_the_audit_log(api):
    assert api.get("/api/learning/weekly").json()["lines"] == ["Nothing changed this week."]
    r = api.post("/api/feedback", json={"subject_type": "incident", "subject_id": "INC-4", "kind": "false_alarm"})
    assert r.status_code == 200 and r.json()["detail"].startswith("fb_")
    card = api.post("/api/learning/run").json()
    assert {c["key"] for c in card["changes"]} == {"order_dip_p_threshold", "complaint_spike_p_threshold"}
    assert api.post("/api/learning/run").json()["changes"] == card["changes"]  # pressing again changes nothing more
    cur = {p["key"]: p["value"] for p in api.get("/api/learning/params").json() if p["version"] == 1}
    assert cur == {"order_dip_p_threshold": 0.005, "complaint_spike_p_threshold": 0.005}
    audit = [a["summary"] for a in api.get("/api/audit").json()]
    assert any("Feedback: false alarm" in s for s in audit) and sum("Changed " in s for s in audit) == 2


def test_api_refuses_feedback_about_an_incident_that_does_not_exist(api):
    assert api.post("/api/feedback", json={"subject_type": "incident", "subject_id": "INC-99", "kind": "false_alarm"}).status_code == 422
