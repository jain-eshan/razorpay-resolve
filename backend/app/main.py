"""Stub API for contracts-v0.1. Every route returns typed placeholder data from fixtures.py.
The real pipeline replaces these handlers release by release without changing paths or models."""
import os
from contextlib import closing

from fastapi import APIRouter, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import clock, merchant_mock, service
from . import fixtures as fx
from .act import autonomy, executor
from .config import BS_NOW
from .conversation import machine
from .db import ROOT, connect
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
from .zone1 import read as z1
from .zone1 import recovery as z1recovery


def _live() -> bool:
    """BS_SOURCE=pipeline serves real pipeline output where it exists (R1: incidents, scan, eval). Default is placeholder data."""
    return os.environ.get("BS_SOURCE") == "pipeline"


def _real(fn, *args):
    with closing(connect()) as db:
        try:
            out = fn(db, *args)
        except executor.ActError as e:
            raise HTTPException(e.status, str(e)) from e
        except ValueError as e:
            raise HTTPException(422, str(e)) from e
    if out is None:
        raise HTTPException(404, "not found")
    return out


app = FastAPI(title="Blindspot API", version="0.1.0")
app.mount("/merchant-mock", merchant_mock.app)  # the merchant's side, simulated; not part of the frozen /api contract
app.add_middleware(CORSMiddleware, allow_origin_regex=r"http://localhost:\d+", allow_methods=["*"], allow_headers=["*"])
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
def list_cases(status: str | None = None): return _real(service.cases, status) if _live() else [fx.CASE1]
@api.get("/cases/{case_id}", response_model=CaseDetail)
def get_case(case_id: str): return _real(service.case_detail, case_id) if _live() else _get({"cs_001": fx.CASE1D}, case_id)
@api.get("/cases/{case_id}/timeline", response_model=ThreeLane)
def get_case_timeline(case_id: str): return _real(service.case_lanes, case_id) if _live() else _get({"cs_001": fx.LANES1}, case_id)

# ---------- scans, incidents ----------
@api.post("/scan/backfill", response_model=ScanResult)
def scan_backfill(): return _real(service.scan_day0) if _live() else fx.SCAN
@api.post("/scan/day0", response_model=ScanResult)
def scan_day0(): return _real(service.scan_day0) if _live() else fx.SCAN
@api.get("/scan/day0", response_model=ScanResult)
def get_scan_day0(): return _real(service.scan_day0) if _live() else fx.SCAN
@api.get("/incidents", response_model=list[IncidentSummary])
def list_incidents(): return _real(service.summaries) if _live() else list(fx.INCIDENTS.values())
@api.get("/incidents/{incident_id}", response_model=IncidentDetail)
def get_incident(incident_id: str): return _real(service.detail, incident_id) if _live() else _get(fx.DETAILS, incident_id)
@api.get("/incidents/{incident_id}/members", response_model=list[Member])
def get_members(incident_id: str, tier: Tier | None = None):
    if _live():
        return _real(service.members, incident_id, tier)
    _get(fx.DETAILS, incident_id)
    return fx.MEMBERS1 if incident_id == "INC-1" else []
@api.get("/incidents/{incident_id}/sample", response_model=list[SampleTimeline])
def get_sample(incident_id: str):
    if _live():
        return _real(service.sample, incident_id)
    _get(fx.DETAILS, incident_id)
    return fx.SAMPLE1 if incident_id == "INC-1" else []
@api.post("/incidents/{incident_id}/investigate", response_model=AgentTrace)
def investigate(incident_id: str): return fx.TRACE1
@api.get("/incidents/{incident_id}/trace", response_model=AgentTrace)
def get_trace(incident_id: str):
    if _live():
        return _real(service.trace, incident_id)
    return _get({"INC-1": fx.TRACE1, "INC-4": fx.TRACE4}, incident_id)
@api.get("/incidents/{incident_id}/ray_card", response_model=RayCard)
def get_ray_card(incident_id: str):
    if _live():
        return _real(service.ray_card, incident_id)
    return _get({"INC-1": fx.RAY1, "INC-4": fx.RAY4}, incident_id)
@api.get("/incidents/{incident_id}/evidence_pack", response_model=EvidencePack)
def get_evidence_pack(incident_id: str, fmt: str = Query("json", alias="format")):
    if _live():
        return _real(service.evidence_pack, incident_id)
    return _get({"INC-1": fx.PACK1, "INC-4": fx.PACK4}, incident_id)
@api.get("/incidents/{incident_id}/replay", response_model=ReplaySummary)
def get_replay(incident_id: str):
    if _live():
        return _real(service.replay, incident_id)
    return _get({"INC-1": fx.REPLAY1, "INC-4": fx.DETAIL4.replay}, incident_id)
@api.post("/incidents/{incident_id}/verify", response_model=VerifyResult)
def verify(incident_id: str): return _real(executor.verify, incident_id) if _live() else fx.VERIFY1
@api.post("/incidents/{incident_id}/actions", response_model=Action)
def create_action(incident_id: str, body: ActionCreate):
    return _real(lambda db: executor.get(db, executor.create(db, incident_id, body.action_type, body.params))) if _live() else fx.ACTION1D

