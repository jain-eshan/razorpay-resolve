"""The merchant's side, simulated (SPEC section 15, "Merchant mock"). Resolve reaches the merchant only through these
functions or the /merchant-mock routes. In R6 a real access hook replaces them. In production the merchant's side is two things Razorpay can see:
its webhook endpoint, and a fulfilment acknowledgement its server sends back when it has granted access (BUSINESS_CASE 2.1, INTERVIEWS T8).

State lives in the `entitlements` table (the merchant's access records) and two `settings` keys for the webhook.
There is deliberately no revoke: `restore` only puts back what a Resolve grant changed.
"""
import sqlite3
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from . import clock
from .db import connect
from .detect.access import mismatch
from .widen.silent import _ent

WEBHOOK_MODES = ("ok", "401", "500", "ack_then_fail")  # same names as merchant_mock/supabase/rzp-sink.ts
HEALTHY_HOURS = 24  # FR-VE-2: the webhook must answer 2xx for this long before an incident can close
GRANT_SOURCE = "make_good_grant"
PLAN_DAYS = {"monthly": 30, "annual": 365}
GRACE_DAYS = 3  # a grace extension for a renewal that failed on Razorpay's side: access on for this long from now (proposed to the merchant, never a revoke)
PAGE_MODES = ("ok", "404", "key_mismatch")  # the pay page: fine, route not found, or the page loads and checkout will not open
APP_MODES = ("broken", "fixed")  # the Android app: still lets the Pay button be tapped twice, or a release with an idempotency key and a disabled button is out
APP_HEALTHY_HOURS = 24  # no new double charge for this long after the fix ships before the incident can close
PAGE_HEALTHY_HOURS = 2  # the pay page must answer normally this long before recovery links go out and the incident can close


class MockError(Exception):
    pass


def _payment(db: sqlite3.Connection, payment_id: str) -> dict:
    r = db.execute("SELECT * FROM payments WHERE id = ?", (payment_id,)).fetchone()
    if not r:
        raise MockError(f"{payment_id} is not a payment of this merchant")
    return dict(r)


def check(db: sqlite3.Connection, payment_id: str) -> dict:
    """What the merchant's own record says now: the answer to 'does this customer have access?'"""
    p = _payment(db, payment_id)
    ent = _ent(db, p)
    if p["status"] == "failed":  # a failed renewal: access is on when the record is active and runs past now (a grace extension, or a later renewal)
        live = ent is not None and ent["entitlement_state"] == "active" and bool(ent["access_until"]) and ent["access_until"] > clock.now().isoformat()
        return {"payment_id": payment_id, "entitlement_state": ent["entitlement_state"] if ent else "no record", "access_until": ent["access_until"] if ent else None, "has_access": live}
    return {"payment_id": payment_id, "entitlement_state": ent["entitlement_state"] if ent else "no record",
            "access_until": ent["access_until"] if ent else None, "has_access": ent is not None and mismatch(p, ent) is None}


def grant(db: sqlite3.Connection, payment_id: str) -> dict:
    """Switch access on for one paid customer. Returns the prior state, which is what undo needs."""
    p = _payment(db, payment_id)
    ent = _ent(db, p)
    if ent is None:
        raise MockError(f"No access record exists for {payment_id}, so there is nothing to switch on. Add one, then try again.")
    prior = {k: ent[k] for k in ("id", "entitlement_state", "access_until", "updated_at", "source")}
    until = ent["access_until"]
    if p["subscription_id"]:
        interval = db.execute("SELECT pl.interval FROM subscriptions s JOIN plans pl ON pl.id = s.plan_id WHERE s.id = ?", (p["subscription_id"],)).fetchone()
        days = PLAN_DAYS.get(interval["interval"] if interval else "monthly", 30)
        until = max(filter(None, [until, (datetime.fromisoformat(p["captured_at"]) + timedelta(days=days)).isoformat()]))
    db.execute("UPDATE entitlements SET entitlement_state = 'active', access_until = ?, updated_at = ?, source = ? WHERE id = ?",
               (until, clock.now().isoformat(), GRANT_SOURCE, ent["id"]))
    return prior


