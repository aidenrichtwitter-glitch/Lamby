import bpy, math
from mathutils import Vector

scene = bpy.context.scene
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type != "CPU"
scene.cycles.device = "GPU"
scene.cycles.samples = 16
scene.render.resolution_x = 240
scene.render.resolution_y = 135

cam = scene.camera
cam.location = Vector((0.12, -3.58, 0.85))
cam.rotation_euler = (math.radians(90), 0, 0)
cam.data.lens = 35
cam.data.sensor_width = 36

hero_root = bpy.data.objects.get("Sketchfab_model")
print(f"Hero current rot: {math.degrees(hero_root.rotation_euler.z):.1f}") if hero_root else print("not found")

for deg in [270, 90]:
    if hero_root:
        hero_root.rotation_euler.z = math.radians(deg)
    bpy.context.view_layer.update()
    scene.render.filepath = rf"C:\Users\Aiden\Desktop\quick_{deg}.png"
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED_{deg}")

if hero_root:
    hero_root.rotation_euler.z = math.radians(270)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
print("SAVED_BLEND rot=270")
