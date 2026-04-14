import bpy
from mathutils import Vector

print("═══ IMPORTING NEW HERO: Luoli Run ═══")

# 1. Remove unwanted objects: root.017 (forest girl diorama) and Icospheres
to_delete = []
for o in bpy.data.objects:
    if o.name == 'root.017' or o.name.startswith('Icosphere'):
        to_delete.append(o)
        for c in o.children_recursive:
            to_delete.append(c)

if to_delete:
    bpy.ops.object.select_all(action='DESELECT')
    for o in to_delete:
        try:
            o.select_set(True)
        except:
            pass
    bpy.ops.object.delete()
    print(f"  Deleted {len(to_delete)} objects (forest girl diorama + icospheres)")

# 2. Import the new GLB
glb_path = r"C:\Users\Aiden\Downloads\3bb3c812efa1447a9bb82000856d9bf3.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)
print(f"  Imported GLB from {glb_path}")

# 3. Find the newly imported root(s)
imported_roots = [o for o in bpy.context.selected_objects if o.parent is None]
if not imported_roots:
    imported_roots = [o for o in bpy.data.objects if o.select_get() and o.parent is None]

print(f"  Found {len(imported_roots)} imported root(s)")

for root in imported_roots:
    # Collect all meshes under this root
    meshes = []
    def collect(obj):
        if obj.type == 'MESH': meshes.append(obj)
        for c in obj.children: collect(c)
    collect(root)
    
    if not meshes:
        print(f"  {root.name}: no meshes, skipping")
        continue
    
    # Measure current height
    bpy.context.view_layer.update()
    bb_min = Vector((float('inf'),)*3)
    bb_max = Vector((float('-inf'),)*3)
    for m in meshes:
        for corner in m.bound_box:
            wc = m.matrix_world @ Vector(corner)
            for i in range(3):
                bb_min[i] = min(bb_min[i], wc[i])
                bb_max[i] = max(bb_max[i], wc[i])
    
    current_h = bb_max[2] - bb_min[2]
    print(f"  {root.name}: native height = {current_h:.2f}m, scale = {root.scale[:]}")
    
    # Scale to target 1.6m
    target_h = 1.6
    if current_h > 0.001:
        scale_factor = target_h / current_h
        root.scale = (root.scale[0] * scale_factor, root.scale[1] * scale_factor, root.scale[2] * scale_factor)
        print(f"  Scaled by {scale_factor:.4f} → target {target_h}m")
    
    # Rename root to anime_girl_000
    root.name = "anime_girl_000"
    print(f"  Renamed to: {root.name}")
    
    # Place at origin for now (hero position)
    root.location = (0, 0, 0)
    
    # Verify final height
    bpy.context.view_layer.update()
    bb_min2 = Vector((float('inf'),)*3)
    bb_max2 = Vector((float('-inf'),)*3)
    for m in meshes:
        for corner in m.bound_box:
            wc = m.matrix_world @ Vector(corner)
            for i in range(3):
                bb_min2[i] = min(bb_min2[i], wc[i])
                bb_max2[i] = max(bb_max2[i], wc[i])
    final_h = bb_max2[2] - bb_min2[2]
    print(f"  Final height: {final_h:.2f}m at origin")
    
    # Count children
    children = len(list(root.children_recursive))
    armatures = sum(1 for c in root.children_recursive if c.type == 'ARMATURE')
    print(f"  Children: {children}, Armatures: {armatures}")

# 4. Save
bpy.ops.wm.save_mainfile()
print("  Scene saved!")
print("═══ DONE ═══")
