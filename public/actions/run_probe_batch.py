import os, json, sys, io
import bpy
from mathutils import Vector
import glob

glb_dir = r"C:\Users\Aiden\Downloads"
glb_files = sorted(glob.glob(os.path.join(glb_dir, "*.glb")))

SKIP_HUGE = 30 * 1024 * 1024
output_path = r"C:\Users\Aiden\Desktop\probe_results.txt"

results = []

for idx, glb_path in enumerate(glb_files):
    fname = os.path.basename(glb_path)
    fsize = os.path.getsize(glb_path)
    
    if fsize > SKIP_HUGE:
        results.append({"f": fname, "q": "skipped", "mb": round(fsize/1048576, 1)})
        continue
    
    try:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete()
        for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
        for block in list(bpy.data.materials): bpy.data.materials.remove(block)
        for block in list(bpy.data.armatures): bpy.data.armatures.remove(block)
        for block in list(bpy.data.images): bpy.data.images.remove(block)

        old_stderr = sys.stderr
        sys.stderr = io.StringIO()
        
        before = set(bpy.data.objects.keys())
        bpy.ops.import_scene.gltf(filepath=glb_path)
        after = set(bpy.data.objects.keys())
        new_names = after - before
        
        sys.stderr = old_stderr

        mesh_count = 0
        arm_count = 0
        total_verts = 0
        max_dim = 0
        has_blocker = False
        needs_fix = False

        for name in new_names:
            obj = bpy.data.objects.get(name)
            if not obj: continue
            if obj.type == 'MESH' and obj.data is not None:
                mesh_count += 1
                total_verts += len(obj.data.vertices)
                bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
                sx = max(v[0] for v in bb) - min(v[0] for v in bb)
                sy = max(v[1] for v in bb) - min(v[1] for v in bb)
                max_dim = max(max_dim, sx, sy, max(v[2] for v in bb) - min(v[2] for v in bb))
                if sx > 3.0 or sy > 3.0: has_blocker = True
                for slot in obj.material_slots:
                    if slot.material and slot.material.node_tree:
                        if any(n.type == 'EMISSION' for n in slot.material.node_tree.nodes):
                            needs_fix = True
            elif obj.type == 'ARMATURE':
                arm_count += 1

        quality = "empty"
        if mesh_count == 0: quality = "empty"
        elif mesh_count <= 3 and arm_count > 0: quality = "ideal"
        elif mesh_count <= 8 and arm_count > 0: quality = "good"
        elif mesh_count <= 15: quality = "usable"
        else: quality = "complex"

        results.append({"f": fname, "q": quality, "m": mesh_count, "a": arm_count, "v": total_verts, "d": round(max_dim, 1), "b": has_blocker, "u": needs_fix, "mb": round(fsize/1048576, 1)})

    except Exception as e:
        sys.stderr = old_stderr if 'old_stderr' in dir() else sys.stderr
        results.append({"f": fname, "q": "error", "e": str(e)[:80]})

lines = []
lines.append("PROBE RESULTS")
lines.append("=" * 80)
for r in results:
    q = r.get("q", "?")
    if q == "skipped":
        lines.append(f"   {r['f']:42s} SKIPPED ({r.get('mb',0):.0f}MB)")
    elif q == "error":
        lines.append(f"   {r['f']:42s} ERROR: {r.get('e','')}")
    else:
        tag = ">>>" if q in ("ideal", "good") else "   "
        lines.append(f"{tag} {r['f']:42s} {q:8s} mesh={r['m']:>3} arm={r['a']:>1} vert={r['v']:>7} dim={r['d']:>5} {r['mb']:>5.1f}MB blk={r['b']} unl={r['u']}")

lines.append("=" * 80)
ideal = [r for r in results if r.get('q') in ('ideal','good')]
usable = [r for r in results if r.get('q') == 'usable']
lines.append(f"TOTAL: {len(results)} | IDEAL/GOOD: {len(ideal)} | USABLE: {len(usable)}")
for r in ideal:
    lines.append(f"  PICK >> {r['f']} mesh={r['m']} arm={r['a']} vert={r['v']} {r['mb']}MB")

with open(output_path, 'w') as f:
    f.write('\n'.join(lines))

print('\n'.join(lines))
