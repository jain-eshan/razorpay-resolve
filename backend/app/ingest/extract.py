"""Triage and extraction (F-20), rule-based. English and Hinglish. The result has the shape of SPEC 11.2, so a model-based extractor can
replace it behind the same function. Runs on redacted text only; identifiers arrive as tokens.

The customer's message is data. If it tries to instruct the system, `injection_suspected` is set and the thread goes to a human."""
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from .redact import Redacted
from .timeparse import Window, resolve

Claim = Literal["debited_no_access", "debited_no_order", "charged_twice", "refund_not_received", "charged_after_cancel", "renewal_failed", "payment_failed", "other"]
Triage = Literal["payment", "access", "refund", "subscription", "other"]


class Ids(BaseModel):
    payment_id: str | None = None
    order_id: str | None = None
    rrn: str | None = None
    email: str | None = None
    phone: str | None = None
    vpa: str | None = None
    card4: str | None = None


class Extraction(BaseModel):
    topic: Triage
    is_payment_related: bool
    language: Literal["en", "hi_latn", "hi_deva", "mixed", "other"]
    claim: Claim
    amount_paise: int | None = None
    amount_count: int | None = None
    stated_time_text: str | None = None
    method: Literal["upi", "card", "netbanking", "wallet", "unknown"] = "unknown"
    app_or_bank_name: str | None = None
    ids: Ids = Ids()
    product_or_plan: str | None = None
    customer_wants: Literal["access", "refund", "explanation", "cancel", "unknown"] = "unknown"
    sentiment: Literal["calm", "upset", "threatening_chargeback_or_public"] = "calm"
    injection_suspected: bool = False
    window: Window | None = None


HINGLISH = {"hua", "hai", "nahi", "nhi", "nahin", "kat", "kata", "gaya", "gaye", "paisa", "paise", "par", "bhai", "mera", "meri", "kal", "raat", "ka", "ki", "ke", "mila",
            "baar", "rupaye", "rupay", "aaj", "abhi", "tak", "kya", "ho", "diye", "diya", "kar", "kiya", "karo", "chalu", "dikh", "raha", "rahi", "se", "mein", "mai", "wapas", "kyun", "kyu"}
APPS = {"phonepe": "PhonePe", "phone pe": "PhonePe", "gpay": "GPay", "google pay": "GPay", "paytm": "Paytm", "bhim": "BHIM", "amazon pay": "Amazon Pay", "cred": "CRED",
        "hdfc": "HDFC", "icici": "ICICI", "sbi": "SBI", "axis": "Axis", "kotak": "Kotak", "pnb": "PNB", "yes bank": "Yes Bank"}
PLANS = ("mock test pack", "test series", "premium monthly", "premium annual", "premium")
INJECTION = re.compile(r"ignore (?:all |the |any )?(?:previous|above|prior|earlier)|disregard (?:all |the )?(?:previous|above|instructions)|system prompt|you are (?:now )?(?:an? |the )?(?:admin|assistant|ai|bot|system)"
                       r"|developer mode|new instructions|act as (?:an? |the )?\w+|approve (?:the |my )?refund|mark (?:this |it )?(?:as )?(?:resolved|paid|refunded)|\bsystem\s*:|\bassistant\s*:|<\s*/?system|reveal (?:your|the) (?:prompt|instructions|api)", re.IGNORECASE)
THREAT = re.compile(r"charge\s?back|consumer court|legal action|lawyer|police|\bfir\b|tweet|twitter|post (?:this|it) (?:on|everywhere)|fraud|scam|cheat|ombudsman|\brbi\b|expose|review bomb", re.IGNORECASE)
UPSET = re.compile(r"worst|useless|pathetic|bakwas|bekar|harass|!!|angry|disgust|waste", re.IGNORECASE)


def _amount(text: str) -> int | None:
    pats = (r"(?:rs\.?|₹|inr|rupees?)\s*(\d[\d,]*(?:\.\d{1,2})?)", r"(\d[\d,]*(?:\.\d{1,2})?)\s*(?:rs\b|rupees?|rupaye|rupay|/-|₹)",
            r"(?<![\w\[.,])(\d{2,6})(?:\s*(?:ka|ke|ki|deduct|debit|kat|kata|cut|charged|paid)\b)", r"(?:paid|debited|deducted|charged|paisa kat gaya|kat gaya)\s+(?:of\s+)?(\d[\d,]*(?:\.\d{1,2})?)")
    for p in pats:
        if m := re.search(p, text, re.IGNORECASE):
            return round(float(m.group(1).replace(",", "")) * 100)
    return None


def _language(text: str) -> str:
    if re.search(r"[ऀ-ॿ]", text):
        return "mixed" if re.search(r"[A-Za-z]{3,}", re.sub(r"\[[A-Z0-9_]+\]", "", text)) else "hi_deva"
    words = re.findall(r"[a-z]+", text.lower())
    return "hi_latn" if sum(w in HINGLISH for w in words) >= 2 else "en"


