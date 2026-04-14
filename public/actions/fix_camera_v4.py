import bpy, math, os, subprocess
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = os.path.join(OUT, "rooftop_scene.blend")

bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene

cam = scene.camera
cam.location = (2.5, -2.5, 1.2)
cam.rotation_euler = (math.radians(75), 0, math.radians(12))
cam.data.lens = 35

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "CUDA"
prefs.get_devices()
for d in prefs.devices:
    d.use = (d.type != "CPU")

scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.use_freestyle = True

scene.render.filepath = os.path.join(OUT, "rooftop_final_v4.png")
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)

scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 55
jpg_path = os.path.join(OUT, "rooftop_transfer_v4.jpg")
img = bpy.data.images.get('Render Result')
if img:
    img.save_render(filepath=jpg_path, scene=scene)

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
subprocess.Popen(['cmd', '/c', 'start', '', os.path.join(OUT, "rooftop_final_v4.png")], shell=False)
print("PIPELINE_DONE_V4")
