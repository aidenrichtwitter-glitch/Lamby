"""
LAMBY BRIDGE — ANIME SHRINE SCENE
Sketchfab models: Spirit Blossom Kindred (hero), Sakura Tree, Torii Gate, Stone Lanterns
Crystal skills: full-pipeline, hero-composition, pro-lighting, anime cel-shade, import:multi
Engine: EEVEE (cel-shade REQUIRES EEVEE) with Freestyle outlines
Output: C:\\Users\\Aiden\\Desktop\\anime_shrine_final.png
"""

import bpy
import math
import os
from mathutils import Vector, Matrix

# ─── PATHS ────────────────────────────────────────────────────────────────────
DL = r"C:\Users\Aiden\Downloads"
OUT_PNG  = r"C:\Users\Aiden\Desktop\anime_shrine_final.png"
BLEND_OUT = r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend"

MODELS = {
    "spirit_blossom":  os.path.join(DL, "85187f9f246f4702b7c137dcc6c0fc12.glb"),
    "sakura_tree":     os.path.join(DL, "147ae7d0d332456a99ec6195e9b0cd4f.glb"),
    "torii_gate":      os.path.join(DL, "e12d2fa1b2b94928b8b87cb7787e2462.glb"),
    "stone_lantern":   os.path.join(DL, "e0417d1e05984727a50f9ab1451d162d.glb"),
    "anime_teacher":   os.path.join(DL, "c81029363d2744aba54efaadfd3a04aa.glb"),
}

# ─── HELPER: measure native bounding box ─────────────────────────────────────
def measure_object(obj):
    """Return (x_size, y_size, z_size, z_min) in world space using raw verts."""
    all_verts = []
    for o in [obj] + [c for c in obj.children_recursive if c.type == 'MESH']:
        if o.type == 'MESH':
            mw = o.matrix_world
            for v in o.data.vertices:
                co = mw @ v.co
                all_verts.append(co)
    if not all_verts:
        return (1, 1, 1, 0)
    xs = [v.x for v in all_verts]
    ys = [v.y for v in all_verts]
    zs = [v.z for v in all_verts]
    return (max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs), min(zs))


def get_root_objects(before):
    """Return newly added root objects since snapshot."""
    after = set(o.name for o in bpy.data.objects)
    new_names = after - before
    return [bpy.data.objects[n] for n in new_names if bpy.data.objects[n].parent is None]


def remove_strays(roots, threshold_x=50):
    """Delete any objects with extreme dimensions (stray geometry trap)."""
    for obj in list(roots):
        xs, ys, zs, _ = measure_object(obj)
        if max(xs, ys, zs) > threshold_x:
            print(f"  STRAY REMOVED: {obj.name} ({xs:.1f} x {ys:.1f} x {zs:.1f})")
            bpy.data.objects.remove(obj, do_unlink=True)
            roots.remove(obj)


def scale_to_height(root, target_h):
    """Scale root object so its bounding-box height equals target_h."""
    _, _, native_h, z_min = measure_object(root)
    if native_h < 0.001:
        print(f"  WARN: {root.name} native_h too small ({native_h})")
        return 1.0
    sf = target_h / native_h
    root.scale = (sf, sf, sf)
    bpy.context.view_layer.update()
    new_z_min = z_min * sf
    root.location.z = -new_z_min
    bpy.context.view_layer.update()
    print(f"  SCALED: {root.name} native={native_h:.2f}m → target={target_h}m  sf={sf:.4f}")
    return sf


# ─── RESET SCENE ─────────────────────────────────────────────────────────────
bpy.ops.wm.read_homefile(use_empty=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=True)

scene = bpy.context.scene
scene.name = "AnimeShrine"

# ─── ENGINE: EEVEE (required for cel-shade) ───────────────────────────────────
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.eevee.use_bloom = True
scene.eevee.bloom_threshold = 0.6
scene.eevee.bloom_intensity = 0.3
scene.eevee.bloom_radius = 4.0
scene.eevee.use_gtao = True          # ambient occlusion
scene.eevee.gtao_distance = 0.3
scene.eevee.taa_render_samples = 64
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.filepath = OUT_PNG
scene.render.image_settings.file_format = 'PNG'

# ─── FREESTYLE OUTLINES ───────────────────────────────────────────────────────
scene.render.use_freestyle = True
scene.render.line_thickness_mode = 'ABSOLUTE'
fl = scene.view_layers[0].freestyle_settings
fl.crease_angle = math.radians(60)
# Line set
if fl.linesets:
    ls = fl.linesets[0]
else:
    fl.linesets.new("AnimeOutline")
    ls = fl.linesets[0]
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = True
ls.select_external_contour = True
ls.select_edge_mark = True
if ls.linestyle:
    ls.linestyle.thickness = 2.0
    ls.linestyle.color = (0.04, 0.01, 0.04)

