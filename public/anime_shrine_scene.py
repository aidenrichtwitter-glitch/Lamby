"""
LAMBY BRIDGE — ANIME SHRINE SCENE (CYCLES — headless safe)
Crystal skills: full-pipeline, hero-composition, pro-lighting, import:multi, lamp-orientation
Engine: Cycles (EEVEE crashes headless; ShaderToRGB not needed for Cycles toon look)
Anime look: flat Principled BSDF, Freestyle outlines, vivid palette, pink-blue sky
Output: C:\\Users\\Aiden\\Desktop\\anime_shrine_final.png
"""

import bpy
import math
import os
from mathutils import Vector

print("=== ANIME SHRINE SCENE STARTING ===")

DL        = r"C:\Users\Aiden\Downloads"
OUT_PNG   = r"C:\Users\Aiden\Desktop\anime_shrine_final.png"
BLEND_OUT = r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend"

MODELS = {
    "spirit_blossom": os.path.join(DL, "85187f9f246f4702b7c137dcc6c0fc12.glb"),
    "sakura_tree":    os.path.join(DL, "147ae7d0d332456a99ec6195e9b0cd4f.glb"),
    "torii_gate":     os.path.join(DL, "e12d2fa1b2b94928b8b87cb7787e2462.glb"),
    "stone_lantern":  os.path.join(DL, "e0417d1e05984727a50f9ab1451d162d.glb"),
    "anime_teacher":  os.path.join(DL, "c81029363d2744aba54efaadfd3a04aa.glb"),
}

# ── helpers ──────────────────────────────────────────────────────────────────
def measure(obj):
    verts = []
    for o in [obj] + [c for c in obj.children_recursive if c.type == 'MESH']:
        if o.data is None: continue  # guard: linked/unresolved mesh
        mw = o.matrix_world
        for v in o.data.vertices:
            verts.append(mw @ v.co)
    if not verts:
        return 1, 1, 1, 0
    xs = [v.x for v in verts]; ys = [v.y for v in verts]; zs = [v.z for v in verts]
    return max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs), min(zs)

def new_roots(before):
    return [bpy.data.objects[n] for n in set(o.name for o in bpy.data.objects)-before
            if bpy.data.objects[n].parent is None]

def scale_to(root, h):
    _, _, nh, zmin = measure(root)
    if nh < 0.001: return
    sf = h / nh
    root.scale = (sf, sf, sf)
    bpy.context.view_layer.update()
    root.location.z = -zmin * sf
    bpy.context.view_layer.update()
    print(f"  {root.name}: {nh:.2f}m → {h}m")

def flat_mat(name, rgb, emit=0.0, ecol=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    ns = mat.node_tree.nodes; ls = mat.node_tree.links; ns.clear()
    out  = ns.new('ShaderNodeOutputMaterial')
    bsdf = ns.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.96
    for k in ('Specular IOR Level','Metallic'):
        if k in bsdf.inputs: bsdf.inputs[k].default_value = 0.0
    if emit > 0 and ecol:
        for k in ('Emission Color',):
            if k in bsdf.inputs: bsdf.inputs[k].default_value = (*ecol, 1.0)
        if 'Emission Strength' in bsdf.inputs: bsdf.inputs['Emission Strength'].default_value = emit
    ls.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

# ── reset ────────────────────────────────────────────────────────────────────
print("Clearing scene...")
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=True)
scene = bpy.context.scene
scene.name = "AnimeShrine"

# ── engine: Cycles ───────────────────────────────────────────────────────────
print("Setting Cycles engine...")
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.filepath = OUT_PNG
scene.render.image_settings.file_format = 'PNG'
# try GPU
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = 'GPU'
    print("  GPU/CUDA mode")
except:
    scene.cycles.device = 'CPU'
    print("  CPU mode")

# ── Freestyle outlines ───────────────────────────────────────────────────────
scene.render.use_freestyle = True
scene.render.line_thickness_mode = 'ABSOLUTE'
fl = scene.view_layers[0].freestyle_settings
fl.crease_angle = math.radians(60)
ls = fl.linesets[0] if fl.linesets else fl.linesets.new("AnimeOutline")
ls.select_silhouette = ls.select_border = ls.select_crease = ls.select_external_contour = True
if ls.linestyle:
    ls.linestyle.thickness = 2.5
    ls.linestyle.color = (0.04, 0.01, 0.04)

