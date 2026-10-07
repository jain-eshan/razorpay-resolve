"""Whose side is it (F-32). The decision table from v1 section 11.6, evaluated top to bottom, first match wins.
Rows 8a to 8c (inferred before-payment causes, R4) sit just before row 10 and are stored as 81, 82 and 83 because the stored id is an integer.
Bank outages that explain a cluster of complaints use row 7: the complaint spike monitor routes them before any Zone 1 incident exists.
The deciding row id is always stored with the verdict."""
from collections import Counter
from dataclasses import dataclass, field


@dataclass
class Evidence:
    delivery_classes: Counter = field(default_factory=Counter)   # 2xx, 4xx, 5xx, timeout, not_attempted_disabled
    merchant_response_body: bool = False                         # a body from the merchant's own infrastructure came back
    merchant_event_id: str | None = None                         # deploy or config change just before onset
    disabled_by_razorpay: bool = False
    tls_or_dns_errors: bool = False
    ack_ok_but_no_access: bool = False                           # 2xx delivered, merchant record shows nothing
    duplicate_captures_after_release: bool = False
    failures_inside_downtime_window: bool = False
    error_source: str | None = None
    single_gateway_code_unexplained: bool = False
    zone1_confidence: str | None = None                          # high | medium when Zone 1 inference built an incident
    probe_failure: bool = False                                  # the pay page failed its checks
    route_change_event: bool = False                             # a deploy that renamed, moved or redirected something, just before onset
    zero_attempt_orders: bool = False                            # orders were created and nobody tried to pay
    one_channel_only: bool = False                               # the only evidence is complaints, from a single channel


@dataclass
class Attribution:
    owner: str
    rule_id: int
    reason: str


def attribute(ev: Evidence) -> Attribution:
    http_fail = ev.delivery_classes["4xx"] + ev.delivery_classes["5xx"] > 0
    if http_fail and ev.merchant_response_body and ev.merchant_event_id:
        return Attribution("merchant_code", 1, "Webhook deliveries returned an error from your server, right after a change you made")
    if http_fail and ev.merchant_response_body:
        return Attribution("merchant_code", 2, "Webhook deliveries returned an error from your server, with no linked change")
    if ev.delivery_classes["timeout"] > 0 or ev.tls_or_dns_errors:
        return Attribution("merchant_config", 3, "Deliveries timed out or hit a TLS or DNS error on your domain")
    if ev.disabled_by_razorpay:
        return Attribution("merchant_code", 4, "Razorpay disabled the webhook after 24 hours of failures. The failures themselves were yours")
    if ev.ack_ok_but_no_access:
        return Attribution("merchant_code", 5, "Your server accepted the event, but your records show no access")
    if ev.duplicate_captures_after_release:
        return Attribution("merchant_code", 6, "Duplicate captures began after an app release with no duplicate guard")
    if ev.failures_inside_downtime_window and ev.error_source in ("bank", "issuer"):
        return Attribution("bank", 7, "Failures sit inside a known bank downtime window")
    if ev.single_gateway_code_unexplained:
        return Attribution("razorpay", 8, "One gateway error across methods that downtime does not explain")
    if ev.error_source == "customer":
        return Attribution("customer", 9, "The customer cancelled or could not complete the payment")
    if ev.zone1_confidence in ("high", "medium") and (ev.probe_failure or ev.route_change_event):
        return Attribution("merchant_code", 81, "Your pay page failed its checks, or a change to your pages went live just before it started (inferred)")
    if ev.zone1_confidence and ev.zero_attempt_orders and not ev.probe_failure:
        return Attribution("merchant_config", 82, "Orders were created and nobody could pay for them, while the page itself loads (inferred)")
    if ev.zone1_confidence and ev.one_channel_only:
        return Attribution("unknown", 83, "Customers say they cannot pay, but nothing else points to a cause yet (inferred)")
    return Attribution("unknown", 10, "None of the known patterns matched")
