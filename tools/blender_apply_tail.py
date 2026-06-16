from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
INPUT_GLB = ROOT / "input" / "input.glb"
CONFIG = ROOT / "configs" / "fix_requests.json"
OUTPUT_GLB = ROOT / "output" / "fixed.glb"


def gltf_to_blender(point: Vector) -> Vector:
    return Vector((point.x, -point.z, point.y))


def transform_gltf_point(point: Vector, position: Vector, rotation: Euler, scale: float) -> Vector:
    matrix = Matrix.LocRotScale(position, rotation, Vector((scale, scale, scale)))
    return matrix @ point


def make_material(name: str, color: tuple[float, float, float, float], emission_strength: float):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = color
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def bezier(p0, p1, p2, p3, steps: int) -> list[Vector]:
    points = []
    for index in range(steps):
        t = index / steps
        one = 1 - t
        point = (
            one**3 * Vector(p0)
            + 3 * one**2 * t * Vector(p1)
            + 3 * one * t**2 * Vector(p2)
            + t**3 * Vector(p3)
        )
        points.append(point)
    return points


def heart_like_loop_points() -> list[Vector]:
    # This is not a literal heart icon. It is a small curled tail tip that reads
    # heart-like from the front, closer to the reference image.
    raw = []
    raw += bezier((0.21, 0.24, 0), (0.06, 0.14, 0), (-0.07, 0.03, 0), (-0.13, -0.09, 0), 24)
    raw += bezier((-0.13, -0.09, 0), (-0.20, -0.22, 0), (-0.03, -0.26, 0), (0.06, -0.14, 0), 24)
    raw += bezier((0.06, -0.14, 0), (0.08, -0.23, 0), (0.22, -0.24, 0), (0.24, -0.10, 0), 24)
    raw += bezier((0.24, -0.10, 0), (0.27, 0.04, 0), (0.24, 0.15, 0), (0.21, 0.24, 0), 24)
    return [Vector((point.x, point.y, point.z)) for point in raw]


def connector_points() -> list[Vector]:
    return [
        Vector((-0.14, -0.01, 0)),
        Vector((-0.07, 0.00, 0)),
        Vector((0.01, 0.01, 0)),
    ]


def soft_tip_points() -> list[Vector]:
    # Small, rounded devil-tail cap that reads slightly heart-like without
    # becoming a literal heart icon.
    raw = []
    raw += bezier((-0.03, 0.00, 0), (-0.01, 0.10, 0), (0.11, 0.13, 0), (0.20, 0.04, 0), 18)
    raw += bezier((0.20, 0.04, 0), (0.12, 0.02, 0), (0.10, -0.03, 0), (0.18, -0.10, 0), 18)
    raw += bezier((0.18, -0.10, 0), (0.08, -0.08, 0), (0.04, -0.04, 0), (-0.03, 0.00, 0), 18)
    return [Vector((point.x, point.y, point.z)) for point in raw]


