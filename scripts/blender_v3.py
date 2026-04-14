import bpy, math, random
from mathutils import Vector

random.seed(77)
scene = bpy.context.scene

# ─── EXTEND TERRAIN: scale up to hide edges ───
terrain = bpy.data.objects.get("Terrain")
if terrain:
    terrain.scale = (2.0, 2.0, 1.0)

# ─── FIX CAMERA: tighter angle, looking down into scene ───
cam = bpy.data.objects.get("SceneCamera")
if cam:
    cam.location = (10, -14, 6)
    cam.rotation_euler = (math.radians(72), 0, math.radians(30))
    cam.data.lens = 32
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 4.0
    cam.data.dof.focus_distance = 16
    scene.camera = cam

# ─── BRIGHTER SKY: warm golden ───
world = bpy.data.worlds["World"]
world.use_nodes = True
wnt = world.node_tree
for n in wnt.nodes:
    wnt.nodes.remove(n)
bg = wnt.nodes.new("ShaderNodeBackground")
sky = wnt.nodes.new("ShaderNodeTexSky")
sky.sky_type = 'HOSEK_WILKIE'
sky.turbidity = 2.5
sky.ground_albedo = 0.4
out_w = wnt.nodes.new("ShaderNodeOutputWorld")
wnt.links.new(sky.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.8
wnt.links.new(bg.outputs["Background"], out_w.inputs["Surface"])

# ─── SUN: warmer, lower angle for golden hour ───
sun = bpy.data.objects.get("Sun")
if sun:
    sun.data.energy = 8
    sun.data.color = (1.0, 0.9, 0.72)
    sun.data.angle = math.radians(4)
    sun.rotation_euler = (math.radians(20), math.radians(10), math.radians(200))

# ─── MORE BACKGROUND TREES (large, distant) ───
for i in range(15):
    angle = random.uniform(0, 2 * math.pi)
    dist = random.uniform(16, 28)
    x = math.cos(angle) * dist
    y = math.sin(angle) * dist
    
    trunk_h = random.uniform(1.5, 3.0)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=trunk_h, location=(x, y, trunk_h/2))
    trunk = bpy.context.active_object
    trunk.name = f"BgTrunk_{i}"
    trunk_mat = bpy.data.materials.get("TrunkMaterial")
    if trunk_mat:
        trunk.data.materials.append(trunk_mat)
    
    canopy_r = random.uniform(1.2, 2.5)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=canopy_r, location=(x, y, trunk_h + canopy_r * 0.6))
    canopy = bpy.context.active_object
    canopy.name = f"BgCanopy_{i}"
    canopy.scale = (1, 1, random.uniform(0.7, 1.0))
    bpy.ops.object.shade_smooth()
    canopy_mat = bpy.data.materials.get("CanopyMaterial")
    if canopy_mat:
        canopy.data.materials.append(canopy_mat)

# ─── WILDFLOWERS: colorful dots scattered ───
flower_colors = [
    (0.9, 0.2, 0.3, 1), (0.95, 0.85, 0.1, 1), (0.6, 0.1, 0.7, 1),
    (1.0, 0.5, 0.1, 1), (0.95, 0.4, 0.6, 1), (0.3, 0.5, 0.95, 1)
]
for i in range(30):
    x = random.uniform(-12, 12)
    y = random.uniform(-12, 12)
    z = 0.0
    if terrain:
        try:
            result, loc, norm, idx = terrain.closest_point_on_mesh(Vector((x, y, 100)))
            if result:
                z = loc.z
        except:
            pass
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.08, location=(x, y, z + 0.15))
    flower = bpy.context.active_object
    flower.name = f"Wildflower_{i}"
    
    mat_f = bpy.data.materials.new(f"Flower_{i}")
    mat_f.use_nodes = True
    fnt = mat_f.node_tree
    fbsdf = fnt.nodes["Principled BSDF"]
    c = flower_colors[i % len(flower_colors)]
    fbsdf.inputs["Base Color"].default_value = c
    fbsdf.inputs["Emission Color"].default_value = c
    fbsdf.inputs["Emission Strength"].default_value = 0.5
    flower.data.materials.append(mat_f)
    
    # Flower stem
    bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=0.12, location=(x, y, z + 0.08))
    stem = bpy.context.active_object
    stem.name = f"Stem_{i}"
    stem_mat = bpy.data.materials.get("GrassTuft")
    if stem_mat:
        stem.data.materials.append(stem_mat)

# ─── DISTANT MOUNTAINS (large scaled cubes with noise) ───
mat_mountain = bpy.data.materials.new("Mountain")
mat_mountain.use_nodes = True
mnt = mat_mountain.node_tree
mbsdf = mnt.nodes["Principled BSDF"]
mbsdf.inputs["Base Color"].default_value = (0.3, 0.35, 0.28, 1.0)
mbsdf.inputs["Roughness"].default_value = 0.95

mountain_positions = [
    (-30, 25, 0), (-20, 30, 0), (-10, 35, 0), (5, 33, 0), (20, 30, 0), (30, 25, 0)
]
for i, mp in enumerate(mountain_positions):
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=random.uniform(8, 14), radius2=random.uniform(0.5, 2), depth=random.uniform(10, 18), location=mp)
    mtn = bpy.context.active_object
    mtn.name = f"Mountain_{i}"
    mtn.location.z = -2
    bpy.ops.object.shade_smooth()
    mtn.data.materials.append(mat_mountain)

# ─── FOG PLANE (semi-transparent white plane at low altitude) ───
bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0.8))
fog = bpy.context.active_object
fog.name = "FogPlane"

mat_fog = bpy.data.materials.new("FogMaterial")
mat_fog.use_nodes = True
fnt = mat_fog.node_tree
ffbsdf = fnt.nodes["Principled BSDF"]
ffbsdf.inputs["Base Color"].default_value = (0.85, 0.88, 0.92, 1.0)
ffbsdf.inputs["Alpha"].default_value = 0.15
ffbsdf.inputs["Roughness"].default_value = 1.0

fnoise = fnt.nodes.new("ShaderNodeTexNoise")
fnoise.inputs["Scale"].default_value = 2.0
fnoise.inputs["Detail"].default_value = 4.0
fmix = fnt.nodes.new("ShaderNodeMath")
fmix.operation = 'MULTIPLY'
fmix.inputs[1].default_value = 0.2
fnt.links.new(fnoise.outputs["Fac"], fmix.inputs[0])

fog.data.materials.append(mat_fog)

# ─── RENDER SETTINGS ───
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

# ─── SAVE ───
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/landscape_v3.blend')
print("V3_SAVE_COMPLETE")

# ─── RENDER ───
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/landscape_v3.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("V3_RENDER_COMPLETE")
