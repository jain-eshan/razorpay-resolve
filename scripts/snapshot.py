"""Build the static snapshot: GET every manifest path from the API and write JSON for the web build. Run: make snapshot."""
import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.main import app

out = ROOT / "web" / "public" / "snapshot"
client = TestClient(app)
n = 0
for e in json.loads((ROOT / "contracts" / "snapshot_manifest.json").read_text()):
    r = client.get(e["path"])
    r.raise_for_status()
    f = out / e["file"]
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(r.json(), indent=2) + "\n")
    n += 1
print(f"snapshot: {n} files in {out.relative_to(ROOT)}")