# ─── WORLD SHADER — pink/blue anime gradient ─────────────────────────────────
world = bpy.data.worlds.new("AnimeWorld")
scene.world = world
world.use_nodes = True
nodes = world.node_tree.nodes
links = world.node_tree.links
nodes.clear()

bg_node    = nodes.new('ShaderNodeBackground')
out_node   = nodes.new('ShaderNodeOutputWorld')
coord_node = nodes.new('ShaderNodeTexCoord')
sep_node   = nodes.new('ShaderNodeSeparateXYZ')
mix_node   = nodes.new('ShaderNodeMixRGB')

mix_node.blend_type = 'MIX'
mix_node.inputs[1].default_value = (0.98, 0.78, 0.90, 1.0)   # warm pink (horizon)
mix_node.inputs[2].default_value = (0.42, 0.60, 0.95, 1.0)   # cool blue (zenith)

links.new(coord_node.outputs['Window'], sep_node.inputs[0])
links.new(sep_node.outputs[1], mix_node.inputs[0])
links.new(mix_node.outputs[0], bg_node.inputs['Color'])
bg_node.inputs['Strength'].default_value = 1.0
links.new(bg_node.outputs[0], out_node.inputs['Surface'])

coord_node.location = (-600, 0)
sep_node.location   = (-350, 0)
mix_node.location   = (-150, 0)
bg_node.location    = (100, 0)
out_node.location   = (350, 0)

# ─── IMPORT MODELS ───────────────────────────────────────────────────────────
imported = {}

for key, path in MODELS.items():
    if not os.path.exists(path):
        print(f"  SKIP (not found): {key} @ {path}")
        continue
    before = set(o.name for o in bpy.data.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=path)
        roots = get_root_objects(before)
        remove_strays(roots)
        if roots:
            imported[key] = roots[0]
            print(f"  IMPORTED: {key} → root={roots[0].name}")
        else:
            print(f"  WARN: {key} imported but no root found")
    except Exception as e:
        print(f"  ERR importing {key}: {e}")

print(f"\nIMPORTED MODELS: {list(imported.keys())}")

# ─── APPLY CEL-SHADE MATERIAL to all imported meshes ─────────────────────────
def apply_cel_shade(root):
    """Apply ShaderToRGB cel-shade keeping original material colors."""
    meshes = [o for o in [root] + list(root.children_recursive) if o.type == 'MESH']
    for obj in meshes:
        for slot in obj.material_slots:
            mat = slot.material
            if mat is None:
                continue
            mat.use_nodes = True
            tree = mat.node_tree
            nodes_ = tree.nodes
            links_ = tree.links

            out = next((n for n in nodes_ if n.type == 'OUTPUT_MATERIAL'), None)
            if out is None:
                continue
            bsdf = next((n for n in nodes_ if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf is None:
                continue

            # Add ShaderToRGB between BSDF → Output
            s2rgb = nodes_.new('ShaderNodeShaderToRGB')
            s2rgb.location = (bsdf.location.x + 200, bsdf.location.y)

            # Connect BSDF → S2RGB → Output (DIRECT — no ColorRamp, no gray tones)
            links_.new(bsdf.outputs['BSDF'], s2rgb.inputs['Shader'])
            links_.new(s2rgb.outputs['Color'], out.inputs['Surface'])

            # Toon shading: high roughness, flat look
            bsdf.inputs['Roughness'].default_value = 0.9
            bsdf.inputs['Specular IOR Level'].default_value if 'Specular IOR Level' in bsdf.inputs else None


# ─── ARRANGE SCENE ───────────────────────────────────────────────────────────
bpy.context.view_layer.update()

# --- HERO: Spirit Blossom Kindred (anime girl) at origin, 1.7m tall ----
HERO_KEY = "spirit_blossom" if "spirit_blossom" in imported else "anime_teacher"
if HERO_KEY in imported:
    hero = imported[HERO_KEY]
    scale_to_height(hero, 1.7)
    hero.location.x = 0.0
    hero.location.y = 0.0
    bpy.context.view_layer.update()
    apply_cel_shade(hero)
    print(f"  HERO set: {hero.name}")

# --- TORII GATE — behind hero, large and dramatic ---
if "torii_gate" in imported:
    torii = imported["torii_gate"]
    scale_to_height(torii, 5.0)
    torii.location.x = 0.0
    torii.location.y = 6.0
    bpy.context.view_layer.update()

# --- SAKURA TREES — flanking the torii gate ---
if "sakura_tree" in imported:
    sakura = imported["sakura_tree"]
    scale_to_height(sakura, 4.5)
    sakura.location.x = -4.5
    sakura.location.y = 4.0
    bpy.context.view_layer.update()

    # Duplicate for right side
    bpy.ops.object.select_all(action='DESELECT')
    sakura.select_set(True)
    bpy.context.view_layer.objects.active = sakura
    bpy.ops.object.duplicate(linked=False)
    sakura_r = bpy.context.selected_objects[0]
    sakura_r.location.x = 4.5
    sakura_r.location.y = 4.0
    sakura_r.location.z = sakura.location.z
    bpy.context.view_layer.update()

# --- STONE LANTERNS — flanking the path ---
if "stone_lantern" in imported:
    lantern = imported["stone_lantern"]
    scale_to_height(lantern, 1.2)
    lantern.location.x = -1.2
    lantern.location.y = 2.5
    bpy.context.view_layer.update()

    # Duplicate right lantern
    bpy.ops.object.select_all(action='DESELECT')
    lantern.select_set(True)
    bpy.context.view_layer.objects.active = lantern
    bpy.ops.object.duplicate(linked=False)
    lantern_r = bpy.context.selected_objects[0]
    lantern_r.location.x = 1.2
    lantern_r.location.y = 2.5
    lantern_r.location.z = lantern.location.z
    bpy.context.view_layer.update()

# ─── GROUND PLANE — stone path / shrine floor ────────────────────────────────
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 5, 0))
ground = bpy.context.active_object
ground.name = "ShrineGround"

