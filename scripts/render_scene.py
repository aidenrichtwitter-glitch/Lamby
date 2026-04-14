import bpy
from mathutils import Vector

print("═══ RENDERING COMPOSED SCENE ═══")

cam = bpy.context.scene.camera
print(f"  Camera: ({cam.location.x:.1f},{cam.location.y:.1f},{cam.location.z:.1f}) lens={cam.data.lens:.0f}mm")

bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.device = 'CPU'
bpy.context.scene.cycles.samples = 64
bpy.context.scene.render.resolution_x = 1920
bpy.context.scene.render.resolution_y = 1080
bpy.context.scene.render.filepath = r"C:\Users\Aiden\Desktop\godmode-evidence\scene_composed.png"
bpy.context.scene.render.image_settings.file_format = 'PNG'

print("  Rendering 1920x1080 @ 64 samples...")
bpy.ops.render.render(write_still=True)
print(f"  Saved to: {bpy.context.scene.render.filepath}")
print("═══ DONE ═══")
