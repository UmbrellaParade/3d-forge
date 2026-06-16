from __future__ import annotations

import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MODEL_DIR = PUBLIC / "models"
RUNTIME_DIR = PUBLIC / "runtime"


def ensure_dirs() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


def copy_json_config(name: str) -> None:
    source = ROOT / "configs" / name
    target = RUNTIME_DIR / name
    if source.exists():
        target.write_text(json.dumps(json.loads(source.read_text(encoding="utf-8")), indent=2), encoding="utf-8")


def stage_model() -> str:
    candidates = [
        ROOT / "output" / "fixed.glb",
        ROOT / "output" / "draft.glb",
        ROOT / "input" / "input.glb",
    ]
    for candidate in candidates:
        if candidate.exists():
            shutil.copy2(candidate, MODEL_DIR / "current.glb")
            return str(candidate.relative_to(ROOT))
    current = MODEL_DIR / "current.glb"
    if current.exists():
        current.unlink()
    return "none"


def main() -> None:
    ensure_dirs()
    for config_name in ["character.json", "parts.json", "fix_requests.json"]:
        copy_json_config(config_name)
    model_source = stage_model()
    print(f"staged_model={model_source}")
    print(f"viewer_model=public/models/current.glb")
    print(f"runtime_configs=public/runtime")


if __name__ == "__main__":
    main()
