"""J6, access without payment: a read-only report of UPI AutoPay renewals that failed on the customer's side while access stayed on past the merchant's rule."""
import sqlite3
from datetime import timedelta
from pathlib import Path
from typing import get_args

from app import clock, leakage
from app.act import autonomy
from app.main import app
from app.schemas import ActionType
from fastapi.testclient import TestClient


def truth(world) -> dict[str, set[str]]:
    """Hidden ground truth by state: the failed payment ids. Opened here, never by the app."""
    path = Path(world.execute("PRAGMA database_list").fetchone()[2]).parent / "truth.db"
    db = sqlite3.connect(path)
    out: dict[str, set[str]] = {}
    for pid, state in db.execute("SELECT payment_id, state FROM truth_leakage"):
        out.setdefault(state, set()).add(pid)
    return out


def now_report(db):
    return leakage.report(db, clock.now())


def test_the_report_is_exactly_the_customers_ground_truth_says_are_leaking(world):
    r, t = now_report(world), truth(world)
    assert {x.payment_id for x in r.rows} == t["leak"]
    assert {x.payment_id for x in r.inside_rule} == t["inside_grace"]
    assert r.customers == len(t["leak"]) == 9


def test_look_alikes_are_never_listed_and_each_is_counted_with_its_reason(world):
    r, t = now_report(world), truth(world)
    listed = {x.payment_id for x in r.rows + r.inside_rule}
    assert not listed & (t["access_cut"] | t["paid_since"] | t["not_theirs"])
    counts = {l.count for l in r.left_out}
    assert len(t["paid_since"]) in counts
    assert len(t["not_theirs"]) + 1 in counts  # one more bank-side failure comes from the base world, and it is counted as well
    assert len(t["access_cut"]) <= max(counts)  # the ordinary failures that were cut properly (one more comes from the base world)


def test_every_listed_row_failed_on_the_customers_side_for_a_upi_autopay_renewal_and_still_has_access(world):
    for x in now_report(world).rows:
        p = world.execute("SELECT p.status, p.error_source, p.is_renewal, s.method FROM payments p JOIN subscriptions s ON s.id = p.subscription_id WHERE p.id = ?", (x.payment_id,)).fetchone()
        assert (p["status"], p["error_source"], p["is_renewal"], p["method"]) == ("failed", "customer", 1, "upi_autopay")
        assert x.access_until > clock.now() and x.hours_over_rule >= 0
        assert x.rule_ends_at == x.failed_at + timedelta(hours=48)
        assert "*" in x.customer_masked  # never a full name


def test_the_numbers_on_the_page_are_the_rows_added_up(world):
    r = now_report(world)
    assert r.owed_paise == sum(x.amount_paise for x in r.rows) == 9 * 29_900
    assert r.longest_over_hours == max(x.hours_over_rule for x in r.rows) == r.rows[0].hours_over_rule
    assert [s.count for s in r.funnel][-1] == r.customers
    assert [s.count for s in r.funnel] == sorted((s.count for s in r.funnel), reverse=True)
    assert "9 customers" in r.headline and "₹2,691" in r.headline


def test_reading_the_report_writes_nothing(fresh):
    before = fresh.total_changes
    now_report(fresh)
    assert fresh.total_changes == before


def test_no_action_can_take_access_away():
    assert not [a for a in get_args(ActionType) if any(w in a for w in ("revoke", "cut", "remove", "cancel", "suspend", "expire"))]
    assert not [k for k in autonomy.MATRIX if any(w in k for w in ("revoke", "cut", "remove", "cancel", "suspend", "expire"))]


def test_a_failure_inside_the_rule_moves_into_the_report_when_the_rule_runs_out(world):
    first = now_report(world)
    inside = {x.payment_id: x for x in first.inside_rule}
    assert len(inside) == 4 and all(x.hours_over_rule < 0 for x in inside.values())
    soonest = min(inside.values(), key=lambda x: x.rule_ends_at)
    clock.advance(int(-soonest.hours_over_rule) + 1)  # one hour past the first rule to run out
    later = now_report(world)
    assert later.customers == 10 and soonest.payment_id in {x.payment_id for x in later.rows}
    clock.advance(48)
    assert now_report(world).customers == 13 and not now_report(world).inside_rule


def test_the_rule_is_the_merchants_own_setting(fresh):
    fresh.execute("UPDATE merchants SET grace_hours_after_failed_renewal = 100000")
    r = now_report(fresh)
    assert r.customers == 0 and r.grace_hours == 100000 and r.headline.startswith("No customer")
    fresh.execute("UPDATE merchants SET grace_hours_after_failed_renewal = 0")
    assert now_report(fresh).customers == 13  # every customer-side failure with access on, the inside-rule four included


def test_a_customer_who_pays_after_the_report_drops_out(fresh):
    gone = now_report(fresh).rows[0]
    fresh.execute("""INSERT INTO payments (id, merchant_id, subscription_id, customer_id, amount_paise, currency, method, status, is_renewal, created_at, captured_at)
                     SELECT 'pay_test_later', merchant_id, subscription_id, customer_id, amount_paise, 'INR', 'upi', 'captured', 1, ?, ? FROM payments WHERE id = ?""",
                  (clock.now().isoformat(), clock.now().isoformat(), gone.payment_id))
    after = now_report(fresh)
    assert gone.payment_id not in {x.payment_id for x in after.rows} and after.customers == 8


def test_a_customer_whose_access_the_merchant_cuts_drops_out_and_is_counted_as_cut(fresh):
    r = now_report(fresh)
    cut_before = next((l.count for l in r.left_out if "cut" in l.label), 0)
    fresh.execute("UPDATE entitlements SET entitlement_state = 'expired', access_until = ? WHERE subscription_id = ?", (clock.now().isoformat(), r.rows[0].subscription_id))
    after = now_report(fresh)
    assert after.customers == 8 and next(l.count for l in after.left_out if "cut" in l.label) == cut_before + 1


def test_card_customers_kept_on_by_an_extension_are_not_in_this_report(fresh):
    """INC-3's grace extension leaves card subscribers with access and a failed renewal. They failed on Razorpay's side and pay by card: not this report."""
    before = now_report(fresh).customers
    fresh.execute("""UPDATE entitlements SET entitlement_state = 'active', access_until = ? WHERE subscription_id IN
                     (SELECT subscription_id FROM payments WHERE status = 'failed' AND is_renewal = 1 AND method = 'card')""", ((clock.now() + timedelta(days=3)).isoformat(),))
    assert now_report(fresh).customers == before == 9


def test_the_route_serves_the_real_report_and_a_typed_placeholder_without_the_pipeline(world_file, monkeypatch):
    api = TestClient(app)
    j = api.get("/api/leakage").json()
    assert j["customers"] == 9 and len(j["rows"]) == 9 and j["grace_hours"] == 48
    monkeypatch.delenv("BS_SOURCE")
    assert TestClient(app).get("/api/leakage").json()["customers"] == 1


def test_every_step_of_the_funnel_is_accounted_for_by_a_line_on_the_page(world):
    """25 failed = paid again + bank-side + customer-side, and the customer-side ones = cut + still with access. Nobody disappears between steps."""
    r = now_report(world)
    failed, customer_side, with_access, past = (s.count for s in r.funnel)
    paid = next(l.count for l in r.left_out if "paid again" in l.label)
    bank = next(l.count for l in r.left_out if "bank's or Razorpay's" in l.label)
    cut = next(l.count for l in r.left_out if "cut" in l.label)
    assert failed == paid + bank + customer_side
    assert customer_side == cut + with_access
    assert with_access == past + len(r.inside_rule)
