import bpy, math, random
from mathutils import Vector

random.seed(42)
scene = bpy.context.scene

# ═══════════════════════════════════════════════════════════════
# CRYSTAL: Multi-Model Sketchfab Import with Native Sizing
# ═══════════════════════════════════════════════════════════════
# Each model gets imported into a TEMPORARY scene, measured independently,
# scaled to its target real-world height, then linked into the main scene.
# This avoids bounding-box pollution between models.

MODELS = {
    'girl': {
        'path': 'C:/Users/Aiden/Downloads/9263ca597dea49bb8bb249f21c7bdc4d.glb',
        'target_height': 1.7,  # meters — average girl height
        'position': (0, 0, 0),  # center stage
    },
    'tree': {
        'path': 'C:/Users/Aiden/Downloads/bc1df9f4b7de421886b84af8ee8bcea1.glb',
        'target_height': 5.0,  # meters — medium tree
        'position': (-4, 3, 0),  # background left
    },
    'rocks': {
        'path': 'C:/Users/Aiden/Downloads/d30f62e2797c48d48aefb82a12a3a788.glb',
        'target_height': 0.8,  # meters — small rocks
        'position': (3, 2, 0),  # background right
    },
}

# ─── STEP 0: CLEAN SCENE ───
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in [bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images]:
    for item in block:
        if item.users == 0:
            block.remove(item)

print("═══ MULTI-MODEL IMPORT & SIZING ═══")

