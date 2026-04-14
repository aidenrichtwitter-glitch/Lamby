import bpy, math, os, json, subprocess
from mathutils import Vector

OUT = r"C:\Users\Aiden\Desktop"
BLEND = os.path.join(OUT, "rooftop_scene.blend")

bpy.ops.wm.open_mainfile(filepath=BLEND)

scene = bpy.context.scene

hero_meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.data and len(o.data.vertices) > 1000]
hero_armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']

if hero_meshes:
    amin = Vector((999, 999, 999))
    amax = Vector((-999, -999, -999))
    for o in hero_meshes:
        if len(o.data.vertices) < 100:
            continue
        for c in o.bound_box:
            wc = o.matrix_world @ Vector(c)
            amin = Vector((min(amin[i], wc[i]) for i in range(3)))
            amax = Vector((max(amax[i], wc[i]) for i in range(3)))
    hero_center = (amin + amax) / 2
    hero_height = amax.z - amin.z
    print(f"Hero center: {hero_center}, height: {hero_height:.2f}")

    target_pos = Vector((0.3, 1.0, 0))
    offset = target_pos - Vector((hero_center.x, hero_center.y, amin.z))
    
    roots = set()
    for o in hero_meshes:
        r = o
        while r.parent:
            r = r.parent
        roots.add(r)
    for a in hero_armatures:
        r = a
        while r.parent:
            r = r.parent
        roots.add(r)
    
    for r in roots:
        r.location += offset
    bpy.context.view_layer.update()
    print(f"Moved {len(roots)} roots by {offset}")

cam = scene.camera
if cam:
    cam.location = (1.8, -2.2, 1.0)
    cam.rotation_euler = (math.radians(80), 0, math.radians(8))
    cam.data.lens = 50
    print(f"Camera: {list(cam.location)}, lens={cam.data.lens}mm")

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

scene.render.filepath = os.path.join(OUT, "rooftop_final_v2.png")
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print(f"Rendered: {scene.render.filepath}")

scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 55
jpg_path = os.path.join(OUT, "rooftop_transfer_v2.jpg")
img = bpy.data.images.get('Render Result')
if img:
    img.save_render(filepath=jpg_path, scene=scene)
print(f"JPEG: {jpg_path}")

bpy.ops.wm.save_as_mainfile(filepath=BLEND)

subprocess.Popen(['cmd', '/c', 'start', '', os.path.join(OUT, "rooftop_final_v2.png")], shell=False)
print("DONE - Render opened")
