import bpy, math, os, subprocess
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = os.path.join(OUT, "rooftop_scene.blend")

bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene

hero_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.data and len(o.data.vertices) > 500]
scene_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.data and o.name.startswith(("Rooftop","RoofWall","AC_","Antenna","Crate","Puddle","Railing","Building","Window"))]
scene_mesh_names = {o.name for o in scene_meshes}
hero_candidates = [o for o in hero_meshes if o.name not in scene_mesh_names]

print(f"Hero candidates: {[o.name for o in hero_candidates]}")

if hero_candidates:
    amin = Vector((999, 999, 999))
    amax = Vector((-999, -999, -999))
    for o in hero_candidates:
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            amin = Vector((min(amin[i], wc[i]) for i in range(3)))
            amax = Vector((max(amax[i], wc[i]) for i in range(3)))
    h = amax.z - amin.z
    print(f"Hero bounds: min={amin} max={amax} height={h:.4f}")

    roots = set()
    for o in hero_candidates:
        r = o
        while r.parent:
            r = r.parent
        roots.add(r)
    for a in [o for o in bpy.data.objects if o.type == 'ARMATURE']:
        r = a
        while r.parent:
            r = r.parent
        roots.add(r)

    sf = 1.7 / max(h, 0.001)
    print(f"Scale factor: {sf:.2f}")
    for r in roots:
        r.scale *= sf
    bpy.context.view_layer.update()

    amin2 = Vector((999, 999, 999))
    amax2 = Vector((-999, -999, -999))
    for o in hero_candidates:
        if o.name not in bpy.data.objects:
            continue
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            amin2 = Vector((min(amin2[i], wc[i]) for i in range(3)))
            amax2 = Vector((max(amax2[i], wc[i]) for i in range(3)))

    target = Vector((0.3, 1.0, 0))
    offset = target - Vector((( amin2.x + amax2.x) / 2, (amin2.y + amax2.y) / 2, amin2.z))
    for r in roots:
        r.location += offset
    bpy.context.view_layer.update()

    amin3 = Vector((999, 999, 999))
    amax3 = Vector((-999, -999, -999))
    for o in hero_candidates:
        if o.name not in bpy.data.objects:
            continue
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            amin3 = Vector((min(amin3[i], wc[i]) for i in range(3)))
            amax3 = Vector((max(amax3[i], wc[i]) for i in range(3)))
    print(f"After scale+move: min={amin3} max={amax3} height={amax3.z - amin3.z:.2f}")

cam = scene.camera
if cam:
    cam.location = (1.5, -2.0, 0.9)
    cam.rotation_euler = (math.radians(82), 0, math.radians(5))
    cam.data.lens = 50

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

scene.render.filepath = os.path.join(OUT, "rooftop_final_v3.png")
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)

scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 55
jpg_path = os.path.join(OUT, "rooftop_transfer_v3.jpg")
img = bpy.data.images.get('Render Result')
if img:
    img.save_render(filepath=jpg_path, scene=scene)

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
subprocess.Popen(['cmd', '/c', 'start', '', os.path.join(OUT, "rooftop_final_v3.png")], shell=False)
print("PIPELINE_DONE")
