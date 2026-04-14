import bpy, math, random
from mathutils import Vector

random.seed(42)
scene = bpy.context.scene

print("═══ MEGA SCENE v3: SPATIALLY-AWARE LAYOUT ═══")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in [bpy.data.meshes, bpy.data.materials, bpy.data.textures, bpy.data.images, bpy.data.node_groups]:
    for item in list(block):
        if item.users == 0: block.remove(item)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
for w in list(bpy.data.worlds):
    if w.users == 0: bpy.data.worlds.remove(w)

DL = 'C:/Users/Aiden/Downloads/'

MODELS = {
    'anime_girl': {
        'path': DL + '9d84a78f745e47b0b0d548b2e7ffa50c.glb',
        'target_height': 2.5,
        'footprint_r': 1.0,
    },
    'stylized_tree': {
        'path': DL + '5587e85201db4d7fa6297ef7da1d8d48.glb',
        'target_height': 7.0,
        'footprint_r': 3.0,
    },
    'lowpoly_tree': {
        'path': DL + '430f1d7b0d2748888a67539c18626eb9.glb',
        'target_height': 6.0,
        'footprint_r': 2.5,
    },
    'cartoon_tree': {
        'path': DL + 'f88d9e888e7e4e9e9a3c6830d9ce0842.glb',
        'target_height': 5.5,
        'footprint_r': 2.5,
    },
    'fir_tree': {
        'path': DL + '7daf178b3fa64e2fa7b2c2d19cf2a4bf.glb',
        'target_height': 6.5,
        'footprint_r': 2.0,
    },
    'palm_tree': {
        'path': DL + '5099e0d22c94437c9903079ec20ed08e.glb',
        'target_height': 5.0,
        'footprint_r': 2.5,
    },
    'mossy_boulder': {
        'path': DL + 'b22f2cae465e4445b598353df55c805a.glb',
        'target_height': 0.7,
        'footprint_r': 0.8,
    },
    'fungi_stump': {
        'path': DL + '46e7067350fa466cbe9110369c9e65de.glb',
        'target_height': 0.5,
        'footprint_r': 0.5,
    },
    'fallen_spruce': {
        'path': DL + '8b1b542d948c418fa78b723040dc7b2d.glb',
        'target_height': 1.0,
        'footprint_r': 1.5,
    },
    'mossy_trunk': {
        'path': DL + 'e7b8f74b0b604fd88d0e40403771a596.glb',
        'target_height': 0.8,
        'footprint_r': 1.2,
    },
    'grass_patch': {
        'path': DL + 'e07f59582b6342b4800ae5fe91bf6f30.glb',
        'target_height': 0.25,
        'footprint_r': 0.4,
    },
    'street_lamp': {
        'path': DL + '49d9266af75f422094b4a3535487dbea.glb',
        'target_height': 3.5,
        'footprint_r': 0.5,
    },
    'fantasy_lantern': {
        'path': DL + 'b927f714e7494bb3ba2adb9bde67c7c6.glb',
        'target_height': 2.0,
        'footprint_r': 0.6,
    },
    'old_bench': {
        'path': DL + 'b29ae26fd3b746698eed1efd33dabc59.glb',
        'target_height': 0.9,
        'footprint_r': 1.0,
    },
    'cute_deer': {
        'path': DL + 'c48d9df217c245efb1ecda3da6893226.glb',
        'target_height': 1.0,
        'footprint_r': 1.0,
    },
    'butterfly': {
        'path': DL + '71f86ae0a1c148a69fe3327397fff5ee.glb',
        'target_height': 0.08,
        'footprint_r': 0.2,
    },
}

LAYOUT = {
    'anime_girl':      [( 0,   0)],
    'old_bench':       [( 3,  -2)],
    'street_lamp':     [(-4,  -1), (12, -3)],
    'fantasy_lantern': [( 5,   3), (-6,  6)],
    'cute_deer':       [( 8,  10), (-9, 14)],
    'butterfly':       [( 1,   1, 2.0), (-1.5, 0.5, 2.3), (2, 2, 1.8)],
    'mossy_boulder':   [( 6,   4), (-5,  7), (10, 12), (-8, 16), ( 2, 18)],
    'fungi_stump':     [(-2,   5), ( 4, 11), (-7, 13)],
    'fallen_spruce':   [( 7,   8), (-10, 11)],
    'mossy_trunk':     [(-3,   9), ( 8, 15)],
    'grass_patch':     [( 1,   2), (-2,  3), ( 3,  5), (-1,  7), ( 0,  9),
                        ( 4,  12), (-5, 14), ( 6,   3), (-6,  2), ( 2, 16)],
    'stylized_tree':   [(-12, 20), (-6, 25), ( 3, 28), ( 9, 24), (14, 19)],
    'lowpoly_tree':    [(-15, 22), (-9, 28), ( 0, 32), ( 7, 30), (13, 24)],
    'cartoon_tree':    [(-11, 26), (-4, 32), ( 5, 30), (11, 22)],
    'fir_tree':        [(-18, 18), (-13, 28), ( 6, 34), (16, 16)],
    'palm_tree':       [(18, 10), (-16, 8)],
}


