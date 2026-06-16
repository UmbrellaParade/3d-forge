from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_glb_header(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        magic = handle.read(4)
        if magic != b"glTF":
            raise ValueError("Not a binary GLB file.")
        version = int.from_bytes(handle.read(4), "little")
        length = int.from_bytes(handle.read(4), "little")
    return version, length


def read_json_chunk(path: Path) -> dict:
    with path.open("rb") as handle:
        handle.seek(12)
        chunk_length = int.from_bytes(handle.read(4), "little")
        chunk_type = handle.read(4)
        if chunk_type != b"JSON":
            raise ValueError("First GLB chunk is not JSON.")
        payload = handle.read(chunk_length).decode("utf-8")
    return json.loads(payload)


def inspect(path: Path) -> dict:
    version, length = read_glb_header(path)
    gltf = read_json_chunk(path)
    return {
        "path": str(path),
        "glb_version": version,
        "byte_length": length,
        "scenes": len(gltf.get("scenes", [])),
        "nodes": len(gltf.get("nodes", [])),
        "meshes": len(gltf.get("meshes", [])),
        "materials": len(gltf.get("materials", [])),
        "skins": len(gltf.get("skins", [])),
        "animations": len(gltf.get("animations", [])),
        "mesh_names": [mesh.get("name", f"mesh_{index}") for index, mesh in enumerate(gltf.get("meshes", []))],
        "node_names": [node.get("name", f"node_{index}") for index, node in enumerate(gltf.get("nodes", []))],
    }


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "input" / "input.glb"
    if not target.is_absolute():
        target = ROOT / target
    if not target.exists():
        print(f"missing={target}")
        raise SystemExit(1)
    print(json.dumps(inspect(target), indent=2))


if __name__ == "__main__":
    main()
