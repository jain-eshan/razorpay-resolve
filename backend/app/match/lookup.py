"""Matching a complaint to a payment (SPEC 11.3). Exact keys decide. The fuzzy scorer only suggests, for the founder's brief: it is never
used to tell a customer anything about a payment.

Exact keys, in priority order: Razorpay payment or order id (0.99), UTR or RRN (0.97), merchant receipt (0.95), contact plus amount within
48 hours (0.85, minus 0.10 for each other payment by that contact in the window)."""
import json
import math
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

from ..db import ROOT
from ..ingest.extract import Extraction
from ..ingest.redact import Redacted

RECEIPT = re.compile(r"\b[A-Z]{2,5}-\d{4}-\d{3,}\b")
WEIGHTS = {"amount": 2.5, "time": 2.0, "method": 0.8, "bank_app": 1.0, "contact_partial": 1.5, "card_last4": 2.0, "vpa_suffix": 1.5, "crowding": -1.2}
BIAS = -3.0
T_AUTO, MARGIN, T_MIN = 0.85, 0.10, 0.30  # T_AUTO is replaced by the value chosen from the precision-recall curve when a calibrator exists
EXACT_CONFIDENCE = {"payment_id": 0.99, "order_id": 0.99, "rrn": 0.97, "receipt": 0.95}
CALIBRATOR = ROOT / "data" / "calibrator.json"


@dataclass
class Candidate:
    payment_id: str
    method: str          # exact_payment_id | exact_order_id | exact_rrn | exact_receipt | exact_contact | fuzzy
    score: float
    features: dict = field(default_factory=dict)


@dataclass
class MatchResult:
    status: str                       # matched | not_found | needs_detail
    exact: list[Candidate] = field(default_factory=list)
    suggestions: list[Candidate] = field(default_factory=list)   # fuzzy, founder only
    key_not_found: bool = False       # the customer gave an identifier that is not a payment of this merchant


def _pay(db, where: str, *args) -> list[sqlite3.Row]:
    return db.execute(f"SELECT * FROM payments WHERE status IN ('captured','refunded') AND {where}", args).fetchall()


def exact(db: sqlite3.Connection, red: Redacted, x: Extraction, received_at: datetime) -> tuple[list[Candidate], bool]:
    """Returns the candidates from the highest-priority key that matched, and whether the customer gave any key at all."""
    ids = {k: red.value(getattr(x.ids, k)) for k in ("payment_id", "order_id", "rrn", "email", "phone", "vpa")}
    ids["receipt"] = (RECEIPT.findall(red.text) or [None])[0]
    gave = any(ids[k] for k in EXACT_CONFIDENCE)
    for key, conf in EXACT_CONFIDENCE.items():
        if not ids[key]:
            continue
        rows = (_pay(db, "id = ?", ids[key]) if key == "payment_id" else _pay(db, "order_id = ?", ids[key]) if key == "order_id"
                else _pay(db, "rrn = ? OR upi_txn_id = ?", ids[key], ids[key]) if key == "rrn"
                else _pay(db, "order_id IN (SELECT id FROM orders WHERE receipt = ?)", ids[key]))
        if rows:
            return [Candidate(r["id"], f"exact_{key}", conf) for r in rows], gave
    if x.amount_paise and (ids["email"] or ids["phone"]):
        lo = (received_at - timedelta(hours=48)).isoformat()
        cust = [r["id"] for r in db.execute("SELECT id FROM customers WHERE (? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND replace(phone,' ','') LIKE '%' || ?)",
                                            (ids["email"], ids["email"], ids["phone"], (ids["phone"] or "")[-10:]))]
        if cust:
            rows = _pay(db, "customer_id IN (%s) AND captured_at >= ? AND captured_at <= ?" % ",".join("?" * len(cust)), *cust, lo, received_at.isoformat())
            same = [r for r in rows if r["amount_paise"] == x.amount_paise]
            if same:
                return [Candidate(r["id"], "exact_contact", round(0.85 - 0.10 * (len(rows) - 1), 2)) for r in same], gave
    return [], gave


def _sigmoid(z: float) -> float:
    return 1 / (1 + math.exp(-z))


def _norm(s: str | None) -> str:
    return re.sub(r"[^a-z]", "", (s or "").lower())


