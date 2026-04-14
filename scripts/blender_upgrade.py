import bpy, math, random, bmesh
from mathutils import Vector, noise

random.seed(42)
scene = bpy.context.scene

# ─── CAMERA: cinematic wide angle ───
cam = bpy.data.objects.get("SceneCamera")
if cam:
    cam.location = (18, -18, 9)
    cam.rotation_euler = (math.radians(62), 0, math.radians(42))
    cam.data.lens = 24
    cam.data.dof.use_dof = True
    cam.data.dof.aperture_fstop = 2.8
    cam.data.dof.focus_distance = 22
    scene.camera = cam

# ─── IMPROVED SUN: golden hour warmth ───
sun = bpy.data.objects.get("Sun")
if sun:
    sun.data.energy = 6
    sun.data.color = (1.0, 0.88, 0.7)
    sun.data.angle = math.radians(3)
    sun.rotation_euler = (math.radians(25), math.radians(15), math.radians(210))

# ─── WORLD: atmospheric sky with ground color ───
world = bpy.data.worlds["World"]
world.use_nodes = True
wnt = world.node_tree
for n in wnt.nodes:
    wnt.nodes.remove(n)
bg = wnt.nodes.new("ShaderNodeBackground")
sky = wnt.nodes.new("ShaderNodeTexSky")
sky.sky_type = 'HOSEK_WILKIE'
sky.turbidity = 3.0
sky.ground_albedo = 0.3
out_w = wnt.nodes.new("ShaderNodeOutputWorld")
wnt.links.new(sky.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.2
wnt.links.new(bg.outputs["Background"], out_w.inputs["Surface"])

# ─── WINDING PATH (curve + mesh) ───
path_points = [
    Vector((-12, -6, 0.05)), Vector((-8, -3, 0.05)), Vector((-4, -1, 0.05)),
    Vector((0, 0.5, 0.05)), Vector((4, 2, 0.05)), Vector((7, 5, 0.05)),
    Vector((10, 9, 0.05)), Vector((13, 12, 0.05))
]
curve_data = bpy.data.curves.new("PathCurve", type='CURVE')
curve_data.dimensions = '3D'
spline = curve_data.splines.new('BEZIER')
spline.bezier_points.add(len(path_points) - 1)
for i, pt in enumerate(path_points):
    bp = spline.bezier_points[i]
    bp.co = pt
    bp.handle_left_type = 'AUTO'
    bp.handle_right_type = 'AUTO'
curve_data.bevel_depth = 0.6
curve_data.bevel_resolution = 4
path_obj = bpy.data.objects.new("DirtPath", curve_data)
bpy.context.collection.objects.link(path_obj)
path_obj.location.z = 0.02

mat_path = bpy.data.materials.new("PathMaterial")
mat_path.use_nodes = True
pnt = mat_path.node_tree
pbsdf = pnt.nodes["Principled BSDF"]
pbsdf.inputs["Base Color"].default_value = (0.35, 0.25, 0.15, 1.0)
pbsdf.inputs["Roughness"].default_value = 0.95
pnoise = pnt.nodes.new("ShaderNodeTexNoise")
pnoise.inputs["Scale"].default_value = 15.0
pnoise.inputs["Detail"].default_value = 8.0
pbump = pnt.nodes.new("ShaderNodeBump")
pbump.inputs["Strength"].default_value = 0.3
pnt.links.new(pnoise.outputs["Fac"], pbump.inputs["Height"])
pnt.links.new(pbump.outputs["Normal"], pbsdf.inputs["Normal"])
path_obj.data.materials.append(mat_path)

# ─── CLOUDS (displaced planes with translucent material) ───
mat_cloud = bpy.data.materials.new("CloudMaterial")
mat_cloud.use_nodes = True
cnt = mat_cloud.node_tree
cbsdf = cnt.nodes["Principled BSDF"]
cbsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
cbsdf.inputs["Roughness"].default_value = 1.0
cbsdf.inputs["Alpha"].default_value = 0.7
cbsdf.inputs["Subsurface Weight"].default_value = 0.5
cbsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.8, 0.6)

