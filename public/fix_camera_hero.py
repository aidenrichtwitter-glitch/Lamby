import bpy, math
from mathutils import Vector

scene = bpy.context.scene

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type != "CPU"
scene.cycles.device = "GPU"

print("=== HERO OBJECTS ===")
hero_roots = []
for o in bpy.data.objects:
    if o.type == 'MESH' and o.parent is None and o.name.startswith('Object_'):
        hero_roots.append(o)
        print(f"  {o.name}: loc={[round(x,3) for x in o.location]} rot={[round(math.degrees(x),1) for x in o.rotation_euler]}")
    elif o.parent is None and 'Object' in o.name and o.type == 'ARMATURE':
        print(f"  ARMATURE {o.name}: rot={[round(math.degrees(x),1) for x in o.rotation_euler]}")

print("\n=== ALL ROOT OBJECTS ===")
for o in bpy.data.objects:
    if o.parent is None:
        print(f"  {o.name} type={o.type} loc={[round(x,2) for x in o.location]} rot={[round(math.degrees(x),1) for x in o.rotation_euler]}")

print("\n=== CAMERA ===")
cam = scene.camera
if cam:
    print(f"  loc={[round(x,3) for x in cam.location]}")
    print(f"  rot={[round(math.degrees(x),1) for x in cam.rotation_euler]}")
    print(f"  lens={cam.data.lens}")
print("DUMP_DONE")