# Stone path material
mat_g = bpy.data.materials.new("StoneGround")
mat_g.use_nodes = True
g_nodes = mat_g.node_tree.nodes
g_links = mat_g.node_tree.links
g_nodes.clear()

g_out   = g_nodes.new('ShaderNodeOutputMaterial')
g_bsdf  = g_nodes.new('ShaderNodeBsdfPrincipled')
g_noise = g_nodes.new('ShaderNodeTexNoise')
g_ramp  = g_nodes.new('ShaderNodeValToRGB')
g_coord = g_nodes.new('ShaderNodeTexCoord')
g_map   = g_nodes.new('ShaderNodeMapping')

g_noise.inputs['Scale'].default_value = 12.0
g_noise.inputs['Detail'].default_value = 8.0
g_noise.inputs['Roughness'].default_value = 0.7
g_ramp.color_ramp.elements[0].color = (0.45, 0.42, 0.40, 1.0)  # dark stone
g_ramp.color_ramp.elements[1].color = (0.72, 0.69, 0.65, 1.0)  # light stone
g_bsdf.inputs['Roughness'].default_value = 0.85
g_bsdf.inputs['Specular IOR Level'].default_value if 'Specular IOR Level' in g_bsdf.inputs else None

g_links.new(g_coord.outputs['Generated'], g_map.inputs[0])
g_links.new(g_map.outputs[0], g_noise.inputs['Vector'])
g_links.new(g_noise.outputs['Fac'], g_ramp.inputs[0])
g_links.new(g_ramp.outputs['Color'], g_bsdf.inputs['Base Color'])
g_links.new(g_bsdf.outputs['BSDF'], g_out.inputs['Surface'])

ground.data.materials.append(mat_g)

# Stone path strip — slightly elevated center path
bpy.ops.mesh.primitive_plane_add(size=2.5, location=(0, 2, 0.01))
path = bpy.context.active_object
path.name = "StonePath"
path.scale.y = 6.0
bpy.context.view_layer.update()

mat_path = bpy.data.materials.new("PathStone")
mat_path.use_nodes = True
p_nodes = mat_path.node_tree.nodes
p_links = mat_path.node_tree.links
p_nodes.clear()
p_out  = p_nodes.new('ShaderNodeOutputMaterial')
p_bsdf = p_nodes.new('ShaderNodeBsdfPrincipled')
p_bsdf.inputs['Base Color'].default_value = (0.55, 0.52, 0.50, 1.0)
p_bsdf.inputs['Roughness'].default_value = 0.9
p_links.new(p_bsdf.outputs['BSDF'], p_out.inputs['Surface'])
path.data.materials.append(mat_path)

# ─── SAKURA PETAL PARTICLES — floating petals via simple plane emitter ─────
bpy.ops.mesh.primitive_plane_add(size=0.1, location=(0, 3, 3.5))
petal_emitter = bpy.context.active_object
petal_emitter.name = "PetalEmitter"

# Simple petal material (pink)
mat_petal = bpy.data.materials.new("SakuraPetal")
mat_petal.use_nodes = True
pe_nodes = mat_petal.node_tree.nodes
pe_links = mat_petal.node_tree.links
pe_nodes.clear()
pe_out  = pe_nodes.new('ShaderNodeOutputMaterial')
pe_bsdf = pe_nodes.new('ShaderNodeBsdfPrincipled')
pe_bsdf.inputs['Base Color'].default_value = (1.0, 0.72, 0.80, 1.0)  # sakura pink
pe_bsdf.inputs['Roughness'].default_value = 0.7
pe_bsdf.inputs['Alpha'].default_value = 0.85
mat_petal.blend_method = 'BLEND'
pe_links.new(pe_bsdf.outputs['BSDF'], pe_out.inputs['Surface'])
petal_emitter.data.materials.append(mat_petal)

