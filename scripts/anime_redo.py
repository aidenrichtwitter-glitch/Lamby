import bpy, math
from mathutils import Vector

scene = bpy.context.scene

# Remove the Icosphere (it's not part of the character model)
ico = bpy.data.objects.get("Icosphere")
if ico:
    bpy.data.objects.remove(ico, do_unlink=True)
    print("Removed Icosphere")

# Remove Floor to redo it
floor = bpy.data.objects.get("Floor")
if floor:
    bpy.data.objects.remove(floor, do_unlink=True)

# Find actual character meshes
char_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
min_co = Vector((float('inf'),)*3)
max_co = Vector((float('-inf'),)*3)
for obj in char_meshes:
    for v in obj.data.vertices:
        co = obj.matrix_world @ v.co
        for i in range(3):
            if co[i] < min_co[i]: min_co[i] = co[i]
            if co[i] > max_co[i]: max_co[i] = co[i]

height = max_co[2] - min_co[2]
center = (min_co + max_co) / 2
print(f"ACTUAL character height: {height:.4f}")
print(f"Center: ({center.x:.4f}, {center.y:.4f}, {center.z:.4f})")
print(f"Bounds: ({min_co.x:.4f},{min_co.y:.4f},{min_co.z:.4f}) -> ({max_co.x:.4f},{max_co.y:.4f},{max_co.z:.4f})")

# Scale the Sketchfab_model root to make character 2m tall
target_height = 2.0
scale_factor = target_height / height if height > 0.001 else 100
print(f"Scale factor: {scale_factor:.2f}")

root = bpy.data.objects.get("Sketchfab_model")
if root:
    root.scale *= scale_factor
    # Recenter after scaling
    bpy.context.view_layer.update()
    
    # Recalculate bounds
    min_co2 = Vector((float('inf'),)*3)
    max_co2 = Vector((float('-inf'),)*3)
    for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
        for v in obj.data.vertices:
            co = obj.matrix_world @ v.co
            for i in range(3):
                if co[i] < min_co2[i]: min_co2[i] = co[i]
                if co[i] > max_co2[i]: max_co2[i] = co[i]
    
    new_height = max_co2[2] - min_co2[2]
    new_center = (min_co2 + max_co2) / 2
    print(f"New height: {new_height:.3f}")
    
    # Move to origin, feet on ground
    root.location.x -= new_center.x
    root.location.y -= new_center.y
    root.location.z -= min_co2.z
    bpy.context.view_layer.update()

# Final bounds after repositioning
min_co3 = Vector((float('inf'),)*3)
max_co3 = Vector((float('-inf'),)*3)
for obj in [o for o in bpy.data.objects if o.type == 'MESH']:
    for v in obj.data.vertices:
        co = obj.matrix_world @ v.co
        for i in range(3):
            if co[i] < min_co3[i]: min_co3[i] = co[i]
            if co[i] > max_co3[i]: max_co3[i] = co[i]

final_height = max_co3[2] - min_co3[2]
final_center = (min_co3 + max_co3) / 2
print(f"Final height: {final_height:.3f}, center: ({final_center.x:.3f}, {final_center.y:.3f}, {final_center.z:.3f})")

# ─── FLOOR ───
bpy.ops.mesh.primitive_circle_add(vertices=64, radius=3, fill_type='NGON', location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "Floor"
mat_floor = bpy.data.materials.new("FloorMat")
mat_floor.use_nodes = True
fbsdf = mat_floor.node_tree.nodes["Principled BSDF"]
fbsdf.inputs["Base Color"].default_value = (0.92, 0.9, 0.95, 1.0)
fbsdf.inputs["Roughness"].default_value = 0.15
floor.data.materials.append(mat_floor)

# ─── CAMERA ───
cam = bpy.data.objects.get("AnimeCamera")
if cam:
    cam.location = (0.5, -3.0, 1.0)
    direction = Vector((0, 0, final_height * 0.5)) - cam.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()
    cam.data.lens = 50
    cam.data.dof.focus_distance = 3.0
    print(f"Camera set at (0.5, -3.0, 1.0)")

# ─── RENDER ───
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080

bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_scene.blend')

scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_cel_shaded.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("ANIME_REDO_RENDER_COMPLETE")
