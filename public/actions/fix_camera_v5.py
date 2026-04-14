import bpy, math, os, subprocess
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = os.path.join(OUT, "rooftop_scene.blend")

bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene

hero_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.data and len(o.data.vertices) > 500
               and not o.name.startswith(("Rooftop","RoofWall","AC_","Antenna","Crate","Puddle","Railing","Building","Window"))]
if hero_meshes:
    amin = Vector((999, 999, 999))
    amax = Vector((-999, -999, -999))
    for o in hero_meshes:
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            amin = Vector((min(amin[i], wc[i]) for i in range(3)))
            amax = Vector((max(amax[i], wc[i]) for i in range(3)))
    hero_center = (amin + amax) / 2
    print(f"Hero center: {hero_center}, height: {amax.z - amin.z:.2f}")

    cam = scene.camera
    cam.location = (hero_center.x + 2.5, hero_center.y - 3.0, hero_center.z + 0.1)
    
    from mathutils import Matrix
    direction = hero_center - cam.location.copy()
    direction = Vector((hero_center.x - cam.location.x, hero_center.y - cam.location.y, hero_center.z - cam.location.z))
    rot = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot.to_euler()
    cam.data.lens = 40
    print(f"Camera aimed at hero center, lens=40mm")

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

scene.render.filepath = os.path.join(OUT, "rooftop_final_v5.png")
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)

scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 70
jpg_path = os.path.join(OUT, "rooftop_transfer_v5.jpg")
img = bpy.data.images.get('Render Result')
if img:
    img.save_render(filepath=jpg_path, scene=scene)

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
subprocess.Popen(['cmd', '/c', 'start', '', os.path.join(OUT, "rooftop_final_v5.png")], shell=False)
print("PIPELINE_DONE_V5")
