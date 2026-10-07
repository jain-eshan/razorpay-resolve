"""Handover eval (R5, SPEC section 14: handover correctness 100 percent). Runs the seven Instagram and Messenger customers and the twelve public posts
through the real state machine on a private copy of the world, then compares with truth_threads. Also checks Meta's window rules for who may reply."""
import json
import re
import sqlite3
import sys
from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app import clock
from app.act.executor import ActError
from app.conversation import machine

STATUS_WORDS = re.compile(r"\b(?:active|activated|captured|refund|refunded|paid|received|debited|deducted|not active|locked)\b", re.IGNORECASE)


def run(world: sqlite3.Connection, truth: sqlite3.Connection) -> list[tuple[str, float, str, bool | None]]:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    world.backup(db)
    clock.reset()
    scripts = json.loads((ROOT / "data" / "handover_scripts.json").read_text())
    exp = {r["thread_id"]: dict(r) for r in truth.execute("SELECT * FROM truth_threads")}
    names = {r["name"].split()[0] for r in db.execute("SELECT name FROM customers")}
    res: list[tuple[str, float, str, bool | None]] = []

    def add(name: str, value: float, target: str, ok: bool | None) -> None:
        res.append((name, float(value), target, ok))

    def opened(tid: str) -> list[sqlite3.Row]:
        return db.execute("SELECT * FROM handovers WHERE thread_id = ? AND to_app = 'blindspot'", (tid,)).fetchall()

    # ---- Instagram and Messenger ----
    rows = []
    for s in scripts["messaging"]:
        tid = None
        for i, turn in enumerate(s["turns"]):
            tid = machine.handle_inbound(db, s["channel"], s["who"], turn["text"], {}, clock.now() + timedelta(minutes=5 * i))
        t = machine.get_thread(db, tid)
        hos = opened(tid)
        pids = json.loads(db.execute("SELECT matched_payment_ids FROM cases WHERE id = ?", (t.case.id,)).fetchone()[0]) if t.case else []
        rows.append({"s": s, "e": exp[s["id"]], "t": t, "passed": bool(hos), "released": any(h["released_at"] for h in hos), "pids": pids,
                     "agent_said": [m for m in t.messages if m.sender_role == "agent"], "stored": sum(m.direction == "inbound" for m in t.messages)})
    right_pass = sum(r["passed"] == (r["e"]["expected_outcome"] != "stayed") for r in rows) / len(rows)
    add("handover_passed_only_for_payment_or_person", right_pass, "1.0 (the inbox keeps what is not about a payment)", right_pass == 1.0)
    right_rel = sum(r["released"] == (r["e"]["expected_outcome"] == "released") for r in rows) / len(rows)
    add("handover_released_when_over_or_a_person_is_needed", right_rel, "1.0 (and kept while a fix is awaited)", right_rel == 1.0)
    stuck = sum(1 for r in rows if r["t"].state in ("resolved", "handoff", "human", "pass_back", "explain") and opened(r["t"].id) and not r["released"])
    add("handovers_left_open_after_the_conversation_ended", stuck, "0", stuck == 0)
    spoke = sum(len(r["agent_said"]) for r in rows if r["e"]["expected_outcome"] == "stayed")
    kept = sum(r["stored"] for r in rows if r["e"]["expected_outcome"] == "stayed")
    add("replies_or_stored_messages_on_threads_that_stayed_with_the_inbox", spoke + kept, "0", spoke + kept == 0)
    ident = [r for r in rows if r["e"]["expected_payment_id"]]
    okid = sum(r["pids"][:1] == [r["e"]["expected_payment_id"]] for r in ident) / len(ident)
    add("handover_threads_matched_to_the_right_payment", okid, "1.0", okid == 1.0)

    # ---- Meta's window: the assistant stops at 24 hours, a person may continue for 7 days with the Human Agent tag ----
    tid = machine.handle_inbound(db, "ig_dm", "igsid_window", "paisa kat gaya 299 ka", {}, clock.now())
    win = []
    for hours, human, allowed in ((23, False, True), (26, False, False), (26, True, True), (24 * 7 + 1, True, False)):
        now = clock.now() + timedelta(hours=hours)
        th = db.execute("SELECT t.* FROM threads t WHERE t.id = ?", (tid,)).fetchone()
        from app.channels import policy

        d = policy.check_thread(db, th, "ig_dm", body="Hi, I am an AI. Please send the UPI ref.", template_id=None, language="en", slots=None, message_class="status_reply", approved_by="merchant:founder", now=now, human=human)
        win.append((not any("window" in r.lower() and "Waiting" not in r for r in d.reasons)) == allowed)
    add("messaging_window_rules_followed", sum(win) / len(win), "1.0 (24 h for the assistant, 7 days only for a person)", all(win))

    # ---- public posts ----
    pub, follow_ok, looked_up, cases_before = [], [], 0, db.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
    for s in scripts["public"]:
        tid = machine.handle_inbound(db, "public_mention", s["handle"], s["text"], {"label": s["label"], "external_ref": s["id"]}, clock.now(), True)
        pub.append((s, machine.get_thread(db, tid)))
    cases_after = db.execute("SELECT COUNT(*) FROM cases").fetchone()[0]
    for s, t in pub:
        e = exp[s["id"]]
        if e["expected_outcome"] == "public_reply":
            looked_up += db.execute("SELECT COUNT(*) FROM match_candidates WHERE complaint_id IN (SELECT complaint_id FROM cases WHERE id = ?)", (t.case.id if t.case else "",)).fetchone()[0]
    words = bad = 0
    for s, t in pub:
        for m in t.messages:
            if m.sender_role == "agent":
                words += 1
                bad += bool(re.search(r"\d", re.sub(r"https?://\S+", "", m.body))) or any(n in m.body for n in names) or bool(STATUS_WORDS.search(m.body))
    add("public_replies_with_a_number_a_name_or_a_status", bad, f"0 (over {words} replies)", bad == 0 and words > 0)
    add("public_posts_looked_up_or_stored_as_cases", looked_up + (cases_after - cases_before), "0 (a handle is never tied to a payment)", looked_up + cases_after - cases_before == 0)
    real = [t for s, t in pub if s["label"] == "real_public_post"]
    add("real_posts_answered", sum(1 for t in real for m in t.messages if m.sender_role == "agent"), "0", not any(m.sender_role == "agent" for t in real for m in t.messages))
    auto = sum(1 for s, t in pub for m in t.messages if m.sender_role == "agent" and m.policy.get("status") == "sent")
    add("public_replies_posted_without_the_founder", auto, "0 (every public reply is held for approval)", auto == 0)
    states = sum({"public_reply": t.state == "opened", "public_flagged": t.state == "handoff", "public_observed": t.state == "pass_back"}[exp[s["id"]]["expected_outcome"]] for s, t in pub) / len(pub)
    add("public_posts_end_in_the_expected_state", states, "1.0", states == 1.0)
    threat = [t for s, t in pub if s["kind"] == "public_threat"][0]
    add("threat_answered_in_public", sum(1 for m in threat.messages if m.sender_role == "agent"), "0", not any(m.sender_role == "agent" for m in threat.messages))

    # ---- the customer writes privately after the public reply ----
    for s, t in pub:
        f = s.get("follow_up")
        if not f:
            continue
        ptid = machine.handle_inbound(db, f["channel"], f["who"], f["text"], {"public_thread": t.id}, clock.now() + timedelta(hours=1))
        priv, pub_after = machine.get_thread(db, ptid), machine.get_thread(db, t.id)
        want = exp[f"{s['id']}_dm"]
        pids = json.loads(db.execute("SELECT matched_payment_ids FROM cases WHERE id = ?", (priv.case.id,)).fetchone()[0]) if priv.case else []
        moved = db.execute("SELECT 1 FROM handovers WHERE thread_id = ? AND from_app = 'public_mention'", (ptid,)).fetchone() is not None
        row = db.execute("SELECT handover_state FROM threads WHERE id = ?", (t.id,)).fetchone()
        follow_ok.append(pub_after.state == "closed" and row["handover_state"] == "moved_private" and moved and priv.state == want["expected_outcome"]
                         and (pids[:1] == [want["expected_payment_id"]] if want["expected_payment_id"] else not pids))
    add("public_to_private_handoff_correct", sum(follow_ok) / len(follow_ok), "1.0 (public thread closed, private one matched, move recorded)", all(follow_ok))
    clock.reset()
    return res


__all__ = ["ActError", "run"]
