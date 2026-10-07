"""Deterministic channel simulators (SPEC 3.1). They parse what each channel would send, say whether a free-form reply is allowed now,
and "send" by returning a provider reference. Nothing leaves the process. A real adapter can replace one behind the same interface."""
import hashlib
from datetime import datetime, timedelta
from typing import Any

from .base import ChannelCaps, InboundMessage, OutboundMessage, SendResult, ThreadRef, WindowStatus

WHATSAPP_WINDOW = timedelta(hours=24)
WHATSAPP_COST_INR_MILLI = 115  # about Rs 0.115 per service message from 1 Oct 2026 (third-party figure, [verify])


class Sim:
    channel: str = ""
    caps = ChannelCaps(attachments=False, templates=False, handover=False, window_hours=None)
    cost_inr_milli = 0

    def parse_inbound(self, raw: dict[str, Any]) -> InboundMessage:
        return InboundMessage(channel=self.channel, external_ref=raw.get("external_ref", ""), customer_ref=raw["customer_ref"],  # type: ignore[arg-type]
                              received_at=raw["received_at"], text=raw.get("text"), context=raw.get("context", {}), is_public=raw.get("is_public", False))

    def window(self, thread: ThreadRef, now: datetime) -> WindowStatus:
        return WindowStatus(free_form_allowed=True, expires_at=None, requires_template=False)

    def send(self, thread: ThreadRef, msg: OutboundMessage, *, approved_by: str | None) -> SendResult:
        ref = f"sim_{self.channel}_{hashlib.sha1((thread.id + msg.body).encode()).hexdigest()[:10]}"
        return SendResult(sent=True, provider_ref=ref, cost_inr_milli=self.cost_inr_milli)


class HelpButton(Sim):
    """A help button on a Razorpay-owned page (checkout error, link page, receipt). No external window. Context carries payment and order ids."""
    channel = "help_button"
    caps = ChannelCaps(attachments=False, templates=False, handover=False, window_hours=None)


class WhatsApp(Sim):
    """A dedicated payments number. Free-form replies only inside 24 hours of the customer's last message, templates after that."""
    channel = "whatsapp_payments"
    caps = ChannelCaps(attachments=True, templates=True, handover=False, window_hours=24)
    cost_inr_milli = WHATSAPP_COST_INR_MILLI

    def window(self, thread: ThreadRef, now: datetime) -> WindowStatus:
        expires = thread.last_inbound_at + WHATSAPP_WINDOW
        return WindowStatus(free_form_allowed=now <= expires, expires_at=expires, requires_template=now > expires)


class Instagram(Sim):
    """Instagram DMs. Handover protocol: the Meta inbox passes the thread to us and we release it back. Free-form replies inside 24 hours of the customer's last
    message. Up to 7 days only when a person sends, with the Human Agent tag. The assistant never uses that tag."""
    channel = "ig_dm"
    caps = ChannelCaps(attachments=True, templates=False, handover=True, window_hours=24, human_agent_tag_hours=168)

    def window(self, thread: ThreadRef, now: datetime) -> WindowStatus:
        expires = thread.last_inbound_at + WHATSAPP_WINDOW
        return WindowStatus(free_form_allowed=now <= expires, expires_at=expires, requires_template=False)


class Messenger(Instagram):
    channel = "fb_dm"


class PublicMention(Sim):
    """A public post that mentions the merchant. The only reply is one generic public line with a private link: no amounts, names or status."""
    channel = "public_mention"
    caps = ChannelCaps(attachments=False, templates=False, handover=True, window_hours=None)


class Email(Sim):
    """Forwarded or aliased mail. No window. Replies go in the same thread."""
    channel = "email"
    caps = ChannelCaps(attachments=True, templates=False, handover=False, window_hours=None)


ADAPTERS: dict[str, Sim] = {a.channel: a for a in (HelpButton(), WhatsApp(), Email(), Instagram(), Messenger(), PublicMention())}