def _claim(low: str, known_payment: bool = False) -> Claim:
    debited = known_payment or re.search(r"debit|deduct|\bkat\b|\bkata\b|kat gaya|kat gaye|charged|paid|paise gaye|money (?:gone|cut)|payment (?:done|kiya|ho gaya|hua)", low)
    if re.search(r"twice|two times|2 times|double|\b2 baar|do baar|dobara|duplicate|\b(?:2|two) payments", low):
        return "charged_twice"
    if re.search(r"refund|paise wapas|money back|wapas nahi|wapas nhi", low) and re.search(r"not|nahi|nhi|still|abhi tak|pending|nahin|never|haven.?t|didn.?t|yet", low):
        return "refund_not_received"
    if re.search(r"cancel", low) and re.search(r"still|again|fir se|phir|charged|deduct|kat|debit", low):
        return "charged_after_cancel"
    if re.search(r"renew|auto.?pay|mandate|subscription", low) and re.search(r"fail|not|nahi|nhi|stopped|cut|expired", low):
        return "renewal_failed"
    if debited and re.search(r"no order|order (?:not|nahi|nhi)|not placed|order missing|booking (?:not|nahi)", low):
        return "debited_no_order"
    if debited and re.search(r"not (?:active|activated|received|working|showing|unlocked)|activate nahi|nahi mila|nahi chal|nhi mila|no access|still (?:shows?|showing)|free plan|can.?t access|cannot access|locked|nahi dikh|"
                             r"nahi khul|not (?:yet )?(?:got|get)|premium nahi|chalu nahi|nhi chal|access nahi", low):
        return "debited_no_access"
    if re.search(r"fail|declined|not going through|nahi ho|nhi ho|error|unsuccessful", low) and re.search(r"payment|\bpay\b|paid|transaction|\bupi\b|\bcard\b|checkout|paisa|paise|debit|deduct|\bkat\b", low):
        return "debited_no_order" if debited else "payment_failed"
    if debited:
        return "debited_no_access"
    return "other"


TOPIC: dict[str, Triage] = {"debited_no_access": "access", "debited_no_order": "payment", "charged_twice": "payment", "refund_not_received": "refund",
                            "charged_after_cancel": "subscription", "renewal_failed": "subscription", "payment_failed": "payment", "other": "other"}


def extract(red: Redacted, received_at: datetime, known_payment: bool = False) -> Extraction:
    """`known_payment`: the page that sent the message already names the payment (a help button), so the customer has paid by definition."""
    text, low = red.text, red.text.lower()
    in_text = [t for t in re.findall(r"\[[A-Z0-9_]+_\d+\]", text) if t in red.vault]  # only identifiers in this message, not older ones in the vault
    ids = {k: next((t for t in in_text if red.vault[t][0] == k), None) for k in Ids.model_fields}
    claim = _claim(low, known_payment)
    payment_words = re.search(r"payment|paid|paisa|paise|upi|refund|debit|deduct|charged|subscription|renew|razorpay|transaction|\bkat\b|premium|order", low)
    related = claim != "other" or bool(payment_words) or known_payment
    count = 2 if claim == "charged_twice" else None
    if m := re.search(r"(\d)\s*(?:baar|times)", low):
        count = int(m.group(1))
    app = next((v for k, v in APPS.items() if k in low), None)
    method = "card" if re.search(r"\bcard\b|credit|debit card|visa|mastercard|rupay card", low) else "netbanking" if re.search(r"net.?banking|internet banking", low) else "wallet" if re.search(r"wallet", low) \
        else "upi" if (app in {"PhonePe", "GPay", "Paytm", "BHIM", "Amazon Pay", "CRED"} or re.search(r"\bupi\b|\bvpa\b", low) or ids["rrn"]) else "unknown"
    time_ms = re.finditer(r"((?:aaj|kal|parso|parson|today|yesterday|tonight|\d+ (?:din|days?) (?:pehle|ago))?\s*(?:subah|savere|dopahar|shaam|raat|morning|afternoon|evening|night)?\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|bje))?)", low)
    when = max((m.group(1).strip() for m in time_ms), key=len, default="") or None  # the longest phrase: the pattern also matches the empty string everywhere
    wants = "refund" if re.search(r"refund|wapas|money back|return my", low) and claim != "debited_no_access" else "access" if claim == "debited_no_access" or re.search(r"activate|access|unlock|chalu", low) \
        else "cancel" if "cancel" in low else "explanation" if re.search(r"why|kyun|kyu|explain|reason", low) else "unknown"
    return Extraction(
        topic=TOPIC[claim] if related else "other", is_payment_related=related, language=_language(text), claim=claim if related else "other", amount_paise=_amount(low),
        amount_count=count, stated_time_text=when, method=method, app_or_bank_name=app, ids=Ids(**ids), product_or_plan=next((p.title() for p in PLANS if p in low), None),
        customer_wants=wants, sentiment="threatening_chargeback_or_public" if THREAT.search(text) else "upset" if UPSET.search(text) else "calm",
        injection_suspected=bool(INJECTION.search(text)), window=resolve(when, received_at) if when else None)
