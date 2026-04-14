import bpy, math
from mathutils import Vector

scene = bpy.context.scene

# Remove stray planes from the import
for obj in list(bpy.data.objects):
    if 'pPlane' in obj.name or 'Plane' in obj.name.split('_')[0]:
        if obj.name != 'Floor':
            print(f"Removing stray object: {obj.name}")
            bpy.data.objects.remove(obj, do_unlink=True)

# List all objects to see what we have
print("\n--- Scene Objects ---")
for obj in bpy.data.objects:
    print(f"  {obj.type}: {obj.name} | loc=({obj.location.x:.2f},{obj.location.y:.2f},{obj.location.z:.2f}) | scale=({obj.scale.x:.3f},{obj.scale.y:.3f},{obj.scale.z:.3f})")

# Get model bounds (excluding Floor, lights, camera)
all_mesh = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Floor']
min_co = Vector((float('inf'),)*3)
max_co = Vector((float('-inf'),)*3)
for obj in all_mesh:
    for v in obj.bound_box:
        co = obj.matrix_world @ Vector(v)
        for i in range(3):
            if co[i] < min_co[i]: min_co[i] = co[i]
            if co[i] > max_co[i]: max_co[i] = co[i]

height = max_co[2] - min_co[2]
center = (min_co + max_co) / 2
print(f"\nModel height: {height:.3f}, center: ({center.x:.3f}, {center.y:.3f}, {center.z:.3f})")

# Fix floor size
floor = bpy.data.objects.get("Floor")
if floor:
    floor.location = (center.x, center.y, min_co[2])
    floor.scale = (3, 3, 1)

# Camera: portrait-style close shot centered on character
cam = bpy.data.objects.get("AnimeCamera")
if cam:
    look_z = min_co[2] + height * 0.45  # Chest area
    cam_dist = height * 1.5
    cam.location = (center.x + 0.3, center.y - cam_dist, look_z)
    direction = Vector((center.x, center.y, look_z)) - cam.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()
    cam.data.lens = 65
    cam.data.dof.focus_distance = cam_dist
    print(f"Camera: loc=({cam.location.x:.2f},{cam.location.y:.2f},{cam.location.z:.2f}), dist={cam_dist:.2f}")

# Render
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1080
scene.render.resolution_y = 1920  # Portrait orientation for character
scene.render.resolution_percentage = 100

bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_scene.blend')

scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_cel_shaded.png'
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("ANIME_FIX2_RENDER_COMPLETE")
