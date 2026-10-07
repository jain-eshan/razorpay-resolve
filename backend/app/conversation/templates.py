"""Message templates. Frozen IDs and slots in R0 (contracts-v0.1). Wording may be refined by stream C without an ID or slot change.

Rules (docs/SPEC.md 4.4, 4.5): every template has an English and a Hinglish (Latin script) variant. Rendered text may
contain digits only if they appear in the template literal (for example "12-digit") or equal a slot value. Never-say and
never-ask lists are enforced by conversation/lint.py from R3. Category is the WhatsApp message category.
"""
from typing import TypedDict


class Template(TypedDict):
    use: str
    category: str   # utility | service | service_promotional
    slots: list[str]
    en: str
    hi_latn: str


TEMPLATES: dict[str, Template] = {'T-A1': {'use': 'Silent victim, access fixed',
          'category': 'utility',
          'slots': ['amount', 'date', 'first_name', 'merchant', 'plan', 'rrn'],
          'en': 'Hi {first_name}, your {date} payment of Rs {amount} to {merchant} went through, but your '
                '{plan} was not switched on. It is active now. Nothing to do. UPI ref: {rrn}. We never ask '
                'for your OTP or PIN.',
          'hi_latn': 'Hi {first_name}, {date} ka aapka Rs {amount} ka payment {merchant} ko mil gaya tha, '
                     'par {plan} chalu nahi hua tha. Ab chalu hai. Aapko kuch nahi karna. UPI ref: {rrn}. '
                     'Hum kabhi OTP ya PIN nahi maangte.'},
 'T-A2': {'use': 'Complainant, access fixed',
          'category': 'utility',
          'slots': ['amount', 'date', 'first_name', 'plan', 'rrn'],
          'en': 'Hi {first_name}, sorry about this. We received your Rs {amount} payment on {date} (ref '
                '{rrn}). Your {plan} is active now.',
          'hi_latn': 'Hi {first_name}, pareshani ke liye sorry. {date} ka aapka Rs {amount} payment mil gaya '
                     'hai (ref {rrn}). {plan} ab chalu hai.'},
 'T-E1': {'use': 'Duplicate refunded',
          'category': 'utility',
          'slots': ['amount',
                    'date',
                    'first_name',
                    'ref',
                    'ref_format',
                    'refund_date',
                    'refund_id',
                    'window'],
          'en': 'Hi {first_name}, you were charged twice on {date}. We refunded Rs {amount} to your original '
                'payment method on {refund_date}. Refund ID: {refund_id}. Bank reference ({ref_format}): '
                '{ref} (sent when available). It can take up to {window} to show.',
          'hi_latn': 'Hi {first_name}, {date} ko aapse 2 baar paise kat gaye the. Rs {amount} {refund_date} '
                     'ko usi payment method mein wapas bhej diye hain. Refund ID: {refund_id}. Bank '
                     'reference ({ref_format}): {ref}. Dikhne mein {window} tak lag sakta hai.'},
 'T-F1': {'use': 'Refund not received',
          'category': 'utility',
          'slots': ['amount', 'by_date', 'first_name', 'ref', 'ref_format', 'refund_date'],
          'en': 'Hi {first_name}, your refund of Rs {amount} was sent on {refund_date}. If it is not in your '
                'account by {by_date}, give your bank this {ref_format}: {ref}. This is not the payment ID.',
          'hi_latn': 'Hi {first_name}, Rs {amount} ka refund {refund_date} ko bheja gaya. {by_date} tak na '
                     'aaye to bank ko yeh {ref_format} dein: {ref}. Yeh payment ID nahi hai.'},
 'T-B1': {'use': 'Failed, bank will reverse',
          'category': 'utility',
          'slots': ['amount', 'date', 'first_name', 'reversal_date', 'rrn'],
          'en': 'Hi {first_name}, your Rs {amount} payment on {date} did not complete, so we did not receive '
                'it. Your bank will reverse it by {reversal_date}. UPI ref: {rrn}. If it has not arrived by '
                'then, share this number with your bank.',
          'hi_latn': 'Hi {first_name}, {date} ko Rs {amount} ka payment complete nahi hua, isliye humein '
                     'paisa nahi mila. Aapka bank ise {reversal_date} tak wapas kar dega. UPI ref: {rrn}. '
                     'Tab tak na aaye to yeh number bank ko dein.'},
 'T-G1': {'use': 'Renewal failed (Razorpay side), grace given',
          'category': 'service',
          'slots': ['date', 'first_name', 'grace_until', 'plan'],
          'en': 'Hi {first_name}, your {plan} renewal on {date} did not go through because of a payment '
                'network issue, not your card. We have kept your access on until {grace_until}. We will send '
                'one renewal link once it is fixed.',
          'hi_latn': 'Hi {first_name}, {date} ko aapka {plan} renew nahi hua, payment network mein dikkat '
                     'thi, aapke card mein nahi. Humne aapka access {grace_until} tak chalu rakha hai. Theek '
                     'hote hi ek renewal link bhejenge.'},
 'T-ND': {'use': 'Needs one more detail',
          'category': 'utility',
          'slots': ['first_name'],
          'en': 'Hi {first_name}, we want to find your payment quickly. Please share the UPI ref (12 digits) '
                'from your bank or UPI app. We never ask for OTP, PIN or card number.',
          'hi_latn': 'Hi {first_name}, aapka payment jaldi dhoondhne ke liye apne bank ya UPI app se 12 '
                     'digit ka UPI ref bhej dein. Hum kabhi OTP, PIN ya card number nahi maangte.'},
 'T-NF': {'use': 'No payment found',
          'category': 'utility',
          'slots': ['date', 'first_name', 'merchant'],
          'en': 'Hi {first_name}, we could not find a payment from you to {merchant} around {date}. If money '
                'left your account, please share the UPI ref from your bank app so we can check.',
          'hi_latn': 'Hi {first_name}, {date} ke aas-paas {merchant} ko aapka koi payment nahi mila. Agar '
                     'paise kate hain to bank app se UPI ref bhej dein, hum check karenge.'},
 'T-DISC': {'use': 'First message',
            'category': 'service',
            'slots': ['body', 'merchant'],
            'en': "Hi, I'm {merchant}'s payment help assistant, powered by Razorpay. I'm an AI. {body}",
            'hi_latn': 'Hi, main {merchant} ka payment help assistant hoon, Razorpay ke saath. Main ek AI '
                       'hoon. {body}'},
 'T-ID1': {'use': 'Ask the reference',
           'category': 'service',
           'slots': [],
           'en': 'Please send the 12-digit UPI ref from your bank or UPI app. I will never ask for your OTP '
                 'or PIN.',
           'hi_latn': 'Apne bank ya UPI app se 12 digit ka UPI ref bhej dein. Hum kabhi aapka OTP ya PIN '
                      'nahi maangte.'},
 'T-ID2': {'use': 'Ask time, amount, app',
           'category': 'service',
           'slots': [],
           'en': 'When did you pay, how much, and with which app or bank?',
           'hi_latn': 'Aapne payment kab kiya, kitna kiya, aur kis app ya bank se?'},
 'T-ID3': {'use': 'Ask screenshot',
           'category': 'service',
           'slots': [],
           'en': 'You can also send a screenshot of the payment. Please hide your card number.',
           'hi_latn': 'Aap payment ka screenshot bhi bhej sakte hain. Card number chhupa dein.'},
 'T-Z1': {'use': 'Cannot reach page, inferred',
          'category': 'service',
          'slots': ['merchant'],
          'en': 'Sorry about this. Your payment did not go through because the page was not working on '
                "{merchant}'s side, so no money should have left your account. If it did, share the UPI ref "
                "and I'll check. We're fixing it.",
          'hi_latn': 'Maaf kijiye. Aapka payment nahi hua kyunki {merchant} ki taraf se page kaam nahi kar '
                     'raha tha, isliye aapke account se paisa nahi kata hona chahiye. Agar kata ho to UPI '
                     'ref bhej dein, hum check karenge. Hum ise theek kar rahe hain.'},
 'T-Z1R': {'use': 'Recovery link after verified fix',
           'category': 'service_promotional',
           'slots': ['amount', 'hours'],
           'en': 'The page is working again. Here is your link for the same ₹{amount} plan. It is valid for '
                 '{hours} hours.',
           'hi_latn': 'Page ab theek chal raha hai. Yeh raha aapka link, wahi ₹{amount} ke plan ke liye. Yeh '
                      '{hours} ghante tak valid hai.'},
 'T-PUB': {'use': 'Generic public reply, private link',
           'category': 'service',
           'slots': ['link', 'merchant'],
           'en': "I'm an AI assistant for {merchant}, powered by Razorpay. Sorry about this. We can help, but not "
                 'in public. Please message us privately and we will take it from here: {link}',
           'hi_latn': 'Main {merchant} ka AI assistant hoon, Razorpay ke saath. Maaf kijiye. Hum madad kar sakte '
                      'hain, par public mein nahi. Kripya humein private message karein, hum wahin se dekhenge: '
                      '{link}'},
 'T-HO': {'use': 'Handing to the team',
          'category': 'service',
          'slots': ['merchant'],
          'en': "I've passed this to {merchant}'s team with the details. You don't need to repeat anything.",
          'hi_latn': 'Maine yeh {merchant} ki team ko details ke saath bhej diya hai. Aapko dobara kuch '
                     'batane ki zaroorat nahi.'},
 'T-ACK': {'use': 'Payment found, merchant side is being fixed',
           'category': 'service',
           'slots': ['amount', 'date', 'first_name', 'merchant', 'plan'],
           'en': 'Hi {first_name}, we found your payment of Rs {amount} on {date} for {plan}. It reached '
                 '{merchant}, but your {plan} has not been switched on yet. {merchant} is fixing it. You do '
                 'not need to pay again. We will message you when it is done.',
           'hi_latn': 'Hi {first_name}, {date} ka aapka Rs {amount} ka {plan} ka payment hume mil gaya. Yeh '
                      '{merchant} tak pahunch gaya, par {plan} abhi chalu nahi hua. {merchant} ise theek kar '
                      'raha hai. Aapko dobara pay nahi karna. Theek hote hi hum message karenge.'},
 'T-OK': {'use': 'Payment found, access is active',
          'category': 'service',
          'slots': ['amount', 'date', 'first_name', 'plan'],
          'en': 'Hi {first_name}, we found your payment of Rs {amount} on {date} and your {plan} is active. '
                'If you still cannot see it, log out and log in again, and tell us if it persists.',
          'hi_latn': 'Hi {first_name}, {date} ka aapka Rs {amount} ka payment mil gaya aur {plan} chalu hai. '
                     'Agar phir bhi na dikhe to logout karke dobara login karein, aur humein batayein.'}}