cloud_positions = [
    (5, 8, 18), (-8, 12, 20), (12, -5, 22), (-3, -10, 19), (15, 15, 21),
    (-10, 5, 23), (8, -12, 20), (0, 15, 24)
]
for i, pos in enumerate(cloud_positions):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=random.uniform(2.0, 4.0), location=pos)
    cloud = bpy.context.active_object
    cloud.name = f"Cloud_{i}"
    cloud.scale = (random.uniform(1.5, 3.0), random.uniform(1.0, 2.0), random.uniform(0.4, 0.8))
    bpy.ops.object.shade_smooth()
    
    mod = cloud.modifiers.new("Displace", 'DISPLACE')
    tex = bpy.data.textures.new(f"CloudTex_{i}", 'CLOUDS')
    tex.noise_scale = random.uniform(1.5, 3.0)
    mod.texture = tex
    mod.strength = random.uniform(0.8, 1.5)
    
    for ci in range(random.randint(2, 4)):
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=2,
            radius=random.uniform(1.0, 2.5),
            location=(pos[0] + random.uniform(-2, 2), pos[1] + random.uniform(-1.5, 1.5), pos[2] + random.uniform(-0.3, 0.5))
        )
        puff = bpy.context.active_object
        puff.name = f"CloudPuff_{i}_{ci}"
        puff.scale = (random.uniform(1.0, 2.0), random.uniform(0.8, 1.5), random.uniform(0.3, 0.7))
        bpy.ops.object.shade_smooth()
        puff.data.materials.append(mat_cloud)
    
    cloud.data.materials.append(mat_cloud)

# ─── STREAM/CREEK (curve with animated-looking water) ───
stream_pts = [
    Vector((8, -14, 0.02)), Vector((6, -10, 0.02)), Vector((3, -6, 0.02)),
    Vector((1, -2, 0.01)), Vector((-1, 2, 0.01)), Vector((-3, 6, 0.01)),
    Vector((-6, 10, 0.01))
]
stream_curve = bpy.data.curves.new("StreamCurve", type='CURVE')
stream_curve.dimensions = '3D'
spl = stream_curve.splines.new('BEZIER')
spl.bezier_points.add(len(stream_pts) - 1)
for i, pt in enumerate(stream_pts):
    bp = spl.bezier_points[i]
    bp.co = pt
    bp.handle_left_type = 'AUTO'
    bp.handle_right_type = 'AUTO'
stream_curve.bevel_depth = 0.3
stream_curve.bevel_resolution = 6
stream_obj = bpy.data.objects.new("Stream", stream_curve)
bpy.context.collection.objects.link(stream_obj)

mat_stream = bpy.data.materials.new("StreamWater")
mat_stream.use_nodes = True
snt = mat_stream.node_tree
sbsdf = snt.nodes["Principled BSDF"]
sbsdf.inputs["Base Color"].default_value = (0.15, 0.35, 0.45, 1.0)
sbsdf.inputs["Metallic"].default_value = 0.1
sbsdf.inputs["Roughness"].default_value = 0.05
sbsdf.inputs["IOR"].default_value = 1.33
sbsdf.inputs["Transmission Weight"].default_value = 0.6
sbsdf.inputs["Alpha"].default_value = 0.8
stream_obj.data.materials.append(mat_stream)

# ─── GRASS TUFTS (small cone clusters scattered on terrain) ───
terrain = bpy.data.objects.get("Terrain")
mat_grass = bpy.data.materials.new("GrassTuft")
mat_grass.use_nodes = True
gnt = mat_grass.node_tree
gbsdf = gnt.nodes["Principled BSDF"]
gbsdf.inputs["Base Color"].default_value = (0.15, 0.45, 0.08, 1.0)
gbsdf.inputs["Roughness"].default_value = 0.85

for i in range(40):
    x = random.uniform(-14, 14)
    y = random.uniform(-14, 14)
    z = 0.0
    if terrain:
        try:
            result, loc, norm, idx = terrain.closest_point_on_mesh(Vector((x, y, 100)))
            if result:
                z = loc.z
        except:
            pass
    bpy.ops.mesh.primitive_cone_add(
        vertices=6, radius1=random.uniform(0.05, 0.12), depth=random.uniform(0.15, 0.35),
        location=(x, y, z + 0.1)
    )
    tuft = bpy.context.active_object
    tuft.name = f"Grass_{i}"
    tuft.rotation_euler = (random.uniform(-0.1, 0.1), random.uniform(-0.1, 0.1), random.uniform(0, 6.28))
    tuft.data.materials.append(mat_grass)

# ─── FALLEN LOG ───
bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=3.0, location=(5, -3, 0.15))
log = bpy.context.active_object
log.name = "FallenLog"
log.rotation_euler = (0, math.radians(85), math.radians(35))
bpy.ops.object.shade_smooth()

mat_log = bpy.data.materials.new("LogBark")
mat_log.use_nodes = True
lnt = mat_log.node_tree
lbsdf = lnt.nodes["Principled BSDF"]
lbsdf.inputs["Base Color"].default_value = (0.22, 0.13, 0.06, 1.0)
lbsdf.inputs["Roughness"].default_value = 0.9
lnoise = lnt.nodes.new("ShaderNodeTexNoise")
lnoise.inputs["Scale"].default_value = 30.0
lnoise.inputs["Detail"].default_value = 10.0
lbump = lnt.nodes.new("ShaderNodeBump")
lbump.inputs["Strength"].default_value = 0.5
lnt.links.new(lnoise.outputs["Fac"], lbump.inputs["Height"])
lnt.links.new(lbump.outputs["Normal"], lbsdf.inputs["Normal"])
log.data.materials.append(mat_log)

