"""Never-ask lint (SPEC 3.3, SPEC 4.5). Blocks any outgoing text that asks a customer for a secret: OTP, PIN, CVV, password, a verification code, a full card number
or card details, Aadhaar, PAN, net-banking credentials, a payment "to verify", an app install or a call. Saying "we never ask for your OTP" is allowed and is in several templates.

A text is read clause by clause (split at commas, semicolons, "and", "but", "just", "aur", "lekin"), after spaced-out letters are joined ("O T P" becomes "OTP").
A clause is a violation when it names a secret, asks (a request verb or a question) and is not negated. In English a negation only counts when it comes before the
secret ("never share your OTP"), so "send your OTP, we never ask otherwise" and "send your OTP without delay" are still caught. In Hinglish a negation may follow the
noun ("OTP kisi ko na batayein")."""
import re

SECRET = re.compile(
    r"\botp\b|one.?time (?:password|pin|code)|\bpin\b|\bmpin\b|\bupi pin\b|\bcvv\b|\bcvc\b|\bpassword\b|passcode|full card|card number|card no\b|card details|card info(?:rmation)?|"
    r"\bexpiry\b|aadhaar|aadhar|\bpan\b|net.?banking (?:id|password|credentials|login)|internet banking (?:id|password)|security (?:code|number)|secret code|"
    r"verification code|auth\w* code|(?:sms|bank|received|texted|sent|aaya) code|\d[- ]?digit (?:code|number|pin|otp)|code (?:from|we|that|jo|bhej|aaya)|"
    r"back of (?:your|the) card|(?:photo|picture|screenshot|image) of (?:your |the )?(?:card|cvv|pin)|login (?:id|details|credentials|info)|\bcredentials\b|"
    r"mother'?s (?:maiden )?name|date of birth|\bdob\b|bank (?:login|details|password)|account password", re.IGNORECASE)
# Not a secret but never asked either (PRD copy rule): a payment to verify, a remote-access app, an install, a call.
SCAM = re.compile(
    r"\b(?:pay|transfer|send)\b[^.?!]{0,30}\b(?:to|for) verif|\banydesk\b|\bteamviewer\b|\bquicksupport\b|screen.?shar|"
    r"(?:install|download)\s+(?:the |our |an? )?(?:app|apk|anydesk|teamviewer|quicksupport|file)|\bcall (?:us|me|this number)\b|\bphone call\b", re.IGNORECASE)
NEG_EN = re.compile(r"\bnever\b|\bnot\b|n't\b|\bno one\b|\bnobody\b|\bdo not\b|\bhide\b|\bmask\b", re.IGNORECASE)
NEG_HI = re.compile(r"kabhi nahi|nahi maangte|nahi poochte|\bnahi\b|\bnhi\b|chhupa|\bna\s+(?:bata|bhej|de|share|kar)\w*", re.IGNORECASE)
REQUEST = re.compile(
    r"\bsend\b|\bshare\b|\bgive\b|\btell\b|\bprovide\b|\benter\b|\btype\b|\binput\b|\bkey in\b|\breply with\b|\bforward\b|\bread out\b|\bconfirm\b|\bverify\b|\bsubmit\b|"
    r"\bneed\b|\brequire|\bwhat is\b|\bwhat's\b|\bdisclose\b|\breveal\b|\bupload\b|\bclick\b|\bopen\b|\bpay\b|\binstall\b|\bdownload\b|\bcall\b|"
    r"\bbhej\b|\bbata\b|\bbatao\b|\bbatayein\b|\bbataiye\b|\bdo\b|\bdein\b|\bdijiye\b|\bchahiye\b|\bbhejiye\b|\bsend karo\b|\bkya hai\b|\bdaal\w*|\bdalo\b|\bdarj\b|"
    r"\bbhar\w*|\bde sakte\b|\bde do\b|\bdedo\b|\bdikha\w*|\bbhejna\b|\?", re.IGNORECASE)
