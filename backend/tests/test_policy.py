"""Never-ask lint on the 60-case set (SPEC 4.5): 30 texts that ask for a secret must be blocked, 30 that do not must pass."""
import pytest
from app.conversation.lint import violations
from app.conversation.templates import TEMPLATES

ASKS = [
    "Please send your OTP.", "Share the OTP you received.", "What is your UPI PIN?", "Enter your PIN to confirm.", "Please tell me your CVV.",
    "Send us your card number.", "Can you share your full card number?", "Reply with your password.", "Please provide your net banking password.",
    "Give me your Aadhaar number.", "Send your PAN card number.", "We need your card expiry and CVV.", "Confirm your OTP so we can fix it.",
    "Type the one time password here.", "Read out the OTP from the SMS.", "Forward the OTP message to us.", "What's your MPIN?",
    "Verify your identity by sending your PIN.", "Please share your security code.", "Submit your passcode.",
    "OTP bhej do.", "Apna PIN batao.", "Card number bhejiye.", "CVV batayein please.", "Aapka password kya hai?", "OTP dein.",
    "Hi Amit, to fix this we need your UPI PIN.", "Your payment is found. Now send your Aadhaar number.", "Quick check: what is your net banking password?",
    "Please confirm your card number and expiry date.",
]
SAFE = [
    "We never ask for your OTP or PIN.", "I will never ask for your OTP or PIN.", "Hum kabhi OTP ya PIN nahi maangte.", "Please hide your card number in the screenshot.",
    "Card number chhupa dein.", "Do not share your OTP with anyone.", "Never share your password.", "We do not ask for your CVV.", "Please send the 12-digit UPI ref from your bank app.",
    "Send a screenshot of the payment.", "When did you pay, how much, and with which app?", "Your payment of Rs 299 was found.", "Your Premium Monthly is active now.",
    "Share your UPI reference number.", "Please send the payment ID.", "You can reply with the amount and the time.", "Tell us which bank app you used.",
    "Aap payment ka screenshot bhi bhej sakte hain.", "UPI ref bhej dein.", "Aapne payment kab kiya, kitna kiya, aur kis app se?",
    "Your access is switched on. Nothing to do.", "Hi Neha, sorry about this. Your payment is received.", "Log out and log in again, and tell us if it persists.",
    "We will message you when it is done.", "I'm an AI assistant. I can help find your payment.", "Please keep your OTP private.", "Kisi ko OTP na batayein.",
    "We cannot see your PIN and we do not store it.", "Share the refund ID if you have it.", "Send the order number from your receipt.",
]


@pytest.mark.parametrize("text", ASKS)
def test_asking_for_a_secret_is_blocked(text):
    assert violations(text), text


@pytest.mark.parametrize("text", SAFE)
def test_safe_texts_pass(text):
    assert not violations(text), text


def test_the_set_has_sixty_cases():
    assert len(ASKS) + len(SAFE) == 60


def test_no_template_in_either_language_ever_asks_for_a_secret():
    for tid, t in TEMPLATES.items():
        for lang in ("en", "hi_latn"):
            assert not violations(t[lang]), (tid, lang)


def test_a_softened_hindi_request_is_still_blocked():
    assert violations("OTP bata na")
    assert violations("Apna PIN bhej na")
