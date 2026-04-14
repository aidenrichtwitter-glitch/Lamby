# AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
# Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
# Read docs/no-reply-system.md for the no-reply protocol.
import bpy, math, random
from mathutils import Vector
from collections import defaultdict

random.seed(42)
scene = bpy.context.scene
print("═══ SCENE BUILD: Hero-First with Corrected Scales ═══")

# ── Clean stray geometry ──
stray_names = [o.name for o in bpy.data.objects if o.name.startswith('Icosphere') or o.name.startswith('pPlane')]
for sn in stray_names:
    o = bpy.data.objects.get(sn)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)

# ── Collect objects ──
SKIP = {'Ground', 'MainCam', 'Sun', 'FillLight', 'RimLight'}
roots = []
for o in bpy.data.objects:
    if o.parent is not None: continue
    if o.name in SKIP: continue
    if o.type not in ('MESH', 'EMPTY'): continue
    meshes = [o] if o.type == 'MESH' else []
    meshes += [c for c in o.children_recursive if c.type == 'MESH']
    if not meshes: continue
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
    if h < 0.01 and w < 0.01: continue
    base = o.name.rsplit('_', 1)[0] if o.name[-1].isdigit() and '_' in o.name else o.name
    roots.append({
        'obj': o, 'name': o.name, 'base': base,
        'height': h, 'width': w, 'z_base': bb_min[2],
        'cur_scale': o.scale.x
    })

by_name = {r['name']: r for r in roots}
groups = defaultdict(list)
for r in roots:
    groups[r['base']].append(r)

print(f"  {len(roots)} objects loaded")

# ═══ STEP 1: SCALE CORRECTIONS ═══
# Target real-world heights
SCALE_TARGETS = {
    'anime_girl':      1.60,
    'fungi_stump':     2.00,
    'mossy_boulder':   1.20,
    'mossy_trunk':     0.80,
    'street_lamp':     3.20,
    'fantasy_lantern': 1.80,
}

print(f"\n═══ SCALE CORRECTIONS ═══")
for base, target_h in SCALE_TARGETS.items():
    if base not in groups: continue
    for item in groups[base]:
        old_h = item['height']
        ratio = target_h / old_h
        new_scale = item['cur_scale'] * ratio
        obj = item['obj']
        obj.scale = (new_scale, new_scale, new_scale)
        # Recalc z_base after scale
        item['z_base'] *= ratio
        item['height'] = target_h
        item['width'] *= ratio
        item['cur_scale'] = new_scale
        print(f"  {item['name']:30s} {old_h:.2f}m → {target_h:.2f}m (scale {new_scale:.4f})")

# ═══ STEP 2: SET CAMERA - horizontal cinematic ═══
cam = scene.camera
cam.location = (0, -25, 3.5)
cam.rotation_euler = (math.radians(88), 0, 0)  # near horizontal, slight tilt up
cam.data.lens = 35
cam.data.type = 'PERSP'
print(f"\n═══ CAMERA SET ═══")
print(f"  Position: (0, -25, 3.5)")
print(f"  Rotation: 88° (near horizontal)")
print(f"  Lens: 35mm")

# At 35mm, half_fov ~ 27 degrees
# visible width at distance D = 2 * D * tan(27°) = D * 1.02
# At 8m:  ~8m wide
# At 20m: ~20m wide
# At 40m: ~41m wide

# ═══ STEP 3: PLACE HERO MODELS (foreground) ═══
print(f"\n═══ HERO PLACEMENT (foreground, 5-10m from camera) ═══")

def place(name, x, y, z_auto=True, rot_z=0):
    item = by_name.get(name)
    if not item:
        print(f"  WARNING: {name} not found")
        return
    obj = item['obj']
    z = -item['z_base'] if z_auto else 0
    obj.location = (x, y, z)
    obj.rotation_euler = (0, 0, rot_z)
    print(f"  {name:30s} → ({x:6.1f}, {y:6.1f}, {z:5.2f})")

# Hero zone: Y = -17 to -14 (5-10m from camera at Y=-25)
place('anime_girl_000',      0.0, -16.0, rot_z=math.radians(-15))
place('old_bench_000',       2.5, -17.0, rot_z=math.radians(10))

# ═══ STEP 4: FOREGROUND PROPS (8-15m from camera) ═══
print(f"\n═══ FOREGROUND PROPS (Y = -14 to -10) ═══")
place('cute_deer_000',      -3.0, -14.0)
place('cute_deer_001',      -4.5, -12.0, rot_z=math.radians(30))
place('fantasy_lantern_000', 4.0, -15.0)
place('fantasy_lantern_001',-2.0, -17.5)
place('street_lamp_000',    -5.5, -16.0)
place('street_lamp_001',     5.5, -13.0)

