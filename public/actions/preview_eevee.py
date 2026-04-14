import bpy, json, os

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

output_dir = CONFIG.get("output_dir", r"C:\Users\Aiden\Desktop")
output_name = CONFIG.get("output_name", "preview")
res_x = CONFIG.get("resolution_x", 320)
res_y = CONFIG.get("resolution_y", 180)
samples = CONFIG.get("samples", 8)
quality = CONFIG.get("jpeg_quality", 60)

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = res_x
scene.render.resolution_y = res_y
scene.eevee.taa_render_samples = samples
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = quality

filepath = os.path.join(output_dir, f"{output_name}.jpg")
scene.render.filepath = filepath
bpy.ops.render.render(write_still=True)

print(json.dumps({
    "action": "preview_eevee",
    "output": filepath,
    "resolution": f"{res_x}x{res_y}",
    "samples": samples,
    "status": "ok"
}))
