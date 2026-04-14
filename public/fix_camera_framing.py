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

print("=== MEASURE HERO FULL BOUNDS ===")
hero_meshes = [o for o in bpy.data.objects if o.name.startswith('Object_') and o.type=='MESH' and o.data is not None]
if hero_meshes:
    amin = Vector((999,999,999))
    amax = Vector((-999,-999,-999))
    for o in hero_meshes:
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            for i in range(3):
                amin[i] = min(amin[i], wc[i])
                amax[i] = max(amax[i], wc[i])
    hero_h = amax.z - amin.z
    hero_cx = (amax.x + amin.x) / 2
    hero_cy = (amax.y + amin.y) / 2
    hero_mid_z = (amax.z + amin.z) / 2
    print(f"  h={hero_h:.2f} cx={hero_cx:.2f} cy={hero_cy:.2f} mid_z={hero_mid_z:.2f} top={amax.z:.2f} bot={amin.z:.2f}")
else:
    hero_h = 1.7; hero_cx = 0; hero_cy = 0; hero_mid_z = 0.85
    print("  fallback defaults")

cam = scene.camera
lens_mm = 28
fov_v = 2 * math.atan((24 / lens_mm) / 2)
margin = 1.25
dist = (hero_h * margin / 2) / math.tan(fov_v / 2)
cam_y = hero_cy - dist

cam.location = Vector((hero_cx, cam_y, hero_mid_z))
cam.rotation_euler = (math.radians(90), 0, 0)
cam.data.lens = lens_mm
cam.data.sensor_width = 36

print(f"\n=== CAMERA SET ===")
print(f"  lens={lens_mm}mm dist={dist:.2f} cam_y={cam_y:.2f} cam_z={hero_mid_z:.2f}")
print(f"  loc={[round(x,3) for x in cam.location]}")

bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
scene.render.filepath = r"C:\Users\Aiden\Desktop\anime_shrine_final.png"
bpy.ops.render.render(write_still=True)
print("FRAMING_FIX_OK")
