"""Never-ask lint (SPEC 3.3, SPEC 4.5). Blocks any outgoing text that asks a customer for a secret: OTP, PIN, CVV, password, a full card number,
Aadhaar, PAN or net-banking credentials. Saying "we never ask for your OTP" is allowed and is in several templates.

A sentence is a violation when it names a secret, is not negated, and asks (a request verb or a question)."""
import re

SECRET = re.compile(r"\botp\b|one.?time (?:password|pin|code)|\bpin\b|\bmpin\b|\bupi pin\b|\bcvv\b|\bcvc\b|\bpassword\b|passcode|full card|card number|card no\b|expiry|aadhaar|aadhar|\bpan\b|"
                    r"net.?banking (?:id|password|credentials|login)|internet banking (?:id|password)|security code|secret code|\bpassword\b", re.IGNORECASE)
NEGATION = re.compile(r"\bnever\b|\bnot\b|n't\b|\bno one\b|kabhi nahi|nahi maangte|nahi poochte|\bnahi\b|\bnhi\b|\bhide\b|\bdo not\b|\bdon't\b|chhupa|mask|\bna\s+(?:bata|bhej|de|share|kar)\w*|\bavoid\b|\bwithout\b|\bkeep\b", re.IGNORECASE)
REQUEST = re.compile(r"\bsend\b|\bshare\b|\bgive\b|\btell\b|\bprovide\b|\benter\b|\btype\b|\breply with\b|\bforward\b|\bread out\b|\bconfirm\b|\bverify\b|\bsubmit\b|\bneed\b|\brequire|\bwhat is\b|\bwhat's\b|"
                     r"\bbhej\b|\bbata\b|\bbatao\b|\bbatayein\b|\bdo\b|\bdein\b|\bdijiye\b|\bchahiye\b|\bbhejiye\b|\bsend karo\b|\bkya hai\b|\?", re.IGNORECASE)


def violations(text: str) -> list[str]:
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
        if SECRET.search(sentence) and REQUEST.search(sentence) and not NEGATION.search(sentence):
            out.append(sentence.strip())
    return out


# No false urgency (BUSINESS_CASE B12, Agent Studio's no-dark-patterns rule). Pressure wording is never allowed. A validity statement ("valid for 48 hours")
# is allowed only when its number comes from the template's `hours` slot, which is the link's real expiry; free text and other templates cannot invent one.
PRESSURE = re.compile(r"\bhurry\b|\blast chance\b|\bact (?:now|fast|quickly)\b|\bdon'?t miss\b|\bdo not miss\b|\blimited[- ](?:time|offer|period|seats|stock)\b|\bonly today\b|\bonly tonight\b|"
                      r"\b(?:hours?|minutes?|mins?|days?) (?:left|remaining)\b|\bexpires? (?:soon|today|tonight)\b|\bbefore it'?s gone\b|\boffer ends\b|\bfinal (?:reminder|notice|warning|call)\b|"
                      r"\bor else\b|\bor you(?: will|'ll)? (?:lose|miss)\b|\bwill be (?:lost|cancelled|closed)\b|\bnow or never\b|\blast date\b|"
                      r"\bjaldi (?:kar|kij|karo|karein|kijiye)\w*|\bwarna\b|\baakhri (?:mauka|moka|din)\b|\bsirf aaj\b|\bmauka (?:haath|hath) se\b", re.IGNORECASE)
VALIDITY = re.compile(r"\b(?:valid|expires?|available|open)\s+(?:for|in|within|until|till)\b|\b\d+\s+(?:hours?|ghante|days?|din)\s+(?:tak\s+)?(?:valid|baad)\b|\bvalid\s+\d+|"
                      r"(?:^|[,;:]\s*|\b(?:please|kindly|must|need to|have to|should|now)\s+)(?:renew|pay|act|respond|reply|complete|book|buy|use|send|share|confirm|upload|submit|claim|register|update)\b[^.!?]*\bwithin\s+\d+\s+(?:hours?|mins?|minutes?|days?)\b|\b\d+\s+(?:ghante|din)\s+(?:ke\s+)?andar\b", re.IGNORECASE)


def urgency_violations(text: str, real_expiry: bool = False) -> list[str]:
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
        if PRESSURE.search(sentence) or (VALIDITY.search(sentence) and not real_expiry):
            out.append(sentence.strip())
    return out
