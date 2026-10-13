import json
import re
from datetime import datetime

from synth.brand_world import OUT, PAGES, PAYMENT_SERVICES, world
from synth.j2_brand import AFFECTED, NO_ORDER, PAID_TWICE, generate


def test_counts_are_the_prds():
    d = generate()
    c = d["counts"]
    assert (c["affected"], c["paid_twice"], c["no_order"]) == (1240, 410, 830)
    assert (AFFECTED, PAID_TWICE, NO_ORDER) == (1240, 410, 830)
    assert len(d["customers"]) == 1240
    assert sum(1 for x in d["customers"] if x["outcome"] == "paid_twice") == 410
    assert sum(1 for x in d["customers"] if x["outcome"] == "no_order") == 830
    assert c["sentry_events"] == 40 == sum(m["events"] for m in d["sentry"]["per_minute"])


def test_money_adds_up_from_the_payments():
    d = generate()
    rows = d["customers"]
    m = d["money_paise"]
    assert m["stuck"] == sum(x["amount_paise"] for x in rows) == m["paid_twice"] + m["no_order"]
    assert m["paid_twice"] == sum(x["amount_paise"] for x in rows if x["outcome"] == "paid_twice")


def test_every_payment_is_after_the_rollout_and_by_the_rca():
    d = generate()
    t = {k: datetime.fromisoformat(v) for k, v in d["timeline"].items()}
    assert t["rollout"] < t["verify_stops"] < t["errors_start"] < t["alert"] < t["rca"] < t["signoff"] < t["rollback"]
    times = [datetime.fromisoformat(x["at"]) for x in d["customers"]]
    assert times == sorted(times) and times[0] >= t["rollout"] and times[-1] < t["rca"]
    assert len({x["payment_id"] for x in d["customers"]}) == 1240  # no payment id twice
    assert all(x["outcome"] != "paid_twice" or datetime.fromisoformat(x["second_at"]) > datetime.fromisoformat(x["at"]) for x in d["customers"])
    # the RCA states 1,240 and 410 at its own time, so nothing it counts may come after it: not a first payment and not a second one
    assert all(datetime.fromisoformat(x.get("second_at", x["at"])) < t["rca"] for x in d["customers"])


def test_the_pattern_is_the_app_and_not_the_bank_or_the_region():
    lift = {(r["dimension"], r["value"]): r for r in generate()["lift"]}
    assert lift["app_version", "8.2"]["share_affected"] == 1.0 and lift["app_version", "8.2"]["share_baseline"] == 0.0
    assert lift["method", "upi"]["share_affected"] - lift["method", "upi"]["share_baseline"] > 0.3
    for (dim, _), r in lift.items():
        if dim in ("bank", "upi_app", "region"):  # spread like everyone else's: no bank, UPI app or region stands out
            assert abs(r["share_affected"] - r["share_baseline"]) < 0.06, (dim, r)


def test_same_seed_same_files_and_the_committed_files_are_current():
    assert generate() == generate() and world() == world()
    w = world()
    assert json.loads((OUT / "incidents.json").read_text()) == w["incidents"], "web/public/brand is stale: run `uv run python -m synth.brand_world`"
    assert json.loads((OUT / "alerts.json").read_text()) == w["alerts"]
    for name in PAGES:
        assert json.loads((OUT / f"{name}.json").read_text()) == w[name], f"{name}.json is stale: run `uv run python -m synth.brand_world`"
    for id_, d in w["details"].items():
        assert json.loads((OUT / "incidents" / f"{id_}.json").read_text()) == d, f"{id_} is stale: run `uv run python -m synth.brand_world`"


def test_the_brand_list_reads_like_the_engine_and_adds_up():
    w = world()
    for s in w["incidents"]:
        d = w["details"][s["id"]]
        assert s["affected"] == sum(g["count"] for g in d["groups"]) == len(d["customers"])
        assert s["mismatch_type"] in {"A", "B", "E", "F", "G", "Z1"} and s["owner"] in {"merchant_code", "razorpay", "bank"}
        assert s["status"] == "closed" or s["at_risk_paise"] == d["money_stuck_paise"] > 0
    # every alert that became an issue points at one that exists
    assert all(a["issue"] in w["details"] for a in w["alerts"] if a["status"] == "matched")


def test_the_payment_filter_decides_what_is_dropped_and_the_pages_agree():
    w = world()
    al = w["alerts"]
    assert [a["at"] for a in al] == sorted((a["at"] for a in al), reverse=True)  # newest first
    assert len({a["id"] for a in al}) == len(al)
    for a in al:
        payment = a["service"] in PAYMENT_SERVICES or a["tool"] == "Razorpay"
        assert (a["status"] == "dropped") == (not payment), a  # dropped exactly when the service is not a payment service
        assert (a["issue"] is not None) == (a["status"] == "matched"), a
    rows = {r["label"]: r for s in w["integration"]["sections"] for r in s["rows"]}
    assert rows["Counted as payments"]["list"] == PAYMENT_SERVICES
    left = next(r for label, r in rows.items() if label.startswith("Left out"))
    assert left["list"] == sorted({a["service"] for a in al if a["status"] == "dropped"})


def test_connectors_count_the_alerts_each_tool_sent():
    w = world()
    for g in w["connectors"]["groups"]:
        for c in g["items"]:
            if c["kind"] in ("alert", "razorpay"):
                tool = "Razorpay" if c["kind"] == "razorpay" else c["name"]
                assert int(c["count"].split()[0]) == sum(1 for a in w["alerts"] if a["tool"] == tool), c


def test_the_audit_trail_is_newest_first_and_points_at_real_issues():
    w = world()
    ev = w["audit"]["events"]
    assert [e["at"] for e in ev] == sorted((e["at"] for e in ev), reverse=True)
    assert all(e["kind"] in w["audit"]["kinds"] for e in ev)
    assert all(e["ref"] is None or e["ref"] in w["details"] for e in ev)
    assert sum(1 for e in ev if e["kind"] == "alert") == len(w["alerts"])  # every alert is in the trail
    # the approvals a judge can make in the tab are the open issues' actions (FK-1, then FK-4 to FK-7), none of them done in the data
    open_actions = [(d["id"], a["id"]) for d in w["details"].values() if d["status"] == "open" for a in d["actions"] if not a.get("done")]
    assert [(p["issue"], p["action"]) for p in w["audit"]["pending"]] == open_actions
    assert {i for i, _ in open_actions} == {"FK-1", "FK-4", "FK-5", "FK-6", "FK-7"}


def test_no_page_shows_anything_that_looks_like_a_secret():
    w = world()
    text = json.dumps([w[p] for p in PAGES], ensure_ascii=False)
    assert not re.search(r"rzp_(live|test)_|whsec_|sk_live|sk_test|[A-Za-z0-9+/]{32,}", text)
    assert "The signing secret is shown once, when you create it." in text
