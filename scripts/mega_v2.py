import bpy, math, random
from mathutils import Vector

random.seed(42)
scene = bpy.context.scene

print("═══ MEGA SCENE v2: 16 UNIQUE LIGHTWEIGHT MODELS ═══")

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
        'target_height': 2.5, 'instances': [(0, 0, 0)],
        'scale_vary': (1.0, 1.0), 'cel_shade': True,
    },
    'stylized_tree': {
        'path': DL + '5587e85201db4d7fa6297ef7da1d8d48.glb',
        'target_height': 7.0,
        'instances': [(-7, 12, 0), (-3, 16, 0), (2, 14, 0), (6, 18, 0), (10, 12, 0)],
        'scale_vary': (0.7, 1.3),
    },
    'lowpoly_tree': {
        'path': DL + '430f1d7b0d2748888a67539c18626eb9.glb',
        'target_height': 6.0,
        'instances': [(-10, 15, 0), (-5, 20, 0), (0, 22, 0), (5, 20, 0), (9, 16, 0)],
        'scale_vary': (0.6, 1.4),
    },
    'cartoon_tree': {
        'path': DL + 'f88d9e888e7e4e9e9a3c6830d9ce0842.glb',
        'target_height': 5.5,
        'instances': [(-8, 18, 0), (-2, 24, 0), (4, 22, 0), (8, 20, 0)],
        'scale_vary': (0.5, 1.2),
    },
    'fir_tree': {
        'path': DL + '7daf178b3fa64e2fa7b2c2d19cf2a4bf.glb',
        'target_height': 6.5,
        'instances': [(-12, 14, 0), (-6, 22, 0), (3, 26, 0), (11, 18, 0)],
        'scale_vary': (0.6, 1.3),
    },
    'palm_tree': {
        'path': DL + '5099e0d22c94437c9903079ec20ed08e.glb',
        'target_height': 5.0,
        'instances': [(12, 10, 0), (-11, 10, 0)],
        'scale_vary': (0.8, 1.2),
    },
    'mossy_boulder': {
        'path': DL + 'b22f2cae465e4445b598353df55c805a.glb',
        'target_height': 0.7,
        'instances': [(2, 2, 0), (-3, 3, 0), (5, 6, 0), (-4, 8, 0), (1, 10, 0)],
        'scale_vary': (0.4, 1.6),
    },
    'fungi_stump': {
        'path': DL + '46e7067350fa466cbe9110369c9e65de.glb',
        'target_height': 0.5,
        'instances': [(-1, 3, 0), (3, 7, 0), (-5, 5, 0)],
        'scale_vary': (0.5, 1.0),
    },
    'fallen_spruce': {
        'path': DL + '8b1b542d948c418fa78b723040dc7b2d.glb',
        'target_height': 1.0,
        'instances': [(4, 5, 0), (-6, 7, 0)],
        'scale_vary': (0.8, 1.2),
    },
    'mossy_trunk': {
        'path': DL + 'e7b8f74b0b604fd88d0e40403771a596.glb',
        'target_height': 0.8,
        'instances': [(-2, 6, 0), (5, 9, 0)],
        'scale_vary': (0.7, 1.1),
    },
    'grass_patch': {
        'path': DL + 'e07f59582b6342b4800ae5fe91bf6f30.glb',
        'target_height': 0.25,
        'instances': [(1, 1, 0), (-1, 2, 0), (3, 3, 0), (-2, 4, 0), (0, 5, 0),
                       (2, 7, 0), (-3, 8, 0), (4, 2, 0), (-4, 1, 0), (1, 9, 0)],
        'scale_vary': (0.5, 1.5),
    },
    'street_lamp': {
        'path': DL + '49d9266af75f422094b4a3535487dbea.glb',
        'target_height': 3.5,
        'instances': [(-3, -1, 0), (4, 1, 0)],
        'scale_vary': (0.95, 1.05),
    },
    'fantasy_lantern': {
        'path': DL + 'b927f714e7494bb3ba2adb9bde67c7c6.glb',
        'target_height': 2.0,
        'instances': [(2, -2, 0), (-5, 4, 0)],
        'scale_vary': (0.85, 1.1),
    },
    'old_bench': {
        'path': DL + 'b29ae26fd3b746698eed1efd33dabc59.glb',
        'target_height': 0.9,
        'instances': [(3, -1, 0)],
        'scale_vary': (1.0, 1.0),
    },
    'cute_deer': {
        'path': DL + 'c48d9df217c245efb1ecda3da6893226.glb',
        'target_height': 1.0,
        'instances': [(6, 8, 0), (-7, 10, 0)],
        'scale_vary': (0.8, 1.1),
    },
    'butterfly': {
        'path': DL + '71f86ae0a1c148a69fe3327397fff5ee.glb',
        'target_height': 0.08,
        'instances': [(0.5, -1, 2.0), (-0.8, 0.5, 2.3), (1.2, 1, 1.8)],
        'scale_vary': (0.7, 1.3), 'flying': True,
    },
}

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
        if median > 0 and dim > median * 10 and any(s in obj.name for s in {'Icosphere','Plane','pPlane','Ref_plane','ref_plane'}):
            print(f"    STRAY: {obj.name}")
            bpy.data.objects.remove(obj, do_unlink=True)
        else: clean.append((mn, mx))
    if not clean: return 0, None, None
    tmin = Vector((float('inf'),)*3); tmax = Vector((float('-inf'),)*3)
    for mn, mx in clean:
        for i in range(3): tmin[i] = min(tmin[i], mn[i]); tmax[i] = max(tmax[i], mx[i])
    return tmax[2] - tmin[2], tmin, tmax

