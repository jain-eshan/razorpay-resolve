import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))


class Conn(sqlite3.Connection):
    """SQLite connection that can carry the generator counts for tests."""


@pytest.fixture(scope="session")
def world(tmp_path_factory):
    """A freshly generated world with the pipeline already run. Session scoped: generation takes a second or two."""
    from app import pipeline

    from synth.generate import generate

    out = tmp_path_factory.mktemp("world")
    counts = generate(out)
    db = sqlite3.connect(out / "world.db", factory=Conn)
    db.row_factory = sqlite3.Row
    pipeline.run(db)
    db.counts = counts
    return db
