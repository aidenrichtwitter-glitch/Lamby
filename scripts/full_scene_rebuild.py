# AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
# Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
# Read docs/no-reply-system.md for the no-reply protocol.
"""
Skill: control:blender:scene:full-forest-rebuild
Full anime forest scene rebuild using crystallized pipeline.
Checks Downloads for existing GLBs first — skips re-download if present.
USES CYCLES (not EEVEE) — crystal says EEVEE crashes in --background mode.
Run: blender.exe --background --python full_scene_rebuild.py

Crystal sources used:
  - control:blender:scene:full-pipeline  (import/scale/compose/light)
  - control:blender:scene:hero-composition (camera framing, zone layout)
  - control:blender:scene:pro-lighting (Hosek-Wilkie sky, key/fill/rim)
  - control:blender:scene:landscape (trees, ground, grass)
  - control:blender:import (measure + scale after import)
"""

import bpy, math, random, os, glob
from mathutils import Vector
from collections import defaultdict

random.seed(42)

DOWNLOADS = r"C:\Users\Aiden\Downloads"
BLEND_OUT  = r"C:\Users\Aiden\Desktop\anime_forest_FULL.blend"
RENDER_OUT = r"C:\Users\Aiden\Desktop\anime_forest_FULL.png"

print("═══ FULL FOREST SCENE REBUILD (crystal pipeline) ═══")

# ═══════════════════════════════════════════════════════════
# STEP 0: Clear scene
# ═══════════════════════════════════════════════════════════
bpy.ops.wm.read_homefile(use_empty=True)
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print("  0. Scene cleared and saved")

# ═══════════════════════════════════════════════════════════
# STEP 1: Import helper — measure world-space BB
# ═══════════════════════════════════════════════════════════
def measure_root(root):
    meshes = [root] if root.type == 'MESH' else []
    meshes += [c for c in root.children_recursive if c.type == 'MESH']
    if not meshes:
        return None, None, None, None
    bb_min = Vector((float('inf'),)*3)
    bb_max = Vector((float('-inf'),)*3)
    for m in meshes:
        for corner in m.bound_box:
            wc = m.matrix_world @ Vector(corner)
            for i in range(3):
                bb_min[i] = min(bb_min[i], wc[i])
                bb_max[i] = max(bb_max[i], wc[i])
    h = bb_max[2] - bb_min[2]
    w = max(bb_max[0] - bb_min[0], bb_max[1] - bb_min[1])
    return h, w, bb_min[2], bb_max[2]

def import_glb(filepath, label, target_h):
    """Import a GLB, scale to target_h, ground it at z=0. Returns root object or None."""
    if not os.path.exists(filepath):
        print(f"  SKIP: {label} not found at {filepath}")
        return None
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=filepath)
    bpy.context.view_layer.update()
    new_objs = [o for o in bpy.data.objects if o.name not in before]
    roots = [o for o in new_objs if o.parent is None]
    if not roots:
        roots = new_objs
    root = roots[0]
    root.name = label
    bpy.context.view_layer.update()
    h, w, z_min, z_max = measure_root(root)
    if h and h > 0.001:
        sf = target_h / h
        root.scale = (root.scale.x * sf, root.scale.y * sf, root.scale.z * sf)
        bpy.context.view_layer.update()
        h2, w2, z_min2, z_max2 = measure_root(root)
        if z_min2 is not None:
            root.location.z -= z_min2
    bpy.context.view_layer.update()
    print(f"  IMPORT {label:30s} → h={target_h:.2f}m")
    return root

# ═══════════════════════════════════════════════════════════
# STEP 2: Discover GLBs in Downloads
# ═══════════════════════════════════════════════════════════
all_glbs = glob.glob(os.path.join(DOWNLOADS, "*.glb"))
glb_map = {os.path.splitext(os.path.basename(f))[0].lower(): f for f in all_glbs}
print(f"\n  GLBs found in Downloads: {len(all_glbs)}")
for name, path in glb_map.items():
    print(f"    {name}")

def find_glb(*keywords):
    """Find a GLB whose filename contains any of the keywords."""
    for kw in keywords:
        kw = kw.lower()
        for key, path in glb_map.items():
            if kw in key:
                return path
    return None

# ═══════════════════════════════════════════════════════════
# STEP 3: Import all models
# ═══════════════════════════════════════════════════════════
print("\n═══ IMPORTING MODELS ═══")