girl_meshes = []
total_placed = 0

for mname, cfg in MODELS.items():
    print(f"\n── {mname} ──")
    before = set(bpy.data.objects[:])
    try: bpy.ops.import_scene.gltf(filepath=cfg['path'])
    except Exception as e: print(f"  FAIL: {e}"); continue
    new_objs = list(set(bpy.data.objects[:]) - before)
    if not new_objs: print("  Empty"); continue
    print(f"  Objects: {len(new_objs)}")
    root = None
    for o in new_objs:
        if o.parent is None: root = o; break
    if not root: root = new_objs[0]
    height, mn, mx = measure_raw(new_objs)
    if height < 0.0001: print("  Skip (0 height)"); continue
    print(f"  Native: {height:.3f}m → target: {cfg['target_height']}m")
    scale_f = cfg['target_height'] / height
    root.scale *= scale_f
    bpy.context.view_layer.update()
    new_min_z = mn.z * scale_f
    new_cx = (mn.x + mx.x) / 2 * scale_f
    new_cy = (mn.y + mx.y) / 2 * scale_f
    pos0 = cfg['instances'][0]
    flying = cfg.get('flying', False)
    root.location.x = pos0[0] - new_cx
    root.location.y = pos0[1] - new_cy
    root.location.z = pos0[2] if flying else -new_min_z
    root.rotation_euler.z = random.uniform(0, math.tau)
    bpy.context.view_layer.update()
    total_placed += 1
    if cfg.get('cel_shade'): girl_meshes = [o for o in new_objs if o.type == 'MESH']
    for pos in cfg['instances'][1:]:
        bpy.ops.object.select_all(action='DESELECT')
        root.select_set(True)
        for ch in root.children_recursive: ch.select_set(True)
        bpy.context.view_layer.objects.active = root
        bpy.ops.object.duplicate()
        dup = bpy.context.active_object
        s = random.uniform(*cfg['scale_vary'])
        dup.scale = root.scale * s
        dup.rotation_euler.z = random.uniform(0, math.tau)
        if flying: dup.location = Vector(pos)
        else: dup.location.x = pos[0]; dup.location.y = pos[1]; dup.location.z = root.location.z
        bpy.context.view_layer.update()
        total_placed += 1
    print(f"  Placed: {len(cfg['instances'])}")

print(f"\n═══ TOTAL: {total_placed} placed from {len(MODELS)} unique models ═══")

# CEL-SHADE
print("\n── Cel-shade ──")
for obj in girl_meshes:
    if obj.name not in bpy.data.objects: continue
    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.use_nodes: continue
        for n in mat.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                n.inputs['Roughness'].default_value = 1.0
                try: n.inputs['Specular IOR Level'].default_value = 0.0
                except: pass
                try: n.inputs['Metallic'].default_value = 0.0
                except: pass

scene.render.use_freestyle = True
vl = scene.view_layers[0]
vl.use_freestyle = True
ls = vl.freestyle_settings.linesets[0]
ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
ls.linestyle.color = (0, 0, 0); ls.linestyle.thickness = 1.2

