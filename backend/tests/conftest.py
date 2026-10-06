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


@pytest.fixture(autouse=True)
def _clock_reset():
    from app import clock

    clock.reset()
    yield
    clock.reset()


@pytest.fixture
def fresh(world):
    """A private copy of the world for tests that change it (grants, messages). In memory, so it is cheap and never touches data/."""
    db = sqlite3.connect(":memory:", factory=Conn)
    db.row_factory = sqlite3.Row
    world.backup(db)
    yield db
    db.close()


@pytest.fixture
def world_file(world, tmp_path, monkeypatch):
    """The same copy as a file the API opens, for tests that go through HTTP or use two connections."""
    path = tmp_path / "world.db"
    dst = sqlite3.connect(path)
    world.backup(dst)
    dst.close()
    monkeypatch.setenv("BS_DB", str(path))
    monkeypatch.setenv("BS_SOURCE", "pipeline")
    return path
