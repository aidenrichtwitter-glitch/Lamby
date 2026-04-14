# AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
# Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
# Read docs/no-reply-system.md for the no-reply protocol.
"""
Skill: control:blender:scene:cyberpunk-polish
Replicates user's manual Blender session that upgraded cyberpunk_scene.blend
from v15 to polished state. Run headless:

  blender --background cyberpunk_scene.blend --python cyberpunk_polish.py

Changes applied (v15 → polished):
  1. Color management: AgX → Filmic + Medium High Contrast, exposure 0.8
  2. Lighting redesign: removed 6 overkill lights, kept 4 with narrow AREA
     strips (size_y=0.25), HeroFill dominant at 200W pure cyan, HeroKey
     demoted to SPOT 29W for subtle face fill
  3. Hero pose: left arm -79° (relaxed down), right elbow complex wave
     (74.97°, 42.59°, 70.17°), legs natural standing, hips/ankles reset
  4. Outfit: Bottoms material base swapped from texture to RGB node for
     direct dark navy blue. All hero materials get Emission Strength=1.0
  5. City depth: NeonPt point lights added in city volume
  6. Cleanup: removed all NeonSign_*/NeonSplash_* flat planes
  7. World: background strength 0.15 → 0.3
  8. Compositor enabled
"""

import bpy, math
from mathutils import Vector

print("=== CYBERPUNK POLISH SKILL ===")

scene = bpy.context.scene
cam = scene.camera
root = bpy.data.objects.get('anime_hero')

armature = None
for obj in [root] + list(root.children_recursive):
    if obj.type == 'ARMATURE':
        armature = obj
        break

ch = [root] + list(root.children_recursive)

# ================================================================
# 1. COLOR MANAGEMENT
# ================================================================
scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look = 'Medium High Contrast'
scene.view_settings.exposure = 0.8
scene.view_settings.gamma = 1.0
print("  1. Color: Filmic, MHC, exp=0.8")

# ================================================================
# 2. WORLD
# ================================================================
world = scene.world
if world and world.use_nodes:
    for node in world.node_tree.nodes:
        if node.type == 'BACKGROUND':
            node.inputs['Strength'].default_value = 0.3
        elif node.type == 'TEX_SKY':
            node.sun_elevation = math.radians(-3)
            node.sun_intensity = 1.0
print("  2. World: bg=0.3, sky elev=-3°")

# ================================================================
# 3. REMOVE OVERKILL LIGHTS + NEON SIGN PLANES
# ================================================================
remove_names = [
    'CyanWash', 'PinkWash', 'NeonRimR', 'NeonRimL',
    'HairLight', 'FrontSoft',
    'HeroKey', 'HeroFill', 'HeroRim', 'GroundGlow',
]
for obj in list(bpy.data.objects):
    if obj.name in remove_names:
        bpy.data.objects.remove(obj, do_unlink=True)
    elif obj.name.startswith('NeonSign_') or obj.name.startswith('NeonSplash_'):
        bpy.data.objects.remove(obj, do_unlink=True)
print("  3. Removed overkill lights + flat neon planes")

# ================================================================
# 4. REBUILD LIGHTING — 4 narrow strip lights
# ================================================================

def add_area(name, energy, color, loc, size, size_y=0.25):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.color = color
    data.size = size
    data.size_y = size_y
    data.use_shadow = True
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    hero_c = Vector((-19.265, -74.810, 9.88))
    d = hero_c - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return obj

add_area('HeroFill', 200, (0.033, 0.548, 1.0), (-21.76, -74.10, 11.42), 3.0)
add_area('HeroRim', 25, (0.0, 0.85, 1.0), (-17.62, -72.95, 11.25), 4.0)
add_area('GroundGlow', 29, (0.2, 0.6, 1.0), (-19.19, -74.89, 8.77), 2.0)

data = bpy.data.lights.new('HeroKey', 'SPOT')
data.energy = 29
data.color = (0.7, 0.85, 1.0)
data.spot_size = math.radians(45)
data.spot_blend = 0.3
data.use_shadow = True
obj = bpy.data.objects.new('HeroKey', data)
bpy.context.collection.objects.link(obj)
obj.location = (-18.58, -77.32, 11.94)
hero_c = Vector((-19.265, -74.810, 9.88))
d = hero_c - obj.location
obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

print("  4. Lights: HeroFill 200W cyan, HeroKey 29W spot, HeroRim 25W, GroundGlow 29W")

# ================================================================
# 5. ADD NEON POINT LIGHTS IN CITY
# ================================================================
neon_pts = [
    ('NeonPt_0', (-6.03, 271.43, 29.63)),
    ('NeonPt_0.001', (-8.31, 506.27, 10.08)),
]
for name, pos in neon_pts:
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    data = bpy.data.lights.new(name, 'POINT')
    data.energy = 60
    data.color = (0.0, 0.8, 1.0)
    data.shadow_soft_size = 0.8
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
print("  5. NeonPt city lights added")

# ================================================================
# 6. HERO POSE
# ================================================================
if armature:
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='POSE')

    def find_bone(part):
        for pb in armature.pose.bones:
            if part.lower() in pb.name.lower():
                return pb
        return None

    for pb in armature.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)

    pose_data = {
        'left arm':    (-79.02, 0, 0),
        'left elbow':  (22.85, 0.04, 0.01),
        'right arm':   (13.89, -5.6, 21.53),
        'right elbow': (74.97, 42.59, 70.17),
        'left leg':    (-0.01, 0.12, -5.55),
        'left knee':   (-1.35, 13.86, 8.33),
        'right leg':   (-0.0, -0.09, 4.44),
        'right knee':  (-1.62, -21.82, -10.92),
    }

    for part, angles in pose_data.items():
        b = find_bone(part)
        if b:
            b.rotation_euler = tuple(math.radians(a) for a in angles)

    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
print("  6. Hero posed: left arm -79°, right wave, legs natural")

# ================================================================
# 7. OUTFIT MATERIALS
# ================================================================
mat = bpy.data.materials.get('N00_001_03_Bottoms_01_CLOTH_Instance')
if mat and mat.use_nodes:
    nt = mat.node_tree
    for node in nt.nodes:
        if node.type == 'BSDF_PRINCIPLED':
            bc = node.inputs['Base Color']
            if bc.links:
                nt.links.remove(bc.links[0])
            existing_rgb = [n for n in nt.nodes if n.type == 'RGB']
            if existing_rgb:
                rgb = existing_rgb[0]
            else:
                rgb = nt.nodes.new('ShaderNodeRGB')
            rgb.outputs[0].default_value = (0.05, 0.08, 0.25, 1.0)
            nt.links.new(rgb.outputs[0], bc)
            break

for obj in ch:
    if obj.type != 'MESH':
        continue
    for mat in (obj.data.materials or []):
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                node.inputs['Emission Strength'].default_value = 1.0
print("  7. Outfit: Bottoms=dark navy RGB, all mats ES=1.0")

# ================================================================
# 8. HERO POSITION (no floating, feet on ground)
# ================================================================
root.location = Vector((-19.190, -74.841, 9.070))
bpy.context.view_layer.update()
print("  8. Hero at ground level z=9.07")

# ================================================================
# 9. COMPOSITOR ON
# ================================================================
scene.use_nodes = True
print("  9. Compositor enabled")

# ================================================================
# SAVE
# ================================================================
bpy.ops.wm.save_mainfile()
print("=== CYBERPUNK POLISH COMPLETE ===")
