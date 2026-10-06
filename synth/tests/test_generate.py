import sqlite3

from synth.generate import generate


def dump(path):
    return "\n".join(sqlite3.connect(path).iterdump())


def test_deterministic(tmp_path):
    generate(tmp_path / "a")
    generate(tmp_path / "b")
    assert dump(tmp_path / "a" / "world.db") == dump(tmp_path / "b" / "world.db")
    assert dump(tmp_path / "a" / "truth.db") == dump(tmp_path / "b" / "truth.db")


def test_seeded_rows_and_truth_tables(tmp_path):
    generate(tmp_path)
    w = sqlite3.connect(tmp_path / "world.db")
    assert w.execute("select count(*) from plans").fetchone()[0] == 4
    t = sqlite3.connect(tmp_path / "truth.db")
    names = {r[0] for r in t.execute("select name from sqlite_master where type='table'")}
    assert {"truth_payments", "truth_complaints", "truth_incidents", "truth_threads", "truth_zone1", "truth_recovery"} <= names