# ── World: Nishita sunset sky (always works in Cycles headless) ───────────────
world = bpy.data.worlds.new("AnimeSky")
scene.world = world
world.use_nodes = True
wn = world.node_tree.nodes; wl = world.node_tree.links; wn.clear()
sky  = wn.new('ShaderNodeTexSky')
bg   = wn.new('ShaderNodeBackground')
wout = wn.new('ShaderNodeOutputWorld')
# Nishita sky — sunset golden hour for anime warmth
sky.sky_type = 'NISHITA'
sky.sun_elevation = math.radians(8)    # low sun = golden hour
sky.sun_rotation = math.radians(200)   # southwest for rim-light warmth
sky.altitude = 100.0
sky.air_density = 1.0
sky.dust_density = 1.0
wl.new(sky.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 2.0
wl.new(bg.outputs[0], wout.inputs['Surface'])

# ── import models ────────────────────────────────────────────────────────────
print("\nImporting models...")
imported = {}
for key, path in MODELS.items():
    if not os.path.exists(path):
        print(f"  MISSING: {key}")
        continue
    before = set(o.name for o in bpy.data.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=path)
        roots = new_roots(before)
        # remove strays (>50m)
        for r in list(roots):
            _, _, z, _ = measure(r)
            if z > 50:
                print(f"  STRAY: {r.name} z={z:.0f}m — removing")
                bpy.data.objects.remove(r, do_unlink=True); roots.remove(r)
        if roots:
            imported[key] = roots[0]
            print(f"  OK: {key} → {roots[0].name}")
    except Exception as e:
        print(f"  ERR {key}: {e}")

print(f"Imported: {list(imported.keys())}")

# ── place objects ────────────────────────────────────────────────────────────
print("\nPlacing objects...")

HERO = "spirit_blossom" if "spirit_blossom" in imported else "anime_teacher"
if HERO in imported:
    scale_to(imported[HERO], 1.7)
    imported[HERO].location.xy = (0, 0)
    bpy.context.view_layer.update()

if "torii_gate" in imported:
    scale_to(imported["torii_gate"], 5.5)
    imported["torii_gate"].location.xy = (0, 7)
    bpy.context.view_layer.update()

if "sakura_tree" in imported:
    sakL = imported["sakura_tree"]
    scale_to(sakL, 5.0)
    sakL.location.x = -5.2; sakL.location.y = 5.5
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    sakL.select_set(True); bpy.context.view_layer.objects.active = sakL
    bpy.ops.object.duplicate(linked=False)
    sakR = bpy.context.selected_objects[0]
    sakR.location.x = 5.2; sakR.location.y = 5.5; sakR.location.z = sakL.location.z
    bpy.context.view_layer.update()

if "stone_lantern" in imported:
    lanL = imported["stone_lantern"]
    scale_to(lanL, 1.3)
    lanL.location.x = -1.4; lanL.location.y = 2.8
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    lanL.select_set(True); bpy.context.view_layer.objects.active = lanL
    bpy.ops.object.duplicate(linked=False)
    lanR = bpy.context.selected_objects[0]
    lanR.location.x = 1.4; lanR.location.y = 2.8; lanR.location.z = lanL.location.z
    # Face lanterns outward (crystal: z_rot pi vs 0 for opposition)
    import math as _m
    lanL.rotation_euler.z = _m.pi
    lanR.rotation_euler.z = 0.0
    bpy.context.view_layer.update()

# ── ground + path + steps ────────────────────────────────────────────────────
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 5, -0.01))
gnd = bpy.context.active_object; gnd.name = "Ground"
gnd.data.materials.append(flat_mat("StoneGround", (0.54, 0.51, 0.47)))

bpy.ops.mesh.primitive_plane_add(size=2.5, location=(0, 2.5, 0))
pth = bpy.context.active_object; pth.name = "Path"
pth.scale.y = 5.0; bpy.context.view_layer.update()
pth.data.materials.append(flat_mat("PathStone", (0.44, 0.42, 0.39)))

for i, y in enumerate([3.6, 5.1, 6.3]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y, i*0.03))
    s = bpy.context.active_object; s.name = f"Step_{i}"
    s.scale = (1.6, 0.28, 0.04); bpy.context.view_layer.update()
    s.data.materials.append(flat_mat("Step", (0.38, 0.36, 0.33)))

