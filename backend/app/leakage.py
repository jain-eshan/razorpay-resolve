"""J6, access without payment (V1 8.3): UPI AutoPay renewals that failed on the customer's side while the customer kept access past the
merchant's own grace rule. A report and nothing more: it reads the payments and the merchant's access records, writes nothing, and no
action exists that takes access away. Computed from the data at the demo clock's time, so a failure that is inside the rule today
moves into the report when the rule runs out."""
import sqlite3
from datetime import datetime, timedelta

from .act.messages import inr
from .schemas import LeakageLeftOut, LeakageReport, LeakageRow, LeakageStep
from .widen.silent import mask

CANNOT_SEE = [
    "Whether you extended access on purpose, for example a goodwill month or an annual deal. Those rows are not leaks.",
    "Whether you have already told the customer. Resolve reads payments and your access records, not your email.",
    "Whether another renewal attempt is still due. It reads the payments it has been given.",
]


def _t(s: str) -> datetime:
    return datetime.fromisoformat(s)


def _row(r: sqlite3.Row, grace: timedelta, now: datetime) -> LeakageRow:
    ends = _t(r["created_at"]) + grace
    return LeakageRow(subscription_id=r["subscription_id"], payment_id=r["id"], customer_masked=mask(r["name"]), plan=r["plan"], amount_paise=r["amount_paise"], reason=r["error_description"] or "Failed",
                      failed_at=_t(r["created_at"]), rule_ends_at=ends, hours_over_rule=round((now - ends).total_seconds() / 3600, 1), access_until=_t(r["access_until"]))


def report(db: sqlite3.Connection, now: datetime) -> LeakageReport:
    db.row_factory = sqlite3.Row
    hours = db.execute("SELECT grace_hours_after_failed_renewal FROM merchants LIMIT 1").fetchone()[0]
    grace = timedelta(hours=hours)
    latest: dict[str, sqlite3.Row] = {}  # one row per subscription: its last failed renewal
    for r in db.execute("""SELECT p.id, p.subscription_id, p.created_at, p.amount_paise, p.error_source, p.error_description, c.name, pl.name AS plan, e.entitlement_state, e.access_until
                           FROM payments p JOIN subscriptions s ON s.id = p.subscription_id JOIN customers c ON c.id = s.customer_id JOIN plans pl ON pl.id = s.plan_id
                           LEFT JOIN entitlements e ON e.subscription_id = s.id
                           WHERE p.is_renewal = 1 AND p.status = 'failed' AND s.method = 'upi_autopay' AND p.created_at <= ? ORDER BY p.created_at""", (now.isoformat(),)):
        latest[r["subscription_id"]] = r
    failed, customer_side, unpaid, with_access = len(latest), 0, 0, 0
    rows, inside, paid_since, cut, not_theirs = [], [], 0, 0, 0
    for r in latest.values():
        on = r["entitlement_state"] == "active" and r["access_until"] is not None and _t(r["access_until"]) > now
        if db.execute("SELECT 1 FROM payments WHERE subscription_id = ? AND status = 'captured' AND created_at > ? LIMIT 1", (r["subscription_id"], r["created_at"])).fetchone():
            paid_since += 1
            continue
        if r["error_source"] != "customer":
            not_theirs += 1  # the bank's or Razorpay's failure: the customer owes nothing, whatever their access is
            continue
        customer_side += 1
        unpaid += 1
        if not on:
            cut += 1
            continue
        with_access += 1
        (rows if _t(r["created_at"]) + grace <= now else inside).append(_row(r, grace, now))
    rows.sort(key=lambda x: -x.hours_over_rule)
    inside.sort(key=lambda x: x.rule_ends_at)
    owed = sum(x.amount_paise for x in rows)
    left = [LeakageLeftOut(label=f"{n} {text}", count=n) for n, text in (
        (cut, "failed and had access cut when your rule ran out. That is the rule working."),
        (paid_since, "failed, then paid again on their own."),
        (not_theirs, "failed on the bank's or Razorpay's side. The customer owes nothing, so they are not counted."),
    ) if n]
    funnel = [LeakageStep(label="UPI AutoPay renewals that failed", count=failed),
              LeakageStep(label="Failed on the customer's side and not paid since", count=unpaid),
              LeakageStep(label="Still have access", count=with_access),
              LeakageStep(label=f"Past your {hours} hour rule", count=len(rows))]
    head = (f"{len(rows)} customers failed a UPI renewal, are past your {hours} hour rule and still have access. ₹{inr(owed)} in renewals is unpaid."
            if rows else f"No customer is past your {hours} hour rule with access still on.")
    return LeakageReport(as_of=now, grace_hours=hours, headline=head, customers=len(rows), owed_paise=owed, longest_over_hours=rows[0].hours_over_rule if rows else 0.0,
                         rows=rows, inside_rule=inside, left_out=left, funnel=funnel, cannot_see=CANNOT_SEE)

