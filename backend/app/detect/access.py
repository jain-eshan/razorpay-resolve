"""Access reconciler (F-02): does the merchant's own record agree that a captured payment was honoured?
Join is on order_id (one-time) or subscription_id (renewals), never on the payer's contact (FR-MA-8)."""
from datetime import datetime, timedelta

RENEWAL_EXTENDS_DAYS = 25  # a processed monthly renewal pushes access_until at least this far past the capture


def mismatch(payment: dict, ent: dict | None) -> str | None:
    """None when the record agrees. Otherwise one of: no_row, unpaid, access_cut, not_extended."""
    if ent is None:
        return "no_row"
    if not payment["subscription_id"]:
        return "unpaid" if ent["entitlement_state"] in ("none", "unpaid") else None
    until = datetime.fromisoformat(ent["access_until"]) if ent["access_until"] else None
    extended = until is not None and until >= datetime.fromisoformat(payment["captured_at"]) + timedelta(days=RENEWAL_EXTENDS_DAYS)
    if extended:
        return None
    return "access_cut" if ent["entitlement_state"] in ("expired", "cancelled") else "not_extended"
