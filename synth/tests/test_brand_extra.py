from datetime import datetime

from synth.brand_extra import SIGNOFF, extra_issues
from synth.brand_world import world

IDS = ["FK-4", "FK-5", "FK-6", "FK-7"]


def issues():
    return {d["id"]: d for d in extra_issues()}


def test_four_open_issues_after_the_three():
    w = world()
    assert [i["id"] for i in w["incidents"]] == ["FK-1", "FK-2", "FK-3", *IDS]
    assert all(d["status"] == "open" for d in issues().values())


def test_groups_customers_and_money_add_up():
    for d in issues().values():
        assert d["affected"] == len(d["customers"]) == sum(g["count"] for g in d["groups"])
        assert d["money_stuck_paise"] == sum(c["amount_paise"] for c in d["customers"]) == sum(g["amount_paise"] for g in d["groups"])
        for g in d["groups"]:
            assert g["count"] == sum(1 for c in d["customers"] if c["group"] == g["id"]) > 0
        assert len({c["payment_id"] for c in d["customers"]}) == d["affected"]  # no payment or cart id twice


def test_the_actions_are_wired_to_real_things():
    for d in issues().values():
        ids = [a["id"] for a in d["actions"]]
        groups = {g["id"] for g in d["groups"]}
        assert "message" in ids and ids[-1] == "message"  # the page reads the message to customers by this name, and it comes last
        for a in d["actions"]:
            assert a.get("group") is None or a["group"] in groups, (d["id"], a["id"])
            assert a.get("needs") is None or ids.index(a["needs"]) < ids.index(a["id"]), (d["id"], a["id"])  # it waits for a step that comes before it
        msg = d["actions"][-1]
        told = msg.get("told") or next(g["count"] for g in d["groups"] if g["id"] == msg["group"])
        assert 0 < told <= d["affected"] and str(told) in msg["title"].replace(",", "")
        # every group is put right by something: it is already, or an action settles it
        assert all(g["put_right"] or any(a.get("group") == g["id"] for a in d["actions"]) for g in d["groups"]), d["id"]


def test_the_story_runs_in_order_and_every_customer_is_before_the_root_cause():
    for d in issues().values():
        first, last = min(SIGNOFF[d["id"]]), max(SIGNOFF[d["id"]])
        onset, heard = datetime.fromisoformat(d["onset_at"]), datetime.fromisoformat(d["heard"]["at"])
        axis = (datetime.fromisoformat(d["lane"]["axis_from"]), datetime.fromisoformat(d["lane"]["axis_to"]))
        assert axis[0] < onset <= heard < first <= last < axis[1], d["id"]
        times = [datetime.fromisoformat(c["at"]) for c in d["customers"]]
        assert times == sorted(times) and times[0] >= onset and times[-1] < SIGNOFF_POSTED(d)  # the root cause states a count, so nothing it counts comes after it
        for row in d["lane"]["rows"]:  # everything drawn on the chart sits inside its 40 minutes
            for it in row["items"]:
                for k in ("at", "to"):
                    if k in it:
                        assert axis[0] <= datetime.fromisoformat(it[k]) <= axis[1], (d["id"], row["name"], it)


def SIGNOFF_POSTED(d):
    """The time the root cause was posted: an exact one is posted first and signed off after; a likely one is held until it is signed off."""
    posted, signed = SIGNOFF[d["id"]]
    assert (posted > signed) == (d["confidence"] == "likely"), d["id"]
    return posted


def test_likely_ones_are_signed_off_before_they_are_posted_and_exact_ones_within_fifteen_minutes():
    for d in issues().values():
        posted, signed = SIGNOFF[d["id"]]
        if d["confidence"] == "likely":
            assert signed < posted
        else:
            assert 0 <= (signed - posted).total_seconds() / 60 <= 15


def test_the_cause_stands_out_and_the_look_alikes_do_not():
    cause = {"FK-4": {"status", "bank", "method"}, "FK-5": {"delivery_outcome", "server_release"}, "FK-6": {"platform", "app_version", "checkout_method"}, "FK-7": {"coupon", "order_payment_gap"}}
    for iid, d in issues().items():
        for r in d["lift"]:
            gap = r["share_affected"] - r["share_baseline"]
            if r["dimension"] in cause[iid]:
                assert gap >= 0.2, (iid, r)
            else:
                assert abs(gap) < 0.07, (iid, r)  # spread like everyone else's: no region, platform or method stands out


def test_blindspot_stays_out_of_the_payment_itself_and_says_when_it_is_estimating():
    for d in issues().values():
        assert d["zone"] in ("before", "after")  # a payment that fails at the bank or UPI app is Razorpay's Success Rate page
        assert (d["zone"] == "before") == d["inferred"]  # no payment exists before payment, so the count is an estimate
        assert d["confidence"] in ("exact", "likely") and d["owner"] in ("merchant_code", "bank")
        if d["inferred"]:
            assert d["headline"].startswith("About ") and d["confidence"] == "likely"
    b = issues()["FK-4"]
    assert b["owner"] == "bank" and b["confidence"] == "likely"  # one merchant's data cannot call a shared cause exact


def test_the_list_carries_the_zone_and_the_estimate_and_the_new_alerts_point_at_real_issues():
    w = world()
    by = {i["id"]: i for i in w["incidents"]}
    assert by["FK-6"]["zone"] == "before" and by["FK-6"]["inferred"] is True and by["FK-4"]["zone"] == "after" and by["FK-4"]["inferred"] is False
    for iid in ("FK-5", "FK-6"):
        assert any(a["issue"] == iid and a["status"] == "matched" for a in w["alerts"]), iid
    ev = w["audit"]["events"]
    for iid in IDS:
        kinds = {e["kind"] for e in ev if e["ref"] == iid}
        assert {"root_cause", "sign_off", "approval"} <= kinds, iid
