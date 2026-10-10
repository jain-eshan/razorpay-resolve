"""Never-ask lint on the 60-case set (SPEC 4.5): 30 texts that ask for a secret must be blocked, 30 that do not must pass."""
import pytest
from app.channels import policy
from app.conversation.lint import urgency_violations, violations
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


# ---------- no false urgency (BUSINESS_CASE B12, PRD D20) ----------
PRESSURE = [
    "Hurry, this link will not last.", "Last chance to renew.", "Act now or lose your plan.", "Don't miss this.", "Limited time only.", "Only today.",
    "You have 2 hours left.", "Just 3 hours remaining to pay.", "Your link expires soon.", "Your offer ends tonight.", "Final reminder before we close it.",
    "Pay now or else your access goes.", "Pay or you will lose your seat.", "Your plan will be cancelled.", "It is now or never.", "The last date is tomorrow.",
    "Jaldi karein, link khatam ho jayega.", "Abhi pay karo warna access band.", "Yeh aakhri mauka hai.", "Sirf aaj ke liye.",
]
CALM = [
    "Your Premium Monthly is active now.", "Here is your link to renew. Take your time.", "Pay when you are ready.", "Your bank will reverse it by 3 Oct.",
    "We have kept your access on until 4 Oct.", "I'm an AI assistant. I can help find your payment.", "Please send the 12-digit UPI ref from your bank app.",
    "We will message you when it is done.", "Aapka payment jaldi dhoondhne ke liye UPI ref bhej dein.", "Hum kabhi OTP ya PIN nahi maangte.",
    "If the money left your account, your bank will reverse it within 3 days.", "We will send you the link within 2 hours.", "We will message you here within 1 hour.",
]


@pytest.mark.parametrize("text", PRESSURE)
def test_pressure_wording_is_blocked_even_with_a_real_expiry(text):
    assert urgency_violations(text, real_expiry=True), text


@pytest.mark.parametrize("text", CALM)
def test_calm_wording_passes(text):
    assert not urgency_violations(text), text


def test_a_validity_statement_needs_a_real_expiry():
    text = "Here is your link. It is valid for 48 hours."
    assert urgency_violations(text) and not urgency_violations(text, real_expiry=True)
    assert urgency_violations("Renew within 24 hours.") and urgency_violations("24 ghante ke andar renew karein.")
    assert urgency_violations("Yeh 24 ghante tak valid hai.") and not urgency_violations("Yeh 24 ghante tak valid hai.", real_expiry=True)


def test_no_template_pressures_a_customer_and_only_link_templates_state_an_expiry():
    for tid, t in TEMPLATES.items():
        for lang in ("en", "hi_latn"):
            assert not urgency_violations(t[lang], real_expiry="hours" in t["slots"]), (tid, lang)
            if "hours" not in t["slots"]:
                assert not urgency_violations(t[lang]), (tid, lang)


def test_an_invented_expiry_is_refused_by_the_send_path(fresh):
    cust = fresh.execute("SELECT customer_id FROM payments LIMIT 1").fetchone()["customer_id"]
    slots = {"first_name": "Asha", "date": "29 Sep", "grace_until": "4 Oct", "plan": "Premium Monthly"}  # T-G1 has no `hours` slot
    d = policy.check(fresh, customer_id=cust, template_id="T-G1", language="en", slots=slots, body="Your access is kept. Renew within 24 hours.", approved_by="merchant:founder")
    assert not d.allowed and any("not real" in r for r in d.reasons)


def test_the_real_link_expiry_passes_and_pressure_added_to_it_does_not(fresh):
    cust = fresh.execute("SELECT customer_id FROM payments LIMIT 1").fetchone()["customer_id"]
    slots = {"first_name": "Asha", "amount": "599", "hours": 48, "plan": "Premium Monthly"}
    ok = policy.check(fresh, customer_id=cust, template_id="T-G2", language="en", slots=slots, body="Hi Asha, the payment network issue is fixed. Here is your link to renew your Premium Monthly for ₹599. It is valid for 48 hours.", approved_by="merchant:founder")
    assert not any("not real" in r for r in ok.reasons)
    bad = policy.check(fresh, customer_id=cust, template_id="T-G2", language="en", slots=slots, body="Hi Asha, last chance. Here is your link for ₹599. It is valid for 48 hours.", approved_by="merchant:founder")
    assert any("not real" in r for r in bad.reasons)
