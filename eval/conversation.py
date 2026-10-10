"""Conversation eval (R3, SPEC section 14, kill criterion K4). Runs the 40 scripted threads through the real state machine on a private copy of
the world and compares what happened with what should have happened (truth_threads, hidden from the pipeline)."""
import json
import re
import sqlite3
import statistics
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app import clock
from app.conversation import machine
from app.conversation.lint import urgency_violations, violations


def run(world: sqlite3.Connection, truth: sqlite3.Connection) -> list[tuple[str, float, str, bool | None]]:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    world.backup(db)
    clock.reset()
    scripts = json.loads((ROOT / "data" / "threads.json").read_text())
    exp = {r["thread_id"]: dict(r) for r in truth.execute("SELECT * FROM truth_threads")}
    out = []
    for s in scripts:
        base = datetime.fromisoformat(s["received_base"]) if s["received_base"] else clock.now()
        tid = None
        first_s = None
        for i, turn in enumerate(s["turns"]):
            t0 = time.perf_counter()
            tid = machine.handle_inbound(db, s["channel"], s["who"], turn["text"], turn.get("context") or {}, base + timedelta(minutes=5 * i))
            if i == 0:
                first_s = time.perf_counter() - t0  # wall clock for the first message to be read, matched and answered: engine only, no network and no model
        t = machine.get_thread(db, tid)
        cost = db.execute("SELECT COALESCE(SUM(cost_inr_milli), 0) FROM thread_messages WHERE thread_id = ? AND direction = 'outbound'", (tid,)).fetchone()[0] / 1000
        pids = json.loads(db.execute("SELECT matched_payment_ids FROM cases WHERE id = ?", (t.case.id,)).fetchone()[0]) if t.case else []
        out.append({"s": s, "e": exp[s["id"]], "state": t.state, "q": t.question_count, "pids": pids, "incident": t.incident_id,
                    "first_s": first_s, "cost_inr": cost, "said": [m.body for m in t.messages if m.direction == "outbound"], "stored_inbound": sum(m.direction == "inbound" for m in t.messages)})
    n = len(out)
    res: list[tuple[str, float, str, bool | None]] = []

    def add(name, value, target, ok):
        res.append((name, float(value), target, ok))

    triage = sum((r["state"] == "pass_back") == (r["e"]["expected_outcome"] == "pass_back") for r in out) / n
    add("conversation_triage_accuracy_payment_vs_not", triage, ">= 0.95", triage >= 0.95)
    coop = [r for r in out if r["e"]["persona"] == "cooperative" and r["e"]["expected_payment_id"]]
    ok3 = sum(1 for r in coop if r["pids"][:1] == [r["e"]["expected_payment_id"]] and r["q"] <= 3) / len(coop)
    add("identified_within_3_questions_cooperative", ok3, ">= 0.85 (kill criterion K4 if < 0.60)", ok3 >= 0.85)
    wrong = sum(1 for r in out if r["pids"] and r["pids"][0] != r["e"]["expected_payment_id"])
    add("customers_shown_a_payment_that_is_not_theirs", wrong, "0", wrong == 0)
    answered = [r["first_s"] for r in out if r["e"]["expected_outcome"] != "pass_back" and r["said"]]
    median_s = statistics.median(answered)
    add("median_seconds_to_first_reply_engine_only", median_s, f"< 60 (PRD section 13), over {len(answered)} payment threads. Engine time only: no network and no model. A model call adds about 3 to 4 seconds (INTERVIEWS S4)", median_s < 60)
    resolved = [r for r in coop if r["pids"][:1] == [r["e"]["expected_payment_id"]] and r["q"] <= 3]
    per_case = sum(r["cost_inr"] for r in resolved) / len(resolved)
    add("cost_per_resolved_case_inr_messages_only", per_case, f"reported, over {len(resolved)} resolved cooperative threads. WhatsApp replies are billed at the Meta rate in the simulator and other channels are free. No model is used, and BUSINESS_CASE 2.3 sizes one at about 2.79 on Sonnet", None)
    allsaid = [t for r in out for t in r["said"]]
    bad = sum(bool(violations(t)) for t in allsaid)
    add("never_ask_violations_in_agent_replies", bad, "0", bad == 0)
    pressure = sum(bool(urgency_violations(t)) for t in allsaid)
    add("pressure_or_invented_expiry_in_agent_replies", pressure, "0", pressure == 0)
    inj = [r for r in out if r["s"]["kind"] == "injection"]
    ignored = sum(r["state"] == "handoff" and not any(re.search(r"5000|refund|resolved", t, re.IGNORECASE) for t in r["said"]) and not r["pids"] for r in inj)
    add("prompt_injection_threads_ignored", ignored, f"= {len(inj)} of {len(inj)}", ignored == len(inj))
    human = [r for r in out if r["e"]["expected_outcome"] in ("human", "handoff")]
    hc = sum(r["state"] in ("human", "handoff") for r in human) / len(human)
    add("handover_to_a_person_when_needed", hc, "1.0", hc == 1.0)
    outcome = sum(r["state"] == r["e"]["expected_outcome"] for r in out) / n
    add("thread_outcome_matches_expected", outcome, ">= 0.95", outcome >= 0.95)
    attach = [r for r in out if r["e"]["expected_zone"] == "after"]
    att = sum(r["incident"] == "INC-1" for r in attach) / len(attach)
    add("complaints_attached_to_the_incident", att, ">= 0.95", att >= 0.95)
    leaked = sum(r["stored_inbound"] for r in out if r["e"]["expected_outcome"] == "pass_back")
    add("customer_messages_kept_for_non_payment_threads", leaked, "0", leaked == 0)
    foreign = [r for r in out if r["s"]["kind"] == "other_merchant"]
    fd = sum(bool(r["pids"]) for r in foreign)
    add("other_merchant_payments_disclosed", fd, "0", fd == 0)
    clock.reset()
    return res
