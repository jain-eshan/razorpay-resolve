"""Complaint text generated from a real payment, for fitting and testing the fuzzy matcher (R3). Deterministic given the rng.
The text carries no identifier: amount, a time phrase, and sometimes the app and the plan, in English or Hinglish."""
import random
from datetime import datetime, timedelta

PART = [(5, 12, "subah"), (12, 16, "dopahar"), (16, 20, "shaam"), (20, 24, "raat")]
EN = ["I paid Rs {amt} {when}{via} but {plan} is not active", "Money debited Rs {amt} {when}{via}, no access to {plan}", "paid {amt} {when}{via} and still can't access {plan}"]
HI = ["bhai {amt} deduct hua {when}{via}, {plan} activate nahi hua", "{when} {amt} kat gaya{via}, {plan} nahi mila", "paisa kat gaya {amt} ka {when}{via}, {plan} chalu nahi hua"]


def when_phrase(t: datetime, received: datetime, rng: random.Random, exact_hour: bool) -> str:
    night = t.hour < 5
    anchor = (t - timedelta(hours=5)).date() if night else t.date()
    diff = (received.date() - anchor).days
    day = {0: "aaj", 1: "kal", 2: "parso"}.get(diff, f"{diff} din pehle")
    part = "raat" if night else next(n for lo, hi, n in PART if lo <= t.hour < hi)
    hour = f" {t.hour % 12 or 12} baje" if exact_hour else ""
    return f"{day} {part}{hour}"


def complaint_text(p: dict, plan: str, app: str | None, received: datetime, rng: random.Random, hinglish: bool, exact_hour: bool = True, with_app: bool = True) -> str:
    t = datetime.fromisoformat(p["captured_at"])
    via = f" {app} se" if with_app and app else ""
    tpl = rng.choice(HI if hinglish else EN)
    return tpl.format(amt=p["amount_paise"] // 100, when=when_phrase(t, received, rng, exact_hour), via=via, plan=plan)
