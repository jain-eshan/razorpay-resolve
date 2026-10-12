"""The "where rules fail" eval (v3 A1): the made-up messy complaints and their scorer. These tests keep the labelled set honest (valid labels, every kind present,
marked synthetic) and the scorer deterministic, so the Accuracy page's figures cannot drift without a test saying so."""
import json
import sys
from pathlib import Path
from typing import get_args

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from app.ingest.extract import Claim

from eval.messy import run

DATA = json.loads((ROOT / "eval" / "messy_complaints.json").read_text())


def test_set_is_marked_synthetic_and_every_kind_is_in_it():
    assert DATA["synthetic"] is True
    tags = {t for d in DATA["messages"] for t in d["tags"]}
    assert {"hinglish", "typo", "forwarded", "two_issues", "clean", "no_id"} <= tags
    assert len(DATA["messages"]) >= 30
    assert len({d["id"] for d in DATA["messages"]}) == len(DATA["messages"])


def test_every_label_is_a_claim_the_rules_can_return():
    for d in DATA["messages"]:
        assert set(d["expect"]["claims"]) <= set(get_args(Claim)), d["id"]
        assert (len(d["expect"]["claims"]) == 2) == ("two_issues" in d["tags"]), d["id"]
        if not d["expect"]["related"]:
            assert d["expect"]["claims"] == ["other"], d["id"]


def test_scorer_reports_the_figures_the_page_reads_and_is_deterministic():
    a, b = run(), run()
    assert a == b
    got = {name: value for name, value, _, _ in a}
    for name in ("messy_complaints_total", "messy_main_claim_found", "messy_both_issues_found", "messy_amount_found", "messy_miss_1", "messy_miss_2", "messy_miss_3"):
        assert name in got, name
    assert got["messy_complaints_total"] == len(DATA["messages"])
    assert all(0.0 <= v <= 1.0 for n, v, _, _ in a if v is not None and n.startswith("messy_main_claim") or n == "messy_amount_found")
    # Computed from what the rules return, not set: the extractor returns one claim, so two different issues can never both be in it.
    assert got["messy_both_issues_found"] == 0.0
    assert all(ok is None for _, _, _, ok in a), "reported, not gated"


def test_three_misses_are_three_different_kinds_and_each_says_what_it_meant():
    misses = [t for n, _, t, _ in run() if n.startswith("messy_miss_")]
    assert len(misses) == 3
    for t in misses:
        _said, read, means, kind = t.split(" | ")
        assert read.startswith("rules read: ") and means.startswith("it means: ") and kind.startswith("kind: ")
    assert len({m.split(" | ")[0] for m in misses}) == 3