# ── moon ─────────────────────────────────────────────────────────────────────
bpy.ops.mesh.primitive_uv_sphere_add(radius=1.0, location=(5, 10, 9))
moon_obj = bpy.context.active_object; moon_obj.name = "Moon"
moon_obj.data.materials.append(flat_mat("MoonGlow", (1.0, 0.97, 0.88), emit=14.0, ecol=(1.0, 0.97, 0.85)))

# ── spirit orbs ──────────────────────────────────────────────────────────────
for i, (ox, oy, oz, col) in enumerate([
    (-2.3, 1.2, 1.4, (0.5, 1.0, 0.85)),
    ( 2.1, 2.0, 1.6, (1.0, 0.8, 0.45)),
    (-1.5, 3.8, 0.9, (0.8, 0.55, 1.0)),
    ( 1.9, 4.5, 2.0, (0.45, 0.85, 1.0)),
    (-2.9, 5.5, 1.4, (1.0, 0.65, 0.85)),
    ( 0.4, 1.0, 1.7, (0.7,  1.0,  0.6)),
]):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=(ox, oy, oz))
    orb = bpy.context.active_object; orb.name = f"Orb_{i}"
    orb.data.materials.append(flat_mat(f"Orb_{i}", col, emit=18.0, ecol=col))

# ── sakura petals ─────────────────────────────────────────────────────────────
import random; random.seed(7)
pm = flat_mat("Petal", (0.98, 0.70, 0.78))
for i in range(30):
    bpy.ops.mesh.primitive_plane_add(size=0.10,
        location=(random.uniform(-4,4), random.uniform(-1,9), random.uniform(0.2,3.8)))
    p = bpy.context.active_object; p.name = f"Petal_{i}"
    p.rotation_euler = (random.uniform(0,3.14), random.uniform(0,3.14), random.uniform(0,6.28))
    p.data.materials.append(pm)

# ── lighting ──────────────────────────────────────────────────────────────────
print("\nLighting setup...")

bpy.ops.object.light_add(type='SUN', location=(-7, -4, 12))
k = bpy.context.active_object; k.name = "KeySun"
k.data.energy = 4.5; k.data.color = (1.0, 0.89, 0.70)
k.rotation_euler = (math.radians(48), math.radians(-12), math.radians(-52))

bpy.ops.object.light_add(type='AREA', location=(5, -3, 4))
f = bpy.context.active_object; f.name = "Fill"
f.data.energy = 220; f.data.color = (0.62, 0.68, 1.0); f.data.size = 6.0
f.rotation_euler = (math.radians(38), 0, math.radians(68))

bpy.ops.object.light_add(type='AREA', location=(0, 6, 5.5))
r = bpy.context.active_object; r.name = "Rim"
r.data.energy = 400; r.data.color = (1.0, 0.90, 1.0); r.data.size = 2.0
r.rotation_euler = (math.radians(-52), 0, math.radians(180))

for lname, lx, ly in [("GlowL", -1.4, 2.8), ("GlowR", 1.4, 2.8)]:
    bpy.ops.object.light_add(type='POINT', location=(lx, ly, 1.1))
    g = bpy.context.active_object; g.name = lname
    g.data.energy = 90; g.data.color = (1.0, 0.70, 0.32); g.data.shadow_soft_size = 0.5

bpy.ops.object.light_add(type='AREA', location=(5, 10, 9))
ml = bpy.context.active_object; ml.name = "MoonLight"
ml.data.energy = 80; ml.data.color = (0.88, 0.90, 1.0); ml.data.size = 2.0

# ── camera ────────────────────────────────────────────────────────────────────
print("\nCamera setup...")
bpy.ops.object.camera_add(location=(0.5, -5.5, 1.8))
cam = bpy.context.active_object; cam.name = "Camera"
scene.camera = cam
cam.data.lens = 55.0
direction = Vector((0, 0, 1.0)) - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

print(f"\nScene ready: {len(list(bpy.data.objects))} objects, {len(list(bpy.data.materials))} materials")

# ── save blend ────────────────────────────────────────────────────────────────
print(f"Saving {BLEND_OUT}...")
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print("BLEND_SAVED_OK")

# ── render ────────────────────────────────────────────────────────────────────
print(f"Rendering Cycles {scene.cycles.samples}spp 1920×1080...")
bpy.ops.render.render(write_still=True)
print(f"RENDER_DONE → {OUT_PNG}")
print("ANIME_SHRINE_SCENE_OK")
