"""Fit and test the fuzzy matcher (SPEC 11.3.2). Complaints are generated from real payments (synth/messages.py), so every candidate
the matcher proposes has a true label. Half the complaints fit an isotonic calibrator; the other half measure it. Writes data/calibrator.json."""
import json
import random
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT))
from app.ingest.extract import extract
from app.ingest.redact import redact
from app.match import lookup as mt

from synth.messages import complaint_text


def examples(world: sqlite3.Connection, n: int = 400, seed: int = 7) -> list[tuple[str, list[mt.Candidate]]]:
    rng = random.Random(seed)
    pays = [dict(r) for r in world.execute("SELECT p.*, pl.name AS plan FROM payments p JOIN orders o ON o.id = p.order_id JOIN plans pl ON pl.id = o.plan_id WHERE p.status = 'captured' ORDER BY p.id")]
    out = []
    for p in rng.sample(pays, min(n, len(pays))):
        received = datetime.fromisoformat(p["captured_at"]) + timedelta(hours=rng.uniform(1, 36))
        text = complaint_text(p, p["plan"], p["app"], received, rng, hinglish=rng.random() < 0.6, exact_hour=rng.random() < 0.7, with_app=rng.random() < 0.5)
        red = redact(text)
        out.append((p["id"], mt.fuzzy(world, red, extract(red, received), received, cal=None, limit=50)))
    return out


def isotonic(pairs: list[tuple[float, int]]) -> dict:
    """Pool adjacent violators: the monotone non-decreasing step function closest to the labels."""
    blocks = []  # [sum_label, count, sum_score]
    for s, y in sorted(pairs):
        blocks.append([y, 1, s])
        while len(blocks) > 1 and blocks[-2][0] / blocks[-2][1] >= blocks[-1][0] / blocks[-1][1]:
            b = blocks.pop()
            blocks[-1] = [blocks[-1][0] + b[0], blocks[-1][1] + b[1], blocks[-1][2] + b[2]]
    return {"x": [round(b[2] / b[1], 5) for b in blocks], "y": [round(b[0] / b[1], 5) for b in blocks]}


def score(exs, cal, t_auto: float) -> dict:
    matched = correct = 0
    for truth, cands in exs:
        top = sorted((mt.Candidate(c.payment_id, c.method, mt.calibrate(c.score, cal), c.features) for c in cands), key=lambda c: -c.score)
        if mt.decide(top, t_auto) == "matched":
            matched += 1
            correct += top[0].payment_id == truth
    ranks = [next((i for i, c in enumerate(sorted(cs, key=lambda c: -c.score)) if c.payment_id == truth), 99) for truth, cs in exs]
    top = lambda k: sum(r < k for r in ranks) / len(exs) if exs else 0.0
    return {"matched": matched, "correct": correct, "precision": correct / matched if matched else 1.0, "recall": correct / len(exs) if exs else 0.0,
            "top1": top(1), "top3": top(3), "top5": top(5)}


def fit(world: sqlite3.Connection, write: bool = True) -> dict:
    exs = examples(world)
    train, test = exs[::2], exs[1::2]
    cal = isotonic([(c.score, int(c.payment_id == t)) for t, cs in train for c in cs])
    grid = [round(0.5 + i * 0.01, 2) for i in range(50)]
    t_auto = next((t for t in grid if score(train, cal, t)["precision"] >= 0.95 and score(train, cal, t)["matched"] >= 5), 1.01)  # no threshold reaches 95 percent precision: never auto-match
    res = {"calibrator": cal, "t_auto": t_auto, "train": score(train, cal, t_auto), "test": score(test, cal, t_auto), "curve": [{"t": t, **score(test, cal, t)} for t in grid[::5]]}
    if write:
        (ROOT / "data" / "calibrator.json").write_text(json.dumps({"x": cal["x"], "y": cal["y"], "t_auto": t_auto}) + "\n")
    return res