CLAUSE = re.compile(r",|;|\bbut\b|\band\b|\bjust\b|\baur\b|\blekin\b|\bpar\b", re.IGNORECASE)
_SPACED = re.compile(r"(?<![A-Za-z])(?:[A-Za-z][ .\-]){2,}[A-Za-z](?![A-Za-z])")
_LEET = re.compile(r"\b0tp\b|\bp1n\b|\bcv\dv\b", re.IGNORECASE)


def normalise(text: str) -> str:
    """Join letters spelled out one by one ("O T P", "c.v.v", "H U R R Y") and common digit swaps ("0TP", "P1N") so the patterns see the word."""
    text = _SPACED.sub(lambda m: re.sub(r"[ .\-]", "", m.group(0)), text)
    return _LEET.sub(lambda m: {"0tp": "otp", "p1n": "pin"}.get(m.group(0).lower(), "cvv"), text)


def _negated(clause: str, secret_at: int) -> bool:
    en = NEG_EN.search(clause)
    return bool((en and en.start() < secret_at) or NEG_HI.search(clause))


def violations(text: str) -> list[str]:
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", normalise(text)):
        for clause in CLAUSE.split(sentence):
            sec = SECRET.search(clause) or SCAM.search(clause)
            if sec and REQUEST.search(clause) and not _negated(clause, sec.start()):
                out.append(sentence.strip())
                break
    return out


# No false urgency (BUSINESS_CASE B12, Agent Studio's no-dark-patterns rule). Pressure wording is never allowed. A validity statement ("valid for 48 hours")
# is allowed only when its number comes from the template's `hours` slot, which is the link's real expiry; free text and other templates cannot invent one.
PRESSURE = re.compile(
    r"\bhurry\b|\blast chance\b|\bact (?:now|fast|quickly|immediately)\b|\bdon'?t miss\b|\bdo not miss\b|\blimited[- ](?:time|offer|period|seats|stock)\b|\bonly today\b|\bonly tonight\b|"
    r"\b(?:hours?|minutes?|mins?|days?) (?:left|remaining)\b|\bexpires? (?:soon|today|tonight)\b|\bbefore it'?s gone\b|\boffer ends\b|\bfinal (?:reminder|notice|warning|call)\b|"
    r"\bor else\b|\bor (?:you(?: will|'ll)? )?(?:lose|miss)\b|\blose (?:your )?(?:access|plan|seat|account|spot)\b|\bwill be (?:lost|cancelled|closed|blocked|suspended|deactivated|disabled|terminated)\b|"
    r"\bwill (?:end|expire)\b|\bnow or never\b|\blast date\b|\bimmediately\b|\basap\b|\bright away\b|\b(?:time is )?running out\b|\b\d+ (?:slots?|seats?|spots?) left\b|"
    r"\bbefore (?:midnight|tonight|it is too late|it'?s too late|too late)\b|\b(?:pay|renew|act|hurry|do it)\s+now\b|"
    r"\bjaldi (?:se |kar|kij|karo|karein|kijiye)\w*|\bturant\b|\baaj hi\b|\babhi hi\b|\bwarna\b|\baakhri (?:mauka|moka|din)\b|\bsirf aaj\b|\bmauka (?:haath|hath) se\b", re.IGNORECASE)
VALIDITY = re.compile(r"\b(?:valid|expires?|available|open)\s+(?:for|in|within|until|till)\b|\b\d+\s+(?:hours?|ghante|days?|din)\s+(?:tak\s+)?(?:valid|baad)\b|\bvalid\s+\d+|"
                      r"(?:^|[,;:]\s*|\b(?:please|kindly|must|need to|have to|should|now)\s+)(?:renew|pay|act|respond|reply|complete|book|buy|use|send|share|confirm|upload|submit|claim|register|update)\b[^.!?]*\bwithin\s+\d+\s+(?:hours?|mins?|minutes?|days?)\b|\b\d+\s+(?:ghante|din)\s+(?:ke\s+)?andar\b", re.IGNORECASE)


def urgency_violations(text: str, real_expiry: bool = False) -> list[str]:
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", normalise(text)):
        if PRESSURE.search(sentence) or (VALIDITY.search(sentence) and not real_expiry):
            out.append(sentence.strip())
    return out