def extend_grace(db: sqlite3.Connection, payment_id: str) -> dict:
    """Keep access on for GRACE_DAYS for a customer whose renewal failed on Razorpay's side. Never shortens access: a customer who is already
    covered past that date is refused. Returns the prior state, which is what undo needs."""
    p = _payment(db, payment_id)
    if p["status"] != "failed" or not p["is_renewal"]:
        raise MockError(f"{payment_id} is not a failed renewal, so a grace extension does not apply.")
    ent = _ent(db, p)
    if ent is None:
        raise MockError(f"No access record exists for {payment_id}, so there is nothing to extend. Add one, then try again.")
    until = (clock.now() + timedelta(days=GRACE_DAYS)).isoformat()
    if ent["entitlement_state"] == "active" and ent["access_until"] and ent["access_until"] >= until:
        raise MockError(f"Your records already show access past the grace date for {payment_id}.")
    prior = {k: ent[k] for k in ("id", "entitlement_state", "access_until", "updated_at", "source")}
    db.execute("UPDATE entitlements SET entitlement_state = 'active', access_until = ?, updated_at = ?, source = ? WHERE id = ?", (until, clock.now().isoformat(), GRANT_SOURCE, ent["id"]))
    return prior


def restore(db: sqlite3.Connection, payment_id: str, prior: dict) -> None:
    """Undo a grant. Refuses if the merchant changed the record after our grant, so it never overwrites their edit."""
    ent = _ent(db, _payment(db, payment_id))
    if ent is None or ent["id"] != prior["id"] or ent["source"] != GRANT_SOURCE:
        raise MockError(f"Your records for {payment_id} changed after the grant, so it was not undone.")
    db.execute("UPDATE entitlements SET entitlement_state = ?, access_until = ?, updated_at = ?, source = ? WHERE id = ?",
               (prior["entitlement_state"], prior["access_until"], prior["updated_at"], prior["source"], prior["id"]))


def _setting(db: sqlite3.Connection, key: str) -> str | None:
    r = db.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return r["value"] if r else None


def set_webhook_mode(db: sqlite3.Connection, mode: str) -> dict:
    """Demo control: the merchant's developer ships (or breaks) the fix. Records when the webhook started answering 2xx."""
    if mode not in WEBHOOK_MODES:
        raise MockError(f"Unknown mode {mode}. Use one of {', '.join(WEBHOOK_MODES)}.")
    ok_since = clock.now().isoformat() if mode == "ok" and _setting(db, "mock.webhook_mode") != "ok" else _setting(db, "mock.webhook_ok_since")
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('mock.webhook_mode', ?)", (mode,))
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('mock.webhook_ok_since', ?)", (ok_since if mode == "ok" else "",))
    return health(db)


def health(db: sqlite3.Connection) -> dict:
    mode = _setting(db, "mock.webhook_mode") or "401"  # the INC-1 world starts broken
    since = _setting(db, "mock.webhook_ok_since") or None
    hours = (clock.now() - datetime.fromisoformat(since)).total_seconds() / 3600 if mode == "ok" and since else 0.0
    return {"hook": "ok", "webhook_mode": mode, "webhook_ok_since": since if mode == "ok" else None, "healthy_hours": round(max(hours, 0.0), 1),
            "signal_healthy": mode == "ok" and hours >= HEALTHY_HOURS}


def webhook_test_event(db: sqlite3.Connection) -> dict:
    """A signed test event with a marker id, answered the way the current mode says. `acknowledged` is the fulfilment acknowledgement: the merchant's
    server saying it did what the event asked (granted access). `ack_then_fail` is the dangerous one: 2xx, and nothing granted. Changes nothing."""
    mode = health(db)["webhook_mode"]
    return {"ok": {"status": 200, "acknowledged": True}, "401": {"status": 401, "acknowledged": False}, "500": {"status": 500, "acknowledged": False},
            "ack_then_fail": {"status": 200, "acknowledged": False}}[mode] | {"mode": mode}


# ---------- the merchant's Android app (INC-2) ----------
def set_app_mode(db: sqlite3.Connection, mode: str) -> dict:
    """Demo control: the merchant's developer ships the fix for the double tap (or it is undone). Records when the fixed release went out."""
    if mode not in APP_MODES:
        raise MockError(f"Unknown mode {mode}. Use one of {', '.join(APP_MODES)}.")
    since = clock.now().isoformat() if mode == "fixed" and _setting(db, "mock.app_mode") != "fixed" else _setting(db, "mock.app_fixed_since")
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('mock.app_mode', ?)", (mode,))
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('mock.app_fixed_since', ?)", (since if mode == "fixed" else "",))
    return app_health(db)


