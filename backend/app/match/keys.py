"""Exact-key extraction and lookup (SPEC 11.3.1, keys 1 to 3). R1 uses regexes only; the model-based extraction arrives in R3."""
import re
import sqlite3

PAYMENT_ID = re.compile(r"\bpay_[A-Za-z0-9]{14}\b")
ORDER_ID = re.compile(r"\border_[A-Za-z0-9]{14}\b")
RRN = re.compile(r"(?<!\d)\d{12}(?!\d)")


def extract_keys(text: str) -> dict[str, list[str]]:
    return {"payment_id": PAYMENT_ID.findall(text), "order_id": ORDER_ID.findall(text), "rrn": RRN.findall(text)}


def complaints_by_payment(db: sqlite3.Connection) -> dict[str, list[sqlite3.Row]]:
    """payment_id -> complaints that name it by an exact key. Priority: payment id, order id, RRN."""
    by_rrn = {r["rrn"]: r["id"] for r in db.execute("SELECT id, rrn FROM payments WHERE rrn IS NOT NULL")}
    by_order = {r["order_id"]: r["id"] for r in db.execute("SELECT id, order_id FROM payments WHERE order_id IS NOT NULL AND status != 'failed'")}
    out: dict[str, list[sqlite3.Row]] = {}
    for c in db.execute("SELECT * FROM complaints ORDER BY received_at"):
        keys = extract_keys(c["raw_text"])
        pid = (keys["payment_id"] or [None])[0] or by_order.get((keys["order_id"] or [None])[0]) or next((by_rrn[k] for k in keys["rrn"] if k in by_rrn), None)
        if pid:
            out.setdefault(pid, []).append(c)
    return out
