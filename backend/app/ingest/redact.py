"""Redaction and the token vault (SPEC 3.4, F-54). Identifiers are replaced by tokens before any analysis. The vault maps token to value,
lives in the backend only, and is how an exact-key lookup gets the real number back. Customer text is data, never instructions.

Secrets are different: a card number, an OTP, a PIN, a CVV, a password, an Aadhaar or a PAN that a customer volunteers is removed before anything is stored or
analysed. It is not tokenised and not kept in the vault, because nothing in the product ever needs it back."""
import re
from dataclasses import dataclass, field

# Order matters: email before UPI id (both contain @), phone before the 12-digit reference (+91 plus ten digits is twelve digits).
PATTERNS: tuple[tuple[str, re.Pattern], ...] = (
    ("payment_id", re.compile(r"\bpay_[A-Za-z0-9]{14}\b")),
    ("order_id", re.compile(r"\border_[A-Za-z0-9]{14}\b")),
    ("email", re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")),
    ("vpa", re.compile(r"(?<![\w.])[\w.-]{2,}@[A-Za-z]{2,}\b")),
    ("phone", re.compile(r"(?<![\d])(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)")),
    ("rrn", re.compile(r"(?<![\d])\d{12}(?!\d)")),
    ("card4", re.compile(r"(?i)(?<=ending )\d{4}|(?<=last 4 )\d{4}|(?<=last four )\d{4}|(?<=xxxx )\d{4}|(?<=xxxx)\d{4}")),
)


# A card number: 13 to 19 digits, spaces or dashes allowed, passing the Luhn check (a 12-digit UPI reference is not one and is kept as a key).
CARD = re.compile(r"(?<![\d])(?:\d[ -]?){12,18}\d(?!\d)")
AADHAAR = re.compile(r"(?<![\d])\d{4}[ -]\d{4}[ -]\d{4}(?!\d)")  # written in groups of four; twelve digits in a row is a UPI reference
PAN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
KEYED_DIGITS = re.compile(r"(?i)\b(cvv|cvc|otp|pin|mpin|passcode)\b([^\d\n]{0,12})(\d{3,8})(?!\d)")
KEYED_WORD = re.compile(r"(?i)\b(password)\b(\s*(?:is|:|=|hai)\s*)(\S+)")


def _luhn(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2:
            n = n * 2 - 9 if n * 2 > 9 else n * 2
        total += n
    return total % 10 == 0


def remove_secrets(text: str) -> tuple[str, list[str]]:
    """Replace secrets with [REMOVED]. Returns the text and the kinds removed, never the values."""
    kinds: list[str] = []

    def card(m: re.Match) -> str:
        digits = re.sub(r"\D", "", m.group(0))
        if 13 <= len(digits) <= 19 and _luhn(digits):
            kinds.append("card number")
            return "[REMOVED]"
        return m.group(0)

    text = CARD.sub(card, text)
    for kind, pat in (("aadhaar", AADHAAR), ("pan", PAN)):
        text = pat.sub(lambda m, k=kind: (kinds.append(k), "[REMOVED]")[1], text)
    text = KEYED_DIGITS.sub(lambda m: (kinds.append(m.group(1).lower()), f"{m.group(1)}{m.group(2)}[REMOVED]")[1], text)
    text = KEYED_WORD.sub(lambda m: (kinds.append("password"), f"{m.group(1)}{m.group(2)}[REMOVED]")[1], text)
    return text, kinds


@dataclass
class Redacted:
    text: str
    vault: dict[str, tuple[str, str]] = field(default_factory=dict)  # token -> (kind, value)
    secrets: list[str] = field(default_factory=list)  # kinds of secret removed (never the values)

    def value(self, token: str | None) -> str | None:
        return self.vault[token][1] if token in self.vault else None


def redact(text: str) -> Redacted:
    vault: dict[str, tuple[str, str]] = {}
    seen: dict[tuple[str, str], str] = {}
    counts: dict[str, int] = {}

    def token(kind: str, value: str) -> str:
        if (kind, value) not in seen:
            counts[kind] = counts.get(kind, 0) + 1
            seen[(kind, value)] = f"[{kind.upper()}_{counts[kind]}]"
            vault[seen[(kind, value)]] = (kind, value)
        return seen[(kind, value)]

    text, secrets = remove_secrets(text)
    for kind, pat in PATTERNS:
        text = pat.sub(lambda m, k=kind: token(k, m.group(0)), text)
    return Redacted(text, vault, secrets)
