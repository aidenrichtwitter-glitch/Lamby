import bpy, os, json, traceback
from mathutils import Vector

DOWNLOADS = r"C:\Users\Aiden\Downloads"
OUT = r"C:\Users\Aiden\Desktop\quick_probe.json"

# Probe just the most promising smaller files
TARGETS = [
    "147ae7d0d332456a99ec6195e9b0cd4f",
    "14d2eaa145ee42938e004115871adf6c",
    "19032d140af645fda039f09de2d798ad",
    "33816ae6790045e992e8b7441c7d62f2",
    "367bf01e57b2492ab29eed7a8b58ee57",
    "3bb3c812efa1447a9bb82000856d9bf3",
    "46e7067350fa466cbe9110369c9e65de",
    "49d9266af75f422094b4a3535487dbea",
    "5099e0d22c94437c9903079ec20ed08e",
    "5587e85201db4d7fa6297ef7da1d8d48",
    "79e0a10c1ed249b6b5c9a65030826b75",
    "7daf178b3fa64e2fa7b2c2d19cf2a4bf",
    "85187f9f246f4702b7c137dcc6c0fc12",
    "87f34d47561448429c5dbc5ce5e09cbe",
    "b22f2cae465e4445b598353df55c805a",
    "b29ae26fd3b746698eed1efd33dabc59",
    "b8e1967c0703492e8121d9457f056d27",
    "b927f714e7494bb3ba2adb9bde67c7c6",
    "c48d9df217c245efb1ecda3da6893226",
    "bc1df9f4b7de421886b84af8ee8bcea1",
]

results = []

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for c in [bpy.data.meshes, bpy.data.materials, bpy.data.lights,
              bpy.data.cameras, bpy.data.images, bpy.data.armatures,
              bpy.data.textures]:
        for b in list(c): c.remove(b)

for uid in TARGETS:
    path = os.path.join(DOWNLOADS, uid + ".glb")
    if not os.path.exists(path):
        print(f"MISSING {uid}")
        continue
    size_mb = os.path.getsize(path) / (1024*1024)
    if size_mb > 30:
        results.append({"uid": uid, "verdict": "skip_large", "size_mb": round(size_mb,1)})
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
        mesh_c = sum(1 for o in objs if o.type == 'MESH')
        arm_c = sum(1 for o in objs if o.type == 'ARMATURE')

        # Bounding box
        amin = Vector((9999,9999,9999)); amax = Vector((-9999,-9999,-9999))
        for o in objs:
            if o.type == 'MESH':
                for c in o.bound_box:
                    wc = o.matrix_world @ Vector(c)
                    amin = Vector((min(amin[i],wc[i]) for i in range(3)))
                    amax = Vector((max(amax[i],wc[i]) for i in range(3)))
        h = round(amax.z - amin.z, 3)

        if arm_c > 0 and mesh_c <= 8 and h > 0.3:
            v = "IDEAL_CHAR" if mesh_c <= 4 else "GOOD_CHAR"
        elif arm_c > 0:
            v = "ARM_COMPLEX"
        elif mesh_c <= 20:
            v = "PROP"
        else:
            v = "COMPLEX"

        r = {"uid": uid, "verdict": v, "meshes": mesh_c, "arms": arm_c, "height": h, "size_mb": round(size_mb,1)}
        results.append(r)
        print(f"{v:15s} {uid} m={mesh_c} a={arm_c} h={h:.2f}m sz={size_mb:.1f}MB")
    except Exception as e:
        results.append({"uid": uid, "verdict": "error", "error": str(e)[:60]})
        print(f"ERR {uid}: {str(e)[:50]}")

clear()
with open(OUT, 'w') as f:
    json.dump(results, f, indent=2)
chars = [r for r in results if 'CHAR' in r.get('verdict','')]
print(f"\nDONE {len(results)} probed, {len(chars)} characters")
for r in chars:
    print(f"  {r['verdict']} {r['uid']} m={r['meshes']} h={r['height']:.2f}m")
