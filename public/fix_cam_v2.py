import bpy, math
from mathutils import Vector

scene = bpy.context.scene

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type != "CPU"
scene.cycles.device = "GPU"
scene.cycles.samples = 96

print("=== HERO BOUNDS FULL ===")
all_verts_z = []
hero_xs = []
hero_ys = []
for o in bpy.data.objects:
    if not (o.name.startswith('Object_') and o.type=='MESH' and o.data is not None):
        continue
    for c in o.bound_box:
        wc = o.matrix_world @ Vector(c)
        all_verts_z.append(wc.z)
        hero_xs.append(wc.x)
        hero_ys.append(wc.y)

if all_verts_z:
    zmin, zmax = min(all_verts_z), max(all_verts_z)
    xmin, xmax = min(hero_xs), max(hero_xs)
    ymin, ymax = min(hero_ys), max(hero_ys)
    hero_h = zmax - zmin
    hero_cx = (xmin + xmax) / 2
    hero_cz = (zmin + zmax) / 2
    hero_cy = (ymin + ymax) / 2
    print(f"  h={hero_h:.2f}  zrange=[{zmin:.2f},{zmax:.2f}]")
    print(f"  cx={hero_cx:.2f} cy={hero_cy:.2f} cz={hero_cz:.2f}")
    print(f"  xrange=[{xmin:.2f},{xmax:.2f}] yrange=[{ymin:.2f},{ymax:.2f}]")
else:
    hero_h = 1.7; hero_cx = 0; hero_cy = 0; hero_cz = 0.85
    print("  fallback used")

print("\n=== SET CAMERA (full body, 28mm) ===")
cam = scene.camera

lens_mm = 28
sensor_h = 36 * (9/16)
half_fov_v = math.atan((sensor_h / 2) / lens_mm)
margin = 1.30
needed_dist = (hero_h * margin / 2) / math.tan(half_fov_v)

cam_y = hero_cy - needed_dist
cam_z = hero_cz

cam.location = Vector((hero_cx, cam_y, cam_z))

dy = hero_cy - cam.location.y
dz = hero_cz - cam.location.z
pitch = math.atan2(dz, dy)
cam.rotation_euler = (math.radians(90) - pitch, 0, 0)
cam.data.lens = lens_mm
cam.data.sensor_width = 36

print(f"  needed_dist={needed_dist:.2f} cam_y={cam_y:.2f} cam_z={cam_z:.2f}")
print(f"  half_fov_v={math.degrees(half_fov_v):.1f} deg")
print(f"  loc={[round(x,3) for x in cam.location]}")
print(f"  rot={[round(math.degrees(x),1) for x in cam.rotation_euler]}")

bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
scene.render.filepath = r"C:\Users\Aiden\Desktop\anime_shrine_final.png"
bpy.ops.render.render(write_still=True)
print("CAM_V2_OK")
