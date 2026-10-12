"""Where rules fail (v3 roadmap A1, PRD v3 section 13, Track 2's "why AI beats a rule"). A set of made-up complaints, each written the way real ones arrive: Hinglish,
typos, forwarded text, no payment ID, two issues in one message. Each is labelled by what the customer means. The rules that read complaints today
(`app.ingest.extract`) are scored against the labels. These are reported, not gated: the point is to show where the rules stop, which is where a model goes in production.
The labels are by meaning. After an independent review, one message was reworded and two were removed because their label could be read two ways, and three typo messages
were added; the first typo set misspelled the very keyword a rule needs, which is a worst case and not a typical typo. The history is in git from that point and in docs/BUILD_LOG.md."""
import json
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.ingest.extract import extract
from app.ingest.redact import redact

TAGS = ("clean", "hinglish", "typo", "forwarded", "two_issues")  # "no_id" is in the data but not scored by tag: almost every message lacks an ID, so it would measure nothing
MISS_ORDER = ("hinglish", "typo", "two_issues")  # the kinds of miss to show, in this order, so the three shown are three different kinds


def run() -> list[tuple[str, float | None, str, bool | None]]:
    data = json.loads((ROOT / "eval" / "messy_complaints.json").read_text())["messages"]
    now = datetime.fromisoformat("2026-10-02T10:40:00")  # the demo world's "now"
    rows = []
    for d in data:
        e = extract(redact(d["text"]), now)
        want = d["expect"]
        found_main = (not e.is_payment_related) if not want["related"] else (e.is_payment_related and e.claim in want["claims"])
        rows.append({"d": d, "e": e, "ok": found_main, "both": len(want["claims"]) < 2,  # one reading is all the rules give, so two issues in one message are never both found
                     "amount_ok": None if want["amount_rupees"] is None else e.amount_paise == want["amount_rupees"] * 100,
                     "id_ok": None if not want["payment_id"] else bool(e.ids.payment_id)})
    n = len(rows)
    out: list[tuple[str, float | None, str, bool | None]] = []
    rate = lambda xs: (sum(xs) / len(xs)) if xs else None
    note = f"report only. {n} made-up complaints, labelled by meaning"
    out.append(("messy_complaints_total", float(n), "report (made-up complaints, see eval/messy_complaints.json)", None))
    out.append(("messy_main_claim_found", rate([r["ok"] for r in rows]), f"{note}. What the rules read right as the main issue", None))
    for t in TAGS:
        rs = [r for r in rows if t in r["d"]["tags"]]
        out.append((f"messy_main_claim_found_{t}", rate([r["ok"] for r in rs]), f"{note}. Only the {len(rs)} tagged {t}", None))
    two = [r for r in rows if "two_issues" in r["d"]["tags"]]
    # Both found means the reading the rules return holds every issue the customer raised. The extractor returns one claim, so it can hold two only if they are the same.
    out.append(("messy_both_issues_found", rate([set(r["d"]["expect"]["claims"]) <= {r["e"].claim} for r in two]), f"{note}. Both issues of {len(two)} two-in-one messages. The rules return one reading", None))
    with_amount = [r for r in rows if r["amount_ok"] is not None]
    with_id = [r for r in rows if r["id_ok"] is not None]
    out.append(("messy_payment_id_found", rate([r["id_ok"] for r in with_id]), f"{note}. A payment ID written in the message, of the {len(with_id)} that have one", None))
    out.append(("messy_amount_found", rate([r["amount_ok"] for r in with_amount]), f"{note}. The amount the customer wrote, of the {len(with_amount)} that give one", None))
    unrelated = [r for r in rows if not r["d"]["expect"]["related"]]
    out.append(("messy_unrelated_flagged_as_payment", float(sum(r["e"].is_payment_related for r in unrelated)), f"{note}. Of {len(unrelated)} messages that are not about a payment", None))
    # Three real misses, one kind each where there are enough kinds: what was written, what the rules read, what it meant.
    misses: list[dict] = []
    for tag in MISS_ORDER:
        for r in rows:
            # a two-in-one message is a miss whenever only one of its issues is read, which is always: the rules return one reading
            if tag in r["d"]["tags"] and (not r["ok"] or tag == "two_issues") and r not in misses:
                misses.append(r)
                break
        if len(misses) == 3:
            break
    for i, r in enumerate(misses, 1):
        said = " ".join(r["d"]["text"].split())
        said = said if len(said) <= 110 else said[:107] + "..."
        read = r["e"].claim if r["e"].is_payment_related else "not about a payment"
        kind = next(t for t in MISS_ORDER if t in r["d"]["tags"])
        out.append((f"messy_miss_{i}", None, f'"{said}" | rules read: {read.replace("_", " ")} | it means: {" and ".join(c.replace("_", " ") for c in r["d"]["expect"]["claims"])} | kind: {kind}', None))
    return out
