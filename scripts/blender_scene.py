import os
os.makedirs("C:/Users/Aiden/Desktop/godmode-evidence", exist_ok=True)
import bpy, math, random
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

random.seed(42)

# GROUND PLANE (rolling terrain)
bpy.ops.mesh.primitive_plane_add(size=40, location=(0,0,0))
ground = bpy.context.active_object
ground.name = "Terrain"
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.subdivide(number_cuts=40)
bpy.ops.object.mode_set(mode='OBJECT')
for v in ground.data.vertices:
    dist = math.sqrt(v.co.x**2 + v.co.y**2)
    v.co.z = math.sin(v.co.x*0.3)*0.8 + math.cos(v.co.y*0.4)*0.6
    if dist > 12:
        v.co.z += (dist-12)*0.5
    v.co.z += random.uniform(-0.1, 0.1)
bpy.ops.object.shade_smooth()
mat_g = bpy.data.materials.new("Ground")
mat_g.use_nodes = True
mat_g.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.15, 0.4, 0.1, 1)
mat_g.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.85
ground.data.materials.append(mat_g)

# WATER
bpy.ops.mesh.primitive_plane_add(size=50, location=(0,0,-0.3))
water = bpy.context.active_object
water.name = "Water"
mat_w = bpy.data.materials.new("Water")
mat_w.use_nodes = True
bw = mat_w.node_tree.nodes["Principled BSDF"]
bw.inputs["Base Color"].default_value = (0.05, 0.2, 0.5, 1)
bw.inputs["Roughness"].default_value = 0.05
bw.inputs["Alpha"].default_value = 0.6
water.data.materials.append(mat_w)

# MOUNTAINS
for i in range(6):
    angle = math.radians(i * 30 + 160)
    d = 18 + random.uniform(0, 4)
    x, y = math.cos(angle)*d, math.sin(angle)*d
    h = random.uniform(5, 10)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=random.uniform(3,6), radius2=0.2, depth=h*2, location=(x, y, h-1))
    mt = bpy.context.active_object
    mt.name = f"Mountain_{i}"
    bpy.ops.object.shade_smooth()
    for v in mt.data.vertices:
        v.co.x += random.uniform(-0.3, 0.3)
        v.co.y += random.uniform(-0.3, 0.3)
    mat_m = bpy.data.materials.new(f"MtMat_{i}")
    mat_m.use_nodes = True
    grey = random.uniform(0.25, 0.45)
    mat_m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (grey, grey*0.95, grey*0.85, 1)
    mat_m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    mt.data.materials.append(mat_m)
    if h > 6:
        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=random.uniform(1,2), radius2=0.1, depth=h*0.5, location=(x, y, h*1.3))
        snow = bpy.context.active_object
        snow.name = f"Snow_{i}"
        bpy.ops.object.shade_smooth()
        ms = bpy.data.materials.new(f"SnowM_{i}")
        ms.use_nodes = True
        ms.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.95, 0.97, 1, 1)
        ms.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.3
        snow.data.materials.append(ms)

# TREES
def make_tree(tx, ty, height=3):
    tz = 0
    try:
        result, loc, normal, idx = ground.closest_point_on_mesh(Vector((tx, ty, 10)))
        if result: tz = loc.z
    except: pass
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=height*0.6, location=(tx, ty, tz+height*0.3))
    trunk = bpy.context.active_object
    trunk.name = f"Trunk_{int(tx)}_{int(ty)}"
    mb = bpy.data.materials.new(f"Bark_{int(tx)}")
    mb.use_nodes = True
    mb.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.25, 0.15, 0.08, 1)
    trunk.data.materials.append(mb)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=height*0.5, location=(tx, ty, tz+height*0.75))
    canopy = bpy.context.active_object
    canopy.name = f"Canopy_{int(tx)}_{int(ty)}"
    bpy.ops.object.shade_smooth()
    canopy.scale = (1, 1, 0.7)
    ml = bpy.data.materials.new(f"Leaf_{int(tx)}")
    ml.use_nodes = True
    ml.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.05, random.uniform(0.15, 0.35), 0.02, 1)
    canopy.data.materials.append(ml)

for tx, ty in [(-3,2),(-5,4),(-1,5),(4,3),(6,1),(-4,-3),(2,-4),(5,-2),(-6,0),(3,6),(-2,-6),(7,4)]:
    make_tree(tx, ty, random.uniform(2, 4.5))

# ROCKS
for i in range(8):
    rx = random.uniform(-8, 8)
    ry = random.uniform(-8, 8)
    rz = 0
    try:
        result, loc, normal, idx = ground.closest_point_on_mesh(Vector((rx, ry, 10)))
        if result: rz = loc.z
    except: pass
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.2, 0.6), location=(rx, ry, rz+0.1))
    rock = bpy.context.active_object
    rock.name = f"Rock_{i}"
    rock.scale = (random.uniform(0.8,1.5), random.uniform(0.8,1.5), random.uniform(0.5,1))
    rock.rotation_euler = (random.uniform(0,0.5), random.uniform(0,0.5), random.uniform(0,6.28))
    mr = bpy.data.materials.new(f"RockM_{i}")
    mr.use_nodes = True
    rg = random.uniform(0.3, 0.5)
    mr.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (rg, rg*0.9, rg*0.8, 1)
    mr.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
    rock.data.materials.append(mr)

# SUN
bpy.ops.object.light_add(type='SUN', location=(10, -5, 15))
sun = bpy.context.active_object
sun.name = "Sun"
sun.data.energy = 4
sun.data.color = (1, 0.95, 0.85)
sun.rotation_euler = (math.radians(45), math.radians(15), math.radians(30))

# WORLD SKY
world = bpy.data.worlds["World"]
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.4, 0.6, 0.9, 1)
bg.inputs["Strength"].default_value = 1.5

# CAMERA
bpy.ops.object.camera_add(location=(12, -10, 8))
cam = bpy.context.active_object
cam.name = "SceneCamera"
cam.rotation_euler = (math.radians(60), 0, math.radians(50))
cam.data.lens = 35
bpy.context.scene.camera = cam

# RENDER
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
# scene.cycles.samples = 64  # EEVEE doesn't need this
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/blender_recorded_scene.png'
scene.render.image_settings.file_format = 'PNG'

bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/recorded_scene.blend')
bpy.ops.render.render(write_still=True)
print('RENDER_COMPLETE')
