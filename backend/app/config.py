"""Product constants and capability flags (Tech Spec section 12). Flags default to the honest value:
mock unless the capability is documented and wired. Override with an env var set to 1 or true."""
import os
from datetime import datetime

PRODUCT_NAME = "Blindspot"  # working name; change here only
SEED = 20261006
BS_NOW = datetime.fromisoformat(os.environ.get("BS_NOW", "2026-10-02T10:40:00+05:30"))

# True = live, False = mock or simulated
FLAG_DEFAULTS: dict[str, bool] = {
    "RZP_PAYMENTS_LIVE": False,
    "RZP_ORDER_ATTEMPTS": False,
    "RZP_REFUNDS_TEST_MODE": False,
    "RZP_LINKS_TEST_MODE": False,
    "RZP_DELIVERY_LOG": False,
    "RZP_DELIVERY_LOG_API": False,         # proposed
    "RZP_WEBHOOK_HEALTH_EVENT": False,     # proposed
    "RZP_REPLAY_SUPPORT": True,            # documented: single event by support ticket
    "RZP_REPLAY_BULK_API": False,          # proposed
    "RZP_DOWNTIME": False,
    "RZP_AGENT_EVENTS": False,
    "RZP_CHECKOUT_TELEMETRY": False,       # proposed
    "RZP_HELP_ENTRY": False,               # proposed
    "RAY_CHANNEL": False,
    "META_WABA_LIVE": False,
    "META_HANDOVER_LIVE": False,
    "RZP_SEARCH_BY_RRN": False,
}
PROPOSED = {"RZP_DELIVERY_LOG_API", "RZP_WEBHOOK_HEALTH_EVENT", "RZP_REPLAY_BULK_API", "RZP_CHECKOUT_TELEMETRY", "RZP_HELP_ENTRY"}


def flag(name: str) -> bool:
    v = os.environ.get(name)
    return FLAG_DEFAULTS[name] if v is None else v.lower() in ("1", "true", "yes")

# The merchant's access records were exported 10 minutes before "now" (v1 section 16.5).
from datetime import timedelta

ENTITLEMENT_EXPORT_AT = BS_NOW - timedelta(minutes=10)
