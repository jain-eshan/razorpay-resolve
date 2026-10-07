"""Renewal anomaly monitor (F-08, SPEC 11.4: renewal failure rate by method against its baseline).

Looks for a run of consecutive failed renewals on one method that the normal failure rate cannot explain: with the usual share of
failures p, k in a row has chance p to the power k, and it must fall under 1 in 1,000 (and be at least 5 long) before anything is
raised. That is the whole test. A run is Razorpay's to explain only when what it needs to be the merchant's or a bank's is missing:
no change on the merchant's side just before it, no bank outage over it, one error code on nearly every failure, several card
networks, and the other method (UPI AutoPay) going through in the same hours.

Only the first run found becomes INC-3. A second one would need its own number, and this world has one."""
import sqlite3
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta

MIN_RUN = 5
P_THRESHOLD = 0.001
CODE_SHARE = 0.8        # share of the run that must carry one error code
MIN_NETWORKS = 2        # card networks in the run: one failing network points at the network, not at the gateway
FLOOR = 0.02            # the baseline failure rate is never trusted below this (a few hundred renewals is too few to say 0)
CHANGE_LOOKBACK = timedelta(hours=2)


@dataclass
class Run:
    method: str
    error_code: str
    error_source: str
    payment_ids: list[str]            # the failed renewals, in order
    first_at: datetime
    last_at: datetime
    alert_at: datetime                # the k-th failure, the first one a live monitor could have raised on
    resolved_at: datetime | None      # the first later renewal of this method that went through
    baseline_rate: float
    p_value: float
    networks: list[str]
    code_share: float
    control: dict = field(default_factory=dict)       # the other method, same hours: {"method", "renewals", "failed"}
    downtime_overlap: bool = False
    merchant_change: str | None = None                # label of a deploy or config change in the 2 hours before the first failure

    @property
    def explained_elsewhere(self) -> bool:
        """True when the merchant or a bank explains it, so the evidence for Razorpay is not there."""
        return self.downtime_overlap or self.merchant_change is not None or self.code_share < CODE_SHARE or len(self.networks) < MIN_NETWORKS or bool(self.control.get("failed"))


def _t(s: str) -> datetime:
    return datetime.fromisoformat(s)


def find(db: sqlite3.Connection) -> list[Run]:
    rows = [dict(r) for r in db.execute("""SELECT id, method, status, error_code, error_source, card_network, created_at FROM payments
                                           WHERE is_renewal = 1 AND subscription_id IS NOT NULL AND status != 'refunded' ORDER BY created_at, id""")]
    out = []
    for method in sorted({r["method"] for r in rows}):
        mine = [r for r in rows if r["method"] == method]
        i = 0
        while i < len(mine):
            if mine[i]["status"] != "failed":
                i += 1
                continue
            j = i
            while j < len(mine) and mine[j]["status"] == "failed":
                j += 1
            run = _judge(db, mine, i, j, rows)
            if run:
                out.append(run)
            i = j
    return sorted(out, key=lambda r: r.first_at)


def _judge(db: sqlite3.Connection, mine: list[dict], i: int, j: int, everyone: list[dict]) -> Run | None:
    run = mine[i:j]
    if len(run) < MIN_RUN:
        return None
    rest = mine[:i] + mine[j:]
    failed_rest = sum(1 for r in rest if r["status"] == "failed")
    p = max((failed_rest + 1) / (len(rest) + 2), FLOOR)  # smoothed, so a short history cannot claim "never fails"
    k = next((n for n in range(MIN_RUN, len(run) + 1) if p ** n < P_THRESHOLD), None)
    if k is None:
        return None
    code, n_code = Counter(r["error_code"] for r in run).most_common(1)[0]
    sources = Counter(r["error_source"] for r in run if r["error_code"] == code)
    first, last = _t(run[0]["created_at"]), _t(run[-1]["created_at"])
    after = next((r for r in mine[j:] if r["status"] == "captured"), None)
    other = [r for r in everyone if r["method"] != run[0]["method"] and first <= _t(r["created_at"]) <= last]
    change = db.execute("SELECT label FROM merchant_events WHERE kind IN ('deploy','config_change','app_release') AND at <= ? AND at >= ? ORDER BY at DESC LIMIT 1",
                        (first.isoformat(), (first - CHANGE_LOOKBACK).isoformat())).fetchone()
    down = db.execute("SELECT 1 FROM downtime_events WHERE started_at <= ? AND ended_at >= ? LIMIT 1", (last.isoformat(), first.isoformat())).fetchone()
    return Run(method=run[0]["method"], error_code=code, error_source=sources.most_common(1)[0][0] or "", payment_ids=[r["id"] for r in run], first_at=first, last_at=last,
               alert_at=_t(run[k - 1]["created_at"]), resolved_at=_t(after["created_at"]) if after else None, baseline_rate=round(p, 3), p_value=p ** k,
               networks=sorted({r["card_network"] for r in run if r["card_network"]}), code_share=round(n_code / len(run), 2),
               control={"method": other[0]["method"] if other else None, "renewals": len(other), "failed": sum(1 for r in other if r["status"] == "failed")},
               downtime_overlap=down is not None, merchant_change=change["label"] if change else None)
