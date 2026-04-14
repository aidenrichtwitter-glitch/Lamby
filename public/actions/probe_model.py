import bpy, json, os, sys, traceback
from mathutils import Vector

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

glb_path = CONFIG.get("glb_path", "")

try:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials): bpy.data.materials.remove(block)

    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=glb_path)
    after = set(bpy.data.objects.keys())
    new_names = after - before

    meshes = []
    armatures = []
    empties = []
    max_dim = 0

    for name in new_names:
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        if obj.type == 'MESH' and obj.data is not None:
            bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
            sx = max(v[0] for v in bb) - min(v[0] for v in bb)
            sy = max(v[1] for v in bb) - min(v[1] for v in bb)
            sz = max(v[2] for v in bb) - min(v[2] for v in bb)
            max_dim = max(max_dim, sx, sy, sz)
            verts = len(obj.data.vertices)
            has_emission = False
            mat_names = []
            for slot in obj.material_slots:
                if slot.material:
                    mat_names.append(slot.material.name)
                    if slot.material.node_tree:
                        has_emission = any(n.type == 'EMISSION' for n in slot.material.node_tree.nodes)
            meshes.append({
                "name": name,
                "vertices": verts,
                "dimensions": [round(sx, 2), round(sy, 2), round(sz, 2)],
                "materials": mat_names,
                "has_unlit_emission": has_emission,
                "parent": obj.parent.name if obj.parent else None
            })
        elif obj.type == 'ARMATURE':
            bone_count = len(obj.data.bones) if obj.data else 0
            armatures.append({"name": name, "bones": bone_count})
        elif obj.type == 'EMPTY':
            empties.append(name)

    has_blocker = any(max(m["dimensions"][0], m["dimensions"][1]) > 3.0 for m in meshes)
    needs_material_fix = any(m["has_unlit_emission"] for m in meshes)
    has_armature = len(armatures) > 0
    mesh_count = len(meshes)

    quality = "good"
    issues = []
    if mesh_count > 15:
        quality = "complex"
        issues.append(f"{mesh_count} meshes (multi-mesh)")
    if not has_armature:
        issues.append("no armature (cannot pose)")
    if has_blocker:
        issues.append("has oversized blocker mesh (>3m)")
    if needs_material_fix:
        issues.append("has unlit emission materials (needs fix)")
    if mesh_count == 0:
        quality = "empty"
        issues.append("no meshes found")

    if mesh_count <= 5 and has_armature:
        quality = "ideal"
    elif mesh_count <= 15:
        quality = "usable"

    result = {
        "action": "probe_model",
        "glb_path": glb_path,
        "quality": quality,
        "mesh_count": mesh_count,
        "armature_count": len(armatures),
        "has_blocker": has_blocker,
        "needs_material_fix": needs_material_fix,
        "max_dimension": round(max_dim, 2),
        "total_vertices": sum(m["vertices"] for m in meshes),
        "issues": issues,
        "meshes": meshes[:10],
        "armatures": armatures,
        "status": "ok"
    }
    print(json.dumps(result))

except Exception as e:
    print(json.dumps({"action": "probe_model", "glb_path": glb_path, "error": str(e), "status": "error"}))
    traceback.print_exc()
