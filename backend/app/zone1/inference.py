"""Zone 1 inference (SPEC 7): signals that overlap in time become one inferred incident, only when the evidence is enough.

Weights: pay-page failure 2, order-attempt gap 1, order volume dip 1, complaint spike 1, a deploy or config change in the hour before 1.
High: weight 4 or more from at least two independent sources (the pay page, orders, complaints, a change). Medium: weight 2 or 3.
Below 2 there is no incident. Every incident from here is inferred, and states what it cannot see."""
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from ..schemas import EvidenceItem
from .signal import Signal

JOIN_GAP = timedelta(minutes=90)              # signals closer than this belong to one incident
CHANGE_BEFORE, CHANGE_AFTER = timedelta(hours=1), timedelta(hours=1)
KIND = {"probe": ("probe_failure", "pay page"), "order_gap": ("order_attempt_gap", "orders"), "volume_dip": ("order_volume_dip", "orders"), "complaint_spike": ("complaint_spike", "complaints")}


@dataclass
class Group:
    signals: list[Signal] = field(default_factory=list)
    event: dict | None = None
    onset: datetime | None = None
    end: datetime | None = None                 # None: still going
    evidence: list[EvidenceItem] = field(default_factory=list)
    weight: int = 0
    sources: set[str] = field(default_factory=set)
    confidence: str = "low"
    alert_at: datetime | None = None

    @property
    def kind(self) -> str:
        m = {s.monitor for s in self.signals}
        return "probe" if "probe" in m else "gap" if "order_gap" in m else "complaints"

    def sig(self, monitor: str) -> Signal | None:
        return next((s for s in self.signals if s.monitor == monitor), None)


def _event(db: sqlite3.Connection, onset: datetime) -> dict | None:
    r = db.execute("SELECT * FROM merchant_events WHERE kind IN ('deploy','config_change') AND at >= ? AND at <= ? ORDER BY at DESC LIMIT 1",
                   ((onset - CHANGE_BEFORE).isoformat(), (onset + CHANGE_AFTER).isoformat())).fetchone()
    return dict(r) if r else None


def group_signals(db: sqlite3.Connection, signals: list[Signal], now: datetime) -> list[Group]:
    cand = sorted((s for s in signals if s.zone1), key=lambda s: s.start)
    groups: list[Group] = []
    reach = None
    for s in cand:
        if groups and reach is not None and s.start <= reach + JOIN_GAP:
            groups[-1].signals.append(s)
        else:
            groups.append(Group([s]))
            reach = None
        reach = max(filter(None, [reach, s.end or now]))
    out = []
    for g in groups:
        hard = [s.start for s in g.signals if s.monitor != "volume_dip"]
        g.onset = min(hard) if hard else min(s.start for s in g.signals)
        probes = [s for s in g.signals if s.monitor == "probe"]
        gaps = [s for s in g.signals if s.monitor == "order_gap"]
        g.end = probes[-1].end if probes else gaps[-1].end if gaps else max(s.end or now for s in g.signals)
        g.event = _event(db, g.onset)
        timeline: list[tuple[datetime, int]] = []
        for s in sorted(g.signals, key=lambda s: s.detected_at):
            kind, source = KIND[s.monitor]
            g.evidence.append(EvidenceItem(kind=kind, weight=s.weight, ref=s.id))
            g.sources.add(source)
            timeline.append((s.detected_at, s.weight))
        if g.event:
            g.evidence.append(EvidenceItem(kind="merchant_event", weight=1, ref=g.event["id"]))
            g.sources.add("change")
            timeline.append((datetime.fromisoformat(g.event["at"]), 1))
        g.weight = sum(e.weight for e in g.evidence)
        g.confidence = "high" if g.weight >= 4 and len(g.sources) >= 2 else "medium" if g.weight >= 2 else "low"
        total = 0
        for at, w in sorted(timeline):
            total += w
            if total >= 2:
                g.alert_at = at
                break
        if g.confidence != "low":
            out.append(g)
    return out
