import bpy, math, random
from mathutils import Vector

random.seed(99)

cam = bpy.data.objects.get("SceneCamera")
if cam:
    cam.location = (15, -12, 7)
    cam.rotation_euler = (math.radians(65), 0, math.radians(48))
    cam.data.lens = 28

sun = bpy.data.objects.get("Sun")
if sun:
    sun.data.energy = 5
    sun.data.color = (1.0, 0.92, 0.78)
    sun.data.angle = math.radians(2)
    sun.rotation_euler = (math.radians(35), math.radians(10), math.radians(220))

world = bpy.data.worlds["World"]
world.use_nodes = True
nt = world.node_tree
for n in nt.nodes:
    nt.nodes.remove(n)
bg = nt.nodes.new("ShaderNodeBackground")
sky = nt.nodes.new("ShaderNodeTexSky")
sky.sky_type = 'HOSEK_WILKIE'
try:
    sky.sun_elevation = math.radians(25)
except: pass
try:
    sky.sun_rotation = math.radians(220)
except: pass
# sky.altitude = 500  # not available in HOSEK_WILKIE
# sky.air_density = 1.2
# sky.dust_density = 0.8
output = nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 1.0
nt.links.new(bg.outputs["Background"], output.inputs["Surface"])

ground = bpy.data.objects.get("Terrain")
if ground and ground.data.materials:
    mat = ground.data.materials[0]
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 8.0
    noise.inputs["Detail"].default_value = 6.0
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.inputs[6].default_value = (0.12, 0.35, 0.05, 1)
    mix.inputs[7].default_value = (0.2, 0.5, 0.15, 1)
    nt.links.new(noise.outputs["Fac"], mix.inputs["Factor"])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])

water = bpy.data.objects.get("Water")
if water and water.data.materials:
    mat = water.data.materials[0]
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.02, 0.12, 0.35, 1)
    bsdf.inputs["Roughness"].default_value = 0.02
    bsdf.inputs["IOR"].default_value = 1.33
    bsdf.inputs["Alpha"].default_value = 0.75
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 3.0
    wave.inputs["Distortion"].default_value = 2.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.15
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

def add_flower(x, y, color, size=0.15):
    tz = 0
    if ground:
        try:
            result, loc, normal, idx = ground.closest_point_on_mesh(Vector((x, y, 10)))
            if result: tz = loc.z
        except: pass
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size, location=(x, y, tz + size))
    flower = bpy.context.active_object
    flower.name = f"Flower_{x:.0f}_{y:.0f}"
    mat = bpy.data.materials.new(f"FlowerM_{x:.0f}_{y:.0f}")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = color
    flower.data.materials.append(mat)

flower_colors = [
    (0.9, 0.2, 0.3, 1),
    (0.95, 0.85, 0.1, 1),
    (0.8, 0.3, 0.8, 1),
    (1.0, 0.5, 0.1, 1),
    (0.95, 0.95, 0.95, 1),
]
for i in range(25):
    fx = random.uniform(-8, 8)
    fy = random.uniform(-8, 8)
    dist = math.sqrt(fx**2 + fy**2)
    if dist < 10:
        add_flower(fx, fy, random.choice(flower_colors), random.uniform(0.08, 0.2))

bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.5, location=(8, 8, 0.5))
bird1 = bpy.context.active_object
bird1.name = "Bird_1"
bird1.scale = (1, 0.3, 0.3)
mat_bird = bpy.data.materials.new("BirdMat")
mat_bird.use_nodes = True
mat_bird.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.1, 0.1, 0.1, 1)
bird1.data.materials.append(mat_bird)

for i in range(3):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=0.35, location=(9+i*1.5, 9+i*0.5, 0.8+i*0.3))
    b = bpy.context.active_object
    b.name = f"Bird_{i+2}"
    b.scale = (1, 0.3, 0.3)
    b.rotation_euler = (0, 0, random.uniform(-0.3, 0.3))
    b.data.materials.append(mat_bird)

bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=0.15, location=(-7, 7, 0))
stump = bpy.context.active_object
stump.name = "TreeStump"
mat_stump = bpy.data.materials.new("StumpMat")
mat_stump.use_nodes = True
mat_stump.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.3, 0.18, 0.08, 1)
mat_stump.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
stump.data.materials.append(mat_stump)

bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.4, location=(-7, 7, 0.3))
mush = bpy.context.active_object
mush.name = "Mushroom"
mush.scale = (1, 1, 0.5)
mat_mush = bpy.data.materials.new("MushMat")
mat_mush.use_nodes = True
mat_mush.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.15, 0.1, 1)
mush.data.materials.append(mat_mush)

bpy.ops.object.light_add(type='AREA', location=(-8, -5, 10))
fill = bpy.context.active_object
fill.name = "FillLight"
fill.data.energy = 50
fill.data.color = (0.7, 0.85, 1.0)
fill.data.size = 10
fill.rotation_euler = (math.radians(60), 0, math.radians(-30))

bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/enhanced_scene.blend')
print('ENHANCE_COMPLETE')
