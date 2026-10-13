"""Guard's release check (PRD F-81 test ping and F-82 pre-deploy check, BUSINESS_CASE 5.1). Read-only: it sends the merchant's webhook one signed test event
and opens the pay page, and says whether it is safe to ship. Rules decide, nothing here is a model, and it changes nothing (a test asserts that).

Five steps in two groups, each `pass`, `fail` or `skipped` (an earlier step failed, so this one could not be tried):
  webhook: answers -> accepts a signed event -> acknowledges (granted access)
  pay page: opens -> checkout opens
A failed step names what it saw, what that means for a customer, and the next step. Whose side is always the merchant's here, because Razorpay cannot
fail a test event the merchant's own server answers."""
import sqlite3
from datetime import datetime

from . import merchant_mock
from .schemas import ReleaseCheck, ReleaseStep

CI_CALL = "curl -fsS \"$RESOLVE_API/api/guard/release-check\" | jq -e '.safe_to_release'"
CANNOT_SEE = [
    "Your code. I only see how your endpoint and your pay page answer.",
    "Every event type. The test is one payment.captured event with a marker id, so a handler that breaks on refunds or subscriptions would pass.",
    "A change that goes live after this check. Run it again after the release as well.",
]


def _step(key: str, group: str, label: str, status: str, saw: str, meaning: str = "", next_step: str = "") -> ReleaseStep:
    return ReleaseStep(key=key, group=group, label=label, status=status, saw=saw, meaning=meaning, next_step=next_step)  # type: ignore[arg-type]


def _webhook(db: sqlite3.Connection) -> list[ReleaseStep]:
    ev = merchant_mock.webhook_test_event(db)
    status, ack = ev["status"], ev["acknowledged"]
    g = "webhook"
    if status >= 500:
        return [_step("answers", g, "Your webhook answers", "fail", f"It answered {status}.",
                      "Your handler crashed on the test event. A customer who pays now would be charged and get nothing.", "Open your server log at the time of this check, fix the error, and run the check again."),
                _step("accepts", g, "It accepts a signed event", "skipped", "Not tried, the endpoint did not answer."),
                _step("acknowledges", g, "It grants access and says so", "skipped", "Not tried, the endpoint did not answer.")]
    if status in (401, 403):
        return [_step("answers", g, "Your webhook answers", "pass", f"It answered with a {status}, so it is reachable."),
                _step("accepts", g, "It accepts a signed event", "fail", f"It rejected the signed test event ({status}).",
                      "Real payments are signed the same way, so they would be rejected too and no customer would get access.", "Check that the webhook secret in your server matches the one in your Razorpay dashboard, then run the check again."),
                _step("acknowledges", g, "It grants access and says so", "skipped", "Not tried, the event was rejected.")]
    out = [_step("answers", g, "Your webhook answers", "pass", f"It answered {status}."), _step("accepts", g, "It accepts a signed event", "pass", "It took the signed test event.")]
    out.append(_step("acknowledges", g, "It grants access and says so", "pass", "Your server sent the fulfilment acknowledgement.") if ack else
               _step("acknowledges", g, "It grants access and says so", "fail", "It answered 200 and sent no fulfilment acknowledgement.",
                     "Your server took the event and did nothing with it. Razorpay sees a success, and the customer has paid and has no access.", "Look for a handler that returns 200 before it has granted access, or that fails after it replies."))
    return out


def _pay_page(db: sqlite3.Connection) -> list[ReleaseStep]:
    p = merchant_mock.pay_page(db)
    g = "pay_page"
    if p["status"] >= 400:
        return [_step("opens", g, "Your pay page opens", "fail", f"It answered {p['status']} ({p['note']}).", "Customers cannot reach the page, so they cannot pay and Razorpay sees no attempt.",
                      "Check the route and the deploy, put the page back, and run the check again."),
                _step("checkout", g, "Checkout opens on it", "skipped", "Not tried, the page did not open.")]
    out = [_step("opens", g, "Your pay page opens", "pass", f"It answered {p['status']}.")]
    out.append(_step("checkout", g, "Checkout opens on it", "pass", "The Razorpay checkout script is on the page and Pay opens it.") if p["checkout_script_present"] and p["checkout_opens"] else
               _step("checkout", g, "Checkout opens on it", "fail", p["note"] or "The checkout script is missing.", "The page opens and the Pay button does nothing. This is what a wrong or rotated key looks like.",
                     "Check the Razorpay key in your front end against the one in your dashboard, then run the check again."))
    return out


def release_check(db: sqlite3.Connection, now: datetime) -> ReleaseCheck:
    steps = _webhook(db) + _pay_page(db)
    failed = sum(s.status == "fail" for s in steps)
    skipped = sum(s.status == "skipped" for s in steps)
    if failed:
        first = next(s for s in steps if s.status == "fail")
        headline = f"Hold the release. {failed} of {len(steps)} checks failed. First problem: {first.saw[0].lower()}{first.saw[1:]}"
    else:
        headline = "Safe to release. Your webhook acknowledges a test event and your pay page opens with checkout on it."
    return ReleaseCheck(checked_at=now, safe_to_release=failed == 0 and skipped == 0, headline=headline, steps=steps, failed=failed, ci_call=CI_CALL, cannot_see=CANNOT_SEE)