def features(p: sqlite3.Row, x: Extraction, ids: dict, pool: list[sqlite3.Row], center: datetime | None) -> dict:
    t = datetime.fromisoformat(p["captured_at"])
    f_amount = 1.0 if p["amount_paise"] == x.amount_paise else 0.6 if abs(p["amount_paise"] - x.amount_paise) <= 0.05 * x.amount_paise else 0.0
    f_time = math.exp(-abs((t - center).total_seconds()) / 60 / 90) if center else 0.3
    f_method = 0.5 if x.method == "unknown" else 1.0 if x.method == p["method"] else 0.0
    pay_name = _norm(p["app"]) or _norm(p["issuer"])
    f_bank = 0.5 if not x.app_or_bank_name else 1.0 if _norm(x.app_or_bank_name) in (pay_name, _norm(p["issuer"])) else 0.0
    phone = ids.get("phone") or ""
    f_contact = 1.0 if phone and (p["contact"] or "").replace(" ", "").endswith(phone[-4:]) else 0.0
    f_card = 1.0 if ids.get("card4") and p["card_last4"] == ids["card4"] else 0.0
    f_vpa = 1.0 if ids.get("vpa") and p["vpa"] and ids["vpa"].split("@")[-1] == p["vpa"].split("@")[-1] else 0.0
    near = sum(1 for o in pool if o["id"] != p["id"] and o["amount_paise"] == p["amount_paise"] and abs((datetime.fromisoformat(o["captured_at"]) - t).total_seconds()) <= 1800)
    return {"amount": f_amount, "time": f_time, "method": f_method, "bank_app": f_bank, "contact_partial": f_contact, "card_last4": f_card, "vpa_suffix": f_vpa, "crowding": math.log(1 + near)}


def raw_score(f: dict) -> float:
    return _sigmoid(sum(WEIGHTS[k] * v for k, v in f.items()) + BIAS)


def load_calibrator(path: Path = CALIBRATOR) -> dict | None:
    return json.loads(path.read_text()) if path.exists() else None


def calibrate(score: float, cal: dict | None) -> float:
    """Isotonic map: a monotone step function fitted on labelled pairs. Without one the raw score is returned."""
    if not cal:
        return score
    xs, ys = cal["x"], cal["y"]
    if score <= xs[0]:
        return ys[0]
    for i in range(1, len(xs)):
        if score <= xs[i]:
            w = (score - xs[i - 1]) / (xs[i] - xs[i - 1]) if xs[i] > xs[i - 1] else 1.0
            return ys[i - 1] + w * (ys[i] - ys[i - 1])
    return ys[-1]


def fuzzy(db: sqlite3.Connection, red: Redacted, x: Extraction, received_at: datetime, cal: dict | None = None, limit: int = 3) -> list[Candidate]:
    if not x.amount_paise:
        return []
    lo, hi = (x.window.start - timedelta(hours=6), x.window.end + timedelta(hours=6)) if x.window and x.window.resolved else (received_at - timedelta(hours=72), received_at)
    pool = _pay(db, "captured_at >= ? AND captured_at <= ? AND amount_paise BETWEEN ? AND ?", lo.isoformat(), hi.isoformat(), int(x.amount_paise * 0.95), int(x.amount_paise * 1.05) + 1)
    ids = {k: red.value(getattr(x.ids, k)) for k in ("phone", "vpa", "card4")}
    center = x.window.start + (x.window.end - x.window.start) / 2 if x.window and x.window.resolved else None
    out = []
    for p in pool:
        f = features(p, x, ids, pool, center)
        out.append(Candidate(p["id"], "fuzzy", calibrate(raw_score(f), cal), f))
    return sorted(out, key=lambda c: -c.score)[:limit]


def decide(c: list[Candidate], t_auto: float = T_AUTO) -> str:
    """SPEC 11.3.2: matched | needs_detail | no_payment_found, for the founder's suggestion list."""
    if not c or c[0].score < T_MIN:
        return "no_payment_found"
    if c[0].score >= t_auto and (len(c) == 1 or c[0].score - c[1].score >= MARGIN):
        return "matched"
    return "needs_detail"


def lookup(db: sqlite3.Connection, red: Redacted, x: Extraction, received_at: datetime, cal: dict | None = None) -> MatchResult:
    hits, gave = exact(db, red, x, received_at)
    if hits:
        return MatchResult("matched", exact=hits)
    return MatchResult("not_found" if gave else "needs_detail", suggestions=fuzzy(db, red, x, received_at, cal), key_not_found=gave)