# ═══ STEP 5: GRASS scattered around foreground ═══
print(f"\n═══ GRASS PATCHES (scattered foreground) ═══")
grass_items = groups.get('grass_patch', [])
grass_positions = [
    (-1.5, -18.0), (1.0, -17.5), (3.5, -16.5), (-3.0, -16.0),
    (0.5, -15.0), (-2.0, -14.0), (4.0, -13.0), (-4.5, -15.5),
    (2.0, -19.0), (-0.5, -13.5)
]
for i, item in enumerate(grass_items):
    if i >= len(grass_positions): break
    gx, gy = grass_positions[i]
    place(item['name'], gx, gy, rot_z=random.uniform(0, math.pi*2))

# ═══ STEP 6: MIDGROUND (15-25m from camera) ═══
print(f"\n═══ MIDGROUND (Y = -8 to 0) ═══")
place('mossy_boulder_000',  -3.0, -6.0)
place('mossy_boulder_001',   4.0, -4.0)
place('mossy_boulder_002',  -6.0, -2.0)
place('mossy_boulder_003',   7.0, -7.0)
place('mossy_boulder_004',   0.0, -3.0)
place('mossy_trunk_000',    -1.5, -8.0)
place('mossy_trunk_001',     3.0, -5.0)
place('fallen_spruce_000',  -5.0, -4.5, rot_z=math.radians(20))
place('fallen_spruce_001',   6.0, -1.0, rot_z=math.radians(-15))
place('fungi_stump_000',    -2.0,  0.0)
place('fungi_stump_001',     5.0,  2.0, rot_z=math.radians(45))
place('fungi_stump_002',    -7.0,  3.0, rot_z=math.radians(-30))

# ═══ STEP 7: BACKGROUND TREES (30-55m from camera) ═══
print(f"\n═══ BACKGROUND TREES (Y = 5 to 30) ═══")

# Back row 1: fir + lowpoly (Y ~8-12, spread X -12 to 12)
tree_placements = [
    ('fir_tree_000',       -10.0,  8.0),
    ('lowpoly_tree_000',    -6.0, 10.0),
    ('fir_tree_001',        -2.0,  9.0),
    ('lowpoly_tree_001',     2.0, 11.0),
    ('fir_tree_002',         6.0,  8.0),
    ('lowpoly_tree_002',    10.0, 10.0),
    ('fir_tree_003',        13.0,  9.0),
    ('lowpoly_tree_003',   -13.0, 11.0),
    ('lowpoly_tree_004',    -3.0, 12.0),
]
for name, tx, ty in tree_placements:
    jx = random.uniform(-1.0, 1.0)
    jy = random.uniform(-1.0, 1.0)
    place(name, tx + jx, ty + jy, rot_z=random.uniform(0, math.pi*2))

# Back row 2: stylized + cartoon + palm (Y ~16-25)
tree_placements2 = [
    ('stylized_tree_000',   -12.0, 18.0),
    ('cartoon_tree_000',     -7.0, 20.0),
    ('stylized_tree_001',    -2.0, 17.0),
    ('palm_tree_000',         3.0, 19.0),
    ('cartoon_tree_001',      7.0, 18.0),
    ('stylized_tree_002',    12.0, 20.0),
    ('palm_tree_001',       -15.0, 22.0),
    ('cartoon_tree_002',      0.0, 22.0),
    ('stylized_tree_003',    16.0, 17.0),
    ('cartoon_tree_003',     -4.0, 24.0),
    ('stylized_tree_004',     9.0, 24.0),
]
for name, tx, ty in tree_placements2:
    jx = random.uniform(-1.5, 1.5)
    jy = random.uniform(-1.5, 1.5)
    place(name, tx + jx, ty + jy, rot_z=random.uniform(0, math.pi*2))

# ═══ STEP 8: BUTTERFLIES (floating above hero) ═══
print(f"\n═══ BUTTERFLIES ═══")
for name in ['butterfly_000', 'butterfly_001', 'butterfly_002']:
    item = by_name.get(name)
    if item:
        bx = random.uniform(-2, 3)
        by = random.uniform(-17, -14)
        bz = random.uniform(1.5, 2.5)
        item['obj'].location = (bx, by, bz)
        print(f"  {name} → ({bx:.1f}, {by:.1f}, {bz:.1f})")

# ═══ GROUND PLANE ═══
ground = bpy.data.objects.get('Ground')
if ground:
    ground.scale = (60, 60, 1)
    ground.location = (0, 5, 0)

# ═══ SAVE & RENDER ═══
blend_path = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v3_framed.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

render_path = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v3_BUILT.png'
scene.render.filepath = render_path
bpy.ops.render.render(write_still=True)

print(f"\n═══ SCENE BUILT ═══")
print(f"  Saved: {blend_path}")
print(f"  Rendered: {render_path}")
