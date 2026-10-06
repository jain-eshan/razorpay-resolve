"""Build the static snapshot: GET every manifest path from the API and write JSON for the web build. Run: make snapshot."""
import json
import os
import re
import shutil
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.main import app

out = ROOT / "web" / "public" / "snapshot"
client = TestClient(app)
live = os.environ.get("BS_SOURCE") == "pipeline"
real_incidents = {i["id"] for i in client.get("/api/incidents").json()} if live else set()
if live:
    shutil.rmtree(out, ignore_errors=True)  # never mix real output with placeholder files
n = 0
for e in json.loads((ROOT / "contracts" / "snapshot_manifest.json").read_text()):
    m = re.match(r"incidents/(INC-\d+)", e["file"])
    if live and m and m.group(1) not in real_incidents:
        continue  # placeholder incident ids from the frozen manifest do not exist in real data
    r = client.get(e["path"])
    if live and r.status_code == 404:
        continue  # a placeholder id (an action, a case) that real data does not have
    r.raise_for_status()
    f = out / e["file"]
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(r.json(), indent=2) + "\n")
    n += 1
if live:  # the manifest has one placeholder case. Write every real case too, so the case screen works without a server.
    for c in client.get("/api/cases").json():
        for path, name in ((f"/api/cases/{c['id']}", f"cases/{c['id']}.json"), (f"/api/cases/{c['id']}/timeline", f"cases/{c['id']}/timeline.json")):
            f = out / name
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_text(json.dumps(client.get(path).json(), indent=2) + "\n")
            n += 1
if live:  # the guided demo: frames recorded from the real engine on a copy of the world
    sys.path.insert(0, str(ROOT))
    from scripts.demo_script import record

    (out / "demo.json").write_text(json.dumps(record(ROOT / "data" / "world.db"), separators=(",", ":")) + "\n")
    n += 1
print(f"snapshot: {n} files in {out.relative_to(ROOT)}")
