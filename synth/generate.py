"""Deterministic world generator. R0 skeleton: creates both databases from the contract schemas and seeds the merchant and
plans. Incidents, traffic, complaints and screenshots arrive in R1 (INC-1), R3 (threads) and R4 (INC-4, INC-5, negatives).

truth.db is written here and opened only by eval/. Run: python -m synth.generate --seed 20261006 --out data
"""
import argparse
import sqlite3
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CFG = yaml.safe_load((Path(__file__).parent / "config.yaml").read_text())


def generate(out: Path, seed: int = CFG["seed"]) -> dict[str, int]:
    out.mkdir(parents=True, exist_ok=True)
    counts = {}
    for name, schema in (("world.db", "schema.sql"), ("truth.db", "truth_schema.sql")):
        path = out / name
        path.unlink(missing_ok=True)
        db = sqlite3.connect(path)
        db.executescript((ROOT / "contracts" / schema).read_text())
        if name == "world.db":
            m = CFG["merchant"]
            db.execute(
                "INSERT INTO merchants (id, name, segment, mid, grace_hours_after_failed_renewal) VALUES (?,?,?,?,?)",
                (m["id"], m["name"], m["segment"], m["mid"], m["grace_hours_after_failed_renewal"]),
            )
            db.executemany(
                "INSERT INTO plans (id, merchant_id, name, amount_paise, interval) VALUES (?,?,?,?,?)",
                [(p["id"], m["id"], p["name"], p["amount_paise"], p["interval"]) for p in CFG["plans"]],
            )
            counts = {"merchants": 1, "plans": len(CFG["plans"]), "seed": seed}
        db.commit()
        db.close()
    return counts


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=CFG["seed"])
    ap.add_argument("--out", type=Path, default=ROOT / "data")
    a = ap.parse_args()
    print("synth:", generate(a.out, a.seed))
