"""Write contracts/openapi.json and contracts/snapshot_manifest.json from the stub API. Run: make contracts."""
import itertools
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.fixtures import SAMPLE_IDS
from app.main import app


def manifest(spec: dict) -> list[dict]:
    out = []
    for path, ops in sorted(spec["paths"].items()):
        if "get" not in ops:
            continue
        params = re.findall(r"{(\w+)}", path)
        for combo in itertools.product(*(SAMPLE_IDS[p] for p in params)):
            url = path.format(**dict(zip(params, combo)))
            out.append({"path": url, "file": url.removeprefix("/api/") + ".json", "operation": ops["get"]["operationId"]})
    return out


if __name__ == "__main__":
    spec = app.openapi()
    (ROOT / "contracts" / "openapi.json").write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")
    m = manifest(spec)
    (ROOT / "contracts" / "snapshot_manifest.json").write_text(json.dumps(m, indent=2) + "\n")
    print(f"openapi: {len(spec['paths'])} paths, manifest: {len(m)} snapshot files")
