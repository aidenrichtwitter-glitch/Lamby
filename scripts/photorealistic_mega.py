import bpy, math, random
from mathutils import Vector

random.seed(42)
scene = bpy.context.scene

# ═══════════════════════════════════════════════════════════════
# PHOTOREALISTIC FOREST SCENE — 16 UNIQUE SKETCHFAB MODELS
# Tutorial-based: volumetric atmosphere, PBR ground, realistic 
# lighting (3-point + bounce), Freestyle cel-shade on anime girl
# ═══════════════════════════════════════════════════════════════

print("═══ MEGA SCENE: 16 UNIQUE MODELS ═══")

# ─── CLEAN ───
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in [bpy.data.meshes, bpy.data.materials, bpy.data.textures, 
              bpy.data.images, bpy.data.node_groups]:
    for item in list(block):
        if item.users == 0:
            block.remove(item)
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)
for w in list(bpy.data.worlds):
    if w.users == 0:
        bpy.data.worlds.remove(w)

DL = 'C:/Users/Aiden/Downloads/'

# ALL 16 unique models — each with target size and placement zone
MODELS = {
    # === HERO ===
    'anime_girl': {
        'path': DL + '9d84a78f745e47b0b0d548b2e7ffa50c.glb',
        'target_height': 2.5,
        'instances': [(0, 0, 0)],
        'scale_vary': (1.0, 1.0),
        'cel_shade': True,
    },
    # === TREES (3 types) ===
    'pine_tree': {
        'path': DL + 'e1e9c07b8e2e445c943fec660beefba2.glb',
        'target_height': 8.0,
        'instances': [
            (-7, 12, 0), (-3, 15, 0), (2, 18, 0), (6, 14, 0), (10, 11, 0),
            (-9, 18, 0), (-1, 22, 0), (4, 20, 0), (8, 17, 0), (-5, 25, 0),
        ],
        'scale_vary': (0.6, 1.4),
    },
    'fir_tree': {
        'path': DL + '7daf178b3fa64e2fa7b2c2d19cf2a4bf.glb',
        'target_height': 6.0,
        'instances': [
            (-11, 14, 0), (-6, 20, 0), (3, 24, 0), (9, 20, 0),
            (-8, 28, 0), (1, 30, 0), (7, 26, 0),
        ],
        'scale_vary': (0.5, 1.3),
    },
    'fallen_spruce': {
        'path': DL + '8b1b542d948c418fa78b723040dc7b2d.glb',
        'target_height': 1.2,
        'instances': [(4, 5, 0), (-6, 7, 0)],
        'scale_vary': (0.8, 1.2),
    },
    # === ROCKS & STUMPS (3 types) ===
    'mossy_boulder': {
        'path': DL + 'b22f2cae465e4445b598353df55c805a.glb',
        'target_height': 0.8,
        'instances': [
            (2, 2, 0), (-3, 3, 0), (5, 6, 0), (-4, 8, 0),
            (1, 9, 0), (-2, 5, 0),
        ],
        'scale_vary': (0.4, 1.5),
    },
    'fungi_stump': {
        'path': DL + '46e7067350fa466cbe9110369c9e65de.glb',
        'target_height': 0.6,
        'instances': [(-1, 3, 0), (3, 7, 0), (-5, 5, 0)],
        'scale_vary': (0.5, 1.0),
    },
    'german_stump': {
        'path': DL + 'd3fdff34f8cb4152854d170532a33c64.glb',
        'target_height': 0.5,
        'instances': [(2, 4, 0), (-3, 6, 0)],
        'scale_vary': (0.6, 1.0),
    },
    # === FLORA (2 types) ===
    'mossy_trunk': {
        'path': DL + 'e7b8f74b0b604fd88d0e40403771a596.glb',
        'target_height': 1.0,
        'instances': [(-2, 6, 0), (5, 9, 0)],
        'scale_vary': (0.7, 1.2),
    },
    'grass_patch': {
        'path': DL + 'e07f59582b6342b4800ae5fe91bf6f30.glb',
        'target_height': 0.3,
        'instances': [
            (1, 1, 0), (-1, 2, 0), (3, 3, 0), (-2, 4, 0),
            (0, 5, 0), (2, 6, 0), (-3, 7, 0), (4, 2, 0),
            (-4, 1, 0), (1, 8, 0), (-1, 9, 0), (3, 10, 0),
        ],
        'scale_vary': (0.5, 1.5),
    },
    # === PROPS (3 types) ===
    'street_lamp': {
        'path': DL + '49d9266af75f422094b4a3535487dbea.glb',
        'target_height': 3.5,
        'instances': [(-3, -1, 0), (4, 0, 0)],
        'scale_vary': (0.9, 1.1),
    },
    'old_bench': {
        'path': DL + 'b29ae26fd3b746698eed1efd33dabc59.glb',
        'target_height': 0.9,
        'instances': [(3, -1, 0)],
        'scale_vary': (1.0, 1.0),
    },
    'wooden_bench': {
        'path': DL + 'f5dbd295c70e448fb6a3c71f370c81a5.glb',
        'target_height': 0.9,
        'instances': [(-4, 2, 0)],
        'scale_vary': (1.0, 1.0),
    },
    'fantasy_lantern': {
        'path': DL + 'b927f714e7494bb3ba2adb9bde67c7c6.glb',
        'target_height': 2.0,
        'instances': [(2, -2, 0), (-5, 3, 0)],
        'scale_vary': (0.8, 1.1),
    },
    'classic_lights': {
        'path': DL + '367bf01e57b2492ab29eed7a8b58ee57.glb',
        'target_height': 4.0,
        'instances': [(-7, 4, 0), (7, 5, 0)],
        'scale_vary': (0.9, 1.0),
    },
    # === CREATURES (2 types) ===
    'butterfly': {
        'path': DL + '71f86ae0a1c148a69fe3327397fff5ee.glb',
        'target_height': 0.08,
        'instances': [(0.5, -1, 2.0), (-0.8, 0.5, 2.3), (1.2, 1, 1.8)],
        'scale_vary': (0.7, 1.3),
        'flying': True,
    },
    'cute_butterfly': {
        'path': DL + '04003562a80248e2b58599389e8c04b6.glb',
        'target_height': 0.12,
        'instances': [(-1.5, -0.5, 2.5), (2.0, 2.0, 2.2)],
        'scale_vary': (0.8, 1.2),
        'flying': True,
    },
}

