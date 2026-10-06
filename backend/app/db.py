import os
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def db_path() -> Path:
    return Path(os.environ.get("BS_DB", ROOT / "data" / "world.db"))


def connect() -> sqlite3.Connection:
    c = sqlite3.connect(db_path())
    c.row_factory = sqlite3.Row
    return c
