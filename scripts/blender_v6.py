import bpy, math, random
from mathutils import Vector

random.seed(555)
scene = bpy.context.scene

terrain = bpy.data.objects.get("Terrain")
if terrain:
    terrain.scale = (3.0, 3.0, 1.0)

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.5))
ground_base = bpy.context.active_object
ground_base.name = "GroundBase"
mat_base = bpy.data.materials.new("GroundBase")
mat_base.use_nodes = True
bb = mat_base.node_tree.nodes["Principled BSDF"]
bb.inputs["Base Color"].default_value = (0.12, 0.25, 0.05, 1.0)
bb.inputs["Roughness"].default_value = 1.0
ground_base.data.materials.append(mat_base)

cam = bpy.data.objects.get("SceneCamera")
if cam:
    cam.location = (6, -12, 4.5)
    cam.rotation_euler = (math.radians(75), 0, math.radians(20))
    cam.data.lens = 35
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 3.5
    cam.data.dof.focus_distance = 12
    scene.camera = cam

rock_mat = bpy.data.materials.get("RockMaterial")
for i in range(4):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=random.uniform(0.3, 0.6),
        location=(2 + random.uniform(-1, 1), -8 + random.uniform(-1, 1), random.uniform(0.1, 0.4)))
    fg_rock = bpy.context.active_object
    fg_rock.name = f"FgRock_{i}"
    fg_rock.scale = (random.uniform(0.8, 1.5), random.uniform(0.6, 1.2), random.uniform(0.5, 0.8))
    bpy.ops.object.shade_smooth()
    if rock_mat: fg_rock.data.materials.append(rock_mat)

mat_mush_cap = bpy.data.materials.new("MushroomCap")
mat_mush_cap.use_nodes = True
mcb = mat_mush_cap.node_tree.nodes["Principled BSDF"]
mcb.inputs["Base Color"].default_value = (0.7, 0.15, 0.08, 1.0)
mcb.inputs["Roughness"].default_value = 0.4
mcb.inputs["Subsurface Weight"].default_value = 0.3

mat_mush_stem = bpy.data.materials.new("MushroomStem")
mat_mush_stem.use_nodes = True
msb = mat_mush_stem.node_tree.nodes["Principled BSDF"]
msb.inputs["Base Color"].default_value = (0.9, 0.85, 0.75, 1.0)
msb.inputs["Roughness"].default_value = 0.6

for i in range(5):
    mx, my = 1 + random.uniform(-2, 2), -6 + random.uniform(-2, 2)
    mz = 0.0
    if terrain:
        try:
            result, loc, norm, idx = terrain.closest_point_on_mesh(Vector((mx, my, 100)))
            if result: mz = loc.z
        except: pass
    stem_h = random.uniform(0.12, 0.25)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=stem_h, location=(mx, my, mz + stem_h/2))
    bpy.context.active_object.name = f"MushStem_{i}"
    bpy.context.active_object.data.materials.append(mat_mush_stem)
    cap_r = random.uniform(0.06, 0.12)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=cap_r, location=(mx, my, mz + stem_h))
    cap = bpy.context.active_object
    cap.name = f"MushCap_{i}"
    cap.scale = (1, 1, 0.5)
    bpy.ops.object.shade_smooth()
    cap.data.materials.append(mat_mush_cap)

for obj in bpy.data.objects:
    if obj.name.startswith("Cloud_") or obj.name.startswith("CloudPuff_"):
        obj.location.z -= 4
        obj.scale *= 1.3

scene.render.engine = 'CYCLES'
scene.cycles.samples = 256
scene.cycles.use_denoising = True
try:
    scene.cycles.device = 'GPU'
    prefs = bpy.context.preferences.addons.get('cycles')
    if prefs:
        prefs.preferences.compute_device_type = 'CUDA'
        prefs.preferences.get_devices()
        for d in prefs.preferences.devices: d.use = True
except Exception as e:
    print(f"GPU note: {e}")

scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except: pass

bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/landscape_v6.blend')
print("V6_SAVE_COMPLETE")

scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/landscape_v6_cycles.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("V6_RENDER_COMPLETE")
