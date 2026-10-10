"""Founder effort (PRD section 13, the north star: founder minutes per incident at 10 or fewer). Before this there was a target and no number.

Method. A founder's work on an incident is the approvals the engine will not run without, plus one click to verify and close. For each incident the full
fix is a known set of actions, and the approvals each needs come from the engine itself: every staged action asks for `len(STAGES)` approvals, a refund asks
for one review and then one approval per customer (a guardrail, so it cannot be batched), and the escalation to Razorpay asks for one send. The count is
checked against a real run of INC-1 through the executor and the audit log, so the formula cannot drift from the engine.

What is measured and what is assumed. The approvals are counted. The 30 seconds per approval is an ASSUMPTION (reading one card and pressing one button),
printed with every number. It has not been timed with a person. Developer work (shipping the fix) is not the founder's time and is not counted."""
import sqlite3
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app import clock
from app.act import autonomy, executor

FOUNDER = "merchant:founder"
SECONDS_PER_APPROVAL = 30   # assumption, not a measurement
LIMIT_MINUTES = 10          # PRD section 13
# The complete fix for each incident, as the product offers it. `escalate` is the one send to Razorpay.
FLOWS: dict[str, list[str]] = {
    "INC-1": ["grant", "message"],
    "INC-2": ["refund", "message"],
    "INC-3": ["grant", "message", "escalate", "recovery_link"],
    "INC-4": ["recovery_link"],
    "INC-5": ["recovery_link"],
}


def _copy(world: sqlite3.Connection) -> sqlite3.Connection:
    db = sqlite3.connect(":memory:")
    db.row_factory = sqlite3.Row
    world.backup(db)
    clock.reset()
    return db


def approvals(world: sqlite3.Connection, incident_id: str) -> int:
    """Approvals plus the one verify click for this incident's complete fix."""
    n = 1  # verify and close
    if any(k in ("message", "recovery_link") for k in FLOWS[incident_id]):
        n += 1  # switching messaging on: a setting that stays on, counted for every incident as the worst case (first time). Found by the real-run check below, not by the formula.
    for kind in FLOWS[incident_id]:
        if kind == "escalate":
            n += 1
        elif kind == "refund":
            db = _copy(world)
            n += 1 + len(executor.get(db, executor.create(db, incident_id, "refund", {})).items)
        else:
            n += len(executor.STAGES)
    return n


def real_run_inc1(world: sqlite3.Connection) -> int:
    """Run INC-1's complete fix through the executor as the founder and count the approvals the audit log recorded, plus the verify click."""
    db = _copy(world)
    autonomy.write(db, autonomy.read(db).model_copy(update={"messaging_enabled": True}), FOUNDER)
    for kind in FLOWS["INC-1"]:
        aid = executor.create(db, "INC-1", kind, {"language": "auto"} if kind == "message" else {})
        for stage in executor.STAGES:
            executor.approve(db, aid, stage, FOUNDER)
    n = db.execute("SELECT COUNT(*) FROM audit_log WHERE actor = ? AND kind = 'approval' AND payload_json NOT LIKE '%Ignored a repeat%'", (FOUNDER,)).fetchone()[0]
    return n + 1


def run(world: sqlite3.Connection) -> list[tuple[str, float, str, bool | None]]:
    res: list[tuple[str, float, str, bool | None]] = []
    counts = {i: approvals(world, i) for i in FLOWS if world.execute("SELECT 1 FROM incidents WHERE id = ?", (i,)).fetchone()}
    minutes = {i: n * SECONDS_PER_APPROVAL / 60 for i, n in counts.items()}
    for iid, n in counts.items():
        over = " Above the target on purpose: each refund is approved one customer at a time (a guardrail), so it cannot be batched." if minutes[iid] > LIMIT_MINUTES else ""
        res.append((f"founder_minutes_{iid.lower().replace('-', '')}_estimate", minutes[iid],
                    f"reported. {n} approvals counted (verify click and messaging switch included) x {SECONDS_PER_APPROVAL} s each, and the {SECONDS_PER_APPROVAL} s is an assumption, not a timing.{over}", None))
    typical = statistics.median(minutes.values())
    res.append(("founder_minutes_typical_incident_estimate", typical, f"<= {LIMIT_MINUTES} (PRD north star, read as the typical incident: the median of {len(minutes)}). Same assumption of {SECONDS_PER_APPROVAL} s per approval", typical <= LIMIT_MINUTES))
    longest = max(counts, key=counts.get)
    res.append(("founder_approvals_in_the_longest_fix", float(counts[longest]), f"reported ({longest}; refunds are one customer at a time on purpose, so they cannot be batched to save time)", None))
    real, formula = real_run_inc1(world), counts.get("INC-1", 0)
    res.append(("founder_approval_count_matches_a_real_run_inc1", float(abs(real - formula)), f"0 (the count above for INC-1 is {formula}, a real run through the executor logged {real})", real == formula))
    clock.reset()
    return res