# Hero (1.60m girl)
hero_glb = find_glb("anime_girl", "anime-girl", "girl", "female", "school_girl", "schoolgirl")
hero = import_glb(hero_glb, "anime_hero", 1.60) if hero_glb else None

# Deer (0.90m)
deer_glbs = [f for k, f in glb_map.items() if "deer" in k or "fawn" in k]
deer_objs = []
for i, g in enumerate(deer_glbs[:2]):
    d = import_glb(g, f"cute_deer_{i:03d}", 0.90)
    if d: deer_objs.append(d)

# Bench (0.50m tall, 1.4m wide — old_bench)
bench_glb = find_glb("bench", "seat", "park_bench")
bench = import_glb(bench_glb, "old_bench_000", 0.50) if bench_glb else None

# Lanterns (1.0m — ornate fantasy)
lantern_glbs = [f for k, f in glb_map.items() if "lantern" in k or "lamp_post" in k or "street_lamp" in k]
lantern_objs = []
for i, g in enumerate(lantern_glbs[:4]):
    lbl = f"fantasy_lantern_{i:03d}" if "lantern" in g.lower() else f"street_lamp_{i:03d}"
    l = import_glb(g, lbl, 3.2 if "street" in g.lower() or "lamp" in g.lower() else 1.0)
    if l: lantern_objs.append(l)

# Rocks / boulders (0.8-1.2m)
rock_glbs = [f for k, f in glb_map.items() if "rock" in k or "boulder" in k or "stone" in k or "mossy" in k]
rock_objs = []
for i, g in enumerate(rock_glbs[:5]):
    r = import_glb(g, f"mossy_boulder_{i:03d}", random.uniform(0.7, 1.2))
    if r: rock_objs.append(r)

# Fallen logs / stumps
stump_glbs = [f for k, f in glb_map.items() if "stump" in k or "log" in k or "trunk" in k or "fallen" in k or "fungi" in k]
stump_objs = []
for i, g in enumerate(stump_glbs[:5]):
    s = import_glb(g, f"stump_{i:03d}", random.uniform(0.5, 1.5))
    if s: stump_objs.append(s)

# Trees
fir_glbs    = [f for k, f in glb_map.items() if "fir" in k or "pine" in k or "spruce" in k or "conifer" in k]
tree_glbs   = [f for k, f in glb_map.items() if "tree" in k and f not in fir_glbs]
fir_objs, tree_objs = [], []
for i, g in enumerate(fir_glbs[:6]):
    t = import_glb(g, f"fir_tree_{i:03d}", random.uniform(5, 9))
    if t: fir_objs.append(t)
for i, g in enumerate(tree_glbs[:12]):
    t = import_glb(g, f"tree_{i:03d}", random.uniform(4, 8))
    if t: tree_objs.append(t)

# Grass / foliage patches
grass_glbs = [f for k, f in glb_map.items() if "grass" in k or "bush" in k or "foliage" in k or "plant" in k or "flower" in k]
grass_objs = []
for i, g in enumerate(grass_glbs[:12]):
    gr = import_glb(g, f"grass_patch_{i:03d}", random.uniform(0.15, 0.35))
    if gr: grass_objs.append(gr)

# Butterflies
butterfly_glbs = [f for k, f in glb_map.items() if "butterfly" in k or "moth" in k]
butterfly_objs = []
for i, g in enumerate(butterfly_glbs[:3]):
    b = import_glb(g, f"butterfly_{i:03d}", 0.12)
    if b: butterfly_objs.append(b)

# ═══════════════════════════════════════════════════════════
# STEP 4: Ground plane + path
# ═══════════════════════════════════════════════════════════
print("\n═══ GROUND & PATH ═══")
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 10, -0.02))
ground = bpy.context.active_object
ground.name = "Ground"
gmat = bpy.data.materials.new("GroundMat")
gmat.use_nodes = True
nodes = gmat.node_tree.nodes
bsdf = nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.18, 0.28, 0.08, 1)
bsdf.inputs["Roughness"].default_value = 0.9
gmat.node_tree.nodes.new("ShaderNodeTexNoise")
ground.data.materials.append(gmat)

# Dirt path
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -5, -0.01))
path = bpy.context.active_object
path.name = "DirtPath"
path.scale = (1.2, 15, 1)
pmat = bpy.data.materials.new("PathMat")
pmat.use_nodes = True
pmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.32, 0.22, 0.12, 1)
pmat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
path.data.materials.append(pmat)
print("  Ground 120m plane + dirt path added")

