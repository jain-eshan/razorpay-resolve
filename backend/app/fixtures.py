"""R0 placeholder data for the stub API and the snapshot build. Illustrative only: every value here is replaced by
pipeline output from R1 on. Typed against schemas.py so the stub can never drift from the contract."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .schemas import (
    Action,
    ActionItem,
    ActionSummary,
    AgentStep,
    AgentTrace,
    ArmRow,
    AuditEntry,
    CaseDetail,
    CaseSummary,
    Channel,
    Cluster,
    ConnectorStatus,
    Consent,
    Escalation,
    EvalMetric,
    EvalReport,
    EvidenceItem,
    EvidencePack,
    Handover,
    IncidentDetail,
    IncidentSummary,
    LaneEvent,
    LeakageReport,
    LeakageRow,
    LearningChange,
    LearningParam,
    LearningReplay,
    LearningWeekly,
    LiftRow,
    MatchCandidate,
    Member,
    MessagePreview,
    ProbeResult,
    RayCard,
    ReleaseCheck,
    ReleaseStep,
    ReplaySummary,
    SampleTimeline,
    ScanResult,
    Settings,
    ThreadDetail,
    ThreadMessage,
    ThreadStep,
    ThreeLane,
    TimelineBucket,
    Verdict,
    VerifyResult,
)

IST = timezone(timedelta(hours=5, minutes=30))


def at(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=IST)


NOW = at("2026-10-02T10:40:00")

# ---------- incidents ----------
INC1 = IncidentSummary(
    id="INC-1", title="Webhook returned 401 after deploy web v2.8.0", zone="after", mismatch_type="A",
    owner="merchant_code", inferred=False, status="open", opened_by="signal", affected=40, complained=9, silent=31,
    fixed=2, at_risk_paise=1_854_000, onset_at=at("2026-09-29T14:20:00"),
    would_have_alerted_at=at("2026-09-29T14:52:00"),
)
INC4 = IncidentSummary(
    id="INC-4", title="Pay page returned 404 after deploy web v2.7.3", zone="before", mismatch_type="Z1",
    owner="merchant_code", inferred=True, status="open", opened_by="complaint", affected=14, complained=14, silent=0,
    fixed=0, at_risk_paise=0, onset_at=at("2026-09-24T20:08:00"),
)
INCIDENTS = {"INC-1": INC1, "INC-4": INC4}

VERDICT1 = Verdict(
    incident_id="INC-1", mismatch_type="A", zone="after", inferred=False, cause_code="WEBHOOK_ENDPOINT_401_AFTER_DEPLOY",
    cause_summary_slots={"status": 401, "deploy": "web v2.8.0"}, owner="merchant_code", owner_rule_id=1,
    owner_evidence_ids=["evt_fixture_1"], signature={"response_class": "4xx", "endpoint": "ep_1"},
    onset_at=INC1.onset_at, affected_count=40, confidence="high", linked_event_id="me_deploy_280",
    evidence=[EvidenceItem(kind="webhook_non2xx_rate", weight=2, ref="sig_1"), EvidenceItem(kind="merchant_event", weight=1, ref="me_deploy_280")],
    what_we_cannot_see=["Whether your handler granted access after a 2xx without the access file"],
)
VERDICT4 = Verdict(
    incident_id="INC-4", mismatch_type="Z1", zone="before", inferred=True, cause_code="ROUTE_NOT_FOUND_AFTER_DEPLOY",
    cause_summary_slots={"deploy": "web v2.7.3"}, owner="merchant_code", owner_rule_id=None,
    owner_evidence_ids=["probe_1"], signature={"claims": ["cannot_pay", "page_error"]}, onset_at=INC4.onset_at,
    affected_count=14, confidence="medium",
    evidence=[
        EvidenceItem(kind="complaint_spike", weight=1, ref="cl_1"), EvidenceItem(kind="order_volume_dip", weight=1, ref="sig_4"),
        EvidenceItem(kind="probe_failure", weight=2, ref="probe_1"),
    ],
    what_we_cannot_see=["Anything between the customer's device and your server", "Why the route changed"],
)


def _buckets(base: str, pattern: list[tuple[int, int, int, int, list[str]]]) -> list[TimelineBucket]:
    t0 = at(base)
    return [
        TimelineBucket(bucket_start=t0 + timedelta(hours=i), ok=o, client_error=c, server_error=s, not_attempted=n, markers=m)
        for i, (o, c, s, n, m) in enumerate(pattern)
    ]


REPLAY1 = ReplaySummary(
    incident_id="INC-1", replayable_by_support=9, not_replayable_disabled_window=31, too_old=0,
    note="Razorpay support can replay one event at a time. Bulk replay does not exist.",
)
ACTION1 = ActionSummary(
    id="act_001", incident_id="INC-1", action_type="grant", status="drafted", stage="dry_run", item_counts={"pending": 38},
)
DETAIL1 = IncidentDetail(
    **INC1.model_dump(), verdict=VERDICT1,
    timeline=_buckets("2026-09-29T12:00:00", [(6, 0, 0, 0, []), (5, 0, 0, 0, ["deploy web v2.8.0"]), (0, 5, 0, 0, ["change point"]), (0, 6, 0, 0, []), (0, 0, 0, 5, ["webhook disabled"])]),
    lift=[LiftRow(dimension="response_class", value="4xx", share_affected=1.0, share_baseline=0.004, lift=250.0)],
    tier_counts={"exact": 38, "likely": 0, "check": 0, "excluded": 2}, replay=REPLAY1, actions=[ACTION1],
)
DETAIL4 = IncidentDetail(
    **INC4.model_dump(), verdict=VERDICT4,
    timeline=_buckets("2026-09-24T18:00:00", [(11, 0, 0, 0, []), (4, 0, 0, 0, ["deploy web v2.7.3"]), (2, 0, 0, 0, ["probe fails"]), (10, 0, 0, 0, ["reverted"])]),
    lift=[], tier_counts={"exact": 0, "likely": 0, "check": 0, "excluded": 0},
    replay=ReplaySummary(incident_id="INC-4", replayable_by_support=0, not_replayable_disabled_window=0, too_old=0, note="Not applicable: no payments were made."),
    actions=[],
)
DETAILS = {"INC-1": DETAIL1, "INC-4": DETAIL4}

MEMBERS1 = [
    Member(payment_id="pay_fx0001", customer_masked="A. V*****", amount_paise=59_900, captured_at=at("2026-09-29T21:12:00"), plan="Test Series", complained=True,
           delivery_outcome="401, 7 attempts", merchant_state="unpaid", tier="exact", replay_eligibility="replayable_by_support"),
    Member(payment_id="pay_fx0002", customer_masked="R. N****", amount_paise=29_900, captured_at=at("2026-09-30T16:40:00"), plan="Premium Monthly", complained=False,
           delivery_outcome="not attempted, webhook disabled", merchant_state="expired", tier="exact", replay_eligibility="not_replayable_disabled_window"),
    Member(payment_id="pay_fx0003", customer_masked="P. D**", amount_paise=19_900, captured_at=at("2026-09-29T18:05:00"), plan="Mock Test Pack", complained=True,
           delivery_outcome="401, 7 attempts", merchant_state="active", tier="excluded", exclusion_reason="already active (manual grant)",
           replay_eligibility="replayable_by_support"),
]

LANES1 = ThreeLane(
    customer=[LaneEvent(at=at("2026-10-02T10:40:00"), text="paisa kat gaya, premium nahi mila", source_ref="cmp_fx1")],
    razorpay=[LaneEvent(at=at("2026-09-29T21:12:00"), text="Payment captured. 7 webhook attempts returned 401.", source_ref="pay_fx0001")],
    merchant=[LaneEvent(at=at("2026-10-02T10:30:00"), text="Access record: unpaid", source_ref="ent_fx1")],
)
SAMPLE1 = [SampleTimeline(payment_id="pay_fx0001", lanes=LANES1)]
TRACE1 = AgentTrace(
    id="tr_001", incident_id="INC-1", budget_used=2, budget_total=8, rule_based=True,
    steps=[AgentStep(tool="find_change_points", input={"metric": "webhook_non2xx_rate"}, output_summary="Change point at 14:20"),
           AgentStep(tool="list_events", input={"window": "60m before onset"}, output_summary="Deploy web v2.8.0 at 14:20")],
)
RAY1 = RayCard(
    incident_id="INC-1", owner_chip="YOUR SIDE · Code", inferred=False,
    cause_line="Your server returned 401 to Razorpay from Tue 29 Sep 14:20. Razorpay disabled the webhook on Wed 14:22.",
    affected=40, complained=9, silent=31, fixed=2, at_risk_paise=1_854_000, language="en", buttons=["View list", "Send to dev"],
)
PACK1 = EvidencePack(
    incident_id="INC-1", ref="MG-INC-1-7F3A", endpoint="https://api.kaksha.example/razorpay/webhook",
    first_failure_at=at("2026-09-29T14:22:07"), last_failure_at=at("2026-09-30T14:21:55"), linked_change="deploy web v2.8.0: auth middleware on /api/*",
    response_excerpt='{"error":"Unauthorized: missing session"}', affected_events=40, affected_payment_ids=["pay_fx0001", "pay_fx0002"],
    suggested_fix="Exclude the webhook route from session auth, keep signature verification, and skip events already processed.",
)

TRACE4 = AgentTrace(
    id="tr_004", incident_id="INC-4", budget_used=3, budget_total=8, rule_based=True,
    steps=[AgentStep(tool="get_complaint_cluster", input={"window": "20:00-21:00"}, output_summary="9 complaints, 8 with no matching payment"),
           AgentStep(tool="get_probe_results", input={"window": "20:00-22:00"}, output_summary="Pay page returned 404"),
           AgentStep(tool="list_events", input={"window": "60m before onset"}, output_summary="Deploy web v2.7.3 at 20:08")],
)
RAY4 = RayCard(
    incident_id="INC-4", owner_chip="INFERRED · YOUR SIDE · Page", inferred=True,
    cause_line="Your pay page returned 404 from Thu 24 Sep 20:08. 14 customers tried to pay and Razorpay saw almost none of it.",
    affected=14, complained=14, silent=0, fixed=0, at_risk_paise=0, language="en", buttons=["View evidence", "Send to dev"],
)
PACK4 = EvidencePack(
    incident_id="INC-4", ref="MG-INC-4-2C91", endpoint="https://kaksha.example/buy", first_failure_at=at("2026-09-24T20:10:00"),
    last_failure_at=at("2026-09-24T22:05:00"), linked_change="deploy web v2.7.3: route rename /buy to /checkout",
    response_excerpt="404 Not Found", affected_events=0, affected_payment_ids=[],
    suggested_fix="Redirect /buy to /checkout, then re-run the pay-page check.",
)

# ---------- cases ----------
CASE1 = CaseSummary(id="cs_001", complaint_id="cmp_fx1", channel="whatsapp_payments", match_status="matched", mismatch_type="A",
                    owner="merchant_code", incident_id="INC-1", received_at=at("2026-10-02T10:40:00"))
CASE1D = CaseDetail(
    **CASE1.model_dump(), extraction={"claim": "debited_no_access", "amount_paise": 59_900, "language": "hi_latn"},
    candidates=[MatchCandidate(payment_id="pay_fx0001", method="exact_rrn", calibrated_score=0.97, features={"rrn": "exact"})],
    lanes=LANES1, state_line="Money captured at 21:12. Your server returned 401 to all 7 delivery attempts. Your records show no access.",
    reply_draft="Hi A., your payment of ₹599 was received. Your plan is active now.",
)

# ---------- actions, messages, audit ----------
ACTION1D = Action(**ACTION1.model_dump(), params={"tier": "exact"},
                  items=[ActionItem(payment_id="pay_fx0001", status="pending", idempotency_key="fx_key_1")])
PREVIEWS = [
    MessagePreview(template_id="T-A1", language="en", category="utility", sender="Kaksha payment help, powered by Razorpay",
                   body="Hi A., your 29 Sep payment of ₹599 to Kaksha went through, but your Test Series was not switched on. It is active now.",
                   recipients=38, holdout_allowed=False),
]
VERIFY1 = VerifyResult(incident_id="INC-1", verified=0, total=38, signal_healthy=False, restored_paise=0, closeable=False,
                       line="0 of 38 confirmed active. Not yet closeable.")
AUDIT = [AuditEntry(id=1, at=NOW, actor="system", kind="policy", ref_id="INC-1", summary="Fixture entry")]
SETTINGS = Settings(daily_refund_cap_paise=500_000, max_bulk_customers=100, messaging_enabled=False, holdout_percent=10,
                    technical_contact="dev@kaksha.example", entitlement_connector=ConnectorStatus(mode="csv", status="uploaded", updated_at=NOW))
EVAL = EvalReport(
    seed=20261006, generated_at=NOW,
    metrics=[EvalMetric(name="silent_victim_precision_exact", value=None, target=">= 0.98", status="n/a")],
    arms=[ArmRow(metric="identification_within_3_questions", rules=None, agent=None, no_signal=None)],
)

# ---------- channels and threads ----------
CHANNELS = [
    Channel(id="ch_help", type="help_button", status="connected", reply_identity="Kaksha payment help, powered by Razorpay", autonomy_level="suggest", connected_at=NOW),
    Channel(id="ch_wa", type="whatsapp_payments", status="connected", reply_identity="Kaksha payment help, powered by Razorpay", autonomy_level="suggest", connected_at=NOW),
    Channel(id="ch_mail", type="email", status="disconnected", autonomy_level="suggest"),
]
CONSENTS = [Consent(id="cn_1", channel_id="ch_wa", scopes=["read payment-related messages", "reply as Kaksha payment help"], granted_by="founder@kaksha.example",
                    granted_at=NOW, retention_days=30)]
MSGS = [
    ThreadMessage(id="m1", direction="inbound", sender_role="customer", body="paisa kat gaya premium nahi mila", created_at=at("2026-10-02T10:40:00")),
    ThreadMessage(id="m2", direction="outbound", sender_role="agent", template_id="T-DISC",
                  body="Hi, I'm Kaksha's payment help assistant, powered by Razorpay. I'm an AI. Please send the 12-digit UPI ref from your bank or UPI app. I will never ask for your OTP or PIN.",
                  created_at=at("2026-10-02T10:40:08"), policy={"disclosed": True, "window": "open"}),
]
THR1 = ThreadDetail(
    id="thr_001", channel="whatsapp_payments", state="identify", claim="debited_no_access", zone="after", language="hi_latn",
    customer_ref="tok_phone_1", last_inbound_at=at("2026-10-02T10:40:00"), window_expires_at=at("2026-10-03T10:40:00"), incident_id=None,
    question_count=1, messages=MSGS, case=None, disclosed=True,
)
THR2 = ThreadDetail(
    id="thr_002", channel="public_mention", state="pass_back", claim="debited_no_access", zone=None, language="en", customer_ref="tok_handle_1",
    last_inbound_at=at("2026-10-02T09:10:00"), is_public=True, messages=[], disclosed=False,
)
THREADS = {"thr_001": THR1, "thr_002": THR2}
CLUSTER = Cluster(id="cl_1", window_start=at("2026-09-24T20:00:00"), window_end=at("2026-09-24T21:00:00"), claim="page_error", count=9,
                  unmatched_count=8, unmatched_share=0.89, baseline_rate=0.4, lift=22.5)
PROBE = ProbeResult(id="probe_1", url="https://kaksha.example/buy", checked_at=at("2026-09-24T20:30:00"), http_status=404, load_ms=180,
                    checkout_script_present=False, ok=False, note="Route not found")
HANDOVER = Handover(id="ho_1", thread_id="thr_002", from_app="meta_inbox", to_app="blindspot", reason="payment keywords", passed_at=NOW)
ESC1 = Escalation(id="esc_001", incident_id="INC-1", target="razorpay", ref="MG-INC-1-7F3A", status="drafted", pack=PACK1.model_dump(mode="json"), created_at=NOW)
LEARN_WEEK = LearningWeekly(
    week_start=at("2026-09-28T00:00:00"), lines=["No parameter changes yet."],
    changes=[LearningChange(at=NOW, key="order_dip_p_threshold", before=0.01, after=0.005, reason="2 of 2 alerts were false", version=2)],
)
LEARN_PARAMS = [LearningParam(key="order_dip_p_threshold", version=2, value=0.005, reason="2 of 2 alerts were false", updated_at=NOW)]
LEARN_REPLAY = LearningReplay(note="No replay has been run. Run make eval.", rows=[])
SCAN = ScanResult(days=30, headline="38 customers paid and did not get access.", leaked_customers=38,
                  leaked_paise=1_854_000, incidents=[INC1])
LEAKAGE = LeakageReport(
    as_of=NOW, grace_hours=48, headline="1 customer failed a UPI renewal, is past your 48 hour rule and still has access. ₹299 in renewals is unpaid.", customers=1, owed_paise=29_900, longest_over_hours=30.0,
    rows=[LeakageRow(subscription_id="sub_001", payment_id="pay_001", customer_masked="A. S****", plan="Premium Monthly", amount_paise=29_900, reason="Insufficient funds in account",
                     failed_at=NOW - timedelta(hours=78), rule_ends_at=NOW - timedelta(hours=30), hours_over_rule=30.0, access_until=NOW + timedelta(days=20))],
    inside_rule=[], left_out=[], funnel=[], cannot_see=[],
)
RELEASE = ReleaseCheck(checked_at=NOW, safe_to_release=True, headline="Safe to release. Your webhook acknowledges a test event and your pay page opens with checkout on it.", failed=0,
                       steps=[ReleaseStep(key="answers", group="webhook", label="Your webhook answers", status="pass", saw="It answered 200.", meaning="", next_step="")],
                       ci_call="curl -fsS \"$RESOLVE_API/api/guard/release-check\" | jq -e '.safe_to_release'", cannot_see=["Your code."])
STEP = ThreadStep(thread=THR1, drafted_reply=None, auto_sent=True)

# ids the snapshot build expands path parameters with
SAMPLE_IDS = {
    "incident_id": ["INC-1", "INC-4"], "case_id": ["cs_001"], "thread_id": ["thr_001", "thr_002"],
    "action_id": ["act_001"], "escalation_id": ["esc_001"],
}
