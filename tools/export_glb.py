from __future__ import annotations

import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "configs" / "fix_requests.json"
DRAFT_GLB = ROOT / "output" / "draft.glb"
INPUT_GLB = ROOT / "input" / "input.glb"
FIXED_GLB = ROOT / "output" / "fixed.glb"
REPORT = ROOT / "output" / "export_report.json"


def read_config() -> dict:
    if not CONFIG.exists():
        return {}
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def main() -> None:
    FIXED_GLB.parent.mkdir(parents=True, exist_ok=True)
    source = DRAFT_GLB if DRAFT_GLB.exists() else INPUT_GLB
    config = read_config()

    if source.exists():
        shutil.copy2(source, FIXED_GLB)
        status = "copied_base_glb"
        message = (
            "Copied the base GLB to output/fixed.glb. Parametric mesh baking "
            "will be added in the Blender/Python export step."
        )
    else:
        status = "missing_base_glb"
        message = "No base GLB found. Add input/input.glb or run a generation engine first."

    REPORT.write_text(
        json.dumps(
            {
                "status": status,
                "message": message,
                "source": str(source.relative_to(ROOT)) if source.exists() else None,
                "output": str(FIXED_GLB.relative_to(ROOT)),
                "fix_config": config,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(message)
    print(f"report={REPORT.relative_to(ROOT)}")

    if not source.exists():
        raise SystemExit(1)


if __name__ == "__main__":
    main()
