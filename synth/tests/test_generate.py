import sqlite3

from synth.generate import generate


def dump(path):
    return "\n".join(sqlite3.connect(path).iterdump())


def test_deterministic(tmp_path):
    generate(tmp_path / "a")
    generate(tmp_path / "b")
    assert dump(tmp_path / "a" / "world.db") == dump(tmp_path / "b" / "world.db")
    assert dump(tmp_path / "a" / "truth.db") == dump(tmp_path / "b" / "truth.db")


def test_seeded_rows_and_truth_tables(tmp_path):
    generate(tmp_path)
    w = sqlite3.connect(tmp_path / "world.db")
    assert w.execute("select count(*) from plans").fetchone()[0] == 4
    t = sqlite3.connect(tmp_path / "truth.db")
    names = {r[0] for r in t.execute("select name from sqlite_master where type='table'")}
    assert {"truth_payments", "truth_complaints", "truth_incidents", "truth_threads", "truth_zone1", "truth_recovery"} <= names


def test_incident_is_computed_not_typed(tmp_path):
    from synth.generate import CFG

    counts = generate(tmp_path)
    assert counts["affected"] > 20 and counts["hidden_2xx"] == CFG["inc1"]["hidden_ack_then_fail"]["count"]
    assert counts["fixed_by_hand"] == CFG["inc1"]["forced_early_complaints"] and counts["refunded"] == CFG["inc1"]["refunded_complainers"]
    w = sqlite3.connect(tmp_path / "world.db")
    # every captured order payment sends two events, as seen on real Razorpay
    assert w.execute("select count(*) from webhook_events where event_type='order.paid'").fetchone()[0] == w.execute(
        "select count(*) from webhook_events where event_type='payment.captured' and subscription_id is null").fetchone()[0]
    # the first retry offsets match what was measured on real Razorpay test mode
    assert CFG["webhooks"]["retry_offsets_seconds"][:6] == [0, 9, 24, 45, 88, 169]
