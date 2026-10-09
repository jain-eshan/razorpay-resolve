"""API contract models. Frozen in R0 (contracts-v0.1). Changes go through contracts/ and docs/CONTRACT_CHANGES.md.

Money is integer paise. Times are ISO 8601 with +05:30. Customer identifiers shown to the UI are masked or tokenised.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

Owner = Literal["merchant_code", "merchant_config", "razorpay", "bank", "customer", "unknown"]
Zone = Literal["before", "during", "after"]
Tier = Literal["exact", "likely", "check", "excluded"]
IncidentStatus = Literal["open", "fixing", "verifying", "closed"]
MismatchType = Literal["A", "B", "E", "F", "G", "Z1"]
Confidence = Literal["high", "medium", "low"]
ChannelType = Literal[
    "help_button", "whatsapp_payments", "email", "ig_dm", "fb_dm", "public_mention", "ray_forward", "paste", "csv"
]
Autonomy = Literal["suggest", "assist", "autopilot_reversible"]
ThreadStateName = Literal[
    "opened", "triage", "identify", "lookup", "matched", "explain", "wait_for_fix", "resolved",
    "not_found", "human", "pass_back", "handoff", "closed",
]
ReplayEligibility = Literal["replayable_by_support", "not_replayable_disabled_window", "too_old", "n/a"]
ActionType = Literal[
    "grant", "resend_events", "refund", "message", "recovery_link", "evidence_pack", "escalation_pack", "alert_rule"
]
ActionStatus = Literal["drafted", "approved", "executing", "done", "failed", "reverted"]
Stage = Literal["dry_run", "first_5", "rest"]
Language = Literal["en", "hi_latn", "hi_deva", "mixed", "other"]


class Ack(BaseModel):
    ok: bool = True
    detail: str = "stub"


# ---------- shared pieces ----------
class EvidenceItem(BaseModel):
    kind: str
    weight: int
    ref: str


class LaneEvent(BaseModel):
    at: datetime
    text: str
    source_ref: str | None = None


class ThreeLane(BaseModel):
    customer: list[LaneEvent]
    razorpay: list[LaneEvent]
    merchant: list[LaneEvent]


# ---------- incidents ----------
class IncidentSummary(BaseModel):
    id: str
    title: str
    zone: Zone
    mismatch_type: MismatchType
    owner: Owner
    inferred: bool
    status: IncidentStatus
    opened_by: Literal["signal", "complaint", "backfill"]
    affected: int
    complained: int
    silent: int
    fixed: int
    at_risk_paise: int
    onset_at: datetime
    would_have_alerted_at: datetime | None = None


class Verdict(BaseModel):
    incident_id: str
    mismatch_type: MismatchType
    zone: Zone
    inferred: bool
    cause_code: str
    cause_summary_slots: dict[str, str | int]
    owner: Owner
    owner_rule_id: int | None = None
    owner_evidence_ids: list[str]
    signature: dict[str, Any]
    onset_at: datetime
    resolved_at: datetime | None = None
    linked_event_id: str | None = None
    affected_count: int
    confidence: Confidence
    unexplained_case_ids: list[str] = []
    runner_up: dict[str, Any] | None = None
    evidence: list[EvidenceItem] = []
    what_we_cannot_see: list[str] = []


class TimelineBucket(BaseModel):
    bucket_start: datetime
    ok: int
    client_error: int
    server_error: int
    not_attempted: int
    markers: list[str] = []


class LiftRow(BaseModel):
    dimension: str
    value: str
    share_affected: float
    share_baseline: float
    lift: float


class ReplaySummary(BaseModel):
    incident_id: str
    replayable_by_support: int
    not_replayable_disabled_window: int
    too_old: int
    note: str


class ActionSummary(BaseModel):
    id: str
    incident_id: str
    action_type: ActionType
    status: ActionStatus
    stage: Stage
    approved_by: str | None = None
    item_counts: dict[str, int] = {}


class IncidentDetail(IncidentSummary):
    verdict: Verdict
    timeline: list[TimelineBucket]
    lift: list[LiftRow]
    tier_counts: dict[Tier, int]
    replay: ReplaySummary
    actions: list[ActionSummary]


class Member(BaseModel):
    payment_id: str
    customer_masked: str
    amount_paise: int
    captured_at: datetime
    plan: str
    complained: bool
    delivery_outcome: str
    merchant_state: str
    tier: Tier
    exclusion_reason: str | None = None
    replay_eligibility: ReplayEligibility


class SampleTimeline(BaseModel):
    payment_id: str
    lanes: ThreeLane


class AgentStep(BaseModel):
    tool: str
    input: dict[str, Any]
    output_summary: str


class AgentTrace(BaseModel):
    id: str
    incident_id: str
    steps: list[AgentStep]
    budget_used: int
    budget_total: int
    model_id: str | None = None
    rule_based: bool


class RayCard(BaseModel):
    incident_id: str
    owner_chip: str
    inferred: bool
    cause_line: str
    affected: int
    complained: int
    silent: int
    fixed: int
    at_risk_paise: int
    language: Language
    buttons: list[str]


class EvidencePack(BaseModel):
    incident_id: str
    ref: str
    endpoint: str | None = None
    first_failure_at: datetime | None = None
    last_failure_at: datetime | None = None
    linked_change: str | None = None
    response_excerpt: str | None = None
    affected_events: int
    affected_payment_ids: list[str]
    suggested_fix: str
    for_razorpay: bool = False


class VerifyResult(BaseModel):
    incident_id: str
    verified: int
    total: int
    signal_healthy: bool
    restored_paise: int
    closeable: bool
    line: str


class ScanResult(BaseModel):
    days: int
    headline: str
    leaked_customers: int
    leaked_paise: int
    incidents: list[IncidentSummary]


# ---------- cases and matching ----------
class CaseSummary(BaseModel):
    id: str
    complaint_id: str
    channel: ChannelType
    match_status: Literal["matched", "needs_detail", "no_payment_found", "not_payment"]
    mismatch_type: MismatchType | None = None
    owner: Owner | None = None
    incident_id: str | None = None
    received_at: datetime


class MatchCandidate(BaseModel):
    payment_id: str
    method: str
    calibrated_score: float
    features: dict[str, float | str]


class CaseDetail(CaseSummary):
    extraction: dict[str, Any]
    candidates: list[MatchCandidate]
    lanes: ThreeLane
    state_line: str
    reply_draft: str | None = None
    injection_suspected: bool = False


# ---------- actions and messages ----------
class ActionItem(BaseModel):
    payment_id: str
    status: Literal["pending", "done", "failed", "verified", "verify_failed", "reverted"]
    idempotency_key: str


class Action(ActionSummary):
    params: dict[str, Any]
    items: list[ActionItem]
    next_stage: Stage | None = None        # the stage waiting for approval, or None when nothing is left to approve
    blocked_reason: str | None = None      # why approving is refused right now (cap, messaging off)


class ActionCreate(BaseModel):
    action_type: ActionType
    params: dict[str, Any] = {}


class ApproveRequest(BaseModel):
    stage: Stage
    approver: str


class ApproveRowRequest(BaseModel):
    approver: str


class RefundRow(BaseModel):
    """One customer charged twice, as the refund screen shows them."""
    payment_id: str                  # the second charge, the one to refund
    first_payment_id: str            # the charge the customer owes
    customer_masked: str
    amount_paise: int
    method: str
    charged_at: datetime
    gap_seconds: int
    complained: bool
    state: Literal["ready", "pending", "processed"]
    refund_id: str | None = None
    ref: str | None = None           # the bank reference, once the refund is processed
    ref_format: str | None = None    # RRN for UPI and netbanking, ARN for cards
    refunded_at: datetime | None = None
    processed_at: datetime | None = None
    messaged: bool = False


class RefundBoard(BaseModel):
    incident_id: str
    cap_paise: int                   # the daily limit on refunds (a setting)
    spent_today_paise: int
    owed_paise: int                  # still to refund
    refunded_paise: int
    rows: list[RefundRow]


class MessagePreview(BaseModel):
    template_id: str
    language: Language
    category: Literal["utility", "service", "service_promotional"]
    sender: str
    body: str
    recipients: int
    holdout_allowed: bool


class RecoveryRequest(BaseModel):
    thread_ids: list[str]
    holdout_percent: int = 10


# ---------- settings, clock, audit, eval ----------
class ConnectorStatus(BaseModel):
    mode: Literal["csv", "endpoint", "none"]
    status: str
    updated_at: datetime | None = None


class Settings(BaseModel):
    daily_refund_cap_paise: int
    max_bulk_customers: int
    messaging_enabled: bool
    holdout_percent: int
    technical_contact: str
    entitlement_connector: ConnectorStatus
    autonomy: Autonomy = "suggest"


class ClockState(BaseModel):
    now: datetime


class ClockAdvance(BaseModel):
    hours: int


class AuditEntry(BaseModel):
    id: int
    at: datetime
    actor: str
    kind: Literal["llm_call", "tool_call", "approval", "action", "verify", "policy"]
    ref_id: str | None = None
    model_id: str | None = None
    latency_ms: int | None = None
    cost_usd: float | None = None
    summary: str


class EvalMetric(BaseModel):
    name: str
    value: float | None
    target: str
    status: Literal["pass", "fail", "report", "n/a"]


class ArmRow(BaseModel):
    metric: str
    rules: float | None
    agent: float | None
    no_signal: float | None


class EvalReport(BaseModel):
    seed: int
    generated_at: datetime
    metrics: list[EvalMetric]
    arms: list[ArmRow]
    synthetic: bool = True


# ---------- channels, threads, conversation ----------
class Channel(BaseModel):
    id: str
    type: ChannelType
    status: Literal["disconnected", "connected", "paused"]
    reply_identity: str | None = None
    autonomy_level: Autonomy
    connected_at: datetime | None = None
    mocked: bool = True


class ChannelUpdate(BaseModel):
    status: Literal["disconnected", "connected", "paused"] | None = None
    autonomy_level: Autonomy | None = None


class Consent(BaseModel):
    id: str
    channel_id: str
    scopes: list[str]
    granted_by: str
    granted_at: datetime
    revoked_at: datetime | None = None
    retention_days: int


class ConsentRequest(BaseModel):
    channel_id: str
    scopes: list[str]
    granted_by: str


class ThreadMessage(BaseModel):
    id: str
    direction: Literal["inbound", "outbound"]
    sender_role: Literal["customer", "agent", "founder", "system"]
    body: str
    created_at: datetime
    template_id: str | None = None
    approved_by: str | None = None
    policy: dict[str, Any] = {}


class ThreadSummary(BaseModel):
    id: str
    channel: ChannelType
    state: ThreadStateName
    claim: str | None = None
    zone: Zone | None = None
    language: Language
    customer_ref: str
    last_inbound_at: datetime
    window_expires_at: datetime | None = None
    incident_id: str | None = None
    question_count: int = 0
    is_public: bool = False


class ThreadDetail(ThreadSummary):
    messages: list[ThreadMessage]
    case: CaseSummary | None = None
    disclosed: bool
    founder_brief: str | None = None


class InboundRequest(BaseModel):
    customer_ref: str
    text: str | None = None
    context: dict[str, Any] = {}
    received_at: datetime | None = None
    is_public: bool = False


class ThreadStep(BaseModel):
    thread: ThreadDetail
    drafted_reply: str | None = None
    auto_sent: bool = False


class ReplyRequest(BaseModel):
    body: str | None = None
    template_id: str | None = None
    approved_by: str


class HandoffRequest(BaseModel):
    reason: str


class Handover(BaseModel):
    id: str
    thread_id: str
    from_app: str
    to_app: str
    reason: str
    passed_at: datetime
    released_at: datetime | None = None


class HandoverRequest(BaseModel):
    thread_id: str
    action: Literal["pass", "release"]
    to_app: str | None = None
    reason: str | None = None


# ---------- zone 1, probes, escalation, learning ----------
class ProbeResult(BaseModel):
    id: str
    url: str
    checked_at: datetime
    http_status: int
    load_ms: int
    checkout_script_present: bool
    ok: bool
    note: str | None = None


class Cluster(BaseModel):
    id: str
    window_start: datetime
    window_end: datetime
    claim: str
    count: int
    unmatched_count: int
    unmatched_share: float
    baseline_rate: float
    lift: float


class EscalationRequest(BaseModel):
    incident_id: str
    thread_id: str | None = None
    target: Literal["founder", "developer", "razorpay"]


class Escalation(BaseModel):
    id: str
    incident_id: str
    target: Literal["founder", "developer", "razorpay"]
    ref: str
    status: Literal["drafted", "sent", "acknowledged", "resolved"]
    pack: dict[str, Any]
    created_at: datetime
    updated_at: datetime | None = None


class SendEscalationRequest(BaseModel):
    approver: str


class FeedbackRequest(BaseModel):
    subject_type: str
    subject_id: str
    kind: Literal[
        "verdict_wrong", "false_alarm", "missed_incident", "reply_edited", "reply_sent", "customer_replied",
        "customer_silent", "link_paid", "match_confirmed", "match_rejected",
    ]
    payload: dict[str, Any] = {}


class LearningChange(BaseModel):
    at: datetime
    key: str
    before: Any
    after: Any
    reason: str
    version: int


class LearningWeekly(BaseModel):
    week_start: datetime
    lines: list[str]
    changes: list[LearningChange]


class LearningParam(BaseModel):
    key: str
    version: int
    value: Any
    reason: str
    updated_at: datetime


class ReplayRow(BaseModel):
    week: int
    arm: Literal["off", "baseline", "loop"]
    false_alerts: float  # averaged over the replays: alerts per week
    true_alerts: float
    missed: float
    sends: int
    reply_rate: float | None = None
    edit_rate: float | None = None


class LearningReplay(BaseModel):
    note: str
    rows: list[ReplayRow]