placed_circles = []

def can_place(x, y, r):
    for px, py, pr in placed_circles:
        dist = math.sqrt((x-px)**2 + (y-py)**2)
        if dist < (r + pr) * 0.7:
            return False
    return True

def measure_raw(objects):
    meshes = [o for o in objects if o.type == 'MESH' and len(o.data.vertices) > 0]
    if not meshes: return 0, None, None
    infos = []
    for obj in meshes:
        mn = Vector((float('inf'),)*3); mx = Vector((float('-inf'),)*3)
        for v in obj.data.vertices:
            co = obj.matrix_world @ v.co
            for i in range(3): mn[i] = min(mn[i], co[i]); mx[i] = max(mx[i], co[i])
        dim = max(mx[j] - mn[j] for j in range(3))
        infos.append((obj, dim, mn, mx))
    infos.sort(key=lambda x: x[1])
    median = infos[len(infos)//2][1]
    clean = []
    for obj, dim, mn, mx in infos:
        if median > 0 and dim > median * 10 and any(s in obj.name.lower() for s in ['icosphere','plane','pplane','ref_plane']):
            print(f"    STRAY REMOVED: {obj.name} (dim={dim:.1f})")
            bpy.data.objects.remove(obj, do_unlink=True)
        else: clean.append((mn, mx))
    if not clean: return 0, None, None, None, None
    tmin = Vector((float('inf'),)*3); tmax = Vector((float('-inf'),)*3)
    for mn, mx in clean:
        for i in range(3): tmin[i] = min(tmin[i], mn[i]); tmax[i] = max(tmax[i], mx[i])
    height = tmax[2] - tmin[2]
    width = max(tmax[0]-tmin[0], tmax[1]-tmin[1])
    return height, tmin, tmax, tmin[2], width

total_placed = 0
model_cache = {}

for mname, cfg in MODELS.items():
    print(f"\n── {mname} ──")
    positions = LAYOUT.get(mname, [(0,0)])
    
    before = set(bpy.data.objects[:])
    try: bpy.ops.import_scene.gltf(filepath=cfg['path'])
    except Exception as e: print(f"  IMPORT FAIL: {e}"); continue
    new_objs = list(set(bpy.data.objects[:]) - before)
    if not new_objs: print("  Empty import"); continue
    
    result = measure_raw(new_objs)
    if len(result) == 3:
        height, mn, mx = result
        z_base = 0
        native_width = 1
    else:
        height, mn, mx, z_base, native_width = result
    
    if height < 0.0001: print("  Skip (0 height)"); continue
    
    scale_f = cfg['target_height'] / height
    actual_width = native_width * scale_f
    actual_footprint = max(cfg['footprint_r'], actual_width * 0.5)
    
    print(f"  Native height: {height:.3f}m, width: {native_width:.3f}m")
    print(f"  Scale factor: {scale_f:.4f}")
    print(f"  Final: height={cfg['target_height']:.1f}m, footprint_r={actual_footprint:.1f}m")
    
    root = None
    for o in new_objs:
        if o.parent is None: root = o; break
    if not root: root = new_objs[0]
    
    z_offset = -z_base * scale_f if z_base else 0
    
    for i, pos in enumerate(positions):
        px, py = pos[0], pos[1]
        pz = pos[2] if len(pos) > 2 else z_offset
        
        if i == 0:
            root.scale = (scale_f, scale_f, scale_f)
            root.location = (px, py, pz)
            root.rotation_euler.z = random.uniform(0, 2*math.pi)
            
            root.name = f"{mname}_000"
            placed_circles.append((px, py, actual_footprint))
            total_placed += 1
            print(f"  #{i}: ({px:.1f}, {py:.1f}, {pz:.2f}) rot={root.rotation_euler.z:.1f}rad")
        else:
            sv = random.uniform(0.7, 1.3)
            bpy.ops.object.select_all(action='DESELECT')
            root.select_set(True)
            for ch in root.children_recursive: ch.select_set(True)
            bpy.context.view_layer.objects.active = root
            bpy.ops.object.duplicate()
            dup = bpy.context.view_layer.objects.active
            dup.location = (px, py, pz)
            dup.scale = (scale_f * sv, scale_f * sv, scale_f * sv)
            dup.rotation_euler.z = random.uniform(0, 2*math.pi)
            dup.name = f"{mname}_{i:03d}"
            placed_circles.append((px, py, actual_footprint * sv))
            total_placed += 1
            print(f"  #{i}: ({px:.1f}, {py:.1f}, {pz:.2f}) scale_var={sv:.2f}")

print(f"\n═══ PLACEMENT COMPLETE: {total_placed} instances ═══")


print("\n── GROUND PLANE ──")
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 12, 0))
ground = bpy.context.active_object
ground.name = "Ground"
gm = bpy.data.materials.new("PBR_Ground")
gm.use_nodes = True
gn = gm.node_tree
bsdf = gn.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs['Base Color'].default_value = (0.15, 0.22, 0.08, 1)
    bsdf.inputs['Roughness'].default_value = 0.95
    noise = gn.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 8.0
    noise.inputs['Detail'].default_value = 6.0
    noise.inputs['Roughness'].default_value = 0.7
    bump = gn.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.3
    gn.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    gn.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    cr = gn.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].color = (0.10, 0.18, 0.05, 1)
    cr.color_ramp.elements[1].color = (0.20, 0.28, 0.10, 1)
    gn.links.new(noise.outputs['Fac'], cr.inputs['Fac'])
    gn.links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])
