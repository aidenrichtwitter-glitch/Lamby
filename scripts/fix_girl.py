import bpy
from mathutils import Vector

scene = bpy.context.scene

# Find anime girl and fix her
girl = bpy.data.objects.get('anime_girl_000')
if girl:
    meshes = [girl] if girl.type == 'MESH' else []
    meshes += [c for c in girl.children_recursive if c.type == 'MESH']
    bb_min_z = float('inf')
    for m in meshes:
        for corner in m.bound_box:
            wc = m.matrix_world @ Vector(corner)
            bb_min_z = min(bb_min_z, wc.z)
    
    print(f"Girl current loc: {girl.location}")
    print(f"Girl bounding box bottom Z (world): {bb_min_z:.4f}")
    
    # Fix: move her up so bottom of bbox is at Z=0
    girl.location.z -= bb_min_z
    
    meshes2 = [girl] if girl.type == 'MESH' else []
    meshes2 += [c for c in girl.children_recursive if c.type == 'MESH']
    new_min_z = float('inf')
    new_max_z = float('-inf')
    for m in meshes2:
        for corner in m.bound_box:
            wc = m.matrix_world @ Vector(corner)
            new_min_z = min(new_min_z, wc.z)
            new_max_z = max(new_max_z, wc.z)
    
    print(f"Girl fixed loc: {girl.location}")
    print(f"Girl height: {new_max_z - new_min_z:.2f}m, bottom at Z={new_min_z:.4f}")

# Save & render
blend_path = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v3_framed.blend'
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

render_path = 'C:/Users/Aiden/Desktop/godmode-evidence/mega_v3_BUILT.png'
scene.render.filepath = render_path
bpy.ops.render.render(write_still=True)
print(f"Rendered fix")
