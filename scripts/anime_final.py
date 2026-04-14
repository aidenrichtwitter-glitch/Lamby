import bpy
from mathutils import Vector

scene = bpy.context.scene
cam = bpy.data.objects.get("AnimeCamera")
if cam:
    # Pull back a bit and lower slightly to capture full character with headroom
    cam.location = (0.4, -3.8, 0.95)
    
    # Look at character center (slightly above midpoint)
    target = Vector((0, 0, 0.9))
    direction = target - cam.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()
    cam.data.lens = 55
    
    print(f"Camera adjusted: loc=({cam.location.x:.2f},{cam.location.y:.2f},{cam.location.z:.2f}), lens={cam.data.lens}")

# Save and render
bpy.ops.wm.save_as_mainfile(filepath='C:/Users/Aiden/Desktop/godmode-evidence/anime_scene.blend')
scene.render.filepath = 'C:/Users/Aiden/Desktop/godmode-evidence/anime_cel_shaded.png'
bpy.ops.render.render(write_still=True)
print("ANIME_FINAL_RENDER_COMPLETE")
