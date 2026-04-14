import bpy, math
from mathutils import Vector

scene = bpy.context.scene

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type != "CPU"
scene.cycles.device = "GPU"

print("=== ROTATE HERO TO FACE CAMERA ===")
hero_root = bpy.data.objects.get("Sketchfab_model")
if hero_root:
    hero_root.rotation_euler.z = math.radians(180)
    print(f"  Hero rotated 180 deg Z: now facing -Y (toward camera)")
else:
    print("  ERROR: Sketchfab_model not found")
    for o in bpy.data.objects:
        if o.parent is None and o.type == 'EMPTY':
            print(f"  Root empty: {o.name}")

print("\n=== MEASURE HERO BOUNDS (after rotate) ===")
bpy.context.view_layer.update()
all_hero = [o for o in bpy.data.objects if o.name.startswith('Object_') and o.type=='MESH' and o.data is not None]
if all_hero:
    amin = Vector((999,999,999))
    amax = Vector((-999,-999,-999))
    for o in all_hero:
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            for i in range(3):
                amin[i] = min(amin[i], wc[i])
                amax[i] = max(amax[i], wc[i])
    hero_h = amax.z - amin.z
    hero_cx = (amax.x + amin.x) / 2
    hero_cy = (amax.y + amin.y) / 2
    hero_top = amax.z
    print(f"  Hero: h={hero_h:.2f} cx={hero_cx:.2f} cy={hero_cy:.2f} top={hero_top:.2f} bottom={amin.z:.2f}")
else:
    hero_h = 1.7
    hero_cx = 0
    hero_cy = 0
    hero_top = 1.7
    print("  Using default hero bounds (no Object_ meshes found)")

print("\n=== ADJUST CAMERA TO FRAME CHARACTER ===")
cam = scene.camera
if cam:
    cam_dist = 4.0
    cam_z = hero_h * 0.5 + 0.1
    cam_y = hero_cy - cam_dist

    cam.location = Vector((hero_cx, cam_y, cam_z))

    dx = hero_cx - cam.location.x
    dy = hero_cy - cam.location.y
    dz = (hero_h * 0.5) - cam.location.z
    dist = (dx**2 + dy**2 + dz**2) ** 0.5
    
    pitch = math.atan2(dz, (dx**2 + dy**2)**0.5)
    yaw = math.atan2(dx, dy)
    
    cam.rotation_euler = (math.radians(90) - pitch, 0, yaw)
    cam.data.lens = 40
    cam.data.sensor_width = 36
    
    print(f"  Camera: loc={[round(x,3) for x in cam.location]} rot={[round(math.degrees(x),1) for x in cam.rotation_euler]} lens={cam.data.lens}")

print("\n=== SAVE + RENDER ===")
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
scene.render.filepath = r"C:\Users\Aiden\Desktop\anime_shrine_final.png"
scene.cycles.samples = 96
bpy.ops.render.render(write_still=True)
print("ORIENTATION_FIX_OK")
