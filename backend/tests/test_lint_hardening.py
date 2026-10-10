"""A second round on the two outgoing-text lints, from an independent review that tried phrasings the first set did not (10 Oct 2026): spaced-out letters, nouns the
first list lacked, negation used as a loophole, and Hinglish verbs. Each text is one the reviewer or the builder wrote to get past the lint."""
import pytest
from app.conversation.lint import urgency_violations, violations
from app.conversation.templates import TEMPLATES

ASKS = [
    "Please share your card details to verify.", "Please send the 3 digits on the back of your card.", "Tell us the number on the back of your card.",
    "Kindly share the code we texted you.", "Please share your 6 digit code from the SMS.", "Send the verification code.", "Please send your login credentials.",
    "Share your security number.", "Send a photo of your card.", "What is your mother's name?", "Pay Rs 1 to verify your account.", "Install AnyDesk so we can help.",
    "Please call us on this number to fix it.", "Apna pin daalein.", "Please darj karein apna OTP.", "Please input your PIN.", "Bank se aaya code bhej dijiye.",
    "Send your O T P.", "Send your 0TP.", "Send your O.T.P now.", "Share your c v v.",
    "Please send your OTP, we never ask for it otherwise.", "Don't worry, just send your OTP.", "Send your OTP and do not share it with anyone else.",
    "Send your OTP without delay.", "Please send your PIN. We will keep it safe.", "Reply with your card number, we do not store it.", "To fix this, please share your Aadhaar number.",
    "Aapka OTP kya hai?", "Screen share karke dikhaiye.",
]
SAFE = [
    "We will never ask you to install an app.", "We never ask for your card details.", "Do not share your verification code with anyone.", "Hum kabhi OTP, PIN ya card details nahi maangte.",
    "Your payment of Rs 599 was found.", "Please send the 12-digit UPI ref from your bank app.", "Share the refund ID if you have it.", "Please do not click links that ask for your PIN.",
    "Never call a number that asks for your OTP.", "Hum aapse OTP kabhi nahi maangte.", "Kisi ko bhi apna OTP na batayein.", "Your access is switched on. Nothing to do.",
    "We will message you here as soon as it is active.", "Please hide your card number in the screenshot.", "Send a screenshot of the payment.",
]
PRESSURE = [
    "Pay now or lose access.", "Your access will end in 3 hours.", "Act immediately.", "Please reply ASAP.", "Time is running out.", "Your account will be blocked.",
    "Jaldi se pay karein.", "Turant renew karein.", "Aaj hi pay karein.", "Pay before midnight.", "Only 2 slots left.", "H U R R Y, this link will not last.",
    "Renew right away or miss out.", "This is your final warning.", "Your plan will be cancelled if you wait.",
]
CALM = [
    "Your access is switched on. Nothing to do.", "We will message you when it is done.", "Your bank will reverse it by 3 Oct.", "Take your time, the link is here.",
    "Here is your link to renew your plan.", "We have kept your access on until 4 Oct.", "Aapka access chalu hai.", "Pay when you are ready.",
]


@pytest.mark.parametrize("text", ASKS)
def test_phrasings_that_got_past_the_first_lint_are_blocked(text):
    assert violations(text), text


@pytest.mark.parametrize("text", SAFE)
def test_safe_texts_still_pass_the_never_ask_lint(text):
    assert not violations(text), text


@pytest.mark.parametrize("text", PRESSURE)
def test_pressure_phrasings_are_blocked(text):
    assert urgency_violations(text, real_expiry=True), text


@pytest.mark.parametrize("text", CALM)
def test_calm_texts_still_pass_the_pressure_lint(text):
    assert not urgency_violations(text), text


def test_no_real_template_is_caught_by_either_lint_in_either_language():
    for tid, t in TEMPLATES.items():
        for lang in ("en", "hi_latn"):
            assert not violations(t[lang]), (tid, lang, violations(t[lang]))
            assert not urgency_violations(t[lang], real_expiry="hours" in t["slots"]), (tid, lang)
