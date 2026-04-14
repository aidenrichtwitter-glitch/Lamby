import bpy
from mathutils import Vector
import math

print("═══ RENDER HERO CHECK ═══")

# Find anime_girl_000
hero = bpy.data.objects.get("anime_girl_000")
if not hero:
    print("ERROR: anime_girl_000 not found!")
    quit()

# Get bounding box
meshes = []
def collect(obj):
    if obj.type == 'MESH': meshes.append(obj)
    for c in obj.children: collect(c)
collect(hero)

bpy.context.view_layer.update()
bb_min = Vector((float('inf'),)*3)
bb_max = Vector((float('-inf'),)*3)
for m in meshes:
    for corner in m.bound_box:
        wc = m.matrix_world @ Vector(corner)
        for i in range(3):
            bb_min[i] = min(bb_min[i], wc[i])
            bb_max[i] = max(bb_max[i], wc[i])

center = (bb_min + bb_max) / 2
h = bb_max[2] - bb_min[2]
w = max(bb_max[0]-bb_min[0], bb_max[1]-bb_min[1])
print(f"  Hero center: ({center.x:.2f}, {center.y:.2f}, {center.z:.2f})")
print(f"  Height: {h:.2f}m, Width: {w:.2f}m")

# Set up camera - front-ish angle, slightly above
cam = bpy.context.scene.camera
if not cam:
    cam_data = bpy.data.cameras.new("RenderCam")
    cam = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

# Position camera: 3/4 front view, slightly above
dist = max(h, w) * 2.5
cam.location = (center.x + dist*0.6, center.y - dist*0.8, center.z + h*0.4)
direction = center - cam.location
rot = direction.to_track_quat('-Z', 'Y').to_euler()
cam.rotation_euler = rot
cam.data.lens = 50

# Set render settings - use Cycles (EEVEE crashes in background)
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.device = 'CPU'
bpy.context.scene.cycles.samples = 32
bpy.context.scene.render.resolution_x = 960
bpy.context.scene.render.resolution_y = 540
bpy.context.scene.render.filepath = r"C:\Users\Aiden\Desktop\godmode-evidence\hero_check.png"
bpy.context.scene.render.image_settings.file_format = 'PNG'

# Make sure world has some light
world = bpy.context.scene.world
if world and world.use_nodes:
    bg = world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Strength'].default_value = 1.0

# Quick render
print("  Rendering hero check...")
bpy.ops.render.render(write_still=True)
print(f"  Saved to: {bpy.context.scene.render.filepath}")
print("═══ DONE ═══")
