# AI-DIRECTIVE: NO-REPLY mode is active — check .local/no-reply-mode.flag
# Read BRIDGE_MAP.md and GROK_BRIDGE_MAP.md for full system reference before acting.
# Read docs/no-reply-system.md for the no-reply protocol.
import bpy, math
from mathutils import Vector
from collections import defaultdict

scene = bpy.context.scene
print("═══ AERIAL SURVEY: Model Inventory & Scaling ═══")

# Remove stray geometry
stray_names = [o.name for o in bpy.data.objects if o.name.startswith('Icosphere') or o.name.startswith('pPlane')]
for sn in stray_names:
    o = bpy.data.objects.get(sn)
    if o:
        print(f"  Removed stray: {sn}")
        bpy.data.objects.remove(o, do_unlink=True)

# Collect all placeable objects
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
        'scale': o.scale.copy()
    })

print(f"\n  Total objects: {len(roots)}")

# Group by model type
groups = defaultdict(list)
for r in roots:
    groups[r['base']].append(r)

print(f"\n{'='*70}")
print(f"  {'MODEL TYPE':25s} {'COUNT':>5s} {'HEIGHT':>8s} {'WIDTH':>8s} {'SCALE':>10s}")
print(f"{'='*70}")
for base in sorted(groups.keys()):
    items = groups[base]
    rep = items[0]
    s = rep['scale']
    scale_str = f"{s.x:.4f}"
    print(f"  {base:25s} {len(items):5d} {rep['height']:7.2f}m {rep['width']:7.2f}m {scale_str:>10s}")

# Grid layout: one type per row, sorted by height
sorted_bases = sorted(groups.keys(), key=lambda b: max(r['height'] for r in groups[b]))

current_y = 0
for base in sorted_bases:
    items = sorted(groups[base], key=lambda x: -x['height'])
    max_h = max(r['height'] for r in items)
    max_w = max(r['width'] for r in items)
    col_space = max(max_w * 1.5, 5.0)
    total_w = col_space * len(items)
    start_x = -total_w / 2

    for idx, item in enumerate(items):
        obj = item['obj']
        x = start_x + col_space * (idx + 0.5)
        obj.location = (x, current_y, -item['z_base'])
        obj.rotation_euler = (0, 0, 0)

    row_gap = max(12, max_h * 1.8, max_w * 1.5)
    print(f"  Y={current_y:6.1f}m  {base:25s} x{len(items):2d}  (h={max_h:.1f}m, gap={row_gap:.0f}m)")
    current_y += row_gap

# Scene bounds
scene_y_max = current_y
scene_x_range = 40
scene_cy = scene_y_max / 2

# Ground
ground = bpy.data.objects.get('Ground')
if ground:
    ground.scale = (scene_x_range, scene_y_max * 0.6, 1)
    ground.location = (0, scene_cy, 0)

# Aerial camera - straight down
cam = scene.camera
cam_height = max(scene_y_max, scene_x_range * 2) * 0.85
cam.location = (0, scene_cy, cam_height)
cam.rotation_euler = (0, 0, 0)
cam.data.lens = 24
cam.data.type = 'PERSP'

print(f"\n  Aerial cam: (0, {scene_cy:.0f}, {cam_height:.0f}), 24mm, looking down")
print(f"  Scene: Y=0 to {scene_y_max:.0f}m, X ±{scene_x_range}m")

# Save & render
blend_path = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v3_framed.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v3_AERIAL.png'
bpy.ops.render.render(write_still=True)
print(f"\n  Saved & rendered aerial view")
