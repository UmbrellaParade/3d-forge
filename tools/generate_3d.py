from __future__ import annotations

import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT_GLB = ROOT / "input" / "input.glb"
DRAFT_GLB = ROOT / "output" / "draft.glb"
REPORT = ROOT / "output" / "generate_report.json"


def main() -> None:
    DRAFT_GLB.parent.mkdir(parents=True, exist_ok=True)

    if INPUT_GLB.exists():
        shutil.copy2(INPUT_GLB, DRAFT_GLB)
        status = "copied_input_glb"
        message = "Copied input/input.glb to output/draft.glb."
    else:
        status = "waiting_for_engine"
        message = (
            "No input/input.glb found. Future versions can call TripoSR, "
            "Stable Fast 3D, Hunyuan3D, or another image-to-3D engine here."
        )

    REPORT.write_text(
        json.dumps(
            {
                "status": status,
                "message": message,
                "expected_images": [
                    "input/character_front.png",
                    "input/character_back.png",
                    "input/character_left.png",
                    "input/character_right.png",
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(message)
    print(f"report={REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
