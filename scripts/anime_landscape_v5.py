import bpy, math, random
from mathutils import Vector

random.seed(42)
scene = bpy.context.scene

# ═══════════════════════════════════════════════════════════════
# v5: SIMPLE MATH SIZING — no re-measurement, trust the math
# + Cycles 16 samples for instant verification frame
# ═══════════════════════════════════════════════════════════════

MODELS = {
    'girl': {
        'path': 'C:/Users/Aiden/Downloads/9263ca597dea49bb8bb249f21c7bdc4d.glb',
        'target_height': 3.0,
        'position': (0, 0, 0),
    },
    'tree': {
        'path': 'C:/Users/Aiden/Downloads/bc1df9f4b7de421886b84af8ee8bcea1.glb',
        'target_height': 6.0,
        'position': (-6, 8, 0),
    },
    'rocks': {
        'path': 'C:/Users/Aiden/Downloads/d30f62e2797c48d48aefb82a12a3a788.glb',
        'target_height': 0.5,
        'position': (3, 2, 0),
    },
}

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in [bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images]:
    for item in block:
        if item.users == 0:
            block.remove(item)
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

print("═══ v5: MATH-BASED SIZING ═══")

def measure_raw(objects):
    """Measure using raw mesh data + matrix_world. No depsgraph eval."""
    meshes = [o for o in objects if o.type == 'MESH' and len(o.data.vertices) > 0]
    if not meshes:
        return 0, None, None
    
    # Get sizes per mesh
    infos = []
    for obj in meshes:
        mn = Vector((float('inf'),)*3)
        mx = Vector((float('-inf'),)*3)
        for v in obj.data.vertices:
            co = obj.matrix_world @ v.co
            for i in range(3):
                mn[i] = min(mn[i], co[i])
                mx[i] = max(mx[i], co[i])
        dim = max(mx[j] - mn[j] for j in range(3))
        infos.append((obj, dim, mn, mx))
    
    # Remove strays
    infos.sort(key=lambda x: x[1])
    median = infos[len(infos)//2][1]
    stray_kw = {'Icosphere', 'Plane', 'pPlane'}
    
    clean = []
    for obj, dim, mn, mx in infos:
        is_stray = median > 0 and dim > median * 10 and any(s in obj.name for s in stray_kw)
        if is_stray:
            print(f"  STRAY: {obj.name} dim={dim:.3f}")
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            clean.append((mn, mx))
    
    if not clean:
        return 0, None, None
    
    total_min = Vector((float('inf'),)*3)
    total_max = Vector((float('-inf'),)*3)
    for mn, mx in clean:
        for i in range(3):
            total_min[i] = min(total_min[i], mn[i])
            total_max[i] = max(total_max[i], mx[i])
    
    height = total_max[2] - total_min[2]
    return height, total_min, total_max

imported = {}
for model_name, cfg in MODELS.items():
    print(f"\n── {model_name.upper()} ──")
    before = set(bpy.data.objects[:])
    bpy.ops.import_scene.gltf(filepath=cfg['path'])
    new_objs = list(set(bpy.data.objects[:]) - before)
    print(f"  Objects: {len(new_objs)}")
    
    root = None
    for o in new_objs:
        if o.parent is None:
            root = o
            break
    
    height, mn, mx = measure_raw(new_objs)
    print(f"  Native height: {height:.3f}m, Z range: [{mn.z:.3f}, {mx.z:.3f}]")
    
    if height < 0.001:
        continue
    
    scale_f = cfg['target_height'] / height
    print(f"  Scale: {scale_f:.6f}x → {cfg['target_height']}m")
    
    if root:
        root.scale *= scale_f
        bpy.context.view_layer.update()
        
        # TRUST THE MATH: new positions = old positions * scale_factor
        new_min_z = mn.z * scale_f * root.scale.z / (root.scale.z)  # root.scale already includes scale_f
        # Actually simpler: just use the fact that scale_f was applied uniformly
        # new center = old_center * scale_f (relative to root origin)
        # But root origin might not be at (0,0,0), so compute the new bounds mathematically
        new_center_x = (mn.x + mx.x) / 2 * scale_f
        new_center_y = (mn.y + mx.y) / 2 * scale_f
        new_min_z_scaled = mn.z * scale_f
        
        # Place at target position with feet on ground
        root.location.x = cfg['position'][0] - new_center_x
        root.location.y = cfg['position'][1] - new_center_y
        root.location.z = -new_min_z_scaled
        bpy.context.view_layer.update()
        
        print(f"  Placed at ({cfg['position'][0]}, {cfg['position'][1]}), feet on Z=0")
        print(f"  Expected height: {cfg['target_height']}m")
    
    imported[model_name] = root

# ─── TREES ───
print("\n── Forest ──")
tree_root = imported.get('tree')
if tree_root:
    positions = [
        (-8, 10, 0), (-4, 12, 0), (0, 14, 0), (4, 12, 0), (8, 10, 0),
        (-6, 16, 0), (-2, 18, 0), (2, 18, 0), (6, 16, 0),
        (-10, 14, 0), (10, 14, 0), (0, 20, 0),
    ]
    for pos in positions:
        bpy.ops.object.select_all(action='DESELECT')
        tree_root.select_set(True)
        for ch in tree_root.children_recursive:
            ch.select_set(True)
        bpy.context.view_layer.objects.active = tree_root
        bpy.ops.object.duplicate()
        nt = bpy.context.active_object
        nt.location = Vector(pos)
        s = random.uniform(0.6, 1.3)
        nt.scale = tree_root.scale * s
        nt.rotation_euler.z = random.uniform(0, math.tau)

# ─── ROCKS ───
rock_root = imported.get('rocks')
if rock_root:
    for pos in [(2,1,0),(-2,1,0),(4,3,0),(-4,3,0)]:
        bpy.ops.object.select_all(action='DESELECT')
        rock_root.select_set(True)
        for ch in rock_root.children_recursive:
            ch.select_set(True)
        bpy.context.view_layer.objects.active = rock_root
        bpy.ops.object.duplicate()
        nr = bpy.context.active_object
        nr.location = Vector(pos)
        s = random.uniform(0.3, 0.8)
        nr.scale = rock_root.scale * s
        nr.rotation_euler.z = random.uniform(0, math.tau)

# ─── GROUND ───
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 10, 0))
ground = bpy.context.active_object
ground.name = "Ground"
gmat = bpy.data.materials.new("GroundMat")
gmat.use_nodes = True
gn = gmat.node_tree.nodes
gl = gmat.node_tree.links
gbsdf = gn["Principled BSDF"]
noise = gn.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 12.0
noise.inputs['Detail'].default_value = 8.0
noise.location = (-500, 0)
cr = gn.new('ShaderNodeValToRGB')
cr.location = (-300, 0)
cr.color_ramp.elements[0].position = 0.35
cr.color_ramp.elements[0].color = (0.05, 0.15, 0.03, 1)
cr.color_ramp.elements[1].position = 0.65
cr.color_ramp.elements[1].color = (0.12, 0.30, 0.06, 1)
gl.new(noise.outputs['Fac'], cr.inputs['Fac'])
gl.new(cr.outputs['Color'], gbsdf.inputs['Base Color'])
gbsdf.inputs['Roughness'].default_value = 0.9
ground.data.materials.append(gmat)

