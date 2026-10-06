"""Status messages to affected customers (FR-AC-8, SPEC 4.4, v1 11.8): templates only, numbers only from slots, merchant as sender.

The text is never written by a model here. `render` fills a template; `numbers_ok` fails the draft if any digit run is neither in a slot
nor in the template's own wording."""
import re
import sqlite3
from datetime import datetime

from ..conversation.templates import TEMPLATES
from ..schemas import MessagePreview

LANGS = ("en", "hi_latn")


def inr(paise: int) -> str:
    """Indian digit grouping without the symbol: 240000 paise -> '2,400'. Whole rupees only drop the decimals."""
    rupees, rest = divmod(paise, 100)
    s = str(rupees)
    s = s[-3:] if len(s) <= 3 else re.sub(r"(?<=\d)(?=(\d\d)+$)", ",", s[:-3]) + "," + s[-3:]
    return s if not rest else f"{s}.{rest:02d}"


def slots_for(db: sqlite3.Connection, payment_id: str) -> dict:
    r = db.execute("""SELECT p.amount_paise, p.captured_at, p.rrn, c.name, c.language_pref, m.name AS merchant,
                      COALESCE((SELECT pl.name FROM orders o JOIN plans pl ON pl.id = o.plan_id WHERE o.id = p.order_id),
                               (SELECT pl.name FROM subscriptions s JOIN plans pl ON pl.id = s.plan_id WHERE s.id = p.subscription_id), 'Premium Monthly') AS plan
                      FROM payments p JOIN customers c ON c.id = p.customer_id JOIN merchants m ON m.id = p.merchant_id WHERE p.id = ?""", (payment_id,)).fetchone()
    d = datetime.fromisoformat(r["captured_at"])
    return {"first_name": r["name"].split()[0], "merchant": r["merchant"].split(" (")[0], "amount": inr(r["amount_paise"]), "date": f"{d.day} {d:%b}",
            "plan": r["plan"], "rrn": r["rrn"] or "", "_lang": r["language_pref"] if r["language_pref"] in LANGS else "en"}


def pick(complained: bool, slots: dict, language: str) -> tuple[str, str]:
    """Template id and language for one customer. 'auto' follows the customer's own language."""
    return ("T-A2" if complained else "T-A1"), (slots["_lang"] if language == "auto" else language)


def render(template_id: str, language: str, slots: dict) -> str:
    t = TEMPLATES[template_id]
    return t[language].format(**{k: slots[k] for k in t["slots"]})


def numbers_ok(template_id: str, language: str, slots: dict, body: str) -> bool:
    literal = set(re.findall(r"\d+", re.sub(r"{\w+}", "", TEMPLATES[template_id][language])))
    rest = body
    for v in sorted((str(slots[k]) for k in TEMPLATES[template_id]["slots"]), key=len, reverse=True):  # longest first: a short amount can sit inside a long UPI ref
        rest = rest.replace(v, "")
    return set(re.findall(r"\d+", rest)) <= literal


def sender(slots: dict) -> str:
    return f"{slots['merchant']} payment help, powered by Razorpay"


def previews(db: sqlite3.Connection, payment_ids: list[str], complained: set[str], language: str) -> list[MessagePreview]:
    """One preview per (template, language) group, with the number of customers it goes to and a sample rendered for the first of them."""
    groups: dict[tuple[str, str], list[tuple[str, dict]]] = {}
    for pid in payment_ids:
        s = slots_for(db, pid)
        groups.setdefault(pick(pid in complained, s, language), []).append((pid, s))
    out = []
    for (tid, lang), rows in sorted(groups.items()):
        s = rows[0][1]
        out.append(MessagePreview(template_id=tid, language=lang, category=TEMPLATES[tid]["category"], sender=sender(s), body=render(tid, lang, s),
                                  recipients=len(rows), holdout_allowed=False))
    return out
