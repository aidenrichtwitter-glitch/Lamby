import bpy

scene = bpy.context.scene

scene.render.engine = 'CYCLES'
scene.cycles.samples = 128
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

scene.frame_start = 1
scene.frame_end = 10
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_final_'
scene.render.image_settings.file_format = 'PNG'

print("═══ RENDERING 10 FRAMES — Cycles 128 samples ═══")
bpy.ops.render.render(animation=True)
print("═══ DONE ═══")
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_landscape_v5.blend')
