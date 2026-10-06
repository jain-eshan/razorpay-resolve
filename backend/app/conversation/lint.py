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
