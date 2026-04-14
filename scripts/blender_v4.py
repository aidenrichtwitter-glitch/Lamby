import bpy, math, random
from mathutils import Vector

random.seed(123)
scene = bpy.context.scene

terrain = bpy.data.objects.get("Terrain")
if terrain and terrain.data.materials:
    mat = terrain.data.materials[0]
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.12, 0.38, 0.05, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.85
        bsdf.inputs["Specular IOR Level"].default_value = 0.2

water = bpy.data.objects.get("Water")
if water and water.data.materials:
    wmat = water.data.materials[0]
    wnt = wmat.node_tree
    wbsdf = wnt.nodes.get("Principled BSDF")
    if wbsdf:
        wbsdf.inputs["Base Color"].default_value = (0.05, 0.25, 0.35, 1.0)
        wbsdf.inputs["Roughness"].default_value = 0.02
        wbsdf.inputs["IOR"].default_value = 1.33
        wbsdf.inputs["Transmission Weight"].default_value = 0.8
        wbsdf.inputs["Alpha"].default_value = 0.85

canopy_mat = bpy.data.materials.get("CanopyMaterial")
if canopy_mat:
    cnt = canopy_mat.node_tree
    cbsdf = cnt.nodes.get("Principled BSDF")
    if cbsdf:
        cbsdf.inputs["Base Color"].default_value = (0.08, 0.38, 0.04, 1.0)
        cbsdf.inputs["Roughness"].default_value = 0.7
        cbsdf.inputs["Subsurface Weight"].default_value = 0.15
        cbsdf.inputs["Subsurface Radius"].default_value = (0.1, 0.5, 0.05)

greens = [
    (0.08, 0.35, 0.04, 1), (0.1, 0.42, 0.06, 1), (0.06, 0.3, 0.03, 1),
    (0.12, 0.45, 0.08, 1), (0.07, 0.38, 0.05, 1)
]
for obj in bpy.data.objects:
    if obj.name.startswith("BgCanopy_") and not obj.data.materials:
        idx = int(obj.name.split("_")[1]) % len(greens)
        mat_c = bpy.data.materials.new(f"BgCanopy_Mat_{obj.name}")
        mat_c.use_nodes = True
        bsdf_c = mat_c.node_tree.nodes["Principled BSDF"]
        bsdf_c.inputs["Base Color"].default_value = greens[idx]
        bsdf_c.inputs["Roughness"].default_value = 0.7
        obj.data.materials.append(mat_c)

rock_mat = bpy.data.materials.get("RockMaterial")
if rock_mat:
    rnt = rock_mat.node_tree
    rbsdf = rnt.nodes.get("Principled BSDF")
    if rbsdf:
        rbsdf.inputs["Base Color"].default_value = (0.35, 0.33, 0.3, 1.0)
        rbsdf.inputs["Roughness"].default_value = 0.85

mtn_mat = bpy.data.materials.get("Mountain")
if mtn_mat:
    mnt_nt = mtn_mat.node_tree
    mbsdf = mnt_nt.nodes.get("Principled BSDF")
    if mbsdf:
        mbsdf.inputs["Base Color"].default_value = (0.2, 0.28, 0.22, 1.0)
        mbsdf.inputs["Roughness"].default_value = 0.95

fog = bpy.data.objects.get("FogPlane")
if fog and fog.data.materials:
    fmat = fog.data.materials[0]
    fnt = fmat.node_tree
    fbsdf = fnt.nodes.get("Principled BSDF")
    if fbsdf:
        fbsdf.inputs["Alpha"].default_value = 0.12
        fbsdf.inputs["Base Color"].default_value = (0.9, 0.92, 0.95, 1.0)

key_data = bpy.data.lights.new("KeyLight", 'SPOT')
key_data.energy = 50
key_data.color = (1.0, 0.92, 0.75)
key_data.spot_size = math.radians(80)
key_data.spot_blend = 0.5
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (20, -10, 15)
key_obj.rotation_euler = (math.radians(50), 0, math.radians(30))

cam = bpy.data.objects.get("SceneCamera")
if cam:
    cam.location = (8, -16, 5.5)
    cam.rotation_euler = (math.radians(75), 0, math.radians(22))
    cam.data.lens = 35
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 5.6
    cam.data.dof.focus_distance = 14
    scene.camera = cam

scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

try: scene.eevee.use_shadows = True
except: pass

bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/landscape_final.blend')
print("FINAL_SAVE_COMPLETE")

scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/landscape_final_eevee.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("EEVEE_RENDER_COMPLETE")

scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/landscape_final_cycles.png'
bpy.ops.render.render(write_still=True)
print("CYCLES_RENDER_COMPLETE")
