"""Run detection on data/world.db and save incidents. Run: make pipeline"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app import pipeline
from app.db import connect

db = connect()
ids = pipeline.run(db)
print(f"pipeline: {len(ids)} incident(s): {', '.join(ids) or 'none'}")