# GROUND
print("── Ground ──")
bpy.ops.mesh.primitive_plane_add(size=100, location=(0, 12, 0))
gnd = bpy.context.active_object; gnd.name = "Ground"
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.subdivide(number_cuts=20)
bpy.ops.object.mode_set(mode='OBJECT')
gm = bpy.data.materials.new("PBR_Ground"); gm.use_nodes = True
gn = gm.node_tree.nodes; gl = gm.node_tree.links; gb = gn["Principled BSDF"]
n1 = gn.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 18.0; n1.inputs['Detail'].default_value = 12.0
cr = gn.new('ShaderNodeValToRGB')
cr.color_ramp.elements[0].position = 0.3; cr.color_ramp.elements[0].color = (0.015, 0.06, 0.01, 1)
cr.color_ramp.elements[1].position = 0.6; cr.color_ramp.elements[1].color = (0.04, 0.12, 0.025, 1)
el = cr.color_ramp.elements.new(0.8); el.color = (0.06, 0.035, 0.02, 1)
gl.new(n1.outputs['Fac'], cr.inputs['Fac']); gl.new(cr.outputs['Color'], gb.inputs['Base Color'])
gb.inputs['Roughness'].default_value = 0.9
bump = gn.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.3
n2 = gn.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 50.0
gl.new(n2.outputs['Fac'], bump.inputs['Height']); gl.new(bump.outputs['Normal'], gb.inputs['Normal'])
gnd.data.materials.append(gm)

# SKY
print("── Sky ──")
world = bpy.data.worlds.new("PhotoWorld"); scene.world = world
world.use_nodes = True; wn = world.node_tree
for n in list(wn.nodes): wn.nodes.remove(n)
sky = wn.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'HOSEK_WILKIE'
sky.sun_elevation = math.radians(35); sky.sun_rotation = math.radians(90)
bg = wn.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 1.5
vol = wn.nodes.new('ShaderNodeVolumeScatter')
vol.inputs['Color'].default_value = (0.85, 0.88, 0.95, 1); vol.inputs['Density'].default_value = 0.002
wo = wn.nodes.new('ShaderNodeOutputWorld')
wn.links.new(sky.outputs['Color'], bg.inputs['Color'])
wn.links.new(bg.outputs['Background'], wo.inputs['Surface'])
wn.links.new(vol.outputs['Volume'], wo.inputs['Volume'])

# LIGHTING
print("── Lights ──")
bpy.ops.object.light_add(type='SUN', location=(0, 0, 10))
s = bpy.context.active_object; s.data.energy = 7.0; s.data.color = (1.0, 0.92, 0.82)
s.data.angle = math.radians(0.8); s.rotation_euler = (math.radians(55), math.radians(5), math.radians(40))

bpy.ops.object.light_add(type='AREA', location=(-7, -5, 5))
f = bpy.context.active_object; f.data.energy = 200; f.data.color = (0.65, 0.75, 1.0); f.data.size = 10

bpy.ops.object.light_add(type='AREA', location=(3, 8, 6))
r = bpy.context.active_object; r.data.energy = 350; r.data.color = (1.0, 0.88, 0.72); r.data.size = 5
r.rotation_euler = (math.radians(-50), 0, 0)

bpy.ops.object.light_add(type='AREA', location=(0, 0, 0.2))
b = bpy.context.active_object; b.data.energy = 40; b.data.color = (0.3, 0.5, 0.15); b.data.size = 12
b.rotation_euler = (math.radians(90), 0, 0)

# CAMERA
print("── Camera ──")
bpy.ops.object.camera_add(location=(0.5, -10, 1.8))
cam = bpy.context.active_object; cam.name = "PhotoCam"
cam.data.lens = 50; cam.data.sensor_width = 36; scene.camera = cam
t = Vector((0, 2, 1.2)); d = t - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
cam.data.dof.use_dof = True; cam.data.dof.focus_distance = 10.5; cam.data.dof.aperture_fstop = 3.2

# CYCLES
print("── Cycles ──")
scene.render.engine = 'CYCLES'; scene.cycles.device = 'GPU'
scene.cycles.use_denoising = True; scene.cycles.denoiser = 'OPENIMAGEDENOISE'
pr = bpy.context.preferences.addons.get('cycles')
if pr:
    pr.preferences.compute_device_type = 'CUDA'; pr.preferences.get_devices()
    for dv in pr.preferences.devices: dv.use = True
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0.3
scene.render.resolution_x = 1920; scene.render.resolution_y = 1080; scene.render.resolution_percentage = 100
scene.frame_set(1)

# VERIFY
print("\n═══ VERIFY (16 samples) ═══")
scene.cycles.samples = 16
vp = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v2_VERIFY.png'
scene.render.filepath = vp
bpy.ops.render.render(write_still=True)
print(f"VERIFY: {vp}")

bp = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v2.blend'
bpy.ops.wm.save_as_mainfile(filepath=bp)
print(f"Blend: {bp}")
