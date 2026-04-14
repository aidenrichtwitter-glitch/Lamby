import bpy, math
from mathutils import Vector

scene = bpy.context.scene

# Check actual model position and size
all_mesh = [o for o in bpy.data.objects if o.type == 'MESH' and o.name != 'Floor']
min_co = Vector((float('inf'),)*3)
max_co = Vector((float('-inf'),)*3)
for obj in all_mesh:
    for v in obj.bound_box:
        co = obj.matrix_world @ Vector(v)
        for i in range(3):
            if co[i] < min_co[i]: min_co[i] = co[i]
            if co[i] > max_co[i]: max_co[i] = co[i]

center = (min_co + max_co) / 2
height = max_co[2] - min_co[2]
print(f"Model height: {height:.3f}, Center: ({center.x:.3f}, {center.y:.3f}, {center.z:.3f})")
print(f"Bounds: min=({min_co.x:.3f}, {min_co.y:.3f}, {min_co.z:.3f}) max=({max_co.x:.3f}, {max_co.y:.3f}, {max_co.z:.3f})")

# Camera: get close, centered on model torso
cam = bpy.data.objects.get("AnimeCamera")
if cam:
    # Position camera to frame the character nicely
    # Model center height = center.z, camera should look at about 60% height (chest area)
    look_at_z = min_co.z + height * 0.55
    cam_distance = height * 1.8  # Distance proportional to height
    
    cam.location = (center.x, center.y - cam_distance, look_at_z)
    
    # Point camera at model center
    direction = Vector((center.x, center.y, look_at_z)) - cam.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()
    
    cam.data.lens = 50
    cam.data.dof.focus_distance = cam_distance
    cam.data.dof.aperture_fstop = 3.5
    
    print(f"Camera at: ({cam.location.x:.2f}, {cam.location.y:.2f}, {cam.location.z:.2f})")
    print(f"Camera distance: {cam_distance:.2f}")

# Floor: move to model base
floor = bpy.data.objects.get("Floor")
if floor:
    floor.location.z = min_co.z
    floor.scale = (height * 2, height * 2, 1)

# Render
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080

bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_scene.blend')
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_cel_shaded.png'
bpy.ops.render.render(write_still=True)
print("ANIME_FIXED_RENDER_COMPLETE")
