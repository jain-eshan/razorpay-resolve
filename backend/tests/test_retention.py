"""F-54: "Kept for 30 days" is enforced. A finished conversation loses its transcript and the real identifiers behind its tokens, and nothing else moves."""
import sqlite3
from datetime import timedelta

from app import clock, pipeline
from app.config import BS_NOW
from app.conversation import machine as m
from app.conversation import retention
from app.conversation.retention import GONE


def victim(db):
    return db.execute("""SELECT p.id, p.rrn FROM incident_members im JOIN payments p ON p.id = im.payment_id
                         WHERE im.incident_id = 'INC-1' AND im.tier = 'exact' AND im.complained = 0 AND p.rrn IS NOT NULL ORDER BY p.captured_at LIMIT 1""").fetchone()


def finished_thread(db, close_incident=True):
    """A customer quotes a UPI reference, is told, and the founder sends the reply. Returns the thread id and the complaint id."""
    v = victim(db)
    tid = m.handle_inbound(db, "help_button", "+919800000001", f"payment ho gaya par access nahi mila, UPI ref {v['rrn']}", {"payment_id": v["id"]})
    m.reply(db, tid, None, None, "founder")
    if close_incident:
        db.execute("UPDATE incidents SET status = 'closed' WHERE id = 'INC-1'")
    return tid, m.get_thread(db, tid).case.complaint_id


def later(days):
    return BS_NOW + timedelta(days=days)


def vault(db, cid): return db.execute("SELECT COUNT(*) FROM token_vault WHERE complaint_id = ?", (cid,)).fetchone()[0]
def bodies(db, tid): return [r[0] for r in db.execute("SELECT body_redacted FROM thread_messages WHERE thread_id = ?", (tid,))]


def test_a_finished_conversation_loses_its_transcript_and_saved_identifiers_after_30_days(fresh):
    tid, cid = finished_thread(fresh)
    n_messages = len(bodies(fresh, tid))
    assert vault(fresh, cid) > 0 and GONE not in bodies(fresh, tid)
    assert retention.sweep(fresh, later(29)) == {"conversations": 0, "messages": 0, "identifiers": 0}, "nothing goes early"
    assert vault(fresh, cid) > 0
    done = retention.sweep(fresh, later(31))
    assert done["conversations"] == 1 and done["messages"] == n_messages and done["identifiers"] > 0
    assert vault(fresh, cid) == 0 and set(bodies(fresh, tid)) == {GONE}
    assert [r[0] for r in fresh.execute("SELECT json_extract(payload_json, '$.summary') FROM audit_log WHERE kind = 'policy' AND json_extract(payload_json, '$.summary') LIKE 'Removed%'")] == [
        f"Removed {n_messages} messages and {done['identifiers']} saved identifiers from 1 conversation past the retention period."]


def test_what_the_record_needs_is_kept_so_no_number_moves(fresh):
    tid, _ = finished_thread(fresh)
    before = m.get_thread(fresh, tid)
    control = sqlite3.connect(":memory:")
    control.row_factory = sqlite3.Row
    fresh.commit()
    fresh.backup(control)  # the same world, never swept
    assert retention.sweep(fresh, later(60))["conversations"] == 1
    after = m.get_thread(fresh, tid)
    assert (after.case.match_status, after.incident_id) == (before.case.match_status, before.incident_id)
    assert (before.state, after.state) == ("wait_for_fix", "resolved"), "a finished conversation cannot be continued on text that is gone"
    assert [x.template_id for x in after.messages] == [x.template_id for x in before.messages]
    assert [x.policy for x in after.messages] == [x.policy for x in before.messages]
    # the pipeline rebuilds every case from the complaint text: swept or not, it must come out the same
    def rebuilt(db):
        pipeline.run(db)
        return ([tuple(r) for r in db.execute("SELECT incident_id, payment_id, complained FROM incident_members ORDER BY incident_id, payment_id")],
                [tuple(r) for r in db.execute("SELECT complaint_id, match_status, incident_id FROM cases ORDER BY complaint_id")])
    assert rebuilt(fresh) == rebuilt(control)


def test_a_conversation_on_an_open_incident_is_kept_however_old(fresh):
    tid, cid = finished_thread(fresh, close_incident=False)
    assert retention.sweep(fresh, later(400))["conversations"] == 0
    assert vault(fresh, cid) > 0 and GONE not in bodies(fresh, tid)


def test_a_reply_waiting_for_approval_is_kept_because_approving_it_would_send_removed_text(fresh):
    v = victim(fresh)
    tid = m.handle_inbound(fresh, "help_button", "+919800000002", f"paid but no access, UPI ref {v['rrn']}", {"payment_id": v["id"]})
    fresh.execute("UPDATE incidents SET status = 'closed' WHERE id = 'INC-1'")
    assert any(x.policy.get("status") == "draft" for x in m.get_thread(fresh, tid).messages)
    assert retention.sweep(fresh, later(90))["conversations"] == 0 and GONE not in bodies(fresh, tid)


def test_the_period_is_the_one_the_founder_granted_for_that_channel(fresh):
    tid, _ = finished_thread(fresh)
    channel = fresh.execute("SELECT channel_id FROM threads WHERE id = ?", (tid,)).fetchone()[0]
    fresh.execute("UPDATE consents SET retention_days = 7 WHERE channel_id = ?", (channel,))
    assert retention.sweep(fresh, later(6))["conversations"] == 0
    assert retention.sweep(fresh, later(8))["conversations"] == 1


def test_running_it_twice_changes_nothing_the_second_time(fresh):
    finished_thread(fresh)
    retention.sweep(fresh, later(31))
    log = fresh.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
    assert retention.sweep(fresh, later(32)) == {"conversations": 0, "messages": 0, "identifiers": 0}
    assert fresh.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0] == log


def test_a_customer_who_writes_again_after_removal_starts_a_new_conversation(fresh):
    v = victim(fresh)
    tid = m.handle_inbound(fresh, "help_button", "+919800000003", "paisa kat gaya, access nahi mila", {})  # no identifier: the thread stays open, asking
    assert m.get_thread(fresh, tid).state in m.OPEN
    retention.sweep(fresh, later(31))
    assert m.get_thread(fresh, tid).state == "resolved" and set(bodies(fresh, tid)) == {GONE}
    again = m.handle_inbound(fresh, "help_button", "+919800000003", f"UPI ref {v['rrn']}", {})
    assert again != tid


def test_moving_the_demo_clock_runs_it(world_file):
    from contextlib import closing

    from app import main
    from app.db import connect
    from app.schemas import ClockAdvance

    with closing(connect()) as db:
        tid, cid = finished_thread(db)
        db.commit()
    main.advance_clock(ClockAdvance(hours=24 * 31))
    with closing(connect()) as db:
        assert vault(db, cid) == 0 and set(bodies(db, tid)) == {GONE}
    clock.reset()