# ═══ IMPORT ENGINE ═══
def measure_raw(objects):
    meshes = [o for o in objects if o.type == 'MESH' and len(o.data.vertices) > 0]
    if not meshes:
        return 0, None, None
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
    infos.sort(key=lambda x: x[1])
    median = infos[len(infos)//2][1]
    stray_kw = {'Icosphere', 'Plane', 'pPlane'}
    clean = []
    for obj, dim, mn, mx in infos:
        if median > 0 and dim > median * 10 and any(s in obj.name for s in stray_kw):
            print(f"    STRAY: {obj.name}")
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
    return total_max[2] - total_min[2], total_min, total_max

girl_meshes = []
total_placed = 0

for model_name, cfg in MODELS.items():
    print(f"\n── {model_name} ──")
    
    # Import the original
    before = set(bpy.data.objects[:])
    try:
        bpy.ops.import_scene.gltf(filepath=cfg['path'])
    except Exception as e:
        print(f"  IMPORT FAILED: {e}")
        continue
    
    new_objs = list(set(bpy.data.objects[:]) - before)
    if not new_objs:
        print("  No objects imported")
        continue
    
    print(f"  Objects: {len(new_objs)}")
    
    root = None
    for o in new_objs:
        if o.parent is None:
            root = o
            break
    if not root:
        root = new_objs[0]
    
    height, mn, mx = measure_raw(new_objs)
    if height < 0.0001:
        print("  Too small, skip")
        continue
    
    print(f"  Native: {height:.3f}m")
    
    scale_f = cfg['target_height'] / height
    print(f"  Scale: {scale_f:.4f}x → {cfg['target_height']}m")
    
    # Scale and position the original
    root.scale *= scale_f
    bpy.context.view_layer.update()
    
    new_min_z = mn.z * scale_f
    new_cx = (mn.x + mx.x) / 2 * scale_f
    new_cy = (mn.y + mx.y) / 2 * scale_f
    
    first_pos = cfg['instances'][0]
    is_flying = cfg.get('flying', False)
    
    root.location.x = first_pos[0] - new_cx
    root.location.y = first_pos[1] - new_cy
    if is_flying:
        root.location.z = first_pos[2]
    else:
        root.location.z = -new_min_z
    root.rotation_euler.z = random.uniform(0, math.tau)
    bpy.context.view_layer.update()
    total_placed += 1
    
    # Track girl meshes for cel-shading
    if cfg.get('cel_shade'):
        girl_meshes = [o for o in new_objs if o.type == 'MESH']
    
    # Duplicate for additional instances
    for pos in cfg['instances'][1:]:
        bpy.ops.object.select_all(action='DESELECT')
        root.select_set(True)
        for ch in root.children_recursive:
            ch.select_set(True)
        bpy.context.view_layer.objects.active = root
        bpy.ops.object.duplicate()
        dup = bpy.context.active_object
        
        s = random.uniform(*cfg['scale_vary'])
        dup.scale = root.scale * s
        dup.rotation_euler.z = random.uniform(0, math.tau)
        
        if is_flying:
            dup.location = Vector(pos)
        else:
            dup.location.x = pos[0]
            dup.location.y = pos[1]
            dup.location.z = root.location.z  # Same ground level as original
        
        bpy.context.view_layer.update()
        total_placed += 1
    
    print(f"  Placed: {len(cfg['instances'])} instances")

print(f"\n═══ TOTAL OBJECTS PLACED: {total_placed} from 16 unique models ═══")

# ═══ CEL-SHADE THE ANIME GIRL ═══
print("\n── Cel-shade materials ──")
for obj in girl_meshes:
    if obj.name not in bpy.data.objects:
        continue
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes:
            continue
        nodes = mat.node_tree.nodes
        for n in nodes:
            if n.type == 'BSDF_PRINCIPLED':
                n.inputs['Roughness'].default_value = 1.0
                try:
                    n.inputs['Specular IOR Level'].default_value = 0.0
                except:
                    pass
                try:
                    n.inputs['Metallic'].default_value = 0.0
                except:
                    pass

# Freestyle outlines
scene.render.use_freestyle = True
vl = scene.view_layers[0]
vl.use_freestyle = True
ls0 = vl.freestyle_settings.linesets[0]
ls0.select_silhouette = True
ls0.select_border = True
ls0.select_crease = True
ls0.select_edge_mark = False
ls0.linestyle.color = (0, 0, 0)
ls0.linestyle.thickness = 1.2
ls0.linestyle.alpha = 1.0

# ═══ GROUND PLANE ═══
print("\n── PBR Ground ──")
bpy.ops.mesh.primitive_plane_add(size=100, location=(0, 12, 0))
ground = bpy.context.active_object
ground.name = "Ground"
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.subdivide(number_cuts=30)
bpy.ops.object.mode_set(mode='OBJECT')

gmat = bpy.data.materials.new("PBR_Ground")
gmat.use_nodes = True
gn = gmat.node_tree.nodes
gl = gmat.node_tree.links
gbsdf = gn["Principled BSDF"]
out_node = gn["Material Output"]

tc = gn.new('ShaderNodeTexCoord')
tc.location = (-1200, 0)
mp = gn.new('ShaderNodeMapping')
mp.location = (-1000, 0)
mp.inputs['Scale'].default_value = (4, 4, 4)
gl.new(tc.outputs['UV'], mp.inputs['Vector'])

n1 = gn.new('ShaderNodeTexNoise')
n1.location = (-800, 200)
n1.inputs['Scale'].default_value = 18.0
n1.inputs['Detail'].default_value = 14.0
gl.new(mp.outputs['Vector'], n1.inputs['Vector'])

cr = gn.new('ShaderNodeValToRGB')
cr.location = (-500, 200)
cr.color_ramp.elements[0].position = 0.3
cr.color_ramp.elements[0].color = (0.012, 0.05, 0.008, 1)
cr.color_ramp.elements[1].position = 0.55
cr.color_ramp.elements[1].color = (0.035, 0.10, 0.018, 1)
el = cr.color_ramp.elements.new(0.75)
el.color = (0.06, 0.03, 0.015, 1)
gl.new(n1.outputs['Fac'], cr.inputs['Fac'])
gl.new(cr.outputs['Color'], gbsdf.inputs['Base Color'])

n2 = gn.new('ShaderNodeTexNoise')
n2.location = (-800, -100)
n2.inputs['Scale'].default_value = 30.0
gl.new(mp.outputs['Vector'], n2.inputs['Vector'])
cr2 = gn.new('ShaderNodeValToRGB')
cr2.location = (-500, -100)
cr2.color_ramp.elements[0].color = (0.75, 0.75, 0.75, 1)
cr2.color_ramp.elements[1].color = (0.95, 0.95, 0.95, 1)
gl.new(n2.outputs['Fac'], cr2.inputs['Fac'])
gl.new(cr2.outputs['Color'], gbsdf.inputs['Roughness'])

bump = gn.new('ShaderNodeBump')
bump.location = (-200, -200)
bump.inputs['Strength'].default_value = 0.4
n3 = gn.new('ShaderNodeTexNoise')
n3.location = (-500, -300)
n3.inputs['Scale'].default_value = 60.0
gl.new(mp.outputs['Vector'], n3.inputs['Vector'])
gl.new(n3.outputs['Fac'], bump.inputs['Height'])
gl.new(bump.outputs['Normal'], gbsdf.inputs['Normal'])

disp = gn.new('ShaderNodeDisplacement')
disp.location = (-200, -400)
disp.inputs['Scale'].default_value = 0.1
n4 = gn.new('ShaderNodeTexNoise')
n4.location = (-500, -500)
n4.inputs['Scale'].default_value = 35.0
gl.new(mp.outputs['Vector'], n4.inputs['Vector'])
gl.new(n4.outputs['Fac'], disp.inputs['Height'])
gl.new(disp.outputs['Displacement'], out_node.inputs['Displacement'])

ground.data.materials.append(gmat)

# ═══ SKY + VOLUMETRICS ═══
print("── Sky + atmosphere ──")
world = bpy.data.worlds.new("PhotoWorld")
scene.world = world
world.use_nodes = True
wn = world.node_tree
for n in list(wn.nodes): wn.nodes.remove(n)

sky = wn.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'HOSEK_WILKIE'
sky.sun_elevation = math.radians(35)
sky.sun_rotation = math.radians(90)
sky.sun_intensity = 1.0
sky.location = (-400, 200)

bg = wn.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 1.5
bg.location = (-100, 200)

vol = wn.nodes.new('ShaderNodeVolumeScatter')
vol.inputs['Color'].default_value = (0.85, 0.88, 0.95, 1)
vol.inputs['Density'].default_value = 0.003
vol.location = (-100, -100)

wo = wn.nodes.new('ShaderNodeOutputWorld')
wo.location = (200, 0)
wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
wn.links.new(bg.outputs['Background'], wo.inputs['Surface'])
wn.links.new(vol.outputs['Volume'], wo.inputs['Volume'])

# ═══ LIGHTING (Tutorial: 3-point + bounce + practical) ═══
print("── Photorealistic lighting ──")

bpy.ops.object.light_add(type='SUN', location=(0, 0, 10))
sun = bpy.context.active_object
sun.name = "KeySun"
sun.data.energy = 6.0
sun.data.color = (1.0, 0.92, 0.82)
sun.data.angle = math.radians(0.8)
sun.rotation_euler = (math.radians(55), math.radians(5), math.radians(40))

bpy.ops.object.light_add(type='AREA', location=(-7, -5, 5))
fill = bpy.context.active_object
fill.name = "FillArea"
fill.data.energy = 200
fill.data.color = (0.65, 0.75, 1.0)
fill.data.size = 10
fill.rotation_euler = (math.radians(-25), math.radians(15), 0)

bpy.ops.object.light_add(type='AREA', location=(3, 8, 6))
rim = bpy.context.active_object
rim.name = "RimBack"
rim.data.energy = 350
rim.data.color = (1.0, 0.88, 0.72)
rim.data.size = 5
rim.rotation_euler = (math.radians(-50), 0, math.radians(-15))

bpy.ops.object.light_add(type='AREA', location=(0, 0, 0.2))
bounce = bpy.context.active_object
bounce.name = "Bounce"
bounce.data.energy = 40
bounce.data.color = (0.3, 0.5, 0.15)
bounce.data.size = 12
bounce.rotation_euler = (math.radians(90), 0, 0)

# ═══ CAMERA ═══
print("── Camera ──")
bpy.ops.object.camera_add(location=(0.5, -10, 1.8))
cam = bpy.context.active_object
cam.name = "PhotoCam"
cam.data.lens = 50
cam.data.sensor_width = 36
scene.camera = cam

target = Vector((0, 2, 1.2))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
cam.data.dof.use_dof = True
cam.data.dof.focus_distance = 10.5
cam.data.dof.aperture_fstop = 3.2

# ═══ RENDER SETTINGS ═══
print("── Cycles ──")
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU'
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    prefs.preferences.compute_device_type = 'CUDA'
    prefs.preferences.get_devices()
    for d in prefs.preferences.devices:
        d.use = True

scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.3

scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.frame_set(1)

# ═══ VERIFY (16 samples) ═══
print("\n═══ VERIFY RENDER (16 samples) ═══")
scene.cycles.samples = 16
verify = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_scene_VERIFY.png'
scene.render.filepath = verify
bpy.ops.render.render(write_still=True)
print(f"VERIFY: {verify}")

blend = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_scene.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend)
print(f"Blend: {blend}")
print("═══ CHECK — if composition is right, run full render ═══")
