import json
from datetime import datetime

from synth.brand_issues import OUT, generate, inr

IDS = ["bank-pending", "dup-orders", "ios-checkout", "coupon-mismatch"]


def issues():
    return {i["id"]: i for i in generate()["issues"]}


def test_four_issues_each_with_two_groups_and_three_actions():
    d = issues()
    assert list(d) == IDS
    for i in d.values():
        assert len(i["groups"]) == 2 and len(i["actions"]) == 3
        assert [a["kind"] for a in i["actions"]] == ["fix", "fix", "tell"]  # the message to customers is last and waits for the rest


def test_counts_and_money_add_up_from_the_customers():
    for i in issues().values():
        rows = i["customers"]
        assert i["counts"]["affected"] == len(rows) == sum(g["count"] for g in i["groups"])
        assert i["money_paise"] == sum(r["amount_paise"] for r in rows) == sum(g["money_paise"] for g in i["groups"])
        assert len({r["id"] for r in rows}) == len(rows)  # no payment or cart id twice
        assert {r["group"] for r in rows} == {g["id"] for g in i["groups"]}


def test_the_action_text_carries_the_counts_it_is_about():
    for i in issues().values():
        n = i["counts"]["affected"]
        tell = i["actions"][-1]
        assert tell["covers"] <= n and str(tell["covers"]) in tell["title"] and str(tell["covers"]) in tell["button"]
        assert min(n, sum(a["covers"] for a in i["actions"] if a["kind"] == "fix")) == n, f"{i['id']}: the fixes must put every customer right"


def test_inr_groups_digits_the_indian_way():
    assert inr(156906000) == "₹15,69,060" and inr(50000) == "₹500" and inr(12345600) == "₹1,23,456" and inr(99999900) == "₹9,99,999"


def test_the_story_runs_in_order_and_every_customer_is_before_the_rca():
    for i in issues().values():
        t = {k: datetime.fromisoformat(i[k]) for k in ("started_at", "alert_at", "rca_at", "axis_from", "axis_to")}
        assert t["axis_from"] < t["started_at"] < t["alert_at"] < t["rca_at"] < t["axis_to"]
        times = [datetime.fromisoformat(r["at"]) for r in i["customers"]]
        assert times == sorted(times) and times[0] >= t["started_at"] and times[-1] < t["rca_at"]  # the RCA states a count, so nothing it counts may come after it
        for row in i["rows"]:  # everything drawn on the chart sits inside its 40 minutes
            for it in row["items"]:
                for k in ("at", "to"):
                    if k in it:
                        assert t["axis_from"] <= datetime.fromisoformat(it[k]) <= t["axis_to"], (i["id"], row["name"], it)


def test_the_cause_stands_out_and_the_look_alikes_do_not():
    cause = {"bank-pending": {"status", "bank", "method"}, "dup-orders": {"delivery_outcome", "server_release"}, "ios-checkout": {"platform", "app_version", "checkout_method"},
             "coupon-mismatch": {"coupon", "order_payment_gap"}}
    for iid, i in issues().items():
        for r in i["lift"]:
            gap = r["share_affected"] - r["share_baseline"]
            if r["dimension"] in cause[iid]:
                assert gap >= 0.2, (iid, r)
            else:
                assert abs(gap) < 0.07, (iid, r)  # spread like everyone else's: no region, UPI app or platform stands out


def test_blindspot_stays_out_of_the_payment_itself():
    for i in issues().values():
        assert i["zone"] in ("before", "after")  # bank and UPI failures during the payment are Razorpay's Success Rate page
        assert (i["zone"] == "before") == i["inferred"]  # no payment exists before payment, so the count is an estimate


def test_same_seed_same_file_and_the_committed_file_is_current():
    assert generate() == generate()
    assert json.loads(OUT.read_text()) == generate(), "web/public/brand/issues.json is stale: run `uv run python -m synth.brand_issues`"