def make_tube_mesh(
    name: str,
    center_points: list[Vector],
    radius: float,
    material,
    transform_matrix: Matrix,
    closed: bool,
    ring_segments: int = 12,
):
    vertices = []
    faces = []
    count = len(center_points)

    for index, center in enumerate(center_points):
        previous_point = center_points[index - 1 if index > 0 else (count - 2 if closed else 0)]
        next_point = center_points[(index + 1) % count if closed else min(index + 1, count - 1)]
        tangent = (next_point - previous_point)
        if tangent.length == 0:
            tangent = Vector((1, 0, 0))
        tangent.normalize()

        normal = tangent.cross(Vector((0, 0, 1)))
        if normal.length < 0.0001:
            normal = tangent.cross(Vector((0, 1, 0)))
        normal.normalize()
        binormal = tangent.cross(normal)
        binormal.normalize()

        for segment in range(ring_segments):
            angle = math.tau * segment / ring_segments
            offset = normal * math.cos(angle) * radius + binormal * math.sin(angle) * radius
            transformed = transform_matrix @ (center + offset)
            vertices.append(tuple(gltf_to_blender(transformed)))

    ring_count = count if closed else count - 1
    for index in range(ring_count):
        next_index = (index + 1) % count
        for segment in range(ring_segments):
            next_segment = (segment + 1) % ring_segments
            faces.append(
                (
                    index * ring_segments + segment,
                    next_index * ring_segments + segment,
                    next_index * ring_segments + next_segment,
                    index * ring_segments + next_segment,
                )
            )

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def make_flat_tip_mesh(name: str, points: list[Vector], thickness: float, material, transform_matrix: Matrix):
    center = sum(points, Vector()) / len(points)
    vertices = []
    faces = []

    for z in (-thickness / 2, thickness / 2):
        for point in points:
            transformed = transform_matrix @ Vector((point.x, point.y, z))
            vertices.append(tuple(gltf_to_blender(transformed)))

    front_center_index = len(vertices)
    vertices.append(tuple(gltf_to_blender(transform_matrix @ Vector((center.x, center.y, thickness / 2)))))
    back_center_index = len(vertices)
    vertices.append(tuple(gltf_to_blender(transform_matrix @ Vector((center.x, center.y, -thickness / 2)))))

    count = len(points)
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
        faces.append((front_center_index, count + index, count + next_index))
        faces.append((back_center_index, next_index, index))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_tail_tip(config: dict):
    tail = config.get("tail", {})
    position = Vector(tail.get("position", [0, 0, 0]))
    rotation = Euler(tail.get("rotation", [0, 0, 0]), "XYZ")
    scale = float(tail.get("scale", 1))

    transform = Matrix.LocRotScale(position, rotation, Vector((scale, scale, scale)))
    root = bpy.data.objects.new("codex_tail_tip_heart_like", None)
    bpy.context.collection.objects.link(root)

    tail_skin = make_material("codex_tail_blend_skin", (0.93, 0.58, 0.49, 1.0), 0.0)
    tail_shadow = make_material("codex_tail_blend_shadow", (0.72, 0.34, 0.30, 1.0), 0.0)

    connector = make_tube_mesh("codex_tail_tip_connector", connector_points(), 0.035, tail_skin, transform, False, 16)
    cap = make_flat_tip_mesh("codex_tail_soft_heart_like_cap", soft_tip_points(), 0.08, tail_skin, transform)
    rim = make_tube_mesh("codex_tail_soft_heart_like_rim", soft_tip_points(), 0.008, tail_shadow, transform, True, 8)

    for obj in [connector, cap, rim]:
        obj.parent = root


def patch_glb_materials(path: Path) -> None:
    raw = path.read_bytes()
    if raw[:4] != b"glTF":
        raise ValueError(f"Not a GLB file: {path}")

    version, total_length = struct.unpack_from("<II", raw, 4)
    if version != 2:
        raise ValueError(f"Unsupported GLB version: {version}")

    offset = 12
    chunks = []
    while offset < total_length:
        chunk_length, chunk_type = struct.unpack_from("<I4s", raw, offset)
        offset += 8
        chunk_data = raw[offset : offset + chunk_length]
        offset += chunk_length
        chunks.append((chunk_type, chunk_data))

    gltf = json.loads(chunks[0][1].decode("utf-8"))
    for material in gltf.get("materials", []):
        name = material.get("name", "")
        if name == "codex_tail_blend_skin":
            material["pbrMetallicRoughness"] = {
                "baseColorFactor": [0.93, 0.58, 0.49, 1.0],
                "metallicFactor": 0,
                "roughnessFactor": 0.78,
            }
            material["doubleSided"] = True
        elif name == "codex_tail_blend_shadow":
            material["pbrMetallicRoughness"] = {
                "baseColorFactor": [0.72, 0.34, 0.30, 1.0],
                "metallicFactor": 0,
                "roughnessFactor": 0.84,
            }
            material["doubleSided"] = True

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_padding = (4 - len(json_bytes) % 4) % 4
    json_chunk = json_bytes + b" " * json_padding

    rebuilt_chunks = [(b"JSON", json_chunk)] + chunks[1:]
    new_length = 12 + sum(8 + len(chunk_data) for _, chunk_data in rebuilt_chunks)

    output = bytearray()
    output += b"glTF"
    output += struct.pack("<II", 2, new_length)
    for chunk_type, chunk_data in rebuilt_chunks:
        output += struct.pack("<I4s", len(chunk_data), chunk_type)
        output += chunk_data
    path.write_bytes(output)


def main() -> None:
    if not INPUT_GLB.exists():
        raise SystemExit(f"Missing input GLB: {INPUT_GLB}")
    if not CONFIG.exists():
        raise SystemExit(f"Missing config: {CONFIG}")

    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    config = json.loads(CONFIG.read_text(encoding="utf-8"))

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    bpy.ops.import_scene.gltf(filepath=str(INPUT_GLB))
    add_tail_tip(config)

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    patch_glb_materials(OUTPUT_GLB)
    print(f"wrote={OUTPUT_GLB}")


if __name__ == "__main__":
    main()