# ═══════════════════════════════════════════════════════════
# STEP 5: Compose layout (hero-composition crystal)
# ═══════════════════════════════════════════════════════════
print("\n═══ COMPOSE LAYOUT ═══")

def place(obj, x, y, rot_z=0):
    if obj is None: return
    obj.location.x = x
    obj.location.y = y
    obj.rotation_euler.z = rot_z
    bpy.context.view_layer.update()
    _, _, z_min, _ = measure_root(obj)
    if z_min is not None and abs(z_min) > 0.01:
        obj.location.z -= z_min

# Hero: origin, facing camera slightly
if hero:
    place(hero, 0.0, -16.0, math.radians(-15))

# Bench: right of hero
if bench:
    place(bench, 2.5, -17.0, math.radians(10))

# Deer: left foreground, peeking
for i, d in enumerate(deer_objs):
    ox = [-3.0, -4.5][i] if i < 2 else -6.0
    oy = [-14.0, -12.0][i] if i < 2 else -10.0
    place(d, ox, oy, math.radians(random.uniform(20, 50)))

# Lanterns: flanking the path
for i, l in enumerate(lantern_objs[:4]):
    positions = [(4.0, -15.0), (-2.0, -17.5), (5.5, -13.0), (-5.5, -16.0)]
    if i < len(positions):
        place(l, positions[i][0], positions[i][1], math.radians(random.uniform(-15, 15)))

# Rocks: midground
for i, r in enumerate(rock_objs):
    positions = [(-3.0,-6.0),(4.0,-4.0),(-6.0,-2.0),(7.0,-7.0),(0.0,-3.0)]
    if i < len(positions):
        place(r, positions[i][0]+random.uniform(-0.5,0.5), positions[i][1]+random.uniform(-0.5,0.5), math.radians(random.uniform(0,90)))

# Stumps/logs: midground
for i, s in enumerate(stump_objs):
    positions = [(-1.5,-8.0),(3.0,-5.0),(-5.0,-4.5),(6.0,-1.0),(-2.0,0.0)]
    if i < len(positions):
        place(s, positions[i][0], positions[i][1], math.radians(random.uniform(0, 360)))

# Grass: scattered foreground
grass_pos = [(-1.5,-18.0),(1.0,-17.5),(3.5,-16.5),(-3.0,-16.0),(0.5,-15.0),
             (-2.0,-14.0),(4.0,-13.0),(-4.5,-15.5),(2.0,-19.0),(-0.5,-13.5),
             (1.5,-12.0),(-1.0,-12.5)]
for i, gr in enumerate(grass_objs):
    if i < len(grass_pos):
        place(gr, grass_pos[i][0]+random.uniform(-0.3,0.3), grass_pos[i][1]+random.uniform(-0.3,0.3), math.radians(random.uniform(0,360)))

# Background trees: two staggered rows
all_trees = fir_objs + tree_objs
back_row1 = [(-10,8),(-6,10),(-2,9),(2,11),(6,8),(10,10),(13,9),(-13,11)]
back_row2 = [(-12,18),(-7,20),(-2,17),(3,19),(7,18),(12,20),(-15,22),(0,22),(16,17),(-4,24),(9,24),(5,15),(-8,15),(2,14)]
all_positions = back_row1 + back_row2

for i, t in enumerate(all_trees):
    if i < len(all_positions):
        jx, jy = random.uniform(-1.5,1.5), random.uniform(-1,1)
        place(t, all_positions[i][0]+jx, all_positions[i][1]+jy, math.radians(random.uniform(0,360)))

# Butterflies above hero
for i, b in enumerate(butterfly_objs):
    if hero:
        bx = random.uniform(-2, 3)
        bby = random.uniform(-17, -14)
        bz = random.uniform(1.5, 2.5)
        b.location = (bx, bby, bz)

print("  All objects placed")

# ═══════════════════════════════════════════════════════════
# STEP 6: Pro lighting (pro-lighting crystal — Cycles safe)
# ═══════════════════════════════════════════════════════════
print("\n═══ PRO LIGHTING ═══")

# World: Hosek-Wilkie sky (pro-lighting crystal)
bpy.context.scene.world.use_nodes = True
wn = bpy.context.scene.world.node_tree.nodes
wl = bpy.context.scene.world.node_tree.links
wn.clear()
sky = wn.new("ShaderNodeTexSky")
sky.sky_type = 'HOSEK_WILKIE'
sky.sun_elevation = math.radians(25)
sky.sun_rotation = math.radians(-30)
try:
    sky.turbidity = 4
    sky.ground_albedo = 0.3
