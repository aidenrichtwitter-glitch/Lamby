import bpy, math
from mathutils import Vector

scene = bpy.context.scene

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type != "CPU"
scene.cycles.device = "GPU"
scene.cycles.samples = 32

scene.render.resolution_x = 480
scene.render.resolution_y = 270
scene.render.resolution_percentage = 100

print("=== HERO BOUNDS ===")
xs, ys, zs = [], [], []
for o in bpy.data.objects:
    if o.name.startswith('Object_') and o.type == 'MESH' and o.data:
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            xs.append(wc.x); ys.append(wc.y); zs.append(wc.z)
if xs:
    cx=(min(xs)+max(xs))/2; cy=(min(ys)+max(ys))/2; cz=(min(zs)+max(zs))/2; h=max(zs)-min(zs)
    print(f"  cx={cx:.2f} cy={cy:.2f} cz={cz:.2f} h={h:.2f}")
    print(f"  yrange=[{min(ys):.2f},{max(ys):.2f}]")
else:
    cx=0; cy=0; cz=0.85; h=1.7; print("  fallback")

cam = scene.camera
lens = 35
sensor_h = 36*(9/16)
half_fov = math.atan((sensor_h/2)/lens)
dist = (h*1.25/2)/math.tan(half_fov)
cam.location = Vector((cx, cy-dist, cz))
cam.rotation_euler = (math.radians(90), 0, 0)
cam.data.lens = lens
cam.data.sensor_width = 36
print(f"  dist={dist:.2f} cam=({cx:.1f},{cy-dist:.2f},{cz:.2f}) lens={lens}")

scene.render.filepath = r"C:\Users\Aiden\Desktop\quick_render.png"
bpy.ops.render.render(write_still=True)
print("QUICK_OK")
