"""Guard's release check (F-81 test ping, F-82 pre-deploy check): five steps over the merchant's webhook and pay page, read-only, rules only."""
import pytest
from app import clock, guard, merchant_mock
from app.main import app
from fastapi.testclient import TestClient

WEBHOOK = ("answers", "accepts", "acknowledges")
PAGE = ("opens", "checkout")


def run(db, webhook="ok", page="ok"):
    merchant_mock.set_webhook_mode(db, webhook)
    merchant_mock.set_page_mode(db, page)
    return guard.release_check(db, clock.now())


def by_key(r):
    return {s.key: s.status for s in r.steps}


def test_everything_healthy_is_safe_to_release(fresh):
    r = run(fresh)
    assert r.safe_to_release and r.failed == 0 and set(by_key(r).values()) == {"pass"} and r.headline.startswith("Safe to release")
    assert [s.key for s in r.steps] == [*WEBHOOK, *PAGE]


@pytest.mark.parametrize("mode,expected", [
    ("401", {"answers": "pass", "accepts": "fail", "acknowledges": "skipped"}),                  # rejects the signed event
    ("500", {"answers": "fail", "accepts": "skipped", "acknowledges": "skipped"}),               # crashes on it
    ("ack_then_fail", {"answers": "pass", "accepts": "pass", "acknowledges": "fail"}),           # says 200 and grants nothing: INC-1's hardest group
])
def test_each_webhook_failure_stops_at_the_step_it_belongs_to(fresh, mode, expected):
    r = run(fresh, webhook=mode)
    got = by_key(r)
    assert {k: got[k] for k in WEBHOOK} == expected and not r.safe_to_release
    if mode == "401":
        assert "reachable" in next(s.saw for s in r.steps if s.key == "answers")  # "Passed" beside "401" must not read as a contradiction
    assert {got["opens"], got["checkout"]} == {"pass"}  # the pay page is judged on its own


@pytest.mark.parametrize("mode,expected", [("404", {"opens": "fail", "checkout": "skipped"}), ("key_mismatch", {"opens": "pass", "checkout": "fail"})])
def test_each_pay_page_failure_stops_at_the_step_it_belongs_to(fresh, mode, expected):
    r = run(fresh, page=mode)
    got = by_key(r)
    assert {k: got[k] for k in PAGE} == expected and not r.safe_to_release
    assert {got[k] for k in WEBHOOK} == {"pass"}


def test_a_skipped_step_is_never_a_pass(fresh):
    r = run(fresh, webhook="500", page="404")
    assert r.failed == 2 and sum(s.status == "skipped" for s in r.steps) == 3 and not r.safe_to_release


def test_every_failure_says_what_it_means_and_what_to_do_and_a_pass_says_neither(fresh):
    for webhook, page in (("401", "404"), ("500", "key_mismatch"), ("ack_then_fail", "ok")):
        for s in run(fresh, webhook, page).steps:
            if s.status == "fail":
                assert s.saw and s.meaning and s.next_step, s
                assert any(w in s.meaning.lower() for w in ("customer", "page")), s
            else:
                assert not s.meaning and not s.next_step, s


def test_the_starting_world_is_on_hold_with_both_problems_named(fresh):
    r = guard.release_check(fresh, clock.now())  # the world starts with the webhook at 401 and the pay page at 404
    assert not r.safe_to_release and r.failed == 2 and "Hold the release" in r.headline


def test_the_check_changes_nothing(fresh):
    before = fresh.total_changes
    for webhook in merchant_mock.WEBHOOK_MODES:
        for page in merchant_mock.PAGE_MODES:
            merchant_mock.set_webhook_mode(fresh, webhook)
            merchant_mock.set_page_mode(fresh, page)
            marker = fresh.total_changes
            guard.release_check(fresh, clock.now())
            assert fresh.total_changes == marker, (webhook, page)
    assert fresh.total_changes > before


def test_the_test_event_never_grants_anyone_access(fresh):
    snap = fresh.execute("SELECT * FROM entitlements ORDER BY id").fetchall()
    for m in merchant_mock.WEBHOOK_MODES:
        merchant_mock.set_webhook_mode(fresh, m)
        merchant_mock.webhook_test_event(fresh)
    assert [tuple(r) for r in fresh.execute("SELECT * FROM entitlements ORDER BY id")] == [tuple(r) for r in snap]


def test_the_release_script_line_is_there_and_names_the_field_it_reads(fresh):
    r = run(fresh)
    assert "release-check" in r.ci_call and "safe_to_release" in r.ci_call and r.cannot_see


def test_http_face(world_file):
    api = TestClient(app)
    j = api.get("/api/guard/release-check").json()
    assert set(j) >= {"safe_to_release", "headline", "steps", "failed", "ci_call", "cannot_see", "checked_at"} and len(j["steps"]) == 5
    assert j["safe_to_release"] is False and j["failed"] == 2  # the starting world
