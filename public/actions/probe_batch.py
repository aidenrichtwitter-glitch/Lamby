import bpy, json, os, sys, traceback
from mathutils import Vector

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))
glb_dir = CONFIG.get("glb_dir", r"C:\Users\Aiden\Downloads")
max_probe = CONFIG.get("max_probe", 10)

import glob
glb_files = sorted(glob.glob(os.path.join(glb_dir, "*.glb")))[:max_probe]

results = []

for glb_path in glb_files:
    try:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
        for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
        for block in list(bpy.data.materials): bpy.data.materials.remove(block)
        for block in list(bpy.data.armatures): bpy.data.armatures.remove(block)

        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=glb_path)
        after = set(bpy.data.objects.keys())
        new_names = after - before

        mesh_count = 0
        armature_count = 0
        total_verts = 0
        max_dim = 0
        has_blocker = False
        needs_mat_fix = False

        for name in new_names:
            obj = bpy.data.objects.get(name)
            if not obj:
                continue
            if obj.type == 'MESH' and obj.data is not None:
                mesh_count += 1
                total_verts += len(obj.data.vertices)
                bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
                sx = max(v[0] for v in bb) - min(v[0] for v in bb)
                sy = max(v[1] for v in bb) - min(v[1] for v in bb)
                sz = max(v[2] for v in bb) - min(v[2] for v in bb)
                max_dim = max(max_dim, sx, sy, sz)
                if sx > 3.0 or sy > 3.0:
                    has_blocker = True
                for slot in obj.material_slots:
                    if slot.material and slot.material.node_tree:
                        if any(n.type == 'EMISSION' for n in slot.material.node_tree.nodes):
                            needs_mat_fix = True
            elif obj.type == 'ARMATURE':
                armature_count += 1

        quality = "empty"
        if mesh_count == 0:
            quality = "empty"
        elif mesh_count <= 5 and armature_count > 0:
            quality = "ideal"
        elif mesh_count <= 15:
            quality = "usable"
        else:
            quality = "complex"

        fname = os.path.basename(glb_path)
        results.append({
            "file": fname,
            "quality": quality,
            "meshes": mesh_count,
            "armatures": armature_count,
            "vertices": total_verts,
            "max_dim": round(max_dim, 2),
            "blocker": has_blocker,
            "unlit": needs_mat_fix
        })
        print(f"  {fname}: {quality} | {mesh_count}M {armature_count}A {total_verts}V dim={max_dim:.1f} blocker={has_blocker} unlit={needs_mat_fix}")

    except Exception as e:
        fname = os.path.basename(glb_path)
        results.append({"file": fname, "error": str(e)})
        print(f"  {fname}: ERROR {e}")

ideal = [r for r in results if r.get("quality") == "ideal"]
usable = [r for r in results if r.get("quality") == "usable"]

print("\n" + "=" * 60)
print(f"PROBED {len(results)} models: {len(ideal)} ideal, {len(usable)} usable")
if ideal:
    print(f"BEST: {ideal[0]['file']}")
elif usable:
    print(f"BEST: {usable[0]['file']}")
print("=" * 60)

print("PROBE_RESULT:" + json.dumps({"probed": len(results), "ideal": ideal, "usable": usable, "all": results}))
