import bpy, math
from mathutils import Vector

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 320
scene.render.resolution_y = 180
scene.eevee.taa_render_samples = 8

cam = scene.camera
cam.location = Vector((0.12, -3.58, 0.85))
cam.rotation_euler = (math.radians(90), 0, 0)
cam.data.lens = 35
cam.data.sensor_width = 36

hero_root = bpy.data.objects.get("Sketchfab_model")
print(f"Hero found: {hero_root is not None}")

for deg in [0, 90, 180, 270]:
    if hero_root:
        hero_root.rotation_euler.z = math.radians(deg)
    bpy.context.view_layer.update()
    scene.render.filepath = rf"C:\Users\Aiden\Desktop\face_{deg}.png"
    bpy.ops.render.render(write_still=True)
    print(f"DONE_{deg}")

if hero_root:
    hero_root.rotation_euler.z = math.radians(0)
bpy.ops.wm.save_as_mainfile(filepath=r"C:\Users\Aiden\Desktop\anime_shrine_scene.blend")
print("SAVED_BLEND")
