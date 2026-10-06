"""Channel adapter and policy interfaces. Frozen in R0 (contracts-v0.1). See docs/SPEC.md sections 3.1 to 3.3.

Every send path goes through PolicyEngine.check. There is no send function outside the adapters, and adapters are only
called by the policy-checked sender in R3."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Protocol

from pydantic import BaseModel

from ..schemas import Autonomy, ChannelType


class Attachment(BaseModel):
    kind: Literal["image", "document", "audio"]
    path: str
    content_hash: str


class InboundMessage(BaseModel):
    channel: ChannelType
    external_ref: str                 # provider thread or message id
    customer_ref: str                 # tokenised handle (phone, email, IGSID, handle)
    received_at: datetime
    text: str | None = None
    attachments: list[Attachment] = []
    context: dict[str, Any] = {}      # help_button: payment_id, order_id, error_code, surface
    is_public: bool = False


class OutboundMessage(BaseModel):
    thread_id: str
    template_id: str | None = None
    body: str
    language: Literal["en", "hi_latn", "hi_deva"] = "en"
    message_class: Literal["disclosure_or_question", "status_reply", "incident_message", "recovery_link", "public_reply"]


class ChannelCaps(BaseModel):
    attachments: bool
    templates: bool
    handover: bool
    window_hours: int | None
    human_agent_tag_hours: int | None = None


class WindowStatus(BaseModel):
    free_form_allowed: bool
    expires_at: datetime | None
    requires_template: bool


class SendResult(BaseModel):
    sent: bool
    provider_ref: str | None = None
    cost_inr_milli: int = 0
    reason: str | None = None


class ThreadRef(BaseModel):
    id: str
    channel: ChannelType
    last_inbound_at: datetime
    is_public: bool = False
    disclosed: bool = False


class PolicyDecision(BaseModel):
    allowed: bool
    requires_template: bool = False
    needs_founder_approval: bool = False
    reasons: list[str] = []           # one entry per failed or notable check, in check order


class ChannelAdapter(Protocol):
    channel: ChannelType
    caps: ChannelCaps

    def parse_inbound(self, raw: dict[str, Any]) -> InboundMessage: ...
    def window(self, thread: ThreadRef, now: datetime) -> WindowStatus: ...
    def send(self, thread: ThreadRef, msg: OutboundMessage, *, approved_by: str | None) -> SendResult: ...


class PolicyEngine(Protocol):
    """Check order (SPEC 3.3): suppression, consent, window, disclosure, never-ask lint, number-from-slot,
    public-channel content filter, rate limit, autonomy setting for the message class."""

    def check(self, thread: ThreadRef, msg: OutboundMessage, autonomy: Autonomy, now: datetime) -> PolicyDecision: ...
