import bpy
from mathutils import Vector
import math

print("═══ COMPOSING SCENE ═══")

# 1. Place hero (anime_girl_000) at scene center
hero = bpy.data.objects.get("anime_girl_000")
if hero:
    hero.location = (0, 0, 0)
    print(f"  Hero: anime_girl_000 at origin")

# 2. Bring models from parking into scene positions
# Layout: anime girl center, trees around her, decorations scattered
placements = {
    # Trees - background ring
    'cartoon_tree_000': (-4, 3, 0),
    'cartoon_tree_001': (4, 4, 0),
    'cartoon_tree_002': (-6, -2, 0),
    'stylized_tree_000': (6, -1, 0),
    'stylized_tree_001': (-3, 6, 0),
    'fir_tree_000': (7, 3, 0),
    'fir_tree_001': (-7, 1, 0),
    'lowpoly_tree_000': (5, -4, 0),
    'lowpoly_tree_001': (-5, -4, 0),
    'palm_tree_000': (8, -3, 0),
    
    # Deer - near the girl
    'cute_deer_000': (2, 1.5, 0),
    'cute_deer_001': (-2, 2, 0),
    
    # Decorations
    'fantasy_lantern_000': (1.5, -1, 0),
    'fantasy_lantern_001': (-1.5, -1.5, 0),
    'old_bench_000': (-2.5, -0.5, 0),
    'street_lamp_000': (3, -2, 0),
    
    # Ground cover
    'fungi_stump_000': (3, 2, 0),
    'fungi_stump_001': (-3, 3.5, 0),
    'mossy_boulder_000': (4, -2.5, 0),
    'mossy_boulder_001': (-4, -3, 0),
    'mossy_boulder_002': (1, 4, 0),
    'mossy_trunk_000': (-1, -3, 0),
    'mossy_trunk_001': (5, 1, 0),
    'fallen_spruce_000': (-5, 2, 0),
    
    # Grass patches scattered
    'grass_patch_000': (0.5, 1, 0),
    'grass_patch_001': (-0.5, -0.5, 0),
    'grass_patch_002': (2, -0.5, 0),
    'grass_patch_003': (-1, 1.5, 0),
    'grass_patch_004': (3, 0, 0),
    'grass_patch_005': (-2, -2, 0),
    'grass_patch_006': (1, 2.5, 0),
    'grass_patch_007': (-3, 0, 0),
    'grass_patch_008': (0, -2, 0),
    'grass_patch_009': (4, 1.5, 0),
    
    # Butterflies near girl
    'butterfly_000': (0.5, 0.5, 1.2),
    'butterfly_001': (-0.3, 0.8, 1.5),
    'butterfly_002': (1, -0.5, 1.0),
}

placed = 0
for name, pos in placements.items():
    obj = bpy.data.objects.get(name)
    if obj:
        obj.location = pos
        placed += 1

print(f"  Placed {placed} models into scene")

# 3. Unhide camera and lights (needed for rendering)
for obj in bpy.data.objects:
    if obj.type in ('CAMERA', 'LIGHT'):
        obj.hide_viewport = False
        obj.hide_render = False

# 4. Delete icospheres entirely
to_del = [o for o in bpy.data.objects if o.name.startswith('Icosphere')]
if to_del:
    bpy.ops.object.select_all(action='DESELECT')
    for o in to_del:
        o.hide_viewport = False
        o.select_set(True)
    bpy.ops.object.delete()
    print(f"  Deleted {len(to_del)} Icospheres")

# 5. Set up camera for a nice 3/4 view
cam = bpy.context.scene.camera
if cam:
    cam.location = (8, -10, 5)
    direction = Vector((0, 0, 0.8)) - cam.location
    rot = direction.to_track_quat('-Z', 'Y').to_euler()
    cam.rotation_euler = rot
    cam.data.lens = 35
    print(f"  Camera set: ({cam.location.x:.1f},{cam.location.y:.1f},{cam.location.z:.1f}) lens=35mm")

# 6. Set viewport shading to Material Preview for all 3D viewports
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.shading.type = 'MATERIAL'
                print(f"  Viewport shading set to MATERIAL preview")

# 7. Save
bpy.ops.wm.save_mainfile()
print("  Scene saved!")
print("═══ DONE ═══")