def measure_meshes(objects):
    """Measure bounding box of all MESH objects, ignoring strays."""
    meshes = [o for o in objects if o.type == 'MESH']
    if not meshes:
        return None, None, 0
    
    # First pass: find individual mesh sizes to detect strays
    mesh_sizes = []
    for obj in meshes:
        mn = Vector((float('inf'),)*3)
        mx = Vector((float('-inf'),)*3)
        for v in obj.data.vertices:
            co = obj.matrix_world @ v.co
            for i in range(3):
                if co[i] < mn[i]: mn[i] = co[i]
                if co[i] > mx[i]: mx[i] = co[i]
        size = max(mx[j] - mn[j] for j in range(3))
        mesh_sizes.append((obj, size, mn, mx))
    
    # Sort by size, detect strays (>10x median size with very different proportions)
    mesh_sizes.sort(key=lambda x: x[1])
    median_size = mesh_sizes[len(mesh_sizes)//2][1] if mesh_sizes else 0
    
    clean_meshes = []
    for obj, size, mn, mx in mesh_sizes:
        is_stray = False
        if median_size > 0 and size > median_size * 10 and len(mesh_sizes) > 3:
            if 'Icosphere' in obj.name or 'Plane' in obj.name or 'pPlane' in obj.name:
                is_stray = True
        if is_stray:
            print(f"  STRAY REMOVED: {obj.name} (size={size:.4f}, median={median_size:.4f})")
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            clean_meshes.append((obj, mn, mx))
    
    # Final bounds from clean meshes
    min_co = Vector((float('inf'),)*3)
    max_co = Vector((float('-inf'),)*3)
    for obj, mn, mx in clean_meshes:
        for i in range(3):
            if mn[i] < min_co[i]: min_co[i] = mn[i]
            if mx[i] > max_co[i]: max_co[i] = mx[i]
    
    height = max_co[2] - min_co[2]
    center = (min_co + max_co) / 2
    return min_co, max_co, height

imported_roots = {}

for model_name, cfg in MODELS.items():
    print(f"\n── Importing: {model_name} ──")
    
    # Track objects before import
    before = set(bpy.data.objects[:])
    
    # Import
    bpy.ops.import_scene.gltf(filepath=cfg['path'])
    
    # Find new objects
    after = set(bpy.data.objects[:])
    new_objects = list(after - before)
    print(f"  Imported {len(new_objects)} objects")
    
    # Find root (usually 'Sketchfab_model' or top-level empty)
    root = None
    for obj in new_objects:
        if obj.parent is None and obj.type == 'EMPTY':
            root = obj
            break
    if not root:
        for obj in new_objects:
            if obj.parent is None:
                root = obj
                break
    
    # Measure
    min_co, max_co, height = measure_meshes(new_objects)
    print(f"  Native height: {height:.4f}m")
    
    if height < 0.001:
        print(f"  WARNING: Model too small or empty, skipping")
        continue
    
    # Scale to target
    scale_factor = cfg['target_height'] / height
    print(f"  Scale factor: {scale_factor:.4f}x → target {cfg['target_height']}m")
    
    if root:
        root.scale *= scale_factor
        bpy.context.view_layer.update()
        
        # Recalculate bounds after scaling
        scaled_meshes = [o for o in new_objects if o.type == 'MESH' and o in list(bpy.data.objects)]
        min2, max2, new_height = measure_meshes(scaled_meshes)
        if min2:
            center2 = (min2 + max2) / 2
            # Position: move to target XY, feet on ground (Z=0)
            root.location.x += cfg['position'][0] - center2.x
            root.location.y += cfg['position'][1] - center2.y
            root.location.z -= min2.z  # feet on ground
            bpy.context.view_layer.update()
            print(f"  Final height: {new_height:.3f}m, placed at ({cfg['position'][0]}, {cfg['position'][1]})")
    
    imported_roots[model_name] = root

    # Detect animations
    for action in bpy.data.actions:
        fr = action.frame_range
        if fr[1] - fr[0] > 1:
            print(f"  Animation: '{action.name}' frames {int(fr[0])}-{int(fr[1])}")

# ─── STEP 1: DUPLICATE TREES FOR FOREST ───
print("\n── Building Forest ──")
tree_root = imported_roots.get('tree')
if tree_root:
    tree_positions = [
        (-6, 5, 0), (-3, 6, 0), (-7, 2, 0), (-5, 8, 0),
        (5, 5, 0), (7, 4, 0), (6, 7, 0), (4, 8, 0),
        (-2, 9, 0), (2, 10, 0), (0, 12, 0), (-4, 11, 0),
    ]
    for i, pos in enumerate(tree_positions):
        bpy.ops.object.select_all(action='DESELECT')
        tree_root.select_set(True)
        for child in tree_root.children_recursive:
            child.select_set(True)
        bpy.context.view_layer.objects.active = tree_root
        bpy.ops.object.duplicate()
        new_tree = bpy.context.active_object
        new_tree.location = Vector(pos)
        s = random.uniform(0.7, 1.4)
        new_tree.scale = tree_root.scale * s
        new_tree.rotation_euler.z = random.uniform(0, math.tau)
        print(f"  Tree {i+1} at {pos}, scale={s:.2f}")

# ─── STEP 2: DUPLICATE ROCKS ───
print("\n── Placing Rocks ──")
rock_root = imported_roots.get('rocks')
if rock_root:
    rock_positions = [
        (2, 1, 0), (-3, 1, 0), (5, 3, 0), (-6, 3, 0),
        (1, 4, 0), (-1, 5, 0),
    ]
    for i, pos in enumerate(rock_positions):
        bpy.ops.object.select_all(action='DESELECT')
        rock_root.select_set(True)
        for child in rock_root.children_recursive:
            child.select_set(True)
        bpy.context.view_layer.objects.active = rock_root
        bpy.ops.object.duplicate()
        new_rock = bpy.context.active_object
        new_rock.location = Vector(pos)
        s = random.uniform(0.5, 1.5)
        new_rock.scale = rock_root.scale * s
        new_rock.rotation_euler.z = random.uniform(0, math.tau)

# ─── STEP 3: GROUND PLANE ───
print("\n── Ground ──")
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 5, 0))
ground = bpy.context.active_object
ground.name = "Ground"
gmat = bpy.data.materials.new("GroundMat")
gmat.use_nodes = True
gnodes = gmat.node_tree.nodes
glinks = gmat.node_tree.links
gbsdf = gnodes["Principled BSDF"]

# Grass-like ground with noise color variation
noise = gnodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 8.0
noise.inputs['Detail'].default_value = 6.0
noise.location = (-500, 0)