# ---------- actions ----------
@api.get("/actions/{action_id}", response_model=Action)
def get_action(action_id: str): return _real(executor.get, action_id) if _live() else _get({"act_001": fx.ACTION1D}, action_id)
@api.post("/actions/{action_id}/approve", response_model=Action)
def approve_action(action_id: str, body: ApproveRequest):
    return _real(executor.approve, action_id, body.stage, f"merchant:{body.approver}") if _live() else fx.ACTION1D
@api.post("/actions/{action_id}/revert", response_model=Action)
def revert_action(action_id: str): return _real(executor.revert, action_id) if _live() else fx.ACTION1D
@api.post("/actions/{action_id}/recovery", response_model=Action)
def recovery(action_id: str, body: RecoveryRequest): return fx.ACTION1D

# ---------- misc ----------
@api.post("/clock/advance", response_model=ClockState)
def advance_clock(body: ClockAdvance):
    if not _live():
        return ClockState(now=BS_NOW)
    if body.hours < 0:
        raise HTTPException(422, "The clock only moves forward.")
    with closing(connect()) as db:
        now = clock.advance(body.hours)
        service.log_clock(db, body.hours, now)
        machine.nudge_silent(db, now)
        z1recovery.settle(db, now)
        db.commit()
    return ClockState(now=now)
@api.get("/messages/preview", response_model=list[MessagePreview])
def message_preview(action_id: str | None = None): return _real(executor.message_previews, action_id) if _live() else fx.PREVIEWS
@api.get("/audit", response_model=list[AuditEntry])
def audit(ref_id: str | None = None): return _real(service.audit_entries, ref_id) if _live() else fx.AUDIT
@api.get("/settings", response_model=Settings)
def get_settings(): return _real(autonomy.read) if _live() else fx.SETTINGS
@api.put("/settings", response_model=Settings)
def put_settings(body: Settings): return _real(lambda db: _commit(db, autonomy.write(db, body, "merchant:founder"))) if _live() else body
@api.post("/entitlements/csv", response_model=Ack)
def upload_entitlements(): return Ack()
@api.get("/eval/report", response_model=EvalReport)
def eval_report():
    report = ROOT / "eval" / "report.json"
    return EvalReport.model_validate_json(report.read_text()) if _live() and report.exists() else fx.EVAL

# ---------- channels, threads, conversation ----------
@api.post("/inbound/{channel}", response_model=ThreadStep)
def inbound(channel: str, body: InboundRequest):
    if not _live():
        return fx.STEP
    return _real(lambda db: machine.step(db, machine.handle_inbound(db, channel, body.customer_ref, body.text, body.context, body.received_at, body.is_public)))
@api.get("/threads", response_model=list[ThreadSummary])
def list_threads(state: str | None = None, incident: str | None = None): return _real(machine.list_threads, state, incident) if _live() else list(fx.THREADS.values())
@api.get("/threads/{thread_id}", response_model=ThreadDetail)
def get_thread(thread_id: str): return _real(machine.get_thread, thread_id) if _live() else _get(fx.THREADS, thread_id)
@api.post("/threads/{thread_id}/reply", response_model=ThreadDetail)
def reply(thread_id: str, body: ReplyRequest):
    return _real(lambda db: machine.reply(db, thread_id, body.body, body.template_id, body.approved_by).thread) if _live() else _get(fx.THREADS, thread_id)
@api.post("/threads/{thread_id}/handoff", response_model=ThreadDetail)
def handoff(thread_id: str, body: HandoffRequest):
    return _real(lambda db: machine.handoff(db, thread_id, body.reason).thread) if _live() else _get(fx.THREADS, thread_id)
@api.get("/channels", response_model=list[Channel])
def list_channels(): return _real(machine.channels) if _live() else fx.CHANNELS
@api.put("/channels/{channel_id}", response_model=Channel)
def update_channel(channel_id: str, body: ChannelUpdate):
    return _real(machine.update_channel, channel_id, body.status, body.autonomy_level) if _live() else _get({c.id: c for c in fx.CHANNELS}, channel_id)
@api.get("/consents", response_model=list[Consent])
def list_consents(): return _real(machine.consents) if _live() else fx.CONSENTS
@api.post("/consents", response_model=Consent)
def grant_consent(body: ConsentRequest): return _real(machine.grant_consent, body) if _live() else fx.CONSENTS[0]
@api.post("/handovers", response_model=Handover)
def handover(body: HandoverRequest): return fx.HANDOVER

# ---------- zone 1, escalation, learning ----------
@api.post("/probes/run", response_model=ProbeResult)
def run_probe(): return _real(lambda db: _commit(db, z1.run_probe(db))) if _live() else fx.PROBE
@api.get("/clusters", response_model=list[Cluster])
def clusters(window: str | None = None): return _real(z1.clusters) if _live() else [fx.CLUSTER]
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


def _commit(db, value):
    db.commit()
    return value


app.include_router(api)


@app.get("/health", include_in_schema=False)
def health(): return {"ok": True, "stub": True}