except: pass
bg = wn.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 1.0
out = wn.new("ShaderNodeOutputWorld")
wl.new(sky.outputs["Color"], bg.inputs["Color"])
wl.new(bg.outputs["Background"], out.inputs["Surface"])

# Key Sun: warm golden 50° pitch
bpy.ops.object.light_add(type="SUN", location=(5, -8, 10))
key = bpy.context.active_object
key.name = "KeySun"
key.data.energy = 3.0
key.data.color = (1.0, 0.95, 0.85)
key.data.angle = math.radians(3)
key.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))

# Fill: cool blue area opposite key
bpy.ops.object.light_add(type="AREA", location=(-8, -6, 6))
fill = bpy.context.active_object
fill.name = "FillLight"
fill.data.energy = 80
fill.data.size = 8
fill.data.color = (0.7, 0.8, 1.0)
hero_c = Vector((0, -16, 0.9))
fill.rotation_euler = (fill.location - hero_c).to_track_quat("-Z","Y").to_euler()

# Rim: warm behind hero
bpy.ops.object.light_add(type="AREA", location=(3, -8, 4))
rim = bpy.context.active_object
rim.name = "RimLight"
rim.data.energy = 120
rim.data.size = 3
rim.data.color = (1.0, 0.9, 0.7)
rim.rotation_euler = (rim.location - hero_c).to_track_quat("-Z","Y").to_euler()

# Lantern point lights (amber glow)
for l_obj in lantern_objs[:4]:
    bpy.ops.object.light_add(type="POINT", location=l_obj.location + Vector((0, 0, 0.8)))
    pt = bpy.context.active_object
    pt.name = f"LanternGlow_{l_obj.name}"
    pt.data.energy = 30
    pt.data.color = (1.0, 0.7, 0.3)
    pt.data.shadow_soft_size = 0.2

print("  Hosek-Wilkie sky + key/fill/rim + lantern glows added")

# ═══════════════════════════════════════════════════════════
# STEP 7: Camera (hero-composition crystal: close 50mm)
# ═══════════════════════════════════════════════════════════
bpy.ops.object.camera_add(location=(0, -25, 3.5))
cam = bpy.context.active_object
cam.name = "MainCam"
cam.data.lens = 50
target = Vector((0, -16, 0.9))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam
print("  Camera: (0,-25,3.5) 50mm → hero at (-16)")

# ═══════════════════════════════════════════════════════════
# STEP 8: Render settings (CYCLES — crystal: EEVEE crashes background)
# ═══════════════════════════════════════════════════════════
scene = bpy.context.scene
scene.render.engine = "CYCLES"
try:
    scene.cycles.device = "GPU"
except: pass
scene.cycles.samples = 128
scene.cycles.use_denoising = True
try:
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
except: pass
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.filepath = RENDER_OUT

scene.view_settings.view_transform = "Filmic"
scene.view_settings.look = "Medium High Contrast"
scene.view_settings.exposure = 0.3

print("  Cycles GPU 128spp, Filmic+MHC, exposure=0.3")

# ═══════════════════════════════════════════════════════════
# STEP 9: Quick preview render (32spp 960x540)
# ═══════════════════════════════════════════════════════════
print("\n═══ QUICK PREVIEW RENDER (32spp 960×540) ═══")
scene.cycles.samples = 32
scene.render.resolution_x = 960
scene.render.resolution_y = 540
preview_path = RENDER_OUT.replace(".png", "_preview.png")
scene.render.filepath = preview_path
bpy.ops.render.render(write_still=True)
print(f"  Preview saved: {preview_path}")

# ═══════════════════════════════════════════════════════════
# STEP 10: Full render
# ═══════════════════════════════════════════════════════════
print("\n═══ FULL RENDER (128spp 1920×1080) ═══")
scene.cycles.samples = 128
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.filepath = RENDER_OUT
bpy.ops.render.render(write_still=True)
print(f"  Full render saved: {RENDER_OUT}")

# ═══════════════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════════════
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print(f"\n═══ SCENE COMPLETE ═══")
print(f"  Blend: {BLEND_OUT}")
print(f"  Render: {RENDER_OUT}")
print("FOREST_SCENE_REBUILD_OK")