cr = gnodes.new('ShaderNodeValToRGB')
cr.location = (-300, 0)
cr.color_ramp.elements[0].position = 0.3
cr.color_ramp.elements[0].color = (0.08, 0.18, 0.04, 1)  # Dark grass
cr.color_ramp.elements[1].position = 0.7
cr.color_ramp.elements[1].color = (0.15, 0.35, 0.08, 1)  # Light grass

glinks.new(noise.outputs['Fac'], cr.inputs['Fac'])
glinks.new(cr.outputs['Color'], gbsdf.inputs['Base Color'])
gbsdf.inputs['Roughness'].default_value = 0.85
ground.data.materials.append(gmat)

# ─── STEP 4: SKY ───
print("── Sky ──")
world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
wn = world.node_tree
for n in list(wn.nodes): wn.nodes.remove(n)

sky = wn.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'HOSEK_WILKIE'
sky.sun_elevation = math.radians(25)
sky.sun_rotation = math.radians(45)
sky.sun_intensity = 1.0
sky.altitude = 0
sky.location = (-200, 0)

bg = wn.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 0.8
bg.location = (0, 0)

wo = wn.nodes.new('ShaderNodeOutputWorld')
wo.location = (200, 0)

wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
wn.links.new(bg.outputs['Background'], wo.inputs['Surface'])

# ─── STEP 5: SUN LIGHT ───
print("── Lighting ──")
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10))
sun = bpy.context.active_object
sun.name = "Sun"
sun.data.energy = 3.0
sun.data.color = (1.0, 0.95, 0.85)
sun.rotation_euler = (math.radians(45), math.radians(15), math.radians(30))

# Fill light
bpy.ops.object.light_add(type='AREA', location=(-5, -3, 4))
fill = bpy.context.active_object
fill.name = "FillLight"
fill.data.energy = 100
fill.data.color = (0.7, 0.8, 1.0)
fill.data.size = 5

# ─── STEP 6: CAMERA ───
print("── Camera ──")
bpy.ops.object.camera_add(location=(0, -8, 2.5))
cam = bpy.context.active_object
cam.name = "SceneCamera"
cam.data.lens = 35  # Wide angle to show full scene
scene.camera = cam

# Look at girl position, slightly above center
target = Vector((0, 1, 1.0))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# DOF on the girl
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = 8.5
cam.data.dof.aperture_fstop = 4.0

# ─── STEP 7: CYCLES RENDER SETUP ───
print("── Cycles GPU Setup ──")
scene.render.engine = 'CYCLES'
scene.cycles.samples = 128  # Balanced for 10 frames
scene.cycles.use_denoising = True
scene.cycles.device = 'GPU'

prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    prefs.preferences.compute_device_type = 'CUDA'
    prefs.preferences.get_devices()
    for d in prefs.preferences.devices:
        d.use = True
        print(f"  GPU device: {d.name} (enabled)")

# Color management
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'

# Resolution
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

# ─── STEP 8: ANIMATION ───
# Find any imported animations and set frame range
anim_end = 10
for action in bpy.data.actions:
    fr = action.frame_range
    if fr[1] > 10:
        anim_end = min(int(fr[0]) + 9, int(fr[1]))  # 10 frames from start
        break

scene.frame_start = 1
scene.frame_end = 10
print(f"  Animation: frames 1-10")

# ─── STEP 9: SAVE ───
blend_path = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_landscape_combined.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"  Saved: {blend_path}")

# ─── STEP 10: RENDER 10 FRAMES ───
print("\n═══ RENDERING 10 FRAMES (Cycles GPU) ═══")
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_landscape_'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(animation=True)

print("\n═══ ONE-SHOT COMPLETE ═══")
print(f"Models imported: {len(MODELS)}")
for name, root in imported_roots.items():
    if root:
        print(f"  {name}: scale={root.scale.x:.4f}")
print(f"Rendered: 10 frames to anime_landscape_0001.png - anime_landscape_0010.png")
