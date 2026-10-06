"""Stub API for contracts-v0.1. Every route returns typed placeholder data from fixtures.py.
The real pipeline replaces these handlers release by release without changing paths or models."""
from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import fixtures as fx
from .config import BS_NOW
from .schemas import (
    Ack,
    Action,
    ActionCreate,
    AgentTrace,
    ApproveRequest,
    AuditEntry,
    CaseDetail,
    CaseSummary,
    Channel,
    ChannelUpdate,
    ClockAdvance,
    ClockState,
    Cluster,
    Consent,
    ConsentRequest,
    Escalation,
    EscalationRequest,
    EvalReport,
    EvidencePack,
    FeedbackRequest,
    HandoffRequest,
    Handover,
    HandoverRequest,
    InboundRequest,
    IncidentDetail,
    IncidentSummary,
    LearningParam,
    LearningWeekly,
    Member,
    MessagePreview,
    ProbeResult,
    RayCard,
    RecoveryRequest,
    ReplaySummary,
    ReplyRequest,
    SampleTimeline,
    ScanResult,
    Settings,
    ThreadDetail,
    ThreadStep,
    ThreadSummary,
    ThreeLane,
    Tier,
    VerifyResult,
)

app = FastAPI(title="Blindspot API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])
api = APIRouter(prefix="/api")


def _get(table, key):
    if key not in table:
        raise HTTPException(404, f"{key} not found")
    return table[key]


# ---------- complaints, cases ----------
@api.post("/complaints", response_model=CaseSummary)
def create_complaint(): return fx.CASE1
@api.post("/complaints/csv", response_model=Ack)
def create_complaints_csv(): return Ack()
@api.get("/cases", response_model=list[CaseSummary])
def list_cases(status: str | None = None): return [fx.CASE1]
@api.get("/cases/{case_id}", response_model=CaseDetail)
def get_case(case_id: str): return _get({"cs_001": fx.CASE1D}, case_id)
@api.get("/cases/{case_id}/timeline", response_model=ThreeLane)
def get_case_timeline(case_id: str): return _get({"cs_001": fx.LANES1}, case_id)

# ---------- scans, incidents ----------
@api.post("/scan/backfill", response_model=ScanResult)
def scan_backfill(): return fx.SCAN
@api.post("/scan/day0", response_model=ScanResult)
def scan_day0(): return fx.SCAN
@api.get("/incidents", response_model=list[IncidentSummary])
def list_incidents(): return list(fx.INCIDENTS.values())
@api.get("/incidents/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: str): return _get(fx.DETAILS, incident_id)
@api.get("/incidents/{incident_id}/members", response_model=list[Member])
def get_members(incident_id: str, tier: Tier | None = None):
    _get(fx.DETAILS, incident_id)
    return fx.MEMBERS1 if incident_id == "INC-1" else []
@api.get("/incidents/{incident_id}/sample", response_model=list[SampleTimeline])
def get_sample(incident_id: str):
    _get(fx.DETAILS, incident_id)
    return fx.SAMPLE1 if incident_id == "INC-1" else []
@api.post("/incidents/{incident_id}/investigate", response_model=AgentTrace)
def investigate(incident_id: str): return fx.TRACE1
@api.get("/incidents/{incident_id}/trace", response_model=AgentTrace)
def get_trace(incident_id: str): return _get({"INC-1": fx.TRACE1, "INC-4": fx.TRACE4}, incident_id)
@api.get("/incidents/{incident_id}/ray_card", response_model=RayCard)
def get_ray_card(incident_id: str): return _get({"INC-1": fx.RAY1, "INC-4": fx.RAY4}, incident_id)
@api.get("/incidents/{incident_id}/evidence_pack", response_model=EvidencePack)
def get_evidence_pack(incident_id: str, fmt: str = Query("json", alias="format")): return _get({"INC-1": fx.PACK1, "INC-4": fx.PACK4}, incident_id)
@api.get("/incidents/{incident_id}/replay", response_model=ReplaySummary)
def get_replay(incident_id: str): return _get({"INC-1": fx.REPLAY1, "INC-4": fx.DETAIL4.replay}, incident_id)
@api.post("/incidents/{incident_id}/verify", response_model=VerifyResult)
def verify(incident_id: str): return fx.VERIFY1
@api.post("/incidents/{incident_id}/actions", response_model=Action)
def create_action(incident_id: str, body: ActionCreate): return fx.ACTION1D

# ---------- actions ----------
@api.get("/actions/{action_id}", response_model=Action)
def get_action(action_id: str): return _get({"act_001": fx.ACTION1D}, action_id)
@api.post("/actions/{action_id}/approve", response_model=Action)
def approve_action(action_id: str, body: ApproveRequest): return fx.ACTION1D
@api.post("/actions/{action_id}/revert", response_model=Action)
def revert_action(action_id: str): return fx.ACTION1D
@api.post("/actions/{action_id}/recovery", response_model=Action)
def recovery(action_id: str, body: RecoveryRequest): return fx.ACTION1D

# ---------- misc ----------
@api.post("/clock/advance", response_model=ClockState)
def advance_clock(body: ClockAdvance): return ClockState(now=BS_NOW)
@api.get("/messages/preview", response_model=list[MessagePreview])
def message_preview(action_id: str | None = None): return fx.PREVIEWS
@api.get("/audit", response_model=list[AuditEntry])
def audit(ref_id: str | None = None): return fx.AUDIT
@api.get("/settings", response_model=Settings)
def get_settings(): return fx.SETTINGS
@api.put("/settings", response_model=Settings)
def put_settings(body: Settings): return body
@api.post("/entitlements/csv", response_model=Ack)
def upload_entitlements(): return Ack()
@api.get("/eval/report", response_model=EvalReport)
def eval_report(): return fx.EVAL

# ---------- channels, threads, conversation ----------
@api.post("/inbound/{channel}", response_model=ThreadStep)
def inbound(channel: str, body: InboundRequest): return fx.STEP
@api.get("/threads", response_model=list[ThreadSummary])
def list_threads(state: str | None = None, incident: str | None = None): return list(fx.THREADS.values())
@api.get("/threads/{thread_id}", response_model=ThreadDetail)
def get_thread(thread_id: str): return _get(fx.THREADS, thread_id)
@api.post("/threads/{thread_id}/reply", response_model=ThreadDetail)
def reply(thread_id: str, body: ReplyRequest): return _get(fx.THREADS, thread_id)
@api.post("/threads/{thread_id}/handoff", response_model=ThreadDetail)
def handoff(thread_id: str, body: HandoffRequest): return _get(fx.THREADS, thread_id)
@api.get("/channels", response_model=list[Channel])
def list_channels(): return fx.CHANNELS
@api.put("/channels/{channel_id}", response_model=Channel)
def update_channel(channel_id: str, body: ChannelUpdate): return _get({c.id: c for c in fx.CHANNELS}, channel_id)
@api.get("/consents", response_model=list[Consent])
def list_consents(): return fx.CONSENTS
@api.post("/consents", response_model=Consent)
def grant_consent(body: ConsentRequest): return fx.CONSENTS[0]
@api.post("/handovers", response_model=Handover)
def handover(body: HandoverRequest): return fx.HANDOVER

# ---------- zone 1, escalation, learning ----------
@api.post("/probes/run", response_model=ProbeResult)
def run_probe(): return fx.PROBE
@api.get("/clusters", response_model=list[Cluster])
def clusters(window: str | None = None): return [fx.CLUSTER]
@api.post("/escalations", response_model=Escalation)
def create_escalation(body: EscalationRequest): return fx.ESC1
@api.get("/escalations/{escalation_id}", response_model=Escalation)
def get_escalation(escalation_id: str): return _get({"esc_001": fx.ESC1}, escalation_id)
@api.post("/feedback", response_model=Ack)
def feedback(body: FeedbackRequest): return Ack()
@api.get("/learning/weekly", response_model=LearningWeekly)
def learning_weekly(): return fx.LEARN_WEEK
@api.get("/learning/params", response_model=list[LearningParam])
def learning_params(): return fx.LEARN_PARAMS


app.include_router(api)


@app.get("/health", include_in_schema=False)
def health(): return {"ok": True, "stub": True}
