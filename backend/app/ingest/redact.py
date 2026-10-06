"""Redaction and the token vault (SPEC 3.4, F-54). Identifiers are replaced by tokens before any analysis. The vault maps token to value,
lives in the backend only, and is how an exact-key lookup gets the real number back. Customer text is data, never instructions."""
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


@dataclass
class Redacted:
    text: str
    vault: dict[str, tuple[str, str]] = field(default_factory=dict)  # token -> (kind, value)

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

    for kind, pat in PATTERNS:
        text = pat.sub(lambda m, k=kind: token(k, m.group(0)), text)
    return Redacted(text, vault)
