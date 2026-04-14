import bpy, math
from mathutils import Vector

scene = bpy.context.scene

# Find and adjust camera
cam = bpy.data.objects.get("HeroCamera")
if cam:
    cam.location = (0, -12, 3.0)
    cam.data.lens = 35
    target = Vector((0, 0, 1.5))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    cam.data.dof.focus_distance = 12.0
    cam.data.dof.aperture_fstop = 4.0
    print(f"Camera: pos={cam.location}, lens=35mm, focus=12m")

# Quick Cycles verify
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.cycles.device = 'GPU'
prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    prefs.preferences.compute_device_type = 'CUDA'
    prefs.preferences.get_devices()
    for d in prefs.preferences.devices:
        d.use = True

scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.frame_set(1)

verify_path = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_v5b_VERIFY.png'
scene.render.filepath = verify_path
bpy.ops.render.render(write_still=True)
print(f"VERIFY saved: {verify_path}")
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_landscape_v5.blend')