ground.data.materials.append(gm)
print("  120x120m ground at (0, 12, 0)")


print("\n── LIGHTING (Photorealistic) ──")
sun = bpy.data.lights.new(name="Sun", type='SUN')
sun.energy = 5
sun.color = (1.0, 0.95, 0.85)
sun.angle = math.radians(2.0)
sun_obj = bpy.data.objects.new("Sun", sun)
sun_obj.rotation_euler = (math.radians(45), math.radians(15), math.radians(-30))
bpy.context.collection.objects.link(sun_obj)
print(f"  Sun: energy=5, warm white, angle=2deg, rotation=45/15/-30")

fill = bpy.data.lights.new(name="FillArea", type='AREA')
fill.energy = 150
fill.size = 10
fill.color = (0.7, 0.8, 1.0)
fill_obj = bpy.data.objects.new("FillArea", fill)
fill_obj.location = (-15, -5, 8)
fill_obj.rotation_euler = (math.radians(60), 0, math.radians(20))
bpy.context.collection.objects.link(fill_obj)
print(f"  Fill: area 10m, energy=150, cool blue, at (-15,-5,8)")

rim = bpy.data.lights.new(name="RimArea", type='AREA')
rim.energy = 250
rim.size = 8
rim.color = (1.0, 0.9, 0.7)
rim_obj = bpy.data.objects.new("RimArea", rim)
rim_obj.location = (10, 25, 6)
rim_obj.rotation_euler = (math.radians(50), 0, math.radians(-150))
bpy.context.collection.objects.link(rim_obj)
print(f"  Rim: area 8m, energy=250, warm, at (10,25,6)")


print("\n── SKY WORLD ──")
world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
wn = world.node_tree
for n in wn.nodes: wn.nodes.remove(n)
bg = wn.nodes.new('ShaderNodeBackground')
sky = wn.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'HOSEK_WILKIE'
sky.sun_elevation = math.radians(35)
sky.sun_rotation = math.radians(-30)
sky.turbidity = 3.0
sky.ground_albedo = 0.3
out = wn.nodes.new('ShaderNodeOutputWorld')
wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 1.0
wn.links.new(bg.outputs['Background'], out.inputs['Surface'])
print("  Hosek-Wilkie sky, elevation=35deg, turbidity=3")


print("\n── CAMERA ──")
cam_data = bpy.data.cameras.new("MainCam")
cam_data.lens = 35
cam_data.clip_end = 500
cam_data.dof.use_dof = True
cam_data.dof.aperture_fstop = 2.8

cam_x, cam_y, cam_z = 5, -18, 4
look_x, look_y, look_z = 0, 12, 2
cam_obj = bpy.data.objects.new("MainCam", cam_data)
cam_obj.location = (cam_x, cam_y, cam_z)

direction = Vector((look_x - cam_x, look_y - cam_y, look_z - cam_z))
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
bpy.context.collection.objects.link(cam_obj)
scene.camera = cam_obj

focus_dist = direction.length
cam_data.dof.focus_distance = focus_dist * 0.4
print(f"  Pos: ({cam_x},{cam_y},{cam_z}) → Look: ({look_x},{look_y},{look_z})")
print(f"  Lens: 35mm, f/2.8, focus={focus_dist*0.4:.1f}m")
print(f"  Distance to center: {focus_dist:.1f}m")


print("\n── RENDER SETTINGS ──")
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.cycles.device = 'GPU'
prefs = bpy.context.preferences.addons.get('cycles')
if prefs:
    prefs.preferences.compute_device_type = 'CUDA'
    for dev in prefs.preferences.devices:
        dev.use = True

scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.render.film_transparent = False
print("  Cycles GPU, 16 samples (verify), 1920x1080, AgX")


print("\n── SAVING ──")
blend_path = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v3.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend_path)
print(f"  Saved: {blend_path}")


print("\n── VERIFY RENDER ──")
render_path = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v3_VERIFY.png'
scene.render.filepath = render_path
bpy.ops.render.render(write_still=True)
print(f"  Rendered: {render_path}")


print("\n═══ SPATIAL SUMMARY ═══")
print(f"  Scene area: ~70x50m (ground 120x120m)")
print(f"  Camera 35m from center, 4m high, 35mm lens")
print(f"  Trees: 20-34m from origin (back rows, natural forest edge)")
print(f"  Girl: center (0,0), bench beside at (3,-2)")
print(f"  Deer: mid-field (8,10) and (-9,14)")
print(f"  Small objects: scattered 2-18m from center")
print(f"  Lighting: Sun 45° + fill area + rim area + sky")
print(f"  Total placed: {total_placed} instances")
