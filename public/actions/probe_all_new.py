import bpy, os, json, traceback
from mathutils import Vector

DOWNLOADS = r"C:\Users\Aiden\Downloads"
OUT = r"C:\Users\Aiden\Desktop\probe_all_new.json"

# All unknown GLBs (not yet probed)
SKIP = {
    "9263ca597dea49bb8bb249f21c7bdc4d",  # proven anime girl
    "71f86ae0a1c148a69fe3327397fff5ee",  # butterfly - skip
    "9d84a78f745e47b0b0d548b2e7ffa50c",  # known usable
}

results = []

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for c in [bpy.data.meshes, bpy.data.materials, bpy.data.lights,
              bpy.data.cameras, bpy.data.images, bpy.data.armatures,
              bpy.data.textures, bpy.data.collections]:
        for b in list(c): c.remove(b)

glbs = [f for f in os.listdir(DOWNLOADS) if f.endswith('.glb')]
print(f"Found {len(glbs)} GLBs")

for fname in sorted(glbs):
    uid = fname.replace('.glb', '')
    if uid in SKIP:
        print(f"SKIP {uid}")
        continue
    path = os.path.join(DOWNLOADS, fname)
    size_mb = os.path.getsize(path) / (1024*1024)
    if size_mb > 35:
        results.append({"uid": uid, "verdict": "too_large", "size_mb": round(size_mb,1)})
        print(f"SKIP_LARGE {uid} {size_mb:.1f}MB")
        continue

    try:
        clear()
        bpy.ops.import_scene.gltf(filepath=path)
        for c in bpy.data.collections:
            if c.name not in [ch.name for ch in bpy.context.scene.collection.children]:
                bpy.context.scene.collection.children.link(c)
        bpy.context.view_layer.update()

        objs = list(bpy.context.scene.objects)
        mesh_count = sum(1 for o in objs if o.type == 'MESH')
        arm_count = sum(1 for o in objs if o.type == 'ARMATURE')
        total = len(objs)

        # Measure bounding box
        amin = Vector((9999,9999,9999))
        amax = Vector((-9999,-9999,-9999))
        for o in objs:
            if o.type == 'MESH':
                for c in o.bound_box:
                    wc = o.matrix_world @ Vector(c)
                    amin = Vector((min(amin[i],wc[i]) for i in range(3)))
                    amax = Vector((max(amax[i],wc[i]) for i in range(3)))

        h = round(amax.z - amin.z, 3)
        w = round(amax.x - amin.x, 3)
        d = round(amax.y - amin.y, 3)

        # Classify
        if arm_count > 0 and mesh_count <= 8 and h > 0.5:
            verdict = "IDEAL_CHARACTER" if mesh_count <= 4 else "GOOD_CHARACTER"
        elif arm_count > 0:
            verdict = "ARMATURE_COMPLEX"
        elif mesh_count <= 3 and total <= 5:
            verdict = "SIMPLE_PROP"
        elif mesh_count <= 20:
            verdict = "PROP"
        else:
            verdict = "COMPLEX"

        r = {"uid": uid, "verdict": verdict, "meshes": mesh_count, "arms": arm_count,
             "total_objs": total, "height": h, "width": w, "depth": d, "size_mb": round(size_mb,1)}
        results.append(r)
        print(f"{verdict:25s} {uid[:12]} meshes={mesh_count} arm={arm_count} h={h:.2f} sz={size_mb:.1f}MB")

    except Exception as e:
        results.append({"uid": uid, "verdict": "error", "error": str(e)[:80], "size_mb": round(size_mb,1)})
        print(f"ERROR {uid}: {e}")

clear()
with open(OUT, 'w') as f:
    json.dump(results, f, indent=2)
print(f"\nDONE: {len(results)} probed, saved to {OUT}")
ideal = [r for r in results if 'CHARACTER' in r.get('verdict','')]
print(f"Characters found: {len(ideal)}")
for r in ideal:
    print(f"  {r['verdict']:20s} {r['uid']} meshes={r['meshes']} arms={r['arms']} h={r['height']:.2f}m")
