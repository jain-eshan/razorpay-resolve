"""Deterministic world generator. R0 skeleton: creates both databases from the contract schemas and seeds the merchant and
plans. Incidents, traffic, complaints and screenshots arrive in R1 (INC-1), R3 (threads) and R4 (INC-4, INC-5, negatives).

truth.db is written here and opened only by eval/. Run: python -m synth.generate --seed 20261006 --out data
"""
import argparse
import sqlite3
from pathlib import Path

import yaml

from .handovers import build_handovers
from .threads import build_threads
from .world import build
from .zone1 import apply as add_zone1

ROOT = Path(__file__).resolve().parent.parent
CFG = yaml.safe_load((Path(__file__).parent / "config.yaml").read_text())


def generate(out: Path, seed: int | None = None) -> dict:
    cfg = {**CFG, "seed": CFG["seed"] if seed is None else seed}
    out.mkdir(parents=True, exist_ok=True)
    dbs = {}
    for name, schema in (("world.db", "schema.sql"), ("truth.db", "truth_schema.sql")):
        path = out / name
        path.unlink(missing_ok=True)
        dbs[name] = sqlite3.connect(path)
        dbs[name].executescript((ROOT / "contracts" / schema).read_text())
    counts = build(cfg, dbs["world.db"], dbs["truth.db"], out)
    counts.update(add_zone1(cfg, dbs["world.db"], dbs["truth.db"], out))
    counts["threads"] = build_threads(dbs["world.db"], dbs["truth.db"], out, cfg["seed"])
    counts["handover_scripts"] = build_handovers(dbs["world.db"], dbs["truth.db"], out, cfg["seed"])
    for d in dbs.values():
        d.close()
    return counts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--out", type=Path, default=ROOT / "data")
    a = ap.parse_args()
    print("synth:", generate(a.out, a.seed))
