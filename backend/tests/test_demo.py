"""The guided demo is a replay of the real engine. These tests check that the recording is complete, consistent and honest."""
import json
import shutil
from pathlib import Path

import pytest

from scripts.demo_script import record


@pytest.fixture(scope="module")
def demo(world, tmp_path_factory):
    import sqlite3

    path = tmp_path_factory.mktemp("demo") / "world.db"
    dst = sqlite3.connect(path)
    world.backup(dst)
    dst.close()
    src = Path(world.execute("PRAGMA database_list").fetchone()[2]).parent / "handover_scripts.json"
    shutil.copy(src, path.parent / "handover_scripts.json")
    return record(path)


def test_the_fix_frames_walk_through_every_stage(demo):
    g = demo["fix"]["grant"]
    assert [(k, v["data"]["status"], v["data"]["next_stage"]) for k, v in g.items()] == [
        ("drafted", "drafted", "dry_run"), ("dry_run", "approved", "first_5"), ("first_5", "approved", "rest"), ("rest", "done", None)]
    assert g["first_5"]["data"]["item_counts"] == {"verified": 5, "pending": 76} and g["rest"]["data"]["item_counts"] == {"verified": 81}
    assert len(g["drafted"]["data"]["items"]) == 81


def test_verify_says_what_is_missing_until_the_webhook_has_been_healthy_for_24_hours(demo):
    f = demo["fix"]
    assert [f[k]["data"]["closeable"] for k in ("verify_none", "verify_401", "verify_notyet", "verify_closed")] == [False, False, False, True]
    assert "still answers 401" in f["verify_401"]["data"]["line"] and "0.0 of 24 hours" in f["verify_notyet"]["data"]["line"]
    assert f["hook_broken"]["data"]["webhook_mode"] == "401" and f["hook_ok24"]["data"]["signal_healthy"] is True


def test_messages_come_in_every_language_blocked_until_messaging_is_on(demo):
    m = demo["fix"]["messages"]
    for lang in ("auto", "en", "hi_latn"):
        assert "Messaging is switched off" in m["blocked"][lang]["data"]["blocked_reason"] and m["ready"][lang]["data"]["blocked_reason"] is None
        assert sum(p["recipients"] for p in m["previews"][lang]) == 81
    assert {p["language"] for p in m["previews"]["hi_latn"]} == {"hi_latn"} and {p["language"] for p in m["previews"]["en"]} == {"en"}
    assert m["stages"]["rest"]["data"]["status"] == "done"


def test_undo_frames_exist_for_both_points(demo):
    assert demo["fix"]["revert_first_5"]["data"]["status"] == "reverted" and demo["fix"]["revert_rest"]["data"]["status"] == "reverted"
    assert demo["fix"]["incident_closed"]["status"] == "closed"


def test_every_frame_carries_the_audit_rows_it_added(demo):
    ids = [e["id"] for k in ("grant",) for v in demo["fix"][k].values() for e in v["audit"]]
    assert ids == sorted(ids) and len(ids) >= 4
    assert any("Approved rest" in e["summary"] for v in demo["fix"]["grant"].values() for e in v["audit"])


def test_conversations_show_each_outcome_the_agent_can_reach(demo):
    c = demo["chat"]
    assert [s["step"]["thread"]["state"] for s in c["whatsapp"]["steps"]] == ["identify", "wait_for_fix"]
    assert c["whatsapp"]["steps"][1]["step"]["drafted_reply"] and c["whatsapp"]["approve"]["messages"][-1]["policy"]["status"] == "sent"
    assert c["injection"]["steps"][0]["step"]["thread"]["state"] == "handoff" and c["unrelated"]["steps"][0]["step"]["thread"]["state"] == "pass_back"
    assert c["help"]["steps"][0]["step"]["thread"]["incident_id"] == "INC-1" and c["help"]["payment_id"].startswith("pay_")
    assert c["email"]["steps"][0]["step"]["thread"]["channel"] == "email"


def test_the_recording_holds_no_raw_customer_handle(demo):
    text = json.dumps(demo)
    assert "9800012345" not in text and "asha.demo@example.test" not in text.replace("customer_ref", "")


def test_instagram_and_public_post_scenarios_are_recorded(demo):
    c = demo["chat"]
    ig = c["ig_payment"]["steps"]
    assert [x["step"]["thread"]["state"] for x in ig] == ["identify", "wait_for_fix"] and any(m["policy"].get("kind") == "pass" for m in ig[0]["step"]["thread"]["messages"])
    assert c["ig_not_payment"]["steps"][0]["step"]["thread"]["state"] == "pass_back" and c["ig_threat"]["steps"][0]["step"]["thread"]["state"] == "handoff"
    pubs = {k: v for k, v in c.items() if k.startswith("pub_")}
    assert len(pubs) == 12 and sum(1 for v in pubs.values() if v["label"] == "real_public_post") == 3
    first = pubs["pub_p01"]
    assert first["steps"][0]["step"]["drafted_reply"] and first["approve"]["messages"][-1]["policy"]["status"] == "sent" and first["follow_up"]["public_after"]["state"] == "closed"
    assert all(not v["steps"][0]["step"]["drafted_reply"] for v in pubs.values() if v["label"] == "real_public_post")
