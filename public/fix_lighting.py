import bpy, math

scene = bpy.context.scene

print("=== ENABLE GPU ===")
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for device in prefs.devices:
    device.use = device.type != "CPU"
scene.cycles.device = "GPU"
print(f"  Devices: {[d.name for d in prefs.devices if d.use]}")

print("=== ADD FRONT FILL LIGHTS ===")
front = bpy.data.lights.new("FrontFill", 'AREA')
front.energy = 0.6
front.color = (1.0, 0.92, 0.82)
front.size = 4
fo = bpy.data.objects.new("FrontFill", front)
bpy.context.collection.objects.link(fo)
fo.location = (0, -4, 3)
fo.rotation_euler = (math.radians(55), 0, 0)

front2 = bpy.data.lights.new("FrontFill2", 'AREA')
front2.energy = 0.4
front2.color = (0.9, 0.88, 1.0)
front2.size = 3
fo2 = bpy.data.objects.new("FrontFill2", front2)
bpy.context.collection.objects.link(fo2)
fo2.location = (-2, -3, 2)
fo2.rotation_euler = (math.radians(50), math.radians(20), 0)

for o in bpy.data.objects:
    if o.type == 'LIGHT' and o.name == 'KeySun':
        o.data.energy = 1.0
        print(f"  KeySun bumped to {o.data.energy}")

scene.cycles.samples = 96
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
scene.render.filepath = r"C:\Users\Aiden\Desktop\anime_shrine_final.png"
bpy.ops.render.render(write_still=True)
print("LIGHTING_FIX_OK")