def app_health(db: sqlite3.Connection) -> dict:
    mode = _setting(db, "mock.app_mode") or "broken"  # the INC-2 world starts broken
    since = _setting(db, "mock.app_fixed_since") or None
    hours = (clock.now() - datetime.fromisoformat(since)).total_seconds() / 3600 if mode == "fixed" and since else 0.0
    return {"app_mode": mode, "app_fixed_since": since if mode == "fixed" else None, "healthy_hours": round(max(hours, 0.0), 1), "signal_healthy": mode == "fixed" and hours >= APP_HEALTHY_HOURS}


# ---------- the merchant's pay page (Zone 1, R4) ----------
def pay_page(db: sqlite3.Connection) -> dict:
    """What a visitor, or the pay-URL probe, gets from the merchant's pay page right now."""
    mode = _setting(db, "mock.page_mode") or "404"  # the INC-4 world starts broken
    # checkout_opens: pressing Pay really opens Razorpay's checkout. A wrong or rotated key leaves the script on the page and the button dead, so the
    # old probe (status and script only) passes it; the release check does not.
    return {"ok": {"status": 200, "load_ms": 180, "checkout_script_present": True, "checkout_opens": True, "note": None},
            "404": {"status": 404, "load_ms": 120, "checkout_script_present": False, "checkout_opens": False, "note": "Route not found"},
            "key_mismatch": {"status": 200, "load_ms": 210, "checkout_script_present": True, "checkout_opens": False, "note": "Page loads, checkout does not open"}}[mode] | {"mode": mode}


def set_page_mode(db: sqlite3.Connection, mode: str) -> dict:
    """Demo control: the merchant's developer fixes (or breaks) the pay page. Records when it started answering normally."""
    if mode not in PAGE_MODES:
        raise MockError(f"Unknown mode {mode}. Use one of {', '.join(PAGE_MODES)}.")
    ok_since = clock.now().isoformat() if mode == "ok" and _setting(db, "mock.page_mode") != "ok" else _setting(db, "mock.page_ok_since")
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('mock.page_mode', ?)", (mode,))
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('mock.page_ok_since', ?)", (ok_since if mode == "ok" else "",))
    return page_health(db)


def page_health(db: sqlite3.Connection) -> dict:
    mode = _setting(db, "mock.page_mode") or "404"
    since = _setting(db, "mock.page_ok_since") or None
    hours = (clock.now() - datetime.fromisoformat(since)).total_seconds() / 3600 if mode == "ok" and since else 0.0
    return {"page_mode": mode, "page_status": pay_page(db)["status"], "page_ok_since": since if mode == "ok" else None, "healthy_hours": round(max(hours, 0.0), 1),
            "signal_healthy": mode == "ok" and hours >= PAGE_HEALTHY_HOURS}


# ---------- HTTP face of the mock, mounted at /merchant-mock (not part of the frozen /api contract) ----------
app = FastAPI(title="Merchant mock")


class GrantBody(BaseModel):
    razorpay_payment_id: str
    order_id: str | None = None


class ModeBody(BaseModel):
    mode: str


def _run(fn, *args):
    db = connect()
    try:
        out = fn(db, *args)
        db.commit()
        return out
    except MockError as e:
        raise HTTPException(409, str(e)) from e
    finally:
        db.close()


@app.get("/health")
def get_health(): return _run(health)
@app.get("/entitlements/check")
def get_check(payment_id: str): return _run(check, payment_id)
@app.post("/entitlements/grant")
def post_grant(body: GrantBody): return {"prior": _run(grant, body.razorpay_payment_id)}
@app.post("/webhook-mode")
def post_mode(body: ModeBody): return _run(set_webhook_mode, body.mode)
@app.get("/app-health")
def get_app_health(): return _run(app_health)
@app.post("/app-mode")
def post_app_mode(body: ModeBody): return _run(set_app_mode, body.mode)
@app.get("/pay-page")
def get_pay_page():
    """The probe target. Answers the way the pay page mode says."""
    page = _run(pay_page)
    if page["status"] >= 400:
        raise HTTPException(page["status"], page["note"])
    return page
@app.get("/page-health")
def get_page_health(): return _run(page_health)
@app.post("/page-mode")
def post_page_mode(body: ModeBody): return _run(set_page_mode, body.mode)


@app.post("/webhook")
def post_webhook():
    """A test event, answered the way the current mode says. The access hook's own health, in one status code."""
    status = {"ok": 200, "401": 401, "500": 500, "ack_then_fail": 200}[_run(health)["webhook_mode"]]
    if status != 200:
        raise HTTPException(status, "Merchant webhook rejected the test event")
    return {"received": True}