# Particle system for falling petals
bpy.ops.object.select_all(action='DESELECT')
petal_emitter.select_set(True)
bpy.context.view_layer.objects.active = petal_emitter
bpy.ops.object.particle_system_add()
psys = petal_emitter.particle_systems[0]
pset = psys.settings
pset.count = 200
pset.frame_start = 1
pset.frame_end = 1
pset.lifetime = 250
pset.emit_from = 'FACE'
pset.physics_type = 'NEWTON'
pset.use_render_emitter = False
pset.render_type = 'OBJECT'
pset.particle_size = 0.08
pset.size_random = 0.4
pset.normal_factor = 0.0
pset.factor_random = 0.3
pset.effector_weights.gravity = 0.2
pset.brownian_factor = 0.2

# ─── LIGHTING — Pro Three-Point + Rim + Warm Fill ─────────────────────────────
# Key light — warm golden sunset from upper-left
bpy.ops.object.light_add(type='SUN', location=(-5, -3, 8))
key = bpy.context.active_object
key.name = "KeyLight"
key.data.energy = 3.5
key.data.color = (1.0, 0.88, 0.72)        # warm golden
key.rotation_euler = (math.radians(55), math.radians(-20), math.radians(-45))

# Fill light — cool purple from right
bpy.ops.object.light_add(type='AREA', location=(4, -2, 3))
fill = bpy.context.active_object
fill.name = "FillLight"
fill.data.energy = 150
fill.data.color = (0.70, 0.65, 1.0)       # cool lavender
fill.data.size = 4.0
fill.rotation_euler = (math.radians(45), 0, math.radians(60))

# Rim light — bright white from behind hero
bpy.ops.object.light_add(type='AREA', location=(0, 4, 4))
rim = bpy.context.active_object
rim.name = "RimLight"
rim.data.energy = 250
rim.data.color = (1.0, 0.95, 1.0)         # near white
rim.data.size = 2.0
rim.rotation_euler = (math.radians(-60), 0, math.radians(180))

# Lantern glow — warm point lights at each lantern
for lx, ly in [(-1.2, 2.5), (1.2, 2.5)]:
    bpy.ops.object.light_add(type='POINT', location=(lx, ly, 1.0))
    glow = bpy.context.active_object
    glow.name = f"LanternGlow_{lx}"
    glow.data.energy = 50
    glow.data.color = (1.0, 0.75, 0.40)   # warm amber
    glow.data.shadow_soft_size = 0.3

# ─── CAMERA — Portrait composition, hero centered ────────────────────────────
bpy.ops.object.camera_add(location=(0.3, -5.5, 1.6))
cam = bpy.context.active_object
cam.name = "MainCamera"
scene.camera = cam

cam.data.lens = 55
cam.data.dof.use_dof = True
cam.data.dof.aperture_fstop = 5.6
cam.data.dof.focus_distance = 5.5

# Point camera at hero (0, 0, 1.0) — chest level
direction = Vector((0, 0, 1.0)) - cam.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam.rotation_euler = rot_quat.to_euler()

# ─── MOON — crescent shape for atmosphere ────────────────────────────────────
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.8, location=(3, 8, 7))
moon = bpy.context.active_object
moon.name = "Moon"

mat_moon = bpy.data.materials.new("MoonGlow")
mat_moon.use_nodes = True
mn_nodes = mat_moon.node_tree.nodes
mn_links = mat_moon.node_tree.links
mn_nodes.clear()
mn_out  = mn_nodes.new('ShaderNodeOutputMaterial')
mn_emit = mn_nodes.new('ShaderNodeEmission')
mn_emit.inputs['Color'].default_value = (1.0, 0.95, 0.85, 1.0)
mn_emit.inputs['Strength'].default_value = 8.0
mn_links.new(mn_emit.outputs['Emission'], mn_out.inputs['Surface'])
moon.data.materials.append(mat_moon)

# ─── SAVE .BLEND ──────────────────────────────────────────────────────────────
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print(f"\nBLEND SAVED: {BLEND_OUT}")

# ─── RENDER ──────────────────────────────────────────────────────────────────
print("\nRENDERING (EEVEE 64spp 1920x1080)...")
bpy.ops.render.render(write_still=True)
print(f"RENDER COMPLETE → {OUT_PNG}")
print("ANIME_SHRINE_SCENE_OK")
