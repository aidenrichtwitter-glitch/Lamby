import bpy, json, os, math, subprocess

CONFIG = json.loads(os.environ.get("ACTION_CONFIG", "{}"))

samples = CONFIG.get("samples", 128)
res_x = CONFIG.get("resolution_x", 1920)
res_y = CONFIG.get("resolution_y", 1080)
output_name = CONFIG.get("output_name", "render_final")
output_dir = CONFIG.get("output_dir", r"C:\Users\Aiden\Desktop")
open_after = CONFIG.get("open_after", True)
save_blend = CONFIG.get("save_blend", True)
blend_path = CONFIG.get("blend_path", "")
freestyle = CONFIG.get("freestyle", True)
freestyle_color = CONFIG.get("freestyle_color", [0.05, 0.05, 0.12])
freestyle_thickness = CONFIG.get("freestyle_thickness", 1.5)
line_thickness = CONFIG.get("line_thickness", 1.2)
transfer_jpeg = CONFIG.get("transfer_jpeg", True)
jpeg_quality = CONFIG.get("jpeg_quality", 55)

scene = bpy.context.scene

prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "CUDA"
prefs.get_devices()
for d in prefs.devices:
    d.use = (d.type != "CPU")

scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'

scene.render.resolution_x = res_x
scene.render.resolution_y = res_y
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.compression = 15

if freestyle:
    scene.render.use_freestyle = True
    scene.render.line_thickness = line_thickness
    for vl in scene.view_layers:
        vl.use_freestyle = True
        fs = vl.freestyle_settings
        while len(fs.linesets) > 0:
            fs.linesets.remove(fs.linesets[0])
        ls = fs.linesets.new("AnimeOutlines")
        ls.select_silhouette = True
        ls.select_border = True
        ls.select_crease = True
        ls.select_edge_mark = False
        ls.select_external_contour = True
        ls.select_suggestive_contour = False
        ls.select_material_boundary = True
        ls.linestyle.thickness = freestyle_thickness
        ls.linestyle.color = tuple(freestyle_color)

scene.render.film_transparent = False
scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look = 'Medium High Contrast'

png_path = os.path.join(output_dir, f"{output_name}.png")
scene.render.filepath = png_path
bpy.ops.render.render(write_still=True)

result = {"action": "render_cycles", "output": png_path, "samples": samples, "resolution": f"{res_x}x{res_y}", "status": "ok"}

if save_blend and blend_path:
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    result["blend"] = blend_path

if transfer_jpeg:
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = jpeg_quality
    jpg_path = os.path.join(output_dir, f"{output_name}_transfer.jpg")
    img = bpy.data.images.get('Render Result')
    if img:
        img.save_render(filepath=jpg_path, scene=scene)
        result["jpeg"] = jpg_path

if open_after:
    subprocess.Popen(['cmd', '/c', 'start', '', png_path], shell=False)
    result["opened"] = True

print(json.dumps(result))