# ─── SMALL BRIDGE over stream ───
bpy.ops.mesh.primitive_cube_add(size=1, location=(1, -2, 0.25))
bridge = bpy.context.active_object
bridge.name = "WoodBridge"
bridge.scale = (1.2, 0.4, 0.06)
bridge.rotation_euler = (0, 0, math.radians(-30))

mat_bridge = bpy.data.materials.new("BridgeWood")
mat_bridge.use_nodes = True
bnt = mat_bridge.node_tree
bbsdf = bnt.nodes["Principled BSDF"]
bbsdf.inputs["Base Color"].default_value = (0.35, 0.2, 0.1, 1.0)
bbsdf.inputs["Roughness"].default_value = 0.85
bridge.data.materials.append(mat_bridge)

for i in range(2):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.5, location=(1 + (i-0.5)*0.8, -2 + (i-0.5)*0.4, 0.05))
    post = bpy.context.active_object
    post.name = f"BridgePost_{i}"
    post.data.materials.append(mat_bridge)

# ─── BUTTERFLIES (tiny diamond shapes) ───
mat_butterfly = bpy.data.materials.new("Butterfly")
mat_butterfly.use_nodes = True
bfnt = mat_butterfly.node_tree
bfbsdf = bfnt.nodes["Principled BSDF"]
colors = [(0.9, 0.3, 0.1, 1), (0.2, 0.4, 0.9, 1), (0.9, 0.8, 0.1, 1), (0.8, 0.2, 0.6, 1)]
bfbsdf.inputs["Emission Color"].default_value = (0.9, 0.5, 0.2, 1.0)
bfbsdf.inputs["Emission Strength"].default_value = 2.0

for i in range(6):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.06, location=(
        random.uniform(-5, 10), random.uniform(-5, 8), random.uniform(1.5, 4)
    ))
    bf = bpy.context.active_object
    bf.name = f"Butterfly_{i}"
    bf.scale = (1.5, 0.3, 1.0)
    mat_bf_i = bpy.data.materials.new(f"Butterfly_{i}")
    mat_bf_i.use_nodes = True
    bfn = mat_bf_i.node_tree
    bfb = bfn.nodes["Principled BSDF"]
    c = colors[i % len(colors)]
    bfb.inputs["Base Color"].default_value = c
    bfb.inputs["Emission Color"].default_value = c
    bfb.inputs["Emission Strength"].default_value = 1.5
    bf.data.materials.append(mat_bf_i)

# ─── AMBIENT/RIM LIGHT for atmosphere ───
rim_data = bpy.data.lights.new("RimLight", 'AREA')
rim_data.energy = 30
rim_data.color = (0.6, 0.75, 1.0)
rim_data.size = 10
rim_obj = bpy.data.objects.new("RimLight", rim_data)
bpy.context.collection.objects.link(rim_obj)
rim_obj.location = (-15, 15, 12)
rim_obj.rotation_euler = (math.radians(45), math.radians(-30), 0)

# ─── STEPPING STONES along path ───
mat_stone = bpy.data.materials.new("SteppingStone")
mat_stone.use_nodes = True
stnt = mat_stone.node_tree
stbsdf = stnt.nodes["Principled BSDF"]
stbsdf.inputs["Base Color"].default_value = (0.45, 0.42, 0.38, 1.0)
stbsdf.inputs["Roughness"].default_value = 0.8

stone_positions = [(-10, -5, 0.08), (-6, -2, 0.08), (-2, 0, 0.08), (2, 1.5, 0.08), (5, 3.5, 0.08), (8, 6, 0.08)]
for i, sp in enumerate(stone_positions):
    bpy.ops.mesh.primitive_cylinder_add(radius=random.uniform(0.25, 0.4), depth=0.08, location=sp)
    stone = bpy.context.active_object
    stone.name = f"StepStone_{i}"
    stone.scale = (random.uniform(0.8, 1.3), random.uniform(0.6, 1.0), 1)
    stone.rotation_euler = (0, 0, random.uniform(0, 6.28))
    stone.data.materials.append(mat_stone)

# ─── RENDER SETTINGS ───
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

# ─── SAVE ───
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/enhanced_scene_v2.blend')
print("UPGRADE_COMPLETE")

# ─── RENDER ───
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/landscape_v2.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("RENDER_COMPLETE")