# ─── SKY ───
world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
wn = world.node_tree
for n in list(wn.nodes): wn.nodes.remove(n)
sky = wn.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'HOSEK_WILKIE'
sky.sun_elevation = math.radians(30)
sky.sun_rotation = math.radians(60)
sky.sun_intensity = 1.0
sky.location = (-200, 0)
bg = wn.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 0.7
bg.location = (0, 0)
wo = wn.nodes.new('ShaderNodeOutputWorld')
wo.location = (200, 0)
wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
wn.links.new(bg.outputs['Background'], wo.inputs['Surface'])

# ─── LIGHTS ───
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10))
sun = bpy.context.active_object
sun.data.energy = 4.0
sun.data.color = (1.0, 0.95, 0.85)
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))

bpy.ops.object.light_add(type='AREA', location=(0, 5, 5))
rim = bpy.context.active_object
rim.data.energy = 200
rim.data.color = (0.9, 0.85, 1.0)
rim.data.size = 4
rim.rotation_euler = (math.radians(-45), 0, 0)

bpy.ops.object.light_add(type='AREA', location=(-3, -4, 3))
fill = bpy.context.active_object
fill.data.energy = 80
fill.data.color = (0.8, 0.9, 1.0)
fill.data.size = 3

# ─── CAMERA ───
bpy.ops.object.camera_add(location=(0, -6, 1.8))
cam = bpy.context.active_object
cam.name = "HeroCamera"
cam.data.lens = 50
scene.camera = cam
target = Vector((0, 0, 1.8))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = 6.0
cam.data.dof.aperture_fstop = 2.8

# ═══ CYCLES LOW-SAMPLE VERIFY — 1 FRAME ONLY ═══
print("\n── Cycles 16-sample verify ──")
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.cycles.device = 'GPU'
prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    prefs.preferences.compute_device_type = 'CUDA'
    prefs.preferences.get_devices()
    for d in prefs.preferences.devices:
        d.use = True

scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'

scene.frame_set(1)
verify_path = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_v5_VERIFY.png'
scene.render.filepath = verify_path
bpy.ops.render.render(write_still=True)
print(f"VERIFY saved: {verify_path}")

blend_path = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_landscape_v5.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"Blend saved: {blend_path}")
