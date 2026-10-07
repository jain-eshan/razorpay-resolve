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


def test_forty_scripted_threads_with_truth_that_the_scripts_do_not_contain(tmp_path):
    import json

    assert generate(tmp_path)["threads"] == 40
    scripts = json.loads((tmp_path / "threads.json").read_text())
    assert len(scripts) == 40 and len({s["who"] for s in scripts}) == 40
    t = sqlite3.connect(tmp_path / "truth.db")
    assert t.execute("select count(*) from truth_threads where thread_id like 't%'").fetchone()[0] == 40
    outcomes = dict(t.execute("select expected_outcome, count(*) from truth_threads where thread_id like 't%' group by 1").fetchall())
    assert outcomes == {"wait_for_fix": 26, "explain": 3, "human": 6, "pass_back": 2, "handoff": 3}
    assert not any("expected" in s or "payment_id" in json.dumps(s["turns"]) for s in scripts if s["kind"] not in ("healthy_payment", "key_at_once"))


def test_handover_scripts_are_seven_messages_and_twelve_public_posts_with_answers_only_in_truth(tmp_path):
    import json

    assert generate(tmp_path)["handover_scripts"] == 19
    d = json.loads((tmp_path / "handover_scripts.json").read_text())
    assert len(d["messaging"]) == 7 and len(d["public"]) == 12
    assert [p["label"] for p in d["public"]].count("real_public_post") == 3 and all(p["url"] for p in d["public"] if p["label"] == "real_public_post")
    assert sum(1 for p in d["public"] if "UPI ref" in p["text"] or "Ref " in p["text"]) == 6  # six carry a payment reference
    assert not any("expected" in json.dumps(x) for x in d["messaging"] + d["public"])
    t = sqlite3.connect(tmp_path / "truth.db")
    out = dict(t.execute("select expected_outcome, count(*) from truth_threads where thread_id like 'h%' or thread_id like 'p%' group by 1").fetchall())
    assert out["public_reply"] == 8 and out["public_flagged"] == 1 and out["public_observed"] == 3 and out["stayed"] == 2
